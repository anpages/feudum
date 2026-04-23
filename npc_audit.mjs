/**
 * npc_audit.mjs — Auditoría de salud y crecimiento NPC.
 * Uso: set -a && source .env.local && set +a && node npc_audit.mjs
 */
import './api/lib/env.js'
import { eq, inArray } from 'drizzle-orm'
import { db, users, kingdoms, npcState, buildings, units, research, armyMissions } from './api/_db.js'

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

const BUILDINGS = ['sawmill','quarry','grainFarm','windmill','barracks','workshop',
  'engineersGuild','academy','granary','stonehouse','silo','cathedral','alchemistTower','ambassadorHall','armoury']
const COMBAT  = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const SUPPORT = ['merchant','caravan','scavenger','colonist','scout']
const RESEARCH = ['alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'fortification','swordsmanship','armoury','horsemanship','cartography',
  'tradeRoutes','logistics','spycraft','exploration','diplomaticNetwork']

const army = n => COMBAT.reduce((s,k) => s+(n[k]??0), 0)

console.log('\n══════════════════════════════════════════════════')
console.log(`  AUDITORÍA NPC  —  ${new Date().toISOString()}`)
console.log('══════════════════════════════════════════════════')
console.log(`\nTotal NPCs: ${npcs.length}  |  Bosses: ${bosses.length}`)
console.log(`Con ejército:  ${npcs.filter(n=>army(n)>0).length} (${pct(npcs.filter(n=>army(n)>0).length, npcs.length)})`)
console.log(`Con merchant:  ${npcs.filter(n=>(n.merchant??0)>0).length}`)
console.log(`Con scavenger: ${npcs.filter(n=>(n.scavenger??0)>0).length}`)
console.log(`Con colonist:  ${npcs.filter(n=>(n.colonist??0)>0).length}`)

const deciding = {}
for (const n of npcs) {
  const d = (n.lastDecision ?? 'sin decisión').toLowerCase()
  const key = d.startsWith('ahorrando') ? 'Ahorrando (bloqueado)' :
              d.startsWith('construyendo') ? 'Construyendo' :
              d.startsWith('entrenando') ? 'Entrenando' :
              d.startsWith('investigando') ? 'Investigando' :
              d.startsWith('crecimiento') ? 'Crecimiento' :
              d.startsWith('reserva') ? 'Reserva flota' : d.slice(0,40)
  deciding[key] = (deciding[key]??0)+1
}
console.log('\n── Decisiones ──')
for (const [k,v] of Object.entries(deciding).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`)

console.log('\n── Edificios (avg / max) ──')
for (const b of BUILDINGS) {
  const a = avg(npcs, n=>n[b]??0)
  const m = npcs.reduce((mx,n)=>Math.max(mx,n[b]??0), 0)
  if (a>0||m>0) console.log(`  ${b.padEnd(18)} avg ${fmt(a).padStart(5)}  max ${String(m).padStart(3)}`)
}

console.log('\n── Recursos avg ──')
console.log(`  Madera:  ${Math.round(avg(npcs,n=>n.wood)).toLocaleString()}  (prod: ${Math.round(avg(npcs,n=>n.woodProduction))}/h)`)
console.log(`  Piedra:  ${Math.round(avg(npcs,n=>n.stone)).toLocaleString()}  (prod: ${Math.round(avg(npcs,n=>n.stoneProduction))}/h)`)
console.log(`  Grano:   ${Math.round(avg(npcs,n=>n.grain)).toLocaleString()}`)

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

console.log('\n── Investigación ──')
for (const r of RESEARCH) {
  const withR = npcs.filter(n=>(n._res[r]??0)>0).length
  if (withR>0) {
    const a = avg(npcs,n=>n._res[r]??0)
    const m = npcs.reduce((mx,n)=>Math.max(mx,n._res[r]??0),0)
    console.log(`  ${r.padEnd(22)} NPCs ${String(withR).padStart(3)}  avg ${fmt(a).padStart(5)}  max ${m}`)
  }
}

const mCounts = {}
for (const m of allMissions) { const k=`${m.mt}:${m.st}`; mCounts[k]=(mCounts[k]??0)+1 }
if (Object.keys(mCounts).length) {
  console.log('\n── Misiones ──')
  for (const [k,v] of Object.entries(mCounts).sort((a,b)=>b[1]-a[1]))
    console.log(`  ${String(v).padStart(4)}  ${k}`)
}

console.log('\n── Distribución ejército ──')
const dist = {'0':0,'1-10':0,'11-50':0,'51-200':0,'200+':0}
for (const n of npcs) {
  const a=army(n)
  if(a===0) dist['0']++; else if(a<=10) dist['1-10']++; else if(a<=50) dist['11-50']++; else if(a<=200) dist['51-200']++; else dist['200+']++
}
for (const [k,v] of Object.entries(dist))
  console.log(`  ${k.padEnd(7)} ${String(v).padStart(4)}  ${'█'.repeat(Math.round(v/npcs.length*40))}`)

const blocked = npcs.filter(n=>(n.lastDecision??'').toLowerCase().startsWith('ahorrando'))
console.log(`\n── Bloqueados: ${blocked.length} / ${npcs.length} (${pct(blocked.length, npcs.length)}) ──`)
for (const n of blocked.slice(0,10))
  console.log(`  [${n.realm},${n.region},${n.slot}] s/q/g/w:${n.sawmill??0}/${n.quarry??0}/${n.grainFarm??0}/${n.windmill??0}  ${n.lastDecision}`)

const anomalies = []
if (npcs.length && blocked.length/npcs.length >= 0.85) anomalies.push(`⚠ ${pct(blocked.length,npcs.length)} bloqueados — crítico`)
if (avg(npcs,n=>n.quarry??0) < 2)                      anomalies.push(`⚠ Cantera avg < 2 — piedra insuficiente`)
if (!npcs.some(n=>army(n)>0))                           anomalies.push(`⚠ Ningún NPC tiene ejército`)
if (avg(npcs,n=>n.woodProduction??0) < 10)              anomalies.push(`⚠ woodProduction avg < 10/h`)

console.log(anomalies.length ? '\n── Anomalías ──\n'+anomalies.map(a=>'  '+a).join('\n') : '\n✅ Sin anomalías')

if (bosses.length) {
  console.log('\n── Bosses ──')
  for (const b of bosses) console.log(`  [${b.realm},${b.region},${b.slot}] lv${b.npcLevel} ejército:${army(b)}`)
}

console.log('\n══════════════════════════════════════════════════\n')
process.exit(0)
