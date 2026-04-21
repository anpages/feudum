import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, Swords } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useArmies } from '@/features/armies/useArmies'
import { MissionRow } from './components/MissionRow'

export function ArmiesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: armies, isLoading } = useArmies()

  const handleEnd = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['armies'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
  }, [qc])

  const activeMissions    = armies?.missions.filter(m => m.state === 'active')    ?? []
  const returningMissions = armies?.missions.filter(m => m.state === 'returning') ?? []
  const merchantMissions  = armies?.missions.filter(m => m.state === 'merchant')  ?? []
  const totalMissions     = activeMissions.length + returningMissions.length + merchantMissions.length

  return (
    <div className="space-y-6">
      <div className="anim-fade-up flex items-start justify-between gap-4">
        <div>
          <span className="section-heading">Ejército</span>
          <h1 className="page-title mt-0.5">Misiones</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">Gestiona tus ejércitos en campaña.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 mt-1 shrink-0">
          <Button variant="primary" size="sm" onClick={() => navigate('/armies/send')}>
            <Plus size={13} />
            Enviar misión
          </Button>
          {armies?.fleetSlots && (
            <span className={`flex items-center gap-1 font-ui text-[0.65rem] tabular-nums ${
              armies.fleetSlots.used >= armies.fleetSlots.max ? 'text-crimson font-semibold' : 'text-ink-muted'
            }`}>
              <Swords size={9} />
              {armies.fleetSlots.used}/{armies.fleetSlots.max} slots
            </span>
          )}
        </div>
      </div>

      <div className="anim-fade-up-1 space-y-3">
        {isLoading ? (
          <MissionsSkeleton />
        ) : totalMissions === 0 ? (
          <Card className="p-10 text-center">
            <Shield size={28} className="text-ink-muted/25 mx-auto mb-3" />
            <p className="font-body text-sm text-ink-muted/50">No hay misiones en curso</p>
          </Card>
        ) : (
          <>
            {activeMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">En curso ({activeMissions.length})</p>
                {activeMissions.map(m => <MissionRow key={m.id} mission={m} onEnd={handleEnd} />)}
              </div>
            )}
            {returningMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">Retornando ({returningMissions.length})</p>
                {returningMissions.map(m => <MissionRow key={m.id} mission={m} onEnd={handleEnd} />)}
              </div>
            )}
            {merchantMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">Mercader ({merchantMissions.length})</p>
                {merchantMissions.map(m => <MissionRow key={m.id} mission={m} onEnd={handleEnd} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MissionsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-2.5 w-48" />
            </div>
            <div className="skeleton h-4 w-16" />
          </div>
        </Card>
      ))}
    </div>
  )
}
