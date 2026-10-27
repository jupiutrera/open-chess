import { describe, expect, it } from 'vitest'
import { chesscomTimeControl, parseLichessGames, rowIdFor, splitPgn } from './sources'

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
