import { supabase } from '@/lib/supabase'
import { http } from '@/shared/services/http'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import { effectiveProduction } from '@/lib/game/production'
import type { KingdomSummary } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

async function fetchSettings() {
  const { data } = await supabase.from('settings').select('key, value')
  const NUM = new Set(['economy_speed','research_speed','fleet_speed_war','fleet_speed_peaceful','basic_wood','basic_stone'])
  const map: Record<string, string | number> = {
    economy_speed: 1, research_speed: 1, basic_wood: 30, basic_stone: 15,
  }
  for (const r of data ?? []) {
    const k = r.key as string
    const v = r.value as string
    map[k] = NUM.has(k) ? parseFloat(v) : v
  }
  return map
}

async function fetchUserAndResearch(userId: string) {
  // my_user() is a SECURITY DEFINER RPC: caller can read their own ether/email
  // (those columns are revoked from authenticated, only the RPC exposes them).
  const [{ data: userRows }, { data: researchRow }] = await Promise.all([
    supabase.rpc('my_user'),
    supabase.from('research').select('*').eq('user_id', userId).maybeSingle(),
  ])
  const userRow = Array.isArray(userRows) ? userRows[0] : null
  return {
    characterClass: (userRow?.character_class as string | null) ?? null,
    research: researchRow ? snakeToCamel(researchRow) : null,
  }
}

export const kingdomService = {
  async getMe(id?: string | null): Promise<Kingdom> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Process any completed queues (buildings/units/research) before reading state.
    // This ensures unit counts, building levels, etc. are always up-to-date even
    // when the user navigates away from a page before its countdown fires.
    try { await http.post<{ processed: number }>('/queues/sync', {}) } catch { /* non-fatal */ }

    // my_kingdom(kid) RPC: returns the caller's kingdom with all private columns
    // (resources, units, buildings). Pass kid=null for the first one.
    const [{ data: kingdomRows, error }, settings, ctx] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: id ?? null }),
      fetchSettings(),
      fetchUserAndResearch(user.id),
    ])
    if (error) throw error
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow) throw new Error('Reino no encontrado')

    const kingdom = snakeToCamel<Kingdom>(kingdomRow)
    const eff = effectiveProduction(kingdom, ctx.research, settings, ctx.characterClass)

    return {
      ...kingdom,
      woodProduction:  eff.wood,
      stoneProduction: eff.stone,
      grainProduction: eff.grain,
      energyProduced:  eff.energyProd,
      energyConsumed:  eff.energyCons,
      // The `Kingdom` type doesn't declare these derived energy fields; consumers
      // access them with `(kingdom as Record<string, unknown>).energyProduced`.
    } as unknown as Kingdom
  },

  async getAll(): Promise<{ kingdoms: KingdomSummary[] }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // my_kingdoms() returns the caller's full rows; we only project public-facing
    // summary fields here. Direct SELECT also works (those cols are public-grant)
    // but using the RPC keeps reads consistent through one safe entry point.
    const { data, error } = await supabase.rpc('my_kingdoms')
    if (error) throw error
    return { kingdoms: snakeToCamelArray<KingdomSummary>(data) }
  },
}
