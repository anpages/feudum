import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  CIVILIZATIONS, LF_BUILDINGS_BY_CIV, LF_RESEARCH_BY_CIV,
  lfBuildingCost, lfBuildingTime, lfResearchCost, lfResearchTime,
  lfBuildingRequirementsMet, unlockedTiers, civLevelBonus,
  TIER_POPULATION, TIER_ARTIFACTS,
} from '../lib/lifeforms.js'
import { getSettings } from '../lib/settings.js'
import { processUserQueues } from '../lib/process-queues.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  await processUserQueues(userId)

  const [[kingdom], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  const civ       = kingdom.civilization ?? null
  const lfLevels  = (kingdom.lfBuildings  ?? {})
  const lfResLvls = (kingdom.lfResearch   ?? {})
  const popTotal  = kingdom.populationT1 + kingdom.populationT2 + kingdom.populationT3
  const torreMuecinLv = lfLevels['torreMuecin'] ?? 0
  const tiers     = unlockedTiers(popTotal, kingdom.artifacts, torreMuecinLv)
  const speed     = parseFloat(cfg.economy_speed ?? '1')

  const workshopLevel  = kingdom.workshop       ?? 0
  const naniteLevel    = kingdom.engineersGuild  ?? 0

  // Build per-civilization building lists (only current civ enriched)
  const buildingsByCiv = {}
  for (const c of CIVILIZATIONS) {
    buildingsByCiv[c.id] = LF_BUILDINGS_BY_CIV[c.id].map(def => {
      const level     = lfLevels[def.id] ?? 0
      const nextLevel = level + 1
      const cost      = lfBuildingCost(def, nextLevel)
      const timeSecs  = lfBuildingTime(def, nextLevel, workshopLevel, naniteLevel, speed)
      const reqMet    = lfBuildingRequirementsMet(def, lfLevels, popTotal)
      return { id: def.id, name: def.name, description: def.description, role: def.role, level, nextLevel, cost, timeSecs, requiresMet: reqMet, requires: def.requires ?? [], bonuses: def.bonuses }
    })
  }

  // Research lists
  const researchByCiv = {}
  for (const c of CIVILIZATIONS) {
    researchByCiv[c.id] = LF_RESEARCH_BY_CIV[c.id].map(def => {
      const level     = lfResLvls[def.id] ?? 0
      const nextLevel = level + 1
      const cost      = lfResearchCost(def, nextLevel)
      const timeSecs  = lfResearchTime(def, nextLevel, speed)
      return { id: def.id, name: def.name, tier: def.tier, level, nextLevel, cost, timeSecs, effects: def.effects }
    })
  }

  return res.json({
    civilization: civ,
    civLevels: {
      romans:     kingdom.civLevelRomans,
      vikings:    kingdom.civLevelVikings,
      byzantines: kingdom.civLevelByzantines,
      saracens:   kingdom.civLevelSaracens,
    },
    population: { t1: kingdom.populationT1, t2: kingdom.populationT2, t3: kingdom.populationT3 },
    foodStored: kingdom.foodStored,
    artifacts:  kingdom.artifacts,
    tiers,
    civilizations: CIVILIZATIONS,
    buildings:  buildingsByCiv,
    research:   researchByCiv,
  })
}
