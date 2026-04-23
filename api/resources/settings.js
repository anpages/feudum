import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'

const RESOURCE_DEFAULTS = {
  sawmillPercent: 10, quarryPercent: 10, grainFarmPercent: 10,
  windmillPercent: 10, cathedralPercent: 10,
}

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const cfg = await getSettings()
  const payload = { ...RESOURCE_DEFAULTS, economySpeed: cfg.economy_speed }

  if (req.method === 'GET') return res.json(payload)

  if (req.method === 'PATCH') return res.json({ ok: true, ...payload })

  res.status(405).end()
}
