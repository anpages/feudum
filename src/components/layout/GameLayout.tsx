import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { NavBar } from './NavBar'

export function GameLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar  = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="game-layout">
      <ResourceBar onMenuToggle={toggleSidebar} />

      {sidebarOpen && (
        <div className="sidebar-overlay lg:hidden" onClick={closeSidebar} />
      )}

      <NavBar isOpen={sidebarOpen} onClose={closeSidebar} />

      <main className="game-content">
        <div className="game-content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
