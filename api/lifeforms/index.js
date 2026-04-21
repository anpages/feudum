import { eq } from 'drizzle-orm'
import { db, kingdoms, lfBuildingQueue, lfResearchQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  CIVILIZATIONS, LF_BUILDINGS_BY_CIV, LF_RESEARCH_BY_CIV,
  lfBuildingCost, lfBuildingTime, lfResearchCost, lfResearchTime,
  lfBuildingRequirementsMet, unlockedTiers, civLevelBonus,
  applyPopulationTick,
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

  // Population/food tick — runs on every lifeforms page visit
  if (kingdom.civilization) {
    const now2 = Math.floor(Date.now() / 1000)
    const lastPop = kingdom.foodLastUpdate ?? 0
    const elapsed  = lastPop > 0 ? now2 - lastPop : 0
    const popResult = elapsed > 0
      ? applyPopulationTick(kingdom, kingdom.lfBuildings ?? {}, elapsed)
      : null
    if (popResult) {
      await db.update(kingdoms).set({
        populationT1: popResult.populationT1,
        populationT2: popResult.populationT2,
        populationT3: popResult.populationT3,
        foodStored:   popResult.foodStored,
        foodLastUpdate: now2,
        updatedAt: new Date(),
      }).where(eq(kingdoms.id, kingdom.id))
      kingdom.populationT1   = popResult.populationT1
      kingdom.populationT2   = popResult.populationT2
      kingdom.populationT3   = popResult.populationT3
      kingdom.foodStored     = popResult.foodStored
      kingdom.foodLastUpdate = now2
    } else if (lastPop === 0) {
      await db.update(kingdoms).set({ foodLastUpdate: now2, updatedAt: new Date() }).where(eq(kingdoms.id, kingdom.id))
      kingdom.foodLastUpdate = now2
    }
  }

  const civ       = kingdom.civilization ?? null
  const lfLevels  = (kingdom.lfBuildings  ?? {})
  const lfResLvls = (kingdom.lfResearch   ?? {})
  const popTotal  = kingdom.populationT1 + kingdom.populationT2 + kingdom.populationT3
  const torreMuecinLv = lfLevels['torreMuecin'] ?? 0
  const tiers     = unlockedTiers(popTotal, kingdom.artifacts, torreMuecinLv)
  const speed     = parseFloat(cfg.economy_speed ?? '1')

  const workshopLevel  = kingdom.workshop       ?? 0
  const naniteLevel    = kingdom.engineersGuild  ?? 0

  // Load active queues for this kingdom
  const [activeBuildQ, activeResQ] = await Promise.all([
    db.select().from(lfBuildingQueue).where(eq(lfBuildingQueue.kingdomId, kingdom.id)),
    db.select().from(lfResearchQueue).where(eq(lfResearchQueue.kingdomId, kingdom.id)),
  ])
  // Map building_id → { finishesAt, level }
  const buildQueueMap = Object.fromEntries(activeBuildQ.map(q => [q.building, { finishesAt: q.finishesAt, level: q.level }]))
  const resQueueMap   = activeResQ.length > 0 ? { [activeResQ[0].research]: { finishesAt: activeResQ[0].finishesAt, level: activeResQ[0].level } } : {}

  // Build per-civilization building lists (only current civ enriched)
  const buildingsByCiv = {}
  for (const c of CIVILIZATIONS) {
    buildingsByCiv[c.id] = LF_BUILDINGS_BY_CIV[c.id].map(def => {
      const level     = lfLevels[def.id] ?? 0
      const nextLevel = level + 1
      const cost      = lfBuildingCost(def, nextLevel)
      const timeSecs  = lfBuildingTime(def, nextLevel, workshopLevel, naniteLevel, speed)
      const reqMet    = lfBuildingRequirementsMet(def, lfLevels, popTotal)
      const inQueue   = buildQueueMap[def.id] ?? null
      return { id: def.id, name: def.name, description: def.description, role: def.role, level, nextLevel, cost, timeSecs, requiresMet: reqMet, requires: def.requires ?? [], bonuses: def.bonuses, inQueue }
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
      const inQueue   = resQueueMap[def.id] ?? null
      return { id: def.id, name: def.name, tier: def.tier, level, nextLevel, cost, timeSecs, effects: def.effects, inQueue }
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
