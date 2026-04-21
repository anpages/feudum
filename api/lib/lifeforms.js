/**
 * Formas de Vida — Civilization system (OGame Lifeforms port)
 * 4 civilizations × 12 buildings + 18 researches each
 * Resources mapped: metal→wood, crystal→stone, deuterium→grain
 */

// ── Civilizations ────────────────────────────────────────────────────────────

export const CIVILIZATIONS = [
  { id: 'romans',     name: 'Romanos',    description: 'Equilibrio e ingeniería. Desbloquean nuevas civilizaciones.' },
  { id: 'vikings',    name: 'Vikingos',   description: 'Minería, defensa y reciclaje de escombros.' },
  { id: 'byzantines', name: 'Bizantinos', description: 'Velocidad de construcción, combate y producción de grano.' },
  { id: 'saracens',   name: 'Sarracenos', description: 'Exploración, investigación y velocidad de ejércitos.' },
]

// ── Cost and duration formulas ────────────────────────────────────────────────

// coste(lv) = floor(base * factor^(lv-1) * lv)
export function lfBuildingCost(def, level) {
  const f = Math.pow(def.factor, level - 1) * level
  return {
    wood:  Math.floor(def.woodBase  * f),
    stone: Math.floor(def.stoneBase * f),
    grain: Math.floor(def.grainBase * f),
  }
}

// energía(lv) = floor(lv * energyBase * energyFactor^lv)
export function lfBuildingEnergy(def, level) {
  if (!def.energyBase) return 0
  return Math.floor(level * def.energyBase * Math.pow(def.energyFactor ?? 1, level))
}

// tiempo(lv) = floor(lv * durationBase * durationFactor^lv) / speed / ((1+workshop) * 2^nanite)
export function lfBuildingTime(def, level, workshopLevel = 0, naniteLevel = 0, speed = 1) {
  const raw = Math.floor(level * def.durationBase * Math.pow(def.durationFactor, level))
  const divisor = speed * (1 + workshopLevel) * Math.pow(2, naniteLevel)
  return Math.max(1, Math.round(raw / divisor))
}

// Research cost same formula as buildings
export function lfResearchCost(def, level) {
  const f = Math.pow(def.factor, level - 1) * level
  return {
    wood:  Math.floor(def.woodBase  * f),
    stone: Math.floor(def.stoneBase * f),
    grain: Math.floor(def.grainBase * f),
  }
}

export function lfResearchTime(def, level, speed = 1) {
  const raw = Math.floor(level * def.durationBase * Math.pow(def.durationFactor, level))
  return Math.max(1, Math.round(raw / speed))
}

// Effect bonus formula: (lv^bonusFactor) * bonusBase / 100
export function lfBonus(bonusBase, bonusFactor, level) {
  return Math.pow(level, bonusFactor) * bonusBase / 100
}

// Population growth formula: grows ~20h to fill at x4 speed
// base tasa de crecimiento según edificio; devuelve habitantes/seg
export function populationGrowthRate(def, level, foodBalance) {
  if (level === 0 || foodBalance <= 0) return 0
  const base = lfBonus(def.growthBase ?? 16, 1, level) // lineal por nivel
  return base * Math.min(1, foodBalance) // ralentiza si poca comida
}

// ── Tier unlock requirements ──────────────────────────────────────────────────
export const TIER_POPULATION = {
  t1: 200_000,
  t2: 1_200_000,
  t3: 13_000_000,
}
export const TIER_ARTIFACTS = { t1: 200, t2: 400, t3: 600 }
export const MAX_ARTIFACTS  = 3600

// ── Buildings — 12 per civilization ──────────────────────────────────────────
// role: 'housing'|'food'|'lab'|'school_t2'|'school_t3'|'utility'|'amplifier'|'defense_pop'
// Each building has effects[] describing what it does

