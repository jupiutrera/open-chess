import { useSettings } from '../../settings'

export interface ExplorerMove {
  uci: string
  san: string
  white: number
  draws: number
  black: number
  averageRating?: number
}

export interface ExplorerResult {
  white: number
  draws: number
  black: number
  moves: ExplorerMove[]
  opening?: { eco: string; name: string } | null
}

export type ExplorerDb = 'lichess' | 'masters'

/** Why the explorer gave nothing: no token set, token refused, too many requests, anything else. */
export type ExplorerErrorKind = 'no-token' | 'unauthorized' | 'rate-limited' | 'other'

export class ExplorerError extends Error {
  readonly kind: ExplorerErrorKind
  constructor(kind: ExplorerErrorKind) {
    super(`explorer: ${kind}`)
    this.kind = kind
  }
}

/** Lichess asks clients to wait a minute after a 429. */
export const RATE_LIMIT_BACKOFF = 60_000

const cache = new Map<string, ExplorerResult>()
let blockedUntil = 0

export function explorerErrorKind(status: number): ExplorerErrorKind {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  return 'other'
}

/** A result already fetched this session, for showing it without waiting. */
export function cachedExplorer(fen: string, source: ExplorerDb): ExplorerResult | undefined {
  return cache.get(`${source}|${fen}`)
}

/** Lichess opening explorer. Throws an ExplorerError (or an AbortError) so the UI can say why it fell back. */
export async function fetchExplorer(fen: string, source: ExplorerDb, signal?: AbortSignal): Promise<ExplorerResult> {
  const key = `${source}|${fen}`
  const hit = cache.get(key)
  if (hit) return hit
  const token = useSettings.getState().lichessToken.trim()
  if (!token) throw new ExplorerError('no-token')
  if (Date.now() < blockedUntil) throw new ExplorerError('rate-limited')
  const params = new URLSearchParams({ fen, moves: '12' })
  if (source === 'lichess') {
    params.set('variant', 'standard')
    params.set('speeds', 'blitz,rapid,classical')
    params.set('ratings', '1600,1800,2000,2200,2500')
  }
  let res: Response
  try {
    res = await fetch(`https://explorer.lichess.ovh/${source}?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new ExplorerError('other')
  }
  if (!res.ok) {
    const kind = explorerErrorKind(res.status)
    if (kind === 'rate-limited') blockedUntil = Date.now() + RATE_LIMIT_BACKOFF
    throw new ExplorerError(kind)
  }
  const data = (await res.json()) as ExplorerResult
  cache.set(key, data)
  return data
}
