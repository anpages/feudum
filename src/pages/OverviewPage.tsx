import { type ReactNode } from 'react'
import { Users, Clock, TrendingUp } from 'lucide-react'
import {
  GiWoodPile, GiStoneBlock, GiWheat,
  GiAnvil, GiSpellBook, GiCrossedSwords,
} from 'react-icons/gi'
import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

export function OverviewPage() {
  const { data: kingdom, isLoading } = useKingdom()
  const resources = useResourceTicker(kingdom)

  if (isLoading) return <OverviewSkeleton />

  return (
    <div className="space-y-8">

      {/* ── Kingdom header ── */}
      <div className="anim-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="section-heading">Tu reino</span>
          <h1 className="page-title mt-0.5">
            {kingdom?.name ?? 'Mi Reino'}
          </h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">
            Reino {kingdom?.realm ?? '—'} · Región {kingdom?.region ?? '—'} · Posición {kingdom?.slot ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="stone">Puntos: 0</Badge>
          <Badge variant="gold">Rango: —</Badge>
        </div>
      </div>

      {/* ── Resource storage ── */}
      <section>
        <span className="section-heading anim-fade-up-1">Almacenes</span>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <ResourceCard icon={<GiWoodPile   size={18} />} label="Madera"     value={resources.wood}  cap={kingdom?.woodCapacity  ?? 5000} rate={kingdom?.woodProduction  ?? 0} animClass="anim-fade-up-1" />
          <ResourceCard icon={<GiStoneBlock size={18} />} label="Piedra"    value={resources.stone} cap={kingdom?.stoneCapacity ?? 5000} rate={kingdom?.stoneProduction ?? 0} animClass="anim-fade-up-2" />
          <ResourceCard icon={<GiWheat      size={18} />} label="Grano"     value={resources.grain} cap={kingdom?.grainCapacity ?? 5000} rate={kingdom?.grainProduction ?? 0} animClass="anim-fade-up-3" />
          <ResourceCard icon={<Users        size={17} />} label="Población" value={kingdom?.populationUsed ?? 0} cap={kingdom?.populationMax ?? 200} rate={0} animClass="anim-fade-up-4" />
        </div>
      </section>

      {/* ── Kingdom stats ── */}
      <section>
        <span className="section-heading anim-fade-up-2">Estado del Reino</span>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<GiAnvil        size={16} />} label="Edificios"       value="0" note="mejoras activas" animClass="anim-fade-up-2" />
          <StatCard icon={<GiSpellBook    size={16} />} label="Investigaciones" value="0" note="descubiertas"   animClass="anim-fade-up-3" />
          <StatCard icon={<GiCrossedSwords size={16} />} label="Tropas"         value="0" note="en campo"       animClass="anim-fade-up-4" />
        </div>
      </section>

      {/* ── Build queue ── */}
      <section>
        <span className="section-heading anim-fade-up-3">Cola de Construcción</span>
        <Card className="p-4 anim-fade-up-3">
          <div className="flex items-center gap-3 text-ink-muted/60">
            <Clock size={15} />
            <span className="font-body text-sm">No hay construcciones en curso</span>
          </div>
        </Card>
      </section>

    </div>
  )
}

function ResourceCard({ icon, label, value, cap, rate, animClass }: {
  icon: ReactNode; label: string; value: number; cap: number; rate: number; animClass: string
}) {
  const isFull = value >= cap
  return (
    <Card className={`p-4 ${animClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
          <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </span>
        </div>
        {isFull && <Badge variant="crimson">Lleno</Badge>}
      </div>

      <p className={`font-ui text-xl tabular-nums font-semibold ${isFull ? 'text-crimson' : 'text-ink'}`}>
        {formatResource(value)}
      </p>
      <p className="text-xs text-ink-muted/60 tabular-nums mb-3">
        / {formatResource(cap)}
      </p>

      <ProgressBar value={value} max={cap} />

      {rate > 0 && (
        <p className="mt-2 flex items-center gap-1 text-forest-light text-xs">
          <TrendingUp size={9} />
          <span className="tabular-nums">+{formatResource(rate)}/h</span>
        </p>
      )}
    </Card>
  )
}

function StatCard({ icon, label, value, note, animClass }: {
  icon: ReactNode; label: string; value: string; note: string; animClass: string
}) {
  return (
    <Card className={`p-4 flex items-center gap-3 ${animClass}`}>
      <span className="text-gold/60 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-ui text-xl font-semibold text-ink leading-none">{value}</p>
        <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mt-0.5 truncate">{label}</p>
        <p className="font-body text-xs text-ink-muted/60 mt-0.5">{note}</p>
      </div>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-14" />
        <div className="skeleton h-8 w-52" />
        <div className="skeleton h-3 w-36" />
      </div>
      <div>
        <div className="skeleton h-2.5 w-16 mb-4" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-4 w-10" />
              </div>
              <div className="skeleton h-6 w-24" />
              <div className="skeleton h-3 w-16" />
              <div className="progress-track"><div className="progress-fill w-0" /></div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
