import { NavLink } from 'react-router-dom'
import {
  X, ShieldAlert,
  Castle, Factory, Building2, BookOpen, Swords, Shield, Navigation, Map, BarChart2, Users,
  type LucideIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'

import type { ArmiesResponse } from '@/features/armies/types'

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
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NavBar({ isOpen, onClose }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const underAttack = (qc.getQueryData<ArmiesResponse>(['armies'])?.underAttack) ?? false

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
            {to === '/armies' && underAttack && (
              <span className="ml-auto w-2 h-2 rounded-full bg-crimson animate-pulse" />
            )}
          </NavLink>
        ))}

        <span className="nav-section-label mt-3">Social</span>
        <NavLink to="/rankings"     onClick={onClose} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <BarChart2 size={16} className="nav-icon shrink-0" />
          <span className="flex-1">Rankings</span>
        </NavLink>

      </div>

      {/* Admin link */}
      {user?.role === 'admin' && (
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
