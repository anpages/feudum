import { NavLink } from 'react-router-dom'
import { Castle, Hammer, BookOpen, Swords, Map, X } from 'lucide-react'
import { type ElementType } from 'react'

interface NavItem {
  to: string
  label: string
  Icon: ElementType
}

const NAV_ITEMS: NavItem[] = [
  { to: '/overview',  label: 'Reino',        Icon: Castle   },
  { to: '/buildings', label: 'Construcción', Icon: Hammer   },
  { to: '/research',  label: 'Academia',     Icon: BookOpen },
  { to: '/barracks',  label: 'Cuartel',      Icon: Swords   },
  { to: '/map',       label: 'Mapa',         Icon: Map      },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NavBar({ isOpen, onClose }: Props) {
  return (
    <nav className={`game-sidebar ${isOpen ? 'open' : ''}`}>

      {/* Mobile close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold/10 lg:hidden">
        <span className="font-display text-xs text-gold tracking-widest uppercase">Menú</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-ink-muted hover:text-ink transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav items */}
      <div className="py-3 flex-1">
        <p className="nav-section-label">Gestión</p>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gold/10">
        <p className="font-ui text-[0.6rem] text-ink-muted/50 tracking-widest uppercase">
          Feudum · v0.1
        </p>
      </div>

    </nav>
  )
}
