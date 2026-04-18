import { NavLink } from 'react-router-dom'
import { X, ShieldAlert } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiCastle,
  GiAnvil,
  GiSpellBook,
  GiMedievalBarracks,
  GiCrossedSwords,
  GiTreasureMap,
  GiTrophy,
  GiScrollUnfurled,
} from 'react-icons/gi'
import { useUnreadCount } from '@/features/messages/useMessages'
import { useAuth } from '@/features/auth/useAuth'

interface NavItem {
  to: string
  label: string
  Icon: IconType
}

const NAV_ITEMS: NavItem[] = [
  { to: '/overview', label: 'Reino', Icon: GiCastle },
  { to: '/buildings', label: 'Construcción', Icon: GiAnvil },
  { to: '/research', label: 'Academia', Icon: GiSpellBook },
  { to: '/barracks', label: 'Cuartel', Icon: GiMedievalBarracks },
  { to: '/armies', label: 'Ejércitos', Icon: GiCrossedSwords },
  { to: '/map', label: 'Mapa', Icon: GiTreasureMap },
  { to: '/rankings', label: 'Rankings', Icon: GiTrophy },
  { to: '/messages', label: 'Mensajes', Icon: GiScrollUnfurled },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NavBar({ isOpen, onClose }: Props) {
  const unread = useUnreadCount()
  const { user } = useAuth()

  return (
    <nav className={`game-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Mobile close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold/10 lg:hidden">
        <span className="font-display text-[0.62rem] text-gold-dim tracking-[0.2em] uppercase">
          Menú
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded text-ink-muted hover:text-ink transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Nav items */}
      <div className="py-2 flex-1">
        <span className="nav-section-label">Gestión</span>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="nav-icon shrink-0" />
            <span className="flex-1">{label}</span>
            {to === '/messages' && unread > 0 && (
              <span className="ml-auto text-[10px] font-ui font-semibold bg-crimson text-parchment rounded-full px-1.5 py-0.5 leading-none">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Admin link */}
      {user?.isAdmin && (
        <div className="px-2 pb-2 border-t border-gold/10 pt-2">
          <span className="nav-section-label">Sistema</span>
          <NavLink
            to="/admin"
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <ShieldAlert size={16} className="nav-icon shrink-0" />
            <span className="flex-1">Admin</span>
          </NavLink>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gold/10">
        <p className="font-ui text-[0.58rem] text-ink-muted/40 tracking-[0.18em] uppercase select-none">
          Feudum · Anno MMXXVI
        </p>
      </div>
    </nav>
  )
}
