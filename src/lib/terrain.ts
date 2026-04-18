/** Human-readable temperature label for a slot's tempAvg (slot1=240°C, slot15=-110°C) */
export function tempLabel(tempAvg: number): string {
  if (tempAvg >= 160) return `${tempAvg}°C · Volcánico`
  if (tempAvg >= 80)  return `${tempAvg}°C · Cálido`
  if (tempAvg >= 20)  return `${tempAvg}°C · Templado`
  if (tempAvg >= -40) return `${tempAvg}°C · Frío`
  return `${tempAvg}°C · Glacial`
}
