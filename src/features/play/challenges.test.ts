import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Engine, PvLine, SearchOptions, SearchResult } from '../../engine/engine'
import { START_FEN } from '../../chess/util'
import type { RankedMove } from './bots'
import {
  CHALLENGES,
  challengeMove,
  checkingMoves,
  factsOf,
  greediestCaptures,
  initialPly,
  nextPly,
  pickDrawish,
  pickHalving,
  pickMirror,
  rateFromRanking,
  rateUserMove,
  validPlies,
  type ChallengeKind,
  type ChallengePly,
  type PlyFacts,
} from './challenges'

const bot: PlyFacts = { byBot: true, capture: false, check: false }
const user: PlyFacts = { byBot: false, capture: false, check: false }
const ranked = (uci: string, value: number, win = 50): RankedMove => ({ uci, score: { cp: value }, value, win })

/** Engine stub answering every search with the given lines (scores from White's side). */
function fakeEngine(lines: PvLine[]) {
  const calls: SearchOptions[] = []
  const engine = {
    search: async (_fen: string, opts: SearchOptions): Promise<SearchResult> => {
      calls.push(opts)
      return { bestmove: lines[0]?.pv[0] ?? null, lines, depth: 8 }
    },
  } as unknown as Engine
  return { engine, calls }
}
const pv = (uci: string, cp: number, multipv = 1): PvLine => ({ multipv, depth: 8, score: { cp }, pv: [uci] })

/** Runs a sequence of plies through the reducer and returns the Elo after each. */
function run(kind: ChallengeKind, plies: PlyFacts[]): number[] {
  let s: ChallengePly = initialPly(kind)
  return plies.map((f) => (s = nextPly(kind, s, f).ply).elo)
}

describe('nextPly', () => {
  it('drains 50 a bot move, never below 0', () => {
    expect(run('drain', [user, bot, user, bot])).toEqual([3200, 3150, 3150, 3100])
    expect(nextPly('drain', { elo: 20 }, bot).ply.elo).toBe(0)
  })

  it('climbs from 0 to full strength', () => {
    expect(run('climb', [bot, user, bot])).toEqual([50, 50, 100])
    expect(nextPly('climb', { elo: 3180 }, bot).ply.elo).toBe(3200)
  })

  it('punishes the best, the worst and checks only on the user’s moves', () => {
    const best = { ...user, rating: { best: true, worst: false, loss: 0 } }
    const worst = { ...user, rating: { best: false, worst: true, loss: 40 } }
    expect(run('punishBest', [best, { ...best, byBot: true }, worst])).toEqual([2900, 2900, 2900])
    expect(run('punishWorst', [best, worst])).toEqual([3200, 2700])
    expect(run('punishCheck', [{ ...user, check: true }, { ...bot, check: true }])).toEqual([2900, 2900])
  })

  it('reports why the Elo changed', () => {
    expect(nextPly('punishCheck', { elo: 3200 }, { ...user, check: true }).change).toEqual({ from: 3200, to: 2900, reason: 'check' })
    expect(nextPly('drain', { elo: 0 }, bot).change).toBeUndefined()
  })

  it('swings between 3200 and 250 on any capture', () => {
    expect(run('captureSwing', [{ ...user, capture: true }, bot, { ...bot, capture: true }, { ...user, capture: true }])).toEqual([250, 250, 3200, 250])
  })

  it('remembers the loss of the user’s move for the mirror', () => {
    const s = nextPly('mirror', { elo: 3200 }, { ...user, rating: { best: false, worst: false, loss: 12 } }).ply
    expect(s.loss).toBe(12)
    expect(nextPly('mirror', s, bot).ply.loss).toBeUndefined()
  })

  it('leaves fixed-strength challenges alone', () => {
    expect(run('drawfish', [{ ...user, capture: true, check: true }, bot])).toEqual([3200, 3200])
  })
})

describe('factsOf', () => {
  it('reads who moved, captures and checks', () => {
    const c = new Chess('4k3/8/8/8/8/8/3q4/R3K3 w - - 0 1')
    const m = c.move('Kxd2')
    expect(factsOf(m, 'w')).toEqual({ byBot: false, capture: true, check: false })
    expect(factsOf(c.move('Ke7'), 'w').byBot).toBe(true)
  })
})

describe('rating the user’s move', () => {
  const moves = [ranked('a', 100, 60), ranked('b', 50, 55), ranked('c', -300, 20)]
  it('spots the best and the worst move', () => {
    expect(rateFromRanking(moves, true, 'a')).toEqual({ best: true, worst: false, loss: 0 })
    expect(rateFromRanking(moves, true, 'c')).toEqual({ best: false, worst: true, loss: 40 })
  })
  it('never calls a move the worst from an incomplete ranking', () => {
    expect(rateFromRanking(moves, false, 'c').worst).toBe(false)
  })
  it('treats a forced move as neither', async () => {
    const { engine, calls } = fakeEngine([])
    // the black king's only move
    const r = await rateUserMove(engine, 'k7/8/1K6/8/8/8/8/7R b - - 0 1', 'a8b8')
    expect(r).toEqual({ best: false, worst: false, loss: 0 })
    expect(calls).toHaveLength(0)
  })
  it('asks again when the search was superseded', async () => {
    const { engine } = fakeEngine([])
    expect(await rateUserMove(engine, START_FEN, 'e2e4')).toBeNull()
  })
})

