import type { QueryClient } from '@tanstack/react-query'
import type { Kingdom } from '@/../db/schema'

// Optimistically deduct a resource cost from the kingdom query cache.
// Accounts for production accrued since lastResourceUpdate so the result
// matches what useResourceTicker would display at the moment of the call.
// Returns the previous cache entry for rollback in onError.
export function deductResources(
  qc: QueryClient,
  key: readonly unknown[],
  cost: { wood: number; stone: number; grain: number },
): Kingdom | undefined {
  const prev = qc.getQueryData<Kingdom>(key)
  if (!prev) return undefined

  const now = Math.floor(Date.now() / 1000)
  const elapsedHours = prev.lastResourceUpdate > 0
    ? Math.max(0, (Date.now() - prev.lastResourceUpdate * 1000) / 3_600_000)
    : 0

  const curWood  = Math.min(prev.wood  + prev.woodProduction  * elapsedHours, prev.woodCapacity)
  const curStone = Math.min(prev.stone + prev.stoneProduction * elapsedHours, prev.stoneCapacity)
  const curGrain = Math.min(prev.grain + prev.grainProduction * elapsedHours, prev.grainCapacity)

  qc.setQueryData(key, {
    ...prev,
    wood:               Math.max(0, curWood  - cost.wood),
    stone:              Math.max(0, curStone - cost.stone),
    grain:              Math.max(0, curGrain - cost.grain),
    lastResourceUpdate: now,
  })

  return prev
}
