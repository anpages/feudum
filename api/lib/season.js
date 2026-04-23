/**
 * Season lifecycle — shared between cron and admin endpoint.
 * resetSeason()              — wipes all game state except user accounts
 * seedNpcs()                 — fills remaining map slots with NPC kingdoms
 * startNewSeason()           — reset + seed boss + seed player kingdoms + seed NPCs
 * repairSeasonNpcsIfMissing() — self-heal: reseed NPCs if none exist
 */
import { eq, ne } from 'drizzle-orm'
import {
  db, users, kingdoms, npcState, buildings, units, research,
  armyMissions, debrisFields, buildingQueue, researchQueue, unitQueue,
  userAchievements,
} from '../_db.js'
import { ECONOMY_SPEED, NPC_DENSITY, UNIVERSE } from './config.js'
import { npcClass } from './npc-engine.js'
import { getBossForSeason, getBossPosition } from './bosses.js'
import { setSetting } from './settings.js'

// ── NPC name generation ───────────────────────────────────────────────────────

const NPC_FIRST = [
  'Aldric','Berthold','Cedric','Dorian','Edmund','Faolan','Gareth','Hadwin',
  'Ingram','Jarvis','Kelwin','Leofric','Maldred','Norbert','Oswin','Perkin',
  'Quillan','Radulf','Sigmund','Torben','Ulric','Valthor','Wendell','Xander',
  'Yorick','Zachary','Aelric','Baldric','Cormac','Drest',
]
const NPC_EPITHET = [
  'el Fuerte','el Sabio','el Oscuro','el Justo','el Temido','el Grande',
  'Puño de Hierro','Corazón de León','el Antiguo','el Intrépido',
]

function wangHash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9)
  n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d)
  return (n ^ (n >>> 15)) >>> 0
}
function seededRand(seed) {
  let s = wangHash(seed)
  return () => { s = wangHash(s + 1); return s / 0x100000000 }
}
function npcKingdomName(realm, region, slot) {
  const seed = realm * 374761397 + region * 1234567 + slot * 7654321
  const rand = seededRand(seed); rand()
  const first   = NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]
  const epithet = rand() > 0.5 ? ` ${NPC_EPITHET[Math.floor(rand() * NPC_EPITHET.length)]}` : ''
  return `Reino de ${first}${epithet}`
}
// Username único: nombre legible + coordenadas para evitar duplicados en users.username
function npcUsername(realm, region, slot) {
  return `${npcKingdomName(realm, region, slot)} [${realm}:${region}:${slot}]`
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function resetSeason() {
  // Queues cascade from kingdoms, but delete explicitly first to be safe
  await db.delete(buildingQueue)
  await db.delete(researchQueue)
  await db.delete(unitQueue)
  // armyMissions has FK to users (userId) — delete before removing NPC users
  await db.delete(armyMissions)
  await db.delete(debrisFields)
  await db.delete(userAchievements)

  // Delete all NPC users — cascades their kingdoms, buildings, units, research, npcState
  await db.delete(users).where(eq(users.role, 'npc'))

  // Delete remaining kingdoms (human players) — cascades buildings, units, queues
  await db.delete(kingdoms)

  // Reset research for human players
  await db.delete(research)

  // Reset character class — each season players choose again
  await db.update(users)
    .set({ characterClass: null, updatedAt: new Date() })
    .where(ne(users.role, 'npc'))
}

// ── NPC seed ──────────────────────────────────────────────────────────────────

export async function seedNpcs(takenSlots, now, count = null) {
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const totalSlots = maxRealm * maxRegion * maxSlot
  const targetNpcs = Math.floor(totalSlots * NPC_DENSITY)

  const available = []
  for (let realm = 1; realm <= maxRealm; realm++)
    for (let region = 1; region <= maxRegion; region++)
      for (let slot = 1; slot <= maxSlot; slot++)
        if (!takenSlots.has(`${realm}:${region}:${slot}`))
          available.push({ realm, region, slot })

  // Shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]]
  }

  const limit  = count !== null ? count : targetNpcs
  const chosen = available.slice(0, Math.min(limit, available.length))

  // Each NPC needs its own user row — process in parallel chunks of 20
  let seeded = 0
  for (let i = 0; i < chosen.length; i += 20) {
    const chunk = chosen.slice(i, i + 20)
    await Promise.all(chunk.map(async ({ realm, region, slot }) => {
      // 1. Insert NPC user
      const [npcUser] = await db.insert(users)
        .values({ role: 'npc', username: npcUsername(realm, region, slot) })
        .returning({ id: users.id })

      // 2. Insert kingdom
      const [kingdom] = await db.insert(kingdoms)
        .values({
          userId: npcUser.id,
          name:   npcKingdomName(realm, region, slot),
          realm, region, slot,
          wood: 500, stone: 500, grain: 500,
          woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
          woodProduction: 0, stoneProduction: 0, grainProduction: 0,
          lastResourceUpdate: now,
        })
        .returning({ id: kingdoms.id })

      // 3. Insert npcState with computed class (placeholder for Phase 19)
      const cls = npcClass({ realm, region, slot })
      await db.insert(npcState).values({ userId: npcUser.id, isBoss: false, npcLevel: 1, npcClass: cls })

      // 4. Insert initial windmill
      await db.insert(buildings).values({ kingdomId: kingdom.id, type: 'windmill', level: 1 })

      seeded++
    }))
  }

  return seeded
}

