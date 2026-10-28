import { describe, expect, it } from 'vitest'
import { chesscomTimeControl, hash64, parseLichessGames, pgnDate, pgnIdentity, rowIdFor, splitPgn } from './sources'

const game = (id: string, status: string, extra: object = {}) =>
  JSON.stringify({
    id,
    variant: 'standard',
    status,
    createdAt: 1_700_000_000_000,
    players: { white: { user: { name: 'ana' }, rating: 1500 }, black: { aiLevel: 3 } },
    pgn: '1. e4 e5',
    ...extra,
  })

describe('parseLichessGames', () => {
  it('skips aborted, unfinished and non-standard games', () => {
    const ndjson = [
      game('a', 'mate', { winner: 'white' }),
      game('b', 'aborted'),
      game('c', 'started'),
      game('d', 'noStart'),
      game('e', 'draw'),
      game('f', 'mate', { variant: 'chess960', winner: 'black' }),
    ].join('\n')
    const games = parseLichessGames(ndjson)
    expect(games.map((g) => g.externalId)).toEqual(['lichess:a', 'lichess:e'])
    expect(games.map((g) => g.result)).toEqual(['1-0', '1/2-1/2'])
    expect(games[0].black).toBe('Stockfish 3')
  })
})

describe('splitPgn', () => {
  it('splits games whatever their first tag is', () => {
    const text = '[Site "a"]\n[White "x"]\n\n1. e4 e5 *\n\n[Site "b"]\n\n1. d4 d5 *\n'
    expect(splitPgn(text)).toHaveLength(2)
  })
  it('keeps a lone game with comments and variations intact', () => {
    const text = '[Event "e"]\n\n1. e4 {best by test} (1. d4 d5) 1... e5 2. Nf3 $1 *'
    expect(splitPgn(text)).toEqual([text])
  })
  it('splits games with no blank line between them', () => {
    expect(splitPgn('[Event "1"]\n1. e4 *\n[Event "2"]\n1. d4 *')).toHaveLength(2)
  })
})

describe('row ids', () => {
  it('are stable and URL-safe for chess.com URLs', () => {
    const id = rowIdFor('https://www.chess.com/game/live/123')
    expect(id).toBe('x-chess-com-game-live-123')
    expect(rowIdFor('https://www.chess.com/game/live/123')).toBe(id)
  })
})

describe('chesscomTimeControl', () => {
  it('shows daily games in days', () => {
    expect(chesscomTimeControl('1/86400')).toBe('1d')
    expect(chesscomTimeControl('1/259200')).toBe('3d')
    expect(chesscomTimeControl('180+2')).toBe('180+2')
  })
})

describe('pgnDate', () => {
  it('uses UTCDate and UTCTime for the exact instant', () => {
    expect(pgnDate({ Date: '2024.01.05', UTCDate: '2024.01.05', UTCTime: '23:30:00' })).toBe(Date.UTC(2024, 0, 5, 23, 30, 0))
  })
  it('reads a bare date as local noon, so it stays on that day', () => {
    const d = new Date(pgnDate({ Date: '2024.01.05' })!)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2024, 0, 5, 12])
  })
  it('puts partial dates at the start of what is known', () => {
    const y = new Date(pgnDate({ Date: '2024.??.??' })!)
    expect([y.getFullYear(), y.getMonth(), y.getDate()]).toEqual([2024, 0, 1])
    const m = new Date(pgnDate({ Date: '2024.03.??' })!)
    expect([m.getFullYear(), m.getMonth(), m.getDate()]).toEqual([2024, 2, 1])
  })
  it('falls back to UTCDate and gives up when the year is unknown', () => {
    expect(new Date(pgnDate({ Date: '????.??.??', UTCDate: '2023.12.31' })!).getDate()).toBe(31)
    expect(pgnDate({ Date: '????.??.??' })).toBeUndefined()
    expect(pgnDate({})).toBeUndefined()
    expect(pgnDate({ Date: '2024.13.01' })).toBeUndefined()
  })
})

describe('PGN identity', () => {
  it('hashes to a stable 64-bit id', () => {
    const a = hash64(pgnIdentity({ White: 'a', Black: 'b' }, ['e4', 'e5']))
    expect(a).toBe(hash64(pgnIdentity({ White: 'a', Black: 'b' }, ['e4', 'e5'])))
    expect(a).toMatch(/^[0-9a-z]{14}$/)
  })
  it('tells apart games that differ only slightly', () => {
    const base = pgnIdentity({ White: 'a', Black: 'b', Date: '2024.01.01' }, ['e4', 'e5', 'Nf3'])
    const ids = new Set([
      base,
      pgnIdentity({ White: 'a', Black: 'b', Date: '2024.01.01' }, ['e4', 'e5', 'Nc3']),
      pgnIdentity({ White: 'a', Black: 'b', Date: '2024.01.01', Round: '2' }, ['e4', 'e5', 'Nf3']),
      pgnIdentity({ White: 'a', Black: 'b', Date: '2024.01.01', Result: '1-0' }, ['e4', 'e5', 'Nf3']),
    ].map(hash64))
    expect(ids.size).toBe(4)
  })
  it('has no collisions over many similar games', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20000; i++) seen.add(hash64(pgnIdentity({ White: 'p', Black: 'q', Round: String(i) }, ['e4'])))
    expect(seen.size).toBe(20000)
  })
})
