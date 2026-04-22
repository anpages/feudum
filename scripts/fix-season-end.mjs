// One-off script: recalculate season_end from season_start using 360/speed formula.
// Usage: set -a && source .env.local && set +a && node scripts/fix-season-end.mjs
import postgres from 'postgres'

const sql = postgres(process.env.STORAGE_POSTGRES_URL, { prepare: false })

const rows = await sql`SELECT key, value FROM settings WHERE key IN ('season_start','economy_speed','season_end')`
const cfg  = Object.fromEntries(rows.map(r => [r.key, r.value]))

const start = parseInt(cfg.season_start ?? '0', 10)
const speed = parseFloat(cfg.economy_speed ?? '1')
const oldEnd = parseInt(cfg.season_end ?? '0', 10)

if (!start) { console.error('No season_start found'); process.exit(1) }

const newEnd = start + Math.round((360 / speed) * 86400)

console.log(`season_start : ${new Date(start * 1000).toISOString()}`)
console.log(`economy_speed: ${speed}`)
console.log(`old end      : ${new Date(oldEnd * 1000).toISOString()}`)
console.log(`new end      : ${new Date(newEnd * 1000).toISOString()}`)

await sql`UPDATE settings SET value = ${String(newEnd)} WHERE key = 'season_end'`
console.log('✓ season_end updated')
await sql.end()
