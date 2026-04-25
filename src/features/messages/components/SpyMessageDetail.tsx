import { Eye, Swords, Shield } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Badge } from '@/components/ui/Badge'
import { ResourcePill } from './ResourcePill'
import { LossTable } from './LossTable'

interface CounterEspionage {
  outcome: 'victory' | 'defeat' | 'draw'
  rounds: number
  scoutsSent: number
  scoutsSurvived: number
  defenderLosses: Record<string, number>
}

const OUTCOME_LABELS: Record<string, { label: string; variant: 'gold' | 'crimson' | 'stone' }> = {
  victory: { label: 'Exploradores sobrevivieron', variant: 'gold' },
  defeat:  { label: 'Exploradores destruidos',    variant: 'crimson' },
  draw:    { label: 'Combate sin supervivientes', variant: 'stone' },
}

function CounterEspionagePanel({ ce }: { ce: CounterEspionage }) {
  const info = OUTCOME_LABELS[ce.outcome] ?? OUTCOME_LABELS.defeat
  const hasDefLosses = Object.values(ce.defenderLosses).some(n => n > 0)
  return (
    <div className="rounded border border-gold/20 bg-parchment-deep p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Swords size={13} className="text-gold shrink-0" />
        <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">Contraespionaje</span>
        <Badge variant={info.variant} className="ml-auto text-xs">{info.label}</Badge>
      </div>
      <p className="font-body text-xs text-ink-muted">
        Enviados: <strong>{ce.scoutsSent}</strong> · Sobrevivieron: <strong>{ce.scoutsSurvived}</strong> · Rondas: <strong>{ce.rounds}</strong>
      </p>
      {hasDefLosses && (
        <LossTable
          title="Bajas del defensor"
          losses={Object.fromEntries(Object.entries(ce.defenderLosses).filter(([, n]) => n > 0))}
        />
      )}
    </div>
  )
}

export function SpyMessageDetail({ data }: { data: Record<string, unknown> }) {
  const isDetection = (data.isDetection as boolean | undefined) || data.type === 'spy_detected'

  if (isDetection) {
    const ce = data.counterEspionage as CounterEspionage | undefined
    const scouts = data.scouts as number | undefined
    const hasDefLosses = ce && Object.values(ce.defenderLosses).some(n => n > 0)
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="crimson">
            <Eye size={10} className="mr-1" />
            Espía detectado
          </Badge>
          {ce && <Badge variant={OUTCOME_LABELS[ce.outcome]?.variant ?? 'stone'}>
            <Swords size={10} className="mr-1" />
            {ce.scoutsSurvived === 0 ? 'Todos destruidos' : `${ce.scoutsSurvived} sobrevivieron`}
          </Badge>}
        </div>
        {scouts != null && (
          <p className="font-body text-sm text-ink-muted">
            Detectaste <strong>{scouts}</strong> explorador{scouts !== 1 ? 'es' : ''} espiando tu reino.
          </p>
        )}
        {!ce && (
          <p className="font-body text-sm text-ink-muted">
            No tenías tropas disponibles para combatirlos.
          </p>
        )}
        {ce && (
          <div className="rounded border border-gold/20 bg-parchment-deep p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-gold shrink-0" />
              <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Resultado del combate · {ce.rounds} ronda{ce.rounds !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="font-body text-xs text-ink-muted">
              Sobrevivieron <strong>{ce.scoutsSurvived}</strong> de {ce.scoutsSent} exploradores.
            </p>
            {hasDefLosses && (
              <LossTable
                title="Tus bajas"
                losses={Object.fromEntries(Object.entries(ce.defenderLosses).filter(([, n]) => n > 0))}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  const targetName = data.targetName as string | undefined
  const detected = data.detected as boolean | undefined
  const scoutsLost = data.scoutsLost as boolean | undefined
  const resources = data.resources as { wood: number; stone: number; grain: number } | undefined
  const units = data.units as Record<string, number> | undefined
  const defenses = (data.defense ?? data.defenses) as Record<string, number> | undefined
  const buildings = data.buildings as Record<string, number> | undefined
  const researchData = data.researchData as Record<string, number> | undefined
  const ce = data.counterEspionage as CounterEspionage | undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Reino espiado: <strong>{targetName ?? '—'}</strong>
        </span>
        {detected && !scoutsLost && <Badge variant="crimson">Detectado</Badge>}
        {scoutsLost && <Badge variant="crimson">Exploradores perdidos</Badge>}
      </div>

      {ce && <CounterEspionagePanel ce={ce} />}

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
