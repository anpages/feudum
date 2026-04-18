import { useState } from 'react'
import { Settings, Users, Zap, Swords, Loader2, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useAdminSettings, useAdminUsers, useAdminFleet,
  useUpdateSettings, useToggleAdmin, useDevAction, useFastForward,
  type AdminSettings,
} from '@/hooks/useAdmin'
import { formatDuration } from '@/lib/format'

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = 'server' | 'players' | 'dev' | 'missions'

const TABS: { id: Tab; label: string; Icon: typeof Settings }[] = [
  { id: 'server',   label: 'Servidor',     Icon: Settings },
  { id: 'players',  label: 'Jugadores',    Icon: Users    },
  { id: 'dev',      label: 'Atajos Dev',   Icon: Zap      },
  { id: 'missions', label: 'Misiones',     Icon: Swords   },
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('server')

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Administración</span>
        <h1 className="page-title mt-0.5">Panel de control</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gold/10 anim-fade-up-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-ui text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px
              ${tab === id
                ? 'text-gold border-gold'
                : 'text-ink-muted border-transparent hover:text-ink'}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="anim-fade-up-2">
        {tab === 'server'   && <ServerTab />}
        {tab === 'players'  && <PlayersTab />}
        {tab === 'dev'      && <DevTab />}
        {tab === 'missions' && <MissionsTab />}
      </div>
    </div>
  )
}

