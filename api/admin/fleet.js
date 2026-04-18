import { eq, gt } from 'drizzle-orm'
import { db, armyMissions, users } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'GET') {
    const now = Math.floor(Date.now() / 1000)
    const missions = await db
      .select({
        id:           armyMissions.id,
        userId:       armyMissions.userId,
        missionType:  armyMissions.missionType,
        state:        armyMissions.state,
        arrivalTime:  armyMissions.arrivalTime,
        returnTime:   armyMissions.returnTime,
        targetRealm:  armyMissions.targetRealm,
        targetRegion: armyMissions.targetRegion,
        targetSlot:   armyMissions.targetSlot,
        username:     users.username,
      })
      .from(armyMissions)
      .innerJoin(users, eq(armyMissions.userId, users.id))
      .where(eq(armyMissions.state, 'active'))
      .orderBy(armyMissions.arrivalTime)
    return res.json({ missions, now })
  }

  if (req.method === 'POST') {
    const { missionId, all } = req.body
    const past = Math.floor(Date.now() / 1000) - 1
    if (all) {
      await db.update(armyMissions)
        .set({ arrivalTime: past })
        .where(eq(armyMissions.state, 'active'))
    } else if (missionId) {
      await db.update(armyMissions)
        .set({ arrivalTime: past })
        .where(eq(armyMissions.id, missionId))
    }
    return res.json({ ok: true })
  }

  res.status(405).end()
}
