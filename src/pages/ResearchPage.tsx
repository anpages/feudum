import { useState, useEffect, useCallback } from 'react'
import { ArrowUp, Clock, Loader2 } from 'lucide-react'
import { GiCauldron, GiCrossedSwords, GiCompass, GiScrollQuill, GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useResearch, useUpgradeResearch, type ResearchInfo } from '@/hooks/useResearch'
import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource, formatDuration } from '@/lib/format'
import { RequirementsList } from '@/components/ui/RequirementsList'

// ── Static metadata ───────────────────────────────────────────────────────────

const RESEARCH_META: Record<string, { name: string; description: string; category: string }> = {
  alchemy:           { category: 'Ciencia',      name: 'Alquimia',           description: 'Dominio de las energías primordiales. Desbloquea toda la rama mística.' },
  pyromancy:         { category: 'Ciencia',      name: 'Piromagia',           description: 'Control del fuego para armas y defensas. Requiere Alquimia 2.' },
  runemastery:       { category: 'Ciencia',      name: 'Maestría Rúnica',     description: 'Inscripciones de poder en armaduras y muros. Requiere Piromagia 5.' },
  mysticism:         { category: 'Ciencia',      name: 'Misticismo',          description: 'Conocimiento del espacio entre mundos. Requiere Alquimia 5.' },
  dragonlore:        { category: 'Ciencia',      name: 'Lore de Dragones',    description: 'Los secretos más oscuros de las criaturas antiguas.' },
  swordsmanship:     { category: 'Combate',      name: 'Espadachín',          description: 'Técnicas de combate que aumentan el ataque de todas las unidades.' },
  armoury:           { category: 'Combate',      name: 'Armería',             description: 'Escudos y blindajes que reducen el daño recibido en batalla.' },
  fortification:     { category: 'Combate',      name: 'Fortificación',       description: 'Integridad estructural mejorada para todas las defensas.' },
  horsemanship:      { category: 'Logística',    name: 'Equitación',          description: 'Caballos más rápidos y resistentes para tus ejércitos.' },
  cartography:       { category: 'Logística',    name: 'Cartografía',         description: 'Mapas más precisos que aumentan la velocidad de desplazamiento.' },
  tradeRoutes:       { category: 'Logística',    name: 'Rutas Comerciales',   description: 'Redes de comercio que permiten el hiperdesplazamiento de flotas.' },
  spycraft:          { category: 'Inteligencia', name: 'Espionaje',           description: 'Arte de infiltrarse en reinos enemigos sin ser detectado.' },
  logistics:         { category: 'Inteligencia', name: 'Logística',           description: 'Gestión de flotas que aumenta el número máximo de misiones.' },
  exploration:       { category: 'Inteligencia', name: 'Exploración',         description: 'Permite colonizar nuevos territorios y fundar reinos adicionales.' },
  diplomaticNetwork: { category: 'Inteligencia', name: 'Red Diplomática',     description: 'Conecta Academias de todo el reino para acelerar investigaciones.' },
  divineBlessing:    { category: 'Inteligencia', name: 'Bendición Divina',    description: 'Favor de los dioses. La investigación definitiva.' },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Ciencia':      <GiCauldron      size={14} />,
  'Combate':      <GiCrossedSwords size={14} />,
  'Logística':    <GiCompass       size={14} />,
  'Inteligencia': <GiScrollQuill   size={14} />,
}

