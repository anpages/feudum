export interface TerrainInfo {
  label: string
  emoji: string
  bonus: string
  color: string
}

export const TERRAIN_INFO: Record<string, TerrainInfo> = {
  forest:   { label: 'Bosque',       emoji: '🌲', bonus: 'Madera +25%',  color: 'text-forest-light' },
  mountain: { label: 'Montaña',      emoji: '⛰️',  bonus: 'Piedra +25%',  color: 'text-ink-muted'    },
  plains:   { label: 'Llanura',      emoji: '🌾', bonus: 'Grano +25%',   color: 'text-gold'         },
  balanced: { label: 'Equilibrado',  emoji: '⚖️',  bonus: 'Todo +10%',    color: 'text-gold-dim'     },
}

export function terrainInfo(terrain: string | null | undefined): TerrainInfo {
  return TERRAIN_INFO[terrain ?? 'balanced'] ?? TERRAIN_INFO.balanced
}
