import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import { label } from '@/lib/labels'
import type { NpcTickResult, CombatEngineTick, MilitaryAiTick, NpcDecision, NpcCurrentTask, NpcHealthReport } from '../types'

// ── Translation ────────────────────────────────────────────────────────────────

const ID_RE = /\b(sawmill|quarry|grainFarm|windmill|cathedral|workshop|engineersGuild|barracks|granary|stonehouse|silo|academy|alchemistTower|ambassadorHall|armoury|squire|knight|paladin|warlord|grandKnight|siegeMaster|warMachine|dragonKnight|merchant|caravan|colonist|scavenger|scout|archer|crossbowman|ballista|trebuchet|mageTower|dragonCannon|palisade|castleWall|moat|catapult|ballistic|swordsmanship|fortification|horsemanship|cartography|tradeRoutes|spycraft|logistics|exploration|alchemy|pyromancy|runemastery|mysticism|dragonlore|diplomaticNetwork|divineBlessing)\b/g

function translateDecision(text: string | null): string {
  if (!text) return ''
  return text
    .replace(ID_RE, id => label(id))
    .replace(/\bFleetsave\b/g, 'Huida táctica')
    .replace(/\bfleetsave\b/g, 'huida táctica')
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(unix: number, now: number) {
  const d = now - unix
  if (d < 90)   return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)} min`
  return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`
}

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round(n / total * 100) : 0
}

function formatCountdown(secs: number) {
  if (secs <= 0) return 'ahora'
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function FillBar({ value, max, color = 'bg-gold' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.min(100, value / max * 100) : 0
  return (
    <div className="progress-track h-1.5">
      <div className={`progress-fill ${color}`} style={{ width: `${w}%` }} />
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card-medieval p-4 flex flex-col gap-1">
      <div className="card-corner-tr" /><div className="card-corner-bl" />
      <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</span>
      <span className={`font-ui text-2xl font-bold tabular-nums ${accent ?? 'text-ink'}`}>{value}</span>
      {sub && <span className="font-ui text-[0.6rem] text-ink-muted">{sub}</span>}
    </div>
  )
}

function MissionBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`glass rounded-lg p-3 text-center ${count > 0 ? '' : 'opacity-50'}`}>
      <div className={`font-ui text-xl font-bold tabular-nums ${color}`}>{count}</div>
      <div className="font-ui text-[0.6rem] uppercase tracking-wider text-ink-muted mt-0.5">{label}</div>
    </div>
  )
}

