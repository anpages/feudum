import { useState, useEffect } from 'react'
import type { Kingdom } from '@db/schema'

// Interpolates resources locally each second based on server-provided production rates.
// Keeps the UI feeling live without hammering the API.
export function useResourceTicker(kingdom: Kingdom | undefined) {
  const [resources, setResources] = useState({ wood: 0, stone: 0, grain: 0 })

  useEffect(() => {
    if (!kingdom) return

    setResources({
      wood: kingdom.wood,
      stone: kingdom.stone,
      grain: kingdom.grain,
    })

    const interval = setInterval(() => {
      setResources((prev) => ({
        wood:  Math.min(prev.wood  + kingdom.woodProduction  / 3600, kingdom.woodCapacity),
        stone: Math.min(prev.stone + kingdom.stoneProduction / 3600, kingdom.stoneCapacity),
        grain: Math.min(prev.grain + kingdom.grainProduction / 3600, kingdom.grainCapacity),
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [kingdom])

  return resources
}
