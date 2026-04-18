import { eq } from 'drizzle-orm'
import { db, users, etherTransactions } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const VALID_CLASSES  = ['collector', 'general', 'discoverer']
const CHANGE_COST    = 250  // Éter to change an existing class

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { characterClass } = req.body ?? {}
  if (!VALID_CLASSES.includes(characterClass)) {
    return res.status(400).json({ error: 'Clase inválida', valid: VALID_CLASSES })
  }

  const [user] = await db.select({ ether: users.ether, characterClass: users.characterClass })
    .from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  if (user.characterClass === characterClass) {
    return res.status(400).json({ error: 'Ya tienes esa clase' })
  }

  const isChange = !!user.characterClass
  if (isChange && user.ether < CHANGE_COST) {
    return res.status(400).json({ error: `Necesitas ${CHANGE_COST} Éter para cambiar de clase`, have: user.ether, need: CHANGE_COST })
  }

  const newEther = isChange ? user.ether - CHANGE_COST : user.ether

  await db.update(users)
    .set({ characterClass, ether: newEther, updatedAt: new Date() })
    .where(eq(users.id, userId))

  if (isChange) {
    await db.insert(etherTransactions).values({
      userId,
      type: 'class_change',
      amount: -CHANGE_COST,
      reason: `Cambio de clase a ${characterClass}`,
    })
  }

  return res.json({ ok: true, characterClass, ether: newEther, cost: isChange ? CHANGE_COST : 0 })
}
