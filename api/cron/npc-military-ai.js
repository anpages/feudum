/**
 * npc-military-ai — NPC attack, scavenge and expedition dispatch.
 * Vercel Cron: every 20 minutes (vercel.json schedule: every-20 min).
 * Runs on ALL NPCs (no npcNextCheck filter); per-unit cooldowns prevent spam.
 */
import { eq, and, gte, inArray, ne, or } from 'drizzle-orm'
import {
  db, users, kingdoms, npcState, buildings, units, research,
  armyMissions, debrisFields,
} from '../_db.js'
import { upsertUnit } from '../lib/db-helpers.js'
import { NPC_AGGRESSION, NPC_ATTACK_INTERVAL_HOURS, NPC_BASH_LIMIT, UNIVERSE } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { sendPush } from '../lib/push.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET, UNIT_PRIORITY,
  UNIT_COSTS, ATTACK_THRESHOLD,
  npcPersonality, npcClass, totalArmy, depletionFactor, EMPTY_RESEARCH,
} from '../lib/npc-engine.js'
import { calcCargoCapacity } from '../../src/lib/game/battle.js'

const FLEET_RESERVE   = 0.20   // fraction of combat fleet kept home before any mission
const SCAVENGER_CARGO = 20000  // cargo per scavenger unit
const MIN_DEBRIS      = 500    // minimum total debris (wood+stone) worth dispatching scavengers

// ── Expedition depletion ──────────────────────────────────────────────────────

async function getExpeditionDepletion(now) {
  const since = now - 86400
  const rows = await db.select({
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      gte(armyMissions.departureTime, since),
    ))
  const map = {}
  for (const r of rows) {
    const key = `${r.targetRealm}:${r.targetRegion}`
    map[key] = (map[key] ?? 0) + 1
  }
  return map
}

// ── Send spy helper ────────────────────────────────────────────────────────────

async function sendSpyMission(npcKingdom, target, spyMap, universeSpeed, researchRow, now) {
  const scouts = Math.min(2, npcKingdom.scout ?? 0)
  if (scouts === 0) return
  const dist       = calcDistance(npcKingdom, target)
  const travelSecs = calcDuration(dist, { scout: scouts }, 100, universeSpeed, researchRow, null)
  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'spy',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime:  now + travelSecs,
    units: { scout: scouts },
  })
  await upsertUnit(npcKingdom.id, 'scout', (npcKingdom.scout ?? 0) - scouts)
  npcKingdom.scout = (npcKingdom.scout ?? 0) - scouts
  if (!spyMap[npcKingdom.userId]) spyMap[npcKingdom.userId] = { inFlight: false, results: [] }
  spyMap[npcKingdom.userId].inFlight = true
}

// ── Attack AI ─────────────────────────────────────────────────────────────────

