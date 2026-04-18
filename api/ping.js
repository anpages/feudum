import { db, users } from './_db.js'

export default async function handler(_req, res) {
  try {
    const rows = await db.select({ id: users.id }).from(users).limit(1)
    res.json({ ok: true, rows: rows.length })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
