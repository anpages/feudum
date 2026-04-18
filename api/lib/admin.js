import { eq } from 'drizzle-orm'
import { db, users } from '../_db.js'
import { getSessionUserId } from './handler.js'

export async function getAdminUserId(req) {
  const userId = await getSessionUserId(req)
  if (!userId) return null
  const [user] = await db.select({ id: users.id, isAdmin: users.isAdmin })
    .from(users).where(eq(users.id, userId)).limit(1)
  return user?.isAdmin ? userId : null
}