async function attackAI(npcKingdom, researchRow, allKingdoms, bashMap, spyMap, now, cfg) {
  if (NPC_AGGRESSION === 0) return false

  const personality = npcPersonality(npcKingdom)
  const cls         = npcClass(npcKingdom)
  const armySize    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (npcKingdom[u] ?? 0), 0)

  const baseThreshold = ATTACK_THRESHOLD[personality]
  const threshold = baseThreshold + (cls === 'general' ? -2 : cls === 'collector' ? 3 : 0)
  if (armySize < threshold) return false

  const intervalSecs = NPC_ATTACK_INTERVAL_HOURS * 3600
  const lastAttack = npcKingdom.lastAttackAt ?? 0
  if (now - lastAttack < intervalSecs) return false

  const activeMissions = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
      eq(armyMissions.startRealm,  npcKingdom.realm),
      eq(armyMissions.startRegion, npcKingdom.region),
      eq(armyMissions.startSlot,   npcKingdom.slot),
    ))
  const maxMissions = cls === 'general' ? 2 : 1
  if (activeMissions.length >= maxMissions) return false

  const atkCoord = `${npcKingdom.realm}:${npcKingdom.region}:${npcKingdom.slot}`
  const radius   = 1 + (cls === 'discoverer' ? 1 : 0)
  const sameRegion = allKingdoms.filter(
    p => p.id !== npcKingdom.id &&
         p.realm === npcKingdom.realm &&
         p.region === npcKingdom.region
  )
  const candidates = sameRegion.length > 0
    ? sameRegion
    : allKingdoms.filter(
        p => p.id !== npcKingdom.id &&
             p.realm === npcKingdom.realm &&
             Math.abs(p.region - npcKingdom.region) <= radius
      )

  if (candidates.length === 0) return false

  // Build attack force (used in both scout and blind paths)
  const minRatio  = cls === 'general' ? 0.70 : personality === 'economy' ? 0.50 : 0.55
  const maxRatio  = cls === 'general' ? 0.90 : personality === 'economy' ? 0.70 : 0.75
  const sendRatio = Math.min(minRatio + Math.random() * (maxRatio - minRatio), 1 - FLEET_RESERVE)
  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent === 0) return false

  const cargo         = calcCargoCapacity(force, cls === 'collector' ? 'collector' : cls === 'general' ? 'general' : null)
  const universeSpeed = parseFloat(cfg.fleet_speed_war ?? 1)
  const npcCharClass  = cls === 'general' ? 'general' : null

  async function doAttack(target) {
    const dist        = calcDistance(npcKingdom, target)
    const travelSecs  = calcDuration(dist, force, 100, universeSpeed, researchRow, npcCharClass)
    const arrivalTime = now + travelSecs
    await db.insert(armyMissions).values({
      userId:       npcKingdom.userId,
      missionType:  'attack',
      state:        'active',
      startRealm:   npcKingdom.realm,
      startRegion:  npcKingdom.region,
      startSlot:    npcKingdom.slot,
      targetRealm:  target.realm,
      targetRegion: target.region,
      targetSlot:   target.slot,
      departureTime: now,
      arrivalTime,
      units: force,
    })
    await db.update(npcState).set({ lastAttackAt: now, updatedAt: new Date() })
      .where(eq(npcState.userId, npcKingdom.userId))
    for (const [u, n] of Object.entries(force)) {
      await upsertUnit(npcKingdom.id, u, (npcKingdom[u] ?? 0) - n)
    }
    const bk = `${atkCoord}→${target.realm}:${target.region}:${target.slot}`
    bashMap[bk] = (bashMap[bk] ?? 0) + 1
    if (!target.isNpc && target.userId) {
      const eta = Math.round(travelSecs / 60)
      sendPush(target.userId, {
        title: '⚔️ ¡Ataque entrante!',
        body: `${npcKingdom.name} (NPC) te ataca. Llega en ~${eta} min.`,
        url: '/armies',
        tag: 'incoming-attack',
      }).catch(() => {})
    }
    return true
  }

  // ── NPCs con exploradores: decisiones basadas en intel de espionaje ──────
  if ((npcKingdom.scout ?? 0) > 0) {
    const spyState = spyMap[npcKingdom.userId]

    // Espía en ruta — esperar resultado antes de actuar
    if (spyState?.inFlight) return false

    const candidateKeys = new Set(candidates.map(p => `${p.realm}:${p.region}:${p.slot}`))
    const usableIntel   = (spyState?.results ?? []).filter(r => candidateKeys.has(r.targetKey))

    if (usableIntel.length > 0) {
      const riskRatio = { economy: 1.5, balanced: 0.8, military: 0.5 }[personality] ?? 0.8
      const atkTotal  = Object.values(force).reduce((s, n) => s + n, 0)

      const eligible = usableIntel
        .map(({ targetKey, result }) => {
          const res        = (result.resources?.wood ?? 0) + (result.resources?.stone ?? 0) + (result.resources?.grain ?? 0)
          const defUnits   = Object.values(result.units   ?? {}).reduce((s, n) => s + n, 0)
          const defDefense = Object.values(result.defense ?? {}).reduce((s, n) => s + n, 0)
          const totalDef   = defUnits + defDefense
          const tooRisky   = totalDef > 0 && atkTotal < totalDef * riskRatio
          const bashKey    = `${atkCoord}→${targetKey}`
          const bashed     = (bashMap[bashKey] ?? 0) >= NPC_BASH_LIMIT
          // Prioritize resources if has cargo, otherwise prefer weaker defenders
          const score      = cargo > 0 ? res : (1000 / (1 + totalDef))
          const target     = candidates.find(p => `${p.realm}:${p.region}:${p.slot}` === targetKey)
          return { target, score, tooRisky, bashed }
        })
        .filter(e => e.target && !e.tooRisky && !e.bashed)
        .sort((a, b) => b.score - a.score)

      if (eligible.length > 0) return await doAttack(eligible[0].target)
      return false // todos demasiado arriesgados o en bash limit
    }

    // Sin inteligencia útil → espiar objetivo desconocido
    const spiedKeys = new Set((spyState?.results ?? []).map(r => r.targetKey))
    const unspied   = candidates.filter(p => !spiedKeys.has(`${p.realm}:${p.region}:${p.slot}`))
    const spyTarget = unspied.length > 0
      ? unspied[Math.floor(Math.random() * unspied.length)]
      : candidates[Math.floor(Math.random() * candidates.length)]
    await sendSpyMission(npcKingdom, spyTarget, spyMap, universeSpeed, researchRow, now)
    return false
  }

  // ── NPCs sin exploradores ─────────────────────────────────────────────────
  // Economy y balanced no atacan sin inteligencia previa
  if (personality !== 'military' && cls !== 'general') return false
  // Military y general: 15% de probabilidad de ataque ciego
  if (Math.random() > 0.15) return false

  const eligible = candidates.filter(p => {
    const k = `${atkCoord}→${p.realm}:${p.region}:${p.slot}`
    return (bashMap[k] ?? 0) < NPC_BASH_LIMIT
  })
  if (eligible.length === 0) return false
  return await doAttack(eligible[Math.floor(Math.random() * eligible.length)])
}

