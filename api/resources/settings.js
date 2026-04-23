import { getSessionUserId } from '../lib/handler.js'

const DEFAULTS = {
  sawmillPercent: 10, quarryPercent: 10, grainFarmPercent: 10,
  windmillPercent: 10, cathedralPercent: 10,
}

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  if (req.method === 'GET') return res.json(DEFAULTS)

  if (req.method === 'PATCH') return res.json({ ok: true, ...DEFAULTS })

  res.status(405).end()
}
