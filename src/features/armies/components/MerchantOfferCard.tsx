import { Clock, Loader2 } from 'lucide-react'
import { GiTrade, GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useMerchantRespond } from '@/features/armies/useArmies'
import { formatResource, formatDuration } from '@/lib/format'
import { useCountdown } from '../hooks/useCountdown'
import type { ArmyMission } from '@/shared/types'

function ResourceLine({ label, res }: { label: string; res: Partial<Record<string, number>> }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-ui text-xs text-ink-muted w-12 shrink-0">{label}</span>
      {(res.wood  ?? 0) > 0 && <span className="flex items-center gap-1 font-ui text-xs font-semibold text-ink"><GiWoodPile size={11} className="text-gold" />{formatResource(res.wood!)}</span>}
      {(res.stone ?? 0) > 0 && <span className="flex items-center gap-1 font-ui text-xs font-semibold text-ink"><GiStoneBlock size={11} className="text-gold" />{formatResource(res.stone!)}</span>}
      {(res.grain ?? 0) > 0 && <span className="font-ui text-xs font-semibold text-ink">🌾 {formatResource(res.grain!)}</span>}
    </div>
  )
}

export function MerchantOfferCard({ mission, onEnd }: { mission: ArmyMission; onEnd: () => void }) {
  const respond = useMerchantRespond()
  const offer   = mission.result!.merchantOffer!
  const secs    = useCountdown(offer.expiresAt, onEnd)

  return (
    <Card className="p-4 space-y-3 border-gold/30 bg-gold/5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full border border-gold/30 bg-gold/10 flex items-center justify-center shrink-0">
          <GiTrade size={14} className="text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ui text-sm font-semibold text-ink">Mercader Errante</span>
            <Badge variant="gold">Oferta pendiente</Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-0.5">
            Un mercader encontrado en las Tierras Ignotas propone un intercambio.
          </p>
        </div>
        <div className="flex items-center gap-1 text-ink-muted/60 shrink-0">
          <Clock size={10} />
          <span className="font-ui text-[0.6rem] tabular-nums">{formatDuration(secs)}</span>
        </div>
      </div>

      <div className="bg-parchment/40 rounded-lg p-3 space-y-2">
        <ResourceLine label="Das" res={offer.give} />
        <div className="border-t border-gold/10 pt-2">
          <ResourceLine label="Recibes" res={offer.receive} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => respond.mutate({ missionId: mission.id, accept: true })}
          disabled={respond.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 btn btn-primary py-2 text-xs"
        >
          {respond.isPending ? <Loader2 size={11} className="animate-spin" /> : <GiTrade size={11} />}
          Aceptar intercambio
        </button>
        <button
          onClick={() => respond.mutate({ missionId: mission.id, accept: false })}
          disabled={respond.isPending}
          className="flex items-center justify-center gap-1.5 btn btn-ghost py-2 px-3 text-xs text-ink-muted"
        >
          Rechazar
        </button>
      </div>
    </Card>
  )
}
