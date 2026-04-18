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

  return (
    <div className="space-y-1 py-1">
      {requires.map(req => {
        const current = Number(
          req.type === 'building' ? (kingdom?.[req.id] ?? 0) : (research?.[req.id] ?? 0)
        )
        const met = current >= req.level
        const label = getReqName(req.type, req.id)

        return (
          <div
            key={`${req.type}-${req.id}`}
            className={`flex items-center gap-1.5 text-xs ${met ? 'text-forest' : 'text-crimson'}`}
          >
            {met ? (
              <CheckCircle2 size={11} className="shrink-0" />
            ) : (
              <XCircle size={11} className="shrink-0" />
            )}
            <span className="font-ui">
              {label} <span className="font-semibold">Nv {req.level}</span>
            </span>
            <span
              className={`ml-auto tabular-nums font-ui text-[0.65rem] ${met ? 'text-forest/70' : 'text-crimson/70'}`}
            >
              {current}/{req.level}
            </span>
          </div>
        )
      })}
    </div>
  )
}