// ── Scavenge AI ───────────────────────────────────────────────────────────────

async function scavengeAI(npcKingdom, allDebris, now, cfg, probability = 0.40) {
  const scavengerCount = npcKingdom.scavenger ?? 0
  if (scavengerCount === 0) return false
  if (Math.random() > probability) return false

  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
  )).limit(1)
  if (existing.length > 0) return false

  const nearby = allDebris.filter(d =>
    d.realm  === npcKingdom.realm &&
    d.region === npcKingdom.region &&
    (d.wood + d.stone) > 0
  )
  if (nearby.length === 0) return false

  const target = nearby.reduce((best, d) =>
    (d.wood + d.stone) > (best.wood + best.stone) ? d : best
  )

  const debrisTotal = (target.wood ?? 0) + (target.stone ?? 0)
  if (debrisTotal < MIN_DEBRIS) return false

  // Don't over-commit scavengers: cap at enough to carry 10× the available debris
  const maxUseful   = Math.ceil((debrisTotal * 10) / SCAVENGER_CARGO)
  const sendCount   = Math.min(scavengerCount, Math.max(1, maxUseful))

  const force = { scavenger: sendCount }
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const dest   = { realm: target.realm,     region: target.region,     slot: target.slot   }
  const dist       = calcDistance(origin, dest)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, {})
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'scavenge',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime,
    units: { scavenger: sendCount },
  })

  await upsertUnit(npcKingdom.id, 'scavenger', scavengerCount - sendCount)
  npcKingdom.scavenger = scavengerCount - sendCount

  return target.id
}

// ── Expedition AI ─────────────────────────────────────────────────────────────

