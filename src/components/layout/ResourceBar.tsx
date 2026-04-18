import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, Castle, UserRound, Zap, Bell, ChevronUp } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat, GiCastle } from 'react-icons/gi'
import {
  useKingdom,
  useKingdoms,
  useSwitchKingdom,
  getActiveKingdomId,
} from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useAuth } from '@/features/auth/useAuth'
import { useUnreadCount } from '@/features/messages/useMessages'
import { formatResource } from '@/lib/format'
import type { AuthUser } from '@/shared/types/user'

interface Props {
  onMenuToggle: () => void
}

export function ResourceBar({ onMenuToggle }: Props) {
  const navigate = useNavigate()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const { user } = useAuth()
  const unread = useUnreadCount()

  return (
    <header className="game-header">
      {/* ── Left: hamburger + brand + kingdom selector ── */}
      <div className="flex items-center gap-2 shrink-0 pr-2 sm:pr-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <GiCastle className="text-gold" style={{ fontSize: 12 }} />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-[0.58rem] text-gold-dim tracking-[0.18em] uppercase">
              Feudum
            </span>
            <KingdomSelector kingdomName={kingdom?.name} />
          </div>
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

      {/* ── Center: resources ── */}
      {/* Mobile: compact + dropdown toggle */}
      <div className="flex md:hidden items-center flex-1 justify-center px-1">
        <MobileResources resources={resources} kingdom={kingdom} user={user ?? null} />
      </div>

      {/* Desktop (md+): full resource pills */}
      <div className="hidden md:flex items-center gap-0.5 sm:gap-1 flex-1 justify-center overflow-x-auto no-scrollbar px-1 sm:px-2">
        <ResourcePill
          icon={<GiWoodPile style={{ fontSize: 12 }} />}
          label="Madera"
          value={resources.wood}
          cap={kingdom?.woodCapacity}
          rate={kingdom?.woodProduction}
        />
        <ResourcePill
          icon={<GiStoneBlock style={{ fontSize: 12 }} />}
          label="Piedra"
          value={resources.stone}
          cap={kingdom?.stoneCapacity}
          rate={kingdom?.stoneProduction}
        />
        <ResourcePill
          icon={<GiWheat style={{ fontSize: 12 }} />}
          label="Grano"
          value={resources.grain}
          cap={kingdom?.grainCapacity}
          rate={kingdom?.grainProduction}
        />
        <EnergyPill kingdom={kingdom as Record<string, unknown> | null | undefined} />
        <div
          className={`hidden xl:flex resource-pill items-center gap-1.5 ${(user?.ether ?? 0) === 0 ? 'opacity-30' : ''}`}
          title="Éter arcano"
        >
          <Zap size={10} className="text-gold" />
          <span className="font-ui text-xs tabular-nums text-gold-dim font-semibold">
            {user?.ether ?? 0}
          </span>
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

      {/* ── Right: messages bell + profile ── */}
      <div className="flex items-center gap-0.5 shrink-0 pl-1 sm:pl-3">
        <button
          onClick={() => navigate('/messages')}
          className="relative p-1.5 rounded text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
          title="Mensajes"
        >
          <Bell size={15} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-crimson text-parchment font-ui text-[9px] font-bold leading-none px-0.5">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
          title="Perfil"
        >
          <UserRound size={15} />
        </button>
      </div>
    </header>
  )
}

// ── Mobile compact resources + dropdown ───────────────────────────────────────

