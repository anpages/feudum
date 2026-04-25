/**
 * npc_audit.mjs — Auditoría de salud y crecimiento NPC.
 * Uso: set -a && source .env.local && set +a && node npc_audit.mjs
 *
 * Clasificación usando la misma lógica que npc-builder (getTargetLevels):
 *   "bloqueado real"   — tiene milestones pendientes Y su decisión es "ahorrando"
 *   "ahorrando normal" — todos los milestones del bracket actual cumplidos, ahorrando para el siguiente
 *   "activo"           — construyendo / entrenando / investigando
 */
import './api/lib/env.js'
import { eq, inArray } from 'drizzle-orm'
import { db, users, kingdoms, npcState, buildings, units, research, armyMissions } from './api/_db.js'
import { npcPersonality, getTargetLevels, MILESTONE_ORDER, isSleepTime, calcEnergyBalance } from './api/lib/npc-engine.js'
import { getSettings } from './api/lib/settings.js'
import { NPC_AGGRESSION } from './api/lib/config.js'

const now = Math.floor(Date.now() / 1000)
const cfg = await getSettings()
const speedFactor = parseFloat(cfg.economy_speed ?? '1')
const basicWood   = parseFloat(cfg.basic_wood  ?? '30')
const basicStone  = parseFloat(cfg.basic_stone ?? '15')
const seasonActive = cfg.season_state === 'active'
const sleeping = isSleepTime(now)

const npcRows = await db.select({ k: kingdoms, ns: npcState })
  .from(kingdoms)
  .innerJoin(users, eq(kingdoms.userId, users.id))
  .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
  .where(eq(users.role, 'npc'))

const npcKingdomIds = npcRows.map(r => r.k.id)
const npcUserIds    = npcRows.map(r => r.k.userId)

const [allBuildings, allUnits, allResearch, allMissions] = await Promise.all([
  npcKingdomIds.length ? db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds)) : [],
  npcKingdomIds.length ? db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)) : [],
  npcUserIds.length    ? db.select().from(research).where(inArray(research.userId, npcUserIds)) : [],
  npcUserIds.length    ? db.select({ mt: armyMissions.missionType, st: armyMissions.state })
      .from(armyMissions).where(inArray(armyMissions.userId, npcUserIds)) : [],
])

const bMap = {}; for (const b of allBuildings) { (bMap[b.kingdomId] ??= {})[b.type] = b.level }
const uMap = {}; for (const u of allUnits)     { (uMap[u.kingdomId] ??= {})[u.type] = u.quantity }
const rMap = {}; for (const r of allResearch)  { (rMap[r.userId]    ??= {})[r.type] = r.level }

const all = npcRows.map(({ k, ns }) => ({
  ...k, ...(bMap[k.id] ?? {}), ...(uMap[k.id] ?? {}),
  _res: rMap[k.userId] ?? {},
  isBoss:              ns?.isBoss              ?? false,
  npcLevel:            ns?.npcLevel            ?? 1,
  lastDecision:        ns?.lastDecision        ?? null,
  currentResearch:     ns?.currentResearch     ?? null,
  researchAvailableAt: ns?.researchAvailableAt ?? null,
  currentTask:         ns?.currentTask         ?? null,
  buildAvailableAt:    ns?.buildAvailableAt    ?? null,
  nextCheck:           ns?.nextCheck           ?? null,
}))

const npcs   = all.filter(n => !n.isBoss)
const bosses = all.filter(n => n.isBoss)

function avg(arr, fn) { return arr.length ? arr.reduce((s,x) => s+(fn(x)??0), 0)/arr.length : 0 }
function fmt(n) { return typeof n === 'number' ? n.toFixed(1) : '-' }
function pct(n, t) { return t ? ((n/t)*100).toFixed(1)+'%' : '0%' }

const BUILDINGS_LIST = ['sawmill','quarry','grainFarm','windmill','barracks','workshop',
  'engineersGuild','academy','granary','stonehouse','silo','cathedral','alchemistTower','ambassadorHall','armoury']
