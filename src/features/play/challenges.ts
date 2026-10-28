import { useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import type { Engine } from '../../engine/engine'
import { uciOf } from '../../chess/util'
import { budgetMs, engineHistory, playAtElo, rankMoves, type Bot, type GameHistory, type RankedMove } from './bots'

/**
 * Challenges: Stockfish with a funny handicap, after the "Stockfish, but…" videos. The rules
 * that move its Elo are a pure reducer over the game's plies (one state per ply, so a takeback
 * restores it and a resumed game picks it up); the rest change how it picks its moves.
 */

export type ChallengeKind =
  | 'drain'
  | 'climb'
  | 'punishBest'
  | 'punishWorst'
  | 'punishCheck'
  | 'drawfish'
  | 'checkfish'
  | 'glutton'
  | 'clumsy'
  | 'top3'
  | 'halving'
  | 'captureSwing'
  | 'mirror'
  | 'noQueen'

export interface ChallengeRules {
  startElo: number
  /** its Elo changes during the game (shown live) */
  dynamic?: boolean
  /** the user's moves are rated by the engine at the start of the bot's turn */
  rates?: boolean
  acceptsDraws?: boolean
  /** a fixed start position, and the side the user takes in it */
  startFen?: string
  userColor?: 'w' | 'b'
}

export const MAX_ELO = 3200
const LOW_ELO = 250

export const CHALLENGES: Record<ChallengeKind, ChallengeRules> = {
  drain: { startElo: MAX_ELO, dynamic: true },
  climb: { startElo: 0, dynamic: true },
  punishBest: { startElo: MAX_ELO, dynamic: true, rates: true },
  punishWorst: { startElo: MAX_ELO, dynamic: true, rates: true },
  punishCheck: { startElo: MAX_ELO, dynamic: true },
  drawfish: { startElo: MAX_ELO, acceptsDraws: true },
  checkfish: { startElo: MAX_ELO },
  glutton: { startElo: MAX_ELO },
  clumsy: { startElo: MAX_ELO },
  top3: { startElo: MAX_ELO },
  halving: { startElo: MAX_ELO },
  captureSwing: { startElo: MAX_ELO, dynamic: true },
  mirror: { startElo: MAX_ELO, rates: true },
  noQueen: { startElo: MAX_ELO, startFen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', userColor: 'w' },
}

/** The challenge's state after a ply. */
export interface ChallengePly {
  elo: number
  /** after a user move the mirror rated: the win% it lost */
  loss?: number
}

/** How the engine judged one of the user's moves. */
export interface MoveRating {
  best: boolean
  worst: boolean
  /** win% given away against the best move */
  loss: number
}

export interface PlyFacts {
  byBot: boolean
  capture: boolean
  check: boolean
  rating?: MoveRating
}

export type EloReason = 'move' | 'best' | 'worst' | 'check' | 'capture'
export interface EloChange {
  from: number
  to: number
  reason: EloReason
}

export function initialPly(kind: ChallengeKind): ChallengePly {
  return { elo: CHALLENGES[kind].startElo }
}

export function factsOf(m: { color: 'w' | 'b'; san: string; captured?: string }, userColor: 'w' | 'b'): PlyFacts {
  return { byBot: m.color !== userColor, capture: !!m.captured, check: /[+#]/.test(m.san) }
}

const clamp = (elo: number) => Math.max(0, Math.min(MAX_ELO, elo))

/** The state after one more ply. */
export function nextPly(kind: ChallengeKind, prev: ChallengePly, f: PlyFacts): { ply: ChallengePly; change?: EloChange } {
  const to = (elo: number, reason: EloReason) => {
    const next = clamp(elo)
    return next === prev.elo ? { ply: { elo: prev.elo } } : { ply: { elo: next }, change: { from: prev.elo, to: next, reason } }
  }
  switch (kind) {
    case 'drain':
      return f.byBot ? to(prev.elo - 50, 'move') : { ply: { elo: prev.elo } }
    case 'climb':
      return f.byBot ? to(prev.elo + 50, 'move') : { ply: { elo: prev.elo } }
    case 'punishBest':
      return !f.byBot && f.rating?.best ? to(prev.elo - 300, 'best') : { ply: { elo: prev.elo } }
    case 'punishWorst':
      return !f.byBot && f.rating?.worst ? to(prev.elo - 500, 'worst') : { ply: { elo: prev.elo } }
    case 'punishCheck':
      return !f.byBot && f.check ? to(prev.elo - 300, 'check') : { ply: { elo: prev.elo } }
    case 'captureSwing':
      return f.capture ? to(prev.elo >= MAX_ELO ? LOW_ELO : MAX_ELO, 'capture') : { ply: { elo: prev.elo } }
    case 'mirror':
      return { ply: !f.byBot && f.rating ? { elo: prev.elo, loss: f.rating.loss } : { elo: prev.elo } }
    default:
      return { ply: { elo: prev.elo } }
  }
}

/** Rates `uci` against the ranking of every move in its position. */
export function rateFromRanking(moves: RankedMove[], complete: boolean, uci: string): MoveRating {
  const top = moves[0]
  const bottom = moves[moves.length - 1]
  const mine = moves.find((m) => m.uci === uci)
  // missing from a ranking cut short: likely among the weaker moves, but not provably the worst
  if (!mine) return { best: false, worst: false, loss: Math.max(0, top.win - bottom.win) }
  return {
    best: mine.value >= top.value,
    worst: complete && moves.length > 1 && mine.value <= bottom.value && bottom.value < top.value,
    loss: Math.max(0, top.win - mine.win),
  }
}

/**
 * Rates the user's move `uci` from `fenBefore`; null when the search was superseded (try again).
 * A forced move is neither best nor worst.
 */
export async function rateUserMove(
  engine: Engine,
  fenBefore: string,
  uci: string,
  history?: GameHistory,
  clock?: { left: number; inc: number },
): Promise<MoveRating | null> {
  if (new Chess(fenBefore).moves().length <= 1) return { best: false, worst: false, loss: 0 }
  const { moves, complete } = await rankMoves(engine, fenBefore, { history, depth: 8, movetime: budgetMs(1500, clock) })
  return moves.length ? rateFromRanking(moves, complete, uci) : null
}

/** The move whose eval is closest to 0.00 (the better one on a tie). */
export function pickDrawish(moves: RankedMove[]): RankedMove {
  return moves.reduce((a, m) => (Math.abs(m.value) < Math.abs(a.value) ? m : a))
}

/** The n-th best move with probability (1/2)^n; the last one takes what is left. */
export function pickHalving(moves: RankedMove[], rnd = Math.random): RankedMove {
  let x = rnd()
  for (let i = 0; i < moves.length - 1; i++) {
    x -= 0.5 ** (i + 1)
    if (x < 0) return moves[i]
  }
  return moves[moves.length - 1]
}

/** The move that gives away about as much win% as the user's last one (the better one on a tie). */
export function pickMirror(moves: RankedMove[], loss: number): RankedMove {
  const top = moves[0].win
  return moves.reduce((a, m) => (Math.abs(top - m.win - loss) < Math.abs(top - a.win - loss) ? m : a))
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

/** The captures that take the most valuable piece on offer. */
export function greediestCaptures(fen: string): string[] {
  const caps = new Chess(fen).moves({ verbose: true }).filter((m) => m.captured)
  const most = Math.max(0, ...caps.map((m) => PIECE_VALUE[m.captured!] ?? 0))
  return caps.filter((m) => PIECE_VALUE[m.captured!] === most).map(uciOf)
}

/** The checking moves. */
export function checkingMoves(fen: string): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .filter((m) => /[+#]/.test(m.san))
    .map(uciOf)
}

/**
 * The challenge bot's move; null when its search was superseded (think again).
 * `state` is the challenge after the last ply.
 */
export async function challengeMove(
  kind: ChallengeKind,
  engine: Engine,
  fen: string,
  state: ChallengePly,
  history?: GameHistory,
  clock?: { left: number; inc: number },
  rnd = Math.random,
): Promise<string | null> {
  if (!new Chess(fen).moves().length) return null
  const full = () => playAtElo(engine, fen, MAX_ELO, history, clock)
  const rank = async () => (await rankMoves(engine, fen, { history, depth: 10, movetime: budgetMs(1500, clock) })).moves
  // the best of `ucis` by the engine's ranking; full strength when there are none
  const bestOf = async (ucis: string[]) => {
    if (!ucis.length) return full()
    if (ucis.length === 1) return ucis[0]
    const moves = await rank()
    if (!moves.length) return null
    return moves.find((m) => ucis.includes(m.uci))?.uci ?? ucis[0]
  }

  switch (kind) {
    case 'drawfish': {
      const moves = await rank()
      return moves.length ? pickDrawish(moves).uci : null
    }
    case 'checkfish':
      return bestOf(checkingMoves(fen))
    case 'glutton':
      return bestOf(greediestCaptures(fen))
    case 'clumsy': {
      if (rnd() >= 0.05) return full()
      const moves = await rank()
      return moves.length ? moves[moves.length - 1].uci : null
    }
    case 'top3': {
      const r = await engine.search(fen, { movetime: budgetMs(1000, clock), multipv: 3, history: engineHistory(history) })
      const picks = r.lines.flatMap((l) => (l.pv[0] ? [l.pv[0]] : []))
      return picks.length ? picks[Math.floor(rnd() * picks.length)] : r.bestmove
    }
    case 'halving': {
      const moves = await rank()
      return moves.length ? pickHalving(moves, rnd).uci : null
    }
    case 'mirror': {
      if (state.loss === undefined) return full()
      const moves = await rank()
      return moves.length ? pickMirror(moves, state.loss).uci : null
    }
    default:
      return playAtElo(engine, fen, state.elo, history, clock)
  }
}

/** A resumed game's saved challenge states, when they look sound. */
export function validPlies(v: unknown): ChallengePly[] | undefined {
  if (!Array.isArray(v) || !v.length) return undefined
  return v.every((p) => p && typeof p === 'object' && typeof p.elo === 'number') ? (v as ChallengePly[]) : undefined
}

/**
 * The challenge state of a game against `bot`, one entry per ply (index 0 = before any move).
 * Inert for ordinary bots.
 */
export function useChallenge(bot: Bot, resumed?: ChallengePly[]) {
  const kind = bot.challenge
  const [plies, setPlies] = useState<ChallengePly[]>(() => (kind ? (resumed ?? [initialPly(kind)]) : []))
  const ref = useRef(plies)
  const set = (next: ChallengePly[]) => {
    ref.current = next
    setPlies(next)
  }

  return {
    kind,
    rules: kind ? CHALLENGES[kind] : undefined,
    /** the bot's Elo now */
    elo: plies[plies.length - 1]?.elo ?? bot.elo,
    /** every ply's state, read at save time */
    plies: ref,
    /**
     * Counts the plies played since the last call, rating the user's moves with the engine when
     * the rules need it, reports each Elo change and returns the state after `game.moves`. Null
     * when a rating was cut short or the caller gave up (`alive`), so the bot should think again.
     * It never drops states (that is `truncate`): a stale, shorter move list just reads back.
     */
    async catchUp(
      engine: Engine,
      game: GameHistory & { moves: Move[] },
      userColor: 'w' | 'b',
      notify: (c: EloChange) => void,
      alive: () => boolean = () => true,
      clock?: { left: number; inc: number },
    ): Promise<ChallengePly | null> {
      const moves = game.moves
      if (!kind) return { elo: bot.elo }
      if (ref.current.length > moves.length) return ref.current[moves.length]
      let cur = ref.current
      const changes: EloChange[] = []
      for (let k = cur.length - 1; k < moves.length; k++) {
        const m = moves[k]
        const facts = factsOf(m, userColor)
        if (!facts.byBot && CHALLENGES[kind].rates) {
          const rating = await rateUserMove(engine, m.before, uciOf(m),{ startFen: game.startFen, moves: moves.slice(0, k) }, clock)
          if (!rating || !alive()) return null
          facts.rating = rating
        }
        const { ply, change } = nextPly(kind, cur[cur.length - 1], facts)
        cur = [...cur, ply]
        if (change) changes.push(change)
      }
      set(cur)
      for (const c of changes) notify(c)
      return cur[cur.length - 1]
    },
    /** Drops the states past `plyCount` moves (takeback). */
    truncate(plyCount: number) {
      if (kind && ref.current.length > plyCount + 1) set(ref.current.slice(0, plyCount + 1))
    },
    reset() {
      if (kind) set([initialPly(kind)])
    },
  }
}