function MobileResources({
  resources,
  kingdom,
  user,
}: {
  resources: { wood: number; stone: number; grain: number }
  kingdom: Record<string, unknown> | null | undefined
  user: AuthUser | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const woodCap   = kingdom?.woodCapacity  as number | undefined
  const stoneCap  = kingdom?.stoneCapacity as number | undefined
  const grainCap  = kingdom?.grainCapacity as number | undefined
  const woodFull  = woodCap  !== undefined && resources.wood  >= woodCap
  const stoneFull = stoneCap !== undefined && resources.stone >= stoneCap
  const grainFull = grainCap !== undefined && resources.grain >= grainCap

  const produced = (kingdom?.energyProduced as number | undefined) ?? 0
  const consumed = (kingdom?.energyConsumed as number | undefined) ?? 0
  const energyDeficit = produced > 0 && produced < consumed
  const anyAlert = woodFull || stoneFull || grainFull || energyDeficit

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
          open ? 'bg-parchment/60' : 'hover:bg-parchment/40'
        }`}
      >
        {/* Three compact resource numbers */}
        <span className={`font-ui text-xs tabular-nums font-semibold ${woodFull ? 'text-crimson' : 'text-ink-mid'}`}>
          {formatResource(resources.wood)}
        </span>
        <span className="text-ink-muted/30 text-[10px]">·</span>
        <span className={`font-ui text-xs tabular-nums font-semibold ${stoneFull ? 'text-crimson' : 'text-ink-mid'}`}>
          {formatResource(resources.stone)}
        </span>
        <span className="text-ink-muted/30 text-[10px]">·</span>
        <span className={`font-ui text-xs tabular-nums font-semibold ${grainFull ? 'text-crimson' : 'text-ink-mid'}`}>
          {formatResource(resources.grain)}
        </span>
        {anyAlert && (
          <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-pulse" />
        )}
        {open ? <ChevronUp size={11} className="text-ink-muted" /> : <ChevronDown size={11} className="text-ink-muted" />}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white border border-gold/20 rounded-xl shadow-xl py-3 px-4 min-w-[220px] space-y-3">
          {/* Resources */}
          <div className="space-y-2">
            <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Recursos</p>
            <DropdownResource
              icon={<GiWoodPile style={{ fontSize: 13 }} />}
              label="Madera"
              value={resources.wood}
              cap={woodCap}
              rate={kingdom?.woodProduction as number | undefined}
              full={woodFull}
            />
            <DropdownResource
              icon={<GiStoneBlock style={{ fontSize: 13 }} />}
              label="Piedra"
              value={resources.stone}
              cap={stoneCap}
              rate={kingdom?.stoneProduction as number | undefined}
              full={stoneFull}
            />
            <DropdownResource
              icon={<GiWheat style={{ fontSize: 13 }} />}
              label="Grano"
              value={resources.grain}
              cap={grainCap}
              rate={kingdom?.grainProduction as number | undefined}
              full={grainFull}
            />
          </div>

          {/* Energy */}
          {(produced > 0 || consumed > 0) && (
            <div className="border-t border-gold/10 pt-3 space-y-1">
              <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Energía</p>
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-ink-muted">Producida</span>
                <span className="font-ui text-xs tabular-nums text-forest-light">{formatResource(produced)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-ink-muted">Consumida</span>
                <span className="font-ui text-xs tabular-nums text-ink-mid">{formatResource(consumed)}</span>
              </div>
              {energyDeficit && (
                <p className="font-ui text-[0.65rem] text-crimson font-semibold mt-1">
                  Déficit — minas al {Math.round((produced / consumed) * 100)}%
                </p>
              )}
            </div>
          )}

          {/* Ether */}
          <div className="border-t border-gold/10 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-gold" />
              <span className="font-ui text-xs text-ink-muted">Éter arcano</span>
            </div>
            <span className={`font-ui text-xs tabular-nums font-semibold ${(user?.ether ?? 0) > 0 ? 'text-gold-dim' : 'text-ink-muted/40'}`}>
              {user?.ether ?? 0}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownResource({
  icon, label, value, cap, rate, full,
}: {
  icon: ReactNode
  label: string
  value: number
  cap?: number
  rate?: number
  full: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={full ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span className="font-body text-xs text-ink-muted flex-1">{label}</span>
      <div className="text-right">
        <span className={`font-ui text-xs tabular-nums font-semibold ${full ? 'text-crimson' : 'text-ink-mid'}`}>
          {formatResource(value)}
        </span>
        {cap !== undefined && (
          <span className="font-ui text-[0.6rem] text-ink-muted/50 tabular-nums">
            /{formatResource(cap)}
          </span>
        )}
        {rate !== undefined && rate > 0 && (
          <span className="font-ui text-[0.6rem] text-forest-light tabular-nums block">
            +{formatResource(rate)}/h
          </span>
        )}
      </div>
    </div>
  )
}

// ── Kingdom selector ──────────────────────────────────────────────────────────

function KingdomSelector({ kingdomName }: { kingdomName?: string }) {
  const { data } = useKingdoms()
  const switchKingdom = useSwitchKingdom()
  const activeId = getActiveKingdomId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const kingdoms = data?.kingdoms ?? []
  const hasMultiple = kingdoms.length > 1

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!kingdomName) return null

  if (!hasMultiple) {
    return (
      <span className="font-ui text-[0.65rem] text-ink-muted truncate max-w-[100px] leading-tight mt-px">
        {kingdomName}
      </span>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-0.5 font-ui text-[0.65rem] text-ink-muted hover:text-ink leading-tight mt-px transition-colors"
      >
        <span className="truncate max-w-[90px]">{kingdomName}</span>
        <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gold/20 rounded-lg shadow-lg py-1 min-w-[160px]">
          {kingdoms.map(k => (
            <button
              key={k.id}
              onClick={() => { switchKingdom(k.id === activeId ? null : k.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                k.id === activeId || (!activeId && kingdoms[0]?.id === k.id)
                  ? 'bg-gold/8 text-gold-dim'
                  : 'text-ink-muted hover:bg-parchment hover:text-ink'
              }`}
            >
              <Castle size={11} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-ui text-xs font-medium truncate">{k.name}</p>
                <p className="font-body text-[0.6rem] text-ink-muted/60">R{k.realm}·{k.region}·{k.slot}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Energy pill ───────────────────────────────────────────────────────────────

