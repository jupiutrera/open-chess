/** Lichess endgame tablebase (Syzygy, up to 7 pieces): exact results for small endings. */

export type TbCategory = 'win' | 'loss' | 'draw' | 'cursed-win' | 'blessed-loss' | 'maybe-win' | 'maybe-loss' | 'unknown'

export interface TbMove {
  uci: string
  san: string
  /** from the opponent's point of view, after the move */
  category: TbCategory
  dtm?: number | null
  dtz?: number | null
}

export interface TbResult {
  /** from the side to move's point of view */
  category: TbCategory
  dtm?: number | null
  dtz?: number | null
  moves: TbMove[]
}

export const TB_MAX_PIECES = 7

export function pieceCount(fen: string): number {
  return (fen.split(' ')[0].match(/[pnbrqk]/gi) ?? []).length
}

const cache = new Map<string, Promise<TbResult | null>>()

/** Null when the position has too many pieces or the service can't be reached. */
export function tablebase(fen: string): Promise<TbResult | null> {
  if (pieceCount(fen) > TB_MAX_PIECES) return Promise.resolve(null)
  const key = fen.split(' ').slice(0, 4).join(' ')
  let p = cache.get(key)
  if (!p) {
    p = fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
      .then((r) => (r.ok ? (r.json() as Promise<TbResult>) : null))
      .catch(() => null)
    cache.set(key, p)
    // a failure (offline, rate limit) is retried next time
    void p.then((r) => r || cache.delete(key))
  }
  return p
}

/** The opponent's category after a move, turned into the mover's. */
export function forMover(c: TbCategory): TbCategory {
  const flip: Partial<Record<TbCategory, TbCategory>> = { win: 'loss', loss: 'win', 'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win', 'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win' }
  return flip[c] ?? c
}
