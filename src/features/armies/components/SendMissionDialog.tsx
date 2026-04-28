import { Sheet } from '@/components/ui/Sheet'
import { SendMissionPage } from '@/features/armies/SendMissionPage'
import type { MissionType } from '@/features/armies/useArmies'

/**
 * Modal de envío de misión. Reutiliza el componente SendMissionPage en modo
 * embebido (sin header propio, onSuccess cierra el modal en vez de navegar).
 *
 * Se monta desde el mapa cuando el jugador clickea un CTA en SlotDetail.
 * El target queda prefijado por el slot clickeado; el tipo de misión depende
 * del CTA elegido. El componente se desmonta al cerrar para resetear el estado.
 */
export function SendMissionDialog({
  open,
  onClose,
  target,
  missionType,
}: {
  open: boolean
  onClose: () => void
  target: { realm: number; region: number; slot: number } | null
  missionType: MissionType
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Enviar misión" maxWidth="max-w-2xl">
      {/* key fuerza el remount al cambiar target/type — limpia estado del form */}
      {target && (
        <SendMissionPage
          key={`${target.realm}:${target.region}:${target.slot}:${missionType}`}
          initTarget={target}
          initType={missionType}
          onClose={onClose}
        />
      )}
    </Sheet>
  )
}
