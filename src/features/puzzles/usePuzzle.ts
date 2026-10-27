import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { parseUci, playUci } from '../../chess/util'
import { play, playMoveSound } from '../../chess/sounds'
import type { Puzzle } from './puzzlesData'

export type PuzzleStatus = 'loading' | 'playing' | 'correct' | 'wrong' | 'solved' | 'failed'

/**
 * Drives one puzzle: plays the opponent's setup move, validates the solver's
 * moves (any mate on the final move counts), replies automatically.
 */
export function usePuzzle(puzzle: Puzzle | null, opts: { stopOnWrong?: boolean; onDone?: (solved: boolean) => void } = {}) {
  const [fen, setFen] = useState(puzzle?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [status, setStatus] = useState<PuzzleStatus>('loading')
  const [highlights, setHighlights] = useState<Map<string, string> | undefined>()
  const [failed, setFailed] = useState(false)
  const chess = useRef(new Chess())
  const step = useRef(0)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const sync = () => setFen(chess.current.fen())

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (!puzzle) return
    chess.current = new Chess(puzzle.fen)
    step.current = 0
    setFailed(false)
    setHighlights(undefined)
    setLastMove(null)
    setStatus('loading')
    sync()
    later(() => {
      const m = playUci(chess.current, puzzle.moves[0])
      if (m) {
        playMoveSound(m)
        setLastMove([m.from, m.to])
      }
      step.current = 1
      sync()
      setStatus('playing')
    }, 550)
    return () => timers.current.forEach(clearTimeout)
  }, [puzzle])

  /** The solver's colour (the side to move after the setup move). */
  const solverColor: 'w' | 'b' = puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w') : 'w'

  const finish = useCallback((solved: boolean) => {
    setStatus(solved ? 'solved' : 'failed')
    optsRef.current.onDone?.(solved)
  }, [])

  const onMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!puzzle || (status !== 'playing' && status !== 'correct' && status !== 'wrong')) return
      const expected = puzzle.moves[step.current]
      const trial = new Chess(chess.current.fen())
      const m = playUci(trial, from + to + (promotion ?? (expected?.length === 5 && expected.slice(0, 4) === from + to ? expected[4] : '')))
      if (!m) return
      const uci = m.from + m.to + (m.promotion ?? '')
      const isLast = step.current === puzzle.moves.length - 1
      const ok = uci === expected || (isLast && trial.isCheckmate())
      if (ok) {
        chess.current = trial
        playMoveSound(m)
        setLastMove([m.from, m.to])
        setHighlights(new Map([[m.to, 'right']]))
        sync()
        step.current++
        if (step.current >= puzzle.moves.length) {
          play('correct')
          finish(!failed)
          return
        }
        setStatus('correct')
        later(() => {
          const reply = playUci(chess.current, puzzle.moves[step.current])
          if (reply) {
            playMoveSound(reply)
            setLastMove([reply.from, reply.to])
          }
          step.current++
          setHighlights(undefined)
          sync()
          setStatus('playing')
        }, 380)
      } else {
        play('wrong')
        setHighlights(new Map([[m.to, 'wrong']]))
        setFen(trial.fen())
        setLastMove([m.from, m.to])
        setStatus('wrong')
        if (!failed) {
          setFailed(true)
          if (optsRef.current.stopOnWrong) {
            later(() => finish(false), 450)
            return
          }
        }
        // snap back so the solver can keep trying
        later(() => {
          setHighlights(undefined)
          sync()
          const prev = chess.current.history({ verbose: true }).at(-1)
          setLastMove(prev ? [prev.from, prev.to] : null)
          setStatus('playing')
        }, 650)
      }
    },
    [puzzle, status, failed, finish],
  )

  const hint = useCallback(() => {
    if (!puzzle || status !== 'playing') return
    const { from } = parseUci(puzzle.moves[step.current])
    setHighlights(new Map([[from, 'hint-from']]))
    if (!failed) setFailed(true)
  }, [puzzle, status, failed])

  /** Plays out the rest of the solution move by move. */
  const showSolution = useCallback(() => {
    if (!puzzle) return
    if (!failed) {
      setFailed(true)
      if (status !== 'solved' && status !== 'failed') finish(false)
    }
    setHighlights(undefined)
    const rest = puzzle.moves.slice(step.current)
    rest.forEach((u, i) =>
      later(() => {
        const m = playUci(chess.current, u)
        if (m) {
          playMoveSound(m)
          setLastMove([m.from, m.to])
        }
        step.current++
        sync()
      }, 500 * (i + 1)),
    )
  }, [puzzle, failed, status, finish])

  return { fen, lastMove, status, highlights, solverColor, failed, onMove, hint, showSolution }
}
