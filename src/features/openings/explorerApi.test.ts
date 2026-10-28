import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExplorerError, explorerErrorKind, fetchExplorer, RATE_LIMIT_BACKOFF } from './explorerApi'
import { useSettings } from '../../settings'

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const kindOf = (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof ExplorerError ? e.kind : 'thrown'))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('explorer errors', () => {
  it('maps HTTP statuses to error kinds', () => {
    expect(explorerErrorKind(401)).toBe('unauthorized')
    expect(explorerErrorKind(429)).toBe('rate-limited')
    expect(explorerErrorKind(500)).toBe('other')
  })

  it('needs a token before calling out', async () => {
    useSettings.setState({ lichessToken: '' })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await kindOf(fetchExplorer(FEN, 'masters'))).toBe('no-token')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('waits a minute after a 429 before asking again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    useSettings.setState({ lichessToken: 'tok' })
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 429 }))
    vi.stubGlobal('fetch', fetch)
    expect(await kindOf(fetchExplorer(FEN, 'lichess'))).toBe('rate-limited')
    expect(await kindOf(fetchExplorer(FEN, 'masters'))).toBe('rate-limited')
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + RATE_LIMIT_BACKOFF + 1)
    fetch.mockResolvedValue(new Response(JSON.stringify({ white: 1, draws: 0, black: 0, moves: [] }), { status: 200 }))
    expect(await kindOf(fetchExplorer(FEN, 'masters'))).toBe('ok')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
