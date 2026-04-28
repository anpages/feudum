import { formatResource, formatDuration } from '@/lib/format'
import { BUILDING_LABELS, RESEARCH_LABELS, UNIT_LABELS } from '@/lib/labels'
import type { NpcProfileKingdom, NpcProfileMission, NpcProfileBattle } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PERSONALITY_LABEL: Record<string, string> = {
  economy: 'Economía', military: 'Militar', balanced: 'Equilibrado',
}
const CLASS_LABEL: Record<string, string> = {
  collector: 'Recolector', general: 'General', discoverer: 'Descubridor',
}
const MISSION_LABEL: Record<string, string> = {
  attack: 'Ataque', transport: 'Transporte', spy: 'Espionaje',
  colonize: 'Colonizar', scavenge: 'Recogida', deploy: 'Despliegue',
  expedition: 'Expedición', missile: 'Misil',
}
const STATE_LABEL: Record<string, string> = {
  active: 'En camino', exploring: 'Explorando', returning: 'Regresando',
  merchant: 'Mercader', completed: 'Completada',
}
const STATE_COLOR: Record<string, string> = {
  active: 'text-gold', exploring: 'text-forest-light',
  returning: 'text-ink-mid', completed: 'text-ink-muted',
}

const BUILDINGS_PRODUCTION = ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral'] as const
const BUILDINGS_STORAGE    = ['granary', 'stonehouse', 'silo'] as const
const BUILDINGS_UTILITY    = ['workshop', 'engineersGuild', 'barracks', 'academy', 'alchemistTower', 'ambassadorHall', 'armoury'] as const

const RESEARCH_COMBAT  = ['swordsmanship', 'fortification', 'armoury'] as const
const RESEARCH_MOBILITY = ['horsemanship', 'cartography', 'tradeRoutes'] as const
const RESEARCH_ARCANE   = ['alchemy', 'pyromancy', 'runemastery', 'mysticism', 'dragonlore'] as const
const RESEARCH_MISC     = ['spycraft', 'logistics', 'exploration', 'diplomaticNetwork', 'divineBlessing'] as const

