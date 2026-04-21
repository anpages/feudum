import { useState } from 'react'
import { Users, FlaskConical, Hammer } from 'lucide-react'
import { GiScrollUnfurled, GiCastle, GiHiking, GiByzantinTemple, GiCamel } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLifeforms, useSelectCivilization, useBuildLFBuilding, useResearchLF } from './useLifeforms'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { formatResource, formatDuration } from '@/lib/format'
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

export function LifeformsPage() {
  const { data, isLoading } = useLifeforms()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const selectCiv = useSelectCivilization()
  const buildBuilding = useBuildLFBuilding()
  const researchLF = useResearchLF()
  const [tab, setTab] = useState<'buildings' | 'research'>('buildings')

  if (isLoading) return <LFSkeleton />

  if (!data?.civilization) {
    return <SelectCivilizationPanel civs={data?.civilizations ?? []} onSelect={id => selectCiv.mutate(id)} isPending={selectCiv.isPending} />
  }

  const civ = data.civilization
  const buildings = data.buildings[civ] ?? []
  const research  = data.research[civ] ?? []
  const civMeta   = data.civilizations.find(c => c.id === civ)
  const popTotal  = data.population.t1 + data.population.t2 + data.population.t3
  const Icon      = CIV_ICONS[civ] ?? GiScrollUnfurled

  return (
    <div className="space-y-8">
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 anim-fade-up-1">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={11} className="text-forest-light" />
            <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60">Población</span>
          </div>
          <p className="font-ui text-base font-semibold tabular-nums text-ink">{formatResource(popTotal)}</p>
          <p className="font-body text-[0.6rem] text-ink-muted/50 mt-0.5">
            T1: {formatResource(data.population.t1)} · T2: {formatResource(data.population.t2)} · T3: {formatResource(data.population.t3)}
          </p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[0.7rem]">🌾</span>
            <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60">Alimento</span>
          </div>
          <p className="font-ui text-base font-semibold tabular-nums text-ink">{formatResource(data.foodStored)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[0.7rem]">🔮</span>
            <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60">Artefactos</span>
          </div>
          <p className="font-ui text-base font-semibold tabular-nums text-ink">{data.artifacts}</p>
          <p className="font-body text-[0.6rem] text-ink-muted/50 mt-0.5">
            Tiers: {data.tiers.t1 ? '✓T1' : '—T1'} {data.tiers.t2 ? '✓T2' : '—T2'} {data.tiers.t3 ? '✓T3' : '—T3'}
          </p>
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
          {buildings.map(b => (
            <LFBuildingCard
              key={b.id}
              building={b}
              resources={resources}
              onBuild={() => buildBuilding.mutate(b.id)}
              isBuildPending={buildBuilding.isPending && buildBuilding.variables === b.id}
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
                  data.tiers[`t${tier}` as 't1'|'t2'|'t3'] ? 'border-forest/30 text-forest-light bg-forest/5' : 'border-gold/20 text-ink-muted/60'
                }`}>Tier {tier}</span>
                {!data.tiers[`t${tier}` as 't1'|'t2'|'t3'] && tier > 1 && (
                  <span className="font-body text-xs text-ink-muted/50">
                    {tier === 2 ? '1.200.000 pop + 400 artefactos' : '13.000.000 pop + 600 artefactos'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {research.filter(r => r.tier === tier).map(r => (
                  <LFResearchCard
                    key={r.id}
                    research={r}
                    resources={resources}
                    locked={!data.tiers[`t${tier}` as 't1'|'t2'|'t3']}
                    onResearch={() => researchLF.mutate(r.id)}
                    isPending={researchLF.isPending && researchLF.variables === r.id}
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
          <Button
            variant="primary"
            onClick={() => onSelect(selected)}
            disabled={isPending}
          >
            Confirmar — {civs.find(c => c.id === selected)?.name}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── LF Building Card ──────────────────────────────────────────────────────────

function LFBuildingCard({ building: b, resources, onBuild, isBuildPending }: {
  building: LFBuildingInfo
  resources: { wood: number; stone: number; grain: number }
  onBuild: () => void
  isBuildPending: boolean
}) {
  const canAfford = resources.wood >= b.cost.wood && resources.stone >= b.cost.stone && resources.grain >= b.cost.grain

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-ui text-sm font-bold text-ink">{b.name}</p>
          <p className="font-body text-xs text-ink-muted/70 mt-0.5 leading-snug">{b.description}</p>
        </div>
        <span className="shrink-0 font-ui text-lg font-bold text-gold-dim tabular-nums">{b.level}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {b.cost.wood  > 0 && <ResourcePill label="🪵" value={b.cost.wood}  enough={resources.wood  >= b.cost.wood} />}
        {b.cost.stone > 0 && <ResourcePill label="🪨" value={b.cost.stone} enough={resources.stone >= b.cost.stone} />}
        {b.cost.grain > 0 && <ResourcePill label="🌾" value={b.cost.grain} enough={resources.grain >= b.cost.grain} />}
        <span className="font-body text-[0.65rem] text-ink-muted/50 ml-auto self-center">{formatDuration(b.timeSecs)}</span>
      </div>

      {!b.requiresMet && (
        <p className="font-body text-[0.65rem] text-crimson">
          ⚠ Requisitos no cumplidos
        </p>
      )}

      <Button
        variant="primary"
        size="sm"
        className="w-full"
        disabled={!canAfford || !b.requiresMet || isBuildPending}
        onClick={onBuild}
      >
        {isBuildPending ? 'Encolando…' : `Construir nv. ${b.nextLevel}`}
      </Button>
    </Card>
  )
}

// ── LF Research Card ──────────────────────────────────────────────────────────

function LFResearchCard({ research: r, resources, locked, onResearch, isPending }: {
  research: LFResearchInfo
  resources: { wood: number; stone: number; grain: number }
  locked: boolean
  onResearch: () => void
  isPending: boolean
}) {
  const canAfford = !locked && resources.wood >= r.cost.wood && resources.stone >= r.cost.stone && resources.grain >= r.cost.grain

  return (
    <Card className={`p-4 space-y-3 ${locked ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-ui text-sm font-bold text-ink">{r.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {r.effects.map((e, i) => (
              <span key={i} className="font-body text-[0.6rem] text-forest-light bg-forest/5 border border-forest/20 px-1.5 py-0.5 rounded">
                {effectLabel(e)}
              </span>
            ))}
          </div>
        </div>
        <span className="shrink-0 font-ui text-lg font-bold text-gold-dim tabular-nums">{r.level}</span>
      </div>

      {!locked && (
        <div className="flex gap-2 flex-wrap">
          {r.cost.wood  > 0 && <ResourcePill label="🪵" value={r.cost.wood}  enough={resources.wood  >= r.cost.wood} />}
          {r.cost.stone > 0 && <ResourcePill label="🪨" value={r.cost.stone} enough={resources.stone >= r.cost.stone} />}
          {r.cost.grain > 0 && <ResourcePill label="🌾" value={r.cost.grain} enough={resources.grain >= r.cost.grain} />}
          <span className="font-body text-[0.65rem] text-ink-muted/50 ml-auto self-center">{formatDuration(r.timeSecs)}</span>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={!canAfford || isPending || locked}
        onClick={onResearch}
      >
        {locked ? 'Bloqueado' : isPending ? 'Investigando…' : `Investigar nv. ${r.nextLevel}`}
      </Button>
    </Card>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ResourcePill({ label, value, enough }: { label: string; value: number; enough: boolean }) {
  return (
    <span className={`font-ui text-xs tabular-nums ${enough ? 'text-ink-mid' : 'text-crimson'}`}>
      {label} {formatResource(value)}
    </span>
  )
}

const EFFECT_LABELS: Record<string, string> = {
  production_all:        '+{v}% producción',
  production_wood:       '+{v}% madera',
  production_stone:      '+{v}% piedra',
  production_grain:      '+{v}% grano',
  energy_production:     '+{v}% energía',
  army_speed:            '+{v}% velocidad ejércitos',
  army_speed_civil:      '+{v}% velocidad civil',
  army_fuel_cost:        '{v}% combustible',
  cargo_capacity_civil:  '+{v}% carga civil',
  research_time:         '{v}% tiempo investigación',
  expedition_time:       '{v}% tiempo expedición',
  expedition_resources:  '+{v}% recursos expedición',
  expedition_units:      '+{v}% unidades expedición',
  expedition_speed:      '+{v}% velocidad expedición',
  expedition_loss_reduction: '{v}% bajas expedición',
  lf_building_cost:      '{v}% coste edif. LF',
  lf_building_time:      '{v}% tiempo edif. LF',
  spy_cost:              '{v}% coste espía',
  spy_time:              '{v}% tiempo espía',
  spy_range:             '+{v}% alcance espía',
  resources_protected:   '+{v}% recursos protegidos',
  defense_stats:         '+{v}% defensa',
  class_collector_bonus: '+{v}% bono Cosechador',
  class_general_bonus:   '+{v}% bono General',
  class_discoverer_bonus:'+{v}% bono Explorador',
}

function effectLabel(e: { type: string; base: number }): string {
  const tpl = EFFECT_LABELS[e.type] ?? e.type
  return tpl.replace('{v}', Math.abs(e.base).toString())
}

function LFSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-24" />
        <div className="skeleton h-8 w-40" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    </div>
  )
}
