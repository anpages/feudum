import { useState, useEffect, useCallback } from 'react'
import { Users, FlaskConical, Hammer, Loader2, Clock, TrendingUp, TrendingDown, TreePine, Mountain, Wheat, ChevronRight, Home, Sprout, GraduationCap, Factory, Shield, Sparkles, ArrowUp, Swords, type LucideIcon } from 'lucide-react'
import { GiScrollUnfurled, GiCastle, GiHiking, GiByzantinTemple, GiCamel } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useLifeforms, useSelectCivilization, useBuildLFBuilding, useResearchLF } from './useLifeforms'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { formatResource, formatDuration } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { CivilizationId, LFBuildingInfo, LFResearchInfo, PopStats, ActiveBonuses } from './types'

const CIV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  romans:     GiCastle,
  vikings:    GiHiking,
  byzantines: GiByzantinTemple,
  saracens:   GiCamel,
}

const CIV_COLORS: Record<string, string> = {
  romans:     'text-gold border-gold/30 bg-gold/5',
  vikings:    'text-blue-400 border-blue-400/30 bg-blue-400/5',
  byzantines: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
  saracens:   'text-orange-400 border-orange-400/30 bg-orange-400/5',
}

// Nombre display de edificios LF para la lista de requisitos
const LF_BUILDING_NAMES: Record<string, string> = {
  // Romanos
  insulae: 'Barrios Romanos', granjaRomana: 'Granja Comunitaria', centroEstudios: 'Centro de Estudios',
  academiaRomana: 'Academia Romana', curiaRomana: 'Curia Senatorial', tallerProduccion: 'Taller de Producción',
  ciudadelaRomana: 'Ciudadela Romana', templo: 'Templo', foro: 'Foro',
  // Vikingos
  longhouse: 'Longhouse', granjaViking: 'Granja Vikinga', forjaMagma: 'Forja de Magma',
  academiaRuna: 'Academia Rúnica', salaClan: 'Sala del Clan', altarVolcanico: 'Altar Volcánico',
  // Bizantinos
  insulaBizantina: 'Ínsula Bizantina', granjaBizantina: 'Granja Bizantina', academiBizantina: 'Academia Bizantina',
  salaBizantina: 'Sala del Senado', obelisco: 'Obelisco',
  // Sarracenos
  santuario: 'Santuario', destileriaEspecias: 'Destilería de Especias', salaAstrolabio: 'Sala del Astrolabio',
  hornoSolar: 'Horno Solar', caravanserai: 'Caravanserai', casaSabiduria: 'Casa de la Sabiduría',
  granMezquita: 'Gran Mezquita', crisalidaAcelerada: 'Crisálida Acelerada', jardinBotanico: 'Jardín Botánico',
  torreMuecin: 'Torre del Muecín', arsenalNaval: 'Arsenal Naval', observatorio: 'Observatorio',
}

function getLFBuildingName(id: string) {
  return LF_BUILDING_NAMES[id] ?? id
}

interface BuildingCategory {
  id: string
  label: string
  description: string
  Icon: LucideIcon
  roles: string[]
}

const BUILDING_CATEGORIES: BuildingCategory[] = [
  {
    id: 'housing',
    label: 'Vivienda',
    description: 'Hogares para tu población. Aumentan la capacidad y la velocidad de crecimiento.',
    Icon: Home,
    roles: ['housing'],
  },
  {
    id: 'food',
    label: 'Alimentación',
    description: 'Granjas y despensas que sostienen a los habitantes de tu ciudad.',
    Icon: Sprout,
    roles: ['food'],
  },
  {
    id: 'education',
    label: 'Educación',
    description: 'Escuelas e instituciones que elevan a la población a niveles superiores.',
    Icon: GraduationCap,
    roles: ['lab', 'school_t2', 'school_t3'],
  },
  {
    id: 'production',
    label: 'Producción y Servicios',
    description: 'Talleres, herrerías y servicios que potencian la economía del reino.',
    Icon: Factory,
    roles: ['utility', 'amplifier'],
  },
  {
    id: 'defense',
    label: 'Defensa',
    description: 'Murallas y fortines que protegen a los ciudadanos de los ataques enemigos.',
    Icon: Shield,
    roles: ['defense_pop'],
  },
]

