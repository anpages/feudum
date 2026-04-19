import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const url = process.env.STORAGE_POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.STORAGE_POSTGRES_URL
if (!url) { console.error('Missing STORAGE_POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED'); process.exit(1) }

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <path>'); process.exit(1) }

const sql = readFileSync(file, 'utf8')
const client = postgres(url, { prepare: false, max: 1 })

try {
  console.log(`Applying ${file} ...`)
  await client.unsafe(sql)
  console.log('OK')
} catch (e) {
  console.error('FAIL:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
