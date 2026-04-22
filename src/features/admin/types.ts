export interface AdminSettings {
  economy_speed: number
  research_speed: number
  fleet_speed_war: number
  fleet_speed_peaceful: number
  basic_wood: number
  basic_stone: number
}

export interface AdminUser {
  id: string
  username: string | null
  email: string
  isAdmin: boolean
  isNpc: boolean
  createdAt: string
  kingdomId: string | null
  kingdom: { id: string; realm: number; region: number; slot: number } | null
}

export interface AdminBattleLog {
  id: string
  attackerKingdomId: string | null
  attackerName: string
  attackerIsNpc: boolean
  defenderKingdomId: string | null
  defenderName: string
  defenderIsNpc: boolean
  missionType: string
  outcome: string
  lootWood: number
  lootStone: number
  lootGrain: number
  attackerLosses: number
  defenderLosses: number
  rounds: number
  attackerCoord: string
  defenderCoord: string
  createdAt: string
}

export interface AdminBattlesResponse {
  battles: AdminBattleLog[]
  metrics: {
    total24h: number
    npcVsNpc24h: number
    npcVsPlayer24h: number
    playerVsNpc24h: number
    playerVsPlayer24h: number
    totalLoot24h: { wood: number; stone: number; grain: number }
  }
  page: number
  limit: number
}

export interface AdminMission {
  id: string
  userId: string
  username: string | null
  missionType: string
  state: string
  arrivalTime: number
  returnTime: number | null
  targetRealm: number
  targetRegion: number
  targetSlot: number
}

export interface AdminExpedition {
  id: string
  userId: string
  state: string
  startRealm: number
  startRegion: number
  startSlot: number
  targetRealm: number
  targetRegion: number
  targetSlot: number
  departureTime: number
  arrivalTime: number
  holdingTime: number | null
  returnTime: number | null
  woodLoad: number | null
  stoneLoad: number | null
  grainLoad: number | null
  result: Record<string, unknown> | null
  kingdomName: string
  isNpc: boolean
}

export interface NpcProfileKingdom {
  id: string
  name: string
  realm: number; region: number; slot: number
  isNpc: boolean; isBoss: boolean; npcLevel: number
  wood: number; woodProduction: number; woodCapacity: number
  stone: number; stoneProduction: number; stoneCapacity: number
  grain: number; grainProduction: number; grainCapacity: number
  lastResourceUpdate: number
  // Buildings
  sawmill: number; quarry: number; grainFarm: number; windmill: number
  cathedral: number; workshop: number; engineersGuild: number; barracks: number
  granary: number; stonehouse: number; silo: number; academy: number
  alchemistTower: number; ambassadorHall: number; armoury: number
  // Combat units
  squire: number; knight: number; paladin: number; warlord: number
  grandKnight: number; siegeMaster: number; warMachine: number; dragonKnight: number
  // Support
  merchant: number; caravan: number; colonist: number; scavenger: number; scout: number
  // Defenses
  archer: number; crossbowman: number; ballista: number; trebuchet: number
  mageTower: number; dragonCannon: number; palisade: number; castleWall: number
  moat: number; catapult: number; ballistic: number
  // NPC meta
  npcBuildAvailableAt: number | null
  npcLastBuildAt: number
  npcLastAttackAt: number
  createdAt: string; updatedAt: string
}

export interface NpcProfileMission {
  id: string
  missionType: string; state: string
  startRealm: number; startRegion: number; startSlot: number
  targetRealm: number; targetRegion: number; targetSlot: number
  departureTime: number; arrivalTime: number
  holdingTime: number; returnTime: number | null
  woodLoad: number; stoneLoad: number; grainLoad: number
  squire: number; knight: number; paladin: number; warlord: number
  grandKnight: number; siegeMaster: number; warMachine: number; dragonKnight: number
  merchant: number; caravan: number; colonist: number; scavenger: number; scout: number
  result: string | null
  createdAt: string
}

export interface NpcProfileBattle {
  id: string
  attackerName: string; attackerIsNpc: boolean; attackerCoord: string
  defenderName: string; defenderIsNpc: boolean; defenderCoord: string
  missionType: string; outcome: string
  lootWood: number; lootStone: number; lootGrain: number
  attackerLosses: number; defenderLosses: number; rounds: number
  createdAt: string
}

export interface NpcProfileResponse {
  kingdom: NpcProfileKingdom
  personality: 'economy' | 'military' | 'balanced' | null
  npcClass: 'collector' | 'general' | 'discoverer' | null
  virtualResearch: Record<string, number> | null
  points: number
  activeMissions: NpcProfileMission[]
  recentMissions: NpcProfileMission[]
  battles: NpcProfileBattle[]
  now: number
}

export interface AdminExpeditionsResponse {
  active: AdminExpedition[]
  recent: AdminExpedition[]
  depletion: Record<string, { count: number; factor: number }>
  stats: {
    active24h: number
    byRegion: Record<string, { count: number; factor: number }>
    npcCount: number
    playerCount: number
  }
  now: number
}

// AdminExpedition already covers both active and recent (same shape)

export interface NpcTickResult {
  at: number
  npcCount: number
  ticked: number
  grew: number
  attacked: number
  scavenged: number
  expeditioned: number
  npcExpeditionsResolved: number
  npcVsNpcResolved: number
  purged: number
}

export interface NpcAggregate {
  total: number
  bosses: number
  withArmy: number
  withMerchant: number
  withCaravan: number
  withScavenger: number
  avgBarracks: number
  avgAcademy: number
  avgWorkshop: number
  avgSawmill: number
  maxBarracks: number
  maxAcademy: number
  avgArmy: number
  maxArmy: number
  totalSquire: number
  totalMerchant: number
  totalCaravan: number
  totalScavenger: number
  // Per-type combat
  totalKnight: number
  totalPaladin: number
  totalWarlord: number
  totalGrandKnight: number
  totalSiegeMaster: number
  totalWarMachine: number
  totalDragonKnight: number
  withKnight: number
  withPaladin: number
  withWarlord: number
  withGrandKnight: number
  // Defense units
  totalArcher: number;      withArcher: number
  totalCrossbowman: number; withCrossbowman: number
  totalBallista: number;    withBallista: number
  totalTrebuchet: number;   withTrebuchet: number
  totalMageTower: number;   withMageTower: number
  totalDragonCannon: number; withDragonCannon: number
  totalCastleWall: number;  withCastleWall: number
  totalMoat: number;        withMoat: number
  totalCatapult: number;    withCatapult: number
  avgWood: number
  avgStone: number
  avgGrain: number
  armyDistribution: Record<string, number>
  missionCounts: Record<string, number>
  now: number
}

export interface NpcStatsResponse {
  lastTick: NpcTickResult | null
  tickHistory: NpcTickResult[]
  aggregate: NpcAggregate
}