async function expeditionAI(npcKingdom, allNpcKingdoms, researchRow, depletionMap, now, cfg) {
  const cls         = npcClass(npcKingdom)
  const personality = npcPersonality(npcKingdom)
  const probability = cls === 'discoverer' ? 0.35 : personality === 'balanced' ? 0.12 : 0.05
  if (Math.random() > probability) return false

  const total = totalArmy(npcKingdom)
  if (total < 20) return false

  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
    or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'exploring')),
  )).limit(1)
  if (existing.length > 0) return false

  // Solo expedicionar a regiones donde el NPC tenga colonia (misma regla que jugadores).
  // Sin presencia en la región, las "Tierras Ignotas" están demasiado lejos.
  const REALM = npcKingdom.realm
  const ownedRegions = new Set(
    allNpcKingdoms
      .filter(k => k.userId === npcKingdom.userId && k.realm === REALM)
      .map(k => k.region)
  )
  if (ownedRegions.size === 0) return false  // defensivo — al menos su propia región debería estar

  let bestRegion = npcKingdom.region
  let bestFactor = -1
  for (const r of ownedRegions) {
    const count  = depletionMap[`${REALM}:${r}`] ?? 0
    const factor = depletionFactor(count)
    if (
      factor > bestFactor ||
      (factor === bestFactor && Math.abs(r - npcKingdom.region) < Math.abs(bestRegion - npcKingdom.region))
    ) {
      bestFactor = factor
      bestRegion = r
    }
  }

  const sendRatio = 0.15 + Math.random() * 0.10
  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent < 2) return false

  // Fleet reserve: ensure at least FLEET_RESERVE of combat units remains home
  const combatHome = [...UNIT_COMBAT_SET].reduce((s, u) => s + (npcKingdom[u] ?? 0), 0)
  const combatSent = Object.entries(force).filter(([u]) => UNIT_COMBAT_SET.has(u)).reduce((s, [, n]) => s + n, 0)
  if (combatHome > 0 && (combatHome - combatSent) < combatHome * FLEET_RESERVE) return false

  const holdingTime   = 1800 + Math.floor(Math.random() * 1800)
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const target = { realm: REALM, region: bestRegion, slot: UNIVERSE.maxSlot + 1 }
  const dist        = calcDistance(origin, target)
  const travelSecs  = calcDuration(dist, force, 100, universeSpeed, researchRow, null)
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'expedition',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  REALM,
    targetRegion: bestRegion,
    targetSlot:   UNIVERSE.maxSlot + 1,
    departureTime: now,
    arrivalTime,
    holdingTime,
    units: force,
  })

  // Deduct units from units table
  for (const [u, n] of Object.entries(force)) {
    await upsertUnit(npcKingdom.id, u, (npcKingdom[u] ?? 0) - n)
    npcKingdom[u] = (npcKingdom[u] ?? 0) - n
  }

  const key = `${REALM}:${bestRegion}`
  depletionMap[key] = (depletionMap[key] ?? 0) + 1

  return true
}

// ── Colonize AI ───────────────────────────────────────────────────────────────

// ── Transporte intra-imperio ──────────────────────────────────────────────────
// Cuando un NPC tiene 2+ colonias, equilibra recursos enviando caravanas/mercaderes
// desde la colonia con más almacenamiento ocupado a la que menos. Mantiene el
// imperio funcionando sin que las colonias secundarias mueran de hambre.

const TRANSPORT_TRIGGER_RATIO = 0.70  // origen debe estar al 70%+ del cap
const TRANSPORT_NEED_RATIO    = 0.40  // destino debe estar al 40% o menos
const MIN_TRANSFER            = 1000  // no enviar caravanas por <1k recursos
const CARAVAN_CAPACITY        = 25000
const MERCHANT_CAPACITY       = 5000

