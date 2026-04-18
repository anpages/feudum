/**
 * Unified lazy resource tick.
 * Returns updated { wood, stone, grain, now } — does NOT write to DB.
 * Call this once per request instead of duplicating the 5-line block everywhere.
 */
export function applyResourceTick(kingdom, cfg) {
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600
  const speed   = cfg.economy_speed ?? 1

  if (elapsed <= 0) {
    return { wood: kingdom.wood, stone: kingdom.stone, grain: kingdom.grain, now }
  }

  return {
    wood:  Math.min(kingdom.wood  + kingdom.woodProduction  * elapsed * speed, kingdom.woodCapacity),
    stone: Math.min(kingdom.stone + kingdom.stoneProduction * elapsed * speed, kingdom.stoneCapacity),
    grain: Math.min(kingdom.grain + kingdom.grainProduction * elapsed * speed, kingdom.grainCapacity),
    now,
  }
}
