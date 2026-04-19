import postgres from 'postgres'

const url = process.env.STORAGE_POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED
const client = postgres(url, { prepare: false, max: 1 })

try {
  const tables = await client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name`
  console.log('TABLES:', tables.map(t => t.table_name).join(', '))

  const usersCol = await client`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='id'`
  console.log('users.id:', usersCol[0])

  const npc = await client`SELECT id, username, is_npc FROM users WHERE is_npc = true`
  console.log('NPC user:', npc[0])

  const policies = await client`
    SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename`
  console.log('POLICIES:', policies.length)
  for (const p of policies) console.log(`  - ${p.tablename}.${p.policyname}`)

  const trig = await client`
    SELECT tgname FROM pg_trigger
    WHERE tgname='on_auth_user_created'`
  console.log('Trigger on_auth_user_created exists:', trig.length > 0)

  const pub = await client`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname='supabase_realtime' ORDER BY tablename`
  console.log('Realtime tables:', pub.map(p => p.tablename).join(', '))
} finally {
  await client.end()
}