const COMBAT_UNITS  = ['squire', 'knight', 'paladin', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'] as const
const SUPPORT_UNITS = ['merchant', 'caravan', 'colonist', 'scavenger', 'scout'] as const
const DEFENSE_UNITS = ['archer', 'crossbowman', 'ballista', 'trebuchet', 'mageTower', 'dragonCannon', 'palisade', 'castleWall', 'moat', 'catapult'] as const

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function SectionCard({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-lg border border-gold/15 bg-surface/60 overflow-hidden ${className}`}>
      <div className="px-4 py-2.5 border-b border-gold/10 bg-parchment-deep/40">
        <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-widest text-ink-muted">
          {title}
        </span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ── Resource bar ─────────────────────────────────────────────────────────────

function ResourceBar({ icon, label, value, cap, prod }: {
  icon: string; label: string; value: number; cap: number; prod: number
}) {
  const pct  = cap > 0 ? Math.min(100, (value / cap) * 100) : 0
  const full = pct >= 99.9
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-ui text-xs text-ink flex items-center gap-1.5">
          <span>{icon}</span>{label}
        </span>
        <span className={`font-ui text-xs tabular-nums font-semibold ${full ? 'text-crimson-light' : 'text-ink-mid'}`}>
          {formatResource(value)}<span className="text-ink-muted font-normal">/{formatResource(cap)}</span>
        </span>
      </div>
      <div className="progress-track h-1.5">
        <div className={`progress-fill h-full ${full ? 'full' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="font-ui text-[0.58rem] text-ink-muted">
        +{formatResource(prod)}/h
      </div>
    </div>
  )
}

// ── Building table group ─────────────────────────────────────────────────────

function BuildingGroup({ title, ids, kingdom }: {
  title: string
  ids: readonly string[]
  kingdom: NpcProfileKingdom
}) {
  return (
    <div>
      <div className="font-ui text-[0.58rem] font-semibold uppercase tracking-widest text-gold-dim mb-1.5">
        {title}
      </div>
      <div className="space-y-0.5">
        {ids.map(id => {
          const lv = (kingdom as unknown as Record<string, number>)[id] ?? 0
          return (
            <div key={id} className="flex items-center justify-between py-0.5">
              <span className={`font-ui text-xs ${lv > 0 ? 'text-ink' : 'text-ink-muted/50'}`}>
                {BUILDING_LABELS[id] ?? id}
              </span>
              <span className={`font-ui text-xs font-bold tabular-nums min-w-[2.5rem] text-right
                ${lv === 0 ? 'text-ink-muted/40' : lv >= 10 ? 'text-gold-light' : 'text-gold'}`}>
                {lv > 0 ? `Nv. ${lv}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Research table group ─────────────────────────────────────────────────────

function ResearchGroup({ title, ids, research }: {
  title: string
  ids: readonly string[]
  research: Record<string, number>
}) {
  return (
    <div>
      <div className="font-ui text-[0.58rem] font-semibold uppercase tracking-widest text-gold-dim mb-1.5">
        {title}
      </div>
      <div className="space-y-0.5">
        {ids.map(id => {
          const lv = research[id] ?? 0
          return (
            <div key={id} className="flex items-center justify-between py-0.5">
              <span className={`font-ui text-xs ${lv > 0 ? 'text-ink' : 'text-ink-muted/50'}`}>
                {RESEARCH_LABELS[id] ?? id}
              </span>
              <span className={`font-ui text-xs font-bold tabular-nums min-w-[2.5rem] text-right
                ${lv === 0 ? 'text-ink-muted/40' : lv >= 5 ? 'text-forest-light' : 'text-ink-mid'}`}>
                {lv > 0 ? `Nv. ${lv}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Unit table ────────────────────────────────────────────────────────────────

function UnitTable({ ids, kingdom }: {
  ids: readonly string[]
  kingdom: NpcProfileKingdom
}) {
  const entries = ids.map(id => [id, (kingdom as unknown as Record<string, number>)[id] ?? 0] as const)
  const hasAny  = entries.some(([, n]) => n > 0)
  if (!hasAny) return <p className="font-ui text-xs text-ink-muted/60 py-1">Sin unidades</p>
  return (
    <div className="space-y-0.5">
      {entries.filter(([, n]) => n > 0).map(([id, n]) => (
        <div key={id} className="flex items-center justify-between py-0.5">
          <span className="font-ui text-xs text-ink">{UNIT_LABELS[id] ?? id}</span>
          <span className="font-ui text-xs font-bold tabular-nums text-ink">{formatResource(n)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Active missions list ──────────────────────────────────────────────────────

function ActiveMissionsList({ missions, now }: { missions: NpcProfileMission[]; now: number }) {
  if (missions.length === 0) {
    return <p className="font-ui text-xs text-ink-muted/60 py-1">Sin misiones activas</p>
  }
  return (
    <div className="space-y-1.5">
      {missions.map(m => {
        let timeLeft: number | null = null
        if (m.state === 'returning' && m.returnTime && m.returnTime > now) {
          timeLeft = m.returnTime - now
        } else if (m.state === 'active' && m.arrivalTime > now) {
          timeLeft = m.arrivalTime - now
        } else if (m.state === 'exploring') {
          const holdUntil = m.arrivalTime + (m.holdingTime ?? 0)
          if (holdUntil > now) timeLeft = holdUntil - now
        }

        return (
          <div key={m.id} className="flex items-center justify-between rounded bg-parchment-warm/30 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`font-ui text-[0.65rem] font-semibold ${STATE_COLOR[m.state] ?? 'text-ink-muted'}`}>
                {STATE_LABEL[m.state] ?? m.state}
              </span>
              <span className="font-ui text-xs text-ink">{MISSION_LABEL[m.missionType] ?? m.missionType}</span>
              <span className="font-ui text-[0.6rem] text-ink-muted">
                → {m.targetRealm}:{m.targetRegion}:{m.targetSlot}
              </span>
            </div>
            <span className="font-ui text-xs tabular-nums text-gold font-semibold shrink-0 ml-3">
              {timeLeft !== null && timeLeft > 0 ? formatDuration(timeLeft) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Battle history ────────────────────────────────────────────────────────────

function BattleHistory({ battles, coord }: { battles: NpcProfileBattle[]; coord: string }) {
  if (battles.length === 0) {
    return <p className="font-ui text-xs text-ink-muted/60 py-1">Sin combates registrados</p>
  }
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full font-ui text-xs min-w-[480px]">
        <thead>
          <tr className="border-b border-gold/10">
            {['Fecha', 'Rol', 'Rival', 'Resultado', 'Bajas', 'Botín'].map(h => (
              <th key={h} className="py-2 px-3 text-left text-[0.58rem] uppercase tracking-widest text-ink-muted font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {battles.map(b => {
            const isAtk      = b.attackerCoord === coord
            const rival      = isAtk ? b.defenderName : b.attackerName
            const myLosses   = isAtk ? b.attackerLosses : b.defenderLosses
            const theirLoss  = isAtk ? b.defenderLosses : b.attackerLosses
            const loot       = (b.lootWood ?? 0) + (b.lootStone ?? 0) + (b.lootGrain ?? 0)
            const won        = (isAtk && b.outcome === 'victory') || (!isAtk && b.outcome === 'defeat')
            const draw       = b.outcome === 'draw'
            return (
              <tr key={b.id} className="border-b border-gold/5 hover:bg-parchment-warm/20">
                <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{fmtDate(new Date(b.createdAt).getTime() / 1000)}</td>
                <td className="py-2 px-3">
                  <span className={`badge text-[0.55rem] ${isAtk ? 'badge-crimson' : 'badge-stone'}`}>
                    {isAtk ? 'Atacante' : 'Defensor'}
                  </span>
                </td>
                <td className="py-2 px-3 text-ink max-w-[120px] truncate">{rival}</td>
                <td className={`py-2 px-3 font-semibold ${won ? 'text-forest-light' : draw ? 'text-gold' : 'text-crimson-light'}`}>
                  {won ? '⚔️ Victoria' : draw ? '🤝 Empate' : '💀 Derrota'}
                </td>
                <td className="py-2 px-3 text-crimson-light tabular-nums">
                  {myLosses > 0 ? `−${formatResource(myLosses)}` : '—'}
                  {theirLoss > 0 && <span className="text-ink-muted"> / −{formatResource(theirLoss)}</span>}
                </td>
                <td className="py-2 px-3 text-gold tabular-nums">
                  {isAtk && loot > 0 ? formatResource(loot) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Mission history ───────────────────────────────────────────────────────────

function MissionHistory({ missions }: { missions: NpcProfileMission[] }) {
  if (missions.length === 0) {
    return <p className="font-ui text-xs text-ink-muted/60 py-1">Sin historial</p>
  }
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full font-ui text-xs min-w-[400px]">
        <thead>
          <tr className="border-b border-gold/10">
            {['Fecha', 'Tipo', 'Destino', 'Botín'].map(h => (
              <th key={h} className="py-2 px-3 text-left text-[0.58rem] uppercase tracking-widest text-ink-muted font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {missions.map(m => {
            const loot = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
            return (
              <tr key={m.id} className="border-b border-gold/5 hover:bg-parchment-warm/20">
                <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{fmtDate(m.departureTime)}</td>
                <td className="py-2 px-3 text-ink">{MISSION_LABEL[m.missionType] ?? m.missionType}</td>
                <td className="py-2 px-3 text-ink-muted tabular-nums">{m.targetRealm}:{m.targetRegion}:{m.targetSlot}</td>
                <td className="py-2 px-3 text-gold tabular-nums">{loot > 0 ? formatResource(loot) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <div className="font-ui text-sm font-bold text-ink">{value}</div>
      <div className="font-ui text-[0.58rem] text-ink-muted uppercase tracking-wide mt-0.5">{label}</div>
      {sub && <div className="font-ui text-[0.55rem] text-ink-muted/60">{sub}</div>}
    </div>
  )
}

// ── Main profile layout ───────────────────────────────────────────────────────

export function KingdomProfile({
  kingdom, personality, npcClass: cls, virtualResearch, research, points,
  activeMissions, recentMissions, battles, now,
}: {
  kingdom: NpcProfileKingdom
  personality: string | null
  npcClass: string | null
  virtualResearch: Record<string, number> | null
  research?: Record<string, number>
  points: number
  activeMissions: NpcProfileMission[]
  recentMissions: NpcProfileMission[]
  battles: NpcProfileBattle[]
  now: number
}) {
  const coord = `${kingdom.realm}:${kingdom.region}:${kingdom.slot}`

  const k = kingdom as unknown as Record<string, number>
  const totalCombat  = COMBAT_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)
  const totalSupport = SUPPORT_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)
  const totalDefense = DEFENSE_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)
  const buildAvailIn = (kingdom.npcBuildAvailableAt ?? 0) > now ? (kingdom.npcBuildAvailableAt ?? 0) - now : 0

  // Decide what research data to show
  const hasRealResearch = research && Object.keys(research).length > 0
  const showVirtual     = !!virtualResearch
  const researchSection = showVirtual
    ? { title: 'Investigación virtual', data: virtualResearch }
    : hasRealResearch
      ? { title: 'Investigación', data: research! }
      : null

  return (
    <div className="space-y-4">

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="card-medieval">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <div className="p-5">
          {/* Top row: name + badges */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl text-gold-light">{kingdom.name}</h2>
                {kingdom.isNpc
                  ? <span className="badge badge-stone">NPC</span>
                  : <span className="badge badge-gold">Jugador</span>
                }
              </div>
              <div className="font-ui text-xs text-ink-muted mt-1 flex items-center gap-3 flex-wrap">
                <span className="font-mono">{coord}</span>
                {personality && (
                  <span className="font-ui text-xs text-ink-mid">
                    Personalidad: <strong className="text-ink">{PERSONALITY_LABEL[personality]}</strong>
                  </span>
                )}
                {cls && (
                  <span className="font-ui text-xs text-ink-mid">
                    Clase: <strong className="text-ink">{CLASS_LABEL[cls]}</strong>
                  </span>
                )}
              </div>
            </div>
            {/* Timing meta */}
            <div className="text-right space-y-0.5">
              {buildAvailIn > 0 && (
                <div className="font-ui text-[0.65rem] text-ink-muted">
                  Siguiente build en <span className="text-gold font-semibold">{formatDuration(buildAvailIn)}</span>
                </div>
              )}
              {(kingdom.npcLastAttackAt ?? 0) > 0 && (
                <div className="font-ui text-[0.65rem] text-ink-muted">
                  Último ataque: <span className="text-ink">{fmtDate(kingdom.npcLastAttackAt)}</span>
                </div>
              )}
              <div className="font-ui text-[0.65rem] text-ink-muted">
                Creado: <span className="text-ink">{fmtDate(new Date(kingdom.createdAt).getTime() / 1000)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="divider mb-4"><span className="font-ui text-[0.6rem] text-gold-dim uppercase tracking-widest">Estadísticas</span></div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <Stat label="Puntos"    value={formatResource(points)} />
            <Stat label="Combate"   value={formatResource(totalCombat)}  sub="unidades" />
            <Stat label="Apoyo"     value={formatResource(totalSupport)} sub="unidades" />
            <Stat label="Defensa"   value={formatResource(totalDefense)} sub="estructuras" />
            <Stat label="Misiones"  value={activeMissions.length} sub="activas" />
            <Stat label="Combates"  value={battles.length} sub="registrados" />
          </div>
        </div>
      </div>

      {/* ── Row: Resources ─────────────────────────────────────────────────── */}
      <SectionCard title="Recursos">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <ResourceBar icon="🪵" label="Madera"  value={kingdom.wood}  cap={kingdom.woodCapacity}  prod={kingdom.woodProduction} />
          <ResourceBar icon="⛏️" label="Piedra"  value={kingdom.stone} cap={kingdom.stoneCapacity} prod={kingdom.stoneProduction} />
          <ResourceBar icon="🌾" label="Grano"   value={kingdom.grain} cap={kingdom.grainCapacity} prod={kingdom.grainProduction} />
        </div>
      </SectionCard>

      {/* ── Row: Buildings + Research ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <SectionCard title="Edificios">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            <BuildingGroup title="Producción"     ids={BUILDINGS_PRODUCTION} kingdom={kingdom} />
            <BuildingGroup title="Almacenamiento" ids={BUILDINGS_STORAGE}    kingdom={kingdom} />
            <BuildingGroup title="Utilidades"     ids={BUILDINGS_UTILITY}    kingdom={kingdom} />
          </div>
        </SectionCard>

        {researchSection && (
          <SectionCard title={researchSection.title}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-4">
                <ResearchGroup title="Combate"   ids={RESEARCH_COMBAT}   research={researchSection.data} />
                <ResearchGroup title="Movilidad" ids={RESEARCH_MOBILITY} research={researchSection.data} />
              </div>
              <div className="space-y-4">
                <ResearchGroup title="Arcano" ids={RESEARCH_ARCANE} research={researchSection.data} />
                <ResearchGroup title="Misc"   ids={RESEARCH_MISC}   research={researchSection.data} />
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Row: Army ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="Unidades de combate">
          <UnitTable ids={COMBAT_UNITS} kingdom={kingdom} />
        </SectionCard>
        <SectionCard title="Unidades de apoyo">
          <UnitTable ids={SUPPORT_UNITS} kingdom={kingdom} />
        </SectionCard>
        <SectionCard title="Defensas">
          <UnitTable ids={DEFENSE_UNITS} kingdom={kingdom} />
        </SectionCard>
      </div>

      {/* ── Row: Active missions ───────────────────────────────────────────── */}
      <SectionCard title={`Misiones activas · ${activeMissions.length}`}>
        <ActiveMissionsList missions={activeMissions} now={now} />
      </SectionCard>

      {/* ── Row: Battles + Mission history ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={`Historial de combates · ${battles.length}`}>
          <BattleHistory battles={battles} coord={coord} />
        </SectionCard>
        <SectionCard title={`Misiones completadas (7d) · ${recentMissions.length}`}>
          <MissionHistory missions={recentMissions} />
        </SectionCard>
      </div>

    </div>
  )
}