function ArmyDistribution({ dist, total }: { dist: Record<string, number>; total: number }) {
  const buckets = [
    { key: '0',     label: 'Sin ejército', color: 'bg-ink-muted/30' },
    { key: '1-10',  label: '1–10',         color: 'bg-gold/40' },
    { key: '11-50', label: '11–50',        color: 'bg-gold/70' },
    { key: '51-200',label: '51–200',       color: 'bg-gold' },
    { key: '200+',  label: '200+',         color: 'bg-forest-light' },
  ]
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded overflow-hidden gap-px">
        {buckets.map(b => {
          const n = dist[b.key] ?? 0
          const w = pct(n, total)
          return w > 0 ? (
            <div key={b.key} className={`${b.color} transition-all`} style={{ width: `${w}%` }}
              title={`${b.label}: ${n} NPCs`} />
          ) : null
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {buckets.map(b => {
          const n = dist[b.key] ?? 0
          if (n === 0) return null
          return (
            <div key={b.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${b.color}`} />
              <span className="font-ui text-[0.6rem] text-ink-muted">{b.label}: <strong className="text-ink">{n}</strong></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BuildingRow({ label, avg, max, weight }: { label: string; avg: number; max: number; weight: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-ui text-xs text-ink-muted w-28 shrink-0">{label}</span>
      <div className="flex-1 space-y-0.5"><FillBar value={avg} max={weight} color="bg-gold/70" /></div>
      <span className="font-ui text-xs tabular-nums text-ink w-20 text-right shrink-0">
        <span className="text-ink-muted text-[0.6rem]">prom.</span> {avg} <span className="text-ink-muted text-[0.6rem]">máx.</span> {max}
      </span>
    </div>
  )
}

function UnitAdoptionRow({ label, withUnit, total, totalUnits, color = 'bg-gold' }: {
  label: string; withUnit: number; total: number; totalUnits: number; color?: string
}) {
  const p = pct(withUnit, total)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-ui text-xs text-ink">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-ui text-[0.6rem] text-ink-muted">{withUnit}/{total} NPCs</span>
          <span className="font-ui text-xs font-semibold text-ink tabular-nums">{formatResource(totalUnits)}</span>
        </div>
      </div>
      <FillBar value={withUnit} max={total} color={p > 50 ? 'bg-forest-light' : p > 10 ? color : 'bg-ink-muted/40'} />
    </div>
  )
}

function ResourceRow({ label, avg, capacity }: { label: string; avg: number; capacity: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-ui text-xs text-ink-muted w-14 shrink-0">{label}</span>
      <div className="flex-1"><FillBar value={avg} max={capacity} color="bg-gold/60" /></div>
      <span className="font-ui text-xs tabular-nums text-ink w-20 text-right shrink-0">{formatResource(avg)}</span>
    </div>
  )
}

// ── Cron status card ───────────────────────────────────────────────────────────

function CronStatusCard({
  name, schedule, lastAt, now, fresh,
  pills,
}: {
  name: string
  schedule: string
  lastAt: number | null
  now: number
  fresh: boolean
  pills: { label: string; value: number; color: string }[]
}) {
  const statusBadge = !lastAt
    ? 'bg-crimson/10 text-crimson-light border-crimson/20'
    : fresh
      ? 'bg-forest/10 text-forest-light border-forest/20'
      : 'bg-gold/10 text-gold border-gold/20'
  const statusLabel = !lastAt ? 'Sin datos' : fresh ? 'Activo' : 'Inactivo'

  return (
    <div className="card-medieval p-4 flex flex-col gap-3">
      <div className="card-corner-tr" /><div className="card-corner-bl" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${lastAt ? (fresh ? 'bg-forest-light animate-pulse' : 'bg-ink-muted') : 'bg-crimson-light'}`} />
          <div className="min-w-0">
            <p className="font-ui text-sm font-semibold text-ink leading-tight truncate">{name}</p>
            <p className="font-ui text-[0.6rem] text-ink-muted">{schedule}</p>
          </div>
        </div>
        <span className={`font-ui text-[0.6rem] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadge}`}>
          {statusLabel}
        </span>
      </div>

      {/* Last tick */}
      <div className="font-ui text-xs text-ink-muted border-t border-gold/8 pt-2">
        {lastAt ? (
          <span>
            Último: <span className="text-ink font-semibold">{formatTs(lastAt)}</span>
            {' '}· hace {timeAgo(lastAt, now)}
          </span>
        ) : (
          <span className="italic">Sin datos aún</span>
        )}
      </div>

      {/* Pills */}
      {pills.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {pills.map(p => (
            <div key={p.label} className="flex items-baseline gap-1.5 bg-parchment-deep/40 rounded px-2 py-1.5">
              <span className={`font-ui text-base font-bold tabular-nums ${p.color}`}>{p.value}</span>
              <span className="font-ui text-[0.6rem] text-ink-muted truncate">{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tick history tables ───────────────────────────────────────────────────────

const PAGE_SIZE = 10

function BuilderHistoryTable({ history }: { history: NpcTickResult[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sorted  = [...history].reverse()
  const rows    = sorted.slice(0, visible)
  const hasMore = visible < sorted.length

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.55rem]">
              <th className="text-left py-2 px-2 whitespace-nowrap">Hora</th>
              <th className="text-right py-2 px-2">Proc.</th>
              <th className="text-right py-2 px-2">Edif.</th>
              <th className="text-right py-2 px-2">Atq.</th>
              <th className="text-right py-2 px-2">Def.</th>
              <th className="text-right py-2 px-2">Apo.</th>
              <th className="text-right py-2 px-2">Invest.</th>
              <th className="text-right py-2 px-2">Espera</th>
              <th className="text-right py-2 px-2">Ahorra</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">Huida</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">Duerme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.at} className={`border-b border-gold/5 transition-colors ${i === 0 ? 'bg-gold/5' : 'hover:bg-parchment-warm/5'}`}>
                <td className="py-1.5 px-2 text-ink-muted tabular-nums whitespace-nowrap">
                  {formatTs(t.at)}
                  {i === 0 && <span className="ml-1.5 font-ui text-[0.5rem] text-gold font-semibold uppercase">último</span>}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.processed ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.builtBuilding ?? 0) > 0 ? 'text-forest-light font-semibold' : 'text-ink-muted'}`}>{t.builtBuilding ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.trainedCombat ?? 0) > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.trainedCombat ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.trainedDefense ?? 0) > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.trainedDefense ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.trainedSupport ?? 0) > 0 ? 'text-gold-light font-semibold' : 'text-ink-muted'}`}>{t.trainedSupport ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.researching ?? 0) > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.researching ?? 0}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.waiting ?? 0}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.saved ?? 0}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums hidden sm:table-cell ${(t.fleetsaved ?? 0) > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.fleetsaved ?? 0}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted hidden sm:table-cell">{t.sleeping ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center pt-1">
          <button onClick={() => setVisible(v => v + PAGE_SIZE)} className="btn btn-ghost text-xs px-4 py-1.5">
            Cargar {Math.min(PAGE_SIZE, sorted.length - visible)} más
            <span className="ml-1.5 font-ui text-[0.6rem] text-ink-muted">({visible}/{sorted.length})</span>
          </button>
        </div>
      )}
    </div>
  )
}

function CombatHistoryTable({ history }: { history: CombatEngineTick[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sorted  = [...history].reverse()
  const rows    = sorted.slice(0, visible)
  const hasMore = visible < sorted.length

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.55rem]">
              <th className="text-left py-2 px-2 whitespace-nowrap">Hora</th>
              <th className="text-right py-2 px-2">NPC vs NPC</th>
              <th className="text-right py-2 px-2">Exped. res.</th>
              <th className="text-right py-2 px-2">Espías res.</th>
              <th className="text-right py-2 px-2">Purgadas</th>
              <th className="text-right py-2 px-2">Intrusiones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.at} className={`border-b border-gold/5 transition-colors ${i === 0 ? 'bg-gold/5' : 'hover:bg-parchment-warm/5'}`}>
                <td className="py-1.5 px-2 text-ink-muted tabular-nums whitespace-nowrap">
                  {formatTs(t.at)}
                  {i === 0 && <span className="ml-1.5 font-ui text-[0.5rem] text-gold font-semibold uppercase">último</span>}
                </td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.npcVsNpcResolved > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.npcVsNpcResolved}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.npcExpeditionsResolved > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.npcExpeditionsResolved}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.npcSpiesResolved ?? 0) > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.npcSpiesResolved ?? 0}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.purged}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.intruderCount > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.intruderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center pt-1">
          <button onClick={() => setVisible(v => v + PAGE_SIZE)} className="btn btn-ghost text-xs px-4 py-1.5">
            Cargar {Math.min(PAGE_SIZE, sorted.length - visible)} más
            <span className="ml-1.5 font-ui text-[0.6rem] text-ink-muted">({visible}/{sorted.length})</span>
          </button>
        </div>
      )}
    </div>
  )
}

