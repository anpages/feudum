import { Eye } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Badge } from '@/components/ui/Badge'
import { ResourcePill } from './ResourcePill'
import { LossTable } from './LossTable'

export function SpyMessageDetail({ data }: { data: Record<string, unknown> }) {
  const isDetection = data.isDetection as boolean | undefined

  if (isDetection) {
    return (
      <div className="space-y-3">
        <Badge variant="crimson">
          <Eye size={10} className="mr-1" />
          Espía detectado
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Se ha detectado un intento de espionaje en tu reino.
        </p>
      </div>
    )
  }

  const targetName = data.targetName as string | undefined
  const detected = data.detected as boolean | undefined
  const resources = data.resources as { wood: number; stone: number; grain: number } | undefined
  const units = data.units as Record<string, number> | undefined
  const defenses = (data.defense ?? data.defenses) as Record<string, number> | undefined
  const buildings = data.buildings as Record<string, number> | undefined
  const researchData = data.researchData as Record<string, number> | undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Reino espiado: <strong>{targetName ?? '—'}</strong>
        </span>
        {detected && <Badge variant="crimson">Detectado</Badge>}
      </div>

      {resources && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Recursos</p>
          <div className="flex gap-4 flex-wrap">
            <ResourcePill icon={<GiWoodPile size={13} />} value={resources.wood} label="Madera" />
            <ResourcePill icon={<GiStoneBlock size={13} />} value={resources.stone} label="Piedra" />
            <ResourcePill icon={<GiWheat size={13} />} value={resources.grain} label="Grano" />
          </div>
        </div>
      )}

      {units && Object.keys(units).length > 0 && <LossTable title="Tropas" losses={units} />}
      {defenses && Object.keys(defenses).length > 0 && <LossTable title="Defensas" losses={defenses} />}
      {buildings && Object.keys(buildings).length > 0 && <LossTable title="Edificios" losses={buildings} />}
      {researchData && Object.keys(researchData).length > 0 && <LossTable title="Investigaciones" losses={researchData} />}
    </div>
  )
}
