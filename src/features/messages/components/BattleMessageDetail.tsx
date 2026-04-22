import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Badge } from '@/components/ui/Badge'
import { ResourcePill } from './ResourcePill'
import { LossTable } from './LossTable'
import { MissileMessageDetail } from './MissileMessageDetail'

export function BattleMessageDetail({ data }: { data: Record<string, unknown> }) {
  if (data.type === 'missile') return <MissileMessageDetail data={data} />

  const outcome = data.outcome as string | undefined
  const rounds = data.rounds as number | undefined
  const loot = data.loot as { wood: number; stone: number; grain: number } | undefined
  const debris = data.debris as { wood: number; stone: number } | undefined
  const lostAtk = data.lostAtk as Record<string, number> | undefined
  const lostDef = data.lostDef as Record<string, number> | undefined
  const role = data.role as string | undefined

  const isVictory = outcome === 'victory'
  const isDraw    = outcome === 'draw'
  const outcomeLabel =
    role === 'defender'
      ? isVictory ? 'Rechazado' : isDraw ? 'Empate' : 'Derrotado'
      : isVictory ? 'Victoria'  : isDraw ? 'Empate' : 'Derrota'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={isVictory ? 'forest' : isDraw ? 'stone' : 'crimson'}>{outcomeLabel}</Badge>
        {rounds !== undefined && (
          <span className="font-body text-xs text-ink-muted/60">{rounds} rondas de combate</span>
        )}
      </div>

      {loot && (loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {role === 'defender' ? 'Recursos robados' : 'Botín capturado'}
          </p>
          <div className="flex gap-4 flex-wrap">
            <ResourcePill icon={<GiWoodPile size={13} />} value={loot.wood} label="Madera" />
            <ResourcePill icon={<GiStoneBlock size={13} />} value={loot.stone} label="Piedra" />
            <ResourcePill icon={<GiWheat size={13} />} value={loot.grain} label="Grano" />
          </div>
        </div>
      )}

      {debris && (debris.wood > 0 || debris.stone > 0) && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            Campo de escombros
          </p>
          <div className="flex gap-4 flex-wrap">
            {debris.wood > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={debris.wood} label="Madera" />}
            {debris.stone > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={debris.stone} label="Piedra" />}
          </div>
        </div>
      )}

      {lostAtk && Object.keys(lostAtk).length > 0 && <LossTable title="Bajas atacante" losses={lostAtk} />}
      {lostDef && Object.keys(lostDef).length > 0 && <LossTable title="Bajas defensor" losses={lostDef} />}
    </div>
  )
}
