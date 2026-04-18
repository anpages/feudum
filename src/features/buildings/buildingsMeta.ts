import { type IconType } from 'react-icons'
import {
  GiLogging, GiMining, GiGranary, GiWindmill, GiAnvil, GiGearHammer,
  GiMedievalBarracks, GiSpellBook, GiWoodBeam, GiBrickWall, GiGrain,
  GiChurch, GiMagicGate, GiScrollUnfurled, GiShieldReflect,
  GiFactory, GiOpenTreasureChest, GiVillage,
} from 'react-icons/gi'
import type { BuildingMeta } from './components/BuildingCard'

export const BUILDING_META: Record<string, BuildingMeta> = {
  sawmill:        { name: 'Aserradero',           Icon: GiLogging,          produces: 'Madera',       category: 'production',     effect: '+30 × nivel × 1.1^nivel madera/h',                                description: 'Tala los bosques del reino para producir madera sin cesar.' },
  quarry:         { name: 'Cantera',               Icon: GiMining,           produces: 'Piedra',       category: 'production',     effect: '+20 × nivel × 1.1^nivel piedra/h',                                description: 'Extrae bloques de piedra de las colinas circundantes.' },
  grainFarm:      { name: 'Granja',                Icon: GiGranary,          produces: 'Grano',        category: 'production',     effect: '+10 × nivel × 1.1^nivel grano/h',                                 description: 'Cultiva extensos campos de trigo y cebada para la población.' },
  windmill:       { name: 'Molino de Viento',      Icon: GiWindmill,         produces: 'Población',    category: 'production',     effect: '+20 × nivel × 1.1^nivel población máx',                           description: 'Aumenta la capacidad máxima de población del reino.' },
  cathedral:      { name: 'Catedral',              Icon: GiChurch,           produces: 'Grano extra',  category: 'production',     effect: '+5 × nivel × 1.1^nivel grano/h adicional',                        description: 'La bendición de la catedral multiplica las cosechas del reino.' },
  granary:        { name: 'Granero de Madera',     Icon: GiWoodBeam,         produces: null,           category: 'storage',        effect: 'Capacidad de madera: 5000 × ⌊2.5 × e^(20n/33)⌋',                 description: 'Almacena más madera. Cada nivel amplía la capacidad exponencialmente.' },
  stonehouse:     { name: 'Casa de Piedra',        Icon: GiBrickWall,        produces: null,           category: 'storage',        effect: 'Capacidad de piedra: misma fórmula',                               description: 'Bóvedas de roca que guardan tu reserva de piedra.' },
  silo:           { name: 'Silo',                  Icon: GiGrain,            produces: null,           category: 'storage',        effect: 'Capacidad de grano: misma fórmula',                                description: 'Almacén de grano que evita la pérdida de cosechas.' },
  workshop:       { name: 'Taller',                Icon: GiAnvil,            produces: null,           category: 'infrastructure', effect: 'Tiempo de construcción ÷ (1 + nivel)',                             description: 'Mecánicos expertos reducen los tiempos de toda construcción.' },
  engineersGuild: { name: 'Gremio de Ingenieros', Icon: GiGearHammer,       produces: null,           category: 'infrastructure', effect: 'Tiempo de construcción ÷ 2^nivel (exponencial)',                   description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.' },
  barracks:       { name: 'Cuartel',               Icon: GiMedievalBarracks, produces: null,           category: 'infrastructure', effect: 'Desbloquea el entrenamiento de tropas',                            description: 'Entrena guerreros y defensores para proteger el reino.' },
  academy:        { name: 'Academia',              Icon: GiSpellBook,        produces: null,           category: 'infrastructure', effect: 'Desbloquea investigaciones, reduce su tiempo',                     description: 'Centro de saber donde se desarrollan nuevas tecnologías.' },
  alchemistTower: { name: 'Torre del Alquimista',  Icon: GiMagicGate,        produces: 'Piedra extra', category: 'infrastructure', effect: '+15 × nivel × 1.1^nivel piedra/h adicional + investigación más rápida', description: 'Los alquimistas purifican minerales y aceleran la investigación.' },
  ambassadorHall: { name: 'Salón de Embajadores',  Icon: GiScrollUnfurled,   produces: null,           category: 'infrastructure', effect: '−5 % tiempo de viaje por nivel (máx. −40 %)',                     description: 'Red diplomática que reduce el tiempo de desplazamiento de ejércitos.' },
  armoury:        { name: 'Armería',               Icon: GiShieldReflect,    produces: null,           category: 'infrastructure', effect: 'Desbloquea defensas avanzadas (ballista, trebuchet…)',             description: 'Forja armaduras y armas para las defensas del reino.' },
}

export type CategoryMeta = {
  id: 'production' | 'storage' | 'infrastructure'
  label: string
  description: string
  Icon: IconType
  order: string[]
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'production',
    label: 'Producción',
    description: 'Generan madera, piedra y grano de forma continua. Cuanto más altos, más rápido crece tu reino.',
    Icon: GiFactory,
    order: ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral'],
  },
  {
    id: 'storage',
    label: 'Almacenamiento',
    description: 'Amplían el límite de recursos. Mejóralos cuando tu producción supere la capacidad actual.',
    Icon: GiOpenTreasureChest,
    order: ['granary', 'stonehouse', 'silo'],
  },
  {
    id: 'infrastructure',
    label: 'Infraestructura',
    description: 'Desbloquean funciones clave del juego: tropas, investigación, velocidad de construcción.',
    Icon: GiVillage,
    order: ['workshop', 'barracks', 'academy', 'alchemistTower', 'ambassadorHall', 'armoury', 'engineersGuild'],
  },
]

export const GUIDE_STEPS: { id: string; tip: string }[] = [
  { id: 'sawmill',   tip: 'La madera es el recurso más demandado al principio.' },
  { id: 'quarry',    tip: 'La piedra es necesaria para casi todos los edificios.' },
  { id: 'grainFarm', tip: 'El grano alimenta tus tropas y habilita la Catedral.' },
  { id: 'windmill',  tip: 'Sin población no puedes desplegar unidades en campo.' },
  { id: 'workshop',  tip: 'A partir de Nv 2-3 los tiempos de construcción se reducen a la mitad.' },
  { id: 'barracks',  tip: 'Necesitas el Cuartel para entrenar cualquier unidad militar.' },
  { id: 'academy',   tip: 'La Academia desbloquea toda la investigación.' },
]

export const GUIDE_STORAGE_KEY = 'feudum_guide_dismissed'
