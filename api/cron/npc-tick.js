/**
 * DEPRECATED — split into three focused crons:
 *   api/cron/combat-engine.js   (every 1 min)  — mission resolution + IntrusionDetector
 *   api/cron/npc-builder.js     (every 1 min)  — resource tick + cascade growth AI
 *   api/cron/npc-military-ai.js (every 20 min) — attack / scavenge / expedition dispatch
 *
 * Shared constants and pure helpers → api/lib/npc-engine.js
 */
export default async function handler(_req, res) {
  return res.status(410).json({ error: 'gone', message: 'Use combat-engine, npc-builder, or npc-military-ai instead.' })
}
