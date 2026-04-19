// Server configuration — override via environment variables
export const ECONOMY_SPEED = parseFloat(process.env.ECONOMY_SPEED ?? '1')

export const UNIVERSE = {
  maxRealm:  parseInt(process.env.UNIVERSE_REALMS  ?? '3',  10),
  maxRegion: parseInt(process.env.UNIVERSE_REGIONS ?? '10', 10),
  maxSlot:   parseInt(process.env.UNIVERSE_SLOTS   ?? '15', 10),
}

// NPC aggression: 0=off, 1=low (24h), 2=medium (12h), 3=high (6h)
export const NPC_AGGRESSION = parseInt(process.env.NPC_AGGRESSION ?? '1', 10)
export const NPC_ATTACK_INTERVAL_HOURS = [Infinity, 24, 12, 6][NPC_AGGRESSION] ?? 24

// Fraction of universe slots filled with NPCs at season start (0.0–1.0)
export const NPC_DENSITY = parseFloat(process.env.NPC_DENSITY ?? '0.5')
