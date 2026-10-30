import { Chess } from 'chess.js'
import type { CloneRow, ErrorCounts, GameRow } from '../../db/db'
import type { Engine } from '../../engine/engine'
import { START_FEN, epd, playUci } from '../../chess/util'
import { terminalScore, winPercent } from '../review/classify'
import { phaseOf, PHASES, type Phase } from '../weaknesses/profile'
import { budgetMs, playAtElo, rankMoves, type Bot, type BotClock, type GameHistory, type RankedMove } from '../play/bots'

/**
 * Clone bots play like a given player: their own opening moves while the game stays in positions
 * they have reached before, and after that an engine at their rating that errs about as often as
 * they do in each phase of the game.
 */

export type CloneSource = CloneRow['source']
export type ClonePeriod = CloneRow['period']
export type CloneErrors = NonNullable<CloneRow['errors']>
type Band = 'inaccuracy' | 'mistake' | 'blunder'

export const PERIODS: ClonePeriod[] = ['recent', 'year', 'yearAgo', 'all']
/** plies of a game that feed the opening book */
export const BOOK_PLIES = 20
/** a position needs this many games behind it before the clone trusts its book there */
const BOOK_MIN = 2
const DAY = 86_400_000

/** The dates a period covers, from `now` back. */
export function periodRange(period: ClonePeriod, now: number): { from: number; to: number } {
  switch (period) {
    case 'recent':
      return { from: now - 91 * DAY, to: now }
    case 'year':
      return { from: now - 365 * DAY, to: now }
    case 'yearAgo':
      // "you, a year ago": the twelve months before the last twelve
      return { from: now - 730 * DAY, to: now - 365 * DAY }
    case 'all':
      return { from: 0, to: now }
  }
}

/** A game the clone learns from, with the side the cloned player had. */
export interface CloneGame {
  pgn: string
  color: 'w' | 'b'
  /** the player's rating in that game, when the site gave one */
  rating?: number
  date: number
  review?: GameRow['review']
}

/** The cloned player's side in a game, matching names without case; undefined when neither is theirs. */
export function sideOf(white: string, black: string, username: string): 'w' | 'b' | undefined {
  const u = username.trim().toLowerCase()
  if (white.toLowerCase() === u) return 'w'
  if (black.toLowerCase() === u) return 'b'
  return undefined
}

function replay(pgn: string): { chess: Chess; standard: boolean } | null {
  const c = new Chess()
  try {
    c.loadPgn(pgn)
  } catch {
    return null
  }
  // a game from a set-up position has nothing to say about the player's openings
  const standard = !c.getHeaders().FEN || c.getHeaders().FEN === START_FEN
  return { chess: c, standard }
}

/** The opening book: every move the player made in their first BOOK_PLIES plies, by position. */
export function buildBook(games: CloneGame[]): CloneRow['book'] {
  const book: CloneRow['book'] = {}
  for (const g of games) {
    const r = replay(g.pgn)
    if (!r || !r.standard) continue
    for (const m of r.chess.history({ verbose: true }).slice(0, BOOK_PLIES)) {
      if (m.color !== g.color) continue
      const key = epd(m.before)
      const uci = m.from + m.to + (m.promotion ?? '')
      const moves = (book[key] ??= {})
      moves[uci] = (moves[uci] ?? 0) + 1
    }
  }
  // positions seen once say little and take room: keep the ones the clone will use
  for (const key of Object.keys(book)) {
    const total = Object.values(book[key]).reduce((s, n) => s + n, 0)
    if (total < BOOK_MIN) delete book[key]
  }
  return book
}

