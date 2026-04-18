export default async function handler(_req, res) {
  try {
    const { db, users } = await import('../../db/index.js')
    const { eq } = await import('drizzle-orm')
    const rows = await db.select({ id: users.id }).from(users).limit(1)
    res.json({ ok: true, rows: rows.length })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
