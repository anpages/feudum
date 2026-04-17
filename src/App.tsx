import { Routes, Route, Navigate } from 'react-router-dom'
import { GameLayout } from '@/components/layout/GameLayout'
import { OverviewPage } from '@/pages/OverviewPage'
import { BuildingsPage } from '@/pages/BuildingsPage'
import { ResearchPage } from '@/pages/ResearchPage'
import { BarracksPage } from '@/pages/BarracksPage'
import { MapPage } from '@/pages/MapPage'
import { LoginPage } from '@/pages/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<GameLayout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/buildings" element={<BuildingsPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/barracks" element={<BarracksPage />} />
        <Route path="/map" element={<MapPage />} />
      </Route>
    </Routes>
  )
}
