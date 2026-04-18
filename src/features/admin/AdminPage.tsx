import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Settings, Users, Zap, Swords } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { ServerTab }   from './tabs/ServerTab'
import { PlayersTab }  from './tabs/PlayersTab'
import { DevTab }      from './tabs/DevTab'
import { MissionsTab } from './tabs/MissionsTab'

type Tab = 'server' | 'players' | 'dev' | 'missions'

const TABS: { id: Tab; label: string; Icon: typeof Settings }[] = [
  { id: 'server',   label: 'Servidor',  Icon: Settings },
  { id: 'players',  label: 'Jugadores', Icon: Users },
  { id: 'dev',      label: 'Dev',       Icon: Zap },
  { id: 'missions', label: 'Misiones',  Icon: Swords },
]

export function AdminPage() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('server')

  if (isLoading) return null
  if (!user?.isAdmin) return <Navigate to="/overview" replace />

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Sistema</span>
        <h1 className="page-title mt-0.5">Panel de administración</h1>
      </div>

      <div className="flex gap-1 border-b border-gold/10 anim-fade-up-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-ui text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px whitespace-nowrap
              ${tab === id ? 'text-gold border-gold' : 'text-ink-muted border-transparent hover:text-ink'}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="anim-fade-up-2">
        {tab === 'server'   && <ServerTab />}
        {tab === 'players'  && <PlayersTab />}
        {tab === 'dev'      && <DevTab />}
        {tab === 'missions' && <MissionsTab />}
      </div>
    </div>
  )
}