// ─── Server Settings Tab ──────────────────────────────────────────────────────
function ServerTab() {
  const { data, isLoading } = useAdminSettings()
  const update = useUpdateSettings()
  const [form, setForm] = useState<Partial<AdminSettings>>({})
  const [saved, setSaved] = useState(false)

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const current = { ...data, ...form } as AdminSettings

  function field(key: keyof AdminSettings) {
    return {
      value: form[key] ?? data?.[key] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 })),
    }
  }

  async function save() {
    if (!Object.keys(form).length) return
    await update.mutateAsync(form)
    setForm({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Card className="p-5 space-y-5">
        <h2 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Velocidades del universo</h2>

        <div className="grid grid-cols-2 gap-3">
          <SettingField label="Economía" hint="producción + construcción" {...field('economy_speed')} />
          <SettingField label="Investigación" hint="tiempo labs" {...field('research_speed')} />
          <SettingField label="Flota (guerra)" hint="misiones ofensivas" {...field('fleet_speed_war')} />
          <SettingField label="Flota (paz)" hint="transporte/colonia" {...field('fleet_speed_peaceful')} />
        </div>

        <div className="divider"><span className="px-3 text-[10px] text-ink-muted/50 uppercase tracking-widest">Ingresos base</span></div>

        <div className="grid grid-cols-2 gap-3">
          <SettingField label="Madera base/h" hint="sin edificios" {...field('basic_wood')} />
          <SettingField label="Piedra base/h" hint="sin edificios" {...field('basic_stone')} />
        </div>

        {update.isError && (
          <p className="font-ui text-xs text-crimson">{(update.error as Error)?.message}</p>
        )}

        <Button
          variant="primary"
          onClick={save}
          disabled={!Object.keys(form).length || update.isPending}
          className="w-full"
        >
          {update.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
          {update.isPending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </Button>
      </Card>

      <Card className="p-4 space-y-2">
        <p className="font-ui text-[10px] text-ink-muted/60 uppercase tracking-widest">Valores actuales</p>
        <div className="grid grid-cols-3 gap-2 font-ui text-xs text-ink-muted">
          {(Object.keys(current) as (keyof AdminSettings)[]).map(k => (
            <div key={k} className="flex justify-between gap-2 bg-parchment/5 rounded px-2 py-1">
              <span className="truncate text-ink-muted/60">{k}</span>
              <span className="text-gold font-semibold">{current[k]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SettingField({ label, hint, value, onChange }: {
  label: string; hint: string; value: number | string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-1">
      <label className="font-ui text-[10px] text-ink-muted uppercase tracking-widest">{label}</label>
      <input type="number" step="0.1" min="0" value={value} onChange={onChange} className="game-input w-full text-sm" />
      <p className="font-body text-[10px] text-ink-muted/50">{hint}</p>
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
    <Card className="divide-y divide-gold/10">
      {users.length === 0 && (
        <p className="p-5 font-body text-sm text-ink-muted text-center">Sin jugadores</p>
      )}
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="font-ui text-sm text-ink font-semibold truncate">{u.username ?? <span className="italic text-ink-muted/60">sin nickname</span>}</p>
            <p className="font-body text-[11px] text-ink-muted truncate">{u.email}</p>
            {u.kingdom && (
              <p className="font-body text-[10px] text-ink-muted/50 mt-0.5">
                R{u.kingdom.realm}·{u.kingdom.region}·{u.kingdom.slot}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {u.isAdmin && <Badge variant="gold">Admin</Badge>}
            <Button
              variant={u.isAdmin ? 'danger' : 'ghost'}
              size="sm"
              onClick={() => toggle.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
              disabled={toggle.isPending}
            >
              {u.isAdmin ? 'Quitar admin' : 'Hacer admin'}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  )
}

// ─── Dev Shortcuts Tab ────────────────────────────────────────────────────────
const BUILDING_KEYS = [
  'sawmill','quarry','grainFarm','windmill','cathedral','workshop','engineersGuild',
  'barracks','granary','stonehouse','silo','academy','alchemistTower','ambassadorHall','armoury',
]
const RESEARCH_KEYS = [
  'swordsmanship','armoury','fortification','horsemanship','cartography','tradeRoutes',
  'alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'spycraft','logistics','exploration','diplomaticNetwork','divineBlessing',
]

function DevTab() {
  const { data } = useAdminUsers()
  const devAction = useDevAction()

  const [selectedUserId, setSelectedUserId]     = useState<number | ''>('')
  const [wood,  setWood]                        = useState('50000')
  const [stone, setStone]                       = useState('50000')
  const [grain, setGrain]                       = useState('50000')
  const [building,      setBuilding]            = useState(BUILDING_KEYS[0])
  const [buildingLevel, setBuildingLevel]       = useState('5')
  const [tech,          setTech]                = useState(RESEARCH_KEYS[0])
  const [techLevel,     setTechLevel]           = useState('5')
  const [status, setStatus]                     = useState<string | null>(null)

  const users = data?.users ?? []
  const selectedUser = users.find(u => u.id === selectedUserId)

  async function run(body: Record<string, unknown>) {
    try {
      await devAction.mutateAsync(body)
      setStatus('✓ Hecho')
    } catch (e) {
      setStatus('✗ Error: ' + (e as Error).message)
    }
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* User selector */}
      <Card className="p-4 space-y-2">
        <label className="font-ui text-[10px] text-ink-muted uppercase tracking-widest">Jugador objetivo</label>
        <div className="relative">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value) : '')}
            className="game-input w-full appearance-none pr-8"
          >
            <option value="">— seleccionar jugador —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.username ?? u.email} {u.kingdom ? `(R${u.kingdom.realm}·${u.kingdom.region}·${u.kingdom.slot})` : '(sin reino)'}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        </div>
      </Card>

      {status && (
        <p className={`font-ui text-xs px-3 py-2 rounded border ${status.startsWith('✓') ? 'text-forest border-forest/30 bg-forest/10' : 'text-crimson border-crimson/30 bg-crimson/10'}`}>
          {status}
        </p>
      )}

      {/* Set resources */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Establecer recursos</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="font-ui text-[10px] text-ink-muted/70">Madera</label>
            <input type="number" value={wood} onChange={e => setWood(e.target.value)} className="game-input w-full text-sm mt-1" />
          </div>
          <div>
            <label className="font-ui text-[10px] text-ink-muted/70">Piedra</label>
            <input type="number" value={stone} onChange={e => setStone(e.target.value)} className="game-input w-full text-sm mt-1" />
          </div>
          <div>
            <label className="font-ui text-[10px] text-ink-muted/70">Grano</label>
            <input type="number" value={grain} onChange={e => setGrain(e.target.value)} className="game-input w-full text-sm mt-1" />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full"
          disabled={!selectedUser?.kingdom || devAction.isPending}
          onClick={() => run({ action: 'set_resources', kingdomId: selectedUser?.kingdom?.id, wood: parseFloat(wood), stone: parseFloat(stone), grain: parseFloat(grain) })}
        >
          Aplicar recursos
        </Button>
      </Card>

      {/* Fast-forward queues */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Completar colas</h3>
        <p className="font-body text-xs text-ink-muted">Adelanta todas las colas de construcción, investigación y unidades al pasado.</p>
        <Button variant="ghost" size="sm" className="w-full"
          disabled={!selectedUser?.kingdom || devAction.isPending}
          onClick={() => run({ action: 'fast_forward', kingdomId: selectedUser?.kingdom?.id, userId: selectedUser?.id })}
        >
          <Zap size={12} /> Fast-forward colas
        </Button>
      </Card>

      {/* Set building level */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Nivel de edificio</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={building} onChange={e => setBuilding(e.target.value)} className="game-input w-full appearance-none pr-8 text-sm">
              {BUILDING_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          </div>
          <input type="number" min="0" max="30" value={buildingLevel} onChange={e => setBuildingLevel(e.target.value)} className="game-input w-20 text-sm" />
        </div>
        <Button variant="ghost" size="sm" className="w-full"
          disabled={!selectedUser?.kingdom || devAction.isPending}
          onClick={() => run({ action: 'set_building', kingdomId: selectedUser?.kingdom?.id, building, level: parseInt(buildingLevel) })}
        >
          Establecer nivel
        </Button>
      </Card>

      {/* Set research level */}
      <Card className="p-4 space-y-3">
        <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Nivel de investigación</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={tech} onChange={e => setTech(e.target.value)} className="game-input w-full appearance-none pr-8 text-sm">
              {RESEARCH_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          </div>
          <input type="number" min="0" max="20" value={techLevel} onChange={e => setTechLevel(e.target.value)} className="game-input w-20 text-sm" />
        </div>
        <Button variant="ghost" size="sm" className="w-full"
          disabled={!selectedUser || devAction.isPending}
          onClick={() => run({ action: 'set_research', userId: selectedUser?.id, tech, level: parseInt(techLevel) })}
        >
          Establecer nivel
        </Button>
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
  const now = data?.now ?? Math.floor(Date.now() / 1000)

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="font-ui text-xs text-ink-muted">{missions.length} misión{missions.length !== 1 ? 'es' : ''} activa{missions.length !== 1 ? 's' : ''}</p>
        {missions.length > 0 && (
          <Button variant="danger" size="sm"
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
          <Card key={m.id} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="font-ui text-sm font-semibold text-ink truncate">
                  {m.username ?? `User #${m.userId}`}
                </p>
                <Badge variant="stone">{m.missionType}</Badge>
                <Badge variant={m.state === 'traveling' ? 'gold' : 'forest'}>{m.state}</Badge>
              </div>
              <p className="font-body text-[11px] text-ink-muted">
                → R{m.targetRealm}·{m.targetRegion}·{m.targetSlot}
              </p>
              <p className="font-body text-[11px] text-ink-muted/60">
                {arrival > 0 ? `Llega en ${formatDuration(arrival)}` : 'En destino'}
                {returning !== null && returning > 0 && ` · Regresa en ${formatDuration(returning)}`}
              </p>
            </div>
            <Button variant="ghost" size="sm"
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
