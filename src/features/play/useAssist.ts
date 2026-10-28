import { useEffect, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { Engine, legalMoveCount, type PvLine, type Score } from '../../engine/engine'
import { classifyMoves, terminalScore, type PositionEval, type Quality } from '../review/classify'
import { bookChecker } from '../openings/openingsData'
import type { AssistSettings } from '../../settings'

const DEPTH = 13

/** The same position with the other side to move, for "what does my opponent threaten". */
function nullMoveFen(fen: string): string | null {
  const c = new Chess(fen)
  if (c.inCheck()) return null
  const parts = fen.split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  parts[3] = '-'
  const flipped = parts.join(' ')
  try {
    const f = new Chess(flipped)
    // the side that just "passed" can't be left in check
    return f.moves().length ? flipped : null
  } catch {
    return null
  }
}

/** Lines searched elsewhere (e.g. the analysis board's engine) that stand in for our own search. */
export interface ExternalLines {
  fen: string
  lines: PvLine[]
  depth: number
  /** the search has finished, even if short of our depth */
  done: boolean
}

/** Whether outside lines are as good as our own search of `fen` would be. */
export function externalCovers(ext: ExternalLines | undefined, fen: string): boolean {
  if (!ext || ext.fen !== fen || !ext.lines[0]) return false
  // the second line is what tells a "great" move apart
  return (ext.depth >= DEPTH || ext.done) && ext.lines.length >= Math.min(2, legalMoveCount(fen))
}

const moveKey = (m: Move) => `${m.before}|${m.from}${m.to}${m.promotion ?? ''}`

/**
 * In-game assistance against bots: evaluation, engine lines, suggestion and
 * threat arrows, and live move feedback. Uses its own engine so the bot's
 * search isn't disturbed; jobs run one after another and are cached per FEN.
 */
export function useAssist({
  assist,
  fen,
  moves,
  ply,
  rate,
  rateAll = false,
  userTurn,
  external,
  paused = false,
}: {
  assist: AssistSettings
  /** position being viewed */
  fen: string
  /** full history */
  moves: Move[]
  /** ply being viewed; its move and the last move get rated */
  ply: number
  /** which side's moves get feedback */
  rate: 'w' | 'b' | 'both'
  /** rate the whole history too (after the viewed and last moves) */
  rateAll?: boolean
  /** it's the user's move at the live position (threat arrows) */
  userTurn: boolean
  /**
   * Lines another engine is already searching for the viewed position. While given, that
   * position waits for them instead of being searched a second time; positions left before
   * they were deep enough fall back to our own search.
   */
  external?: ExternalLines
  /** holds back new searches (e.g. while a bot is thinking); a running one still finishes */
  paused?: boolean
}) {
  const enabled = assist.eval || assist.engine || assist.suggest || assist.threats || assist.feedback
  const engine = useRef<Engine | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const evals = useRef(new Map<string, Promise<PositionEval>>())
  const threatCache = useRef(new Map<string, Promise<string | null>>())
  const [current, setCurrent] = useState<{ fen: string; lines: PvLine[]; score: Score } | null>(null)
  const [threat, setThreat] = useState<{ fen: string; uci: string } | null>(null)
  // keyed by move (position before + uci) so it survives takebacks and new branches
  const [feedback, setFeedback] = useState<Record<string, Quality>>({})
  const multipv = assist.engine ? 3 : 2
  // positions waiting for outside lines, with the search to fall back on
  const waiting = useRef(new Map<string, { resolve: (e: PositionEval) => void; fallback: () => void }>())
  const externalRef = useRef(external)
  externalRef.current = external
  // closed while paused: jobs wait on it before starting
  const gate = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!enabled) return
    engine.current ??= new Engine()
  }, [enabled])

  useEffect(
    () => () => {
      engine.current?.destroy()
      engine.current = null
    },
    [],
  )

  // a different line count needs fresh results
  useEffect(() => {
    evals.current.clear()
  }, [multipv])

  useEffect(() => {
    if (!paused) return
    let open = () => {}
    gate.current = new Promise<void>((r) => (open = r))
    return () => {
      gate.current = null
      open()
    }
  }, [paused])

  const run = <T,>(job: (e: Engine) => Promise<T>): Promise<T> => {
    const p = queue.current.then(async () => {
      while (gate.current) await gate.current
      if (!engine.current) throw new Error('engine gone')
      // a crashed worker is replaced instead of failing every later job
      if (engine.current.failed) {
        engine.current.destroy()
        engine.current = new Engine()
      }
      return job(engine.current)
    })
    queue.current = p.catch(() => undefined)
    return p
  }

  const search = (f: string): Promise<PositionEval> =>
    run((e) => e.search(f, { depth: DEPTH, multipv })).then((r) => {
      if (!r.lines[0]) throw new Error('search interrupted')
      return { fen: f, lines: r.lines, score: r.lines[0].score }
    })

  const evaluate = (f: string): Promise<PositionEval> => {
    let p = evals.current.get(f)
    if (!p) {
      const term = terminalScore(f)
      const ext = externalRef.current
      if (term) p = Promise.resolve({ fen: f, lines: [], score: term })
      else if (ext && externalCovers(ext, f)) p = Promise.resolve({ fen: f, lines: ext.lines, score: ext.lines[0].score })
      else if (ext?.fen === f)
        p = new Promise<PositionEval>((resolve, reject) => {
          waiting.current.set(f, { resolve, fallback: () => search(f).then(resolve, reject) })
        })
      else p = search(f)
      evals.current.set(f, p)
      // failures are not cached, so the position is evaluated again next time
      p.catch(() => evals.current.get(f) === p && evals.current.delete(f))
    }
    return p
  }

  // hand outside lines to the position waiting for them; positions no longer covered search themselves
  useEffect(() => {
    for (const [f, w] of waiting.current) {
      if (external && externalCovers(external, f)) w.resolve({ fen: f, lines: external.lines, score: external.lines[0].score })
      else if (external?.fen === f) continue
      else w.fallback()
      waiting.current.delete(f)
    }
  }, [external])

  // evaluation of the viewed position
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void evaluate(fen)
      .then((r) => alive && setCurrent({ fen, lines: r.lines, score: r.score }))
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, enabled, multipv])

  // opponent's threat: their best move if it were their turn
  useEffect(() => {
    if (!assist.threats || !userTurn) return
    const nf = nullMoveFen(fen)
    if (!nf) return
    let p = threatCache.current.get(nf)
    if (!p) {
      const job = run((e) => e.search(nf, { depth: 10 })).then((r) => r.bestmove)
      threatCache.current.set(nf, job)
      job.catch(() => threatCache.current.get(nf) === job && threatCache.current.delete(nf))
      p = job
    }
    let alive = true
    void p.then((uci) => alive && uci && setThreat({ fen, uci })).catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, assist.threats, userTurn])

  // rate the last move and the one being viewed, as they appear
  const targets = [...new Set([ply, moves.length, ...(rateAll ? moves.map((_, i) => i + 1) : [])])].filter((p) => p > 0 && p <= moves.length)
  const targetKey = targets.map((p) => moveKey(moves[p - 1])).join(';')
  // Results are keyed by move, so one that lands after the bot has already replied is still
  // stored: dropping it left the user's move unrated, as it is no longer the last move.
  const rating = useRef(new Set<string>())
  useEffect(() => {
    if (!assist.feedback) return
    for (const p of targets) {
      const m = moves[p - 1]
      const key = moveKey(m)
      if ((rate !== 'both' && m.color !== rate) || feedback[key] || rating.current.has(key)) continue
      rating.current.add(key)
      void (async () => {
        const [before, after, isBook] = await Promise.all([evaluate(m.before), evaluate(m.after), bookChecker()])
        const [r] = classifyMoves([before, after], [{ san: m.san, uci: m.from + m.to + (m.promotion ?? '') }], (f) => p <= 30 && isBook(f))
        setFeedback((fb) => ({ ...fb, [key]: r.quality }))
      })()
        .catch(() => {})
        // a failed rating is tried again the next time this move is a target
        .finally(() => rating.current.delete(key))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, assist.feedback, rate])

  const fresh = current?.fen === fen ? current : null
  return {
    enabled,
    score: fresh?.score,
    lines: fresh?.lines ?? [],
    threat: threat?.fen === fen ? threat.uci : null,
    /** feedback for a move, once rated */
    quality: (m: Move | undefined): Quality | undefined => (m ? feedback[moveKey(m)] : undefined),
  }
}
