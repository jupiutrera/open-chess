import { useCallback, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { START_FEN } from './util'
import { playMoveSound } from './sounds'

/**
 * Game state with history browsing. `ply` is the position being viewed;
 * moves are only accepted at the live position.
 */
export function useGame(initialFen: string = START_FEN) {
  const [startFen, setStartFen] = useState(initialFen)
  const [moves, setMoves] = useState<Move[]>([])
  const [ply, setPly] = useState(0)
  const live = useRef(new Chess(initialFen))
  const plyRef = useRef(0)
  plyRef.current = ply

  const fens = useMemo(() => [startFen, ...moves.map((m) => m.after)], [startFen, moves])
  const fen = fens[ply] ?? fens[fens.length - 1]
  const atLive = ply === moves.length
  // stable identities, so the board isn't reconfigured on unrelated renders (clock ticks)
  const viewed = ply > 0 ? moves[ply - 1] : undefined
  const lastMove = useMemo(() => (viewed ? ([viewed.from, viewed.to] as [string, string]) : null), [viewed])
  const sans = useMemo(() => moves.map((m) => m.san), [moves])

  /** Plays a move at the live position; with `branch`, from the viewed ply (dropping later moves). */
  const move = useCallback((from: string, to: string, promotion?: string, sound = true, branch = false): Move | null => {
    if (branch) {
      const extra = live.current.history().length - plyRef.current
      if (extra > 0) {
        const trial = new Chess(live.current.history({ verbose: true })[plyRef.current].before)
        try {
          trial.move({ from, to, promotion })
        } catch {
          return null
        }
        for (let i = 0; i < extra; i++) live.current.undo()
      }
    }
    let m: Move
    try {
      m = live.current.move({ from, to, promotion })
    } catch {
      return null
    }
    if (sound) playMoveSound(m)
    const hist = live.current.history({ verbose: true })
    setMoves(hist)
    setPly(hist.length)
    return m
  }, [])

  const undo = useCallback((n = 1) => {
    for (let i = 0; i < n; i++) live.current.undo()
    const hist = live.current.history({ verbose: true })
    setMoves(hist)
    setPly(hist.length)
  }, [])

  const reset = useCallback((fen: string = START_FEN) => {
    live.current = new Chess(fen)
    setStartFen(fen)
    setMoves([])
    setPly(0)
  }, [])

  const loadPgn = useCallback((pgn: string) => {
    const c = new Chess()
    c.loadPgn(pgn)
    const hist = c.history({ verbose: true })
    const first = hist[0]?.before ?? c.fen()
    live.current = c
    setStartFen(first)
    setMoves(hist)
    setPly(hist.length)
    return c
  }, [])

  /** Rebuilds a game from its SAN moves (a saved game in progress); stops at the first illegal one. */
  const replay = useCallback((sanMoves: string[], fen: string = START_FEN) => {
    const c = new Chess(fen)
    for (const san of sanMoves) {
      try {
        c.move(san)
      } catch {
        break
      }
    }
    live.current = c
    const hist = c.history({ verbose: true })
    setStartFen(fen)
    setMoves(hist)
    setPly(hist.length)
  }, [])

  const goto = useCallback(
    (p: number) => setPly(Math.max(0, Math.min(p, live.current.history().length))),
    [],
  )

  return {
    /** the live game; a getter, so it is current even right after replay/reset/loadPgn */
    get chess() {
      return live.current
    },
    startFen,
    moves,
    sans,
    fens,
    fen,
    ply,
    atLive,
    lastMove,
    move,
    undo,
    reset,
    loadPgn,
    replay,
    goto,
  }
}

export type GameApi = ReturnType<typeof useGame>
