import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGames } from './build'

const NOW = 1_700_000_000_000

const game = (id: string, createdAt: number, variant: string) =>
  JSON.stringify({
    id,
    variant,
    status: 'mate',
    winner: 'white',
    createdAt,
    players: { white: { user: { name: 'ana' }, rating: 1500 }, black: { user: { name: 'bob' }, rating: 1400 } },
    pgn: '1. e4 e5',
  })

const ndjson = (lines: string[]) => new Response(lines.join('\n'), { status: 200 })

afterEach(() => vi.unstubAllGlobals())

describe('fetchGames from Lichess', () => {
  it('keeps paging past a full page that held only variant games', async () => {
    const variants = Array.from({ length: 50 }, (_, i) => game(`v${i}`, NOW - 1000 * (i + 1), 'chess960'))
    const standard = [game('s1', NOW - 100_000, 'standard'), game('s2', NOW - 101_000, 'standard')]
    const fetch = vi.fn().mockResolvedValueOnce(ndjson(variants)).mockResolvedValueOnce(ndjson(standard))
    vi.stubGlobal('fetch', fetch)
    const games = await fetchGames(
      { source: 'lichess', username: 'ana', period: 'all', name: 'ana' },
      { from: 0, to: NOW },
      new AbortController().signal,
      () => undefined,
    )
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(games).toHaveLength(2)
  })

  it('stops when the next page would be older than the period', async () => {
    const variants = Array.from({ length: 50 }, (_, i) => game(`v${i}`, NOW - 1000 * (i + 1), 'chess960'))
    const fetch = vi.fn().mockResolvedValue(ndjson(variants))
    vi.stubGlobal('fetch', fetch)
    const games = await fetchGames(
      { source: 'lichess', username: 'ana', period: 'recent', name: 'ana' },
      { from: NOW - 10_000, to: NOW },
      new AbortController().signal,
      () => undefined,
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(games).toHaveLength(0)
  })
})
