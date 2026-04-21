import { useState, useEffect, useCallback } from 'react'
import { Users, FlaskConical, Hammer, Loader2, Clock, TrendingUp, TreePine, Mountain, Wheat, ChevronRight } from 'lucide-react'
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
import type { CivilizationId, LFBuildingInfo, LFResearchInfo } from './types'

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

  const civ      = data.civilization
  const buildings = data.buildings[civ] ?? []
  const research  = data.research[civ] ?? []
  const civMeta   = data.civilizations.find(c => c.id === civ)
  const popTotal  = data.population.t1 + data.population.t2 + data.population.t3
  const Icon      = CIV_ICONS[civ] ?? GiScrollUnfurled

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

      {/* Stats row — same style as production cards in Overview */}
      <div className="grid grid-cols-3 gap-3 anim-fade-up-1">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Users size={12} className="text-gold/50" />
            <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted truncate">Población</span>
          </div>
          <p className="font-ui text-lg tabular-nums font-semibold leading-none text-ink">{formatResource(popTotal)}</p>
          <p className="flex items-center gap-0.5 mt-1 text-[0.6rem] text-ink-muted/50">
            <TrendingUp size={8} />
            T1 · T2 · T3
          </p>
          <div className="mt-2 pt-2 border-t border-gold/10 space-y-0.5">
            {([['T1', data.population.t1], ['T2', data.population.t2], ['T3', data.population.t3]] as const).map(([tier, val]) => (
              <div key={tier} className="flex justify-between">
                <span className="font-ui text-[0.6rem] text-ink-muted/50">{tier}</span>
                <span className="font-ui text-[0.6rem] tabular-nums text-ink-muted/50">{formatResource(val)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wheat size={12} className="text-gold/50" />
            <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted truncate">Alimento</span>
          </div>
          <p className="font-ui text-lg tabular-nums font-semibold leading-none text-ink">{formatResource(data.foodStored)}</p>
          <p className="flex items-center gap-0.5 mt-1 text-[0.6rem] text-ink-muted/50">
            <TrendingUp size={8} />
            almacenado
          </p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gold/50 text-xs">✦</span>
            <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted truncate">Artefactos</span>
          </div>
          <p className="font-ui text-lg tabular-nums font-semibold leading-none text-ink">{data.artifacts}</p>
          <div className="mt-2 pt-2 border-t border-gold/10 flex flex-wrap gap-1">
            {(['t1','t2','t3'] as const).map(t => (
              <span key={t} className={`font-ui text-[0.6rem] px-1.5 py-0.5 rounded border ${
                data.tiers[t] ? 'border-forest/30 text-forest-light bg-forest/5' : 'border-gold/10 text-ink-muted/40'
              }`}>{t.toUpperCase()}</span>
            ))}
          </div>
        </Card>
      </div>

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

      {/* Buildings tab */}
      {tab === 'buildings' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 anim-fade-up-3">
          {buildings.map((b, i) => (
            <LFBuildingCard
              key={b.id}
              building={b}
              lfBuildingsMap={Object.fromEntries(buildings.map(x => [x.id, x.level]))}
              resources={resources}
              onBuild={() => buildBuilding.mutate(b.id)}
              isBuildPending={buildBuilding.isPending && buildBuilding.variables === b.id}
              onCountdownEnd={() => handleCountdownEnd(b.name)}
              animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
            />
          ))}
        </div>
      )}

      {/* Research tab */}
      {tab === 'research' && (
        <div className="space-y-6 anim-fade-up-3">
          {([1, 2, 3] as const).map(tier => (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`font-ui text-xs font-bold px-2 py-0.5 rounded border ${
                  data.tiers[`t${tier}` as 't1'|'t2'|'t3']
                    ? 'border-forest/30 text-forest-light bg-forest/5'
                    : 'border-gold/20 text-ink-muted/60'
                }`}>Tier {tier}</span>
                {!data.tiers[`t${tier}` as 't1'|'t2'|'t3'] && (
                  <span className="font-body text-xs text-ink-muted/50">
                    {tier === 1 ? '200.000 pop + 200 artefactos' : tier === 2 ? '1.200.000 pop + 400 artefactos' : '13.000.000 pop + 600 artefactos'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {research.filter(r => r.tier === tier).map((r, i) => (
                  <LFResearchCard
                    key={r.id}
                    research={r}
                    resources={resources}
                    locked={!data.tiers[`t${tier}` as 't1'|'t2'|'t3']}
                    onResearch={() => researchLF.mutate(r.id)}
                    isPending={researchLF.isPending && researchLF.variables === r.id}
                    onCountdownEnd={() => handleCountdownEnd(r.name)}
                    animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
