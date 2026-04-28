/**
 * Reglas de colonización por adyacencia territorial.
 *
 * Filosofía: Feudum es un juego de conquista territorial. Las colonias se
 * extienden orgánicamente desde la capital del jugador, formando un imperio
 * contiguo en el mapa. No hay "saltos largos" sin haber expandido antes.
 *
 * Reglas (consensuadas con el diseño del juego):
 *   1. Mismo realm, intra-region: cualquier slot vacío de una región donde el
 *      jugador ya tiene ≥1 colonia es libre.
 *   2. Mismo realm, inter-region: solo regiones adyacentes (±1) a una donde
 *      ya tienes colonia.
 *   3. Inter-realm: solo desde un slot 1-2 o 14-15 ("puerto") de cualquiera
 *      de tus colonias, hacia un slot 1-2 o 14-15 del realm vecino.
 *   4. Capital inviolable: las kingdoms con isPrimary=true no pueden ser
 *      conquistadas (cuando ese sistema exista). No relevante para colonizar
 *      slots vacíos pero es información clave del modelo.
 *
 * Si todas las opciones están saturadas, el jugador queda "encajonado" y
 * tiene que esperar a la fase de conquista (futura) para abrir frente.
 */

// Slots considerados "puerto" — desde aquí se cruza a otros realms
const PORT_SLOTS = new Set([1, 2, 14, 15])

/**
 * @param {Array<{realm:number,region:number,slot:number}>} userKingdoms — colonias del jugador
 * @param {{realm:number,region:number,slot:number}} target — slot destino
 * @returns {{ ok: boolean, reason?: string }} — ok=true si el destino es alcanzable
 */
export function canColonize(userKingdoms, target) {
  if (userKingdoms.length === 0) {
    return { ok: false, reason: 'No tienes colonias desde donde expandir' }
  }

  const sameRealmKingdoms = userKingdoms.filter(k => k.realm === target.realm)

  // Caso 1: mismo realm
  if (sameRealmKingdoms.length > 0) {
    // Adyacencia regional ±1 (o misma región)
    const adjacent = sameRealmKingdoms.some(k =>
      Math.abs(k.region - target.region) <= 1
    )
    if (adjacent) return { ok: true }
    return {
      ok: false,
      reason: `Necesitas una colonia en una región adyacente (${target.region - 1}–${target.region + 1}) del realm ${target.realm}`,
    }
  }

  // Caso 2: inter-realm — el destino es un realm donde aún no tienes colonias
  // Requiere que al menos un realm adyacente al destino tenga una colonia tuya
  // EN UN SLOT DE PUERTO (1-2 o 14-15), Y que el slot destino TAMBIÉN sea puerto.
  const targetIsPort = PORT_SLOTS.has(target.slot)
  if (!targetIsPort) {
    return {
      ok: false,
      reason: `Para cruzar a otro realm el destino debe ser un slot de borde (1-2 o 14-15)`,
    }
  }

  const adjacentRealmKingdoms = userKingdoms.filter(k =>
    Math.abs(k.realm - target.realm) === 1
  )
  if (adjacentRealmKingdoms.length === 0) {
    return {
      ok: false,
      reason: `Solo puedes cruzar a realms adyacentes al tuyo`,
    }
  }

  const hasPortInAdjacentRealm = adjacentRealmKingdoms.some(k => PORT_SLOTS.has(k.slot))
  if (!hasPortInAdjacentRealm) {
    return {
      ok: false,
      reason: `Necesitas una colonia en un slot de borde (1-2 o 14-15) del realm ${target.realm + 1} o ${target.realm - 1} para cruzar`,
    }
  }

  return { ok: true }
}

export { PORT_SLOTS }
