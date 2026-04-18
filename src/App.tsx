import { Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { GameLayout } from '@/components/layout/GameLayout'
import { OverviewPage } from '@/pages/OverviewPage'
import { BuildingsPage } from '@/pages/BuildingsPage'
import { ResearchPage } from '@/pages/ResearchPage'
import { BarracksPage } from '@/pages/BarracksPage'
import { MapPage } from '@/pages/MapPage'
import { ArmiesPage } from '@/pages/ArmiesPage'
import { LoginPage } from '@/pages/LoginPage'
import { NicknamePage } from '@/pages/NicknamePage'
import { useAuth } from '@/hooks/useAuth'

function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.username === null) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function RootRedirect() {
  const [params] = useSearchParams()
  const next  = params.get('next')
  const error = params.get('error')
  if (error)              return <Navigate to={`/login?error=${error}`} replace />
  if (next === 'onboarding') return <Navigate to="/onboarding" replace />
  return <Navigate to="/overview" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/onboarding" element={<NicknamePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<GameLayout />}>
          <Route path="/"          element={<RootRedirect />} />
          <Route path="/overview"  element={<OverviewPage />}  />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/research"  element={<ResearchPage />}  />
          <Route path="/barracks"  element={<BarracksPage />}  />
          <Route path="/map"       element={<MapPage />}       />
          <Route path="/armies"   element={<ArmiesPage />}   />
        </Route>
      </Route>
    </Routes>
  )
}
