import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Engine, PvLine, SearchOptions, SearchResult } from '../../engine/engine'
import { START_FEN } from '../../chess/util'
import { BOTS, botById, botMove, budgetMs, engineHistory, mateInOne, moverValue, playAtElo, rankMoves, softPick, type GameHistory } from './bots'

/** Engine stub that always answers with the same move. */
function fakeEngine(bestmove: string) {
  const calls: SearchOptions[] = []
  const engine = {
    search: async (_fen: string, opts: SearchOptions): Promise<SearchResult> => {
      calls.push(opts)
      return { bestmove, lines: [{ multipv: 1, depth: 10, score: { cp: 0 }, pv: [bestmove] }], depth: 10 }
    },
  } as unknown as Engine
  return { engine, calls }
}

/** The history of a game played from `startFen` through `sans`. */
function hist(sans: string[], startFen = START_FEN): GameHistory {
  const c = new Chess(startFen)
  return { startFen, moves: sans.map((s) => c.move(s)) }
}

const line = (uci: string, score: PvLine['score'], multipv = 1): PvLine => ({ multipv, depth: 8, score, pv: [uci] })

describe('botMove', () => {
  const magnus = botById('stockfish') ?? botById('ivan')!

  it('uses the book only on the first move', async () => {
    const { engine, calls } = fakeEngine('g1f3')
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const uci = await botMove(magnus, engine, fen, hist(['e4', 'e5']))
    expect(uci).toBe('g1f3')
    expect(calls).toHaveLength(1)
  })

  it('sends the game history so the engine sees repetitions', async () => {
    const { engine, calls } = fakeEngine('g1f3')
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    await botMove(magnus, engine, fen, hist(['e4', 'e5']))
    expect(calls[0].history).toEqual({ startFen: START_FEN, moves: ['e2e4', 'e7e5'] })
  })

  it('skips the book in a game started from a custom position', async () => {
    const { engine, calls } = fakeEngine('e2e3')
    // Boris opens 1.e4 / 1.d4, both legal here
    const uci = await botMove(botById('boris')!, engine, '4k3/8/8/8/8/8/3PP3/4K3 w - - 0 1')
    expect(uci).toBe('e2e3')
    expect(calls).toHaveLength(1)
  })

  it('answers 1.e4 from its black repertoire', async () => {
    const bot = botById('ivan')!
    const { engine, calls } = fakeEngine('a7a6')
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const uci = await botMove(bot, engine, fen, hist(['e4']))
    if (bot.book?.vsE4?.length) {
      expect(calls).toHaveLength(0)
      expect(uci?.[1]).toBe('7')
    }
  })
})

describe('playAtElo', () => {
  // White mates with Ra8#
  const mateFen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'

  it('weak bots never miss a mate in one', async () => {
    const { engine, calls } = fakeEngine('a1a2')
    for (let i = 0; i < 20; i++) expect(await playAtElo(engine, mateFen, 0)).toBe('a1a8')
    expect(calls).toHaveLength(0)
  })

  it('uses the UCI_Elo limiter from 1350 and full strength from 3200', async () => {
    const { engine, calls } = fakeEngine('e2e4')
    await playAtElo(engine, START_FEN, 1800)
    await playAtElo(engine, START_FEN, 3200)
    expect(calls[0].elo).toBe(1800)
    expect(calls[1].elo).toBeUndefined()
  })
})

describe('softPick', () => {
  it('keeps pushing a won game instead of treating every winning move alike', () => {
    // all three are "winning" by win%, but only one mates soon
    const lines = [line('a1a2', { mate: 2 }), line('b1b2', { cp: 900 }, 2), line('c1c2', { cp: 600 }, 3)]
    let hits = 0
    for (let i = 0; i < 200; i++) if (softPick(lines, true, 30, Math.random) === 'a1a2') hits++
    expect(hits).toBe(200)
  })

  it('spreads its choice in level positions', () => {
    const lines = [line('a1a2', { cp: 20 }), line('b1b2', { cp: 0 }, 2)]
    const picks = new Set<string | null>()
    for (let i = 0; i < 200; i++) picks.add(softPick(lines, true, 260))
    expect(picks.size).toBe(2)
  })
})

describe('moverValue', () => {
  it('ranks shorter mates higher and flips for Black', () => {
    expect(moverValue({ mate: 1 }, true)).toBeGreaterThan(moverValue({ mate: 3 }, true))
    expect(moverValue({ mate: 3 }, true)).toBeGreaterThan(moverValue({ cp: 5000 }, true))
    expect(moverValue({ mate: -2 }, true)).toBeLessThan(moverValue({ mate: -5 }, true))
    expect(moverValue({ cp: 150 }, false)).toBe(-150)
  })
})

describe('rankMoves', () => {
  it('sorts the lines best first for the side to move', async () => {
    const fen = '4k3/8/8/8/8/8/8/4K2R b K - 0 1'
    const engine = {
      search: async (): Promise<SearchResult> => ({
        bestmove: 'e8d8',
        lines: [line('e8d8', { cp: 400 }), line('e8f8', { cp: 300 }, 2), line('e8e7', { cp: 500 }, 3)],
        depth: 8,
      }),
    } as unknown as Engine
    const r = await rankMoves(engine, fen)
    expect(r.moves.map((m) => m.uci)).toEqual(['e8f8', 'e8d8', 'e8e7'])
    expect(r.complete).toBe(false)
  })
})

describe('helpers', () => {
  it('finds a mate in one', () => {
    expect(mateInOne('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1')).toBe('a1a8')
    expect(mateInOne(START_FEN)).toBeNull()
  })
  it('leaves the history out when there are no moves', () => {
    expect(engineHistory(hist([]))).toBeUndefined()
  })
  it('every challenge bot has a known rule', () => {
    for (const b of BOTS) if (b.group === 'challenge') expect(b.challenge).toBeTruthy()
  })
})

describe('budgetMs', () => {
  it('keeps the wanted time without a clock', () => {
    expect(budgetMs(1200)).toBe(1200)
  })
  it('never spends more than a slice of the clock', () => {
    expect(budgetMs(1200, { left: 6000, inc: 0 })).toBe(200)
    expect(budgetMs(1200, { left: 60_000, inc: 0 })).toBe(1200)
  })
})
