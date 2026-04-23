import { eq } from 'drizzle-orm'
import { db, settings } from '../_db.js'

const NUMERIC_KEYS = new Set([
  'economy_speed','research_speed','fleet_speed_war','fleet_speed_peaceful','basic_wood','basic_stone',
  'universe_realms','universe_regions','universe_slots',
])

const DEFAULTS = {
  economy_speed:        1,
  research_speed:       1,
  fleet_speed_war:      1,
  fleet_speed_peaceful: 1,
  basic_wood:           30,
  basic_stone:          15,
  universe_realms:      3,
  universe_regions:     10,
  universe_slots:       15,
}

export async function getSettings() {
  const rows = await db.select().from(settings)
  const map = Object.fromEntries(rows.map(r => [
    r.key,
    NUMERIC_KEYS.has(r.key) ? parseFloat(r.value) : r.value,
  ]))
  return { ...DEFAULTS, ...map }
}

export async function setSetting(key, value) {
  await db.insert(settings)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: new Date() } })
}

export async function getStringSetting(key) {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1)
  return row?.value ?? null
}
