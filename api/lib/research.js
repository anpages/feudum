/**
 * Research definitions — derived from OGame ResearchObjects.php + PlanetService.getTechnologyResearchTime()
 * OGame → Feudum mapping is in CLAUDE.md (research section of db/schema/research.ts)
 *
 * Cost formula: base * factor^level   (factor = 2 for all, 1.75 for exploration)
 * Time formula: (wood + stone) / (1000 * (1 + academy) * speed) * 3600   min: 1s
 *
 * Requirements can reference:
 *   - buildings (checked against kingdoms table)
 *   - other research (checked against research table)
 */

export const RESEARCH = [
  // ── Science / Mystical ────────────────────────────────────────────────────
  {
    id: 'alchemy',           // energy_technology
    woodBase: 0, stoneBase: 800, grainBase: 400, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 1 }],
  },
  {
    id: 'pyromancy',         // laser_technology
    woodBase: 200, stoneBase: 100, grainBase: 0, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 1 },
      { type: 'research',  id: 'alchemy', level: 2 },
    ],
  },
  {
    id: 'runemastery',       // ion_technology
    woodBase: 1000, stoneBase: 300, grainBase: 100, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 4 },
      { type: 'research',  id: 'alchemy',   level: 4 },
      { type: 'research',  id: 'pyromancy', level: 5 },
    ],
  },
  {
    id: 'mysticism',         // hyperspace_technology
    woodBase: 0, stoneBase: 4000, grainBase: 2000, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 7 },
      { type: 'research',  id: 'alchemy',  level: 5 },
      { type: 'research',  id: 'armoury',  level: 5 },
    ],
  },
  {
    id: 'dragonlore',        // plasma_technology
    woodBase: 2000, stoneBase: 4000, grainBase: 1000, factor: 2,
    requires: [
      { type: 'building',  id: 'academy',    level: 4 },
      { type: 'research',  id: 'alchemy',    level: 8 },
      { type: 'research',  id: 'pyromancy',  level: 10 },
      { type: 'research',  id: 'runemastery', level: 5 },
    ],
  },

  // ── Combat ────────────────────────────────────────────────────────────────
  {
    id: 'swordsmanship',     // weapon_technology
    woodBase: 800, stoneBase: 200, grainBase: 0, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 4 }],
  },
  {
    id: 'armoury',           // shielding_technology
    woodBase: 200, stoneBase: 600, grainBase: 0, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 6 },
      { type: 'research',  id: 'alchemy', level: 3 },
    ],
  },
  {
    id: 'fortification',     // armour_technology
    woodBase: 1000, stoneBase: 0, grainBase: 0, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 2 }],
  },

  // ── Logistics / Mobility ──────────────────────────────────────────────────
  {
    id: 'horsemanship',      // combustion_drive
    woodBase: 400, stoneBase: 0, grainBase: 600, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 1 },
      { type: 'research',  id: 'alchemy', level: 1 },
    ],
  },
  {
    id: 'cartography',       // impulse_drive
    woodBase: 2000, stoneBase: 4000, grainBase: 600, factor: 2,
    requires: [
      { type: 'building',  id: 'academy', level: 2 },
      { type: 'research',  id: 'alchemy', level: 1 },
    ],
  },
  {
    id: 'tradeRoutes',       // hyperspace_drive
    woodBase: 10000, stoneBase: 20000, grainBase: 6000, factor: 2,
    requires: [
      { type: 'building',  id: 'academy',    level: 7 },
      { type: 'research',  id: 'mysticism',  level: 3 },
    ],
  },

  // ── Intelligence & Expansion ──────────────────────────────────────────────
  {
    id: 'spycraft',          // espionage_technology
    woodBase: 200, stoneBase: 1000, grainBase: 200, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 3 }],
  },
  {
    id: 'logistics',         // computer_technology
    woodBase: 0, stoneBase: 400, grainBase: 600, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 1 }],
  },
  {
    id: 'exploration',       // astrophysics — factor 1.75
    woodBase: 4000, stoneBase: 8000, grainBase: 4000, factor: 1.75,
    requires: [
      { type: 'building',  id: 'academy',     level: 3 },
      { type: 'research',  id: 'cartography', level: 3 },
      { type: 'research',  id: 'spycraft',    level: 4 },
    ],
  },
  {
    id: 'diplomaticNetwork', // intergalactic_research_network
    woodBase: 240000, stoneBase: 400000, grainBase: 160000, factor: 2,
    requires: [
      { type: 'building',  id: 'academy',   level: 10 },
      { type: 'research',  id: 'logistics', level: 8 },
      { type: 'research',  id: 'mysticism', level: 8 },
    ],
  },
  {
    id: 'divineBlessing',    // graviton_technology — requires academy 12 (very late game)
    woodBase: 0, stoneBase: 0, grainBase: 0, factor: 2,
    requires: [{ type: 'building', id: 'academy', level: 12 }],
  },
]

// ── Cost formula ──────────────────────────────────────────────────────────────

export function researchCost(def, level) {
  const f = Math.pow(def.factor, level)
  return {
    wood:  Math.floor(def.woodBase  * f),
    stone: Math.floor(def.stoneBase * f),
    grain: Math.floor(def.grainBase * f),
  }
}

// ── Time formula (PlanetService.getTechnologyResearchTime) ────────────────────
// time_hours = (wood + stone) / (1000 * (1 + academy) * speed)   min: 1s

export function researchTime(wood, stone, academyLevel, speed = 1) {
  const divisor = 1000 * (1 + academyLevel) * speed
  return Math.max(1, Math.round(((wood + stone) / divisor) * 3600))
}

// ── Requirements check ────────────────────────────────────────────────────────

export function requirementsMet(def, kingdom, research) {
  for (const req of def.requires) {
    const actual = req.type === 'building'
      ? (kingdom[req.id] ?? 0)
      : (research[req.id] ?? 0)
    if (actual < req.level) return false
  }
  return true
}
