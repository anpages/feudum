import { NavLink } from 'react-router-dom'
import {
  X, ShieldAlert,
  Castle, Factory, Building2, BookOpen, Swords, Shield, Navigation, Map, BarChart2, Users,
  Sun, Moon, Monitor,
  type LucideIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { useTheme, type ThemeMode } from '@/lib/theme'

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
  { to: '/rankings',    label: 'Rankings',      Icon: BarChart2 },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

const THEME_OPTIONS: { mode: ThemeMode; Icon: LucideIcon; label: string }[] = [
  { mode: 'light', Icon: Sun,     label: 'Claro'  },
  { mode: 'dark',  Icon: Moon,    label: 'Oscuro' },
  { mode: 'auto',  Icon: Monitor, label: 'Auto'   },
]

export function NavBar({ isOpen, onClose }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { mode, setMode } = useTheme()
  const armiesData  = qc.getQueryData<ArmiesResponse>(['armies'])
  const underAttack = armiesData?.underAttack ?? false
  const activeMissions = (armiesData?.missions ?? []).filter(m => m.state !== 'completed').length

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
            {to === '/armies' && (activeMissions > 0 || underAttack) && (
              <span className={`ml-auto min-w-[1.25rem] h-5 rounded-full flex items-center justify-center font-ui text-[0.6rem] font-bold px-1 tabular-nums ${
                underAttack ? 'bg-crimson text-white animate-pulse' : 'bg-gold text-white'
              }`}>
                {activeMissions > 0 ? activeMissions : '!'}
              </span>
            )}
          </NavLink>
        ))}

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

      {/* Theme toggle */}
      <div className="px-3 pt-3 pb-2 border-t border-gold/10">
        <span className="nav-section-label !pt-0 !pb-2">Tema</span>
        <div className="flex gap-1">
          {THEME_OPTIONS.map(({ mode: m, Icon, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={label}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded transition-all font-ui text-[0.58rem] font-semibold tracking-wider uppercase border ${
                mode === m
                  ? 'bg-gold/10 text-gold border-gold/30'
                  : 'text-ink-muted hover:text-ink-mid hover:bg-gold/5 border-transparent'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
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
