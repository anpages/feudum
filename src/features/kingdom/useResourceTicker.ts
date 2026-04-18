import { useState, useEffect, useRef } from 'react'
import type { Kingdom } from '@/../db/schema'

export function useResourceTicker(kingdom: Kingdom | undefined) {
  const kingdomRef = useRef(kingdom)
  useEffect(() => {
    kingdomRef.current = kingdom
  }, [kingdom])

  const baseRef = useRef({ wood: 0, stone: 0, grain: 0 })
  const baseTimeRef = useRef(0)

  const [resources, setResources] = useState({ wood: 0, stone: 0, grain: 0 })

  useEffect(() => {
    if (!kingdom) return

    baseRef.current = { wood: kingdom.wood, stone: kingdom.stone, grain: kingdom.grain }
    baseTimeRef.current = Date.now()

    function tick() {
      const k = kingdomRef.current
      if (!k) return
      const elapsedHours = (Date.now() - baseTimeRef.current) / 3_600_000
      setResources({
        wood: Math.min(baseRef.current.wood + k.woodProduction * elapsedHours, k.woodCapacity),
        stone: Math.min(baseRef.current.stone + k.stoneProduction * elapsedHours, k.stoneCapacity),
        grain: Math.min(baseRef.current.grain + k.grainProduction * elapsedHours, k.grainCapacity),
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
