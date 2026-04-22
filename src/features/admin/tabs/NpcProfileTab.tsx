import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource, formatDuration } from '@/lib/format'
import { BUILDING_LABELS, RESEARCH_LABELS, UNIT_LABELS } from '@/lib/labels'
import type { NpcProfileKingdom, NpcProfileMission, NpcProfileBattle } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

const PERSONALITY_LABELS = { economy: 'Economía', military: 'Militar', balanced: 'Equilibrado' }
const CLASS_LABELS = { collector: 'Recolector', general: 'General', discoverer: 'Descubridor' }

const PERSONALITY_COLOR: Record<string, string> = {
  economy:  'badge-forest',
  military: 'badge-crimson',
  balanced: 'badge-gold',
}
const CLASS_COLOR: Record<string, string> = {
  collector: 'badge-gold',
  general:   'badge-crimson',
  discoverer:'badge-stone',
}

const MISSION_TYPE_LABELS: Record<string, string> = {
  attack: '⚔️ Ataque', transport: '📦 Transporte', spy: '🔍 Espionaje',
  colonize: '🏰 Colonizar', scavenge: '♻️ Recogida', deploy: '🚩 Despliegue',
  expedition: '🧭 Expedición', missile: '💥 Misil', pillage: '⚡ Saqueo',
}

const STATE_LABELS: Record<string, string> = {
  active: 'En camino', exploring: 'Explorando', returning: 'Regresando',
  merchant: 'Mercader', completed: 'Completada',
}

const STATE_COLOR: Record<string, string> = {
  active: 'text-gold', exploring: 'text-forest-light',
  returning: 'text-ink-mid', merchant: 'text-gold-light', completed: 'text-ink-muted',
}

function ts(unix: number) {
  return new Date(unix * 1000).toLocaleString('es-ES', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-ui text-[0.65rem] font-semibold uppercase tracking-widest text-ink-muted mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  )
}


function LevelGrid({ entries }: { entries: [string, number][] }) {
  const nonZero = entries.filter(([, v]) => v > 0)
  const zero    = entries.filter(([, v]) => v === 0)
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...nonZero, ...zero].map(([id, lv]) => (
        <div
          key={id}
          className={`flex items-center gap-1.5 rounded px-2 py-1 ${lv > 0 ? 'glass' : 'opacity-30 glass'}`}
        >
          <span className="font-ui text-[0.6rem] text-ink-muted">{BUILDING_LABELS[id] ?? RESEARCH_LABELS[id] ?? id}</span>
          <span className={`font-ui text-[0.65rem] font-bold ${lv > 0 ? 'text-gold' : 'text-ink-muted'}`}>
            Nv.{lv}
          </span>
        </div>
      ))}
    </div>
  )
}

function UnitGrid({ entries }: { entries: [string, number][] }) {
  const nonZero = entries.filter(([, v]) => v > 0)
  if (nonZero.length === 0) return <p className="font-ui text-xs text-ink-muted">Ninguna</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {nonZero.map(([id, n]) => (
        <div key={id} className="glass rounded px-2 py-1 flex items-center gap-1.5">
          <span className="font-ui text-[0.6rem] text-ink-muted">{UNIT_LABELS[id] ?? id}</span>
          <span className="font-ui text-[0.65rem] font-bold text-ink">{formatResource(n)}</span>
        </div>
      ))}
    </div>
  )
}

