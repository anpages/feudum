import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

// Auth pages — load immediately (user lands here first)
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'

// Lazy — shown rarely, no need to block initial render
const NicknamePage     = lazy(() => import('@/features/auth/NicknamePage').then(m => ({ default: m.NicknamePage })))

// Game pages — lazy loaded (only fetched after login). A single Suspense in
// GameLayout below handles all of them so we don't get a cascade of fallbacks.
const GameLayout        = lazy(() => import('@/components/layout/GameLayout').then(m => ({ default: m.GameLayout })))
const OverviewPage      = lazy(() => import('@/features/overview/OverviewPage').then(m => ({ default: m.OverviewPage })))
const ResourcesPage     = lazy(() => import('@/features/resources/ResourcesPage').then(m => ({ default: m.ResourcesPage })))
const ResourceSettings  = lazy(() => import('@/features/resources/ResourceSettingsPage').then(m => ({ default: m.ResourceSettingsPage })))
const FacilitiesPage    = lazy(() => import('@/features/facilities/FacilitiesPage').then(m => ({ default: m.FacilitiesPage })))
const ResearchPage      = lazy(() => import('@/features/research/ResearchPage').then(m => ({ default: m.ResearchPage })))
const BarracksPage      = lazy(() => import('@/features/barracks/BarracksPage').then(m => ({ default: m.BarracksPage })))
const DefensePage       = lazy(() => import('@/features/defense/DefensePage').then(m => ({ default: m.DefensePage })))
const MapPage           = lazy(() => import('@/features/map/MapPage').then(m => ({ default: m.MapPage })))
const ArmiesPage        = lazy(() => import('@/features/armies/ArmiesPage').then(m => ({ default: m.ArmiesPage })))
const RankingsPage      = lazy(() => import('@/features/rankings/RankingsPage').then(m => ({ default: m.RankingsPage })))
const AchievementsPage  = lazy(() => import('@/features/achievements/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const MessagesPage      = lazy(() => import('@/features/messages/MessagesPage').then(m => ({ default: m.MessagesPage })))
const ProfilePage       = lazy(() => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const AdminPage         = lazy(() => import('@/features/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const NotFoundPage      = lazy(() => import('@/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

function GameFallback() {
  return (
    <div className="bg-game min-h-screen flex items-center justify-center">
      <p className="font-ui text-parchment-dim text-sm animate-pulse">Cargando…</p>
    </div>
  )
}

function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && user.username === null) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function OnboardingRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && user.username) return <Navigate to="/overview" replace />
  return <NicknamePage />
}

function RootRedirect() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const error = params.get('error')
  if (error) return <Navigate to={`/login?error=${error}`} replace />
  if (next === 'onboarding') return <Navigate to="/onboarding" replace />
  return <Navigate to="/overview" replace />
}

export default function App() {
  return (
    <>
      <Suspense fallback={<GameFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<GameLayout />}>
              <Route path="/"                   element={<RootRedirect />} />
              <Route path="/overview"           element={<OverviewPage />} />
              <Route path="/resources"          element={<ResourcesPage />} />
              <Route path="/resources/settings" element={<ResourceSettings />} />
              <Route path="/facilities"         element={<FacilitiesPage />} />
              <Route path="/buildings"          element={<Navigate to="/resources" replace />} />
              <Route path="/research"           element={<ResearchPage />} />
              <Route path="/barracks"           element={<BarracksPage mode="attack" />} />
              <Route path="/support"            element={<BarracksPage mode="support" />} />
              <Route path="/defense"            element={<DefensePage />} />
              <Route path="/map"                element={<MapPage />} />
              <Route path="/armies"             element={<ArmiesPage />} />
              <Route path="/rankings"           element={<RankingsPage />} />
              <Route path="/achievements"       element={<AchievementsPage />} />
              <Route path="/messages"           element={<MessagesPage />} />
              <Route path="/profile"            element={<ProfilePage />} />
              <Route path="/admin"              element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