export const LF_BUILDINGS = [

  // ════════════════════════════════════════════════════════
  // ROMANOS (Humans)
  // ════════════════════════════════════════════════════════

  {
    id: 'insulae', civilization: 'romans', role: 'housing',
    name: 'Insulae',
    description: 'Bloques residenciales romanos. Aumenta la capacidad de población T1 y la velocidad de crecimiento.',
    woodBase: 7, stoneBase: 2, grainBase: 0, factor: 1.20,
    energyBase: 0,
    durationBase: 40, durationFactor: 1.21,
    requires: [],
    // bonus1: cap T1, bonus2: tasa crecimiento, bonus3: tasa crecimiento T2+T3
    bonuses: [
      { type: 'pop_capacity_t1',  base: 210, factor: 1.21 },
      { type: 'pop_growth',       base: 16,  factor: 1.20 },
      { type: 'pop_growth_t2t3',  base: 9,   factor: 1.15 },
    ],
  },
  {
    id: 'granjaRomana', civilization: 'romans', role: 'food',
    name: 'Granja Comunitaria',
    description: 'Tierras de cultivo comunales. Produce alimento para la población y aumenta sus reservas.',
    woodBase: 5, stoneBase: 2, grainBase: 0, factor: 1.23,
    energyBase: 8, energyFactor: 1.0,
    durationBase: 40, durationFactor: 1.25,
    requires: [],
    bonuses: [
      { type: 'food_production', base: 10, factor: 1.15 },
      { type: 'food_storage',    base: 10, factor: 1.14 },
    ],
  },
  {
    id: 'centroEstudios', civilization: 'romans', role: 'lab',
    name: 'Centro de Estudios',
    description: 'Reduce costes y tiempos de investigación de Formas de Vida en este reino.',
    woodBase: 20000, stoneBase: 25000, grainBase: 10000, factor: 1.30,
    energyBase: 10, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.25,
    requires: [{ id: 'insulae', level: 21 }, { id: 'granjaRomana', level: 22 }],
    bonuses: [
      { type: 'lf_research_cost',  base: -1,  factor: 1.0 }, // -1%/lv
      { type: 'lf_research_time',  base: -2,  factor: 1.0 }, // -2%/lv
    ],
  },
  {
    id: 'academiaRomana', civilization: 'romans', role: 'school_t2',
    name: 'Academia Romana',
    description: 'Convierte población T1 en ciudadanos T2 con acceso a tecnologías avanzadas.',
    woodBase: 5000, stoneBase: 3200, grainBase: 1500, factor: 1.70,
    energyBase: 15, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.60,
    requires: [{ id: 'insulae', level: 41 }],
    popRequired: 20_000_000,
    bonuses: [
      { type: 'pop_convert_t1_to_t2', base: 20, factor: 1.0 },
    ],
  },
  {
    id: 'curiaRomana', civilization: 'romans', role: 'school_t3',
    name: 'Curia Senatorial',
    description: 'Convierte ciudadanos T2 en senadores T3 de máxima eficiencia.',
    woodBase: 50000, stoneBase: 40000, grainBase: 50000, factor: 1.70,
    energyBase: 30, energyFactor: 1.0,
    durationBase: 64000, durationFactor: 1.70,
    requires: [{ id: 'insulae', level: 41 }, { id: 'academiaRomana', level: 1 }, { id: 'tallerProduccion', level: 1 }, { id: 'ciudadelaRomana', level: 5 }],
    popRequired: 100_000_000,
    bonuses: [
      { type: 'pop_convert_t2_to_t3', base: 50, factor: 1.0 },
    ],
  },
  {
    id: 'herreriaImperial', civilization: 'romans', role: 'utility',
    name: 'Herrería Imperial',
    description: 'Fundición de hierro romana. Aumenta la producción de madera.',
    woodBase: 9000, stoneBase: 6000, grainBase: 3000, factor: 1.50,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 2000, durationFactor: 1.30,
    requires: [{ id: 'insulae', level: 21 }, { id: 'granjaRomana', level: 22 }, { id: 'centroEstudios', level: 5 }],
    bonuses: [
      { type: 'production_wood', base: 1.5, factor: 1.0 }, // +1.5%/lv
    ],
  },
  {
    id: 'silosImperiales', civilization: 'romans', role: 'utility',
    name: 'Silos Imperiales',
    description: 'Amplía el almacenamiento de comida y reduce el consumo de la población T1.',
    woodBase: 25000, stoneBase: 13000, grainBase: 7000, factor: 1.09,
    energyBase: 0,
    durationBase: 12000, durationFactor: 1.17,
    requires: [{ id: 'insulae', level: 21 }, { id: 'granjaRomana', level: 22 }, { id: 'centroEstudios', level: 5 }, { id: 'herreriaImperial', level: 3 }],
    bonuses: [
      { type: 'food_storage',   base: 10,  factor: 1.0 },
      { type: 'food_cost_t1',   base: -1,  factor: 1.0 }, // -1%/lv
      { type: 'pop_growth',     base: 0.8, factor: 1.0 },
    ],
  },
  {
    id: 'tallerProduccion', civilization: 'romans', role: 'utility',
    name: 'Taller de Producción',
    description: 'Taller mecánico imperial. Aumenta producción de piedra y grano.',
    woodBase: 50000, stoneBase: 25000, grainBase: 15000, factor: 1.50,
    energyBase: 80, energyFactor: 1.0,
    durationBase: 28000, durationFactor: 1.20,
    requires: [{ id: 'insulae', level: 41 }, { id: 'academiaRomana', level: 1 }],
    bonuses: [
      { type: 'production_stone', base: 1.5, factor: 1.0 },
      { type: 'production_grain', base: 1.5, factor: 1.0 },
    ],
  },
  {
    id: 'ciudadelaRomana', civilization: 'romans', role: 'utility',
    name: 'Ciudadela Romana',
    description: 'Fortaleza urbana. Amplía la capacidad de población y acelera el crecimiento.',
    woodBase: 75000, stoneBase: 20000, grainBase: 25000, factor: 1.09,
    energyBase: 50, energyFactor: 1.0,
    durationBase: 40000, durationFactor: 1.20,
    requires: [{ id: 'insulae', level: 41 }, { id: 'academiaRomana', level: 1 }, { id: 'tallerProduccion', level: 1 }],
    bonuses: [
      { type: 'pop_capacity',     base: 1.5, factor: 1.0 },
      { type: 'pop_growth',       base: 1.5, factor: 1.0 },
    ],
  },
  {
    id: 'laboratorioRomano', civilization: 'romans', role: 'utility',
    name: 'Laboratorio de Herbología',
    description: 'Aumenta la producción de alimento de la granja comunitaria.',
    woodBase: 150000, stoneBase: 30000, grainBase: 15000, factor: 1.12,
    energyBase: 60, energyFactor: 1.0,
    durationBase: 52000, durationFactor: 1.20,
    requires: [{ id: 'insulae', level: 41 }, { id: 'academiaRomana', level: 1 }, { id: 'tallerProduccion', level: 2 }],
    bonuses: [
      { type: 'food_production', base: 5, factor: 1.0 },
    ],
  },
  {
    id: 'foroRomano', civilization: 'romans', role: 'amplifier',
    name: 'Foro Romano',
    description: 'Amplifica todas las bonificaciones de las investigaciones de Formas de Vida en este reino.',
    woodBase: 80000, stoneBase: 35000, grainBase: 60000, factor: 1.50,
    energyBase: 90, energyFactor: 1.0,
    durationBase: 90000, durationFactor: 1.30,
    requires: [{ id: 'insulae', level: 41 }, { id: 'academiaRomana', level: 1 }, { id: 'tallerProduccion', level: 1 }, { id: 'ciudadelaRomana', level: 6 }, { id: 'curiaRomana', level: 1 }],
    bonuses: [
      { type: 'lf_bonus_amplifier', base: 0.5, factor: 1.0 }, // +0.5%/lv bonus amplifier (máx 100%)
    ],
  },
  {
    id: 'murallasImperiales', civilization: 'romans', role: 'defense_pop',
    name: 'Murallas Imperiales',
    description: 'Protege una parte de la población en caso de ataque enemigo.',
    woodBase: 250000, stoneBase: 125000, grainBase: 125000, factor: 1.20,
    energyBase: 100, energyFactor: 1.0,
    durationBase: 95000, durationFactor: 1.20,
    requires: [{ id: 'insulae', level: 41 }, { id: 'granjaRomana', level: 22 }, { id: 'centroEstudios', level: 5 }, { id: 'academiaRomana', level: 1 }, { id: 'tallerProduccion', level: 5 }, { id: 'ciudadelaRomana', level: 6 }, { id: 'herreriaImperial', level: 3 }, { id: 'foroRomano', level: 5 }, { id: 'silosImperiales', level: 4 }, { id: 'curiaRomana', level: 5 }],
    bonuses: [
      { type: 'pop_protection', base: 1.5, factor: 1.0 }, // +1.5%/lv de población protegida (máx 80%)
    ],
  },

  // ════════════════════════════════════════════════════════
  // VIKINGOS (Rocktal)
  // ════════════════════════════════════════════════════════

  {
    id: 'longhouse', civilization: 'vikings', role: 'housing',
    name: 'Longhouse',
    description: 'Gran sala comunal vikinga. Aloja guerreros y familias, base de la civilización.',
    woodBase: 9, stoneBase: 3, grainBase: 0, factor: 1.20,
    energyBase: 0,
    durationBase: 40, durationFactor: 1.21,
    requires: [],
    bonuses: [
      { type: 'pop_capacity_t1', base: 150, factor: 1.216 },
      { type: 'pop_growth',      base: 12,  factor: 1.20  },
      { type: 'pop_growth_t2t3', base: 5,   factor: 1.15  },
    ],
  },
  {
    id: 'granjaHelada', civilization: 'vikings', role: 'food',
    name: 'Granja Helada',
    description: 'Cultivos adaptados al frío nórdico. Produce alimento resistente al invierno.',
    woodBase: 7, stoneBase: 2, grainBase: 0, factor: 1.20,
    energyBase: 10, energyFactor: 1.0,
    durationBase: 40, durationFactor: 1.21,
    requires: [],
    bonuses: [
      { type: 'food_production', base: 8,  factor: 1.15 },
      { type: 'food_storage',    base: 6,  factor: 1.14 },
    ],
  },
  {
    id: 'tallerRunico', civilization: 'vikings', role: 'lab',
    name: 'Taller Rúnico',
    description: 'Centro de conocimiento rúnico. Reduce costes y tiempos de investigación vikinga.',
    woodBase: 40000, stoneBase: 10000, grainBase: 15000, factor: 1.30,
    energyBase: 15, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.25,
    requires: [{ id: 'longhouse', level: 21 }, { id: 'granjaHelada', level: 22 }],
    bonuses: [
      { type: 'lf_research_cost', base: -1, factor: 1.0 },
      { type: 'lf_research_time', base: -2, factor: 1.0 },
    ],
  },
  {
    id: 'forjaRunas', civilization: 'vikings', role: 'school_t2',
    name: 'Forja de Runas',
    description: 'Transforma guerreros T1 en maestros rúnicos T2.',
    woodBase: 5000, stoneBase: 3800, grainBase: 1000, factor: 1.70,
    energyBase: 20, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.60,
    requires: [{ id: 'longhouse', level: 41 }],
    popRequired: 16_000_000,
    bonuses: [
      { type: 'pop_convert_t1_to_t2', base: 20, factor: 1.0 },
    ],
  },
  {
    id: 'salaSkald', civilization: 'vikings', role: 'school_t3',
    name: 'Sala del Skald',
    description: 'Los Skalds legendarios forjan a los más poderosos guerreros T3.',
    woodBase: 50000, stoneBase: 40000, grainBase: 50000, factor: 1.65,
    energyBase: 60, energyFactor: 1.0,
    durationBase: 64000, durationFactor: 1.70,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'forjaRunas', level: 1 }, { id: 'megalito', level: 1 }, { id: 'destileriaHielo', level: 5 }],
    popRequired: 90_000_000,
    bonuses: [
      { type: 'pop_convert_t2_to_t3', base: 50, factor: 1.0 },
    ],
  },
  {
    id: 'fraguaVolcanica', civilization: 'vikings', role: 'utility',
    name: 'Fragua Volcánica',
    description: 'Calor geotérmico para forjar metales. Aumenta la producción de madera.',
    woodBase: 10000, stoneBase: 8000, grainBase: 1000, factor: 1.40,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 2000, durationFactor: 1.30,
    requires: [{ id: 'longhouse', level: 21 }, { id: 'granjaHelada', level: 22 }, { id: 'tallerRunico', level: 5 }],
    bonuses: [
      { type: 'production_wood', base: 2, factor: 1.0 }, // +2%/lv
    ],
  },
  {
    id: 'camaraRelampagos', civilization: 'vikings', role: 'utility',
    name: 'Cámara de Relámpagos',
    description: 'Captura energía de las tormentas del norte. Produce energía y reduce su consumo.',
    woodBase: 20000, stoneBase: 15000, grainBase: 10000, factor: 1.20,
    energyBase: 0,
    durationBase: 16000, durationFactor: 1.25,
    requires: [{ id: 'longhouse', level: 21 }, { id: 'granjaHelada', level: 22 }, { id: 'tallerRunico', level: 5 }, { id: 'fraguaVolcanica', level: 3 }],
    bonuses: [
      { type: 'energy_production', base: 1.5, factor: 1.0 },
      { type: 'energy_cost',       base: -0.5, factor: 1.0 }, // máx 40%
    ],
  },
  {
    id: 'megalito', civilization: 'vikings', role: 'utility',
    name: 'Megalito',
    description: 'Círculo de piedras antiguo. Reduce costes y tiempo de construcción vikinga.',
    woodBase: 50000, stoneBase: 35000, grainBase: 15000, factor: 1.50,
    energyBase: 80, energyFactor: 1.0,
    durationBase: 40000, durationFactor: 1.40,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'forjaRunas', level: 1 }],
    bonuses: [
      { type: 'lf_building_cost', base: -1, factor: 1.0 }, // máx 50%
      { type: 'lf_building_time', base: -1, factor: 1.0 }, // máx 50%
    ],
  },
  {
    id: 'destileriaHielo', civilization: 'vikings', role: 'utility',
    name: 'Destilería de Hielo',
    description: 'Extrae piedra pura del hielo polar. Aumenta la producción de piedra.',
    woodBase: 85000, stoneBase: 44000, grainBase: 25000, factor: 1.40,
    energyBase: 90, energyFactor: 1.0,
    durationBase: 40000, durationFactor: 1.20,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'forjaRunas', level: 1 }, { id: 'megalito', level: 1 }],
    bonuses: [
      { type: 'production_stone', base: 2, factor: 1.0 },
    ],
  },
  {
    id: 'alambiqueRunico', civilization: 'vikings', role: 'utility',
    name: 'Alambique Rúnico',
    description: 'Técnica rúnica de fermentación. Aumenta la producción de grano.',
    woodBase: 120000, stoneBase: 50000, grainBase: 20000, factor: 1.40,
    energyBase: 90, energyFactor: 1.0,
    durationBase: 52000, durationFactor: 1.20,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'forjaRunas', level: 1 }, { id: 'megalito', level: 2 }],
    bonuses: [
      { type: 'production_grain', base: 2, factor: 1.0 },
    ],
  },
  {
    id: 'salaNautica', civilization: 'vikings', role: 'utility',
    name: 'Sala Náutica',
    description: 'Centro de cartografía vikinga. Reduce costes de investigación y edificios de producción.',
    woodBase: 250000, stoneBase: 150000, grainBase: 100000, factor: 1.80,
    energyBase: 120, energyFactor: 1.0,
    durationBase: 90000, durationFactor: 1.30,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'forjaRunas', level: 1 }, { id: 'megalito', level: 1 }, { id: 'destileriaHielo', level: 6 }, { id: 'salaSkald', level: 1 }],
    bonuses: [
      { type: 'production_building_cost', base: -0.5, factor: 1.0 }, // máx 50%
    ],
  },
  {
    id: 'patioBotín', civilization: 'vikings', role: 'utility',
    name: 'Patio del Botín',
    description: 'Patio de desguace nórdico. Aumenta el porcentaje de recursos recuperados del campo de escombros.',
    woodBase: 250000, stoneBase: 125000, grainBase: 125000, factor: 1.50,
    energyBase: 100, energyFactor: 1.0,
    durationBase: 95000, durationFactor: 1.30,
    requires: [{ id: 'longhouse', level: 41 }, { id: 'granjaHelada', level: 22 }, { id: 'forjaRunas', level: 1 }, { id: 'megalito', level: 5 }, { id: 'destileriaHielo', level: 6 }, { id: 'salaSkald', level: 5 }, { id: 'tallerRunico', level: 5 }, { id: 'fraguaVolcanica', level: 3 }, { id: 'camaraRelampagos', level: 4 }, { id: 'salaNautica', level: 5 }],
    bonuses: [
      { type: 'debris_recovery', base: 0.6, factor: 1.0 }, // +0.6%/lv (máx 30%)
    ],
  },

  // ════════════════════════════════════════════════════════
  // BIZANTINOS (Mechas)
  // ════════════════════════════════════════════════════════

  {
    id: 'tallerArtesanos', civilization: 'byzantines', role: 'housing',
    name: 'Taller de Artesanos',
    description: 'Centro de producción artesanal. Aloja gremios y familias de artesanos.',
    woodBase: 6, stoneBase: 2, grainBase: 0, factor: 1.21,
    energyBase: 0,
    durationBase: 40, durationFactor: 1.22,
    requires: [],
    bonuses: [
      { type: 'pop_capacity_t1', base: 500, factor: 1.205 },
      { type: 'pop_growth',      base: 24,  factor: 1.20  },
      { type: 'pop_growth_t2t3', base: 22,  factor: 1.15  },
    ],
  },
  {
    id: 'hornoFusion', civilization: 'byzantines', role: 'food',
    name: 'Horno de Fusión',
    description: 'Horno de fundición byzantino. Procesa alimento a gran escala.',
    woodBase: 5, stoneBase: 2, grainBase: 0, factor: 1.18,
    energyBase: 8, energyFactor: 1.0,
    durationBase: 48, durationFactor: 1.20,
    requires: [],
    bonuses: [
      { type: 'food_production', base: 18, factor: 1.15 },
      { type: 'food_storage',    base: 23, factor: 1.12 },
    ],
  },
  {
    id: 'tallerAutomatas', civilization: 'byzantines', role: 'lab',
    name: 'Taller de Autómatas',
    description: 'Ingeniería mecánica avanzada. Reduce costes y tiempos de investigación bizantina.',
    woodBase: 30000, stoneBase: 20000, grainBase: 10000, factor: 1.30,
    energyBase: 13, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.25,
    requires: [{ id: 'tallerArtesanos', level: 17 }, { id: 'hornoFusion', level: 20 }],
    bonuses: [
      { type: 'lf_research_cost', base: -1, factor: 1.0 },
      { type: 'lf_research_time', base: -2, factor: 1.0 },
    ],
  },
  {
    id: 'redMensajeros', civilization: 'byzantines', role: 'school_t2',
    name: 'Red de Mensajeros',
    description: 'Sistema de mensajería imperialaria. Convierte artesanos T1 en maestros T2.',
    woodBase: 5000, stoneBase: 3800, grainBase: 1000, factor: 1.80,
    energyBase: 10, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.60,
    requires: [{ id: 'tallerArtesanos', level: 41 }],
    popRequired: 40_000_000,
    bonuses: [
      { type: 'pop_convert_t1_to_t2', base: 20, factor: 1.0 },
    ],
  },
  {
    id: 'salaCómputo', civilization: 'byzantines', role: 'school_t3',
    name: 'Sala de Cómputo',
    description: 'Máquinas de cálculo mecánico. Eleva a los maestros T2 a ingenieros T3.',
    woodBase: 50000, stoneBase: 40000, grainBase: 50000, factor: 1.80,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 64000, durationFactor: 1.70,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'redMensajeros', level: 1 }, { id: 'scriptorium', level: 1 }, { id: 'granTaller', level: 5 }],
    popRequired: 130_000_000,
    bonuses: [
      { type: 'pop_convert_t2_to_t3', base: 50, factor: 1.0 },
    ],
  },
  {
    id: 'tallerMecanismos', civilization: 'byzantines', role: 'utility',
    name: 'Taller de Mecanismos',
    description: 'Automatización parcial de la producción. Reduce el tiempo de construcción de tropas.',
    woodBase: 7500, stoneBase: 7000, grainBase: 1000, factor: 1.30,
    energyBase: 0,
    durationBase: 2000, durationFactor: 1.30,
    requires: [{ id: 'tallerArtesanos', level: 17 }, { id: 'hornoFusion', level: 20 }, { id: 'tallerAutomatas', level: 5 }],
    bonuses: [
      { type: 'unit_build_time', base: -2, factor: 1.0 }, // -2%/lv (máx 99%)
    ],
  },
  {
    id: 'torreTransmision', civilization: 'byzantines', role: 'amplifier',
    name: 'Torre de Transmisión',
    description: 'Torre de señales mecánica. Amplifica los bonos LF y mejora la producción de energía.',
    woodBase: 35000, stoneBase: 15000, grainBase: 10000, factor: 1.50,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.40,
    requires: [{ id: 'tallerArtesanos', level: 17 }, { id: 'hornoFusion', level: 20 }, { id: 'tallerAutomatas', level: 5 }, { id: 'tallerMecanismos', level: 3 }],
    bonuses: [
      { type: 'energy_production',  base: 1, factor: 1.0 },
      { type: 'lf_bonus_amplifier', base: 0.3, factor: 1.0 },
    ],
  },
  {
    id: 'scriptorium', civilization: 'byzantines', role: 'utility',
    name: 'Scriptorium',
    description: 'Centro de copia de manuscritos. Aumenta producción de alimento y velocidad de crecimiento.',
    woodBase: 50000, stoneBase: 20000, grainBase: 30000, factor: 1.07,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 12000, durationFactor: 1.17,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'redMensajeros', level: 1 }],
    bonuses: [
      { type: 'food_production',  base: 2, factor: 1.0 },
      { type: 'pop_growth',       base: 2, factor: 1.0 },
    ],
  },
  {
    id: 'granTaller', civilization: 'byzantines', role: 'utility',
    name: 'Gran Taller',
    description: 'Taller central de la ciudad. Aumenta la capacidad y velocidad de crecimiento.',
    woodBase: 100000, stoneBase: 10000, grainBase: 3000, factor: 1.14,
    energyBase: 80, energyFactor: 1.0,
    durationBase: 40000, durationFactor: 1.30,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'redMensajeros', level: 1 }, { id: 'scriptorium', level: 1 }],
    bonuses: [
      { type: 'pop_capacity', base: 2, factor: 1.0 },
      { type: 'pop_growth',   base: 6, factor: 1.0 },
    ],
  },
  {
    id: 'alquimiaAvanzada', civilization: 'byzantines', role: 'utility',
    name: 'Alquimia Avanzada',
    description: 'Laboratorio alquímico. Aumenta la producción de grano.',
    woodBase: 100000, stoneBase: 40000, grainBase: 20000, factor: 1.50,
    energyBase: 60, energyFactor: 1.0,
    durationBase: 52000, durationFactor: 1.20,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'redMensajeros', level: 1 }, { id: 'scriptorium', level: 2 }],
    bonuses: [
      { type: 'production_grain', base: 2, factor: 1.0 },
    ],
  },
  {
    id: 'fabricaReliquias', civilization: 'byzantines', role: 'amplifier',
    name: 'Fábrica de Reliquias',
    description: 'Produce reliquias que amplifican los bonos de todas las investigaciones LF del reino.',
    woodBase: 55000, stoneBase: 50000, grainBase: 30000, factor: 1.50,
    energyBase: 70, energyFactor: 1.0,
    durationBase: 50000, durationFactor: 1.30,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'redMensajeros', level: 1 }, { id: 'scriptorium', level: 1 }, { id: 'granTaller', level: 6 }, { id: 'salaCómputo', level: 1 }],
    bonuses: [
      { type: 'lf_bonus_amplifier', base: 0.3, factor: 1.0 },
    ],
  },
  {
    id: 'gremioReparacion', civilization: 'byzantines', role: 'utility',
    name: 'Gremio de Reparación',
    description: 'Gremio de mantenimiento de armas y defensas. Aumenta unidades recuperadas en campo de escombros.',
    woodBase: 250000, stoneBase: 125000, grainBase: 125000, factor: 1.40,
    energyBase: 100, energyFactor: 1.0,
    durationBase: 95000, durationFactor: 1.40,
    requires: [{ id: 'tallerArtesanos', level: 41 }, { id: 'hornoFusion', level: 20 }, { id: 'scriptorium', level: 5 }, { id: 'tallerAutomatas', level: 5 }, { id: 'torreTransmision', level: 4 }, { id: 'granTaller', level: 6 }, { id: 'salaCómputo', level: 5 }, { id: 'fabricaReliquias', level: 11 }],
    bonuses: [
      { type: 'debris_recovery', base: 1.3, factor: 1.0 }, // +1.3%/lv (máx 50%)
    ],
  },

  // ════════════════════════════════════════════════════════
  // SARRACENOS (Kaelesh)
  // ════════════════════════════════════════════════════════

  {
    id: 'santuario', civilization: 'saracens', role: 'housing',
    name: 'Santuario',
    description: 'Centro espiritual y residencial. Hogar de la comunidad sarracena.',
    woodBase: 4, stoneBase: 3, grainBase: 0, factor: 1.21,
    energyBase: 0,
    durationBase: 40, durationFactor: 1.22,
    requires: [],
    bonuses: [
      { type: 'pop_capacity_t1', base: 250, factor: 1.21  },
      { type: 'pop_growth',      base: 16,  factor: 1.20  },
      { type: 'pop_growth_t2t3', base: 11,  factor: 1.15  },
    ],
  },
  {
    id: 'destileriaEspecias', civilization: 'saracens', role: 'food',
    name: 'Destilería de Especias',
    description: 'Arte culinaria sarracena. Produce alimento de alta calidad en poco espacio.',
    woodBase: 6, stoneBase: 3, grainBase: 0, factor: 1.21,
    energyBase: 9, energyFactor: 1.0,
    durationBase: 40, durationFactor: 1.22,
    requires: [],
    bonuses: [
      { type: 'food_production', base: 12, factor: 1.15 },
      { type: 'food_storage',    base: 12, factor: 1.14 },
    ],
  },
  {
    id: 'salaAstrolabio', civilization: 'saracens', role: 'lab',
    name: 'Sala del Astrolabio',
    description: 'Observatorio y laboratorio astronómico. Reduce costes y tiempos de investigación sarracena.',
    woodBase: 20000, stoneBase: 20000, grainBase: 30000, factor: 1.30,
    energyBase: 10, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.25,
    requires: [{ id: 'santuario', level: 20 }, { id: 'destileriaEspecias', level: 21 }],
    bonuses: [
      { type: 'lf_research_cost', base: -1, factor: 1.0 },
      { type: 'lf_research_time', base: -2, factor: 1.0 },
    ],
  },
  {
    id: 'casaSabiduria', civilization: 'saracens', role: 'school_t2',
    name: 'Casa de la Sabiduría',
    description: 'Gran biblioteca sarracena. Convierte ciudadanos T1 en eruditos T2.',
    woodBase: 7500, stoneBase: 5000, grainBase: 800, factor: 1.80,
    energyBase: 15, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.70,
    requires: [{ id: 'santuario', level: 42 }],
    popRequired: 30_000_000,
    bonuses: [
      { type: 'pop_convert_t1_to_t2', base: 20, factor: 1.0 },
    ],
  },
  {
    id: 'granMezquita', civilization: 'saracens', role: 'school_t3',
    name: 'Gran Mezquita',
    description: 'Centro espiritual supremo. Eleva a los eruditos T2 a maestros T3.',
    woodBase: 60000, stoneBase: 30000, grainBase: 50000, factor: 1.80,
    energyBase: 30, energyFactor: 1.0,
    durationBase: 64000, durationFactor: 1.80,
    requires: [{ id: 'santuario', level: 42 }, { id: 'casaSabiduria', level: 1 }, { id: 'crisalidaAcelerada', level: 1 }, { id: 'jardinBotanico', level: 5 }],
    popRequired: 100_000_000,
    bonuses: [
      { type: 'pop_convert_t2_to_t3', base: 50, factor: 1.0 },
    ],
  },
  {
    id: 'hornoSolar', civilization: 'saracens', role: 'utility',
    name: 'Horno Solar',
    description: 'Concentrador solar de energía. Reduce el consumo de alimento de la población.',
    woodBase: 8500, stoneBase: 5000, grainBase: 3000, factor: 1.25,
    energyBase: 0,
    durationBase: 2000, durationFactor: 1.35,
    requires: [{ id: 'santuario', level: 20 }, { id: 'destileriaEspecias', level: 21 }, { id: 'salaAstrolabio', level: 5 }],
    bonuses: [
      { type: 'food_cost', base: -1, factor: 1.0 }, // -1%/lv (máx 50%)
    ],
  },
  {
    id: 'caravanserai', civilization: 'saracens', role: 'utility',
    name: 'Caravanserai',
    description: 'Posada de caravanas. Aumenta la velocidad de crecimiento de toda la población.',
    woodBase: 15000, stoneBase: 15000, grainBase: 5000, factor: 1.20,
    energyBase: 0,
    durationBase: 12000, durationFactor: 1.20,
    requires: [{ id: 'santuario', level: 20 }, { id: 'destileriaEspecias', level: 21 }, { id: 'salaAstrolabio', level: 5 }, { id: 'hornoSolar', level: 3 }],
    bonuses: [
      { type: 'pop_growth', base: 2, factor: 1.0 },
    ],
  },
  {
    id: 'crisalidaAcelerada', civilization: 'saracens', role: 'utility',
    name: 'Crisálida Acelerada',
    description: 'Centro de evolución acelerada. Amplía la capacidad de población y su crecimiento.',
    woodBase: 75000, stoneBase: 25000, grainBase: 30000, factor: 1.05,
    energyBase: 30, energyFactor: 1.0,
    durationBase: 16000, durationFactor: 1.18,
    requires: [{ id: 'santuario', level: 42 }, { id: 'casaSabiduria', level: 1 }],
    bonuses: [
      { type: 'pop_capacity', base: 2, factor: 1.0 },
      { type: 'pop_growth',   base: 6, factor: 1.0 },
    ],
  },
  {
    id: 'jardinBotanico', civilization: 'saracens', role: 'utility',
    name: 'Jardín Botánico',
    description: 'Jardines medicinales. Aumenta los campos de construcción del reino.',
    woodBase: 87500, stoneBase: 25000, grainBase: 30000, factor: 1.20,
    energyBase: 40, energyFactor: 1.0,
    durationBase: 40000, durationFactor: 1.20,
    requires: [{ id: 'santuario', level: 42 }, { id: 'casaSabiduria', level: 1 }, { id: 'crisalidaAcelerada', level: 1 }],
    bonuses: [
      { type: 'fields_extra', base: 2, factor: 1.0 }, // +2 campos/lv
    ],
  },
  {
    id: 'torreMuecin', civilization: 'saracens', role: 'utility',
    name: 'Torre del Muecín',
    description: 'Torre de llamada al saber. Reduce los requisitos de población para investigaciones LF.',
    woodBase: 150000, stoneBase: 30000, grainBase: 30000, factor: 1.50,
    energyBase: 140, energyFactor: 1.0,
    durationBase: 52000, durationFactor: 1.80,
    requires: [{ id: 'santuario', level: 42 }, { id: 'casaSabiduria', level: 1 }, { id: 'crisalidaAcelerada', level: 2 }],
    bonuses: [
      { type: 'tier_pop_reduction', base: -1, factor: 1.0 }, // -1%/lv (máx 25%)
    ],
  },
  {
    id: 'arsenalNaval', civilization: 'saracens', role: 'utility',
    name: 'Arsenal Naval',
    description: 'Astillero sarraceno. Reduce el tiempo de entrenamiento de tropas.',
    woodBase: 75000, stoneBase: 50000, grainBase: 55000, factor: 1.20,
    energyBase: 90, energyFactor: 1.0,
    durationBase: 90000, durationFactor: 1.30,
    requires: [{ id: 'santuario', level: 42 }, { id: 'casaSabiduria', level: 1 }, { id: 'crisalidaAcelerada', level: 1 }, { id: 'jardinBotanico', level: 6 }, { id: 'granMezquita', level: 1 }],
    bonuses: [
      { type: 'unit_build_time', base: -1.5, factor: 1.0 }, // -1.5%/lv (máx 70%)
    ],
  },
  {
    id: 'observatorio', civilization: 'saracens', role: 'utility',
    name: 'Observatorio',
    description: 'Observatorio astronómico. Aumenta la probabilidad de crear luna tras batalla y la producción de artefactos.',
    woodBase: 500000, stoneBase: 250000, grainBase: 250000, factor: 1.40,
    energyBase: 100, energyFactor: 1.0,
    durationBase: 95000, durationFactor: 1.30,
    requires: [{ id: 'santuario', level: 42 }, { id: 'destileriaEspecias', level: 21 }, { id: 'salaAstrolabio', level: 5 }, { id: 'hornoSolar', level: 3 }, { id: 'caravanserai', level: 4 }, { id: 'casaSabiduria', level: 1 }, { id: 'crisalidaAcelerada', level: 5 }, { id: 'jardinBotanico', level: 6 }, { id: 'granMezquita', level: 5 }, { id: 'arsenalNaval', level: 5 }],
    bonuses: [
      { type: 'moon_chance',    base: 0.5, factor: 1.0 }, // +0.5%/lv (máx 30%)
      { type: 'artifact_gain', base: 1,   factor: 1.0 },
    ],
  },
]