const COMBAT  = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const SUPPORT = ['merchant','caravan','scavenger','colonist','scout']
const DEFENSE = ['beacon','archer','crossbowman','moat','ballista','mageTower','palisade','catapult','trebuchet','castleWall','dragonCannon']
const RESEARCH_LIST = ['alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'fortification','swordsmanship','armoury','horsemanship','cartography',
  'tradeRoutes','logistics','spycraft','exploration','diplomaticNetwork']

const army = n => COMBAT.reduce((s,k) => s+(n[k]??0), 0)

// ── Clasificación por hitos ───────────────────────────────────────────────────

function classifyNpc(n) {
  const createdAtSec = n.createdAt
    ? Math.floor(new Date(n.createdAt).getTime() / 1000)
    : now - 3600
  const ageHours = (now - createdAtSec) / 3600 * speedFactor
  const personality = npcPersonality(n)
  const targets = getTargetLevels(personality, ageHours)
  const pending = MILESTONE_ORDER.filter(id => (n[id] ?? 0) < (targets[id] ?? 0))
  const dec = (n.lastDecision ?? '').toLowerCase()
  const saving = dec.startsWith('ahorrando')

  // Si tiene tarea activa en curso → activo aunque lastDecision diga ahorrando
  const taskFinishAt = n.currentTask?.finishAt ?? 0
  const hasActiveTask = (taskFinishAt > now)
    || ((n.buildAvailableAt    ?? 0) > now)
    || ((n.researchAvailableAt ?? 0) > now)

  // Si nextCheck es futuro, el cron aún no lo ha procesado — puede que aún no haya tenido oportunidad
  const pendingCheck = (n.nextCheck ?? 0) > now

  if (hasActiveTask)                        return { status: 'activo',          ageHours, personality, targets, pending, pendingCheck }
  if (saving && pending.length > 0)         return { status: 'bloqueado',       ageHours, personality, targets, pending, pendingCheck }
  if (saving && pending.length === 0)       return { status: 'ahorrando_normal',ageHours, personality, targets, pending, pendingCheck }
  return                                           { status: 'activo',          ageHours, personality, targets, pending, pendingCheck }
}

const classified = npcs.map(n => ({ n, ...classifyNpc(n) }))
const bloqueados      = classified.filter(c => c.status === 'bloqueado')
const ahorrandoNormal = classified.filter(c => c.status === 'ahorrando_normal')
const activos         = classified.filter(c => c.status === 'activo')

// ── Cabecera ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════')
console.log(`  AUDITORÍA NPC  —  ${new Date().toISOString()}`)
console.log(`  economy_speed: ${speedFactor}  |  temporada: ${cfg.season_state ?? 'no configurada'}`)
console.log(`  basic_wood: ${basicWood}/h  basic_stone: ${basicStone}/h  |  agresión NPC: ${NPC_AGGRESSION}`)
if (!seasonActive) console.log('  ⚠ TEMPORADA NO ACTIVA — los crons están parados')
if (sleeping)      console.log('  💤 HORA DE SUEÑO (1h–8h UTC) — npc-builder reduce actividad')
console.log('══════════════════════════════════════════════════')
console.log(`\nTotal NPCs: ${npcs.length}  |  Bosses: ${bosses.length}`)
const defFn = n => DEFENSE.some(u => (n[u]??0) > 0)
console.log(`Con ejército:  ${npcs.filter(n=>army(n)>0).length} (${pct(npcs.filter(n=>army(n)>0).length, npcs.length)})`)
console.log(`Con defensa:   ${npcs.filter(defFn).length} (${pct(npcs.filter(defFn).length, npcs.length)})`)
console.log(`Con merchant:  ${npcs.filter(n=>(n.merchant??0)>0).length}`)
console.log(`Con scavenger: ${npcs.filter(n=>(n.scavenger??0)>0).length}`)
console.log(`Con colonist:  ${npcs.filter(n=>(n.colonist??0)>0).length}`)

