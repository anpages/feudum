/**
 * npc-health — snapshot horario de salud del crecimiento NPC.
 * Vercel Cron: cada 4 horas (vercel.json schedule: 0 each-4h).
 * Guarda npc_health_history en settings (últimos 72 reportes = 12 días).
 * Detecta bloqueos, estancamiento y anomalías usando contexto histórico.
 */
import { eq, inArray } from 'drizzle-orm'
import { db, kingdoms, users, npcState, buildings, units } from '../_db.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { isSleepTime } from '../lib/npc-engine.js'
import { ECONOMY_SPEED } from '../lib/config.js'

const COMBAT_KEYS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const MAX_HISTORY = 72  // 12 días a razón de 1 reporte cada 4h

function avg(arr, fn) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0) / arr.length
}

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

  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(eq(users.role, 'npc'))

  if (npcRows.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  const npcKingdomIds = npcRows.map(r => r.k.id)

  const [allBuildings, allUnits] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds)),
    db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)),
  ])

  const buildingsByKingdom = {}
  for (const b of allBuildings) {
    if (!buildingsByKingdom[b.kingdomId]) buildingsByKingdom[b.kingdomId] = {}
    buildingsByKingdom[b.kingdomId][b.type] = b.level
  }
  const unitsByKingdom = {}
  for (const u of allUnits) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }

  const allNpcs = npcRows
    .filter(({ ns }) => !(ns?.isBoss))
    .map(({ k, ns }) => ({
      ...k,
      ...(buildingsByKingdom[k.id] ?? {}),
      ...(unitsByKingdom[k.id]    ?? {}),
      lastDecision: ns?.lastDecision ?? null,
    }))

  if (allNpcs.length === 0) return res.json({ ok: true, skipped: 'no_regular_npcs' })

  const combatUnits = n => COMBAT_KEYS.reduce((s, u) => s + (n[u] ?? 0), 0)

  // ── Métricas ───────────────────────────────────────────────────────────────
  const savingCount      = allNpcs.filter(n => (n.lastDecision ?? '').toLowerCase().startsWith('ahorrando')).length
  const savingPct        = Math.round(savingCount / allNpcs.length * 100)
  const totalCombatUnits = allNpcs.reduce((s, n) => s + combatUnits(n), 0)
  const npcsWithUnits    = allNpcs.filter(n => combatUnits(n) > 0).length

  const seasonStart    = parseInt(cfg.season_start ?? '0', 10)
  const seasonAgeHours = seasonStart > 0 ? parseFloat(((now - seasonStart) / 3600).toFixed(1)) : 0
  const speed          = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)

  const metrics = {
    npcCount:        allNpcs.length,
    savingPct,
    activePct:       100 - savingPct,
    avgSawmill:      parseFloat(avg(allNpcs, n => n.sawmill  ?? 0).toFixed(1)),
    avgQuarry:       parseFloat(avg(allNpcs, n => n.quarry   ?? 0).toFixed(1)),
    avgWindmill:     parseFloat(avg(allNpcs, n => n.windmill ?? 0).toFixed(1)),
    avgBarracks:     parseFloat(avg(allNpcs, n => n.barracks ?? 0).toFixed(1)),
    avgWoodProd:     Math.round(avg(allNpcs, n => n.woodProduction  ?? 0)),
    avgStoneProd:    Math.round(avg(allNpcs, n => n.stoneProduction ?? 0)),
    totalCombatUnits,
    npcsWithUnits,
    seasonAgeHours,
    economySpeed:    speed,
  }

  // ── Historial existente ────────────────────────────────────────────────────
  let history = []
  try { if (cfg.npc_health_history) history = JSON.parse(cfg.npc_health_history) }
  catch { history = [] }

  // ── Detección de anomalías ─────────────────────────────────────────────────
  const anomalies = []
  const inSleep = isSleepTime(now)

  // Durante la ventana de sueño (1h-8h UTC) los lastDecision están rancios —
  // la mayoría de NPCs no se reprocesa en horas, así que savingPct no refleja
  // la realidad y dispara falsos positivos.
  if (!inSleep && savingPct >= 85) {
    anomalies.push(`${savingPct}% NPCs bloqueados (ahorrando)`)
  }

  if (totalCombatUnits === 0 && seasonAgeHours >= 48) {
    anomalies.push(`Sin unidades de combate tras ${Math.round(seasonAgeHours)}h de temporada`)
  }

  if (metrics.avgQuarry < 3 && seasonAgeHours >= 72) {
    anomalies.push(`Cantera en lv${metrics.avgQuarry} prom. tras ${Math.round(seasonAgeHours)}h — piedra insuficiente`)
  }

  if (metrics.avgStoneProd < 30 && seasonAgeHours >= 96) {
    anomalies.push(`Producción de piedra muy baja (${metrics.avgStoneProd}/h base) tras ${Math.round(seasonAgeHours)}h`)
  }

  // Tendencia: 3 lecturas consecutivas con ≥85% bloqueados (excluir ventana de sueño)
  const recent3 = history.slice(-3).filter(r => !r.sleep)
  const allStuck = !inSleep && recent3.length >= 3 && recent3.every(r => (r.metrics?.savingPct ?? 0) >= 85)
  if (allStuck && savingPct >= 85) {
    anomalies.push(`Bloqueados en ${recent3.length + 1} lecturas consecutivas — revisar IA`)
  }

  // Tendencia: cantera sin progreso en 3 lecturas
  if (history.length >= 3) {
    const last3Quarry = history.slice(-3).map(r => r.metrics?.avgQuarry ?? 0)
    if (last3Quarry.every(v => v === metrics.avgQuarry) && metrics.avgQuarry < 3) {
      anomalies.push(`Cantera sin progreso en las últimas ${last3Quarry.length + 1} lecturas (lv${metrics.avgQuarry})`)
    }
  }

  // ── Estado final ───────────────────────────────────────────────────────────
  let status = 'ok'
  if (anomalies.length > 0)                               status = 'warning'
  if (allStuck && savingPct >= 85)                        status = 'critical'
  if (totalCombatUnits === 0 && seasonAgeHours >= 72)     status = 'critical'

  const report = { ts: now, status, metrics, anomalies, sleep: isSleepTime(now) }

  history.push(report)
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)

  await setSetting('npc_health_history', JSON.stringify(history))

  return res.json({ ok: true, report })
}
