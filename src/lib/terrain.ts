/**
 * Converts the internal OGame-scale tempAvg (~[-150, 240]) to a realistic
 * medieval display temperature (~[-45, 55]°C). The formula and DB values
 * are unchanged — only the displayed number is remapped.
 */
function toDisplayTemp(rawTempAvg: number): number {
  return Math.round(55 + (rawTempAvg - 240) * (100 / 390))
}

/** Human-readable temperature label for a slot's internal tempAvg. */
export function tempLabel(tempAvg: number): string {
  const t = toDisplayTemp(tempAvg)
  if (t >= 35) return `${t}°C · Volcánico`
  if (t >= 14) return `${t}°C · Cálido`
  if (t >= 0)  return `${t}°C · Templado`
  if (t >= -15) return `${t}°C · Frío`
  return `${t}°C · Glacial`
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
