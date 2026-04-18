import { NavLink } from 'react-router-dom'
import { Castle, Hammer, BookOpen, Swords, Map, X, Sword } from 'lucide-react'
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
  { to: '/armies',    label: 'Ejércitos',    Icon: Sword    },
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
        <span className="font-display text-[0.62rem] text-gold-dim tracking-[0.2em] uppercase">Menú</span>
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
            <Icon size={15} className="nav-icon shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gold/10">
        <p className="font-ui text-[0.58rem] text-ink-muted/40 tracking-[0.18em] uppercase select-none">
          Feudum · Anno MMXXVI
        </p>
      </div>

    </nav>
  )
}