/** One of the player's own moves from this position, by how often they chose it; null when off book. */
export function bookPick(book: CloneRow['book'], fen: string, rnd = Math.random): string | null {
  const entry = book[epd(fen)]
  if (!entry) return null
  const legal = new Set(new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')))
  const options = Object.entries(entry).filter(([uci]) => legal.has(uci))
  const total = options.reduce((s, [, n]) => s + n, 0)
  if (total < BOOK_MIN) return null
  let x = rnd() * total
  for (const [uci, n] of options) {
    x -= n
    if (x < 0) return uci
  }
  return options[options.length - 1][0]
}

/** Lichess ratings run higher than chess.com's and the bots' scale, roughly by this much. */
const LICHESS_OFFSET = 150

/** The player's typical rating: the median over their games, on the bots' scale. */
export function typicalElo(games: CloneGame[], source: CloneSource): number | null {
  const ratings = games.flatMap((g) => (g.rating ? [g.rating] : [])).sort((a, b) => a - b)
  if (!ratings.length) return null
  const mid = ratings.length >> 1
  const median = ratings.length % 2 ? ratings[mid] : (ratings[mid - 1] + ratings[mid]) / 2
  const elo = source === 'lichess' ? median - LICHESS_OFFSET : median
  return Math.round(Math.max(250, Math.min(3000, elo)) / 50) * 50
}

/** The review's thresholds on win% lost: below 5 nothing, then inaccuracy, mistake, blunder. */
export function bandOf(loss: number): Band | null {
  if (loss >= 20) return 'blunder'
  if (loss >= 10) return 'mistake'
  if (loss >= 5) return 'inaccuracy'
  return null
}

const BANDS: Record<Band, [number, number]> = { inaccuracy: [5, 10], mistake: [10, 20], blunder: [20, 40] }

export function emptyErrors(): CloneErrors {
  const zero = (): ErrorCounts => ({ moves: 0, inaccuracy: 0, mistake: 0, blunder: 0 })
  return { opening: zero(), middlegame: zero(), endgame: zero() }
}

/** Counts one of the player's moves, with the win% it gave away. */
export function countMove(errors: CloneErrors, phase: Phase, loss: number) {
  errors[phase].moves++
  const band = bandOf(loss)
  if (band) errors[phase][band]++
}

/** The player's errors in a game the app already reviewed. */
export function errorsFromReview(errors: CloneErrors, g: CloneGame): boolean {
  if (!g.review) return false
  const r = replay(g.pgn)
  if (!r) return false
  const fens = [r.chess.history({ verbose: true })[0]?.before ?? START_FEN, ...r.chess.history({ verbose: true }).map((m) => m.after)]
  for (const m of g.review.moves) {
    if (m.color !== g.color || m.quality === 'book' || m.quality === 'forced') continue
    const fen = fens[m.ply - 1]
    if (fen) countMove(errors, phaseOf(fen, m.ply), m.loss)
  }
  return true
}

/** Win% for White of a position: the game's verdict when it is over, else a short search. */
async function whiteWin(engine: Engine, fen: string): Promise<number> {
  const end = terminalScore(fen)
  if (end) return winPercent(end)
  const r = await engine.search(fen, { depth: 10, movetime: 150 })
  return winPercent(r.lines[0]?.score ?? { cp: 0 })
}

/** Runs a quick engine pass over a game and counts the player's errors in it. */
export async function errorsFromEngine(errors: CloneErrors, engine: Engine, g: CloneGame, alive: () => boolean): Promise<boolean> {
  const r = replay(g.pgn)
  if (!r) return false
  const moves = r.chess.history({ verbose: true })
  // the first moves are mostly memorised theory: they say little about how the player errs
  const skip = BOOK_PLIES / 2
  if (moves.length <= skip) return true
  let before = await whiteWin(engine, moves[skip].before)
  for (const [i, m] of moves.entries()) {
    if (i < skip) continue
    if (!alive()) return false
    const after = await whiteWin(engine, m.after)
    if (m.color === g.color) {
      const loss = g.color === 'w' ? before - after : after - before
      countMove(errors, phaseOf(m.before, i + 1), Math.max(0, loss))
    }
    before = after
  }
  return true
}

/** Among ranked moves (mover's win%, best first), one that gives away about what an error of this band does. */
export function pickError(moves: RankedMove[], band: Band): RankedMove | null {
  if (moves.length < 2) return null
  const [lo, hi] = BANDS[band]
  const mid = (lo + hi) / 2
  const top = moves[0].win
  const fits = moves.filter((m) => top - m.win >= lo && top - m.win < hi)
  if (!fits.length) return null
  return fits.reduce((a, m) => (Math.abs(top - m.win - mid) < Math.abs(top - a.win - mid) ? m : a))
}

/** The error the clone makes on this move, drawn from its rates in the phase; null for a normal move. */
export function errorFor(errors: CloneErrors | undefined, phase: Phase, rnd = Math.random): Band | null {
  const e = errors?.[phase]
  if (!e || e.moves < 10) return null
  let x = rnd()
  for (const band of ['blunder', 'mistake', 'inaccuracy'] as const) {
    x -= e[band] / e.moves
    if (x < 0) return band
  }
  return null
}

/** The clone's move: its own book while it lasts, then an engine at its rating with its kind of errors. */
export async function cloneMove(
  clone: CloneRow,
  engine: Engine,
  fen: string,
  history?: GameHistory,
  clock?: BotClock,
  rnd = Math.random,
): Promise<string | null> {
  if (!new Chess(fen).moves().length) return null
  const ply = history?.moves.length ?? 0
  if (history?.startFen === START_FEN || !history) {
    const own = bookPick(clone.book, fen, rnd)
    if (own) return own
  }
  const band = errorFor(clone.errors, phaseOf(fen, ply + 1), rnd)
  if (band) {
    const { moves } = await rankMoves(engine, fen, { history, depth: 10, movetime: budgetMs(800, clock) })
    const pick = pickError(moves, band)
    if (pick) return pick.uci
  }
  return playAtElo(engine, fen, clone.elo, history, clock)
}

/** Share of the player's moves, all phases together, that were errors of each kind. */
export function errorRates(errors: CloneErrors | undefined): Record<Band, number> | null {
  if (!errors) return null
  const sum = (k: keyof ErrorCounts) => PHASES.reduce((s, p) => s + errors[p][k], 0)
  const moves = sum('moves')
  if (!moves) return null
  return { inaccuracy: sum('inaccuracy') / moves, mistake: sum('mistake') / moves, blunder: sum('blunder') / moves }
}

/** The player's most played first moves as White, and replies to 1.e4 and 1.d4, in SAN. */
export function favourites(book: CloneRow['book']): { white: string[]; vsE4: string[]; vsD4: string[] } {
  const top = (fen: string) => {
    const entry = book[epd(fen)]
    if (!entry) return []
    return Object.entries(entry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .flatMap(([uci]) => {
        const m = playUci(new Chess(fen), uci)
        return m ? [m.san] : []
      })
  }
  const after = (san: string) => {
    const c = new Chess()
    c.move(san)
    return c.fen()
  }
  return { white: top(START_FEN), vsE4: top(after('e4')), vsD4: top(after('d4')) }
}

/** A stable colour for a clone's avatar. */
export function cloneHue(username: string): number {
  let h = 0
  for (const ch of username.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

/** The clone as a bot the game screen can play; `bio` is already in the user's language. */
export function cloneBot(clone: CloneRow, bio: string): Bot {
  return {
    id: `clone-${clone.id}`,
    name: clone.name,
    elo: clone.elo,
    group: 'clone',
    hue: cloneHue(clone.username),
    style: 'calm',
    bio: { es: bio, en: bio },
    clone,
  }
}