function useCountdown(finishesAt: number | null, onEnd: () => void) {
  const [secs, setSecs] = useState(() =>
    finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishesAt) return
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

export function LifeformsPage() {
  const { data, isLoading, refetch } = useLifeforms()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const selectCiv = useSelectCivilization()
  const buildBuilding = useBuildLFBuilding()
  const researchLF = useResearchLF()
  const syncQueues = useQueueSync()
  const [tab, setTab] = useState<'buildings' | 'research'>('buildings')

  const handleCountdownEnd = useCallback(async (name: string) => {
    await syncQueues()
    await refetch()
    toast.success(`${name} completado`)
  }, [syncQueues, refetch])

  if (isLoading) return <LFSkeleton />

  if (!data?.civilization) {
    return <SelectCivilizationPanel civs={data?.civilizations ?? []} onSelect={id => selectCiv.mutate(id)} isPending={selectCiv.isPending} />
  }

  const civ           = data.civilization
  const buildings      = data.buildings[civ] ?? []
  const research       = data.research[civ] ?? []
  const civMeta        = data.civilizations.find(c => c.id === civ)
  const popTotal       = data.population.t1 + data.population.t2 + data.population.t3
  const Icon           = CIV_ICONS[civ] ?? GiScrollUnfurled
  const lfBuildingsMap = Object.fromEntries(buildings.map(b => [b.id, b.level]))
  const ps             = data.popStats
  const ab             = data.activeBonuses

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="anim-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="section-heading">Formas de Vida</span>
          <h1 className="page-title mt-0.5">Civilización</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">
            Desarrolla tu civilización para desbloquear bonificaciones únicas.
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${CIV_COLORS[civ]}`}>
          <Icon size={18} />
          <div>
            <p className="font-ui text-sm font-bold">{civMeta?.name}</p>
            <p className="font-ui text-[0.6rem] text-ink-muted/60">Nv. {data.civLevels[civ]}</p>
          </div>
        </div>
      </div>

      {/* Stats — población + alimento en 2 columnas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 anim-fade-up-1">
        <PopulationCard pop={data.population} popTotal={popTotal} ps={ps} artifacts={data.artifacts} tiers={data.tiers} />
        <FoodCard foodStored={data.foodStored} ps={ps} />
      </div>

      {/* Bonos activos de investigación */}
      {ab && <ActiveBonusesCard ab={ab} />}

      {/* Tab selector */}
      <div className="flex gap-2 anim-fade-up-2">
        <button
          onClick={() => setTab('buildings')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-ui text-sm border transition-colors ${tab === 'buildings' ? 'bg-gold/10 border-gold/30 text-gold-dim' : 'border-gold/10 text-ink-muted hover:border-gold/20'}`}
        >
          <Hammer size={14} />Edificios
        </button>
        <button
          onClick={() => setTab('research')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-ui text-sm border transition-colors ${tab === 'research' ? 'bg-gold/10 border-gold/30 text-gold-dim' : 'border-gold/10 text-ink-muted hover:border-gold/20'}`}
        >
          <FlaskConical size={14} />Investigaciones
        </button>
      </div>

      {/* Buildings tab — grouped by city category */}
      {tab === 'buildings' && (
        <div className="space-y-10 anim-fade-up-3">
          {BUILDING_CATEGORIES.map(cat => {
            const catBuildings = buildings.filter(b => cat.roles.includes(b.role))
            if (catBuildings.length === 0) return null
            const CatIcon = cat.Icon
            return (
              <section key={cat.id}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gold/10 border border-gold/20">
                    <CatIcon size={16} className="text-gold-dim" />
                  </div>
                  <div>
                    <h3 className="font-ui text-sm font-bold text-ink leading-none">{cat.label}</h3>
                    <p className="font-body text-xs text-ink-muted/60 mt-0.5">{cat.description}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {catBuildings.some(b => b.inQueue) && (
                      <span className="flex items-center gap-1 font-ui text-[0.6rem] text-gold-dim border border-gold/20 bg-gold/5 px-2 py-0.5 rounded-full">
                        <Sparkles size={9} />en construcción
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {catBuildings.map((b, i) => (
                    <LFBuildingCard
                      key={b.id}
                      building={b}
                      lfBuildingsMap={lfBuildingsMap}
                      resources={resources}
                      onBuild={() => buildBuilding.mutate(b.id)}
                      isBuildPending={buildBuilding.isPending && buildBuilding.variables === b.id}
                      onCountdownEnd={() => handleCountdownEnd(b.name)}
                      animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Research tab */}
      {tab === 'research' && (
        <div className="space-y-6 anim-fade-up-3">
          {([1, 2, 3] as const).map(tier => {
            const tierKey  = `t${tier}` as 't1'|'t2'|'t3'
            const unlocked = data.tiers[tierKey]
            const progress = data.tierProgress[tierKey]
            const popPct   = Math.min(100, Math.round(popTotal / progress.popRequired * 100))
            const artPct   = Math.min(100, Math.round(data.artifacts / progress.artifactsRequired * 100))
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`font-ui text-xs font-bold px-2 py-0.5 rounded border ${
                    unlocked ? 'border-forest/30 text-forest-light bg-forest/5' : 'border-gold/20 text-ink-muted/60'
                  }`}>Tier {tier}</span>
                  {!unlocked && (
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Users size={10} className="text-ink-muted/50 shrink-0" />
                        <div className="flex-1 h-1.5 rounded-full bg-gold/10 overflow-hidden">
                          <div className="h-full bg-gold/40 rounded-full transition-all" style={{ width: `${popPct}%` }} />
                        </div>
                        <span className="font-ui text-[0.6rem] tabular-nums text-ink-muted/60 shrink-0">
                          {formatResource(popTotal)}/{formatResource(progress.popRequired)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[0.6rem] text-gold/50 shrink-0">✦</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gold/10 overflow-hidden">
                          <div className="h-full bg-gold/40 rounded-full transition-all" style={{ width: `${artPct}%` }} />
                        </div>
                        <span className="font-ui text-[0.6rem] tabular-nums text-ink-muted/60 shrink-0">
                          {data.artifacts}/{progress.artifactsRequired}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {research.filter(r => r.tier === tier).map((r, i) => (
                    <LFResearchCard
                      key={r.id}
                      research={r}
                      resources={resources}
                      locked={!unlocked}
                      onResearch={() => researchLF.mutate(r.id)}
                      isPending={researchLF.isPending && researchLF.variables === r.id}
                      onCountdownEnd={() => handleCountdownEnd(r.name)}
                      animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── City stage label ──────────────────────────────────────────────────────────

function cityStage(pop: number): string {
  if (pop === 0)          return 'Sin habitantes'
  if (pop < 50)           return 'Campamento'
  if (pop < 300)          return 'Aldea'
  if (pop < 1_000)        return 'Pueblo'
  if (pop < 5_000)        return 'Villa'
  if (pop < 20_000)       return 'Ciudad pequeña'
  if (pop < 100_000)      return 'Ciudad'
  if (pop < 500_000)      return 'Gran ciudad'
  if (pop < 2_000_000)    return 'Metrópolis'
  return 'Imperio'
}

// ── Population card ───────────────────────────────────────────────────────────

function PopulationCard({ pop, popTotal, ps, artifacts, tiers }: {
  pop: { t1: number; t2: number; t3: number }
  popTotal: number
  ps: PopStats
  artifacts: number
  tiers: { t1: boolean; t2: boolean; t3: boolean }
}) {
  const capPct = ps.popCapT1 > 0 ? Math.min(100, Math.round(pop.t1 / ps.popCapT1 * 100)) : 0
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users size={13} className="text-gold/60" />
          <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">Población</span>
        </div>
        <span className="font-ui text-[0.65rem] text-ink-muted/60 italic">{cityStage(popTotal)}</span>
      </div>

      <div>
        <p className="font-ui text-2xl tabular-nums font-bold text-ink leading-none">{formatResource(popTotal)}</p>
        {ps.isStarving ? (
          <p className="flex items-center gap-1 mt-1 font-ui text-[0.65rem] text-crimson font-semibold">
            <TrendingDown size={10} />hambruna — población decreciendo
          </p>
        ) : ps.isGrowing ? (
          <p className="flex items-center gap-1 mt-1 font-ui text-[0.65rem] text-forest">
            <TrendingUp size={10} />+{formatResource(ps.popGrowthPerHour)}/h
          </p>
        ) : (
          <p className="flex items-center gap-1 mt-1 font-ui text-[0.65rem] text-ink-muted/50">
            <ArrowUp size={10} />estable
          </p>
        )}
      </div>

      {ps.popCapT1 > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between font-ui text-[0.6rem] text-ink-muted/50">
            <span>Capacidad T1</span>
            <span className="tabular-nums">{formatResource(Math.round(pop.t1))} / {formatResource(ps.popCapT1)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gold/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${capPct >= 95 ? 'bg-crimson/60' : 'bg-gold/50'}`} style={{ width: `${capPct}%` }} />
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-gold/10 flex items-center justify-between">
        <div className="flex gap-3">
          {(['t1','t2','t3'] as const).map(t => (
            <div key={t} className="text-center">
              <p className="font-ui text-[0.6rem] text-ink-muted/40 uppercase">{t}</p>
              <p className="font-ui text-xs tabular-nums text-ink-muted/70">{formatResource(pop[t])}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-ui text-[0.6rem] text-ink-muted/50">Artefactos</span>
          <span className="font-ui text-sm font-bold text-gold-dim tabular-nums">✦ {artifacts}</span>
          <div className="flex gap-0.5 ml-1">
            {(['t1','t2','t3'] as const).map(t => (
              <span key={t} className={`w-1.5 h-1.5 rounded-full ${tiers[t] ? 'bg-forest' : 'bg-gold/20'}`} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Food card ─────────────────────────────────────────────────────────────────

function FoodCard({ foodStored, ps }: { foodStored: number; ps: PopStats }) {
  const surplus  = ps.foodBalance >= 0
  const balanced = Math.abs(ps.foodBalance) < 0.1
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Wheat size={13} className="text-gold/60" />
        <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">Alimentación</span>
      </div>

      <div>
        <p className="font-ui text-2xl tabular-nums font-bold text-ink leading-none">{formatResource(Math.round(foodStored))}</p>
        <p className="font-ui text-[0.65rem] text-ink-muted/50 mt-0.5">almacenado</p>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-gold/10">
        <div className="flex items-center justify-between font-ui text-xs">
          <span className="text-ink-muted/60 flex items-center gap-1"><TrendingUp size={10} />Producción</span>
          <span className="tabular-nums text-forest">{ps.foodProdPerHour > 0 ? `+${ps.foodProdPerHour.toFixed(1)}` : '—'}/h</span>
        </div>
        <div className="flex items-center justify-between font-ui text-xs">
          <span className="text-ink-muted/60 flex items-center gap-1"><TrendingDown size={10} />Consumo</span>
          <span className="tabular-nums text-ink-mid">−{ps.foodConsPerHour.toFixed(1)}/h</span>
        </div>
        <div className={`flex items-center justify-between font-ui text-xs font-semibold pt-1 border-t border-gold/8 ${
          balanced ? 'text-ink-muted' : surplus ? 'text-forest' : 'text-crimson'
        }`}>
          <span>Balance</span>
          <span className="tabular-nums">{balanced ? '±0' : surplus ? `+${ps.foodBalance.toFixed(1)}` : ps.foodBalance.toFixed(1)}/h</span>
        </div>
      </div>
    </Card>
  )
}

// ── Active bonuses card ───────────────────────────────────────────────────────

function ActiveBonusesCard({ ab }: { ab: ActiveBonuses }) {
  const hasBonuses = ab.woodMult > 1 || ab.stoneMult > 1 || ab.grainMult > 1
    || ab.researchTime < 1 || ab.armySpeed > 0 || ab.unitTime < 1
  if (!hasBonuses) return null

  const pct = (v: number) => `+${Math.round((v - 1) * 100)}%`
  const neg = (v: number) => `${Math.round((1 - v) * 100)}% menos tiempo`
  const spd = (v: number) => `+${Math.round(v * 100)}%`

  const bonuses: { icon: React.ReactNode; label: string; value: string }[] = []
  if (ab.woodMult > 1)    bonuses.push({ icon: <TreePine size={11} />, label: 'Producción madera',       value: pct(ab.woodMult) })
  if (ab.stoneMult > 1)   bonuses.push({ icon: <Mountain size={11} />, label: 'Producción piedra',       value: pct(ab.stoneMult) })
  if (ab.grainMult > 1)   bonuses.push({ icon: <Wheat size={11} />,    label: 'Producción grano',        value: pct(ab.grainMult) })
  if (ab.researchTime < 1) bonuses.push({ icon: <FlaskConical size={11} />, label: 'Tiempo investigación', value: neg(ab.researchTime) })
  if (ab.armySpeed > 0)   bonuses.push({ icon: <Swords size={11} />,   label: 'Velocidad ejército',      value: spd(ab.armySpeed) })
  if (ab.unitTime < 1)    bonuses.push({ icon: <Hammer size={11} />,   label: 'Tiempo entrenamiento',    value: neg(ab.unitTime) })

  return (
    <Card className="p-4 anim-fade-up-2">
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Bonos activos de civilización</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {bonuses.map((b, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-forest/5 border border-forest/15">
            <span className="text-forest shrink-0">{b.icon}</span>
            <div className="min-w-0">
              <p className="font-body text-[0.6rem] text-ink-muted/60 truncate">{b.label}</p>
              <p className="font-ui text-xs font-bold text-forest">{b.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Select Civilization Panel ─────────────────────────────────────────────────

function SelectCivilizationPanel({ civs, onSelect, isPending }: {
  civs: { id: string; name: string; description: string }[]
  onSelect: (id: CivilizationId) => void
  isPending: boolean
}) {
  const [selected, setSelected] = useState<CivilizationId | null>(null)

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Formas de Vida</span>
        <h1 className="page-title mt-0.5">Elige tu Civilización</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Cada civilización tiene edificios, investigaciones y bonificaciones únicas. La elección es permanente para este reino.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 anim-fade-up-1">
        {civs.map(c => {
          const Icon = CIV_ICONS[c.id] ?? GiScrollUnfurled
          const colorClass = CIV_COLORS[c.id] ?? ''
          const isSelected = selected === c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id as CivilizationId)}
              className={`text-left p-5 rounded-xl border-2 transition-all ${isSelected ? `border-current ${colorClass}` : 'border-gold/15 hover:border-gold/30'}`}
            >
              <div className={`flex items-center gap-3 mb-2 ${isSelected ? colorClass.split(' ')[0] : 'text-ink-mid'}`}>
                <Icon size={22} />
                <span className="font-ui text-base font-bold">{c.name}</span>
              </div>
              <p className="font-body text-sm text-ink-muted">{c.description}</p>
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="flex justify-center anim-fade-up-2">
          <Button variant="primary" onClick={() => onSelect(selected)} disabled={isPending}>
            {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            Confirmar — {civs.find(c => c.id === selected)?.name}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── LF Building Card ──────────────────────────────────────────────────────────


function CostItem({ icon, value, ok }: { icon: React.ReactNode; value: number; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-muted/70">{icon}</span>
      <span className={`font-ui tabular-nums ${ok ? 'text-ink-mid' : 'text-crimson'}`}>{formatResource(value)}</span>
    </div>
  )
}

function LFRequirements({ requires, lfBuildingsMap }: { requires: { id: string; level: number }[]; lfBuildingsMap: Record<string, number> }) {
  if (!requires || requires.length === 0) return null
  return (
    <div className="space-y-1">
      {requires.map(req => {
        const current = lfBuildingsMap[req.id] ?? 0
        const met = current >= req.level
        return (
          <div key={req.id} className={`flex items-center gap-1.5 text-xs ${met ? 'text-forest' : 'text-crimson'}`}>
            <span className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 text-[9px] ${met ? 'bg-forest/20' : 'bg-crimson/10'}`}>
              {met ? '✓' : '✗'}
            </span>
            <span className="font-ui">{getLFBuildingName(req.id)} <span className="font-semibold">Nv {req.level}</span></span>
            <span className={`ml-auto tabular-nums font-ui text-[0.65rem] ${met ? 'text-forest/70' : 'text-crimson/70'}`}>{current}/{req.level}</span>
          </div>
        )
      })}
    </div>
  )
}

function LFBuildingCard({ building: b, lfBuildingsMap, resources, onBuild, isBuildPending, onCountdownEnd, animClass = '' }: {
  building: LFBuildingInfo
  lfBuildingsMap: Record<string, number>
  resources: { wood: number; stone: number; grain: number }
  onBuild: () => void
  isBuildPending: boolean
  onCountdownEnd: () => void
  animClass?: string
}) {
  const countdown = useCountdown(b.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!b.inQueue && countdown > 0
  const canAfford = resources.wood >= b.cost.wood && resources.stone >= b.cost.stone && resources.grain >= b.cost.grain

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${inQueue ? 'bg-gold/15 border border-gold/30' : 'bg-gold-soft border border-gold/20'}`}>
          <Hammer size={18} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">{b.name}</h3>
            <Badge variant={b.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              {inQueue ? `Nv ${b.level}→${b.inQueue!.level}` : `Nv ${b.level}`}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{b.description}</p>
        </div>
      </div>

      <div className="divider">◆</div>

      {/* Cost or queue state */}
      {inQueue ? (
        <div className="flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
          <Loader2 size={12} className="animate-spin" />
          Nv. {b.inQueue!.level} · {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {b.cost.wood  > 0 && <CostItem icon={<TreePine  size={12} />} value={b.cost.wood}  ok={resources.wood  >= b.cost.wood} />}
            {b.cost.stone > 0 && <CostItem icon={<Mountain  size={12} />} value={b.cost.stone} ok={resources.stone >= b.cost.stone} />}
            {b.cost.grain > 0 && <CostItem icon={<Wheat     size={12} />} value={b.cost.grain} ok={resources.grain >= b.cost.grain} />}
            <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
              <Clock size={10} /><span className="font-body">{formatDuration(b.timeSecs)}</span>
            </div>
          </div>

          {b.requires.length > 0 && !b.requiresMet && (
            <LFRequirements requires={b.requires} lfBuildingsMap={lfBuildingsMap} />
          )}

          <Button
            variant="primary"
            className="w-full mt-auto"
            disabled={!canAfford || !b.requiresMet || isBuildPending}
            onClick={onBuild}
          >
            {isBuildPending ? <Loader2 size={11} className="animate-spin" /> : <Hammer size={11} />}
            {b.requiresMet ? (canAfford ? `Construir Nv. ${b.nextLevel}` : 'Recursos insuficientes') : 'Requisitos pendientes'}
          </Button>
        </>
      )}
    </Card>
  )
}

// ── LF Research Card ──────────────────────────────────────────────────────────

function LFResearchCard({ research: r, resources, locked, onResearch, isPending, onCountdownEnd, animClass = '' }: {
  research: LFResearchInfo
  resources: { wood: number; stone: number; grain: number }
  locked: boolean
  onResearch: () => void
  isPending: boolean
  onCountdownEnd: () => void
  animClass?: string
}) {
  const countdown = useCountdown(r.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!r.inQueue && countdown > 0
  const canAfford = !locked && !inQueue && resources.wood >= r.cost.wood && resources.stone >= r.cost.stone && resources.grain >= r.cost.grain

  return (
    <Card className={`p-5 flex flex-col gap-4 ${locked ? 'opacity-50' : ''} ${animClass}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${inQueue ? 'bg-gold/15 border border-gold/30' : 'bg-gold-soft border border-gold/20'}`}>
          <FlaskConical size={18} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">{r.name}</h3>
            <Badge variant={r.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              {inQueue ? `Nv ${r.level}→${r.inQueue!.level}` : `Nv ${r.level}`}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {r.effects.map((e, i) => (
              <span key={i} className="font-body text-[0.6rem] text-forest-light bg-forest/5 border border-forest/20 px-1.5 py-0.5 rounded">
                {effectLabel(e)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="divider">◆</div>

      {inQueue ? (
        <div className="flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
          <Loader2 size={12} className="animate-spin" />
          Nv. {r.inQueue!.level} · {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
        </div>
      ) : !locked ? (
        <>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {r.cost.wood  > 0 && <CostItem icon={<TreePine  size={12} />} value={r.cost.wood}  ok={resources.wood  >= r.cost.wood} />}
            {r.cost.stone > 0 && <CostItem icon={<Mountain  size={12} />} value={r.cost.stone} ok={resources.stone >= r.cost.stone} />}
            {r.cost.grain > 0 && <CostItem icon={<Wheat     size={12} />} value={r.cost.grain} ok={resources.grain >= r.cost.grain} />}
            <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
              <Clock size={10} /><span className="font-body">{formatDuration(r.timeSecs)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full mt-auto"
            disabled={!canAfford || isPending}
            onClick={onResearch}
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
            {canAfford ? `Investigar Nv. ${r.nextLevel}` : 'Recursos insuficientes'}
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-2 text-ink-muted/50 font-ui text-xs">
          <ChevronRight size={12} />
          Bloqueado — desbloquea el tier primero
        </div>
      )}
    </Card>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EFFECT_LABELS: Record<string, string> = {
  production_all:        '+{v}% producción',
  production_wood:       '+{v}% madera',
  production_stone:      '+{v}% piedra',
  production_grain:      '+{v}% grano',
  energy_production:     '+{v}% energía',
  army_speed:            '+{v}% velocidad',
  army_speed_civil:      '+{v}% vel. civil',
  army_fuel_cost:        '{v}% combustible',
  cargo_capacity_civil:  '+{v}% carga',
  research_time:         '{v}% inv.',
  expedition_time:       '{v}% expedición',
  expedition_resources:  '+{v}% rec. exp.',
  expedition_units:      '+{v}% unid. exp.',
  expedition_speed:      '+{v}% vel. exp.',
  expedition_loss_reduction: '{v}% bajas exp.',
  lf_building_cost:      '{v}% coste edif.',
  lf_building_time:      '{v}% tiempo edif.',
  spy_cost:              '{v}% espía',
  spy_time:              '{v}% t. espía',
  spy_range:             '+{v}% alcance',
  resources_protected:   '+{v}% prot.',
  defense_stats:         '+{v}% defensa',
  unit_stats_squire:     '+{v}% Escudero',
  unit_stats_knight:     '+{v}% Caballero',
  unit_stats_paladin:    '+{v}% Paladín',
  unit_stats_warlord:    '+{v}% Señor Guerra',
  unit_stats_grandKnight:'+{v}% Gran Cab.',
  unit_stats_siegeMaster:'+{v}% Maestro Asedio',
  unit_stats_warMachine: '+{v}% Máq. Guerra',
  unit_stats_dragonKnight:'+{v}% Cab. Dragón',
  unit_stats_scavenger:  '+{v}% Saqueador',
  unit_stats_caravan:    '+{v}% Caravana',
  class_collector_bonus: '+{v}% Cosechador',
  class_general_bonus:   '+{v}% General',
  class_discoverer_bonus:'+{v}% Explorador',
}

function effectLabel(e: { type: string; base: number }): string {
  const tpl = EFFECT_LABELS[e.type] ?? e.type
  return tpl.replace('{v}', Math.abs(e.base).toString())
}

function LFSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-24" /><div className="skeleton h-8 w-40" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3"><div className="skeleton w-9 h-9 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-full" /></div></div>
            <div className="skeleton h-9 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
