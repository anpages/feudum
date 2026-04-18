import { useState } from 'react'
import { Zap, ChevronDown, Bot, Loader2, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAdminUsers, useDevAction, useSeedNpcs, useResetNpcs } from '@/features/admin/useAdmin'

const BUILDING_OPTIONS = [
  { id: 'sawmill',        label: 'Aserradero' },
  { id: 'quarry',         label: 'Cantera' },
  { id: 'grainFarm',      label: 'Granja' },
  { id: 'windmill',       label: 'Molino' },
  { id: 'cathedral',      label: 'Catedral' },
  { id: 'workshop',       label: 'Taller' },
  { id: 'engineersGuild', label: 'Gremio Ingenieros' },
  { id: 'barracks',       label: 'Cuartel' },
  { id: 'granary',        label: 'Granero' },
  { id: 'stonehouse',     label: 'Almacén de Piedra' },
  { id: 'silo',           label: 'Silo' },
  { id: 'academy',        label: 'Academia' },
  { id: 'alchemistTower', label: 'Torre Alquimista' },
  { id: 'ambassadorHall', label: 'Sala Embajador' },
  { id: 'armoury',        label: 'Armería' },
]

const RESEARCH_OPTIONS = [
  { id: 'swordsmanship',     label: 'Esgrima' },
  { id: 'armoury',           label: 'Armamento' },
  { id: 'fortification',     label: 'Fortificación' },
  { id: 'horsemanship',      label: 'Equitación' },
  { id: 'cartography',       label: 'Cartografía' },
  { id: 'tradeRoutes',       label: 'Rutas Comerciales' },
  { id: 'alchemy',           label: 'Alquimia' },
  { id: 'pyromancy',         label: 'Piromancia' },
  { id: 'runemastery',       label: 'Maestría de Runas' },
  { id: 'mysticism',         label: 'Misticismo' },
  { id: 'dragonlore',        label: 'Sabiduría del Dragón' },
  { id: 'spycraft',          label: 'Espionaje' },
  { id: 'logistics',         label: 'Logística' },
  { id: 'exploration',       label: 'Exploración' },
  { id: 'diplomaticNetwork', label: 'Red Diplomática' },
  { id: 'divineBlessing',    label: 'Bendición Divina' },
]

