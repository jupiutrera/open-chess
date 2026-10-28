import { useEffect, useRef, useState } from 'react'
import { Engine, type PvLine } from '../../engine/engine'
import { usePageVisible } from '../../ui/usePageVisible'

/** Engine info lines arrive dozens of times a second; the UI takes at most one update per frame budget. */
const INFO_INTERVAL = 120

const NO_LINES: PvLine[] = []

/** Results for one position; `done` once the search has finished. */
interface AnalysisState {
  fen: string
  lines: PvLine[]
  depth: number
  done: boolean
}

/** Continuous multi-PV analysis of a position with its own engine instance. */
export function useAnalysis(fen: string, enabled: boolean, multipv = 3, maxDepth = 22) {
  const engine = useRef<Engine | null>(null)
  const [state, setState] = useState<AnalysisState | null>(null)
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
    setState(null)
    if (!running || !engine.current) return
    let alive = true
    let latest: { l: PvLine[]; d: number } | null = null
    let flush: ReturnType<typeof setTimeout> | undefined
    const publish = (done = false) => {
      flush = undefined
      if (!alive || !latest) return
      setState({ fen, lines: latest.l, depth: latest.d, done })
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
          clearTimeout(flush)
          publish(true)
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

  // results only ever describe the position they were searched for (never the previous one for a render)
  const fresh = state?.fen === fen ? state : null
  return { lines: fresh?.lines ?? NO_LINES, depth: fresh?.depth ?? 0, done: fresh?.done ?? false }
}
