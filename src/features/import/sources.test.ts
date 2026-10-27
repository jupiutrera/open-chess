import { describe, expect, it } from 'vitest'
import { parseLichessGames } from './sources'

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
