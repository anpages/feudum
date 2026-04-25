/**
 * npc_power_audit.mjs — Comparativa de potencia ofensiva y defensiva NPC vs jugador.
 * Uso: set -a && source .env.local && set +a && node npc_power_audit.mjs [email]
 *
 * Calcula ataque, escudo y casco totales aplicando bonos de investigación
 * (swordsmanship → +10%/lv ataque, armoury → +10%/lv escudo, fortification → +10%/lv casco).
 */
import './api/lib/env.js'
import { eq, inArray } from 'drizzle-orm'
import { db, users, kingdoms, buildings, units, research } from './api/_db.js'

const UNIT_STATS = {
  squire:       { hull: 400,    shield: 10,    attack: 50     },
  knight:       { hull: 1000,   shield: 25,    attack: 150    },
  paladin:      { hull: 2700,   shield: 50,    attack: 400    },
  warlord:      { hull: 6000,   shield: 200,   attack: 1000   },
  grandKnight:  { hull: 7000,   shield: 400,   attack: 700    },
  siegeMaster:  { hull: 7500,   shield: 500,   attack: 1000   },
  warMachine:   { hull: 11000,  shield: 500,   attack: 2000   },
  dragonKnight: { hull: 900000, shield: 50000, attack: 200000 },
  merchant:     { hull: 400,    shield: 10,    attack: 5      },
  caravan:      { hull: 1200,   shield: 25,    attack: 5      },
  colonist:     { hull: 3000,   shield: 100,   attack: 50     },
  scavenger:    { hull: 1600,   shield: 10,    attack: 1      },
  scout:        { hull: 100,    shield: 0,     attack: 0      },
  archer:       { hull: 200,    shield: 20,    attack: 80     },
  crossbowman:  { hull: 200,    shield: 25,    attack: 100    },
  ballista:     { hull: 800,    shield: 100,   attack: 250    },
  trebuchet:    { hull: 3500,   shield: 200,   attack: 1100   },
  mageTower:    { hull: 800,    shield: 500,   attack: 150    },
  dragonCannon: { hull: 10000,  shield: 300,   attack: 3000   },
  palisade:     { hull: 2000,   shield: 2000,  attack: 1      },
  castleWall:   { hull: 5500,   shield: 10000, attack: 1      },
  moat:         { hull: 1500,   shield: 500,   attack: 50     },
  catapult:     { hull: 5000,   shield: 500,   attack: 750    },
  beacon:       { hull: 50,     shield: 1,     attack: 10     },
}

const COMBAT_KEYS  = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const DEFENSE_KEYS = ['beacon','archer','crossbowman','moat','ballista','mageTower','palisade','catapult','trebuchet','castleWall','dragonCannon']
const SUPPORT_KEYS = ['merchant','caravan','scavenger','colonist','scout']

function applyBonus(base, level) { return Math.floor(base * (1 + level * 0.1)) }

function calcPower(unitMap, resMap, characterClass = null) {
  const classBonus = characterClass === 'general' ? 2 : 0
  const sword = (resMap.swordsmanship ?? 0) + classBonus
  const arm   = (resMap.armoury       ?? 0) + classBonus
  const fort  = (resMap.fortification ?? 0) + classBonus

  let totalAttack = 0, totalShield = 0, totalHull = 0
  let combatAttack = 0, combatShield = 0, combatHull = 0
  let defenseAttack = 0, defenseShield = 0, defenseHull = 0

  for (const [type, count] of Object.entries(unitMap)) {
    if (!count || count <= 0) continue
    const s = UNIT_STATS[type]
    if (!s) continue
    const attack = applyBonus(s.attack, sword) * count
    const shield = applyBonus(s.shield, arm)   * count
    const hull   = applyBonus(s.hull,   fort)  * count

    totalAttack += attack; totalShield += shield; totalHull += hull

    if (COMBAT_KEYS.includes(type))  { combatAttack  += attack; combatShield  += shield; combatHull  += hull }
    if (DEFENSE_KEYS.includes(type)) { defenseAttack += attack; defenseShield += shield; defenseHull += hull }
  }

  return { totalAttack, totalShield, totalHull, combatAttack, combatShield, combatHull, defenseAttack, defenseShield, defenseHull }
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function bar(val, max, width = 30) {
  const filled = max > 0 ? Math.round(val / max * width) : 0
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ── Cargar datos ──────────────────────────────────────────────────────────────

const targetEmail = process.argv[2] ?? 'anpages.galvan@gmail.com'

const [playerUser] = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
if (!playerUser) { console.error(`Usuario no encontrado: ${targetEmail}`); process.exit(1) }

const playerKingdoms = await db.select().from(kingdoms).where(eq(kingdoms.userId, playerUser.id))
const playerKingdomIds = playerKingdoms.map(k => k.id)

const npcUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, 'npc'))
const npcUserIds = npcUsers.map(u => u.id)
const npcKingdoms = await db.select().from(kingdoms).where(inArray(kingdoms.userId, npcUserIds))
const npcKingdomIds = npcKingdoms.map(k => k.id)

const [playerUnits, playerResearch, npcUnits, npcResearchRows] = await Promise.all([
  playerKingdomIds.length ? db.select().from(units).where(inArray(units.kingdomId, playerKingdomIds)) : [],
  db.select().from(research).where(eq(research.userId, playerUser.id)),
  npcKingdomIds.length ? db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)) : [],
  npcUserIds.length ? db.select().from(research).where(inArray(research.userId, npcUserIds)) : [],
])

// ── Construir mapas ───────────────────────────────────────────────────────────

const playerUnitMap = {}
for (const u of playerUnits) playerUnitMap[u.type] = (playerUnitMap[u.type] ?? 0) + u.quantity