function MilitaryHistoryTable({ history }: { history: MilitaryAiTick[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sorted  = [...history].reverse()
  const rows    = sorted.slice(0, visible)
  const hasMore = visible < sorted.length

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.55rem]">
              <th className="text-left py-2 px-2 whitespace-nowrap">Hora</th>
              <th className="text-right py-2 px-2">NPCs</th>
              <th className="text-right py-2 px-2">Ataques</th>
              <th className="text-right py-2 px-2">Carroñeos</th>
              <th className="text-right py-2 px-2">Expediciones</th>
              <th className="text-right py-2 px-2">Coloniz.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.at} className={`border-b border-gold/5 transition-colors ${i === 0 ? 'bg-gold/5' : 'hover:bg-parchment-warm/5'}`}>
                <td className="py-1.5 px-2 text-ink-muted tabular-nums whitespace-nowrap">
                  {formatTs(t.at)}
                  {i === 0 && <span className="ml-1.5 font-ui text-[0.5rem] text-gold font-semibold uppercase">último</span>}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.npcCount}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.attacked > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.attacked}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.scavenged > 0 ? 'text-forest-light font-semibold' : 'text-ink-muted'}`}>{t.scavenged}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.expeditioned > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.expeditioned}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${(t.colonized ?? 0) > 0 ? 'text-gold-light font-semibold' : 'text-ink-muted'}`}>{t.colonized ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center pt-1">
          <button onClick={() => setVisible(v => v + PAGE_SIZE)} className="btn btn-ghost text-xs px-4 py-1.5">
            Cargar {Math.min(PAGE_SIZE, sorted.length - visible)} más
            <span className="ml-1.5 font-ui text-[0.6rem] text-ink-muted">({visible}/{sorted.length})</span>
          </button>
        </div>
      )}
    </div>
  )
}


// ── NPC Decisions card ─────────────────────────────────────────────────────────

const DECISION_FILTERS = [
  { key: 'all',      label: 'Todos'        },
  { key: 'saving',   label: 'Ahorrando'    },
  { key: 'waiting',  label: 'Ocupado'      },
  { key: 'building', label: 'Construyendo' },
  { key: 'training', label: 'Entrenando'   },
] as const

const PERSONALITY_BADGE: Record<string, { label: string; cls: string }> = {
  economy:  { label: 'Eco', cls: 'text-forest-light bg-forest/10 border-forest/20' },
  military: { label: 'Mil', cls: 'text-crimson-light bg-crimson/10 border-crimson/20' },
  balanced: { label: 'Bal', cls: 'text-gold bg-gold/10 border-gold/20' },
}

function decisionColor(text: string | null) {
  if (!text) return 'text-ink-muted'
  const t = text.toLowerCase()
  if (t.startsWith('ahorrando'))      return 'text-ink-muted'
  if (t.startsWith('en cola'))        return 'text-gold'
  if (t.startsWith('ocupado'))        return 'text-gold'
  if (t.startsWith('entrenando'))     return 'text-crimson-light'
  if (t.startsWith('investigando'))   return 'text-gold'
  if (t.startsWith('huida táctica'))  return 'text-crimson-light'
  if (t.startsWith('energía'))        return 'text-crimson-light'
  return 'text-forest-light'
}

// ── Live countdown ─────────────────────────────────────────────────────────────