async function intraEmpireTransportAI(npcKingdom, allNpcKingdoms, now, cfg) {
  // Otras kingdoms del mismo NPC
  const sisterKingdoms = allNpcKingdoms.filter(k =>
    k.userId === npcKingdom.userId && k.id !== npcKingdom.id
  )
  if (sisterKingdoms.length === 0) return false

  const caravans  = npcKingdom.caravan  ?? 0
  const merchants = npcKingdom.merchant ?? 0
  if (caravans === 0 && merchants === 0) return false

  // Una mision transport activa por origen — evitar saturar
  const existing = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'transport'),
      eq(armyMissions.state,       'active'),
      eq(armyMissions.startRealm,  npcKingdom.realm),
      eq(armyMissions.startRegion, npcKingdom.region),
      eq(armyMissions.startSlot,   npcKingdom.slot),
    )).limit(1)
  if (existing.length > 0) return false

  // Identificar recurso con mayor exceso aquí (>70% del cap)
  const resKeys = ['wood', 'stone', 'grain']
  let sourceRes = null
  for (const key of resKeys) {
    const amount   = npcKingdom[key] ?? 0
    const capacity = npcKingdom[`${key}Capacity`] ?? 10000
    if (capacity > 0 && amount / capacity >= TRANSPORT_TRIGGER_RATIO) {
      if (!sourceRes || amount > sourceRes.amount) {
        sourceRes = { key, amount, capacity }
      }
    }
  }
  if (!sourceRes) return false

  // Identificar kingdom hermana con menor ratio del mismo recurso (<40% cap)
  let target = null
  for (const k of sisterKingdoms) {
    const tAmount = k[sourceRes.key] ?? 0
    const tCap    = k[`${sourceRes.key}Capacity`] ?? 10000
    if (tCap === 0) continue
    const tRatio = tAmount / tCap
    if (tRatio <= TRANSPORT_NEED_RATIO) {
      if (!target || tRatio < target.ratio) {
        target = { kingdom: k, amount: tAmount, cap: tCap, ratio: tRatio }
      }
    }
  }
  if (!target) return false

  // Cantidad a transferir: min(30% del origen, espacio libre en destino, capacidad de transporte)
  const transportCapacity = caravans * CARAVAN_CAPACITY + merchants * MERCHANT_CAPACITY
  const fromSource        = Math.floor(sourceRes.amount * 0.30)
  const toTarget          = target.cap - target.amount
  const transferAmount    = Math.min(fromSource, toTarget, transportCapacity)
  if (transferAmount < MIN_TRANSFER) return false

  // Decidir flota: preferir caravanas (más eficientes)
  const force = {}
  let remaining = transferAmount
  if (caravans > 0) {
    const useCaravans = Math.min(caravans, Math.ceil(remaining / CARAVAN_CAPACITY))
    if (useCaravans > 0) {
      force.caravan = useCaravans
      remaining = Math.max(0, remaining - useCaravans * CARAVAN_CAPACITY)
    }
  }
  if (remaining > 0 && merchants > 0) {
    const useMerchants = Math.min(merchants, Math.ceil(remaining / MERCHANT_CAPACITY))
    if (useMerchants > 0) force.merchant = useMerchants
  }
  if (Object.keys(force).length === 0) return false

  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const dist          = calcDistance(npcKingdom, target.kingdom)
  const cls           = npcClass(npcKingdom)
  const travelSecs    = calcDuration(dist, force, 100, universeSpeed, EMPTY_RESEARCH, cls === 'collector' ? 'collector' : null)

  // Crear mision (una sola — toda la carga va en este envío)
  await db.insert(armyMissions).values({
    userId:        npcKingdom.userId,
    missionType:   'transport',
    state:         'active',
    startRealm:    npcKingdom.realm,
    startRegion:   npcKingdom.region,
    startSlot:     npcKingdom.slot,
    targetRealm:   target.kingdom.realm,
    targetRegion:  target.kingdom.region,
    targetSlot:    target.kingdom.slot,
    departureTime: now,
    arrivalTime:   now + travelSecs,
    woodLoad:      sourceRes.key === 'wood'  ? transferAmount : 0,
    stoneLoad:     sourceRes.key === 'stone' ? transferAmount : 0,
    grainLoad:     sourceRes.key === 'grain' ? transferAmount : 0,
    units: force,
  })

  // Deducir recursos del origen y unidades de transporte
  await db.update(kingdoms).set({
    [sourceRes.key]: sourceRes.amount - transferAmount,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, npcKingdom.id))
  npcKingdom[sourceRes.key] = sourceRes.amount - transferAmount

  if (force.caravan) {
    await upsertUnit(npcKingdom.id, 'caravan', caravans - force.caravan)
    npcKingdom.caravan = caravans - force.caravan
  }
  if (force.merchant) {
    await upsertUnit(npcKingdom.id, 'merchant', merchants - force.merchant)
    npcKingdom.merchant = merchants - force.merchant
  }

  return true
}

