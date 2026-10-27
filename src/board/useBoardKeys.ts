import { useEffect, useRef } from 'react'
import { overlayOpen } from '../ui/kit'

/**
 * Lichess-style keys for any board with a move history: ← → step, ↑ / Home first,
 * ↓ / End last, F flips. Ignored while typing or with a sheet open.
 */
export function useBoardKeys({ ply, total, goto, flip }: { ply: number; total: number; goto: (ply: number) => void; flip?: () => void }) {
  const state = useRef({ ply, total, goto, flip })
  state.current = { ply, total, goto, flip }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.altKey || e.ctrlKey || e.metaKey || overlayOpen()) return
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      const s = state.current
      const to =
        e.key === 'ArrowLeft' ? s.ply - 1 : e.key === 'ArrowRight' ? s.ply + 1 : e.key === 'ArrowUp' || e.key === 'Home' ? 0 : e.key === 'ArrowDown' || e.key === 'End' ? s.total : null
      if (to !== null) {
        e.preventDefault()
        s.goto(Math.max(0, Math.min(s.total, to)))
      } else if ((e.key === 'f' || e.key === 'F') && s.flip) {
        e.preventDefault()
        s.flip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