const playerResMap = {}
for (const r of playerResearch) playerResMap[r.type] = r.level

// NPCs: sumar todas las unidades globalmente y construir resMap medio
const npcUnitMapTotal = {}
for (const u of npcUnits) npcUnitMapTotal[u.type] = (npcUnitMapTotal[u.type] ?? 0) + u.quantity

const npcResMapByUser = {}
for (const r of npcResearchRows) {
  if (!npcResMapByUser[r.userId]) npcResMapByUser[r.userId] = {}
  npcResMapByUser[r.userId][r.type] = r.level
}
// Promedio de investigación NPC
const npcResMapAvg = {}
for (const resMap of Object.values(npcResMapByUser)) {
  for (const [type, level] of Object.entries(resMap)) {
    npcResMapAvg[type] = (npcResMapAvg[type] ?? 0) + level
  }
}
const npcCount = npcUserIds.length || 1
for (const type of Object.keys(npcResMapAvg)) npcResMapAvg[type] = npcResMapAvg[type] / npcCount

// ── Calcular potencia ─────────────────────────────────────────────────────────

const playerPower = calcPower(playerUnitMap, playerResMap, playerUser.characterClass)
const npcPower    = calcPower(npcUnitMapTotal, npcResMapAvg)

// ── Output ────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════')
console.log(`  POTENCIA MILITAR  —  ${new Date().toISOString()}`)
console.log(`  Jugador: ${playerUser.username}  (clase: ${playerUser.characterClass ?? 'ninguna'})`)
console.log(`  NPCs: ${npcCount} kingdoms (potencia TOTAL acumulada)`)
console.log('══════════════════════════════════════════════════════════')

const maxAtk = Math.max(playerPower.totalAttack, npcPower.totalAttack, 1)
const maxDef = Math.max(playerPower.totalHull + playerPower.totalShield, npcPower.totalHull + npcPower.totalShield, 1)

console.log('\n── Potencia ofensiva (ataque total con bonos de investigación) ──')
console.log(`  Jugador  ${fmt(playerPower.totalAttack).padStart(8)}  ${bar(playerPower.totalAttack, maxAtk)}`)
console.log(`  NPCs     ${fmt(npcPower.totalAttack).padStart(8)}  ${bar(npcPower.totalAttack, maxAtk)}  (suma de ${npcCount} reinos)`)
console.log(`  Ratio    ${npcPower.totalAttack > 0 ? (playerPower.totalAttack / npcPower.totalAttack * 100).toFixed(1) : '—'}% del total NPC  |  por NPC avg: ${fmt(Math.round(npcPower.totalAttack / npcCount))}`)

console.log('\n── Potencia defensiva (casco + escudo total) ──')
const playerDefTotal = playerPower.totalHull + playerPower.totalShield
const npcDefTotal    = npcPower.totalHull    + npcPower.totalShield
console.log(`  Jugador  ${fmt(playerDefTotal).padStart(8)}  ${bar(playerDefTotal, maxDef)}`)
console.log(`  NPCs     ${fmt(npcDefTotal).padStart(8)}  ${bar(npcDefTotal, maxDef)}  (suma de ${npcCount} reinos)`)
console.log(`  Ratio    ${npcDefTotal > 0 ? (playerDefTotal / npcDefTotal * 100).toFixed(1) : '—'}% del total NPC  |  por NPC avg: ${fmt(Math.round(npcDefTotal / npcCount))}`)

console.log('\n── Desglose jugador ──')
console.log(`  Combate   atk ${fmt(playerPower.combatAttack).padStart(7)}  def ${fmt(playerPower.combatHull + playerPower.combatShield).padStart(7)}`)
console.log(`  Defensa   atk ${fmt(playerPower.defenseAttack).padStart(7)}  def ${fmt(playerPower.defenseHull + playerPower.defenseShield).padStart(7)}`)
console.log(`  Investig. swordsmanship:${playerResMap.swordsmanship ?? 0}  armoury:${playerResMap.armoury ?? 0}  fortification:${playerResMap.fortification ?? 0}`)

console.log('\n── Desglose NPC (promedio por reino) ──')
console.log(`  Combate   atk ${fmt(Math.round(npcPower.combatAttack / npcCount)).padStart(7)}  def ${fmt(Math.round((npcPower.combatHull + npcPower.combatShield) / npcCount)).padStart(7)}`)
console.log(`  Defensa   atk ${fmt(Math.round(npcPower.defenseAttack / npcCount)).padStart(7)}  def ${fmt(Math.round((npcPower.defenseHull + npcPower.defenseShield) / npcCount)).padStart(7)}`)
console.log(`  Investig. avg: swordsmanship:${(npcResMapAvg.swordsmanship ?? 0).toFixed(1)}  armoury:${(npcResMapAvg.armoury ?? 0).toFixed(1)}  fortification:${(npcResMapAvg.fortification ?? 0).toFixed(1)}`)

console.log('\n── Tropas jugador ──')
const allTypes = [...new Set([...Object.keys(playerUnitMap)])]
for (const type of [...COMBAT_KEYS, ...DEFENSE_KEYS, ...SUPPORT_KEYS]) {
  const n = playerUnitMap[type] ?? 0
  if (n > 0) console.log(`  ${type.padEnd(14)} ×${String(n).padStart(5)}`)
}

console.log('\n── Tropas NPC (top tipos, total acumulado) ──')
const npcSorted = Object.entries(npcUnitMapTotal).sort((a, b) => b[1] - a[1])
for (const [type, total] of npcSorted) {
  if (total > 0) console.log(`  ${type.padEnd(14)} total ${String(total).padStart(6)}  avg/NPC ${(total / npcCount).toFixed(1)}`)
}

console.log('\n══════════════════════════════════════════════════════════\n')
process.exit(0)
