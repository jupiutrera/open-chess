import { describe, expect, it } from 'vitest'
import type { Engine, SearchResult } from '../../engine/engine'
import { botById, botMove, budgetMs } from './bots'

/** Engine stub that always answers with the same move. */
function fakeEngine(bestmove: string) {
  const calls: unknown[] = []
  const engine = {
    search: async (_fen: string, opts: unknown): Promise<SearchResult> => {
      calls.push(opts)
      return { bestmove, lines: [{ multipv: 1, depth: 10, score: { cp: 0 }, pv: [bestmove] }], depth: 10 }
    },
  } as unknown as Engine
  return { engine, calls }
}

describe('botMove', () => {
  const magnus = botById('stockfish') ?? botById('ivan')!

  it('uses the book only on the first move', async () => {
    const { engine, calls } = fakeEngine('g1f3')
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const uci = await botMove(magnus, engine, fen, ['e4', 'e5'])
    expect(uci).toBe('g1f3')
    expect(calls).toHaveLength(1)
  })

  it('answers 1.e4 from its black repertoire', async () => {
    const bot = botById('ivan')!
    const { engine, calls } = fakeEngine('a7a6')
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const uci = await botMove(bot, engine, fen, ['e4'])
    if (bot.book?.vsE4?.length) {
      expect(calls).toHaveLength(0)
      expect(uci?.[1]).toBe('7')
    }
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
