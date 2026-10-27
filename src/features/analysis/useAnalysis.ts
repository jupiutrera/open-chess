import { useEffect, useRef, useState } from 'react'
import { Engine, type PvLine } from '../../engine/engine'

/** Continuous multi-PV analysis of a position with its own engine instance. */
export function useAnalysis(fen: string, enabled: boolean, multipv = 3, maxDepth = 22) {
  const engine = useRef<Engine | null>(null)
  const [lines, setLines] = useState<PvLine[]>([])
  const [depth, setDepth] = useState(0)

  useEffect(() => {
    if (!enabled) return
    engine.current ??= new Engine()
    return () => engine.current?.stop()
  }, [enabled])

  useEffect(
    () => () => {
      engine.current?.destroy()
      engine.current = null
    },
    [],
  )

  useEffect(() => {
    if (!enabled || !engine.current) {
      setLines([])
      setDepth(0)
      return
    }
    setLines([])
    setDepth(0)
    let alive = true
    const timer = setTimeout(() => {
      void engine.current?.search(fen, {
        depth: maxDepth,
        multipv,
        onInfo: (l, d) => {
          if (!alive) return
          setLines(l)
          setDepth(d)
        },
      })
    }, 60)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [fen, enabled, multipv, maxDepth])

  return { lines, depth }
}
