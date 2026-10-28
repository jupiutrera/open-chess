import type { PositionEval } from './classify'

/**
 * Evaluations of a review still in progress, so leaving the page doesn't throw
 * the work away. One slot: starting another game's review replaces it.
 */
const KEY = 'oc-review-partial'

interface Partial {
  id: string
  depth: number
  pgn: string
  positions: PositionEval[]
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const local = (): Store | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage)

/** Already evaluated positions for this game and depth, matching its FENs in order. */
export function loadPartial(id: string, depth: number, pgn: string, fens: string[], store = local()): PositionEval[] {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as Partial
    if (p.id !== id || p.depth !== depth || p.pgn !== pgn || !Array.isArray(p.positions)) return []
    const out: PositionEval[] = []
    for (const pos of p.positions) {
      if (pos?.fen !== fens[out.length] || !pos.score || !Array.isArray(pos.lines)) break
      out.push(pos)
    }
    return out
  } catch {
    return []
  }
}

export function savePartial(id: string, depth: number, pgn: string, positions: PositionEval[], store = local()) {
  try {
    store?.setItem(KEY, JSON.stringify({ id, depth, pgn, positions } satisfies Partial))
  } catch {
    // storage full or blocked: the review just won't resume
  }
}

export function clearPartial(id: string, store = local()) {
  try {
    const raw = store?.getItem(KEY)
    if (raw && (JSON.parse(raw) as Partial).id === id) store?.removeItem(KEY)
  } catch {
    // ignore
  }
}
