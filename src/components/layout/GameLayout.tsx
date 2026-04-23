import { useState, useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { NavBar } from './NavBar'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { useRealtime } from '@/features/realtime/useRealtime'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { watchSystemTheme } from '@/lib/theme'

export function GameLayout() {
  useRealtime()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => watchSystemTheme(), [])

  return (
    <div className="game-layout">
      <ResourceBar onMenuToggle={toggleSidebar} />

      {sidebarOpen && <div className="sidebar-overlay lg:hidden" onClick={closeSidebar} />}

      <NavBar isOpen={sidebarOpen} onClose={closeSidebar} />

      <main className="game-content">
        <div className="game-content-inner">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </div>
      </main>

      <ToastContainer />
    </div>
  )
}
