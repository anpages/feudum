import { getAdminUserId } from '../lib/admin.js'
import { getSettings, setSetting } from '../lib/settings.js'

const ALLOWED_KEYS = ['economy_speed','research_speed','fleet_speed_war','fleet_speed_peaceful','basic_wood','basic_stone']

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'GET') {
    return res.json(await getSettings())
  }

  if (req.method === 'PATCH') {
    const updates = req.body
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.includes(key)) continue
      const num = parseFloat(value)
      if (isNaN(num) || num <= 0) continue
      await setSetting(key, num)
    }
    return res.json(await getSettings())
  }

  res.status(405).end()
}
