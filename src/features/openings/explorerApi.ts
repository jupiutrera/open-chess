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

const cache = new Map<string, ExplorerResult>()

/** Lichess opening explorer. Throws on network/auth errors so the UI can fall back. */
export async function fetchExplorer(fen: string, source: ExplorerDb): Promise<ExplorerResult> {
  const key = `${source}|${fen}`
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({ fen, moves: '12' })
  if (source === 'lichess') {
    params.set('variant', 'standard')
    params.set('speeds', 'blitz,rapid,classical')
    params.set('ratings', '1600,1800,2000,2200,2500')
  }
  const token = useSettings.getState().lichessToken.trim()
  if (!token) throw new Error('no-token')
  const res = await fetch(`https://explorer.lichess.ovh/${source}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`explorer ${res.status}`)
  const data = (await res.json()) as ExplorerResult
  cache.set(key, data)
  return data
}
