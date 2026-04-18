import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Sword, Shield, Heart, Clock, Loader2, Plus, Minus } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLightFighter, GiHeavyFighter, GiMountedKnight, GiKnightBanner,
  GiCrossedSwords, GiSiegeTower, GiBattleMech, GiDragonHead,
  GiTrade, GiCaravan, GiCampingTent, GiVulture, GiSpyglass,
  GiArcher, GiCrossbow, GiBallista, GiTrebuchet,
  GiCrystalBall, GiLuciferCannon, GiPalisade, GiDefensiveWall,
  GiWoodPile, GiStoneBlock, GiWheat,
} from 'react-icons/gi'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useBarracks, useTrainUnit, type UnitInfo } from '@/hooks/useBarracks'
import { useKingdom } from '@/hooks/useKingdom'
import { useResearch, type ResearchInfo } from '@/hooks/useResearch'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource, formatDuration } from '@/lib/format'
import { RequirementsList } from '@/components/ui/RequirementsList'

// ── Static metadata ───────────────────────────────────────────────────────────

const UNIT_META: Record<string, { name: string; Icon: IconType; description: string }> = {
  squire:       { Icon: GiLightFighter,  name: 'Escudero',              description: 'Infantería ligera, rápida y económica.' },
  knight:       { Icon: GiHeavyFighter,  name: 'Caballero',             description: 'Combatiente pesado con armadura reforzada.' },
  paladin:      { Icon: GiMountedKnight, name: 'Paladín',               description: 'Caballería de élite, equilibrio entre velocidad y potencia.' },
  warlord:      { Icon: GiKnightBanner,  name: 'Señor de la Guerra',    description: 'Comandante de la batalla. Destrucción masiva.' },
  grandKnight:  { Icon: GiCrossedSwords, name: 'Gran Caballero',        description: 'Interceptor de alta tecnología.' },
  siegeMaster:  { Icon: GiSiegeTower,    name: 'Maestro de Asedio',     description: 'Especialista en destruir defensas.' },
  warMachine:   { Icon: GiBattleMech,    name: 'Máquina de Guerra',     description: 'El destructor más poderoso.' },
  dragonKnight: { Icon: GiDragonHead,    name: 'Caballero Dragón',      description: 'La unidad definitiva. Capaz de destruir reinos.' },
  merchant:     { Icon: GiTrade,         name: 'Mercader',              description: 'Transporte ligero de recursos.' },
  caravan:      { Icon: GiCaravan,       name: 'Caravana',              description: 'Transporte pesado de alta capacidad.' },
  colonist:     { Icon: GiCampingTent,   name: 'Colonista',             description: 'Funda nuevos reinos en territorios vacíos.' },
  scavenger:    { Icon: GiVulture,       name: 'Carroñero',             description: 'Recoge los escombros de batallas.' },
  scout:        { Icon: GiSpyglass,      name: 'Explorador',            description: 'Espía reinos enemigos sin ser detectado.' },
  archer:       { Icon: GiArcher,        name: 'Arquero',               description: 'Defensa básica de bajo coste.' },
  crossbowman:  { Icon: GiCrossbow,      name: 'Ballestero',            description: 'Defensa de rango medio con mayor precisión.' },
  ballista:     { Icon: GiBallista,      name: 'Ballista',              description: 'Defensa pesada de largo alcance.' },
  trebuchet:    { Icon: GiTrebuchet,     name: 'Trebuchet',             description: 'Cañón de alta potencia de fuego.' },
  mageTower:    { Icon: GiCrystalBall,   name: 'Torre Mágica',          description: 'Defensa energética con alto escudo.' },
  dragonCannon: { Icon: GiLuciferCannon, name: 'Cañón de Dragón',      description: 'La defensa más devastadora.' },
  palisade:     { Icon: GiPalisade,      name: 'Empalizada',            description: 'Cúpula de escudo pequeña.' },
  castleWall:   { Icon: GiDefensiveWall, name: 'Muralla del Castillo',  description: 'Cúpula de escudo grande.' },
}

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

type Tab = 'units' | 'support' | 'defenses'