async function findFreeSlot({ realm, region, slot }, takenSlots) {
  const { maxRegion, maxSlot } = UNIVERSE
  for (let s = slot; s <= maxSlot; s++) {
    const key = `${realm}:${region}:${s}`
    if (!takenSlots.has(key)) return { realm, region, slot: s }
  }
  for (let r = 1; r <= maxRegion; r++) {
    if (r === region) continue
    for (let s = 1; s <= maxSlot; s++) {
      const key = `${realm}:${r}:${s}`
      if (!takenSlots.has(key)) return { realm, region: r, slot: s }
    }
  }
  return { realm, region, slot }
}

// ── Start new season ──────────────────────────────────────────────────────────

export async function startNewSeason(seasonNumber, economySpeed) {
  const boss  = getBossForSeason(seasonNumber)
  const speed = parseFloat(economySpeed ?? ECONOMY_SPEED)
  const now   = Math.floor(Date.now() / 1000)
  const diff  = boss.difficulty

  // Reset (skip on season 1 — nothing to reset)
  if (seasonNumber > 1) await resetSeason()

  const takenSlots = new Set()

  // ── Boss at center ──────────────────────────────────────────────────────────
  const center   = getBossPosition(UNIVERSE)
  const bossSlot = await findFreeSlot(center, takenSlots)
  takenSlots.add(`${bossSlot.realm}:${bossSlot.region}:${bossSlot.slot}`)

  // 1. Boss user
  const [bossUser] = await db.insert(users)
    .values({ role: 'npc', username: boss.name })
    .returning({ id: users.id })

  // 2. Boss kingdom (resource fields only — no building/unit columns)
  const [bossKingdom] = await db.insert(kingdoms)
    .values({
      userId: bossUser.id,
      name:   boss.name,
      ...bossSlot,
      wood:  Math.round(500000 * diff),
      stone: Math.round(400000 * diff),
      grain: Math.round(100000 * diff),
      woodCapacity:  10_000_000,
      stoneCapacity: 10_000_000,
      grainCapacity: 10_000_000,
      woodProduction:  0,
      stoneProduction: 0,
      grainProduction: 0,
      lastResourceUpdate: now,
    })
    .returning({ id: kingdoms.id })

  const bossKingdomId = bossKingdom.id

  // 3. Boss npcState
  await db.insert(npcState).values({ userId: bossUser.id, isBoss: true, npcLevel: 3 })

  // 4. Boss buildings (one row per type)
  await db.insert(buildings).values([
    { kingdomId: bossKingdomId, type: 'sawmill',        level: Math.round(15 * diff) },
    { kingdomId: bossKingdomId, type: 'quarry',         level: Math.round(13 * diff) },
    { kingdomId: bossKingdomId, type: 'grainFarm',      level: Math.round(11 * diff) },
    { kingdomId: bossKingdomId, type: 'windmill',       level: Math.round(10 * diff) },
    { kingdomId: bossKingdomId, type: 'cathedral',      level: Math.round(5  * diff) },
    { kingdomId: bossKingdomId, type: 'workshop',       level: Math.round(8  * diff) },
    { kingdomId: bossKingdomId, type: 'engineersGuild', level: Math.round(4  * diff) },
    { kingdomId: bossKingdomId, type: 'barracks',       level: Math.round(12 * diff) },
    { kingdomId: bossKingdomId, type: 'granary',        level: Math.round(6  * diff) },
    { kingdomId: bossKingdomId, type: 'stonehouse',     level: Math.round(6  * diff) },
    { kingdomId: bossKingdomId, type: 'silo',           level: Math.round(5  * diff) },
    { kingdomId: bossKingdomId, type: 'academy',        level: Math.round(3  * diff) },
    { kingdomId: bossKingdomId, type: 'armoury',        level: Math.round(4  * diff) },
    { kingdomId: bossKingdomId, type: 'alchemistTower', level: Math.round(3  * diff) },
    { kingdomId: bossKingdomId, type: 'ambassadorHall', level: Math.round(2  * diff) },
  ])

  // 5. Boss units
  await db.insert(units).values([
    { kingdomId: bossKingdomId, type: 'squire',       quantity: Math.round(500 * diff) },
    { kingdomId: bossKingdomId, type: 'knight',       quantity: Math.round(200 * diff) },
    { kingdomId: bossKingdomId, type: 'paladin',      quantity: Math.round(80  * diff) },
    { kingdomId: bossKingdomId, type: 'warlord',      quantity: Math.round(30  * diff) },
    { kingdomId: bossKingdomId, type: 'grandKnight',  quantity: Math.round(15  * diff) },
    { kingdomId: bossKingdomId, type: 'siegeMaster',  quantity: Math.round(10  * diff) },
    { kingdomId: bossKingdomId, type: 'warMachine',   quantity: Math.round(5   * diff) },
    { kingdomId: bossKingdomId, type: 'dragonKnight', quantity: Math.round(3   * diff) },
    { kingdomId: bossKingdomId, type: 'archer',       quantity: Math.round(300 * diff) },
    { kingdomId: bossKingdomId, type: 'crossbowman',  quantity: Math.round(150 * diff) },
    { kingdomId: bossKingdomId, type: 'ballista',     quantity: Math.round(60  * diff) },
    { kingdomId: bossKingdomId, type: 'mageTower',    quantity: Math.round(40  * diff) },
    { kingdomId: bossKingdomId, type: 'palisade',     quantity: 1 },
    { kingdomId: bossKingdomId, type: 'castleWall',   quantity: 1 },
  ])

  // 6. Boss research (skip rows where level would be 0)
  const bossResearchDefs = [
    { type: 'swordsmanship',     level: Math.round(8 * diff) },
    { type: 'fortification',     level: Math.round(8 * diff) },
    { type: 'armoury',           level: Math.round(6 * diff) },
    { type: 'horsemanship',      level: Math.round(8 * diff) },
    { type: 'cartography',       level: Math.round(6 * diff) },
    { type: 'tradeRoutes',       level: Math.round(4 * diff) },
    { type: 'alchemy',           level: Math.round(5 * diff) },
    { type: 'pyromancy',         level: Math.round(4 * diff) },
    { type: 'runemastery',       level: Math.round(3 * diff) },
    { type: 'mysticism',         level: Math.round(2 * diff) },
    { type: 'dragonlore',        level: Math.round(1 * diff) },
    { type: 'spycraft',          level: Math.round(3 * diff) },
    { type: 'logistics',         level: Math.round(3 * diff) },
    { type: 'exploration',       level: Math.round(2 * diff) },
    { type: 'diplomaticNetwork', level: 0 },
    { type: 'divineBlessing',    level: 0 },
  ].filter(r => r.level > 0)

  if (bossResearchDefs.length > 0) {
    await db.insert(research).values(
      bossResearchDefs.map(r => ({ userId: bossUser.id, type: r.type, level: r.level }))
    )
  }

  // ── Player kingdoms ─────────────────────────────────────────────────────────
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE

  const playerUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(ne(users.role, 'npc'))

  for (const u of playerUsers) {
    let placed = false
    for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
      const realm  = Math.ceil(Math.random() * maxRealm)
      const region = Math.ceil(Math.random() * maxRegion)
      const slot   = Math.ceil(Math.random() * maxSlot)
      const key    = `${realm}:${region}:${slot}`
      if (!takenSlots.has(key)) {
        takenSlots.add(key)
        await db.insert(kingdoms).values({
          userId: u.id,
          name:   `Reino de ${u.username ?? 'Jugador'}`,
          realm, region, slot,
          wood: 500, stone: 500, grain: 500,
          woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
          woodProduction: 0, stoneProduction: 0, grainProduction: 0,
          lastResourceUpdate: now,
        })
        placed = true
      }
    }
  }

  // ── NPCs fill remaining slots to NPC_DENSITY ────────────────────────────────
  const npcCount = await seedNpcs(takenSlots, now)

  // ── Season settings ─────────────────────────────────────────────────────────
  const durationSecs = Math.round((360 / speed) * 86400)
  const seasonEnd    = now + durationSecs

  await Promise.all([
    setSetting('season_number',           String(seasonNumber)),
    setSetting('season_state',            'active'),
    setSetting('season_start',            String(now)),
    setSetting('season_end',              String(seasonEnd)),
    setSetting('season_boss_slug',        boss.slug),
    setSetting('season_winner_user_id',   ''),
    setSetting('season_winner_condition', ''),
  ])

  return { npcCount, bossSlot, durationSecs, playerCount: playerUsers.length }
}

// ── Self-heal: repair an "active" season that has no NPCs ────────────────────
// Detects the inconsistent state where season_state='active' but no NPC users
// exist (e.g. a previous startNewSeason crashed mid-way, or settings were
// flipped manually). Reseeds NPCs without touching player or boss kingdoms.
// Returns null if nothing to do.
export async function repairSeasonNpcsIfMissing(now) {
  const npcCount = await db.$count(users, eq(users.role, 'npc'))
  if (npcCount > 0) return null

  // Build taken-slots set from existing kingdoms (players + any boss)
  const existing = await db.select({
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
  }).from(kingdoms)
  const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))

  const seeded = await seedNpcs(takenSlots, now)
  return { repaired: true, seeded }
}
