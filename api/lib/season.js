/**
 * Season lifecycle — shared between cron and admin endpoint.
 * resetSeason()    — wipes all game state except user accounts
 * startNewSeason() — reset + seed boss + seed player kingdoms + seed NPCs
 */
import { eq, and, isNotNull } from 'drizzle-orm'
import {
  db, users, kingdoms, armyMissions, debrisFields,
  research, buildingQueue, researchQueue, unitQueue,
  userAchievements, NPC_USER_ID,
} from '../_db.js'
import { ECONOMY_SPEED, NPC_DENSITY, UNIVERSE } from './config.js'
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
function npcName(realm, region, slot) {
  const seed = realm * 374761397 + region * 1234567 + slot * 7654321
  const rand = seededRand(seed); rand()
  const first   = NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]
  const epithet = rand() > 0.5 ? ` ${NPC_EPITHET[Math.floor(rand() * NPC_EPITHET.length)]}` : ''
  return `Reino de ${first}${epithet}`
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function resetSeason() {
  await db.delete(buildingQueue)
  await db.delete(researchQueue)
  await db.delete(unitQueue)
  await db.delete(armyMissions)
  await db.delete(debrisFields)
  await db.delete(kingdoms)
  await db.delete(userAchievements)

  const RESEARCH_ZERO = {
    swordsmanship: 0, armoury: 0, fortification: 0,
    horsemanship: 0, cartography: 0, tradeRoutes: 0,
    alchemy: 0, pyromancy: 0, runemastery: 0, mysticism: 0, dragonlore: 0,
    spycraft: 0, logistics: 0, exploration: 0, diplomaticNetwork: 0, divineBlessing: 0,
    updatedAt: new Date(),
  }
  await db.update(research).set(RESEARCH_ZERO)

  // Reset character class — each season players choose again
  await db.update(users).set({ characterClass: null, updatedAt: new Date() })
    .where(eq(users.isNpc, false))
}

// ── NPC seed ──────────────────────────────────────────────────────────────────

export async function seedNpcs(npcUserId, takenSlots, now) {
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const totalSlots = maxRealm * maxRegion * maxSlot
  const targetNpcs = Math.floor(totalSlots * NPC_DENSITY)

  const available = []
  for (let realm = 1; realm <= maxRealm; realm++)
    for (let region = 1; region <= maxRegion; region++)
      for (let slot = 1; slot <= maxSlot; slot++)
        if (!takenSlots.has(`${realm}:${region}:${slot}`))
          available.push({ realm, region, slot })

  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]]
  }

  const chosen = available.slice(0, Math.min(targetNpcs, available.length))
  const batch = chosen.map(({ realm, region, slot }) => ({
    userId: npcUserId, name: npcName(realm, region, slot),
    realm, region, slot,
    isNpc: true, isBoss: false, npcLevel: 1,
    wood: 500, stone: 500, grain: 500,
    woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
    woodProduction: 0, stoneProduction: 0, grainProduction: 0,
    lastResourceUpdate: now,
  }))

  for (let i = 0; i < batch.length; i += 50)
    await db.insert(kingdoms).values(batch.slice(i, i + 50))

  return batch.length
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

  // Ensure NPC user exists (deterministic UUID; created in migration 0019)
  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.id, NPC_USER_ID)).limit(1)
  if (!npcUser) {
    await db.insert(users).values({
      id: NPC_USER_ID, email: 'npc@feudum.local', isNpc: true, isAdmin: false,
    })
  }
  const npcUserId = NPC_USER_ID

  // Reset (skip on season 1 — nothing to reset)
  if (seasonNumber > 1) await resetSeason()

  const takenSlots = new Set()

  // Boss at center
  const center   = getBossPosition(UNIVERSE)
  const bossSlot = await findFreeSlot(center, takenSlots)
  takenSlots.add(`${bossSlot.realm}:${bossSlot.region}:${bossSlot.slot}`)

  const diff = boss.difficulty
  await db.insert(kingdoms).values({
    userId: npcUserId, name: boss.name, ...bossSlot,
    isNpc: true, isBoss: true, npcLevel: 3,
    wood:  Math.round(500000 * diff), stone: Math.round(400000 * diff), grain: Math.round(100000 * diff),
    woodCapacity: 10_000_000, stoneCapacity: 10_000_000, grainCapacity: 10_000_000,
    sawmill: Math.round(15 * diff), quarry: Math.round(13 * diff),
    grainFarm: Math.round(11 * diff), windmill: Math.round(10 * diff),
    cathedral: Math.round(5 * diff), workshop: Math.round(8 * diff),
    engineersGuild: Math.round(4 * diff), barracks: 12,
    granary: Math.round(6 * diff), stonehouse: Math.round(6 * diff),
    silo: Math.round(5 * diff), academy: Math.round(3 * diff),
    armoury: Math.round(4 * diff), alchemistTower: Math.round(3 * diff),
    ambassadorHall: Math.round(2 * diff),
    squire: Math.round(500 * diff), knight: Math.round(200 * diff),
    paladin: Math.round(80 * diff), warlord: Math.round(30 * diff),
    grandKnight: Math.round(15 * diff), siegeMaster: Math.round(10 * diff),
    warMachine: Math.round(5 * diff), dragonKnight: Math.round(3 * diff),
    archer: Math.round(300 * diff), crossbowman: Math.round(150 * diff),
    ballista: Math.round(60 * diff), mageTower: Math.round(40 * diff),
    palisade: 1, castleWall: 1,
    woodProduction: 0, stoneProduction: 0, grainProduction: 0,
    lastResourceUpdate: now,
  })

  // Fresh kingdom per player
  const playerUsers = await db.select({ id: users.id, username: users.username })
    .from(users).where(eq(users.isNpc, false))

  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
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
          isNpc: false, isBoss: false,
          wood: 500, stone: 500, grain: 500,
          woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
          woodProduction: 0, stoneProduction: 0, grainProduction: 0,
          lastResourceUpdate: now,
        })
        placed = true
      }
    }
  }

  // NPCs fill remaining slots to NPC_DENSITY
  const npcCount = await seedNpcs(npcUserId, takenSlots, now)

  // Season settings
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
// Detects the inconsistent state where season_state='active' but the kingdoms
// table has zero NPCs (e.g. a previous startNewSeason crashed mid-way, or the
// settings flag was flipped manually). Reseeds NPCs without touching player or
// boss kingdoms. Returns null if nothing to do.
export async function repairSeasonNpcsIfMissing(now) {
  const npcCount = await db.$count(kingdoms, eq(kingdoms.isNpc, true))
  if (npcCount > 0) return null

  // Make sure NPC user row exists (may be missing if migration 0019 was skipped)
  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.id, NPC_USER_ID)).limit(1)
  if (!npcUser) {
    await db.insert(users).values({
      id: NPC_USER_ID, email: 'npc@feudum.local', isNpc: true, isAdmin: false,
    })
  }

  // Build taken-slots set from existing (player + any pre-existing boss)
  const existing = await db.select({
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
  }).from(kingdoms)
  const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))

  const seeded = await seedNpcs(NPC_USER_ID, takenSlots, now)
  return { repaired: true, seeded }
}