describe('move pickers', () => {
  it('Drawfish picks the eval closest to 0.00', () => {
    expect(pickDrawish([ranked('a', 300), ranked('b', 20), ranked('c', -10), ranked('d', -500)]).uci).toBe('c')
  })

  it('picks the n-th best with probability (1/2)^n', () => {
    const moves = ['a', 'b', 'c', 'd'].map((u, i) => ranked(u, -i))
    expect(pickHalving(moves, () => 0.1).uci).toBe('a')
    expect(pickHalving(moves, () => 0.6).uci).toBe('b')
    expect(pickHalving(moves, () => 0.8).uci).toBe('c')
    expect(pickHalving(moves, () => 0.99).uci).toBe('d')
  })

  it('the mirror matches the loss of the user’s move', () => {
    const moves = [ranked('a', 100, 60), ranked('b', 50, 50), ranked('c', -300, 20)]
    expect(pickMirror(moves, 0).uci).toBe('a')
    expect(pickMirror(moves, 12).uci).toBe('b')
    expect(pickMirror(moves, 60).uci).toBe('c')
  })

  it('the glutton goes for the most valuable piece', () => {
    // the rook takes the queen or a pawn
    expect(greediestCaptures('4k3/8/8/8/p2q4/8/8/R2RK3 w - - 0 1')).toEqual(['d1d4'])
    expect(greediestCaptures(START_FEN)).toEqual([])
  })

  it('finds the checks', () => {
    // Re1+ is blocked by its own king
    expect(checkingMoves('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')).toEqual(['a1a8'])
  })
})

describe('challengeMove', () => {
  it('Checkfish plays the best of its checks', async () => {
    // Ra8+ and Re1+ are both checks; the engine prefers e1
    const fen = '4k3/8/8/8/8/8/8/R5K1 w - - 0 1'
    const { engine } = fakeEngine([pv('g1g2', 500), pv('a1e1', 400, 2), pv('a1a8', 300, 3)])
    expect(await challengeMove('checkfish', engine, fen, initialPly('checkfish'))).toBe('a1e1')
  })

  it('the glutton captures even when the engine says otherwise', async () => {
    const fen = '4k3/8/8/8/p2q4/8/8/R2RK3 w - - 0 1'
    const { engine } = fakeEngine([pv('e1e2', 900)])
    expect(await challengeMove('glutton', engine, fen, initialPly('glutton'))).toBe('d1d4')
  })

  it('Drawfish heads for 0.00', async () => {
    const { engine, calls } = fakeEngine([pv('e2e4', 40), pv('g1f3', 5, 2), pv('f2f3', -80, 3)])
    expect(await challengeMove('drawfish', engine, START_FEN, initialPly('drawfish'))).toBe('g1f3')
    expect(calls[0].multipv).toBe(20)
  })

  it('the clumsy one plays its worst move 5% of the time', async () => {
    const { engine } = fakeEngine([pv('e2e4', 40), pv('g1f3', 30, 2), pv('f2f3', -80, 3)])
    expect(await challengeMove('clumsy', engine, START_FEN, initialPly('clumsy'), undefined, undefined, () => 0.01)).toBe('f2f3')
    expect(await challengeMove('clumsy', engine, START_FEN, initialPly('clumsy'), undefined, undefined, () => 0.5)).toBe('e2e4')
  })

  it('Elo challenges play at their current Elo', async () => {
    const { engine, calls } = fakeEngine([pv('e2e4', 40)])
    await challengeMove('drain', engine, START_FEN, { elo: 2000 })
    expect(calls[0].elo).toBe(2000)
  })

  it('the queenless start leaves Black without a queen', () => {
    const c = new Chess(CHALLENGES.noQueen.startFen)
    expect(c.board().flat().some((p) => p?.type === 'q' && p.color === 'b')).toBe(false)
    expect(CHALLENGES.noQueen.userColor).toBe('w')
  })
})

describe('validPlies', () => {
  it('accepts saved states and rejects junk', () => {
    expect(validPlies([{ elo: 3200 }, { elo: 2900, loss: 3 }])).toHaveLength(2)
    expect(validPlies([{ elo: 'x' }])).toBeUndefined()
    expect(validPlies(null)).toBeUndefined()
    expect(validPlies([])).toBeUndefined()
  })
})