const CATEGORIES = ['Ciencia', 'Combate', 'Logística', 'Inteligencia']

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(finishesAt: number | null, onEnd: () => void) {
  const [secs, setSecs] = useState(() =>
    finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishesAt) { setSecs(0); return }
    let fired = false
    const tick = () => {
      const rem = Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
      setSecs(rem)
      if (rem === 0 && !fired) { fired = true; onEnd() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishesAt, onEnd])
  return secs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ResearchPage() {
  const qc                            = useQueryClient()
  const { data, isLoading, refetch }  = useResearch()
  const { data: kingdom }             = useKingdom()
  const resources                     = useResourceTicker(kingdom)
  const upgrade                       = useUpgradeResearch()

  const handleCountdownEnd = useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, qc])

  if (isLoading) return <ResearchSkeleton />

  const items      = data?.research ?? []
  const hasInQueue = items.some(r => r.inQueue && r.inQueue.finishesAt > Math.floor(Date.now() / 1000))

  return (
    <div className="space-y-8">

      <div className="anim-fade-up">
        <span className="section-heading">Conocimiento</span>
        <h1 className="page-title mt-0.5">Academia</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Investiga tecnologías para desbloquear unidades, mejoras y ventajas estratégicas.
          {hasInQueue && (
            <span className="ml-2 text-gold font-ui text-xs font-semibold uppercase tracking-wide">
              · Investigación en curso
            </span>
          )}
        </p>
      </div>

      {CATEGORIES.map(cat => {
        const catItems = items.filter(r => RESEARCH_META[r.id]?.category === cat)
        if (!catItems.length) return null
        return (
          <section key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gold">{CATEGORY_ICONS[cat]}</span>
              <span className="section-heading mb-0">{cat}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {catItems.map((r, i) => {
                const meta      = RESEARCH_META[r.id]
                const canAfford = resources.wood  >= r.costWood
                               && resources.stone >= r.costStone
                               && resources.grain >= r.costGrain
                const researchLevels = Object.fromEntries(items.map(x => [x.id, x.level]))
                return (
                  <ResearchCard
                    key={r.id}
                    item={r}
                    meta={meta}
                    kingdom={kingdom}
                    researchLevels={researchLevels}
                    canAfford={canAfford}
                    globalQueueFull={hasInQueue && !r.inQueue}
                    isUpgrading={upgrade.isPending && upgrade.variables === r.id}
                    onUpgrade={() => upgrade.mutate(r.id)}
                    onCountdownEnd={handleCountdownEnd}
                    animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
                  />
                )
              })}
            </div>
          </section>
        )
      })}

    </div>
  )
}

// ── Research card ─────────────────────────────────────────────────────────────

interface CardProps {
  item: ResearchInfo
  meta: { name: string; description: string; category: string }
  kingdom?: Record<string, unknown> | null
  researchLevels?: Record<string, number>
  canAfford: boolean
  globalQueueFull: boolean
  isUpgrading: boolean
  onUpgrade: () => void
  onCountdownEnd: () => void
  animClass: string
}

function ResearchCard({ item, meta, kingdom, researchLevels, canAfford, globalQueueFull, isUpgrading, onUpgrade, onCountdownEnd, animClass }: CardProps) {
  const countdown = useCountdown(item.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!item.inQueue && item.inQueue.finishesAt > Math.floor(Date.now() / 1000)

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-ui text-sm font-semibold text-ink">{meta.name}</h3>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
        </div>
        <Badge variant={item.level > 0 ? 'gold' : 'stone'} className="shrink-0">
          Nv {inQueue ? `${item.level}→${item.inQueue!.level}` : item.level}
        </Badge>
      </div>

      <div className="divider">◆</div>

      <div className="flex items-center gap-3 text-xs flex-wrap">
        {item.costWood  > 0 && <CostItem icon={<GiWoodPile  size={13} />} value={item.costWood}  affordable={inQueue || canAfford} />}
        {item.costStone > 0 && <CostItem icon={<GiStoneBlock size={13} />} value={item.costStone} affordable={inQueue || canAfford} />}
        {item.costGrain > 0 && <CostItem icon={<GiWheat     size={13} />} value={item.costGrain} affordable={inQueue || canAfford} />}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(item.timeSeconds)}</span>
        </div>
      </div>

      {inQueue ? (
        <div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
          <Loader2 size={12} className="animate-spin" />
          {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
        </div>
      ) : !item.requiresMet ? (
        <div className="mt-auto">
          <RequirementsList
            requires={item.requires}
            kingdom={kingdom}
            research={researchLevels}
          />
        </div>
      ) : globalQueueFull ? (
        <Button variant="ghost" className="w-full mt-auto" disabled>
          <Clock size={11} />
          Cola ocupada
        </Button>
      ) : (
        <Button
          variant="primary"
          className="w-full mt-auto"
          disabled={!canAfford || isUpgrading}
          onClick={onUpgrade}
        >
          {isUpgrading ? <Loader2 size={11} className="animate-spin" /> : <ArrowUp size={11} />}
          {canAfford ? `Investigar Nv ${item.level + 1}` : 'Recursos insuficientes'}
        </Button>
      )}

    </Card>
  )
}

function CostItem({ icon, value, affordable }: { icon: ReactNode; value: number; affordable: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-muted/70">{icon}</span>
      <span className={`font-ui tabular-nums ${affordable ? 'text-ink-mid' : 'text-crimson'}`}>
        {formatResource(value)}
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ResearchSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-36" />
        <div className="skeleton h-3 w-64" />
      </div>
      {[1, 2].map(i => (
        <div key={i}>
          <div className="skeleton h-2.5 w-24 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, j) => (
              <Card key={j} className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton h-2.5 w-full" />
                </div>
                <div className="skeleton h-8 w-full rounded" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
