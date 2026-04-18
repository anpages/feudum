import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, LogOut, Menu, ChevronDown, Castle } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat, GiCastle } from 'react-icons/gi'
import {
  useKingdom,
  useKingdoms,
  useSwitchKingdom,
  getActiveKingdomId,
} from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useAuth } from '@/features/auth/useAuth'
import { formatResource } from '@/lib/format'

interface Props {
  onMenuToggle: () => void
}

export function ResourceBar({ onMenuToggle }: Props) {
  const navigate = useNavigate()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const { logout } = useAuth()

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <header className="game-header">
      {/* ── Left: hamburger + brand + kingdom selector ── */}
      <div className="flex items-center gap-2 shrink-0 pr-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <GiCastle className="text-gold" style={{ fontSize: 13 }} />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-[0.62rem] text-gold-dim tracking-[0.2em] uppercase">
              Feudum
            </span>
            <KingdomSelector kingdomName={kingdom?.name} />
          </div>
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

      {/* ── Center: resources ── */}
      <div className="flex items-center gap-1 flex-1 justify-center overflow-x-auto no-scrollbar px-2">
        <ResourcePill
          icon={<GiWoodPile style={{ fontSize: 13 }} />}
          label="Madera"
          value={resources.wood}
          cap={kingdom?.woodCapacity}
          rate={kingdom?.woodProduction}
        />
        <ResourcePill
          icon={<GiStoneBlock style={{ fontSize: 13 }} />}
          label="Piedra"
          value={resources.stone}
          cap={kingdom?.stoneCapacity}
          rate={kingdom?.stoneProduction}
        />
        <ResourcePill
          icon={<GiWheat style={{ fontSize: 13 }} />}
          label="Grano"
          value={resources.grain}
          cap={kingdom?.grainCapacity}
          rate={kingdom?.grainProduction}
        />
        <div className="hidden md:flex resource-pill items-center gap-1.5">
          <Users size={11} className="text-ink-muted/70" />
          <span className="font-ui text-xs tabular-nums text-ink-mid">
            {formatResource(kingdom?.populationUsed ?? 0)}
            <span className="text-ink-muted/50 mx-0.5">/</span>
            {formatResource(kingdom?.populationMax ?? 0)}
          </span>
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

      {/* ── Right: logout ── */}
      <div className="flex items-center gap-1.5 shrink-0 pl-3">
        <button
          onClick={handleLogout}
          className="p-1.5 rounded text-ink-muted hover:text-crimson hover:bg-crimson/5 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
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

  // Close on outside click
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
      <span className="font-ui text-[0.68rem] text-ink-muted truncate max-w-[110px] leading-tight mt-px">
        {kingdomName}
      </span>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-0.5 font-ui text-[0.68rem] text-ink-muted hover:text-ink leading-tight mt-px transition-colors"
      >
        <span className="truncate max-w-[100px]">{kingdomName}</span>
        <ChevronDown
          size={10}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gold/20 rounded-lg shadow-lg py-1 min-w-[160px]">
          {kingdoms.map(k => (
            <button
              key={k.id}
              onClick={() => {
                switchKingdom(k.id === activeId ? null : k.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                k.id === activeId || (!activeId && kingdoms[0]?.id === k.id)
                  ? 'bg-gold/8 text-gold-dim'
                  : 'text-ink-muted hover:bg-parchment hover:text-ink'
              }`}
            >
              <Castle size={11} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-ui text-xs font-medium truncate">{k.name}</p>
                <p className="font-body text-[0.6rem] text-ink-muted/60">
                  R{k.realm}·{k.region}·{k.slot}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Resource pill ─────────────────────────────────────────────────────────────

function ResourcePill({
  icon,
  label,
  value,
  cap,
  rate,
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
      className="resource-pill"
      title={`${label}: ${formatResource(value)}${cap ? ` / ${formatResource(cap)}` : ''}${rate ? ` (+${formatResource(rate)}/h)` : ''}`}
    >
      <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span
        className={`font-ui text-xs tabular-nums font-medium ${isFull ? 'text-crimson' : 'text-ink-mid'}`}
      >
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