// ── Researches — 18 per civilization ─────────────────────────────────────────

export const LF_RESEARCH = [

  // ════════════════════════════════════════════════════════
  // ROMANOS — 18 investigaciones
  // ════════════════════════════════════════════════════════

  // T1 (1-6)
  { id: 'enviados',          civilization: 'romans', tier: 1, name: 'Enviados Intergalácticos',
    woodBase: 5000, stoneBase: 2500, grainBase: 500, factor: 1.30, durationBase: 500, durationFactor: 1.30,
    effects: [{ type: 'expedition_time', base: -1 }] },
  { id: 'extractoresHP',     civilization: 'romans', tier: 1, name: 'Extractores de Alto Rendimiento',
    woodBase: 7000, stoneBase: 10000, grainBase: 5000, factor: 1.50, durationBase: 600, durationFactor: 1.35,
    effects: [{ type: 'production_all', base: 0.06 }] },
  { id: 'motorFusion',       civilization: 'romans', tier: 1, name: 'Motores de Fusión',
    woodBase: 15000, stoneBase: 10000, grainBase: 5000, factor: 1.30, durationBase: 800, durationFactor: 1.35,
    effects: [{ type: 'army_speed_civil', base: 0.5 }] },
  { id: 'generadorOculto',   civilization: 'romans', tier: 1, name: 'Generador de Campo Oculto',
    woodBase: 20000, stoneBase: 15000, grainBase: 7500, factor: 1.30, durationBase: 1000, durationFactor: 1.35,
    effects: [{ type: 'spy_cost', base: -0.1 }, { type: 'spy_time', base: -0.2 }] },
  { id: 'fortinOrbital',     civilization: 'romans', tier: 1, name: 'Fortín Orbital',
    woodBase: 25000, stoneBase: 20000, grainBase: 10000, factor: 1.40, durationBase: 1200, durationFactor: 1.35,
    effects: [{ type: 'resources_protected', base: 4 }] },
  { id: 'iaInvestigacion',   civilization: 'romans', tier: 1, name: 'IA de Investigación',
    woodBase: 35000, stoneBase: 25000, grainBase: 15000, factor: 1.50, durationBase: 1500, durationFactor: 1.35,
    effects: [{ type: 'research_time', base: -0.1 }] },

  // T2 (7-12)
  { id: 'terraformadorHP',   civilization: 'romans', tier: 2, name: 'Terraformador de Alto Rendimiento',
    woodBase: 70000, stoneBase: 40000, grainBase: 20000, factor: 1.30, durationBase: 3000, durationFactor: 1.40,
    effects: [{ type: 'lf_building_cost', base: -0.1 }, { type: 'lf_building_time', base: -0.2 }] },
  { id: 'tecProduccionMejorada', civilization: 'romans', tier: 2, name: 'Tecnologías de Producción Mejoradas',
    woodBase: 80000, stoneBase: 50000, grainBase: 20000, factor: 1.50, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'production_all', base: 0.06 }] },
  { id: 'squireMk2',         civilization: 'romans', tier: 2, name: 'Escudero MkII',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 8000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_squire', base: 0.3 }] },
  { id: 'paladinMk2',        civilization: 'romans', tier: 2, name: 'Paladín MkII',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 8000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_paladin', base: 0.3 }] },
  { id: 'labMejorado',       civilization: 'romans', tier: 2, name: 'Tecnología de Laboratorio Mejorada',
    woodBase: 120000, stoneBase: 30000, grainBase: 25000, factor: 1.50, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'research_time', base: -0.1 }] },
  { id: 'terraformadorPlasma', civilization: 'romans', tier: 2, name: 'Terraformador de Plasma',
    woodBase: 100000, stoneBase: 40000, grainBase: 30000, factor: 1.30, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'lf_building_cost', base: -0.1 }, { type: 'lf_building_time', base: -0.2 }] },

  // T3 (13-18)
  { id: 'motorBajaTemp',     civilization: 'romans', tier: 3, name: 'Motores de Baja Temperatura',
    woodBase: 200000, stoneBase: 100000, grainBase: 100000, factor: 1.30, durationBase: 8000, durationFactor: 1.50,
    effects: [{ type: 'spy_cost', base: -0.1 }, { type: 'spy_time', base: -0.2 }] },
  { id: 'bombarderoMk2',     civilization: 'romans', tier: 3, name: 'Maestro de Asedio MkII',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_siegeMaster', base: 0.3 }] },
  { id: 'destructorMk2',     civilization: 'romans', tier: 3, name: 'Máquina de Guerra MkII',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_warMachine', base: 0.3 }] },
  { id: 'caballeroGrandeMk2', civilization: 'romans', tier: 3, name: 'Gran Caballero MkII',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_grandKnight', base: 0.3 }] },
  { id: 'asistentesRobots',  civilization: 'romans', tier: 3, name: 'Asistentes Mecánicos',
    woodBase: 300000, stoneBase: 180000, grainBase: 120000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'research_time', base: -0.2 }] },
  { id: 'supercomputador',   civilization: 'romans', tier: 3, name: 'Supercomputador',
    woodBase: 500000, stoneBase: 300000, grainBase: 200000, factor: 1.30, durationBase: 15000, durationFactor: 1.50,
    effects: [{ type: 'astro_research_time', base: -0.1 }] },

  // ════════════════════════════════════════════════════════
  // VIKINGOS — 18 investigaciones
  // ════════════════════════════════════════════════════════

  // T1
  { id: 'bateriaVolcanica',  civilization: 'vikings', tier: 1, name: 'Batería Volcánica',
    woodBase: 10000, stoneBase: 6000, grainBase: 1000, factor: 1.50, durationBase: 700, durationFactor: 1.35,
    effects: [{ type: 'energy_production', base: 0.25 }] },
  { id: 'escaneAcustico',    civilization: 'vikings', tier: 1, name: 'Escaneo Acústico',
    woodBase: 7500, stoneBase: 12500, grainBase: 5000, factor: 1.50, durationBase: 600, durationFactor: 1.35,
    effects: [{ type: 'production_stone', base: 0.08 }] },
  { id: 'sistemaBombeoHP',   civilization: 'vikings', tier: 1, name: 'Sistemas de Bombeo de Alta Energía',
    woodBase: 15000, stoneBase: 10000, grainBase: 5000, factor: 1.50, durationBase: 800, durationFactor: 1.35,
    effects: [{ type: 'production_grain', base: 0.08 }] },
  { id: 'expansionCargo',    civilization: 'vikings', tier: 1, name: 'Expansión de Carga',
    woodBase: 20000, stoneBase: 15000, grainBase: 7500, factor: 1.30, durationBase: 1000, durationFactor: 1.35,
    effects: [{ type: 'cargo_capacity_civil', base: 0.4 }] },
  { id: 'produccionMagma',   civilization: 'vikings', tier: 1, name: 'Producción Ígnea',
    woodBase: 25000, stoneBase: 20000, grainBase: 10000, factor: 1.50, durationBase: 1200, durationFactor: 1.35,
    effects: [{ type: 'production_all', base: 0.08 }] },
  { id: 'plantasGeotermicas', civilization: 'vikings', tier: 1, name: 'Plantas Geotérmicas',
    woodBase: 50000, stoneBase: 50000, grainBase: 20000, factor: 1.50, durationBase: 2000, durationFactor: 1.35,
    effects: [{ type: 'energy_production', base: 0.25 }] },

  // T2
  { id: 'sondeoProf',        civilization: 'vikings', tier: 2, name: 'Sondeo en Profundidad',
    woodBase: 70000, stoneBase: 40000, grainBase: 20000, factor: 1.50, durationBase: 3000, durationFactor: 1.40,
    effects: [{ type: 'production_wood', base: 0.08 }] },
  { id: 'caballeroHPMk2',    civilization: 'vikings', tier: 2, name: 'Caballero MkII',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 7000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_knight', base: 0.3 }] },
  { id: 'stellaratorMejorado', civilization: 'vikings', tier: 2, name: 'Estelator Mejorado',
    woodBase: 75000, stoneBase: 55000, grainBase: 25000, factor: 1.50, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'plasma_cost', base: -0.15 }, { type: 'plasma_time', base: -0.3 }] },
  { id: 'perforadoresDiamante', civilization: 'vikings', tier: 2, name: 'Perforadores de Diamante',
    woodBase: 85000, stoneBase: 40000, grainBase: 35000, factor: 1.50, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'production_wood', base: 0.08 }] },
  { id: 'mineriaSismica',    civilization: 'vikings', tier: 2, name: 'Minería Sísmica',
    woodBase: 120000, stoneBase: 30000, grainBase: 25000, factor: 1.50, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'production_stone', base: 0.08 }] },
  { id: 'sistemaBombeoMagma', civilization: 'vikings', tier: 2, name: 'Sistema de Bombeo de Magma',
    woodBase: 100000, stoneBase: 40000, grainBase: 30000, factor: 1.50, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'production_grain', base: 0.08 }] },

  // T3
  { id: 'modulosCristales',  civilization: 'vikings', tier: 3, name: 'Módulos de Cristal Rúnico',
    woodBase: 200000, stoneBase: 100000, grainBase: 100000, factor: 1.20, durationBase: 8000, durationFactor: 1.50,
    effects: [{ type: 'scavenger_bonus', base: 0.1 }] },
  { id: 'siloOptimizado',    civilization: 'vikings', tier: 3, name: 'Método de Silo Optimizado',
    woodBase: 220000, stoneBase: 110000, grainBase: 110000, factor: 1.30, durationBase: 9000, durationFactor: 1.50,
    effects: [{ type: 'armoury_cost', base: -0.1 }, { type: 'armoury_time', base: -0.2 }] },
  { id: 'transmisorDiamante', civilization: 'vikings', tier: 3, name: 'Transmisor de Diamante',
    woodBase: 240000, stoneBase: 120000, grainBase: 120000, factor: 1.30, durationBase: 9000, durationFactor: 1.50,
    effects: [{ type: 'energy_research_cost', base: -0.1 }, { type: 'energy_research_time', base: -0.2 }] },
  { id: 'refuerzoObsidiana',  civilization: 'vikings', tier: 3, name: 'Refuerzo de Obsidiana',
    woodBase: 250000, stoneBase: 250000, grainBase: 250000, factor: 1.40, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'defense_stats', base: 0.5 }] },
  { id: 'escudosRunicos',    civilization: 'vikings', tier: 3, name: 'Escudos Rúnicos',
    woodBase: 500000, stoneBase: 300000, grainBase: 200000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'armour_cost', base: -0.2 }, { type: 'armour_time', base: -0.2 }] },
  { id: 'mejoraCosechador',  civilization: 'vikings', tier: 3, name: 'Potenciador Vikingo',
    woodBase: 300000, stoneBase: 180000, grainBase: 120000, factor: 1.70, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'class_collector_bonus', base: 0.2 }] },

  // ════════════════════════════════════════════════════════
  // BIZANTINOS — 18 investigaciones
  // ════════════════════════════════════════════════════════

  // T1
  { id: 'tecnologiaCatalizador', civilization: 'byzantines', tier: 1, name: 'Tecnología Catalizadora',
    woodBase: 10000, stoneBase: 6000, grainBase: 1000, factor: 1.50, durationBase: 700, durationFactor: 1.35,
    effects: [{ type: 'production_grain', base: 0.08 }] },
  { id: 'motorPlasma',       civilization: 'byzantines', tier: 1, name: 'Motor de Plasma',
    woodBase: 7500, stoneBase: 12500, grainBase: 5000, factor: 1.30, durationBase: 600, durationFactor: 1.35,
    effects: [{ type: 'army_speed', base: 0.2 }] },
  { id: 'moduloEficiencia',  civilization: 'byzantines', tier: 1, name: 'Módulo de Eficiencia',
    woodBase: 15000, stoneBase: 10000, grainBase: 5000, factor: 1.50, durationBase: 800, durationFactor: 1.35,
    effects: [{ type: 'army_fuel_cost', base: -0.03 }] },
  { id: 'iaDeposito',        civilization: 'byzantines', tier: 1, name: 'IA de Depósito',
    woodBase: 20000, stoneBase: 15000, grainBase: 7500, factor: 1.30, durationBase: 1000, durationFactor: 1.35,
    effects: [{ type: 'storage_cost', base: -0.1 }, { type: 'storage_time', base: -0.2 }] },
  { id: 'revisionGenEscudero', civilization: 'byzantines', tier: 1, name: 'Revisión General (Escudero)',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 7000, durationFactor: 1.35,
    effects: [{ type: 'unit_stats_squire', base: 0.3 }] },
  { id: 'lineasTransporte',  civilization: 'byzantines', tier: 1, name: 'Líneas de Transporte Automatizadas',
    woodBase: 50000, stoneBase: 50000, grainBase: 20000, factor: 1.50, durationBase: 2000, durationFactor: 1.35,
    effects: [{ type: 'production_all', base: 0.06 }] },

  // T2
  { id: 'iaExplorador',      civilization: 'byzantines', tier: 2, name: 'IA de Explorador',
    woodBase: 70000, stoneBase: 40000, grainBase: 20000, factor: 1.30, durationBase: 3000, durationFactor: 1.40,
    effects: [{ type: 'spy_cost', base: -0.1 }, { type: 'spy_time', base: -0.2 }] },
  { id: 'tecRecicladoExp',   civilization: 'byzantines', tier: 2, name: 'Tecnología de Reciclaje Experimental',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 7000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_scavenger', base: 1 }] },
  { id: 'revisionGenPaladin', civilization: 'byzantines', tier: 2, name: 'Revisión General (Paladín)',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 7000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_paladin', base: 0.3 }] },
  { id: 'autopilotoHonda',   civilization: 'byzantines', tier: 2, name: 'Autopiloto de Honda',
    woodBase: 85000, stoneBase: 40000, grainBase: 35000, factor: 1.20, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'recall_fuel_refund', base: 0.15 }] },
  { id: 'superconductores',  civilization: 'byzantines', tier: 2, name: 'Superconductores de Alta Temperatura',
    woodBase: 120000, stoneBase: 30000, grainBase: 25000, factor: 1.30, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'energy_research_cost', base: -0.1 }, { type: 'energy_research_time', base: -0.2 }] },
  { id: 'revisionGenWarlord', civilization: 'byzantines', tier: 2, name: 'Revisión General (Señor de la Guerra)',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 7000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_warlord', base: 0.3 }] },

  // T3
  { id: 'inteligenciaEnjambre', civilization: 'byzantines', tier: 3, name: 'Inteligencia de Enjambre Artificial',
    woodBase: 200000, stoneBase: 100000, grainBase: 100000, factor: 1.50, durationBase: 8000, durationFactor: 1.50,
    effects: [{ type: 'production_all', base: 0.06 }] },
  { id: 'revisionGenGrandKnight', civilization: 'byzantines', tier: 3, name: 'Revisión General (Gran Caballero)',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_grandKnight', base: 0.3 }] },
  { id: 'revisionGenSiegeMaster', civilization: 'byzantines', tier: 3, name: 'Revisión General (Maestro de Asedio)',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_siegeMaster', base: 0.3 }] },
  { id: 'revisionGenDragonKnight', civilization: 'byzantines', tier: 3, name: 'Revisión General (Caballero Dragón)',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_dragonKnight', base: 0.3 }] },
  { id: 'tecArmasExp',       civilization: 'byzantines', tier: 3, name: 'Tecnología de Armas Experimental',
    woodBase: 500000, stoneBase: 300000, grainBase: 200000, factor: 1.50, durationBase: 15000, durationFactor: 1.50,
    effects: [{ type: 'weapons_cost', base: -0.2 }, { type: 'weapons_time', base: -0.2 }] },
  { id: 'mejoraBizantino',   civilization: 'byzantines', tier: 3, name: 'Potenciador Bizantino',
    woodBase: 300000, stoneBase: 180000, grainBase: 120000, factor: 1.70, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'class_general_bonus', base: 0.2 }] },

  // ════════════════════════════════════════════════════════
  // SARRACENOS — 18 investigaciones
  // ════════════════════════════════════════════════════════

  // T1
  { id: 'recuperacionCalor', civilization: 'saracens', tier: 1, name: 'Recuperación de Calor',
    woodBase: 10000, stoneBase: 6000, grainBase: 1000, factor: 1.50, durationBase: 700, durationFactor: 1.35,
    effects: [{ type: 'army_fuel_cost', base: -0.03 }] },
  { id: 'procesoSulfuro',    civilization: 'saracens', tier: 1, name: 'Proceso de Sulfuro',
    woodBase: 7500, stoneBase: 12500, grainBase: 5000, factor: 1.50, durationBase: 600, durationFactor: 1.35,
    effects: [{ type: 'production_grain', base: 0.08 }] },
  { id: 'redPsiónica',       civilization: 'saracens', tier: 1, name: 'Red Psiéonica',
    woodBase: 15000, stoneBase: 10000, grainBase: 5000, factor: 1.50, durationBase: 800, durationFactor: 1.35,
    effects: [{ type: 'expedition_loss_reduction', base: -0.05 }] },
  { id: 'rayoTelekinetico',  civilization: 'saracens', tier: 1, name: 'Rayo Telekinético',
    woodBase: 20000, stoneBase: 15000, grainBase: 7500, factor: 1.50, durationBase: 1000, durationFactor: 1.35,
    effects: [{ type: 'expedition_units', base: 0.2 }] },
  { id: 'sensorMejorado',    civilization: 'saracens', tier: 1, name: 'Tecnología de Sensor Mejorada',
    woodBase: 25000, stoneBase: 20000, grainBase: 10000, factor: 1.50, durationBase: 1200, durationFactor: 1.35,
    effects: [{ type: 'expedition_resources', base: 0.2 }] },
  { id: 'compresorNeuro',    civilization: 'saracens', tier: 1, name: 'Compresor Neuromodal',
    woodBase: 50000, stoneBase: 50000, grainBase: 20000, factor: 1.30, durationBase: 2000, durationFactor: 1.35,
    effects: [{ type: 'cargo_capacity_civil', base: 0.4 }] },

  // T2
  { id: 'interfazNeuro',     civilization: 'saracens', tier: 2, name: 'Interfaz Neural',
    woodBase: 70000, stoneBase: 40000, grainBase: 20000, factor: 1.50, durationBase: 3000, durationFactor: 1.40,
    effects: [{ type: 'research_time', base: -0.1 }] },
  { id: 'redAnalisisPlanet', civilization: 'saracens', tier: 2, name: 'Red de Análisis Planetaria',
    woodBase: 80000, stoneBase: 50000, grainBase: 20000, factor: 1.20, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'spy_range', base: 0.6 }] },
  { id: 'overclockCaballero', civilization: 'saracens', tier: 2, name: 'Sobrecarga (Caballero)',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 8000, durationFactor: 1.40,
    effects: [{ type: 'unit_stats_knight', base: 0.3 }] },
  { id: 'motorTelekinetico', civilization: 'saracens', tier: 2, name: 'Motor Telekinético',
    woodBase: 85000, stoneBase: 40000, grainBase: 35000, factor: 1.20, durationBase: 3500, durationFactor: 1.40,
    effects: [{ type: 'expedition_speed', base: 0.1 }] },
  { id: 'sextaSentido',      civilization: 'saracens', tier: 2, name: 'Sexto Sentido',
    woodBase: 120000, stoneBase: 30000, grainBase: 25000, factor: 1.50, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'expedition_resources', base: 0.2 }] },
  { id: 'psicoharmonizador', civilization: 'saracens', tier: 2, name: 'Psicoharmonizador',
    woodBase: 100000, stoneBase: 40000, grainBase: 30000, factor: 1.50, durationBase: 4000, durationFactor: 1.40,
    effects: [{ type: 'production_all', base: 0.06 }] },

  // T3
  { id: 'inteligenciaEficiente', civilization: 'saracens', tier: 3, name: 'Inteligencia de Enjambre Eficiente',
    woodBase: 200000, stoneBase: 100000, grainBase: 100000, factor: 1.50, durationBase: 8000, durationFactor: 1.50,
    effects: [{ type: 'research_time', base: -0.1 }] },
  { id: 'overclockCaravana', civilization: 'saracens', tier: 3, name: 'Sobrecarga (Caravana)',
    woodBase: 160000, stoneBase: 120000, grainBase: 50000, factor: 1.50, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_caravan', base: 1 }] },
  { id: 'sensoresGravedad',  civilization: 'saracens', tier: 3, name: 'Sensores de Gravedad',
    woodBase: 240000, stoneBase: 120000, grainBase: 120000, factor: 1.50, durationBase: 10000, durationFactor: 1.50,
    effects: [{ type: 'expedition_dark_matter', base: 0.1 }] },
  { id: 'overclockWarlord',  civilization: 'saracens', tier: 3, name: 'Sobrecarga (Señor de la Guerra)',
    woodBase: 320000, stoneBase: 240000, grainBase: 100000, factor: 1.50, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'unit_stats_warlord', base: 0.3 }] },
  { id: 'matrizEscudoPs',    civilization: 'saracens', tier: 3, name: 'Matriz de Escudo Psiéonico',
    woodBase: 500000, stoneBase: 300000, grainBase: 200000, factor: 1.50, durationBase: 15000, durationFactor: 1.50,
    effects: [{ type: 'shield_cost', base: -0.2 }, { type: 'shield_time', base: -0.2 }] },
  { id: 'mejoraSarraceno',   civilization: 'saracens', tier: 3, name: 'Potenciador Sarraceno',
    woodBase: 300000, stoneBase: 180000, grainBase: 120000, factor: 1.70, durationBase: 12000, durationFactor: 1.50,
    effects: [{ type: 'class_discoverer_bonus', base: 0.2 }] },
]

