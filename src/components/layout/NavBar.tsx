import { NavLink } from 'react-router-dom'
import {
  X, ShieldAlert,
  Castle, Factory, Building2, BookOpen, Swords, Shield, Navigation, Map, Trophy, BarChart2, Users, Landmark,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { usePendingClaimsCount } from '@/features/achievements/useAchievements'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/overview',    label: 'Reino',         Icon: Castle },
  { to: '/resources',   label: 'Recursos',      Icon: Factory },
  { to: '/facilities',  label: 'Instalaciones', Icon: Building2 },
  { to: '/research',    label: 'Academia',      Icon: BookOpen },
  { to: '/barracks',    label: 'Ataque',        Icon: Swords },
  { to: '/support',     label: 'Apoyo',         Icon: Users },
  { to: '/defense',     label: 'Defensa',       Icon: Shield },
  { to: '/armies',      label: 'Misiones',      Icon: Navigation },
  { to: '/map',         label: 'Mapa',          Icon: Map },
  { to: '/lifeforms',   label: 'Civilización',  Icon: Landmark },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NavBar({ isOpen, onClose }: Props) {
  const { user } = useAuth()
  const newAchievements = usePendingClaimsCount()

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
          </NavLink>
        ))}

        <span className="nav-section-label mt-3">Social</span>
        <NavLink to="/rankings"     onClick={onClose} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <BarChart2 size={16} className="nav-icon shrink-0" />
          <span className="flex-1">Rankings</span>
        </NavLink>
        <NavLink to="/achievements" onClick={onClose} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Trophy size={16} className="nav-icon shrink-0" />
          <span className="flex-1">Logros</span>
          {newAchievements > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full font-ui text-[0.6rem] font-bold flex items-center justify-center"
              style={{ background: '#b8860b', color: '#faf6ef' }}>
              {newAchievements}
            </span>
          )}
        </NavLink>
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
