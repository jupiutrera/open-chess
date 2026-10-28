import { db, kvGet, kvSet, put, type PuzzleAttemptRow } from '../../db/db'
import { uid } from '../../chess/util'
import { DEFAULT_GLICKO, updateGlicko, type Glicko } from './glicko'

export interface Puzzle {
  id: string
  /** position before the opponent's setup move */
  fen: string
  /** UCI moves: first is the opponent's, then alternate solver/opponent */
  moves: string[]
  rating: number
  themes: string[]
}

interface Index {
  step: number
  min: number
  max: number
  buckets: Record<string, number>
}

const base = `${import.meta.env.BASE_URL}data/puzzles/`
let indexP: Promise<Index | null> | null = null
const bucketCache = new Map<number, Promise<Puzzle[]>>()

export function loadIndex(): Promise<Index | null> {
  indexP ??= fetch(`${base}index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : null))
    .catch(() => null)
    .then((idx) => {
      if (!idx) indexP = null // offline: try again next time
      return idx
    })
  return indexP
}

function loadBucket(b: number): Promise<Puzzle[]> {
  let p = bucketCache.get(b)
  if (!p) {
    p = fetch(`${base}r${b}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: [string, string, string, number, string][]) =>
        rows.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes.split(' ') })),
      )
      .catch(() => {
        bucketCache.delete(b) // offline: try again next time
        return []
      })
    bucketCache.set(b, p)
  }
  return p
}

/** Warms the service worker cache with the buckets around `b`, so nearby puzzles work offline later. */
function prefetchAround(idx: Index, b: number) {
  // neighbouring buckets (~200 KB each) only when the connection allows and the page is idle
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection
  if (!navigator.onLine || conn?.saveData) return
  const go = () => {
    for (const n of [b - idx.step, b + idx.step]) {
      if (n >= idx.min && n < idx.max && !bucketCache.has(n)) void loadBucket(n)
    }
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 5000 })
  else setTimeout(go, 1500)
}

function bucketOf(idx: Index, rating: number) {
  return Math.floor(Math.max(idx.min, Math.min(idx.max - 1, rating)) / idx.step) * idx.step
}

/** Ids of puzzles already tried, read once from the index and kept up to date by recordAttempt. */
let seenIds: Promise<Set<string>> | null = null
function seenPuzzles(): Promise<Set<string>> {
  if (!seenIds) {
    seenIds = db.puzzleAttempts
      .orderBy('puzzleId')
      .uniqueKeys()
      .then((keys) => new Set(keys as string[]))
    // rows written by sync pulls and backup restores, not only by recordAttempt
    db.puzzleAttempts.hook('creating', (_key, row) => void seenIds?.then((s) => s.add(row.puzzleId)))
  }
  return seenIds
}

/** Picks an unseen puzzle near the target rating, optionally of one theme. */
export async function nextPuzzle(target: number, opts: { theme?: string; exclude?: Set<string> } = {}): Promise<Puzzle | null> {
  const idx = await loadIndex()
  if (!idx) return null
  const seen = opts.exclude ?? (await seenPuzzles())
  // look in the target bucket first, then widen
  for (let spread = 0; spread <= 6; spread++) {
    const offsets = spread === 0 ? [0] : [spread, -spread]
    for (const off of offsets) {
      const b = bucketOf(idx, target) + off * idx.step
      if (b < idx.min || b >= idx.max) continue
      const list = await loadBucket(b)
      if (spread === 0) prefetchAround(idx, b)
      const pool = list.filter((p) => !seen.has(p.id) && (!opts.theme || p.themes.includes(opts.theme)))
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)]
    }
  }
  return null
}

/** Same puzzle for everyone on a given day. */
export async function dailyPuzzle(date = new Date()): Promise<Puzzle | null> {
  const idx = await loadIndex()
  if (!idx) return null
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  const b = 1400 + (day % 8) * 100
  const list = await loadBucket(Math.min(idx.max - idx.step, b))
  if (!list.length) return null
  return list[(day * 2654435761) % list.length]
}

/** Rush ladder: puzzles get harder as the score grows. */
export async function rushPuzzle(n: number, exclude: Set<string>): Promise<Puzzle | null> {
  const target = 600 + n * 70
  return nextPuzzle(target, { exclude })
}

export async function getPuzzleRating(): Promise<Glicko> {
  return kvGet<Glicko>('puzzleRating', DEFAULT_GLICKO)
}

export async function recordAttempt(p: Puzzle, solved: boolean, mode: PuzzleAttemptRow['mode'], rated: boolean) {
  // read-modify-write of the rating: a sync pull or another tab must not slip in between
  return db.transaction('rw', db.kv, db.puzzleAttempts, async () => {
    let ratingAfter: number | undefined
    if (rated) {
      const g: Glicko & { games?: number } = await getPuzzleRating()
      // `games` lets sync keep the copy that has seen more results (see mergeRow)
      const next = { ...updateGlicko(g, p.rating, 80, solved ? 1 : 0), games: (g.games ?? 0) + 1 }
      await kvSet('puzzleRating', next)
      ratingAfter = next.rating
    }
    await put<PuzzleAttemptRow>('puzzleAttempts', {
      id: uid(),
      puzzleId: p.id,
      rating: p.rating,
      solved,
      mode,
      date: Date.now(),
      ratingAfter,
    })
    return ratingAfter
  })
}

export const THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'hangingPiece',
  'sacrifice',
  'backRankMate',
  'smotheredMate',
  'deflection',
  'attraction',
  'trappedPiece',
  'promotion',
  'zugzwang',
  'quietMove',
  'defensiveMove',
  'opening',
  'middlegame',
  'endgame',
]