function useLiveCountdown(finishAt: number | null): number {
  const [secs, setSecs] = useState(() =>
    finishAt ? Math.max(0, finishAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishAt) return
    const tick = () => setSecs(Math.max(0, finishAt - Math.floor(Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishAt])
  return secs
}

function fmtMMSS(secs: number) {
  if (secs <= 0) return '00:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function LiveCountdown({ finishAt }: { finishAt: number }) {
  const secs = useLiveCountdown(finishAt)
  return <span className="tabular-nums">{fmtMMSS(secs)}</span>
}

// Extract building/unit id from "Crecimiento: X → lvN" or "Hito: X → lvN" decisions
function extractBuildFromDecision(text: string | null): { id: string; level: number } | null {
  if (!text) return null
  const m = text.match(/^(?:Crecimiento|Hito|Almacén|Requisito[^:]*):?\s+(\w+)\s*→\s*lv(\d+)/i)
  if (m) return { id: m[1], level: parseInt(m[2], 10) }
  return null
}

// Shows build + research slots as colored badges in the decision column
function DecisionCell({ d, translated }: { d: NpcDecision; translated: string }) {
  const task: NpcCurrentTask | null = d.currentTask
  const now       = Math.floor(Date.now() / 1000)
  const hasTask   = !!task && task.finishAt > now
  const hasResearch = !!d.currentResearch && !!d.researchAvailableAt &&
    d.researchAvailableAt > now

  // When no active deferred task, try to extract a completed build from lastDecision
  const completedBuild = !hasTask ? extractBuildFromDecision(d.lastDecision) : null

  if (!hasTask && !hasResearch && !completedBuild) {
    return translated
      ? <span className={`font-ui text-wrap break-words ${decisionColor(translated)}`}>{translated}</span>
      : <span className="text-ink-muted italic">sin decisión</span>
  }

  return (
    <div className="flex flex-col gap-1">
      {hasTask && task && (
        <div className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/25 rounded px-1.5 py-0.5 w-fit">
          <span className="font-ui text-[0.6rem] uppercase tracking-wider text-gold-dim shrink-0">
            {task.type === 'building' ? 'Edif.' : 'Unit.'}
          </span>
          <span className="font-ui text-xs text-ink font-medium">
            {label(task.targetId)}{task.targetLevel != null ? ` lv${task.targetLevel}` : task.quantity != null ? ` ×${task.quantity}` : ''}
          </span>
          <span className="font-ui text-xs text-gold font-semibold ml-0.5">
            <LiveCountdown finishAt={task.finishAt} />
          </span>
        </div>
      )}
      {!hasTask && completedBuild && (
        <div className="inline-flex items-center gap-1.5 bg-gold/5 border border-gold/15 rounded px-1.5 py-0.5 w-fit">
          <span className="font-ui text-[0.6rem] uppercase tracking-wider text-gold-dim shrink-0">Edif.</span>
          <span className="font-ui text-xs text-ink-mid font-medium">
            {label(completedBuild.id)} lv{completedBuild.level}
          </span>
          <span className="font-ui text-[0.6rem] text-gold-dim ml-0.5">✓</span>
        </div>
      )}
      {hasResearch && d.currentResearch && d.researchAvailableAt && (
        <div className="inline-flex items-center gap-1.5 bg-forest/10 border border-forest/25 rounded px-1.5 py-0.5 w-fit">
          <span className="font-ui text-[0.6rem] uppercase tracking-wider text-forest shrink-0">Inv.</span>
          <span className="font-ui text-xs text-ink font-medium">{label(d.currentResearch)}</span>
          <span className="font-ui text-xs text-forest-light font-semibold ml-0.5">
            <LiveCountdown finishAt={d.researchAvailableAt} />
          </span>
        </div>
      )}
    </div>
  )
}

const DECISIONS_PAGE = 10

function NpcDecisionsCard() {
  const [filter, setFilter] = useState<string>('all')
  const [visible, setVisible] = useState(DECISIONS_PAGE)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'npc-decisions', filter],
    queryFn:  () => adminService.getNpcDecisions(filter),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  })

  const totals: Record<string, number> = data?.totalByFilter ?? {}
  const allDecisions: NpcDecision[]    = data?.decisions ?? []
  const decisions = allDecisions.slice(0, visible)
  const hasMore   = visible < allDecisions.length

  const handleFilterChange = (key: string) => {
    setFilter(key)
    setVisible(DECISIONS_PAGE)
  }

  return (
    <div className="card-medieval p-5 space-y-4">
      <div className="card-corner-tr" /><div className="card-corner-bl" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-heading">Decisiones NPC</h3>
        <span className="font-ui text-[0.6rem] text-ink-muted">refresca c/30s</span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {DECISION_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-3 py-1 rounded-full font-ui text-xs border transition-colors ${
              filter === f.key
                ? 'bg-gold text-parchment border-gold font-semibold'
                : 'bg-transparent text-ink-muted border-gold/20 hover:border-gold/50 hover:text-ink'
            }`}
          >
            {f.label}
            {totals[f.key] != null && (
              <span className={`ml-1.5 tabular-nums ${filter === f.key ? 'text-parchment/80' : 'text-ink-muted'}`}>
                {totals[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="skeleton h-32 rounded-lg" />
      ) : decisions.length === 0 ? (
        <p className="font-ui text-xs text-ink-muted text-center py-6">Sin NPCs en esta categoría.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.6rem]">
                  <th className="text-left py-2 px-2">NPC</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Coord.</th>
                  <th className="text-left py-2 px-2">Decisión</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Próx. check</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map(d => {
                  const pb = PERSONALITY_BADGE[d.personality] ?? PERSONALITY_BADGE.balanced
                  const translated = translateDecision(d.lastDecision)
                  return (
                    <tr key={d.id} className="border-b border-gold/5 hover:bg-parchment-warm/20 transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-semibold border shrink-0 ${pb.cls}`}>
                            {pb.label}
                          </span>
                          <span className="font-ui text-ink font-medium truncate max-w-[140px]">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-ink-muted tabular-nums hidden sm:table-cell">
                        {d.realm}:{d.region}:{d.slot}
                      </td>
                      <td className="py-2 px-2">
                        <DecisionCell d={d} translated={translated} />
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-ink-muted whitespace-nowrap">
                        {d.npcNextCheck ? formatCountdown(d.secsUntilNext) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="text-center pt-1">
              <button
                onClick={() => setVisible(v => v + DECISIONS_PAGE)}
                className="btn btn-ghost text-xs px-4 py-1.5"
              >
                Cargar {Math.min(DECISIONS_PAGE, allDecisions.length - visible)} más
                <span className="ml-1.5 font-ui text-[0.6rem] text-ink-muted">
                  ({visible}/{allDecisions.length})
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Health history ─────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  ok:       { badge: 'bg-forest/15 text-forest-light border-forest/25',  dot: 'bg-forest-light', label: 'OK'       },
  warning:  { badge: 'bg-gold/15   text-gold        border-gold/25',      dot: 'bg-gold',         label: 'Alerta'   },
  critical: { badge: 'bg-crimson/15 text-crimson-light border-crimson/25',dot: 'bg-crimson-light',label: 'Crítico'  },
}

function StatusBadge({ status }: { status: NpcHealthReport['status'] }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ok
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-ui text-xs font-semibold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function HealthHistorySection({ reports }: { reports: NpcHealthReport[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  if (reports.length === 0) {
    return (
      <div className="card-medieval p-5">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading mb-3">Salud NPC — historial (cada 4h)</h3>
        <p className="font-ui text-xs text-ink-muted italic">Sin datos aún — el primer reporte se generará en el próximo ciclo del cron (cada 4h).</p>
      </div>
    )
  }

  const sorted  = [...reports].reverse()
  const latest  = sorted[0]
  const hasAnomalies = sorted.some(r => r.anomalies.length > 0)

  return (
    <div className="card-medieval p-5 space-y-4">
      <div className="card-corner-tr" /><div className="card-corner-bl" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-heading">Salud NPC — historial (cada 4h)</h3>
        <div className="flex items-center gap-3">
          <StatusBadge status={latest.status} />
          <span className="font-ui text-[0.6rem] text-ink-muted">{reports.length} entradas · {formatTs(latest.ts)}</span>
        </div>
      </div>

      {/* Latest anomalies banner */}
      {latest.anomalies.length > 0 && (
        <div className={`rounded-lg p-3 border text-xs space-y-1 ${latest.status === 'critical' ? 'bg-crimson/10 border-crimson/25' : 'bg-gold/10 border-gold/25'}`}>
          {latest.anomalies.map((a, i) => (
            <p key={i} className={`font-ui ${latest.status === 'critical' ? 'text-crimson-light' : 'text-gold'}`}>⚠ {a}</p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.55rem]">
              <th className="text-left py-2 px-2 whitespace-nowrap">Hora</th>
              <th className="text-center py-2 px-2">Estado</th>
              <th className="text-right py-2 px-2">Ahorrando</th>
              <th className="text-right py-2 px-2">Cantera</th>
              <th className="text-right py-2 px-2">Aserrad.</th>
              <th className="text-right py-2 px-2">Piedra/h</th>
              <th className="text-right py-2 px-2">Unidades</th>
              {hasAnomalies && <th className="text-left py-2 px-2">Anomalías</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const m = r.metrics
              const isExpanded = expanded === i
              return (
                <tr
                  key={r.ts}
                  onClick={() => setExpanded(isExpanded ? null : i)}
                  className={`border-b border-gold/5 cursor-pointer transition-colors
                    ${i === 0 ? 'bg-gold/5' : ''}
                    ${r.status === 'critical' ? 'bg-crimson/5' : r.status === 'warning' ? 'bg-gold/5' : ''}
                    hover:bg-parchment-warm/20`}
                >
                  <td className="py-1.5 px-2 text-ink-muted tabular-nums whitespace-nowrap">
                    {formatTs(r.ts)}
                    {i === 0 && <span className="ml-1.5 font-ui text-[0.5rem] text-gold font-semibold uppercase">último</span>}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${m.savingPct >= 85 ? 'text-crimson-light' : m.savingPct >= 60 ? 'text-gold' : 'text-forest-light'}`}>
                    {m.savingPct}%
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${m.avgQuarry < 2 ? 'text-crimson-light' : m.avgQuarry < 4 ? 'text-gold' : 'text-forest-light'}`}>
                    lv{m.avgQuarry}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">lv{m.avgSawmill}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${m.avgStoneProd < 30 ? 'text-crimson-light' : 'text-ink-muted'}`}>
                    {m.avgStoneProd}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${m.totalCombatUnits === 0 ? 'text-ink-muted' : 'text-forest-light font-semibold'}`}>
                    {m.totalCombatUnits === 0 ? '—' : m.totalCombatUnits.toLocaleString()}
                  </td>
                  {hasAnomalies && (
                    <td className="py-1.5 px-2 text-ink-muted">
                      {r.anomalies.length > 0
                        ? <span className={`font-ui text-[0.6rem] ${r.status === 'critical' ? 'text-crimson-light' : 'text-gold'}`}>
                            {r.anomalies.length} anomalía{r.anomalies.length > 1 ? 's' : ''}
                            {isExpanded ? ' ▲' : ' ▼'}
                          </span>
                        : null}
                    </td>
                  )}
                </tr>
                {isExpanded && r.anomalies.length > 0 && (
                  <tr className={`border-b border-gold/5 ${r.status === 'critical' ? 'bg-crimson/5' : 'bg-gold/5'}`}>
                    <td colSpan={hasAnomalies ? 8 : 7} className="py-2 px-4">
                      <ul className="space-y-1">
                        {r.anomalies.map((a, j) => (
                          <li key={j} className={`font-ui text-[0.65rem] ${r.status === 'critical' ? 'text-crimson-light' : 'text-gold'}`}>
                            ⚠ {a}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function NpcMonitorTab() {
  const now = Math.floor(Date.now() / 1000)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'npc-stats'],
    queryFn:  adminService.getNpcStats,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[48, 32, 48, 32].map((h, i) => (
          <div key={i} className={`skeleton h-${h} rounded-xl`} />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <p className="font-ui text-sm text-ink-muted">Sin datos. Los registros se guardan a partir del primer tick del cron.</p>
      </div>
    )
  }

  const { crons, aggregate: agg, healthHistory = [] } = data
  const builderTick    = crons?.builder?.lastTick ?? null
  const combatTick     = crons?.combat?.lastTick ?? null
  const militaryTick   = crons?.militaryAi?.lastTick ?? null

  const FRESH_BUILDER  = 150   // 2.5 min (runs every 1 min)
  const FRESH_COMBAT   = 150
  const FRESH_MILITARY = 1500  // 25 min (runs every 20 min)

  const attackActive   = (agg.missionCounts['attack:active']        ?? 0)
  const expedActive    = (agg.missionCounts['expedition:active']    ?? 0)
                       + (agg.missionCounts['expedition:exploring'] ?? 0)
                       + (agg.missionCounts['expedition:returning'] ?? 0)
  const scavActive     = (agg.missionCounts['scavenge:active']      ?? 0)
  const spyActive      = (agg.missionCounts['spy:active']           ?? 0)
                       + (agg.missionCounts['spy:returning']        ?? 0)
  const colonizeActive = (agg.missionCounts['colonize:active']      ?? 0)
  const totalMissions  = attackActive + expedActive + scavActive + spyActive + colonizeActive

  return (
    <div className="space-y-6">

      {/* ── Cron status cards ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="section-heading">Estado de crons</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <CronStatusCard
            name="Constructor NPC" schedule="Cada minuto"
            lastAt={builderTick?.at ?? null} now={now}
            fresh={!!builderTick && (now - builderTick.at) < FRESH_BUILDER}
            pills={builderTick ? [
              { label: 'edificios',    value: builderTick.builtBuilding ?? 0, color: (builderTick.builtBuilding ?? 0)  > 0 ? 'text-forest-light'  : 'text-ink-muted' },
              { label: 'atq.',         value: builderTick.trainedCombat  ?? 0, color: (builderTick.trainedCombat  ?? 0) > 0 ? 'text-crimson-light' : 'text-ink-muted' },
              { label: 'def.',         value: builderTick.trainedDefense ?? 0, color: (builderTick.trainedDefense ?? 0) > 0 ? 'text-gold'          : 'text-ink-muted' },
              { label: 'investigando', value: builderTick.researching    ?? 0, color: (builderTick.researching    ?? 0) > 0 ? 'text-gold'          : 'text-ink-muted' },
            ] : []}
          />
          <CronStatusCard
            name="Motor de combate" schedule="Cada minuto"
            lastAt={combatTick?.at ?? null} now={now}
            fresh={!!combatTick && (now - combatTick.at) < FRESH_COMBAT}
            pills={combatTick ? [
              { label: 'NPC vs NPC', value: combatTick.npcVsNpcResolved,      color: combatTick.npcVsNpcResolved      > 0 ? 'text-crimson-light' : 'text-ink-muted' },
              { label: 'exped.',     value: combatTick.npcExpeditionsResolved, color: combatTick.npcExpeditionsResolved > 0 ? 'text-gold'         : 'text-ink-muted' },
              { label: 'espías',     value: combatTick.npcSpiesResolved ?? 0,  color: (combatTick.npcSpiesResolved ?? 0) > 0 ? 'text-gold'        : 'text-ink-muted' },
              { label: 'intrus.',    value: combatTick.intruderCount,          color: combatTick.intruderCount         > 0 ? 'text-crimson-light' : 'text-ink-muted' },
            ] : []}
          />
          <CronStatusCard
            name="IA Militar NPC" schedule="Cada 20 min"
            lastAt={militaryTick?.at ?? null} now={now}
            fresh={!!militaryTick && (now - militaryTick.at) < FRESH_MILITARY}
            pills={militaryTick ? [
              { label: 'ataques',   value: militaryTick.attacked,        color: militaryTick.attacked        > 0 ? 'text-crimson-light' : 'text-ink-muted' },
              { label: 'carroñeos', value: militaryTick.scavenged,       color: militaryTick.scavenged       > 0 ? 'text-forest-light'  : 'text-ink-muted' },
              { label: 'exped.',    value: militaryTick.expeditioned,     color: militaryTick.expeditioned    > 0 ? 'text-gold'          : 'text-ink-muted' },
              { label: 'coloniz.',  value: militaryTick.colonized ?? 0,   color: (militaryTick.colonized ?? 0) > 0 ? 'text-gold-light'  : 'text-ink-muted' },
            ] : []}
          />
        </div>
      </div>

      {/* ── Overview metrics ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total NPCs"    value={agg.total}    sub={`${agg.bosses} jefe(s)`} />
        <MetricCard label="Con ejército"  value={`${pct(agg.withArmy, agg.total)}%`}
          sub={`${agg.withArmy} de ${agg.total}`}
          accent={agg.withArmy > agg.total * 0.5 ? 'text-forest-light' : 'text-gold'} />
        <MetricCard label="Ejército avg"  value={agg.avgArmy}  sub={`max ${agg.maxArmy}`} />
        <MetricCard label="Misiones act." value={totalMissions}
          sub={`${attackActive} ataques · ${expedActive} exped.`}
          accent={totalMissions > 0 ? 'text-gold' : 'text-ink'} />
      </div>

      {/* ── Buildings ──────────────────────────────────────────────────────────── */}
      <div className="card-medieval p-5 space-y-4">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Edificios (prom / máx)</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {([
            ['Aserradero',          agg.avgSawmill,        agg.maxSawmill,        15],
            ['Cantera',             agg.avgQuarry,         agg.maxQuarry,         15],
            ['Granja de Grano',     agg.avgGrainFarm,      agg.maxGrainFarm,      15],
            ['Molino de Viento',    agg.avgWindmill,       agg.maxWindmill,       15],
            ['Catedral',            agg.avgCathedral,      agg.maxCathedral,      10],
            ['Taller',              agg.avgWorkshop,       agg.maxWorkshop,       10],
            ['Gremio de Ingenieros',agg.avgEngineersGuild, agg.maxEngineersGuild,  8],
            ['Cuartel',             agg.avgBarracks,       agg.maxBarracks,       10],
            ['Academia',            agg.avgAcademy,        agg.maxAcademy,        10],
            ['Granero',             agg.avgGranary,        agg.maxGranary,        10],
            ['Casa de Piedra',      agg.avgStonehouse,     agg.maxStonehouse,     10],
            ['Silo',                agg.avgSilo,           agg.maxSilo,           10],
            ['Expansor de Dominio', agg.avgAlchemistTower, agg.maxAlchemistTower,  5],
            ['Salón Embajadores',   agg.avgAmbassadorHall, agg.maxAmbassadorHall,  8],
            ['Armería',             agg.avgArmoury,        agg.maxArmoury,         8],
          ] as [string, number, number, number][]).map(([lbl, avgVal, maxVal, weight]) => (
            <BuildingRow key={lbl} label={lbl} avg={avgVal} max={maxVal} weight={weight} />
          ))}
        </div>
      </div>

      {/* ── Research progression ───────────────────────────────────────────────── */}
      {agg.researchStats && (
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Investigaciones NPC (prom / máx · adopción)</h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {([
              ['Alquimia',             'alchemy',           8],
              ['Piromancia',           'pyromancy',         6],
              ['Maestría Rúnica',      'runemastery',       5],
              ['Misticismo',           'mysticism',         4],
              ['Conocimiento Dracónico','dragonlore',       3],
              ['Esgrima',              'swordsmanship',     8],
              ['Armadura',             'armoury',           8],
              ['Fortificación',        'fortification',     8],
              ['Equitación',           'horsemanship',      6],
              ['Cartografía',          'cartography',       6],
              ['Rutas Comerciales',    'tradeRoutes',       5],
              ['Logística',            'logistics',         5],
              ['Arte del Espionaje',   'spycraft',          4],
              ['Exploración',          'exploration',       3],
              ['Red Diplomática',      'diplomaticNetwork', 3],
            ] as [string, string, number][]).map(([lbl, key, weight]) => {
              const cap = key.charAt(0).toUpperCase() + key.slice(1)
              const avgVal  = (agg.researchStats[`avg${cap}`] ?? 0) as number
              const maxVal  = (agg.researchStats[`max${cap}`] ?? 0) as number
              const withVal = (agg.researchStats[`with${cap}`] ?? 0) as number
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="font-ui text-xs text-ink-muted w-36 shrink-0">{lbl}</span>
                  <div className="flex-1 space-y-0.5"><FillBar value={avgVal} max={weight} color="bg-gold/70" /></div>
                  <span className="font-ui text-xs tabular-nums text-ink w-28 text-right shrink-0">
                    <span className="text-ink-muted text-[0.6rem]">pr.</span> {avgVal}{' '}
                    <span className="text-ink-muted text-[0.6rem]">máx.</span> {maxVal}{' '}
                    <span className="text-ink-muted text-[0.6rem]">({withVal}/{agg.total})</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Army distribution ──────────────────────────────────────────────────── */}
      <div className="card-medieval p-5 space-y-4">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Distribución del ejército</h3>
        <ArmyDistribution dist={agg.armyDistribution} total={agg.total} />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="glass rounded p-2.5 text-center">
            <div className="font-ui text-base font-bold text-ink tabular-nums">{agg.avgArmy}</div>
            <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Avg</div>
          </div>
          <div className="glass rounded p-2.5 text-center">
            <div className="font-ui text-base font-bold text-ink tabular-nums">{agg.maxArmy}</div>
            <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Máx</div>
          </div>
          <div className="glass rounded p-2.5 text-center">
            <div className="font-ui text-base font-bold text-gold tabular-nums">{formatResource(agg.totalSquire)}</div>
            <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Escuderos</div>
          </div>
        </div>
      </div>

      {/* ── Combat units + Support units ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Ejército de combate</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Escudero"        withUnit={agg.withArmy}        total={agg.total} totalUnits={agg.totalSquire}      color="bg-gold/60" />
            <UnitAdoptionRow label="Caballero"       withUnit={agg.withKnight}      total={agg.total} totalUnits={agg.totalKnight}      color="bg-gold/70" />
            <UnitAdoptionRow label="Paladín"         withUnit={agg.withPaladin}     total={agg.total} totalUnits={agg.totalPaladin}     color="bg-gold" />
            <UnitAdoptionRow label="Señor de guerra" withUnit={agg.withWarlord}     total={agg.total} totalUnits={agg.totalWarlord}     color="bg-gold" />
            <UnitAdoptionRow label="Gran Caballero"  withUnit={agg.withGrandKnight} total={agg.total} totalUnits={agg.totalGrandKnight} color="bg-forest-light" />
          </div>
        </div>

        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Unidades de apoyo</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Mercader"   withUnit={agg.withMerchant}  total={agg.total} totalUnits={agg.totalMerchant}  />
            <UnitAdoptionRow label="Caravana"   withUnit={agg.withCaravan}   total={agg.total} totalUnits={agg.totalCaravan}   />
            <UnitAdoptionRow label="Carroñero"  withUnit={agg.withScavenger} total={agg.total} totalUnits={agg.totalScavenger} />
            <UnitAdoptionRow label="Explorador" withUnit={agg.withScout}     total={agg.total} totalUnits={agg.totalScout}     color="bg-gold/60" />
            <UnitAdoptionRow label="Colonista"  withUnit={agg.withColonist}  total={agg.total} totalUnits={agg.totalColonist}  color="bg-gold-light/60" />
          </div>
          {agg.withMerchant === 0 && agg.withCaravan === 0 && agg.withScavenger === 0 && (
            <p className="font-body text-xs text-ink-muted italic pt-1">
              Los NPCs economía/equilibrado empezarán a entrenar Mercader en cuanto alcancen Cuartel lv2.
            </p>
          )}
        </div>
      </div>

      {/* ── Defenses + Resources ────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Defensas</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Arquero"    withUnit={agg.withArcher}      total={agg.total} totalUnits={agg.totalArcher}      color="bg-gold/60" />
            <UnitAdoptionRow label="Ballestero" withUnit={agg.withCrossbowman} total={agg.total} totalUnits={agg.totalCrossbowman} color="bg-gold/70" />
            <UnitAdoptionRow label="Ballista"   withUnit={agg.withBallista}    total={agg.total} totalUnits={agg.totalBallista}    color="bg-gold" />
            <UnitAdoptionRow label="Trebuchet"  withUnit={agg.withTrebuchet}   total={agg.total} totalUnits={agg.totalTrebuchet}   color="bg-gold" />
            <UnitAdoptionRow label="Torre Maga" withUnit={agg.withMageTower}   total={agg.total} totalUnits={agg.totalMageTower}   color="bg-forest-light" />
            <UnitAdoptionRow label="Muralla"    withUnit={agg.withCastleWall}  total={agg.total} totalUnits={agg.totalCastleWall}  color="bg-ink-mid" />
            <UnitAdoptionRow label="Foso"       withUnit={agg.withMoat}        total={agg.total} totalUnits={agg.totalMoat}        color="bg-ink-mid" />
          </div>
        </div>

        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Recursos (prom. por NPC)</h3>
          <div className="space-y-3">
            <ResourceRow label="Madera" avg={agg.avgWood}  capacity={50000} />
            <ResourceRow label="Piedra" avg={agg.avgStone} capacity={50000} />
            <ResourceRow label="Grano"  avg={agg.avgGrain} capacity={50000} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: 'Madera', value: agg.avgWood },
              { label: 'Piedra', value: agg.avgStone },
              { label: 'Grano',  value: agg.avgGrain },
            ].map(r => (
              <div key={r.label} className="glass rounded p-2.5 text-center">
                <div className="font-ui text-sm font-bold text-ink tabular-nums">{formatResource(r.value)}</div>
                <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active missions ──────────────────────────────────────────────────────── */}
      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Misiones activas</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <MissionBadge label="Ataques"      count={attackActive}   color="text-crimson-light" />
          <MissionBadge label="Carroñeo"     count={scavActive}     color="text-forest-light" />
          <MissionBadge label="Expediciones" count={expedActive}    color="text-gold" />
          <MissionBadge label="Espías"       count={spyActive}      color="text-gold" />
          <MissionBadge label="Coloniz."     count={colonizeActive} color="text-gold-light" />
        </div>
      </div>

      {/* ── NPC Decisions ────────────────────────────────────────────────────────── */}
      <NpcDecisionsCard />

      {/* ── Health history ──────────────────────────────────────────────────────── */}
      <HealthHistorySection reports={healthHistory} />

      {/* ── Tick histories ───────────────────────────────────────────────────────── */}
      {(crons?.builder?.tickHistory?.length ?? 0) > 0 && (
        <div className="card-medieval p-5 space-y-3">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Historial — Constructor NPC</h3>
          <BuilderHistoryTable history={crons.builder.tickHistory} />
        </div>
      )}

      {(crons?.combat?.tickHistory?.length ?? 0) > 0 && (
        <div className="card-medieval p-5 space-y-3">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <div className="flex items-center justify-between">
            <h3 className="section-heading">Historial — Motor de combate</h3>
            <span className="font-ui text-[0.6rem] text-ink-muted">{crons.combat.tickHistory.length} entradas</span>
          </div>
          <CombatHistoryTable history={crons.combat.tickHistory} />
        </div>
      )}

      {(crons?.militaryAi?.tickHistory?.length ?? 0) > 0 && (
        <div className="card-medieval p-5 space-y-3">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <div className="flex items-center justify-between">
            <h3 className="section-heading">Historial — IA Militar</h3>
            <span className="font-ui text-[0.6rem] text-ink-muted">{crons.militaryAi.tickHistory.length} entradas</span>
          </div>
          <MilitaryHistoryTable history={crons.militaryAi.tickHistory} />
        </div>
      )}

    </div>
  )
}