// ── Lookup maps ───────────────────────────────────────────────────────────────

export const LF_BUILDINGS_BY_ID = Object.fromEntries(LF_BUILDINGS.map(b => [b.id, b]))
export const LF_RESEARCH_BY_ID  = Object.fromEntries(LF_RESEARCH.map(r => [r.id, r]))

export const LF_BUILDINGS_BY_CIV = Object.fromEntries(
  CIVILIZATIONS.map(c => [c.id, LF_BUILDINGS.filter(b => b.civilization === c.id)])
)
export const LF_RESEARCH_BY_CIV = Object.fromEntries(
  CIVILIZATIONS.map(c => [c.id, LF_RESEARCH.filter(r => r.civilization === c.id)])
)

// ── Requirements check ────────────────────────────────────────────────────────

export function lfBuildingRequirementsMet(def, lfBuildingsLevels, populationTotal) {
  for (const req of (def.requires ?? [])) {
    if ((lfBuildingsLevels[req.id] ?? 0) < req.level) return false
  }
  if (def.popRequired && populationTotal < def.popRequired) return false
  return true
}

// ── Tier check ────────────────────────────────────────────────────────────────

export function unlockedTiers(populationTotal, artifacts, torreMuecinLevel = 0) {
  const reduction = Math.min(0.25, torreMuecinLevel * 0.01)
  const t2Pop   = Math.floor(TIER_POPULATION.t2 * (1 - reduction))
  const t3Pop   = Math.floor(TIER_POPULATION.t3 * (1 - reduction))
  return {
    t1: populationTotal >= TIER_POPULATION.t1 && artifacts >= TIER_ARTIFACTS.t1,
    t2: populationTotal >= t2Pop && artifacts >= TIER_ARTIFACTS.t2,
    t3: populationTotal >= t3Pop && artifacts >= TIER_ARTIFACTS.t3,
  }
}

