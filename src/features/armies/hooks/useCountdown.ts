import { useState, useEffect } from 'react'

export function useCountdown(targetSecs: number | null, onEnd?: () => void) {
  const [secs, setSecs] = useState(() =>
    targetSecs ? Math.max(0, targetSecs - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!targetSecs) return
    let fired = false
    const tick = () => {
      const rem = Math.max(0, targetSecs - Math.floor(Date.now() / 1000))
      setSecs(rem)
      if (rem === 0 && !fired) {
        fired = true
        onEnd?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetSecs, onEnd])
  return secs
}