function EnergyPill({ kingdom }: { kingdom: Record<string, unknown> | null | undefined }) {
  const produced = (kingdom?.energyProduced as number | undefined) ?? 0
  const consumed = (kingdom?.energyConsumed as number | undefined) ?? 0
  if (produced === 0 && consumed === 0) return null
  const ok = produced >= consumed
  return (
    <div
      className="hidden md:flex resource-pill items-center gap-1"
      title={`Energía: ${formatResource(produced)} producida / ${formatResource(consumed)} consumida${!ok ? ' — déficit' : ''}`}
    >
      <Zap size={10} className={ok ? 'text-forest-light' : 'text-crimson'} />
      <span className={`font-ui text-xs tabular-nums ${ok ? 'text-forest-light' : 'text-crimson'}`}>
        {formatResource(produced)}
        <span className="text-ink-muted/40 mx-0.5">/</span>
        <span className="text-ink-muted">{formatResource(consumed)}</span>
      </span>
    </div>
  )
}

// ── Resource pill ─────────────────────────────────────────────────────────────

function ResourcePill({
  icon, label, value, cap, rate,
}: {
  icon: ReactNode
  label: string
  value: number
  cap?: number
  rate?: number
}) {
  const isFull = cap !== undefined && value >= cap

  return (
    <div
      className="resource-pill !px-1.5 sm:!px-2"
      title={`${label}: ${formatResource(value)}${cap ? ` / ${formatResource(cap)}` : ''}${rate ? ` (+${formatResource(rate)}/h)` : ''}`}
    >
      <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span className={`font-ui text-xs tabular-nums font-medium ${isFull ? 'text-crimson' : 'text-ink-mid'}`}>
        {formatResource(value)}
      </span>
      {rate !== undefined && rate > 0 && (
        <span className="hidden lg:inline font-ui text-[0.6rem] tabular-nums text-forest-light">
          +{formatResource(rate)}/h
        </span>
      )}
    </div>
  )
}