// ── Population food tick ──────────────────────────────────────────────────────

// Returns { populationT1, populationT2, populationT3, foodStored } after elapsed seconds
export function applyPopulationTick(kingdom, lfLevels, elapsedSecs) {
  const civ  = kingdom.civilization
  if (!civ || elapsedSecs <= 0) return null

  const buildings = LF_BUILDINGS_BY_CIV[civ] ?? []
  const housingDef = buildings.find(b => b.role === 'housing')
  const foodDef    = buildings.find(b => b.role === 'food')

  if (!housingDef || !foodDef) return null

  const housingLv = lfLevels[housingDef.id] ?? 0
  const foodLv    = lfLevels[foodDef.id]    ?? 0

  if (housingLv === 0) return null

  // Food production per second
  const foodProd = housingLv > 0 && foodLv > 0
    ? (foodDef.bonuses[0].base * Math.pow(foodDef.bonuses[0].factor ?? 1.15, foodLv)) / 3600
    : 0

  // Population food consumption per second (1 food per 1000 pop per hour ~ simplified)
  const totalPop  = kingdom.populationT1 + kingdom.populationT2 + kingdom.populationT3
  const foodCons  = totalPop / 1_000 / 3600 // units per second

  const foodBalance  = foodProd - foodCons
  let foodStored     = Math.max(0, kingdom.foodStored + foodBalance * elapsedSecs)

  // Population capacity from housing
  const capT1 = housingDef.bonuses[0].base * Math.pow(housingDef.bonuses[0].factor, housingLv)

  // Growth rate: base growth per second
  const growthRate = housingLv > 0
    ? (housingDef.bonuses[1].base * Math.pow(housingDef.bonuses[1].factor ?? 1.20, housingLv)) / 3600
    : 0

  let populationT1 = kingdom.populationT1
  if (foodBalance >= 0 && populationT1 < capT1) {
    populationT1 = Math.min(capT1, populationT1 + growthRate * elapsedSecs)
  } else if (foodStored <= 0 && totalPop > 0) {
    // Starvation: lose pop until balance is restored
    const toRemove = Math.min(populationT1, Math.abs(foodBalance) * elapsedSecs * 1000)
    populationT1   = Math.max(0, populationT1 - toRemove)
    foodStored     = 0
  }

  return {
    populationT1: Math.floor(populationT1),
    populationT2: kingdom.populationT2,
    populationT3: kingdom.populationT3,
    foodStored,
  }
}