export function BarracksPage() {
  const [tab, setTab]               = useState<Tab>('units')
  const qc                          = useQueryClient()
  const { data, isLoading, refetch} = useBarracks()
  const { data: kingdom }           = useKingdom()
  const { data: researchData }      = useResearch()
  const resources                   = useResourceTicker(kingdom)
  const train                       = useTrainUnit()

  const handleCountdownEnd = useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, qc])

  if (isLoading) return <BarracksSkeleton />

  const TAB_ITEMS: Record<Tab, UnitInfo[]> = {
    units:    data?.units    ?? [],
    support:  data?.support  ?? [],
    defenses: data?.defenses ?? [],
  }

  return (
    <div className="space-y-6">

      <div className="anim-fade-up">
        <span className="section-heading">Ejército</span>
        <h1 className="page-title mt-0.5">Cuartel</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Entrena unidades de combate, apoyo y defensas para proteger y expandir tu reino.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-parchment-warm rounded-md w-fit anim-fade-up-1">
        {(['units', 'support', 'defenses'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-xs font-ui font-semibold uppercase tracking-wide transition-all ${
              tab === t
                ? 'bg-white text-gold shadow-sm border border-gold/15'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t === 'units' ? 'Combate' : t === 'support' ? 'Apoyo' : 'Defensas'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {TAB_ITEMS[tab].map((u, i) => {
          const meta = UNIT_META[u.id]
          if (!meta) return null
          return (
            <UnitCard
              key={u.id}
              unit={u}
              meta={meta}
              resources={resources}
              kingdom={kingdom}
              research={researchData?.research}
              isTraining={train.isPending && train.variables?.unit === u.id}
              onTrain={(amount) => train.mutate({ unit: u.id, amount })}
              onCountdownEnd={handleCountdownEnd}
              animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
            />
          )
        })}
      </div>

    </div>
  )
}

// ── Unit card ─────────────────────────────────────────────────────────────────

function UnitCard({
  unit, meta, resources, kingdom, research, isTraining, onTrain, onCountdownEnd, animClass,
}: {
  unit: UnitInfo
  meta: { name: string; Icon: IconType; description: string }
  resources: { wood: number; stone: number; grain: number }
  kingdom?: Record<string, unknown> | null
  research?: ResearchInfo[] | null
  isTraining: boolean
  onTrain: (amount: number) => void
  onCountdownEnd: () => void
  animClass: string
}) {
  const [amount, setAmount] = useState(1)
  const countdown = useCountdown(unit.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!unit.inQueue && unit.inQueue.finishesAt > Math.floor(Date.now() / 1000)

  const totalWood  = unit.woodBase  * amount
  const totalStone = unit.stoneBase * amount
  const totalGrain = unit.grainBase * amount
  const canAfford  = resources.wood  >= totalWood
                  && resources.stone >= totalStone
                  && resources.grain >= totalGrain
  const totalTime  = unit.timePerUnit * amount

  const changeAmount = (delta: number) =>
    setAmount(a => Math.max(1, Math.min(a + delta, 9999)))

  const { Icon } = meta

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={20} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink">{meta.name}</h3>
            <Badge variant={unit.count > 0 ? 'gold' : 'stone'} className="shrink-0">
              {unit.count.toLocaleString()}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
        </div>
      </div>

      {/* Stats */}
      {(unit.attack > 0 || unit.shield > 0 || unit.hull > 0) && (
        <div className="flex items-center gap-3 text-xs">
          {unit.attack > 0 && (
            <div className="flex items-center gap-1 text-crimson">
              <Sword size={10} />
              <span className="font-ui tabular-nums">{formatResource(unit.attack)}</span>
            </div>
          )}
          {unit.shield > 0 && (
            <div className="flex items-center gap-1 text-gold-dim">
              <Shield size={10} />
              <span className="font-ui tabular-nums">{formatResource(unit.shield)}</span>
            </div>
          )}
          {unit.hull > 0 && (
            <div className="flex items-center gap-1 text-forest">
              <Heart size={10} />
              <span className="font-ui tabular-nums">{formatResource(unit.hull)}</span>
            </div>
          )}
        </div>
      )}

      <div className="divider">◆</div>

      {/* Cost for current amount */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {totalWood  > 0 && <CostItem icon={<GiWoodPile  size={13} />} value={totalWood}  affordable={inQueue || canAfford} />}
        {totalStone > 0 && <CostItem icon={<GiStoneBlock size={13} />} value={totalStone} affordable={inQueue || canAfford} />}
        {totalGrain > 0 && <CostItem icon={<GiWheat     size={13} />} value={totalGrain} affordable={inQueue || canAfford} />}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(totalTime)}</span>
        </div>
      </div>

      {/* Action */}
      {inQueue ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
            <Loader2 size={12} className="animate-spin" />
            {unit.inQueue!.amount} unidades · {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
          </div>
        </div>
      ) : !unit.requiresMet ? (
        <div className="mt-auto">
          <RequirementsList
            requires={unit.requires}
            kingdom={kingdom}
            research={research ? Object.fromEntries(research.map(r => [r.id, r.level])) : {}}
          />
        </div>
      ) : (
        <div className="mt-auto space-y-2">
          {/* Amount stepper */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeAmount(-10)}
              className="px-2 py-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-xs font-ui transition-colors"
            >-10</button>
            <button
              onClick={() => changeAmount(-1)}
              className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors"
            ><Minus size={12} /></button>
            <input
              type="number"
              min={1}
              max={9999}
              value={amount}
              onChange={e => setAmount(Math.max(1, Math.min(parseInt(e.target.value) || 1, 9999)))}
              className="flex-1 text-center game-input py-1 text-sm tabular-nums"
            />
            <button
              onClick={() => changeAmount(1)}
              className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors"
            ><Plus size={12} /></button>
            <button
              onClick={() => changeAmount(10)}
              className="px-2 py-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-xs font-ui transition-colors"
            >+10</button>
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={!canAfford || isTraining}
            onClick={() => onTrain(amount)}
          >
            {isTraining
              ? <Loader2 size={11} className="animate-spin" />
              : <Sword size={11} />
            }
            {canAfford ? `Entrenar ×${amount}` : 'Recursos insuficientes'}
          </Button>
        </div>
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

function BarracksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" /><div className="skeleton h-8 w-32" />
      </div>
      <div className="skeleton h-9 w-56 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3">
              <div className="skeleton w-8 h-8 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-full" />
              </div>
            </div>
            <div className="skeleton h-10 w-full rounded" />
            <div className="skeleton h-9 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
