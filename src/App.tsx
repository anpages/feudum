import { Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { GameLayout } from '@/components/layout/GameLayout'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { ResourceSettingsPage } from '@/features/resources/ResourceSettingsPage'
import { FacilitiesPage } from '@/features/facilities/FacilitiesPage'
import { ResearchPage } from '@/features/research/ResearchPage'
import { BarracksPage } from '@/features/barracks/BarracksPage'
import { DefensePage } from '@/features/defense/DefensePage'
import { MapPage } from '@/features/map/MapPage'
import { ArmiesPage } from '@/features/armies/ArmiesPage'
import { RankingsPage } from '@/features/rankings/RankingsPage'
import { AchievementsPage } from '@/features/achievements/AchievementsPage'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { AdminPage } from '@/features/admin/AdminPage'
import { NotFoundPage } from '@/NotFoundPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NicknamePage } from '@/features/auth/NicknamePage'
import { useAuth } from '@/features/auth/useAuth'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'

function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.username === null) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function OnboardingRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.username !== null && user?.username !== undefined)
    return <Navigate to="/overview" replace />
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
      <PWAInstallPrompt />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<GameLayout />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/resources/settings" element={<ResourceSettingsPage />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/buildings" element={<Navigate to="/resources" replace />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/barracks" element={<BarracksPage />} />
            <Route path="/defense" element={<DefensePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/armies" element={<ArmiesPage />} />
            <Route path="/rankings" element={<RankingsPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
