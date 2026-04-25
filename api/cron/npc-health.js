/**
 * npc-health — snapshot de salud NPC cada 4h.
 * Detecta ESTANCAMIENTO real: savingPct alto + cero crecimiento desde el
 * snapshot anterior. Un NPC ahorrando entre construcciones es normal; lo
 * anómalo es que no progrese en edificios ni unidades durante 4h o más.
 */
import { eq, inArray } from 'drizzle-orm'
import { db, kingdoms, users, npcState, buildings, units } from '../_db.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { isSleepTime } from '../lib/npc-engine.js'
import { ECONOMY_SPEED } from '../lib/config.js'

const ALL_BUILDINGS = [
  'sawmill','quarry','grainFarm','windmill','cathedral',
  'workshop','engineersGuild','barracks','academy',
  'granary','stonehouse','silo',
  'alchemistTower','ambassadorHall','armoury',
]
const COMBAT_KEYS  = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const SUPPORT_KEYS = ['merchant','caravan','scavenger','colonist','scout']
const DEFENSE_KEYS = ['beacon','archer','crossbowman','moat','ballista','mageTower','palisade','catapult','trebuchet','castleWall','dragonCannon']
const MAX_HISTORY  = 72  // 12 días a razón de 1 reporte cada 4h

function avg(arr, fn) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0) / arr.length
}
function sumField(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0)
}
function calcBuildingScore(npcs) {
  return npcs.reduce((t, n) => t + ALL_BUILDINGS.reduce((s, b) => s + (n[b] ?? 0), 0), 0)
}
function calcCombatUnits(n)  { return COMBAT_KEYS.reduce((s, k)  => s + (n[k] ?? 0), 0) }
function calcSupportUnits(n) { return SUPPORT_KEYS.reduce((s, k) => s + (n[k] ?? 0), 0) }
function calcDefenseUnits(n) { return DEFENSE_KEYS.reduce((s, k) => s + (n[k] ?? 0), 0) }
function avgBld(npcs, key)  { return parseFloat(avg(npcs, n => n[key] ?? 0).toFixed(1)) }

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

  // ── Métricas ───────────────────────────────────────────────────────────────
  const savingCount        = allNpcs.filter(n => (n.lastDecision ?? '').toLowerCase().startsWith('ahorrando')).length
  const savingPct          = Math.round(savingCount / allNpcs.length * 100)
  const totalCombatUnits   = sumField(allNpcs, calcCombatUnits)
  const totalSupportUnits  = sumField(allNpcs, calcSupportUnits)
  const totalDefenseUnits  = sumField(allNpcs, calcDefenseUnits)
  const totalBuildingScore = calcBuildingScore(allNpcs)

  const seasonStart    = parseInt(cfg.season_start ?? '0', 10)
  const seasonAgeHours = seasonStart > 0 ? parseFloat(((now - seasonStart) / 3600).toFixed(1)) : 0
  const speed          = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)

  const metrics = {
    npcCount:           allNpcs.length,
    savingPct,
    activePct:          100 - savingPct,
    // Indicadores de crecimiento (se comparan con el snapshot anterior)
    totalBuildingScore,
    totalCombatUnits,
    totalSupportUnits,
    totalDefenseUnits,
    // Edificios clave para diagnóstico
    avgSawmill:         avgBld(allNpcs, 'sawmill'),
    avgQuarry:          avgBld(allNpcs, 'quarry'),
    avgGrainFarm:       avgBld(allNpcs, 'grainFarm'),
    avgWindmill:        avgBld(allNpcs, 'windmill'),
    avgWorkshop:        avgBld(allNpcs, 'workshop'),
    avgEngineersGuild:  avgBld(allNpcs, 'engineersGuild'),
    avgBarracks:        avgBld(allNpcs, 'barracks'),
    avgAcademy:         avgBld(allNpcs, 'academy'),
    avgCathedral:       avgBld(allNpcs, 'cathedral'),
    // Producción
    avgWoodProd:        Math.round(avg(allNpcs, n => n.woodProduction  ?? 0)),
    avgStoneProd:       Math.round(avg(allNpcs, n => n.stoneProduction ?? 0)),
    seasonAgeHours,
    economySpeed:       speed,
  }

  // ── Historial existente ────────────────────────────────────────────────────
  let history = []
  try { if (cfg.npc_health_history) history = JSON.parse(cfg.npc_health_history) }
  catch { history = [] }

  // ── Comparación con snapshot anterior ─────────────────────────────────────
  const prevMetrics = history.length > 0 ? history[history.length - 1].metrics : null

  let growthDelta = null
  if (prevMetrics) {
    const bldDelta     = totalBuildingScore - (prevMetrics.totalBuildingScore ?? 0)
    const combatDelta  = totalCombatUnits   - (prevMetrics.totalCombatUnits  ?? 0)
    const supportDelta = totalSupportUnits  - (prevMetrics.totalSupportUnits ?? 0)
    const defenseDelta = totalDefenseUnits  - (prevMetrics.totalDefenseUnits ?? 0)
    growthDelta = { buildings: bldDelta, combat: combatDelta, support: supportDelta, defense: defenseDelta, total: bldDelta + combatDelta + supportDelta + defenseDelta }
  }

  const inSleep = isSleepTime(now)

  // Estancamiento real = alto savingPct + cero crecimiento en edificios y unidades.
  // Si los edificios crecen, los NPCs están funcionando aunque lastDecision diga "ahorrando".
  const isStagnant = !inSleep
    && savingPct >= 85
    && growthDelta !== null
    && growthDelta.buildings <= 0
    && growthDelta.combat    <= 0
    && growthDelta.defense   <= 0

  // Lecturas no-sleep consecutivas marcadas como estancamiento
  const recentNonSleep  = history.slice(-8).filter(r => !r.sleep)
  const consecStagnant  = recentNonSleep.reduce((n, r) => r.stagnant ? n + 1 : 0, 0)

  // ── Detección de anomalías ─────────────────────────────────────────────────
  const anomalies = []

  if (isStagnant && growthDelta) {
    const bldStr = growthDelta.buildings <= 0 ? 'sin cambio en edificios' : `+${growthDelta.buildings} niveles`
    const cmbStr = growthDelta.combat    <= 0 ? 'sin cambio en combate'   : `+${growthDelta.combat} unidades`
    const defStr = growthDelta.defense   <= 0 ? 'sin defensa'             : `+${growthDelta.defense} def.`
    anomalies.push(`Estancamiento: ${bldStr}, ${cmbStr}, ${defStr} en las últimas 4h (${savingPct}% ahorrando)`)
  }

  if (isStagnant && consecStagnant >= 2) {
    anomalies.push(`Sin progreso en ${consecStagnant + 1} lecturas consecutivas (${(consecStagnant + 1) * 4}h) — revisar IA builder`)
  }

  if (totalCombatUnits === 0 && seasonAgeHours >= 72) {
    anomalies.push(`Sin unidades de combate tras ${Math.round(seasonAgeHours)}h de temporada`)
  }

  // Cantera baja: solo si no está progresando (growthDelta nulo o sin mejora en edificios)
  if (metrics.avgQuarry < 3 && seasonAgeHours >= 96 && growthDelta !== null && growthDelta.buildings <= 0) {
    anomalies.push(`Cantera lv${metrics.avgQuarry} prom. sin progreso tras ${Math.round(seasonAgeHours)}h`)
  }

  // ── Estado final ───────────────────────────────────────────────────────────
  let status = 'ok'
  if (anomalies.length > 0)                               status = 'warning'
  if (isStagnant && consecStagnant >= 2)                  status = 'critical'
  if (totalCombatUnits === 0 && seasonAgeHours >= 72)     status = 'critical'

  const report = { ts: now, status, metrics, anomalies, sleep: inSleep, stagnant: isStagnant, growthDelta }

  history.push(report)
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)

  await setSetting('npc_health_history', JSON.stringify(history))

  return res.json({ ok: true, report })
}