// ── Clasificación hitos ───────────────────────────────────────────────────────

const pendingCheckCount = classified.filter(c => c.pendingCheck).length
const overdueCount      = classified.filter(c => !c.pendingCheck).length

console.log('\n── Clasificación por hitos ──')
console.log(`  Bloqueados reales:   ${bloqueados.length.toString().padStart(3)}  (${pct(bloqueados.length, npcs.length)})  — hitos pendientes + ahorrando`)
console.log(`  Ahorrando (normal):  ${ahorrandoNormal.length.toString().padStart(3)}  (${pct(ahorrandoNormal.length, npcs.length)})  — bracket cumplido, acumulando para el siguiente`)
console.log(`  Activos:             ${activos.length.toString().padStart(3)}  (${pct(activos.length, npcs.length)})  — construyendo/entrenando/investigando`)
console.log(`\n── Estado de procesado (nextCheck) ──`)
console.log(`  Esperando su turno (nextCheck futuro): ${pendingCheckCount}`)
console.log(`  Listos para procesar (nextCheck ≤ now): ${overdueCount}`)

// ── Distribución de edad ──────────────────────────────────────────────────────

const ageBuckets = { '<24h': 0, '24-72h': 0, '72-168h': 0, '168-336h': 0, '336h+': 0 }
for (const { ageHours } of classified) {
  if      (ageHours < 24)  ageBuckets['<24h']++
  else if (ageHours < 72)  ageBuckets['24-72h']++
  else if (ageHours < 168) ageBuckets['72-168h']++
  else if (ageHours < 336) ageBuckets['168-336h']++
  else                     ageBuckets['336h+']++
}
console.log('\n── Edad (tiempo de juego × speed) ──')
for (const [k,v] of Object.entries(ageBuckets))
  console.log(`  ${k.padEnd(9)} ${String(v).padStart(4)}  ${'█'.repeat(Math.round(v/Math.max(npcs.length,1)*30))}`)

// ── Decisiones raw ────────────────────────────────────────────────────────────

