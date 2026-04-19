import { useState, useEffect, useRef } from 'react'
import type { Kingdom } from '@/../db/schema'

// Interpolate resources locally between server fetches.
// Base time = kingdom.lastResourceUpdate (server seconds), NOT Date.now() —
// otherwise refresh resets the visible accumulated amount because the server
// only persists resources during mutations, not on plain reads.
export function useResourceTicker(kingdom: Kingdom | undefined) {
  const kingdomRef = useRef(kingdom)
  useEffect(() => {
    kingdomRef.current = kingdom
  }, [kingdom])

  const [resources, setResources] = useState({ wood: 0, stone: 0, grain: 0 })

  useEffect(() => {
    if (!kingdom) return

    function tick() {
      const k = kingdomRef.current
      if (!k) return
      // lastResourceUpdate is in seconds (server time)
      const baseTimeMs   = (k.lastResourceUpdate ?? 0) * 1000
      const elapsedHours = baseTimeMs > 0
        ? Math.max(0, (Date.now() - baseTimeMs) / 3_600_000)
        : 0
      setResources({
        wood:  Math.min(k.wood  + k.woodProduction  * elapsedHours, k.woodCapacity),
        stone: Math.min(k.stone + k.stoneProduction * elapsedHours, k.stoneCapacity),
        grain: Math.min(k.grain + k.grainProduction * elapsedHours, k.grainCapacity),
      })
    }

    const initId = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(initId)
      clearInterval(id)
    }
  }, [kingdom])

  return resources
}
