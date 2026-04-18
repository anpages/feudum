import { eq, and } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const PERCENT_KEYS = ['sawmillPercent', 'quarryPercent', 'grainFarmPercent', 'windmillPercent', 'cathedralPercent']
const DB_KEYS = {
  sawmillPercent:    'sawmill_percent',
  quarryPercent:     'quarry_percent',
  grainFarmPercent:  'grain_farm_percent',
  windmillPercent:   'windmill_percent',
  cathedralPercent:  'cathedral_percent',
}

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const kingdomId = req.query.id ? parseInt(req.query.id, 10) : null
  const whereK = kingdomId
    ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, kingdomId))
    : eq(kingdoms.userId, userId)

  if (req.method === 'GET') {
    const [k] = await db
      .select({
        sawmillPercent:   kingdoms.sawmillPercent,
        quarryPercent:    kingdoms.quarryPercent,
        grainFarmPercent: kingdoms.grainFarmPercent,
        windmillPercent:  kingdoms.windmillPercent,
        cathedralPercent: kingdoms.cathedralPercent,
      })
      .from(kingdoms).where(whereK).limit(1)
    if (!k) return res.status(404).json({ error: 'Reino no encontrado' })
    return res.json(k)
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {}
    const patch = { updatedAt: new Date() }

    for (const key of PERCENT_KEYS) {
      if (key in body) {
        const val = parseInt(body[key], 10)
        if (isNaN(val) || val < 0 || val > 10) {
          return res.status(400).json({ error: `${key} debe estar entre 0 y 10` })
        }
        patch[key] = val
      }
    }

    if (Object.keys(patch).length === 1) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' })
    }

    const [updated] = await db.update(kingdoms)
      .set(patch)
      .where(whereK)
      .returning({
        sawmillPercent:   kingdoms.sawmillPercent,
        quarryPercent:    kingdoms.quarryPercent,
        grainFarmPercent: kingdoms.grainFarmPercent,
        windmillPercent:  kingdoms.windmillPercent,
        cathedralPercent: kingdoms.cathedralPercent,
      })
    if (!updated) return res.status(404).json({ error: 'Reino no encontrado' })
    return res.json({ ok: true, ...updated })
  }

  return res.status(405).end()
}
