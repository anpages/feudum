import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TreePine, Mountain, Wheat, Users, LogOut, Menu, Shield } from 'lucide-react'
import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { useAuth } from '@/hooks/useAuth'
import { formatResource } from '@/lib/format'

interface Props {
  onMenuToggle: () => void
}

export function ResourceBar({ onMenuToggle }: Props) {
  const navigate  = useNavigate()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <header className="game-header">

      {/* ── Left: hamburger + logo ── */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <Shield size={13} className="text-gold" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-[0.65rem] text-gold tracking-[0.18em] uppercase">
              Feudum
            </span>
            {kingdom?.name && (
              <span className="font-ui text-[0.7rem] text-ink-muted truncate max-w-[120px]">
                {kingdom.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Center: resources ── */}
      <div className="flex items-center gap-1.5 flex-1 justify-center overflow-x-auto no-scrollbar">
        <ResourcePill
          icon={<TreePine size={11} />}
          label="Madera"
          value={resources.wood}
          cap={kingdom?.woodCapacity}
          rate={kingdom?.woodProduction}
        />
        <ResourcePill
          icon={<Mountain size={11} />}
          label="Piedra"
          value={resources.stone}
          cap={kingdom?.stoneCapacity}
          rate={kingdom?.stoneProduction}
        />
        <ResourcePill
          icon={<Wheat size={11} />}
          label="Grano"
          value={resources.grain}
          cap={kingdom?.grainCapacity}
          rate={kingdom?.grainProduction}
        />
        <div className="hidden md:flex resource-pill items-center gap-1.5">
          <Users size={11} className="text-ink-muted" />
          <span className="font-ui text-xs tabular-nums text-ink-mid">
            {formatResource(kingdom?.populationUsed ?? 0)}
            <span className="text-ink-muted/60 mx-0.5">/</span>
            {formatResource(kingdom?.populationMax ?? 0)}
          </span>
        </div>
      </div>

      {/* ── Right: user + logout ── */}
      <div className="flex items-center gap-2 shrink-0">
        {user?.username && (
          <span className="hidden md:block font-ui text-xs text-ink-muted truncate max-w-[100px]">
            {user.username}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md text-ink-muted hover:text-crimson hover:bg-crimson/5 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>

    </header>
  )
}

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
    <div className="resource-pill" title={label}>
      <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span className={`font-ui text-xs tabular-nums font-medium ${isFull ? 'text-crimson' : 'text-ink-mid'}`}>
        {formatResource(value)}
      </span>
      {rate !== undefined && rate > 0 && (
        <span className="hidden lg:inline font-ui text-[0.62rem] tabular-nums text-forest-light">
          +{formatResource(rate)}/h
        </span>
      )}
    </div>
  )
}
