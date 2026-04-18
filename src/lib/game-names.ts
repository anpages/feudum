/** Centralized display names for building and research IDs */

export const BUILDING_NAMES: Record<string, string> = {
  sawmill: 'Aserradero',
  quarry: 'Cantera',
  grainFarm: 'Granja',
  windmill: 'Molino de Viento',
  cathedral: 'Catedral',
  workshop: 'Taller',
  engineersGuild: 'Gremio de Ingenieros',
  barracks: 'Cuartel',
  granary: 'Granero',
  stonehouse: 'Casa de Piedra',
  silo: 'Silo',
  academy: 'Academia',
  alchemistTower: 'Torre del Alquimista',
  ambassadorHall: 'Sala de Embajadores',
  armoury: 'Armería',
}

export const RESEARCH_NAMES: Record<string, string> = {
  alchemy: 'Alquimia',
  pyromancy: 'Piromagia',
  runemastery: 'Maestría Rúnica',
  mysticism: 'Misticismo',
  dragonlore: 'Lore de Dragones',
  swordsmanship: 'Espadachín',
  armoury: 'Armería',
  fortification: 'Fortificación',
  horsemanship: 'Equitación',
  cartography: 'Cartografía',
  tradeRoutes: 'Rutas Comerciales',
  spycraft: 'Espionaje',
  logistics: 'Logística',
  exploration: 'Exploración',
  diplomaticNetwork: 'Red Diplomática',
  divineBlessing: 'Bendición Divina',
}

export function getReqName(type: 'building' | 'research', id: string): string {
  return type === 'building' ? (BUILDING_NAMES[id] ?? id) : (RESEARCH_NAMES[id] ?? id)
}
