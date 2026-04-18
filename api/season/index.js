/**
 * GET /api/season — public endpoint returning current season info.
 */
import { eq } from 'drizzle-orm'
import { db, kingdoms, users } from '../_db.js'
import { getSettings } from '../lib/settings.js'
import { BOSS_POOL, getBossForSeason } from '../lib/bosses.js'

const COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cfg = await getSettings()

  const seasonNumber    = parseInt(cfg.season_number   ?? '0', 10)
  const seasonState     = cfg.season_state             ?? null
  const seasonStart     = parseInt(cfg.season_start    ?? '0', 10)
  const seasonEnd       = parseInt(cfg.season_end      ?? '0', 10)
  const bossSlug        = cfg.season_boss_slug         ?? null
  const winnerUserId    = parseInt(cfg.season_winner_user_id ?? '0', 10) || null
  const winnerCondition = cfg.season_winner_condition  ?? null

  if (!seasonNumber || !seasonState) {
    return res.json({ active: false, seasonNumber: 0, seasonState: null })
  }

  const boss     = seasonNumber > 0 ? getBossForSeason(seasonNumber) : null
  const now      = Math.floor(Date.now() / 1000)
  const timeLeft = Math.max(0, seasonEnd - now)

  // Boss kingdom data
  const [bossKingdom] = await db.select({
    id: kingdoms.id, name: kingdoms.name,
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    squire: kingdoms.squire, knight: kingdoms.knight, paladin: kingdoms.paladin,
    warlord: kingdoms.warlord, grandKnight: kingdoms.grandKnight,
    siegeMaster: kingdoms.siegeMaster, warMachine: kingdoms.warMachine,
    dragonKnight: kingdoms.dragonKnight,
  }).from(kingdoms).where(eq(kingdoms.isBoss, true)).limit(1)

  const bossArmySize = bossKingdom
    ? COMBAT_UNITS.reduce((s, u) => s + (bossKingdom[u] ?? 0), 0)
    : 0

  // Winner info
  let winner = null
  if (winnerUserId) {
    const [winnerUser] = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.id, winnerUserId)).limit(1)
    winner = winnerUser ?? null
  }

  return res.json({
    active:        seasonState === 'active',
    seasonNumber,
    seasonState,
    seasonStart,
    seasonEnd,
    timeLeft,
    boss: boss ? {
      slug:         boss.slug,
      name:         boss.name,
      difficulty:   boss.difficulty,
      lore:         boss.lore,
      kingdom:      bossKingdom ?? null,
      armySize:     bossArmySize,
    } : null,
    winner: winner ? { ...winner, condition: winnerCondition } : null,
  })
}
