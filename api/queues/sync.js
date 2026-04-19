import { getSessionUserId } from '../lib/handler.js'
import { processUserQueues } from '../lib/process-queues.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const processed = await processUserQueues(userId)
  return res.json({ processed })
}
