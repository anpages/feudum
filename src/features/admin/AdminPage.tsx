import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Settings, Users, Zap, Swords, Loader2, ChevronDown, Save, Bot } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/useAuth'
import {
  useAdminSettings,
  useAdminUsers,
  useAdminFleet,
  useUpdateSettings,
  useToggleAdmin,
  useDevAction,
  useFastForward,
  useSeedNpcs,
} from '@/features/admin/useAdmin'
import { formatDuration } from '@/lib/format'

// ─── Auth guard ───────────────────────────────────────────────────────────────
// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'server' | 'players' | 'dev' | 'missions'

const TABS: { id: Tab; label: string; Icon: typeof Settings }[] = [
  { id: 'server', label: 'Servidor', Icon: Settings },
  { id: 'players', label: 'Jugadores', Icon: Users },
  { id: 'dev', label: 'Dev', Icon: Zap },
  { id: 'missions', label: 'Misiones', Icon: Swords },
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminPage() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('server')

  if (isLoading) return null
  if (!user?.isAdmin) return <Navigate to="/overview" replace />

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Sistema</span>
        <h1 className="page-title mt-0.5">Panel de administración</h1>
      </div>

      <div className="flex gap-1 border-b border-gold/10 anim-fade-up-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-ui text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px whitespace-nowrap
              ${tab === id ? 'text-gold border-gold' : 'text-ink-muted border-transparent hover:text-ink'}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="anim-fade-up-2">
        {tab === 'server' && <ServerTab />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'dev' && <DevTab />}
        {tab === 'missions' && <MissionsTab />}
      </div>
    </div>
  )
}

// ─── Server Settings Tab ──────────────────────────────────────────────────────
const SETTINGS_META: { key: string; label: string; hint: string; integer?: boolean }[] = [
  {
    key: 'economy_speed',
    label: 'Velocidad economía',
    hint: 'Producción de recursos y tiempo de construcción',
  },
  { key: 'research_speed', label: 'Velocidad investigación', hint: 'Tiempo de laboratorio' },
  { key: 'fleet_speed_war', label: 'Velocidad flota (guerra)', hint: 'Ataque, pillaje, espionaje' },
  {
    key: 'fleet_speed_peaceful',
    label: 'Velocidad flota (paz)',
    hint: 'Transporte, colonización, despliegue',
  },
  { key: 'basic_wood', label: 'Madera base/h', hint: 'Ingreso sin edificios', integer: true },
  { key: 'basic_stone', label: 'Piedra base/h', hint: 'Ingreso sin edificios', integer: true },
]

