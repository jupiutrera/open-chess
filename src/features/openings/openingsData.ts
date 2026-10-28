import { Chess } from 'chess.js'
import { epd } from '../../chess/util'

export interface Opening {
  eco: string
  name: string
  /** SAN moves of the canonical line */
  line: string
  epd: string
}

let cache: Promise<Map<string, Opening>> | null = null

export function loadOpenings(): Promise<Map<string, Opening>> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/openings.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((obj: Record<string, [string, string, string]>) => {
      const m = new Map<string, Opening>()
      for (const [k, [eco, name, line]] of Object.entries(obj)) m.set(k, { eco, name, line, epd: k })
      return m
    })
    .catch(() => {
      cache = null // offline: try again next time
      return new Map<string, Opening>()
    })
  return cache
}

/** The latest named position of a line, walking back from its last position. */
export async function latestOpening(fens: string[]): Promise<Opening | undefined> {
  const book = await loadOpenings()
  for (let i = fens.length - 1; i >= 0; i--) {
    const o = book.get(epd(fens[i]))
    if (o) return o
  }
  return undefined
}

/** Named positions reachable in one legal move from this one. */
export async function namedContinuations(fen: string): Promise<{ san: string; uci: string; opening: Opening }[]> {
  const book = await loadOpenings()
  const c = new Chess(fen)
  const out: { san: string; uci: string; opening: Opening }[] = []
  for (const m of c.moves({ verbose: true })) {
    const o = book.get(epd(m.after))
    if (o) out.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), opening: o })
  }
  return out.sort((a, b) => a.opening.line.length - b.opening.line.length)
}

/** Whether a position is in the opening book (used for "book" moves in review). */
export async function bookChecker(): Promise<(fen: string) => boolean> {
  const book = await loadOpenings()
  return (fen: string) => book.has(epd(fen))
}

export async function searchOpenings(q: string, limit = 30): Promise<Opening[]> {
  const book = await loadOpenings()
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const res: Opening[] = []
  for (const o of book.values()) {
    if (o.name.toLowerCase().includes(needle) || o.eco.toLowerCase() === needle) res.push(o)
  }
  return res.sort((a, b) => a.line.length - b.line.length).slice(0, limit)
}
