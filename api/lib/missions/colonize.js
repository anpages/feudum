import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, pointsOfInterest, poiDiscoveries, messages } from '../../_db.js'
import { POI_TYPES } from '../poi.js'

export async function processColonize(mission, myKingdom, now, targetKingdom) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  // Build a new units object without the colonist (consumed on arrival)
  const missionUnits = mission.units ?? {}
  const returningUnits = { ...missionUnits, colonist: 0 }

  if (!targetKingdom) {
    const kingdomName = `Colonia ${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`
    // Nuevas colonias son siempre secundarias — la capital es la primera kingdom del user.
    const [newKingdom] = await db.insert(kingdoms).values({
      userId:    myKingdom.userId,
      name:      kingdomName,
      realm:     mission.targetRealm,
      region:    mission.targetRegion,
      slot:      mission.targetSlot,
      isPrimary: false,
      wood: 500, stone: 500, grain: 500,
      woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
      lastResourceUpdate: now,
    }).returning({ id: kingdoms.id })

    // Si hay un POI activo en este slot (magnitud > 0), reclamarlo para esta colonia.
    // El bonus permanente se aplica en los cálculos de producción/research/combate
    // mientras claimedByKingdomId apunte a esta colonia.
    const [poi] = await db.select().from(pointsOfInterest).where(and(
      eq(pointsOfInterest.realm,  mission.targetRealm),
      eq(pointsOfInterest.region, mission.targetRegion),
      eq(pointsOfInterest.slot,   mission.targetSlot),
    )).limit(1)

    let claimedPoi = null
    if (poi && poi.magnitude > 0 && !poi.claimedByKingdomId) {
      await db.update(pointsOfInterest).set({
        claimedByKingdomId: newKingdom.id,
        claimedAt:          new Date(),
      }).where(and(
        eq(pointsOfInterest.realm,  mission.targetRealm),
        eq(pointsOfInterest.region, mission.targetRegion),
        eq(pointsOfInterest.slot,   mission.targetSlot),
      ))
      // Insertar discovery row para que el dueño vea su propio POI en el mapa
      // (visibilidad privada: si no descubrió antes vía expedición, no lo veía)
      await db.insert(poiDiscoveries).values({
        poiRealm:  mission.targetRealm,
        poiRegion: mission.targetRegion,
        poiSlot:   mission.targetSlot,
        userId:    myKingdom.userId,
      }).onConflictDoNothing()
      claimedPoi = { type: poi.type, label: POI_TYPES[poi.type]?.label }

      // Mensaje específico al jugador sobre el bonus permanente conseguido
      await db.insert(messages).values({
        userId: myKingdom.userId,
        type:   'expedition',
        subject: `🏆 ${POI_TYPES[poi.type]?.label ?? 'POI'} reclamado en tu nueva colonia`,
        data: {
          type: 'poi_claimed',
          poi: poi.type,
          coord: { realm: mission.targetRealm, region: mission.targetRegion, slot: mission.targetSlot },
          permanent: POI_TYPES[poi.type]?.permanent ?? null,
        },
      })
    }

    await db.update(armyMissions).set({
      units: returningUnits,
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'colonize', success: true, name: kingdomName, claimedPoi }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  } else {
    // Slot occupied — colonist is still consumed, other units return
    await db.update(armyMissions).set({
      units: returningUnits,
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'colonize', success: false, reason: 'Posición ya ocupada' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  }
}
