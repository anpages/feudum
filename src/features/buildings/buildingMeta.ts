import {
  GiLogging, GiMining, GiGranary, GiWindmill, GiChurch,
  GiWoodBeam, GiBrickWall, GiGrain,
  GiAnvil, GiGearHammer, GiMedievalBarracks, GiSpellBook,
  GiMagicGate, GiScrollUnfurled, GiShieldReflect,
} from 'react-icons/gi'
import { type IconType } from 'react-icons'

export interface BuildingMeta {
  name: string
  description: string
  effect: string
  Icon: IconType
  produces: string | null
  category: 'production' | 'storage' | 'infrastructure'
}

export const BUILDING_META: Record<string, BuildingMeta> = {
  // ── Producción ───────────────────────────────────────────────────────────────
  sawmill: {
    name: 'Aserradero',
    Icon: GiLogging,
    produces: 'Madera',
    category: 'production',
    effect: '+30 × nivel × 1.1^nivel madera/h',
    description: 'Tala los bosques del reino. Consume energía del molino.',
  },
  quarry: {
    name: 'Cantera',
    Icon: GiMining,
    produces: 'Piedra',
    category: 'production',
    effect: '+20 × nivel × 1.1^nivel piedra/h',
    description: 'Extrae bloques de piedra de las colinas. Consume energía del molino.',
  },
  grainFarm: {
    name: 'Granja',
    Icon: GiGranary,
    produces: 'Grano',
    category: 'production',
    effect: '+10 × nivel × 1.1^nivel × factor_temperatura grano/h',
    description: 'Los slots fríos (exteriores) producen mucho más grano. Consume energía.',
  },
  windmill: {
    name: 'Molino de Viento',
    Icon: GiWindmill,
    produces: 'Energía',
    category: 'production',
    effect: '+20 × nivel × 1.1^nivel energía',
    description: 'Fuente principal de energía. Sin energía suficiente, las minas producen menos.',
  },
  cathedral: {
    name: 'Catedral',
    Icon: GiChurch,
    produces: 'Energía',
    category: 'production',
    effect: '+30 × nivel × (1.05 + alquimia × 0.01)^nivel energía',
    description: 'Genera energía adicional. Su potencia crece con el nivel de Alquimia.',
  },
  // ── Almacenamiento ───────────────────────────────────────────────────────────
  granary: {
    name: 'Granero de Madera',
    Icon: GiWoodBeam,
    produces: null,
    category: 'storage',
    effect: 'Capacidad madera: 5000 × ⌊2.5 × e^(20n/33)⌋',
    description: 'Almacena más madera. Sin él los recursos se pierden al llenarse.',
  },
  stonehouse: {
    name: 'Casa de Piedra',
    Icon: GiBrickWall,
    produces: null,
    category: 'storage',
    effect: 'Capacidad piedra: misma fórmula',
    description: 'Bóvedas de roca que guardan tu reserva de piedra.',
  },
  silo: {
    name: 'Silo',
    Icon: GiGrain,
    produces: null,
    category: 'storage',
    effect: 'Capacidad grano: misma fórmula',
    description: 'Almacén de grano que evita la pérdida de cosechas.',
  },
  // ── Infraestructura / Instalaciones ─────────────────────────────────────────
  workshop: {
    name: 'Taller',
    Icon: GiAnvil,
    produces: null,
    category: 'infrastructure',
    effect: 'Tiempo de construcción ÷ (1 + nivel)',
    description: 'Mecánicos expertos reducen los tiempos de toda construcción del reino.',
  },
  engineersGuild: {
    name: 'Gremio de Ingenieros',
    Icon: GiGearHammer,
    produces: null,
    category: 'infrastructure',
    effect: 'Tiempo de construcción ÷ 2^nivel (exponencial)',
    description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.',
  },
  barracks: {
    name: 'Cuartel',
    Icon: GiMedievalBarracks,
    produces: null,
    category: 'infrastructure',
    effect: 'Desbloquea el entrenamiento de tropas y defensas',
    description: 'Sin Cuartel no es posible entrenar unidades ni construir defensas.',
  },
  academy: {
    name: 'Academia',
    Icon: GiSpellBook,
    produces: null,
    category: 'infrastructure',
    effect: 'Habilita investigaciones. Nivel mínimo requerido por cada tecnología.',
    description: 'Centro de saber donde se desarrollan nuevas tecnologías del reino.',
  },
  alchemistTower: {
    name: 'Torre del Alquimista',
    Icon: GiMagicGate,
    produces: null,
    category: 'infrastructure',
    effect: 'Amplía los campos de construcción del reino (+5 por nivel)',
    description: 'El Terraformador medieval. Cada nivel añade más slots de construcción disponibles.',
  },
  ambassadorHall: {
    name: 'Salón de Embajadores',
    Icon: GiScrollUnfurled,
    produces: null,
    category: 'infrastructure',
    effect: 'Almacén compartido de alianza (función futura)',
    description: 'Depósito diplomático para alianzas. Reserva recursos para misiones conjuntas.',
  },
  armoury: {
    name: 'Armería',
    Icon: GiShieldReflect,
    produces: null,
    category: 'infrastructure',
    effect: 'Desbloquea defensas avanzadas (ballista, trebuchet, torre mágica…)',
    description: 'Forja armaduras y armas para las defensas estáticas del reino.',
  },
}

export const RESOURCE_BUILDING_IDS = ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral', 'granary', 'stonehouse', 'silo'] as const
export const FACILITY_BUILDING_IDS = ['workshop', 'engineersGuild', 'barracks', 'academy', 'alchemistTower', 'ambassadorHall', 'armoury'] as const
