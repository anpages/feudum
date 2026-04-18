import { eq } from 'drizzle-orm'
import { db, settings } from '../_db.js'

const DEFAULTS = {
  economy_speed:        1,
  research_speed:       1,
  fleet_speed_war:      1,
  fleet_speed_peaceful: 1,
  basic_wood:           30,
  basic_stone:          15,
}

export async function getSettings() {
  const rows = await db.select().from(settings)
  const map = Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]))
  return { ...DEFAULTS, ...map }
}

export async function setSetting(key, value) {
  await db.insert(settings)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: new Date() } })
}
