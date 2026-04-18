/**
 * Season management — admin only.
 * POST { action: "start_season" }  → seeds boss, initialises settings
 * POST { action: "end_season" }    → force-ends current season
 * GET                              → returns current season info
 */
import { eq, and } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { getSettings, getStringSetting, setSetting } from '../lib/settings.js'
import { BOSS_POOL, getBossForSeason, getBossPosition } from '../lib/bosses.js'
import { UNIVERSE } from '../lib/config.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  // ── GET — season status ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const cfg = await getSettings()
    const bossKingdom = await getBossKingdom()
    return res.json({
      seasonNumber:          cfg.season_number  ?? null,
      seasonState:           cfg.season_state   ?? null,
      seasonStart:           cfg.season_start   ?? null,
      seasonEnd:             cfg.season_end     ?? null,
      seasonBossSlug:        cfg.season_boss_slug ?? null,
      seasonWinnerUserId:    cfg.season_winner_user_id ?? null,
      seasonWinnerCondition: cfg.season_winner_condition ?? null,
      boss:                  bossKingdom ? {
        id:      bossKingdom.id,
        name:    bossKingdom.name,
        realm:   bossKingdom.realm,
        region:  bossKingdom.region,
        slot:    bossKingdom.slot,
        dragonKnight: bossKingdom.dragonKnight ?? 0,
      } : null,
    })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { action } = req.body ?? {}

  // ── start_season ─────────────────────────────────────────────────────────
  if (action === 'start_season') {
    const cfg = await getSettings()
    const currentState = cfg.season_state

    if (currentState === 'active') {
      return res.status(400).json({ error: 'already_active', hint: 'End the current season first.' })
    }

    // Determine next season number
    const prevNumber = parseInt(cfg.season_number ?? '0', 10)
    const nextNumber = prevNumber + 1
    const boss       = getBossForSeason(nextNumber)

    // Ensure NPC system user exists
    let [npcUser] = await db.select({ id: users.id })
      .from(users).where(eq(users.isNpc, true)).limit(1)
    if (!npcUser) {
      ;[npcUser] = await db.insert(users).values({
        email: 'npc@feudum.internal', isNpc: true, isAdmin: false,
      }).returning({ id: users.id })
    }
    const npcUserId = npcUser.id

    // Remove old boss kingdom (if any)
    await db.delete(kingdoms).where(eq(kingdoms.isBoss, true))

    // Seed boss kingdom at center of universe
    const pos = getBossPosition(UNIVERSE)
    const now = Math.floor(Date.now() / 1000)

    // Check if slot is taken by a player — if so, offset by 1 until free
    const freeSlot = await findFreeSlot(pos)

    // Boss starts with barracks 12 and a handful of Dragon Knights,
    // plus solid production buildings and resources.
    const diff = boss.difficulty
    const bossRow = {
      userId:   npcUserId,
      name:     boss.name,
      ...freeSlot,
      isNpc:    true,
      isBoss:   true,
      npcLevel: 3,

      // Resources — scaled by difficulty
      wood:  Math.round(500000 * diff),
      stone: Math.round(400000 * diff),
      grain: Math.round(100000 * diff),
      woodCapacity:  10_000_000,
      stoneCapacity: 10_000_000,
      grainCapacity: 10_000_000,

      // Buildings — already well-developed
      sawmill:       Math.round(15 * diff),
      quarry:        Math.round(13 * diff),
      grainFarm:     Math.round(11 * diff),
      windmill:      Math.round(10 * diff),
      cathedral:     Math.round(5  * diff),
      workshop:      Math.round(8  * diff),
      engineersGuild: Math.round(4 * diff),
      barracks:      12,
      granary:       Math.round(6  * diff),
      stonehouse:    Math.round(6  * diff),
      silo:          Math.round(5  * diff),
      academy:       Math.round(3  * diff),
      armoury:       Math.round(4  * diff),
      alchemistTower: Math.round(3 * diff),
      ambassadorHall: Math.round(2 * diff),

      // Army — Dragon Knights from day 1
      squire:      Math.round(500  * diff),
      knight:      Math.round(200  * diff),
      paladin:     Math.round(80   * diff),
      warlord:     Math.round(30   * diff),
      grandKnight: Math.round(15   * diff),
      siegeMaster: Math.round(10   * diff),
      warMachine:  Math.round(5    * diff),
      dragonKnight: Math.round(3   * diff),

      // Defenses
      archer:      Math.round(300 * diff),
      crossbowman: Math.round(150 * diff),
      ballista:    Math.round(60  * diff),
      mageTower:   Math.round(40  * diff),
      palisade:    1,
      castleWall:  1,

      woodProduction:  0,
      stoneProduction: 0,
      grainProduction: 0,
      lastResourceUpdate: now,
    }

    const [inserted] = await db.insert(kingdoms).values(bossRow).returning({ id: kingdoms.id })

    // Season duration = base_days / economy_speed
    const economySpeed = parseFloat(cfg.economy_speed ?? 1)
    const baseDays = 30
    const durationSecs = Math.round((baseDays / economySpeed) * 86400)
    const seasonEnd = now + durationSecs

    await Promise.all([
      setSetting('season_number',    nextNumber),
      setSetting('season_state',     'active'),
      setSetting('season_start',     now),
      setSetting('season_end',       seasonEnd),
      setSetting('season_boss_slug', boss.slug),
    ])
    // Clear previous winner
    await setSetting('season_winner_user_id',    '')
    await setSetting('season_winner_condition',   '')

    return res.json({
      ok: true,
      seasonNumber: nextNumber,
      boss:         { ...boss, kingdomId: inserted.id, position: freeSlot },
      seasonEnd,
      durationDays: Math.round(durationSecs / 86400),
    })
  }

  // ── end_season ────────────────────────────────────────────────────────────
  if (action === 'end_season') {
    const winnerUserId = parseInt(req.body.winnerUserId ?? '0', 10) || null
    const condition    = req.body.condition ?? 'admin_forced'

    await Promise.all([
      setSetting('season_state', 'ended'),
      setSetting('season_end',   Math.floor(Date.now() / 1000)),
      setSetting('season_winner_user_id',   winnerUserId ?? ''),
      setSetting('season_winner_condition', condition),
    ])
    return res.json({ ok: true })
  }

  return res.status(400).json({ error: 'unknown_action' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBossKingdom() {
  const [boss] = await db.select().from(kingdoms)
    .where(eq(kingdoms.isBoss, true)).limit(1)
  return boss ?? null
}

async function findFreeSlot({ realm, region, slot }) {
  for (let s = slot; s <= 15; s++) {
    const [existing] = await db.select({ id: kingdoms.id }).from(kingdoms).where(and(
      eq(kingdoms.realm, realm),
      eq(kingdoms.region, region),
      eq(kingdoms.slot, s),
    )).limit(1)
    if (!existing) return { realm, region, slot: s }
  }
  // Fallback: try other regions
  for (let r = 1; r <= 10; r++) {
    if (r === region) continue
    for (let s = 1; s <= 15; s++) {
      const [existing] = await db.select({ id: kingdoms.id }).from(kingdoms).where(and(
        eq(kingdoms.realm, realm),
        eq(kingdoms.region, r),
        eq(kingdoms.slot, s),
      )).limit(1)
      if (!existing) return { realm, region: r, slot: s }
    }
  }
  return { realm, region, slot }
}
