import { supabase } from '@/lib/supabase'
import { http } from '@/shared/services/http'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import { effectiveProduction } from '@/lib/game/production'
import type { KingdomSummary } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

// POI permanente bonus shape (mirror de api/lib/poi-bonus.js)
type PoiBonus = { wood: number; stone: number; grain: number; researchSpeed: number; combatDef: number }

function buildPoiBonus(poiType: string): PoiBonus {
  const map: Record<string, Partial<PoiBonus>> = {
    yacimiento_madera: { wood:  0.15 },
    yacimiento_piedra: { stone: 0.15 },
    yacimiento_grano:  { grain: 0.15 },
    ruinas_antiguas:   { researchSpeed: 0.10 },
    templo_perdido:    { combatDef: 0.05 },
  }
  return { wood: 0, stone: 0, grain: 0, researchSpeed: 0, combatDef: 0, ...(map[poiType] ?? {}) }
}

async function fetchSettings() {
  const cfg = await http.get<{
    economySpeed: number; researchSpeed: number
    fleetSpeedWar: number; fleetSpeedPeaceful: number
    basicWood: number; basicStone: number
  }>('/resources/settings').catch(() => ({
    economySpeed: 1, researchSpeed: 1, fleetSpeedWar: 1, fleetSpeedPeaceful: 1,
    basicWood: 30, basicStone: 15,
  }))
  return {
    economy_speed:        cfg.economySpeed      ?? 1,
    research_speed:       cfg.researchSpeed     ?? 1,
    fleet_speed_war:      cfg.fleetSpeedWar     ?? 1,
    fleet_speed_peaceful: cfg.fleetSpeedPeaceful ?? 1,
    basic_wood:           cfg.basicWood         ?? 30,
    basic_stone:          cfg.basicStone        ?? 15,
  }
}

async function fetchUserAndResearch(userId: string) {
  const [{ data: userRows }, { data: researchRows }] = await Promise.all([
    supabase.rpc('my_user'),
    supabase.from('research').select('type, level').eq('user_id', userId),
  ])
  const userRow = Array.isArray(userRows) ? userRows[0] : null
  const research: Record<string, number> = {}
  for (const r of researchRows ?? []) research[(r as { type: string; level: number }).type] = (r as { type: string; level: number }).level
  return {
    characterClass: (userRow?.character_class as string | null) ?? null,
    research,
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

    // Building levels and unit quantities live in normalized tables, not kingdoms.
    const [{ data: buildingRows }, { data: unitRows }] = await Promise.all([
      supabase.from('buildings').select('type, level').eq('kingdom_id', kingdomRow.id),
      supabase.from('units').select('type, quantity').eq('kingdom_id', kingdomRow.id),
    ])
    const buildingMap: Record<string, number> = {}
    for (const r of buildingRows ?? []) buildingMap[(r as { type: string; level: number }).type] = (r as { type: string; level: number }).level
    const unitMap: Record<string, number> = {}
    for (const r of unitRows ?? []) unitMap[(r as { type: string; quantity: number }).type] = (r as { type: string; quantity: number }).quantity

    // Per-kingdom production percentages (0–10, default 10 = 100%).
    // Stored as productionSettings JSONB on the kingdom row.
    const pct = ((kingdom as Record<string, unknown>).productionSettings ?? {}) as Record<string, number>
    const percents = {
      sawmillPercent:   pct.sawmillPercent   ?? 10,
      quarryPercent:    pct.quarryPercent    ?? 10,
      grainFarmPercent: pct.grainFarmPercent ?? 10,
      windmillPercent:  pct.windmillPercent  ?? 10,
      cathedralPercent: pct.cathedralPercent ?? 10,
    }

    // POI claimed por esta kingdom — aplica bonus permanente en producción
    const { data: poiRow } = await supabase.from('points_of_interest')
      .select('type, magnitude').eq('claimed_by_kingdom_id', kingdomRow.id).limit(1).maybeSingle()
    const poiBonus = poiRow ? buildPoiBonus(poiRow.type) : null

    const enriched = { ...kingdom, ...buildingMap, ...unitMap, ...percents }
    // Cast: effectiveProduction es JS sin .d.ts; TS infiere 4 args max pero el 5º
    // (poiBonus) sí existe en la implementación.
    const eff = (effectiveProduction as (...args: unknown[]) => { wood: number; stone: number; grain: number; energyProd: number; energyCons: number })(
      enriched, ctx.research, settings, ctx.characterClass, poiBonus,
    )

    return {
      ...enriched,
      characterClass:      ctx.characterClass,
      claimedPoi:          poiRow?.type ?? null,
      woodProduction:      eff.wood,
      stoneProduction:     eff.stone,
      grainProduction:     eff.grain,
      rawWoodProduction:   enriched.woodProduction,
      rawStoneProduction:  enriched.stoneProduction,
      rawGrainProduction:  enriched.grainProduction,
      energyProduced:      eff.energyProd,
      energyConsumed:      eff.energyCons,
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
