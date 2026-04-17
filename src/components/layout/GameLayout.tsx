import { Outlet } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { NavBar } from './NavBar'

export function GameLayout() {
  return (
    <div className="min-h-screen bg-stone-950 text-parchment flex flex-col">
      <ResourceBar />
      <NavBar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
    </div>
  )
}
