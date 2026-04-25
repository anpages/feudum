// Type declarations for the JS modules in src/lib/game/. We keep them as plain
// JS so the API server (Node ESM, no transpile) can re-export them via
// api/lib/<x>.js without a build step. The `any`s are intentional — these are
// pure data + math helpers; runtime correctness is enforced by tests/usage.

declare module '@/lib/game/buildings' {
  export const SLOT_TEMP_RANGES: (null | [number, number])[]
  export function randomTempForSlot(slot: number): { tempMin: number; tempMax: number }
  export function calcTempAvg(tempMin: number | null | undefined, tempMax: number | null | undefined): number
  export const SLOT_PRODUCTION_BONUSES: Record<number, { wood: number; stone: number }>
  export function getSlotBonuses(slot: number | null | undefined): { wood: number; stone: number }
  export const BUILDINGS: Array<{
    id: string
    woodBase: number
    stoneBase: number
    grainBase: number
    factor: number
    requires: { type: 'building' | 'research'; id: string; level: number }[]
  }>
  export function buildCost(woodBase: number, stoneBase: number, factor: number, level: number, grainBase?: number): { wood: number; stone: number; grain: number }
  export function buildTime(wood: number, stone: number, nextLevel: number, workshopLevel: number, engineersGuildLevel: number, speed?: number): number
  export function woodProduction(level: number, factor?: number): number
  export function stoneProduction(level: number, factor?: number): number
  export function grainProduction(level: number, tempAvg?: number): number
  export function windmillEnergy(level: number): number
  export function cathedralEnergy(level: number, alchemyLevel?: number): number
  export function sawmillEnergy(level: number): number
  export function quarryEnergy(level: number): number
  export function grainFarmEnergy(level: number): number
  export function storageCapacity(level: number): number
  export function buildingRequirementsMet(def: { requires?: { type: string; id: string; level: number }[] }, kingdom: Record<string, number>, research: Record<string, number>): boolean
  export function applyBuildingEffect(building: string, newLevel: number, kingdom?: Record<string, number>): Record<string, number>
  export const BASE_FIELDS: number
  export function calcFieldMax(alchemistTowerLevel?: number): number
  export function calcFieldsUsed(kingdom: Record<string, number>): number
}

declare module '@/lib/game/research' {
  export const RESEARCH: Array<{
    id: string
    woodBase: number
    stoneBase: number
    grainBase: number
    factor: number
    requires: { type: 'building' | 'research'; id: string; level: number }[]
  }>
  export function researchCost(def: { woodBase: number; stoneBase: number; grainBase: number; factor: number }, level: number): { wood: number; stone: number; grain: number }
  export function researchTime(wood: number, stone: number, academyLevel: number, speed?: number): number
  export function requirementsMet(def: { requires: { type: string; id: string; level: number }[] }, kingdom: Record<string, number>, research: Record<string, number>): boolean
}

declare module '@/lib/game/units' {
  type UnitDef = {
    id: string
    woodBase: number
    stoneBase: number
    grainBase: number
    hull: number
    shield: number
    attack: number
    requires: { type: 'building' | 'research'; id: string; level: number }[]
  }
  export const UNITS: UnitDef[]
  export const SUPPORT_UNITS: UnitDef[]
  export const DEFENSES: UnitDef[]
  export const MISSILES: UnitDef[]
  export const ALL_UNITS: UnitDef[]
  export function unitBuildTime(hull: number, barracksLevel: number, engineersGuildLevel: number, amount: number, speed?: number): number
  export function unitRequirementsMet(def: { requires: { type: string; id: string; level: number }[] }, kingdom: Record<string, number>, research: Record<string, number>): boolean
}

declare module '@/lib/game/production' {
  export function effectiveProduction(
    kingdom: Record<string, unknown>,
    research: Record<string, unknown> | null,
    cfg: Record<string, unknown>,
    characterClass?: string | null,
  ): { wood: number; stone: number; grain: number; energyProd: number; energyCons: number }
  export function mobileUnitsCount(kingdom: Record<string, unknown>): number
}

declare module '@/lib/game/achievements' {
  export const ACHIEVEMENTS: Array<{
    id: string
    cat: string
    name: string
    desc: string
    icon: string
  }>
  export const ACH_BY_ID: Record<string, { id: string; cat: string; name: string; desc: string; icon: string }>
  export function checkConditions(data: unknown): string[]
}

declare module '@/lib/game/points' {
  export function calcPoints(kingdom: Record<string, number>, research: Record<string, number>): number
  export function calcPointsBreakdown(kingdom: Record<string, number>, research: Record<string, number>): {
    total: number; buildings: number; research: number; units: number; economy: number
  }
}

declare module '@/lib/game/battle' {
  export function simulateBattle(...args: unknown[]): unknown
}

declare module '@/lib/game/speed' {
  export const UNIT_SPEEDS: Record<string, number>
  export const UNIT_DRIVES: Record<string, { drive: string; base: number; upgrades?: { trigger: string; level: number; base: number; drive: string }[] }>
  export const UNIT_CAPACITY: Record<string, number>
  export const UNIT_FUEL: Record<string, number>
  export const DRIVE_BONUS: Record<string, number>
  export function getUnitSpeed(unitId: string, research?: Record<string, number>): number
  export function calcDistance(from: { realm: number; region: number; slot: number }, to: { realm: number; region: number; slot: number }): number
  export function calcDuration(distance: number, units: Record<string, number>, speedPct?: number, universeSpeed?: number, research?: Record<string, number>, characterClass?: string | null): number
  export function calcCargoCapacity(units: Record<string, number>, characterClass?: string | null): number
  export function calcTotalAttack(units: Record<string, number>): number
  export function calcGrainConsumption(units: Record<string, number>, distance: number, travelSecs: number, universeSpeed?: number, research?: Record<string, number>, characterClass?: string | null, holdingHours?: number): number
}

declare module '@/lib/game/tick' {
  export function applyResourceTick(
    kingdom: Record<string, number>,
    cfg: Record<string, number | string | undefined>,
    characterClass?: string | null,
    research?: Record<string, number | undefined> | null,
  ): Record<string, number>
}
