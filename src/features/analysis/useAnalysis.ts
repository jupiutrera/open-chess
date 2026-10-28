import { useEffect, useRef, useState } from 'react'
import { Engine, type PvLine } from '../../engine/engine'
import { usePageVisible } from '../../ui/usePageVisible'

/** Engine info lines arrive dozens of times a second; the UI takes at most one update per frame budget. */
const INFO_INTERVAL = 120

/** Continuous multi-PV analysis of a position with its own engine instance. */
export function useAnalysis(fen: string, enabled: boolean, multipv = 3, maxDepth = 22) {
  const engine = useRef<Engine | null>(null)
  const [lines, setLines] = useState<PvLine[]>([])
  const [depth, setDepth] = useState(0)
  // a hidden tab stops searching (battery) and starts again when shown
  const visible = usePageVisible()
  const running = enabled && visible

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
    if (!running || !engine.current) {
      setLines([])
      setDepth(0)
      return
    }
    setLines([])
    setDepth(0)
    let alive = true
    let latest: { l: PvLine[]; d: number } | null = null
    let flush: ReturnType<typeof setTimeout> | undefined
    const publish = () => {
      flush = undefined
      if (!alive || !latest) return
      setLines(latest.l)
      setDepth(latest.d)
    }
    const timer = setTimeout(() => {
      void engine.current
        ?.search(fen, {
          depth: maxDepth,
          multipv,
          onInfo: (l, d) => {
            latest = { l, d }
            flush ??= setTimeout(publish, INFO_INTERVAL)
          },
        })
        .then((r) => {
          // the final result also covers searches whose info lines never reached a publish
          if (r.lines.length) latest = { l: r.lines, d: r.depth }
          publish()
        })
        // a destroyed or crashed engine: the panel simply stays empty
        .catch(() => undefined)
    }, 60)
    return () => {
      alive = false
      clearTimeout(timer)
      clearTimeout(flush)
      engine.current?.stop()
    }
  }, [fen, running, multipv, maxDepth])

  return { lines, depth }
}
