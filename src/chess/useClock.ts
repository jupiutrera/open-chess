import { useCallback, useEffect, useRef, useState } from 'react'
import { play } from './sounds'

/** Two-sided chess clock. `active` is the side whose time runs (null = paused). */
export function useClock(baseSec: number, incSec: number, onFlag: (side: 'w' | 'b') => void) {
  const enabled = baseSec > 0
  const [time, setTime] = useState({ w: baseSec * 1000, b: baseSec * 1000 })
  const [active, setActive] = useState<'w' | 'b' | null>(null)
  // the source of truth; `time` mirrors it for rendering
  const timeRef = useRef(time)
  const activeRef = useRef(active)
  const last = useRef<number>(0)
  const flagged = useRef(false)
  const warned = useRef({ w: false, b: false })
  const onFlagRef = useRef(onFlag)
  onFlagRef.current = onFlag

  /** Charges the running side for the time since the last tick. */
  const tick = useCallback(() => {
    const side = activeRef.current
    if (!side) return
    const now = performance.now()
    const left = Math.max(0, timeRef.current[side] - (now - last.current))
    last.current = now
    timeRef.current = { ...timeRef.current, [side]: left }
    setTime(timeRef.current)
    if (left <= 10_000 && !warned.current[side]) {
      warned.current[side] = true
      play('lowtime')
    }
    if (left <= 0 && !flagged.current) {
      flagged.current = true
      activeRef.current = null
      setActive(null)
      onFlagRef.current(side)
    }
  }, [])

  const start = useCallback(
    (side: 'w' | 'b' | null) => {
      tick()
      last.current = performance.now()
      activeRef.current = side
      setActive(side)
    },
    [tick],
  )

  useEffect(() => {
    if (!enabled || !active) return
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [active, enabled, tick])

  /** Called after `side` has moved: adds increment and starts the opponent. */
  const press = useCallback(
    (side: 'w' | 'b') => {
      if (!enabled || flagged.current) return
      tick()
      timeRef.current = { ...timeRef.current, [side]: timeRef.current[side] + incSec * 1000 }
      setTime(timeRef.current)
      start(side === 'w' ? 'b' : 'w')
    },
    [enabled, incSec, tick, start],
  )

  /** Takes back the increment `side` received for a move that was undone. */
  const unpress = useCallback(
    (side: 'w' | 'b') => {
      if (!enabled || !incSec) return
      timeRef.current = { ...timeRef.current, [side]: Math.max(0, timeRef.current[side] - incSec * 1000) }
      setTime(timeRef.current)
    },
    [enabled, incSec],
  )

  /** Hands the clock to `side` without increment (after a takeback). */
  const setTurn = useCallback(
    (side: 'w' | 'b') => {
      if (enabled && activeRef.current && !flagged.current) start(side)
    },
    [enabled, start],
  )

  const stop = useCallback(() => start(null), [start])
  const reset = useCallback(() => {
    flagged.current = false
    warned.current = { w: false, b: false }
    timeRef.current = { w: baseSec * 1000, b: baseSec * 1000 }
    activeRef.current = null
    setTime(timeRef.current)
    setActive(null)
  }, [baseSec])

  /** Puts back saved times and starts `side`'s clock (resuming a game). */
  const restore = useCallback(
    (t: { w: number; b: number }, side: 'w' | 'b') => {
      if (!enabled) return
      flagged.current = false
      warned.current = { w: t.w <= 10_000, b: t.b <= 10_000 }
      timeRef.current = t
      activeRef.current = null
      setTime(t)
      start(side)
    },
    [enabled, start],
  )

  // a different time control picked before the game starts
  useEffect(() => reset(), [reset])

  /** Current time left, exact to the millisecond (for engine time management). */
  const left = useCallback((side: 'w' | 'b') => {
    const t = timeRef.current[side]
    return activeRef.current === side ? Math.max(0, t - (performance.now() - last.current)) : t
  }, [])

  return { enabled, time, active, press, unpress, stop, reset, setTurn, restore, left }
}