async function colonizeAI(npcKingdom, allKingdoms, colonizeActiveSet, colonizePendingSlots, researchRow, now, cfg) {
  if ((npcKingdom.colonist ?? 0) === 0) return false
  if (colonizeActiveSet.has(npcKingdom.userId)) return false

  // Cap por cartography — mismas reglas que jugadores: 1 + floor(carto/2).
  // carto 3 → 2 kingdoms, carto 6 → 4, carto 10 → 6.
  const cartography = researchRow.cartography ?? 0
  const maxKingdoms = Math.floor(cartography / 2) + 1
  const userKingdoms = allKingdoms.filter(k => k.userId === npcKingdom.userId)
  if (userKingdoms.length >= maxKingdoms) return false

  // Adyacencia territorial: candidatos = región propia y vecinas (±1) de cualquier
  // colonia del NPC, mismo realm. Inter-realm vendrá en sprint posterior cuando
  // los NPCs construyan colonias en slots de puerto (1-2 / 14-15).
  const takenSlots = new Set(allKingdoms.map(k => `${k.realm}:${k.region}:${k.slot}`))
  const candidateRegions = new Set()
  for (const k of userKingdoms) {
    candidateRegions.add(`${k.realm}:${k.region}`)
    if (k.region - 1 >= 1)                  candidateRegions.add(`${k.realm}:${k.region - 1}`)
    if (k.region + 1 <= UNIVERSE.maxRegion) candidateRegions.add(`${k.realm}:${k.region + 1}`)
  }

  let targetCoord = null
  outer: for (const regionKey of candidateRegions) {
    const [tRealm, tRegion] = regionKey.split(':').map(Number)
    for (let slot = 1; slot <= UNIVERSE.maxSlot; slot++) {
      const key = `${tRealm}:${tRegion}:${slot}`
      if (!takenSlots.has(key) && !colonizePendingSlots.has(key)) {
        targetCoord = { realm: tRealm, region: tRegion, slot }
        break outer
      }
    }
  }
  if (!targetCoord) return false

  const force = { colonist: 1 }
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const dist       = calcDistance(npcKingdom, targetCoord)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, researchRow, null)

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'colonize',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  targetCoord.realm,
    targetRegion: targetCoord.region,
    targetSlot:   targetCoord.slot,
    departureTime: now,
    arrivalTime:  now + travelSecs,
    units: force,
  })

  await upsertUnit(npcKingdom.id, 'colonist', 0)
  npcKingdom.colonist = 0

  colonizeActiveSet.add(npcKingdom.userId)
  colonizePendingSlots.add(`${targetCoord.realm}:${targetCoord.region}:${targetCoord.slot}`)

  return true
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const cfg = await getSettings()

  if (cfg.season_state !== 'active') {
    return res.json({ ok: true, skipped: 'no_active_season' })
  }

  // ── Batch load all NPC kingdoms with their npcState ──────────────────────
  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(npcState.userId, users.id))
    .where(eq(users.role, 'npc'))

  if (npcRows.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  const npcKingdomIds = npcRows.map(r => r.k.id)
  const npcUserIds    = npcRows.map(r => r.k.userId)

  // Spy missions from last 48h — intel window for NPC targeting decisions
  const recentSpyMissions = npcUserIds.length
    ? await db.select({
        userId:       armyMissions.userId,
        targetRealm:  armyMissions.targetRealm,
        targetRegion: armyMissions.targetRegion,
        targetSlot:   armyMissions.targetSlot,
        state:        armyMissions.state,
        result:       armyMissions.result,
      }).from(armyMissions)
        .where(and(
          inArray(armyMissions.userId, npcUserIds),
          eq(armyMissions.missionType, 'spy'),
          gte(armyMissions.departureTime, now - 172800),
        ))
    : []

  // spyMap: userId → { inFlight: bool, results: [{ targetKey, result }] }
  const spyMap = {}
  for (const s of recentSpyMissions) {
    if (!spyMap[s.userId]) spyMap[s.userId] = { inFlight: false, results: [] }
    if (s.state === 'active') {
      spyMap[s.userId].inFlight = true
    } else if ((s.state === 'returning' || s.state === 'completed') && s.result) {
      try {
        const parsed    = JSON.parse(s.result)
        const targetKey = `${s.targetRealm}:${s.targetRegion}:${s.targetSlot}`
        if (!spyMap[s.userId].results.some(r => r.targetKey === targetKey)) {
          spyMap[s.userId].results.push({ targetKey, result: parsed })
        }
      } catch {}
    }
  }

  // Active colonize missions — to avoid duplicate colonist training/dispatch
  const activeColonizeMissions = npcUserIds.length
    ? await db.select({
        userId:       armyMissions.userId,
        targetRealm:  armyMissions.targetRealm,
        targetRegion: armyMissions.targetRegion,
        targetSlot:   armyMissions.targetSlot,
      }).from(armyMissions)
        .where(and(
          inArray(armyMissions.userId, npcUserIds),
          eq(armyMissions.missionType, 'colonize'),
          eq(armyMissions.state, 'active'),
        ))
    : []
  const colonizeActiveSet    = new Set(activeColonizeMissions.map(m => m.userId))
  const colonizePendingSlots = new Set(activeColonizeMissions.map(m => `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`))

  const [allBuildings, allUnitsRows, allResearchRows] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds)),
    db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)),
    db.select().from(research).where(inArray(research.userId, npcUserIds)),
  ])

  // Build lookup maps
  const buildingsByKingdom = {}
  for (const b of allBuildings) {
    if (!buildingsByKingdom[b.kingdomId]) buildingsByKingdom[b.kingdomId] = {}
    buildingsByKingdom[b.kingdomId][b.type] = b.level
  }
  const unitsByKingdom = {}
  for (const u of allUnitsRows) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }
  const researchByUser = {}
  for (const r of allResearchRows) {
    if (!researchByUser[r.userId]) researchByUser[r.userId] = {}
    researchByUser[r.userId][r.type] = r.level
  }

  // Enrich NPC kingdoms (merge buildings + units + npcState fields)
  const allNpcKingdoms = npcRows.map(({ k, ns }) => ({
    ...k,
    ...(buildingsByKingdom[k.id] ?? {}),
    ...(unitsByKingdom[k.id] ?? {}),
    npcLevel:            ns?.npcLevel            ?? 1,
    buildAvailableAt:    ns?.buildAvailableAt     ?? null,
    nextCheck:           ns?.nextCheck            ?? null,
    currentResearch:     ns?.currentResearch      ?? null,
    researchAvailableAt: ns?.researchAvailableAt  ?? null,
    lastAttackAt:        ns?.lastAttackAt         ?? 0,
    lastDecision:        ns?.lastDecision         ?? null,
  }))

  // ── Load player kingdoms ─────────────────────────────────────────────────
  const playerRows = await db.select({ k: kingdoms })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .where(ne(users.role, 'npc'))

  const allKingdoms = [
    ...playerRows.map(({ k }) => ({
      id: k.id, userId: k.userId, name: k.name,
      isNpc: false,
      realm: k.realm, region: k.region, slot: k.slot,
    })),
    ...allNpcKingdoms.map(k => ({
      id: k.id, userId: k.userId, name: k.name,
      isNpc: true,
      realm: k.realm, region: k.region, slot: k.slot,
    })),
  ]

  // ── Bash limit map (attacks last 24h) ────────────────────────────────────
  const recentAttacks = await db.select({
    startRealm:   armyMissions.startRealm,
    startRegion:  armyMissions.startRegion,
    startSlot:    armyMissions.startSlot,
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
    targetSlot:   armyMissions.targetSlot,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      gte(armyMissions.createdAt,  new Date(Date.now() - 24 * 3600 * 1000)),
    ))
  const bashMap = {}
  for (const r of recentAttacks) {
    const key = `${r.startRealm}:${r.startRegion}:${r.startSlot}→${r.targetRealm}:${r.targetRegion}:${r.targetSlot}`
    bashMap[key] = (bashMap[key] ?? 0) + 1
  }

  // ── Debris fields ────────────────────────────────────────────────────────
  const allDebris = await db.select({
    id: debrisFields.id, realm: debrisFields.realm, region: debrisFields.region, slot: debrisFields.slot,
    wood: debrisFields.wood, stone: debrisFields.stone,
  }).from(debrisFields)

  const depletionMap = await getExpeditionDepletion(now)

  // ── Per-NPC AI loop ──────────────────────────────────────────────────────
  let attacked = 0, scavenged = 0, expeditioned = 0
  let colonized = 0, transported = 0

  for (const kingdom of allNpcKingdoms) {
    try {
      const researchRow = researchByUser[kingdom.userId] ?? EMPTY_RESEARCH
      const personality = npcPersonality(kingdom)
      const cls         = npcClass(kingdom)

      // 1. Carroñeo prioritario — collector/economy actúan antes de atacar
      if ((cls === 'collector' || personality === 'economy') && allDebris.length > 0) {
        const prob = cls === 'collector' ? 0.80 : 0.60
        const claimedId = await scavengeAI(kingdom, allDebris, now, cfg, prob)
        if (claimedId) {
          scavenged++
          const idx = allDebris.findIndex(d => d.id === claimedId)
          if (idx >= 0) allDebris.splice(idx, 1)
        }
      }

      // 2. Ataque (con espionaje previo si tiene exploradores)
      if (NPC_AGGRESSION > 0 && allKingdoms.length > 1) {
        const launched = await attackAI(kingdom, researchRow, allKingdoms, bashMap, spyMap, now, cfg)
        if (launched) attacked++
      }

      // 3. Carroñeo secundario — military/balanced después de atacar
      if (cls !== 'collector' && personality !== 'economy' && allDebris.length > 0) {
        const prob = personality === 'military' ? 0.20 : 0.40
        const claimedId = await scavengeAI(kingdom, allDebris, now, cfg, prob)
        if (claimedId) {
          scavenged++
          const idx = allDebris.findIndex(d => d.id === claimedId)
          if (idx >= 0) allDebris.splice(idx, 1)
        }
      }

      // 4. Colonización — si tiene colonizador y slot disponible
      const didColonize = await colonizeAI(kingdom, allKingdoms, colonizeActiveSet, colonizePendingSlots, researchRow, now, cfg)
      if (didColonize) colonized++

      // 5. Expedición — solo a regiones donde el NPC tenga colonia
      const didExpedition = await expeditionAI(kingdom, allNpcKingdoms, researchRow, depletionMap, now, cfg)
      if (didExpedition) expeditioned++

      // 6. Transporte intra-imperio — equilibrar recursos entre colonias propias
      const didTransport = await intraEmpireTransportAI(kingdom, allNpcKingdoms, now, cfg)
      if (didTransport) transported++

    } catch (err) {
      console.error(`[npc-military-ai] kingdom ${kingdom.id} error:`, err?.message ?? err)
    }
  }

  // Persist tick for admin monitor
  const militaryTick = { at: now, npcCount: allNpcKingdoms.length, attacked, scavenged, expeditioned, colonized, transported }
  const MAX_HISTORY = 48
  let militaryHistory = []
  try { const raw = cfg.military_ai_tick_history; if (raw) militaryHistory = JSON.parse(raw) } catch { militaryHistory = [] }
  militaryHistory.push(militaryTick)
  if (militaryHistory.length > MAX_HISTORY) militaryHistory = militaryHistory.slice(-MAX_HISTORY)
  await Promise.all([
    setSetting('military_ai_last_tick',    JSON.stringify(militaryTick)),
    setSetting('military_ai_tick_history', JSON.stringify(militaryHistory)),
  ])

  return res.json({
    ok: true, at: now,
    npcCount: allNpcKingdoms.length,
    attacked, scavenged, expeditioned, colonized, transported,
  })
}
