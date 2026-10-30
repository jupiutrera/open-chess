import { describe, expect, it } from 'vitest'
import type { CloneRow } from '../../db/db'
import type { Engine, PvLine, SearchOptions, SearchResult } from '../../engine/engine'
import { START_FEN, epd } from '../../chess/util'
import type { RankedMove } from '../play/bots'
import {
  bandOf,
  bookPick,
  buildBook,
  cloneMove,
  countMove,
  emptyErrors,
  errorFor,
  errorRates,
  favourites,
  periodRange,
  pickError,
  sideOf,
  typicalElo,
  type CloneGame,
} from './clone'

const g = (pgn: string, color: 'w' | 'b', rating?: number): CloneGame => ({ pgn, color, rating, date: 0 })
const ranked = (uci: string, win: number): RankedMove => ({ uci, score: { cp: 0 }, value: win, win })

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

describe('reading the player’s games', () => {
  it('finds their side whatever the case', () => {
    expect(sideOf('MagnusFan', 'other', 'magnusfan')).toBe('w')
    expect(sideOf('other', 'MagnusFan', ' magnusfan ')).toBe('b')
    expect(sideOf('a', 'b', 'c')).toBeUndefined()
  })
  it('covers the twelve months before the last twelve for "a year ago"', () => {
    const now = Date.UTC(2026, 9, 30)
    const r = periodRange('yearAgo', now)
    expect(now - r.to).toBe(365 * 86_400_000)
    expect(now - r.from).toBe(730 * 86_400_000)
    expect(periodRange('all', now).from).toBe(0)
  })
  it('takes the median rating, on the bots’ scale', () => {
    expect(typicalElo([g('', 'w', 1200), g('', 'w', 1400), g('', 'b', 1900)], 'chesscom')).toBe(1400)
    expect(typicalElo([g('', 'w', 1800), g('', 'w', 1900)], 'lichess')).toBe(1700)
    expect(typicalElo([g('', 'w')], 'chesscom')).toBeNull()
  })
})

describe('the opening book', () => {
  const games = [
    g('1. e4 e5 2. Nf3 Nc6 *', 'w'),
    g('1. e4 c5 2. Nf3 d6 *', 'w'),
    g('1. d4 d5 *', 'w'),
    g('1. e4 e5 *', 'b'),
    g('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *', 'w'),
  ]
  const book = buildBook(games)
  it('keeps the player’s own moves in positions they reached at least twice', () => {
    expect(book[epd(START_FEN)]).toEqual({ e2e4: 2, d2d4: 1 })
    // 1.e4 e5 as White and 1.e4 c5: White's second move comes from two different positions, once each
    expect(Object.keys(book)).toHaveLength(1)
  })
  it('picks by how often they played it, and only legal moves', () => {
    expect(bookPick(book, START_FEN, () => 0)).toBe('e2e4')
    expect(bookPick(book, START_FEN, () => 0.9)).toBe('d2d4')
    expect(bookPick(book, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBeNull()
  })
  it('reads the favourite first moves', () => {
    expect(favourites(book).white).toEqual(['e4', 'd4'])
    expect(favourites(book).vsE4).toEqual([])
  })
})

describe('the player’s errors', () => {
  it('uses the review’s thresholds', () => {
    expect(bandOf(3)).toBeNull()
    expect(bandOf(7)).toBe('inaccuracy')
    expect(bandOf(12)).toBe('mistake')
    expect(bandOf(35)).toBe('blunder')
  })
  it('draws an error from the rates of the phase', () => {
    const errors = emptyErrors()
    for (let i = 0; i < 20; i++) countMove(errors, 'middlegame', i < 2 ? 30 : 0)
    expect(errors.middlegame).toEqual({ moves: 20, inaccuracy: 0, mistake: 0, blunder: 2 })
    expect(errorFor(errors, 'middlegame', () => 0.05)).toBe('blunder')
    expect(errorFor(errors, 'middlegame', () => 0.5)).toBeNull()
    // too few moves in a phase to trust
    expect(errorFor(errors, 'endgame', () => 0)).toBeNull()
    expect(errorRates(errors)).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0.1 })
  })
  it('picks a move that loses about as much as that error', () => {
    const moves = [ranked('a', 60), ranked('b', 57), ranked('c', 46), ranked('d', 30)]
    expect(pickError(moves, 'mistake')?.uci).toBe('c')
    expect(pickError(moves, 'blunder')?.uci).toBe('d')
    expect(pickError([ranked('a', 60), ranked('b', 59)], 'blunder')).toBeNull()
  })
})

describe('cloneMove', () => {
  const clone: CloneRow = {
    id: 'x',
    name: 'Friend',
    source: 'lichess',
    username: 'friend',
    period: 'year',
    createdAt: 0,
    games: 10,
    elo: 3200,
    book: { [epd(START_FEN)]: { g1f3: 3 } },
  }
  it('plays from its book without asking the engine', async () => {
    const { engine, calls } = fakeEngine([])
    expect(await cloneMove(clone, engine, START_FEN, { startFen: START_FEN, moves: [] })).toBe('g1f3')
    expect(calls).toHaveLength(0)
  })
  it('leaves the book for the engine at its rating', async () => {
    const { engine } = fakeEngine([{ multipv: 1, depth: 8, score: { cp: 20 }, pv: ['e7e5'] }])
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    expect(await cloneMove(clone, engine, fen, { startFen: START_FEN, moves: [{ san: 'e4', from: 'e2', to: 'e4' } as const] })).toBe('e7e5')
  })
})
