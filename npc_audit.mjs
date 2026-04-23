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
import { npcPersonality, getTargetLevels, MILESTONE_ORDER } from './api/lib/npc-engine.js'
import { ECONOMY_SPEED } from './api/lib/config.js'

const now = Math.floor(Date.now() / 1000)

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
  isBoss: ns?.isBoss ?? false,
  npcLevel: ns?.npcLevel ?? 1,
  lastDecision: ns?.lastDecision ?? null,
  currentResearch: ns?.currentResearch ?? null,
  currentTask: ns?.currentTask ?? null,
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
const RESEARCH_LIST = ['alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'fortification','swordsmanship','armoury','horsemanship','cartography',
  'tradeRoutes','logistics','spycraft','exploration','diplomaticNetwork']

const army = n => COMBAT.reduce((s,k) => s+(n[k]??0), 0)

// ── Clasificación por hitos ───────────────────────────────────────────────────

function classifyNpc(n) {
  const createdAtSec = n.createdAt
    ? Math.floor(new Date(n.createdAt).getTime() / 1000)
    : now - 3600
  const ageHours = (now - createdAtSec) / 3600 * ECONOMY_SPEED
  const personality = npcPersonality(n)
  const targets = getTargetLevels(personality, ageHours)
  const pending = MILESTONE_ORDER.filter(id => (n[id] ?? 0) < (targets[id] ?? 0))
  const dec = (n.lastDecision ?? '').toLowerCase()
  const saving = dec.startsWith('ahorrando')

  if (saving && pending.length > 0) return { status: 'bloqueado', ageHours, personality, targets, pending }
  if (saving && pending.length === 0) return { status: 'ahorrando_normal', ageHours, personality, targets, pending }
  return { status: 'activo', ageHours, personality, targets, pending }
}

const classified = npcs.map(n => ({ n, ...classifyNpc(n) }))
const bloqueados      = classified.filter(c => c.status === 'bloqueado')
const ahorrandoNormal = classified.filter(c => c.status === 'ahorrando_normal')
const activos         = classified.filter(c => c.status === 'activo')

// ── Cabecera ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════')
console.log(`  AUDITORÍA NPC  —  ${new Date().toISOString()}`)
console.log(`  economy_speed: ${ECONOMY_SPEED}`)
console.log('══════════════════════════════════════════════════')
console.log(`\nTotal NPCs: ${npcs.length}  |  Bosses: ${bosses.length}`)
console.log(`Con ejército:  ${npcs.filter(n=>army(n)>0).length} (${pct(npcs.filter(n=>army(n)>0).length, npcs.length)})`)
console.log(`Con merchant:  ${npcs.filter(n=>(n.merchant??0)>0).length}`)
console.log(`Con scavenger: ${npcs.filter(n=>(n.scavenger??0)>0).length}`)
console.log(`Con colonist:  ${npcs.filter(n=>(n.colonist??0)>0).length}`)

// ── Clasificación hitos ───────────────────────────────────────────────────────

console.log('\n── Clasificación por hitos ──')
console.log(`  Bloqueados reales:   ${bloqueados.length.toString().padStart(3)}  (${pct(bloqueados.length, npcs.length)})  — hitos pendientes + ahorrando`)
console.log(`  Ahorrando (normal):  ${ahorrandoNormal.length.toString().padStart(3)}  (${pct(ahorrandoNormal.length, npcs.length)})  — bracket cumplido, acumulando para el siguiente`)
console.log(`  Activos:             ${activos.length.toString().padStart(3)}  (${pct(activos.length, npcs.length)})  — construyendo/entrenando/investigando`)

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
  const key = d.startsWith('ahorrando')      ? 'ahorrando'      :
              d.startsWith('construyendo')    ? 'construyendo'   :
              d.startsWith('entrenando')      ? 'entrenando'     :
              d.startsWith('investigando')    ? 'investigando'   :
              d.startsWith('crecimiento')     ? 'crecimiento'    :
              d.startsWith('reserva')         ? 'reserva flota'  :
              d.startsWith('investigación')   ? 'investigación'  :
              d.slice(0, 40)
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

console.log('\n── Recursos avg ──')
console.log(`  Madera:  ${Math.round(avg(npcs,n=>n.wood)).toLocaleString()}  (prod: ${Math.round(avg(npcs,n=>n.woodProduction))}/h)`)
console.log(`  Piedra:  ${Math.round(avg(npcs,n=>n.stone)).toLocaleString()}  (prod: ${Math.round(avg(npcs,n=>n.stoneProduction))}/h)`)
console.log(`  Grano:   ${Math.round(avg(npcs,n=>n.grain)).toLocaleString()}`)

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
if (avg(npcs,n=>n.woodProduction??0) < 10)
  anomalies.push(`⚠ woodProduction avg < 10/h`)
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
