import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { parseUci, playUci } from '../../chess/util'
import { play, playMoveSound } from '../../chess/sounds'
import { useSettings } from '../../settings'
import { pickPromotion } from './promotion'
import type { Puzzle } from './puzzlesData'

export type PuzzleStatus = 'loading' | 'playing' | 'correct' | 'wrong' | 'checking' | 'solved' | 'failed'

export interface PuzzleOptions {
  stopOnWrong?: boolean
  onDone?: (solved: boolean) => void
  /**
   * Asked when the final move isn't the expected one: resolves true to accept it anyway
   * (an engine finds it as good). `fen` is the position before the move.
   */
  acceptAlternative?: (fen: string, uci: string) => Promise<boolean>
}

/**
 * Drives one puzzle: plays the opponent's setup move, validates the solver's
 * moves (any mate on the final move counts), replies automatically.
 */
export function usePuzzle(puzzle: Puzzle | null, opts: PuzzleOptions = {}) {
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
  /** bumped to drop an alternative-move check still running */
  const checkId = useRef(0)

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const sync = () => setFen(chess.current.fen())

  useEffect(() => {
    clearTimers()
    checkId.current++
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
    return clearTimers
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
      const m = playUci(trial, from + to + pickPromotion(from, to, promotion, expected, useSettings.getState().autoQueen))
      if (!m) return
      const uci = m.from + m.to + (m.promotion ?? '')
      const isLast = step.current === puzzle.moves.length - 1

      const accept = (m: Move) => {
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
      }

      const reject = (m: Move) => {
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

      if (uci === expected || (isLast && trial.isCheckmate())) return accept(m)
      const alt = optsRef.current.acceptAlternative
      if (!isLast || !alt) return reject(m)
      // show the move while it is checked; the board stays locked until the answer
      const id = ++checkId.current
      setFen(trial.fen())
      setLastMove([m.from, m.to])
      setStatus('checking')
      void alt(chess.current.fen(), uci)
        .catch(() => false)
        .then((good) => {
          if (id !== checkId.current) return
          if (good) accept(m)
          else reject(m)
        })
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
    // drop pending replies, snap-backs and checks: the replay below plays everything from the real
    // position, an opponent reply still waiting after a correct move included
    clearTimers()
    checkId.current++
    setFailed(true)
    if (status !== 'solved' && status !== 'failed') finish(false)
    setHighlights(undefined)
    sync()
    const prev = chess.current.history({ verbose: true }).at(-1)
    setLastMove(prev ? [prev.from, prev.to] : null)
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
  }, [puzzle, status, finish])

  return { fen, lastMove, status, highlights, solverColor, failed, onMove, hint, showSolution }
}
