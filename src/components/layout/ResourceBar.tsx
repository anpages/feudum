import { useNavigate } from 'react-router-dom'
import { Menu, Zap, Bell, UserRound, Castle, TreePine, Mountain, Wheat } from 'lucide-react'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useAuth } from '@/features/auth/useAuth'
import { useUnreadCount } from '@/features/messages/useMessages'
import { KingdomSelector } from './KingdomSelector'
import { ResourcePill } from './ResourcePill'
import { EnergyPill } from './EnergyPill'
import { MobileResources } from './MobileResources'

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
            <Castle size={12} className="text-gold" />
          </div>
          <div className="hidden sm:flex flex-col leading-none gap-0.5">
            <span className="font-display text-sm text-gold-dim tracking-[0.18em] uppercase leading-none">Feudum</span>
            <span className="font-ui text-[0.5rem] text-gold-dim/50 tracking-[0.15em] uppercase">Anno MMXXVI</span>
          </div>
          <KingdomSelector kingdomName={kingdom?.name} />
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

      <div className="flex md:hidden items-center flex-1 justify-center px-1">
        <MobileResources resources={resources} kingdom={kingdom} user={user ?? null} />
      </div>

      <div className="hidden md:flex items-center gap-0.5 sm:gap-1 flex-1 justify-center overflow-x-auto no-scrollbar px-1 sm:px-2">
        <ResourcePill icon={<TreePine  size={12} />} label="Madera" value={resources.wood}  cap={kingdom?.woodCapacity}  rate={kingdom?.woodProduction} />
        <ResourcePill icon={<Mountain size={12} />} label="Piedra" value={resources.stone} cap={kingdom?.stoneCapacity} rate={kingdom?.stoneProduction} />
        <ResourcePill icon={<Wheat    size={12} />} label="Grano"  value={resources.grain} cap={kingdom?.grainCapacity} rate={kingdom?.grainProduction} />
        <EnergyPill kingdom={kingdom as Record<string, unknown> | null | undefined} />
        <div
          className={`hidden xl:flex resource-pill items-center gap-1.5 ${(user?.ether ?? 0) === 0 ? 'opacity-30' : ''}`}
          title="Éter arcano"
        >
          <Zap size={10} className="text-gold" />
          <span className="font-ui text-xs tabular-nums text-gold-dim font-semibold">{user?.ether ?? 0}</span>
        </div>
      </div>

      <div className="header-divider mx-1 hidden sm:block" />

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
