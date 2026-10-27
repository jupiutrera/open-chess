import { useCallback, useEffect, useRef, useState } from 'react'
import { play } from './sounds'

/** Two-sided chess clock. `active` is the side whose time runs (null = paused). */
export function useClock(baseSec: number, incSec: number, onFlag: (side: 'w' | 'b') => void) {
  const enabled = baseSec > 0
  const [time, setTime] = useState({ w: baseSec * 1000, b: baseSec * 1000 })
  const [active, setActive] = useState<'w' | 'b' | null>(null)
  const last = useRef<number>(0)
  const flagged = useRef(false)
  const warned = useRef({ w: false, b: false })
  const onFlagRef = useRef(onFlag)
  onFlagRef.current = onFlag

  useEffect(() => {
    if (!enabled || !active) return
    last.current = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - last.current
      last.current = now
      setTime((t) => {
        const left = t[active] - dt
        if (left <= 10_000 && !warned.current[active]) {
          warned.current[active] = true
          play('lowtime')
        }
        if (left <= 0 && !flagged.current) {
          flagged.current = true
          setTimeout(() => onFlagRef.current(active), 0)
          return { ...t, [active]: 0 }
        }
        return { ...t, [active]: Math.max(0, left) }
      })
    }, 100)
    return () => clearInterval(id)
  }, [active, enabled])

  /** Called after `side` has moved: adds increment and starts the opponent. */
  const press = useCallback(
    (side: 'w' | 'b') => {
      if (!enabled) return
      setTime((t) => ({ ...t, [side]: t[side] + incSec * 1000 }))
      setActive(side === 'w' ? 'b' : 'w')
    },
    [enabled, incSec],
  )

  const stop = useCallback(() => setActive(null), [])
  const reset = useCallback(() => {
    flagged.current = false
    warned.current = { w: false, b: false }
    setTime({ w: baseSec * 1000, b: baseSec * 1000 })
    setActive(null)
  }, [baseSec])

  return { enabled, time, active, press, stop, reset }
}