// ── Civilization level bonus ──────────────────────────────────────────────────
export function civLevelBonus(civLevel) {
  return Math.min(0.10, civLevel * 0.001) // máx 10%
}

// ── Aggregate LF research bonus helpers ──────────────────────────────────────

// Returns { woodMult, stoneMult, grainMult } — production multipliers (≥1.0)
export function calcLFProductionBonus(lfResearch) {
  if (!lfResearch) return { woodMult: 1, stoneMult: 1, grainMult: 1 }
  let all = 0, wood = 0, stone = 0, grain = 0
  for (const res of LF_RESEARCH) {
    const lv = lfResearch[res.id] ?? 0
    if (lv === 0) continue
    for (const eff of res.effects) {
      if (eff.type === 'production_all')   all   += eff.base * lv
      if (eff.type === 'production_wood')  wood  += eff.base * lv
      if (eff.type === 'production_stone') stone += eff.base * lv
      if (eff.type === 'production_grain') grain += eff.base * lv
    }
  }
  return {
    woodMult:  1 + all + wood,
    stoneMult: 1 + all + stone,
    grainMult: 1 + all + grain,
  }
}

// Returns a multiplier 0.1–1.0 to apply to research time (reduction from LF)
export function calcLFResearchTimeMult(lfResearch) {
  if (!lfResearch) return 1
  let reduction = 0
  for (const res of LF_RESEARCH) {
    const lv = lfResearch[res.id] ?? 0
    if (lv === 0) continue
    for (const eff of res.effects) {
      if (eff.type === 'research_time') reduction += Math.abs(eff.base) * lv
    }
  }
  return Math.max(0.1, 1 - reduction)
}

