import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { to: '/overview',  label: 'Reino' },
  { to: '/buildings', label: 'Construcción' },
  { to: '/research',  label: 'Academia' },
  { to: '/barracks',  label: 'Cuartel' },
  { to: '/map',       label: 'Mapa' },
]

export function NavBar() {
  return (
    <nav className="bg-stone-900 border-b border-stone-800">
      <div className="max-w-7xl mx-auto flex items-center gap-1 px-4 overflow-x-auto">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-gold text-gold'
                  : 'border-transparent text-stone-400 hover:text-parchment hover:border-stone-500',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
