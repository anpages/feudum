import { useEffect, useState } from 'react'

/**
 * Returns current epoch seconds, refreshed every `intervalMs`.
 * Use for live displays (countdowns, "time left") so React knows to re-render.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
