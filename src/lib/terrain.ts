/** Human-readable temperature label for a slot's tempAvg (slot1=240°C, slot15=-110°C) */
export function tempLabel(tempAvg: number): string {
  if (tempAvg >= 160) return `${tempAvg}°C · Volcánico`
  if (tempAvg >= 80)  return `${tempAvg}°C · Cálido`
  if (tempAvg >= 20)  return `${tempAvg}°C · Templado`
  if (tempAvg >= -40) return `${tempAvg}°C · Frío`
  return `${tempAvg}°C · Glacial`
}

/** Human-readable terrain label and bonus description for a given slot. */
export function slotTerrainInfo(slot: number): { label: string; bonus: string | null; resource: 'wood' | 'stone' | null; factor: number } {
  if (slot === 1)  return { label: 'Volcánico',  bonus: '+40% piedra', resource: 'stone', factor: 1.40 }
  if (slot === 2)  return { label: 'Montañoso',  bonus: '+30% piedra', resource: 'stone', factor: 1.30 }
  if (slot === 3)  return { label: 'Rocoso',     bonus: '+20% piedra', resource: 'stone', factor: 1.20 }
  if (slot === 6)  return { label: 'Forestal',   bonus: '+17% madera', resource: 'wood',  factor: 1.17 }
  if (slot === 7)  return { label: 'Boscoso',    bonus: '+23% madera', resource: 'wood',  factor: 1.23 }
  if (slot === 8)  return { label: 'Exuberante', bonus: '+35% madera', resource: 'wood',  factor: 1.35 }
  if (slot === 9)  return { label: 'Boscoso',    bonus: '+23% madera', resource: 'wood',  factor: 1.23 }
  if (slot === 10) return { label: 'Forestal',   bonus: '+17% madera', resource: 'wood',  factor: 1.17 }
  if (slot >= 13)  return { label: 'Glacial',    bonus: null,          resource: null,    factor: 1    }
  if (slot >= 11)  return { label: 'Ártico',     bonus: null,          resource: null,    factor: 1    }
  return { label: 'Templado', bonus: null, resource: null, factor: 1 }
}
