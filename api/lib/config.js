// Server configuration — override via environment variables
export const ECONOMY_SPEED = parseFloat(process.env.ECONOMY_SPEED ?? '1')

export const UNIVERSE = {
  maxRealm:  parseInt(process.env.UNIVERSE_REALMS  ?? '3',  10),
  maxRegion: parseInt(process.env.UNIVERSE_REGIONS ?? '10', 10),
  maxSlot:   parseInt(process.env.UNIVERSE_SLOTS   ?? '15', 10),
}