function ResourceBar({ label, value, cap, prod }: { label: string; value: number; cap: number; prod: number }) {
  const pct = cap > 0 ? Math.min(100, (value / cap) * 100) : 0
  const full = pct >= 99.9
  return (
    <div className="glass rounded px-3 py-2 space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="font-ui text-xs font-semibold text-ink">{label}</span>
        <span className={`font-ui text-xs tabular-nums ${full ? 'text-crimson-light font-bold' : 'text-ink-mid'}`}>
          {formatResource(value)} / {formatResource(cap)}
        </span>
      </div>
      <div className="progress-track h-1.5">
        <div className={`progress-fill h-full ${full ? 'full' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="font-ui text-[0.58rem] text-ink-muted">+{formatResource(prod)}/h</div>
    </div>
  )
}

function MissionTable({ missions, now, isActive }: { missions: NpcProfileMission[]; now: number; isActive: boolean }) {
  if (missions.length === 0) return <p className="font-ui text-xs text-ink-muted py-3">Sin misiones.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-ui text-xs">
        <thead>
          <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider text-[0.58rem]">
            <th className="text-left py-1.5 px-2">Tipo</th>
            <th className="text-left py-1.5 px-2">Destino</th>
            <th className="text-left py-1.5 px-2">Estado</th>
            <th className="text-right py-1.5 px-2">{isActive ? 'Tiempo' : 'Salida'}</th>
            {!isActive && <th className="text-right py-1.5 px-2">Botín</th>}
          </tr>
        </thead>
        <tbody>
          {missions.map(m => {
            const loot = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
            const timeLeft = isActive
              ? (m.state === 'returning' && m.returnTime ? m.returnTime - now : m.arrivalTime - now)
              : null
            return (
              <tr key={m.id} className="border-b border-gold/5 hover:bg-parchment-warm/3">
                <td className="py-1.5 px-2 text-ink">{MISSION_TYPE_LABELS[m.missionType] ?? m.missionType}</td>
                <td className="py-1.5 px-2 text-ink-muted tabular-nums">
                  {m.targetRealm}:{m.targetRegion}:{m.targetSlot}
                </td>
                <td className={`py-1.5 px-2 font-semibold ${STATE_COLOR[m.state] ?? 'text-ink-muted'}`}>
                  {STATE_LABELS[m.state] ?? m.state}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">
                  {isActive && timeLeft !== null && timeLeft > 0
                    ? formatDuration(timeLeft)
                    : ts(m.departureTime)}
                </td>
                {!isActive && (
                  <td className="py-1.5 px-2 text-right tabular-nums text-gold">
                    {loot > 0 ? formatResource(loot) : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BattleTable({ battles, coord }: { battles: NpcProfileBattle[]; coord: string }) {
  if (battles.length === 0) return <p className="font-ui text-xs text-ink-muted py-3">Sin combates.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-ui text-xs">
        <thead>
          <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider text-[0.58rem]">
            <th className="text-left py-1.5 px-2">Fecha</th>
            <th className="text-left py-1.5 px-2">Rol</th>
            <th className="text-left py-1.5 px-2">Rival</th>
            <th className="text-center py-1.5 px-2">Resultado</th>
            <th className="text-right py-1.5 px-2">Bajas propias</th>
            <th className="text-right py-1.5 px-2">Bajas rival</th>
            <th className="text-right py-1.5 px-2">Botín</th>
          </tr>
        </thead>
        <tbody>
          {battles.map(b => {
            const isAttacker = b.attackerCoord === coord
            const rival      = isAttacker ? b.defenderName : b.attackerName
            const myLosses   = isAttacker ? b.attackerLosses : b.defenderLosses
            const theirLosses= isAttacker ? b.defenderLosses : b.attackerLosses
            const loot       = (b.lootWood ?? 0) + (b.lootStone ?? 0) + (b.lootGrain ?? 0)
            const won = (isAttacker && b.outcome === 'victory') || (!isAttacker && b.outcome === 'defeat')
            const resultColor = won ? 'text-forest-light' : b.outcome === 'draw' ? 'text-gold' : 'text-crimson-light'
            const resultLabel = won ? '⚔️ Victoria' : b.outcome === 'draw' ? '🤝 Empate' : '💀 Derrota'
            return (
              <tr key={b.id} className="border-b border-gold/5 hover:bg-parchment-warm/3">
                <td className="py-1.5 px-2 text-ink-muted whitespace-nowrap">
                  {new Date(b.createdAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-1.5 px-2">
                  {isAttacker
                    ? <span className="badge badge-crimson text-[0.55rem]">Atacante</span>
                    : <span className="badge badge-stone text-[0.55rem]">Defensor</span>}
                </td>
                <td className="py-1.5 px-2 text-ink">{rival}</td>
                <td className={`py-1.5 px-2 text-center font-bold ${resultColor}`}>{resultLabel}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-crimson-light">
                  {myLosses > 0 ? `-${formatResource(myLosses)}` : '—'}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-crimson-light">
                  {theirLosses > 0 ? `-${formatResource(theirLosses)}` : '—'}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gold">
                  {isAttacker && loot > 0 ? formatResource(loot) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main kingdom profile card ─────────────────────────────────────────────────

function KingdomProfile({
  kingdom, personality, npcClass: cls, virtualResearch, points, activeMissions, recentMissions, battles, now,
}: {
  kingdom: NpcProfileKingdom
  personality: string | null
  npcClass: string | null
  virtualResearch: Record<string, number> | null
  points: number
  activeMissions: NpcProfileMission[]
  recentMissions: NpcProfileMission[]
  battles: NpcProfileBattle[]
  now: number
}) {
  const coord = `${kingdom.realm}:${kingdom.region}:${kingdom.slot}`

  const BUILDINGS_ORDER = [
    'sawmill','quarry','grainFarm','windmill','cathedral',
    'granary','stonehouse','silo',
    'workshop','engineersGuild','barracks','academy',
    'alchemistTower','ambassadorHall','armoury',
  ] as const

  const RESEARCH_ORDER = [
    'swordsmanship','armoury','fortification',
    'horsemanship','cartography','tradeRoutes',
    'alchemy','pyromancy','runemastery','mysticism','dragonlore',
    'spycraft','logistics','exploration','diplomaticNetwork','divineBlessing',
  ] as const

  const COMBAT_UNITS   = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight'] as const
  const SUPPORT_UNITS  = ['merchant','caravan','colonist','scavenger','scout'] as const
  const DEFENSE_UNITS  = ['archer','crossbowman','ballista','trebuchet','mageTower','dragonCannon','palisade','castleWall','moat','catapult','ballistic'] as const

  const buildAvailable = kingdom.npcBuildAvailableAt ?? 0
  const lastAttack     = kingdom.npcLastAttackAt ?? 0
  const canBuildIn     = buildAvailable > now ? buildAvailable - now : 0

  const totalMobile = COMBAT_UNITS.reduce((s, u) => s + (kingdom[u] ?? 0), 0)
    + SUPPORT_UNITS.reduce((s, u) => s + (kingdom[u] ?? 0), 0)
  const totalDef    = DEFENSE_UNITS.reduce((s, u) => s + (kingdom[u] ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-base text-gold-light">{kingdom.name}</h2>
            {kingdom.isBoss && <span className="badge badge-crimson">🐉 Jefe</span>}
            {kingdom.isNpc  && !kingdom.isBoss && <span className="badge badge-stone">NPC</span>}
            {kingdom.npcLevel > 0 && <span className="badge badge-gold">Nivel {kingdom.npcLevel}</span>}
            {personality && (
              <span className={`badge ${PERSONALITY_COLOR[personality]}`}>
                {PERSONALITY_LABELS[personality as keyof typeof PERSONALITY_LABELS]}
              </span>
            )}
            {cls && (
              <span className={`badge ${CLASS_COLOR[cls]}`}>
                {CLASS_LABELS[cls as keyof typeof CLASS_LABELS]}
              </span>
            )}
          </div>
          <div className="font-ui text-[0.65rem] text-ink-muted mt-0.5">
            {coord} · {formatResource(points)} puntos
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="font-ui text-[0.6rem] text-ink-muted">
            Ejército: <span className="text-ink font-semibold">{formatResource(totalMobile)}</span> móvil
            · <span className="text-ink font-semibold">{formatResource(totalDef)}</span> def
          </div>
          {canBuildIn > 0 && (
            <div className="font-ui text-[0.6rem] text-ink-muted">
              Construye en: <span className="text-gold">{formatDuration(canBuildIn)}</span>
            </div>
          )}
          {lastAttack > 0 && (
            <div className="font-ui text-[0.6rem] text-ink-muted">
              Último ataque: <span className="text-ink">{ts(lastAttack)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Resources */}
      <div>
        <SectionTitle>Recursos</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ResourceBar label="Madera"  value={kingdom.wood}  cap={kingdom.woodCapacity}  prod={kingdom.woodProduction} />
          <ResourceBar label="Piedra"  value={kingdom.stone} cap={kingdom.stoneCapacity} prod={kingdom.stoneProduction} />
          <ResourceBar label="Grano"   value={kingdom.grain} cap={kingdom.grainCapacity} prod={kingdom.grainProduction} />
        </div>
      </div>

      {/* Buildings */}
      <div>
        <SectionTitle>Edificios</SectionTitle>
        <LevelGrid entries={BUILDINGS_ORDER.map(id => [id, kingdom[id] ?? 0])} />
      </div>

      {/* Virtual research */}
      {virtualResearch && (
        <div>
          <SectionTitle>Investigación virtual (derivada de edificios)</SectionTitle>
          <LevelGrid entries={RESEARCH_ORDER.map(id => [id, virtualResearch[id] ?? 0])} />
        </div>
      )}

      {/* Units */}
      <div>
        <SectionTitle>Unidades de combate</SectionTitle>
        <UnitGrid entries={COMBAT_UNITS.map(id => [id, kingdom[id] ?? 0])} />
      </div>
      <div>
        <SectionTitle>Unidades de apoyo</SectionTitle>
        <UnitGrid entries={SUPPORT_UNITS.map(id => [id, kingdom[id] ?? 0])} />
      </div>
      <div>
        <SectionTitle>Defensas</SectionTitle>
        <UnitGrid entries={DEFENSE_UNITS.map(id => [id, kingdom[id] ?? 0])} />
      </div>

      {/* Active missions */}
      <div>
        <SectionTitle>Misiones activas ({activeMissions.length})</SectionTitle>
        <MissionTable missions={activeMissions} now={now} isActive />
      </div>

      {/* Recent completed missions */}
      <div>
        <SectionTitle>Historial de misiones · últimos 7 días ({recentMissions.length})</SectionTitle>
        <MissionTable missions={recentMissions} now={now} isActive={false} />
      </div>

      {/* Battle history */}
      <div>
        <SectionTitle>Historial de combates ({battles.length})</SectionTitle>
        <BattleTable battles={battles} coord={coord} />
      </div>
    </div>
  )
}

// ── Tab root ──────────────────────────────────────────────────────────────────

export function NpcProfileTab() {
  const [realm,  setRealm]  = useState('1')
  const [region, setRegion] = useState('1')
  const [slot,   setSlot]   = useState('1')
  const [query,  setQuery]  = useState<{ realm: number; region: number; slot: number } | null>(null)

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'npc-profile', query?.realm, query?.region, query?.slot],
    queryFn: () => adminService.getNpcProfile(query!.realm, query!.region, query!.slot),
    enabled: !!query,
    refetchInterval: 10_000,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const r  = Math.max(1, Math.min(3,  parseInt(realm)  || 1))
    const rg = Math.max(1, Math.min(10, parseInt(region) || 1))
    const sl = Math.max(1, Math.min(15, parseInt(slot)   || 1))
    setQuery({ realm: r, region: rg, slot: sl })
  }

  return (
    <div className="space-y-5">

      {/* Coordinate form */}
      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        {([
          { label: 'Reino',   val: realm,  set: setRealm,  placeholder: '1–3'  },
          { label: 'Región',  val: region, set: setRegion, placeholder: '1–10' },
          { label: 'Slot',    val: slot,   set: setSlot,   placeholder: '1–15' },
        ] as const).map(({ label, val, set, placeholder }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</label>
            <input
              type="text" inputMode="numeric" value={val} placeholder={placeholder}
              onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
              className="game-input w-20 text-center"
            />
          </div>
        ))}
        <button type="submit" className="btn btn-primary px-5 py-2 text-xs">
          Buscar
        </button>
        {query && (
          <div className="font-ui text-[0.65rem] text-ink-muted self-end pb-2">
            Consultando {query.realm}:{query.region}:{query.slot}
          </div>
        )}
      </form>

      {/* Loading / error / result */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
        </div>
      )}

      {error && (
        <div className="glass rounded px-4 py-3 text-crimson-light font-ui text-sm">
          {(error as Error).message.includes('404')
            ? 'No hay reino en esas coordenadas.'
            : 'Error al cargar el perfil.'}
        </div>
      )}

      {data && !isLoading && (
        <KingdomProfile
          kingdom={data.kingdom}
          personality={data.personality}
          npcClass={data.npcClass}
          virtualResearch={data.virtualResearch}
          points={data.points}
          activeMissions={data.activeMissions}
          recentMissions={data.recentMissions}
          battles={data.battles}
          now={now}
        />
      )}
    </div>
  )
}