// Returns additive army speed bonus (0 = no bonus)
export function calcLFArmySpeedBonus(lfResearch) {
  if (!lfResearch) return 0
  let bonus = 0
  for (const res of LF_RESEARCH) {
    const lv = lfResearch[res.id] ?? 0
    if (lv === 0) continue
    for (const eff of res.effects) {
      if (eff.type === 'army_speed' || eff.type === 'army_speed_civil') bonus += eff.base * lv
    }
  }
  return bonus
}

// Returns per-unit-type stat bonus multipliers: { squire: 0.6, knight: 0.3, ... }
// A value of 0.3 means +30% to attack/shield/hull for that unit
export function calcLFUnitStatBonuses(lfResearch) {
  if (!lfResearch) return {}
  const bonuses = {}
  for (const res of LF_RESEARCH) {
    const lv = lfResearch[res.id] ?? 0
    if (lv === 0) continue
    for (const eff of res.effects) {
      if (eff.type.startsWith('unit_stats_')) {
        const key = eff.type.slice('unit_stats_'.length)
        bonuses[key] = (bonuses[key] ?? 0) + eff.base * lv
      }
      if (eff.type === 'defense_stats') {
        for (const def of ['archer','crossbowman','ballista','trebuchet','mageTower','dragonCannon','catapult']) {
          bonuses[def] = (bonuses[def] ?? 0) + eff.base * lv
        }
      }
    }
  }
  return bonuses
}

// Returns unit build time multiplier (reduction from arsenalNaval etc.)
export function calcLFUnitBuildTimeMult(lfResearch) {
  if (!lfResearch) return 1
  let reduction = 0
  for (const res of LF_RESEARCH) {
    const lv = lfResearch[res.id] ?? 0
    if (lv === 0) continue
    for (const eff of res.effects) {
      if (eff.type === 'unit_build_time') reduction += Math.abs(eff.base) * lv
    }
  }
  return Math.max(0.3, 1 - reduction / 100)
}
