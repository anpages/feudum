import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, LogOut, Menu } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat, GiCastle } from 'react-icons/gi'
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

      {/* ── Left: hamburger + brand ── */}
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
            {kingdom?.name && (
              <span className="font-ui text-[0.68rem] text-ink-muted truncate max-w-[110px] leading-tight mt-px">
                {kingdom.name}
              </span>
            )}
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

      {/* ── Right: user + logout ── */}
      <div className="flex items-center gap-1.5 shrink-0 pl-3">
        {user?.username && (
          <button
            onClick={() => navigate('/profile')}
            className="hidden md:block font-ui text-xs text-ink-muted hover:text-ink truncate max-w-[96px] transition-colors"
            title="Ver perfil"
          >
            {user.username}
          </button>
        )}
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
    <div className="resource-pill" title={`${label}: ${formatResource(value)}${cap ? ` / ${formatResource(cap)}` : ''}${rate ? ` (+${formatResource(rate)}/h)` : ''}`}>
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