const deciding = {}
for (const { n } of classified) {
  const d = (n.lastDecision ?? 'sin decisión').toLowerCase()
  const hasDefensa = d.includes('defensa:')
  const base = d.startsWith('ahorrando')      ? 'ahorrando'      :
               d.startsWith('construyendo')   ? 'construyendo'   :
               d.startsWith('entrenando')     ? 'entrenando'     :
               d.startsWith('investigando')   ? 'investigando'   :
               d.startsWith('crecimiento')    ? 'crecimiento'    :
               d.startsWith('reserva')        ? 'reserva flota'  :
               d.startsWith('investigación')  ? 'investigación'  :
               d.startsWith('defensa:')       ? 'defensa'        :
               d.slice(0, 40)
  const key = hasDefensa && base !== 'defensa' ? `${base} + defensa` : base
  deciding[key] = (deciding[key] ?? 0) + 1
}
console.log('\n── Decisiones raw ──')
for (const [k,v] of Object.entries(deciding).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`)

// ── Detalle bloqueados reales ─────────────────────────────────────────────────

if (bloqueados.length) {
  console.log(`\n── Bloqueados reales (${bloqueados.length}) ──`)
  for (const { n, ageHours, personality, targets, pending } of bloqueados.slice(0, 15)) {
    const prog = MILESTONE_ORDER.map(id => {
      const cur = n[id] ?? 0
      const tgt = targets[id] ?? 0
      return `${id}:${cur}/${tgt}`
    }).join(' ')
    console.log(`  [${n.realm},${n.region},${n.slot}] ${personality} ${ageHours.toFixed(0)}h  ${prog}`)
    console.log(`    pendiente: [${pending.join(', ')}]  decisión: ${n.lastDecision}`)
  }
}

// ── Edificios ─────────────────────────────────────────────────────────────────

console.log('\n── Edificios (avg / max) ──')
for (const b of BUILDINGS_LIST) {
  const a = avg(npcs, n=>n[b]??0)
  const m = npcs.reduce((mx,n)=>Math.max(mx,n[b]??0), 0)
  if (a>0||m>0) console.log(`  ${b.padEnd(18)} avg ${fmt(a).padStart(5)}  max ${String(m).padStart(3)}`)
}

// ── Recursos ──────────────────────────────────────────────────────────────────

// Producción efectiva = producción de edificios + basic bonus del servidor
const avgWoodEff  = Math.round(avg(npcs, n => (n.woodProduction  ?? 0)) + basicWood)
const avgStoneEff = Math.round(avg(npcs, n => (n.stoneProduction ?? 0)) + basicStone)

// Utilización de almacenamiento
function storePct(n, res, cap) {
  const c = n[cap] ?? 1
  return c > 0 ? Math.round((n[res] ?? 0) / c * 100) : 0
}
const avgWoodPct  = Math.round(avg(npcs, n => storePct(n, 'wood',  'woodCapacity')))
const avgStonePct = Math.round(avg(npcs, n => storePct(n, 'stone', 'stoneCapacity')))
const avgGrainPct = Math.round(avg(npcs, n => storePct(n, 'grain', 'grainCapacity')))
const atWoodCap   = npcs.filter(n => storePct(n, 'wood',  'woodCapacity')  >= 90).length
const atStoneCap  = npcs.filter(n => storePct(n, 'stone', 'stoneCapacity') >= 90).length

// Balance energético
const avgEnergy      = Math.round(avg(npcs, n => calcEnergyBalance(n)))
const negEnergyCount = npcs.filter(n => calcEnergyBalance(n) < 0).length

console.log('\n── Recursos avg ──')
console.log(`  Madera:  ${Math.round(avg(npcs,n=>n.wood)).toLocaleString().padStart(8)}  prod efectiva: ~${avgWoodEff}/h (edificios + ${basicWood} base)  almac: ${avgWoodPct}% avg  [${atWoodCap} al límite]`)
console.log(`  Piedra:  ${Math.round(avg(npcs,n=>n.stone)).toLocaleString().padStart(8)}  prod efectiva: ~${avgStoneEff}/h (edificios + ${basicStone} base)  almac: ${avgStonePct}% avg  [${atStoneCap} al límite]`)
console.log(`  Grano:   ${Math.round(avg(npcs,n=>n.grain)).toLocaleString().padStart(8)}  almac: ${avgGrainPct}% avg`)
console.log(`  Energía: balance avg ${avgEnergy > 0 ? '+' : ''}${avgEnergy}  |  ${negEnergyCount} NPCs con energía negativa (producción throttleada)`)

// ── Ejército ──────────────────────────────────────────────────────────────────

console.log('\n── Ejército ──')
console.log(`  avg: ${fmt(avg(npcs,army))}  max: ${npcs.reduce((m,n)=>Math.max(m,army(n)),0)}`)
for (const u of COMBAT) {
  const total = npcs.reduce((s,n)=>s+(n[u]??0),0)
  if (total>0) console.log(`  ${u.padEnd(14)} total ${String(total).padStart(6)}  NPCs ${npcs.filter(n=>(n[u]??0)>0).length}`)
}
console.log('\n── Soporte ──')
for (const u of SUPPORT) {
  const total = npcs.reduce((s,n)=>s+(n[u]??0),0)
  if (total>0) console.log(`  ${u.padEnd(14)} total ${String(total).padStart(6)}  NPCs ${npcs.filter(n=>(n[u]??0)>0).length}`)
}
console.log('\n── Defensa ──')
const defTotal = DEFENSE.reduce((s,u) => s + npcs.reduce((t,n)=>t+(n[u]??0),0), 0)
if (defTotal === 0) {
  console.log('  (ningún NPC tiene estructuras defensivas)')
} else {
  for (const u of DEFENSE) {
    const total = npcs.reduce((s,n)=>s+(n[u]??0),0)
    if (total>0) console.log(`  ${u.padEnd(14)} total ${String(total).padStart(6)}  NPCs ${npcs.filter(n=>(n[u]??0)>0).length}`)
  }
}

// ── Investigación ─────────────────────────────────────────────────────────────

console.log('\n── Investigación ──')
for (const r of RESEARCH_LIST) {
  const withR = npcs.filter(n=>(n._res[r]??0)>0).length
  if (withR>0) {
    const a = avg(npcs,n=>n._res[r]??0)
    const m = npcs.reduce((mx,n)=>Math.max(mx,n._res[r]??0),0)
    console.log(`  ${r.padEnd(22)} NPCs ${String(withR).padStart(3)}  avg ${fmt(a).padStart(5)}  max ${m}`)
  }
}

// ── Misiones ──────────────────────────────────────────────────────────────────

const mCounts = {}
for (const m of allMissions) { const k=`${m.mt}:${m.st}`; mCounts[k]=(mCounts[k]??0)+1 }
if (Object.keys(mCounts).length) {
  console.log('\n── Misiones ──')
  for (const [k,v] of Object.entries(mCounts).sort((a,b)=>b[1]-a[1]))
    console.log(`  ${String(v).padStart(4)}  ${k}`)
}

// ── Distribución ejército ─────────────────────────────────────────────────────

console.log('\n── Distribución ejército ──')
const dist = {'0':0,'1-10':0,'11-50':0,'51-200':0,'200+':0}
for (const n of npcs) {
  const a=army(n)
  if(a===0) dist['0']++; else if(a<=10) dist['1-10']++; else if(a<=50) dist['11-50']++; else if(a<=200) dist['51-200']++; else dist['200+']++
}
for (const [k,v] of Object.entries(dist))
  console.log(`  ${k.padEnd(7)} ${String(v).padStart(4)}  ${'█'.repeat(Math.round(v/Math.max(npcs.length,1)*40))}`)

// ── Anomalías ─────────────────────────────────────────────────────────────────

const anomalies = []
if (npcs.length && bloqueados.length/npcs.length >= 0.5)
  anomalies.push(`⚠ ${pct(bloqueados.length, npcs.length)} bloqueados REALES (hitos pendientes) — revisar IA`)
if (avg(npcs,n=>n.quarry??0) < 2)
  anomalies.push(`⚠ Cantera avg < 2 — piedra insuficiente`)
if (!npcs.some(n=>army(n)>0))
  anomalies.push(`⚠ Ningún NPC tiene ejército`)
if (avgWoodEff < 40)
  anomalies.push(`⚠ producción efectiva de madera avg < 40/h (edificios + base)`)
if (negEnergyCount > npcs.length * 0.3)
  anomalies.push(`⚠ ${negEnergyCount} NPCs con energía negativa — producción throttleada`)
if (atWoodCap > npcs.length * 0.3)
  anomalies.push(`⚠ ${atWoodCap} NPCs con madera ≥90% cap — almacenamiento insuficiente`)
if (atStoneCap > npcs.length * 0.3)
  anomalies.push(`⚠ ${atStoneCap} NPCs con piedra ≥90% cap — almacenamiento insuficiente`)
const avgAge = classified.length ? classified.reduce((s,c)=>s+c.ageHours,0)/classified.length : 0
if (avgAge >= 48 && !npcs.some(n=>army(n)>0))
  anomalies.push(`⚠ Sin ejército tras ${avgAge.toFixed(0)}h de edad media`)

console.log(anomalies.length ? '\n── Anomalías ──\n'+anomalies.map(a=>'  '+a).join('\n') : '\n✅ Sin anomalías')

// ── Bosses ────────────────────────────────────────────────────────────────────

if (bosses.length) {
  console.log('\n── Bosses ──')
  for (const b of bosses) console.log(`  [${b.realm},${b.region},${b.slot}] lv${b.npcLevel} ejército:${army(b)}`)
}

console.log('\n══════════════════════════════════════════════════\n')
process.exit(0)
