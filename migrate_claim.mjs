import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
await sql`ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS claimed_at timestamp`
console.log('done')
