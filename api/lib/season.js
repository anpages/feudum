/**
 * Season lifecycle — shared between cron and admin endpoint.
 * resetSeason()              — wipes all game state except user accounts
 * seedNpcs()                 — fills remaining map slots with NPC kingdoms
 * startNewSeason()           — reset + seed boss + seed player kingdoms + seed NPCs
 * repairSeasonNpcsIfMissing() — self-heal: reseed NPCs if none exist
 */
import { randomUUID } from 'crypto'
import { eq, ne, inArray, sql } from 'drizzle-orm'
import {
  db, users, kingdoms, npcState, buildings, units, research,
  armyMissions, debrisFields, buildingQueue, researchQueue, unitQueue,
  userAchievements, battleLog, etherTransactions, seasonSnapshots,
} from '../_db.js'
import { ECONOMY_SPEED, NPC_DENSITY, UNIVERSE } from './config.js'
import { npcClass } from './npc-engine.js'
import { setSetting } from './settings.js'
import { calcPointsBreakdown } from './points.js'
import { getBuildingMap, getResearchMap, getUnitMap } from './db-helpers.js'

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

// ── Snapshot ──────────────────────────────────────────────────────────────────
// Captures each human player's final state before resetSeason() wipes the data.
// Called at the start of startNewSeason() so both manual and auto transitions save history.

export async function snapshotSeason(seasonNumber) {
  const humanKingdoms = await db.select({
    k: kingdoms, userId: users.id, username: users.username,
  })
  .from(kingdoms)
  .innerJoin(users, eq(kingdoms.userId, users.id))
  .where(ne(users.role, 'npc'))

  if (humanKingdoms.length === 0) return

  // Group kingdoms by player
  const playerMap = new Map()
  for (const { k, userId, username } of humanKingdoms) {
    if (!playerMap.has(userId)) playerMap.set(userId, { userId, username, kingdoms: [] })
    playerMap.get(userId).kingdoms.push(k)
  }

  // Achievement counts per player
  const userIds = [...playerMap.keys()]
  const achRows = await db.select({
    userId: userAchievements.userId,
    count:  sql`COUNT(*)`.mapWith(Number),
  })
  .from(userAchievements)
  .where(inArray(userAchievements.userId, userIds))
  .groupBy(userAchievements.userId)
  const achMap = new Map(achRows.map(r => [r.userId, r.count]))

  // Compute points for each player
  const entries = []
  for (const { userId, username, kingdoms: playerKingdoms } of playerMap.values()) {
    const resMap = await getResearchMap(userId)

    // Research counted once per user
    const resBreakdown = calcPointsBreakdown({}, resMap)
    let totalBuilding = 0, totalUnit = 0

    for (const k of playerKingdoms) {
      const bMap = await getBuildingMap(k.id)
      const uMap = await getUnitMap(k.id)
      const bd   = calcPointsBreakdown({ ...k, ...bMap, ...uMap }, {})
      totalBuilding += bd.buildings
      totalUnit     += bd.units
    }

    entries.push({
      userId,
      username,
      seasonNumber,
      rank:             0,  // assigned below after sort
      points:           totalBuilding + resBreakdown.research + totalUnit,
      buildingPoints:   totalBuilding,
      researchPoints:   resBreakdown.research,
      unitPoints:       totalUnit,
      achievementsCount: achMap.get(userId) ?? 0,
      kingdomsCount:    playerKingdoms.length,
    })
  }

  entries.sort((a, b) => b.points - a.points)
  entries.forEach((e, i) => { e.rank = i + 1 })

  if (entries.length > 0) {
    await db.insert(seasonSnapshots).values(entries)
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function resetSeason() {
  // All independent child tables — parallel for speed
  await Promise.all([
    db.delete(buildingQueue),
    db.delete(researchQueue),
    db.delete(unitQueue),
    db.delete(armyMissions),
    db.delete(debrisFields),
    db.delete(userAchievements),
    db.delete(battleLog),
    db.delete(etherTransactions),
  ])

  // NPC users first — cascades their kingdoms, buildings, units, npcState
  await db.delete(users).where(eq(users.role, 'npc'))

  // Human kingdoms + research — independent of each other
  await Promise.all([
    db.delete(kingdoms),
    db.delete(research),
  ])

  // Reset character class and ether — each season players start fresh
  await db.update(users)
    .set({ characterClass: null, ether: 0, updatedAt: new Date() })
    .where(ne(users.role, 'npc'))

  // Clear cron tick history
  await Promise.all([
    setSetting('npc_last_tick',                ''),
    setSetting('npc_tick_history',             '[]'),
    setSetting('combat_engine_last_tick',      ''),
    setSetting('combat_engine_tick_history',   '[]'),
    setSetting('military_ai_last_tick',        ''),
    setSetting('military_ai_tick_history',     '[]'),
  ])
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
      // 1. Insert NPC user (id must be explicit — no DB-level default on uuid PK)
      const [npcUser] = await db.insert(users)
        .values({ id: randomUUID(), role: 'npc', username: npcUsername(realm, region, slot) })
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

// ── Start new season ──────────────────────────────────────────────────────────
// Players do NOT get kingdoms here — they join manually via POST /api/season/join.
// Boss is not included: no boss mechanic in current phase.

export async function startNewSeason(seasonNumber, economySpeed) {
  const speed = parseFloat(economySpeed ?? ECONOMY_SPEED)
  const now   = Math.floor(Date.now() / 1000)

  // Snapshot current season before wiping (works for both manual and auto transitions)
  const prevSeasonNumber = seasonNumber - 1
  if (prevSeasonNumber > 0) {
    await snapshotSeason(prevSeasonNumber)
  }

  // Always reset (clean slate for every season)
  await resetSeason()

  // Seed 50 NPCs at random available slots
  const npcCount = await seedNpcs(new Set(), now, 50)

  // Season settings
  const durationSecs = Math.round((360 / speed) * 86400)
  const seasonEnd    = now + durationSecs

  await Promise.all([
    setSetting('season_number',           String(seasonNumber)),
    setSetting('season_state',            'active'),
    setSetting('season_start',            String(now)),
    setSetting('season_end',              String(seasonEnd)),
    setSetting('season_boss_slug',        ''),
    setSetting('season_winner_user_id',   ''),
    setSetting('season_winner_condition', ''),
  ])

  return { npcCount, durationSecs }
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
