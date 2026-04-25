import { CheckCircle2, XCircle } from 'lucide-react'
import { getReqName } from '@/lib/game-names'

interface Requirement {
  type: 'building' | 'research'
  id: string
  level: number
}

interface Props {
  requires: Requirement[]
  /** Current building levels — pass kingdom object */
  kingdom?: Record<string, unknown> | null
  /** Current research levels — pass research object */
  research?: Record<string, unknown> | null
}

export function RequirementsList({ requires, kingdom, research }: Props) {
  if (!requires || requires.length === 0) return null

  const withStatus = requires.map(req => {
    const current = Number(
      req.type === 'building' ? (kingdom?.[req.id] ?? 0) : (research?.[req.id] ?? 0)
    )
    return { ...req, current, met: current >= req.level }
  })

  const sorted = [
    ...withStatus.filter(r => r.met),
    ...withStatus.filter(r => !r.met).sort((a, b) => a.level - b.level),
  ]

  return (
    <div className="space-y-1 py-1">
      {sorted.map(req => {
        const label = getReqName(req.type, req.id)
        return (
          <div
            key={`${req.type}-${req.id}`}
            className={`flex items-center gap-1.5 text-xs ${req.met ? 'text-forest' : 'text-crimson'}`}
          >
            {req.met ? (
              <CheckCircle2 size={11} className="shrink-0" />
            ) : (
              <XCircle size={11} className="shrink-0" />
            )}
            <span className="font-ui">
              {label} <span className="font-semibold">Nv {req.level}</span>
            </span>
            {!req.met && (
              <span className="ml-auto tabular-nums font-ui text-[0.65rem] text-crimson/70">
                {req.current}/{req.level}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