function NpcSeeder({ onStatus }: { onStatus: (s: string) => void }) {
  const seedNpcs  = useSeedNpcs()
  const resetNpcs = useResetNpcs()
  const [count, setCount] = useState('10')
  const total   = parseInt(count) || 0
  const pending = seedNpcs.isPending || resetNpcs.isPending

  async function handleSeed() {
    try {
      const res = await seedNpcs.mutateAsync({ level1: total, level2: 0, level3: 0 })
      onStatus(`✓ ${res.created} NPCs añadidos`)
    } catch (e) { onStatus('✗ ' + (e as Error).message) }
  }

  async function handleReset() {
    try {
      const res = await resetNpcs.mutateAsync()
      onStatus(`✓ ${res.deleted} NPCs eliminados`)
    } catch (e) { onStatus('✗ ' + (e as Error).message) }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={15} className="text-gold" />
        <h3 className="font-ui text-sm font-semibold text-ink">Poblar NPCs</h3>
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="block font-ui text-xs text-ink-muted">Cantidad a añadir</label>
          <input type="number" min="1" max="300" value={count} onChange={e => setCount(e.target.value)}
            className="game-input w-24 text-center text-sm tabular-nums" />
        </div>
        <Button variant="primary" size="sm" disabled={pending || total <= 0} onClick={handleSeed}>
          {seedNpcs.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
          Añadir {total > 0 ? total : ''} NPCs
        </Button>
        <Button variant="danger" size="sm" disabled={pending} onClick={handleReset}>
          {resetNpcs.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Reset
        </Button>
      </div>
    </Card>
  )
}

export function DevTab() {
  const { data } = useAdminUsers()
  const devAction = useDevAction()

  const [selectedUserId, setSelectedUserId] = useState<number | ''>('')
  const [wood,          setWood]          = useState('50000')
  const [stone,         setStone]         = useState('50000')
  const [grain,         setGrain]         = useState('50000')
  const [building,      setBuilding]      = useState(BUILDING_OPTIONS[0].id)
  const [buildingLevel, setBuildingLevel] = useState('5')
  const [tech,          setTech]          = useState(RESEARCH_OPTIONS[0].id)
  const [techLevel,     setTechLevel]     = useState('5')
  const [status,        setStatus]        = useState<string | null>(null)

  const users        = (data?.users ?? []).filter((u: any) => !u.isNpc)
  const selectedUser = users.find((u: any) => u.id === selectedUserId) as any
  const hasKingdom   = !!selectedUser?.kingdom

  function handleStatus(s: string) {
    setStatus(s)
    setTimeout(() => setStatus(null), 4000)
  }

  async function run(body: Record<string, unknown>) {
    try {
      await devAction.mutateAsync(body)
      setStatus('✓ Aplicado')
    } catch (e) { setStatus('✗ ' + (e as Error).message) }
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="space-y-4">
      <NpcSeeder onStatus={handleStatus} />

      {status && (
        <p className={`font-ui text-xs px-3 py-2 rounded border ${
          status.startsWith('✓') ? 'text-forest border-forest/30 bg-forest/10' : 'text-crimson border-crimson/30 bg-crimson/10'
        }`}>{status}</p>
      )}

      <Card className="p-4 space-y-2">
        <label className="font-ui text-[10px] text-ink-muted uppercase tracking-widest">Jugador objetivo</label>
        <div className="relative">
          <select value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value) : '')}
            className="game-input w-full appearance-none pr-8">
            <option value="">— seleccionar —</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.username ?? u.email}
                {u.kingdom ? ` · R${u.kingdom.realm}:${u.kingdom.region}:${u.kingdom.slot}` : ' (sin reino)'}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Recursos</h3>
            <div className="grid grid-cols-3 gap-2">
              {([['wood','🪵','Madera',wood,setWood],['stone','🪨','Piedra',stone,setStone],['grain','🌾','Grano',grain,setGrain]] as const).map(([,emoji,label,val,set]) => (
                <div key={label} className="space-y-1">
                  <label className="font-ui text-[10px] text-ink-muted/70">{emoji} {label}</label>
                  <input type="text" inputMode="numeric" value={val} onChange={e => set(e.target.value)} className="game-input w-full text-sm tabular-nums" />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" disabled={!hasKingdom || devAction.isPending}
              onClick={() => run({ action: 'set_resources', kingdomId: selectedUser?.kingdom?.id, wood: parseInt(wood), stone: parseInt(stone), grain: parseInt(grain) })}>
              Establecer recursos
            </Button>
          </Card>

          <Card className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="font-ui text-sm font-semibold text-ink">Completar colas</p>
              <p className="font-body text-[11px] text-ink-muted/70 mt-0.5">Construcción, investigación y unidades</p>
            </div>
            <Button variant="primary" size="sm" disabled={!hasKingdom || devAction.isPending}
              onClick={() => run({ action: 'fast_forward', kingdomId: selectedUser?.kingdom?.id, userId: selectedUser?.id })}>
              <Zap size={12} /> Fast-forward
            </Button>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Nivel de edificio</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select value={building} onChange={e => setBuilding(e.target.value)} className="game-input w-full appearance-none pr-8 text-sm">
                  {BUILDING_OPTIONS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
              <input type="text" inputMode="numeric" value={buildingLevel} onChange={e => setBuildingLevel(e.target.value)} className="game-input w-16 text-center text-sm tabular-nums" placeholder="Nv" />
              <Button variant="ghost" size="sm" disabled={!hasKingdom || devAction.isPending}
                onClick={() => run({ action: 'set_building', kingdomId: selectedUser?.kingdom?.id, building, level: parseInt(buildingLevel) })}>
                OK
              </Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-ui text-xs font-semibold text-ink uppercase tracking-widest">Nivel de investigación</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select value={tech} onChange={e => setTech(e.target.value)} className="game-input w-full appearance-none pr-8 text-sm">
                  {RESEARCH_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
              <input type="text" inputMode="numeric" value={techLevel} onChange={e => setTechLevel(e.target.value)} className="game-input w-16 text-center text-sm tabular-nums" placeholder="Nv" />
              <Button variant="ghost" size="sm" disabled={!selectedUser || devAction.isPending}
                onClick={() => run({ action: 'set_research', userId: selectedUser?.id, tech, level: parseInt(techLevel) })}>
                OK
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