function ServerTab() {
  const { data, isLoading } = useAdminSettings()
  const update = useUpdateSettings()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />

  async function saveField(key: string) {
    const raw = values[key]
    if (raw === undefined) return
    const num = key === 'basic_wood' || key === 'basic_stone' ? parseInt(raw, 10) : parseFloat(raw)
    if (isNaN(num) || num < 0) return
    await update.mutateAsync({ [key]: num } as any)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  function getDisplayValue(key: string) {
    if (values[key] !== undefined) return values[key]
    return String((data as any)?.[key] ?? '')
  }

  return (
    <div className="space-y-2 max-w-xl">
      {SETTINGS_META.map(({ key, label, hint, integer }) => (
        <Card key={key} className="p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-ui text-sm font-semibold text-ink">{label}</p>
            <p className="font-body text-[11px] text-ink-muted/70 mt-0.5">{hint}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              inputMode={integer ? 'numeric' : 'decimal'}
              value={getDisplayValue(key)}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveField(key)}
              className="game-input w-24 text-center text-sm tabular-nums"
            />
            <Button
              variant={saved === key ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => saveField(key)}
              disabled={update.isPending || values[key] === undefined}
            >
              {update.isPending && saved !== key ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {saved === key ? '✓' : 'OK'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Players Tab ──────────────────────────────────────────────────────────────
function PlayersTab() {
  const { data, isLoading } = useAdminUsers()
  const toggle = useToggleAdmin()

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const users = data?.users ?? []

  return (
    <Card className="divide-y divide-gold/10 max-w-2xl">
      {users.length === 0 && (
        <p className="p-5 font-body text-sm text-ink-muted text-center">Sin jugadores</p>
      )}
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-ui text-sm text-ink font-semibold truncate">
                {u.username ?? (
                  <span className="italic text-ink-muted/60 font-normal">sin nickname</span>
                )}
              </p>
              {u.isAdmin && <Badge variant="gold">Admin</Badge>}
            </div>
            <p className="font-body text-[11px] text-ink-muted truncate">{u.email}</p>
            {u.kingdom && (
              <p className="font-body text-[10px] text-ink-muted/50 mt-0.5">
                Reino {u.kingdom.realm}·{u.kingdom.region}·{u.kingdom.slot}
              </p>
            )}
          </div>
          <Button
            variant={u.isAdmin ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => toggle.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
            disabled={toggle.isPending}
          >
            {u.isAdmin ? 'Quitar admin' : 'Hacer admin'}
          </Button>
        </div>
      ))}
    </Card>
  )
}

// ─── Dev Shortcuts Tab ────────────────────────────────────────────────────────
const BUILDING_OPTIONS = [
  { id: 'sawmill', label: 'Aserradero' },
  { id: 'quarry', label: 'Cantera' },
  { id: 'grainFarm', label: 'Granja' },
  { id: 'windmill', label: 'Molino' },
  { id: 'cathedral', label: 'Catedral' },
  { id: 'workshop', label: 'Taller' },
  { id: 'engineersGuild', label: 'Gremio Ingenieros' },
  { id: 'barracks', label: 'Cuartel' },
  { id: 'granary', label: 'Granero' },
  { id: 'stonehouse', label: 'Almacén de Piedra' },
  { id: 'silo', label: 'Silo' },
  { id: 'academy', label: 'Academia' },
  { id: 'alchemistTower', label: 'Torre Alquimista' },
  { id: 'ambassadorHall', label: 'Sala Embajador' },
  { id: 'armoury', label: 'Armería' },
]

const RESEARCH_OPTIONS = [
  { id: 'swordsmanship', label: 'Esgrima' },
  { id: 'armoury', label: 'Armamento' },
  { id: 'fortification', label: 'Fortificación' },
  { id: 'horsemanship', label: 'Equitación' },
  { id: 'cartography', label: 'Cartografía' },
  { id: 'tradeRoutes', label: 'Rutas Comerciales' },
  { id: 'alchemy', label: 'Alquimia' },
  { id: 'pyromancy', label: 'Piromancia' },
  { id: 'runemastery', label: 'Maestría de Runas' },
  { id: 'mysticism', label: 'Misticismo' },
  { id: 'dragonlore', label: 'Sabiduría del Dragón' },
  { id: 'spycraft', label: 'Espionaje' },
  { id: 'logistics', label: 'Logística' },
  { id: 'exploration', label: 'Exploración' },
  { id: 'diplomaticNetwork', label: 'Red Diplomática' },
  { id: 'divineBlessing', label: 'Bendición Divina' },
]

function DevTab() {
  const { data } = useAdminUsers()
  const devAction = useDevAction()
  const seedNpcs  = useSeedNpcs()

  const [selectedUserId, setSelectedUserId] = useState<number | ''>('')
  const [wood, setWood] = useState('50000')
  const [stone, setStone] = useState('50000')
  const [grain, setGrain] = useState('50000')
  const [building, setBuilding] = useState(BUILDING_OPTIONS[0].id)
  const [buildingLevel, setBuildingLevel] = useState('5')
  const [tech, setTech] = useState(RESEARCH_OPTIONS[0].id)
  const [techLevel, setTechLevel] = useState('5')
  const [status, setStatus] = useState<string | null>(null)

  const users = data?.users ?? []
  const selectedUser = users.find(u => u.id === selectedUserId)
  const hasKingdom = !!selectedUser?.kingdom

  async function run(body: Record<string, unknown>) {
    try {
      await devAction.mutateAsync(body)
      setStatus('✓ Aplicado')
    } catch (e) {
      setStatus('✗ ' + (e as Error).message)
    }
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* Player selector */}
      <Card className="p-4 space-y-2">
        <label className="font-ui text-[10px] text-ink-muted uppercase tracking-widest">
          Jugador
        </label>
        <div className="relative">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value) : '')}
            className="game-input w-full appearance-none pr-8"
          >
            <option value="">— seleccionar —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.username ?? u.email}
                {u.kingdom
                  ? ` · R${u.kingdom.realm}:${u.kingdom.region}:${u.kingdom.slot}`
                  : ' (sin reino)'}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
        </div>
      </Card>

      {status && (
        <p
          className={`font-ui text-xs px-3 py-2 rounded border ${status.startsWith('✓') ? 'text-forest border-forest/30 bg-forest/10' : 'text-crimson border-crimson/30 bg-crimson/10'}`}
        >
          {status}
        </p>
      )}

      {/* Resources */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">
          Recursos
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['wood', '🪵', 'Madera', wood, setWood],
              ['stone', '🪨', 'Piedra', stone, setStone],
              ['grain', '🌾', 'Grano', grain, setGrain],
            ] as const
          ).map(([, emoji, label, val, set]) => (
            <div key={label} className="space-y-1">
              <label className="font-ui text-[10px] text-ink-muted/70">
                {emoji} {label}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={val}
                onChange={e => set(e.target.value)}
                className="game-input w-full text-sm tabular-nums"
              />
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={!hasKingdom || devAction.isPending}
          onClick={() =>
            run({
              action: 'set_resources',
              kingdomId: selectedUser?.kingdom?.id,
              wood: parseInt(wood),
              stone: parseInt(stone),
              grain: parseInt(grain),
            })
          }
        >
          Establecer recursos
        </Button>
      </Card>

      {/* Seed NPCs */}
      <Card className="p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-ui text-sm font-semibold text-ink">Poblar NPCs</p>
          <p className="font-body text-[11px] text-ink-muted/70 mt-0.5">
            Genera reinos NPC vacíos en todos los slots (~30% ocupación)
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={seedNpcs.isPending}
          onClick={async () => {
            const res = await seedNpcs.mutateAsync()
            setStatus(`✓ ${res.created} creados, ${res.deleted} eliminados`)
          }}
        >
          {seedNpcs.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
          Seed NPCs
        </Button>
      </Card>

      {/* Fast-forward */}
      <Card className="p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-ui text-sm font-semibold text-ink">Completar colas</p>
          <p className="font-body text-[11px] text-ink-muted/70 mt-0.5">
            Construcción, investigación y unidades
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!hasKingdom || devAction.isPending}
          onClick={() =>
            run({
              action: 'fast_forward',
              kingdomId: selectedUser?.kingdom?.id,
              userId: selectedUser?.id,
            })
          }
        >
          <Zap size={12} /> Fast-forward
        </Button>
      </Card>

      {/* Building level */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">
          Nivel de edificio
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={building}
              onChange={e => setBuilding(e.target.value)}
              className="game-input w-full appearance-none pr-8 text-sm"
            >
              {BUILDING_OPTIONS.map(b => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={buildingLevel}
            onChange={e => setBuildingLevel(e.target.value)}
            className="game-input w-16 text-center text-sm tabular-nums"
            placeholder="Nv"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasKingdom || devAction.isPending}
            onClick={() =>
              run({
                action: 'set_building',
                kingdomId: selectedUser?.kingdom?.id,
                building,
                level: parseInt(buildingLevel),
              })
            }
          >
            OK
          </Button>
        </div>
      </Card>

      {/* Research level */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">
          Nivel de investigación
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={tech}
              onChange={e => setTech(e.target.value)}
              className="game-input w-full appearance-none pr-8 text-sm"
            >
              {RESEARCH_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={techLevel}
            onChange={e => setTechLevel(e.target.value)}
            className="game-input w-16 text-center text-sm tabular-nums"
            placeholder="Nv"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedUser || devAction.isPending}
            onClick={() =>
              run({
                action: 'set_research',
                userId: selectedUser?.id,
                tech,
                level: parseInt(techLevel),
              })
            }
          >
            OK
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────
function MissionsTab() {
  const { data, isLoading } = useAdminFleet()
  const fastForward = useFastForward()

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const missions = data?.missions ?? []
  const now = data?.now ?? 0

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="font-ui text-xs text-ink-muted">
          {missions.length} misión{missions.length !== 1 ? 'es' : ''} activa
          {missions.length !== 1 ? 's' : ''}
        </p>
        {missions.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => fastForward.mutate({ all: true })}
            disabled={fastForward.isPending}
          >
            <Zap size={12} /> Completar todas
          </Button>
        )}
      </div>

      {missions.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-body text-sm text-ink-muted">Sin misiones activas</p>
        </Card>
      )}

      {missions.map(m => {
        const arrival = m.arrivalTime - now
        const returning = m.returnTime ? m.returnTime - now : null
        return (
          <Card key={m.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-ui text-sm font-semibold text-ink truncate">
                  {m.username ?? `#${m.userId}`}
                </p>
                <Badge variant="stone">{m.missionType}</Badge>
                <Badge variant={m.state === 'traveling' ? 'gold' : 'forest'}>{m.state}</Badge>
              </div>
              <p className="font-body text-[11px] text-ink-muted">
                → R{m.targetRealm}·{m.targetRegion}·{m.targetSlot}
                {' · '}
                {arrival > 0 ? `llega en ${formatDuration(arrival)}` : 'en destino'}
                {returning !== null &&
                  returning > 0 &&
                  ` · regresa en ${formatDuration(returning)}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fastForward.mutate({ missionId: m.id })}
              disabled={fastForward.isPending}
            >
              <Zap size={12} /> Skip
            </Button>
          </Card>
        )
      })}
    </div>
  )
}
