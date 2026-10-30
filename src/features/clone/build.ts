import { db, type CloneRow } from '../../db/db'
import type { Engine } from '../../engine/engine'
import { uid } from '../../chess/util'
import { estimateRating } from '../review/classify'
import { chesscomArchives, chesscomMonth, lichessGames, type RemoteGame } from '../import/sources'
import {
  buildBook,
  emptyErrors,
  errorsFromEngine,
  errorsFromReview,
  periodRange,
  sideOf,
  typicalElo,
  type CloneGame,
  type ClonePeriod,
  type CloneSource,
} from './clone'
import { PHASES } from '../weaknesses/profile'

/** Downloading and reading the games of the player a clone is built from. */

/** enough to cover their openings without a long download */
const MAX_GAMES = 150
/** games run through the engine when too few of the player's moves were reviewed already */
const ENGINE_GAMES = 6
/** reviewed moves that make the engine pass unnecessary */
const ENOUGH_MOVES = 300
const FALLBACK_ELO = 1200

export class NoGamesError extends Error {}

export interface BuildProgress {
  step: 'download' | 'analyse'
  done: number
  total: number
}

export interface BuildOptions {
  source: CloneSource
  /** ignored for 'local': those are the user's own games */
  username: string
  period: ClonePeriod
  name: string
  /** rebuilding an existing clone keeps its id */
  id?: string
}

function fromRemote(g: RemoteGame, username: string): CloneGame | null {
  const color = sideOf(g.white, g.black, username)
  if (!color) return null
  return { pgn: g.pgn, color, rating: color === 'w' ? g.whiteElo : g.blackElo, date: g.date }
}

/** The month an archive URL (…/games/YYYY/MM) covers, in ms. */
function archiveMonth(url: string): { from: number; to: number } | null {
  const m = /\/(\d{4})\/(\d{2})$/.exec(url)
  if (!m) return null
  return { from: Date.UTC(Number(m[1]), Number(m[2]) - 1, 1), to: Date.UTC(Number(m[1]), Number(m[2]), 1) }
}

async function fetchGames(
  opts: BuildOptions,
  range: { from: number; to: number },
  signal: AbortSignal,
  progress: (p: BuildProgress) => void,
): Promise<CloneGame[]> {
  const out: CloneGame[] = []
  const inRange = (date: number) => date >= range.from && date <= range.to
  const report = () => progress({ step: 'download', done: out.length, total: MAX_GAMES })

  if (opts.source === 'local') {
    const rows = await db.games.filter((g) => !g.deleted && !!g.userColor && inRange(g.date)).toArray()
    return rows
      .sort((a, b) => b.date - a.date)
      .slice(0, MAX_GAMES)
      .map((g) => ({ pgn: g.pgn, color: g.userColor!, rating: g.userColor === 'w' ? g.whiteElo : g.blackElo, date: g.date, review: g.review }))
  }

  if (opts.source === 'chesscom') {
    // newest month first; only the months the period touches
    for (const url of await chesscomArchives(opts.username, signal)) {
      const month = archiveMonth(url)
      if (month && (month.to <= range.from || month.from > range.to)) continue
      for (const g of await chesscomMonth(url, signal)) {
        const game = inRange(g.date) ? fromRemote(g, opts.username) : null
        if (game) out.push(game)
        if (out.length >= MAX_GAMES) return out
      }
      report()
    }
    return out
  }

  let until: number | undefined = range.to
  while (until) {
    const page = await lichessGames(opts.username, until, signal, 50)
    // an empty page, or one that does not move back in time, ends it
    if (!page.games.length || (page.next !== undefined && page.next >= until)) return out
    for (const g of page.games) {
      if (g.date < range.from) return out
      const game = fromRemote(g, opts.username)
      if (game) out.push(game)
      if (out.length >= MAX_GAMES) return out
    }
    report()
    until = page.next
  }
  return out
}

/** Builds (or rebuilds) a clone: downloads the games, reads the book and the rating, and counts the errors. */
export async function buildClone(opts: BuildOptions, engine: Engine, progress: (p: BuildProgress) => void, signal: AbortSignal): Promise<CloneRow> {
  const range = periodRange(opts.period, Date.now())
  progress({ step: 'download', done: 0, total: MAX_GAMES })
  const games = await fetchGames(opts, range, signal, progress)
  if (!games.length) throw new NoGamesError()

  const errors = emptyErrors()
  const reviewed = games.filter((g) => errorsFromReview(errors, g))
  const counted = () => PHASES.reduce((s, p) => s + errors[p].moves, 0)
  if (counted() < ENOUGH_MOVES) {
    const todo = games.filter((g) => !g.review).slice(0, ENGINE_GAMES)
    for (const [i, g] of todo.entries()) {
      progress({ step: 'analyse', done: i, total: todo.length })
      await errorsFromEngine(errors, engine, g, () => !signal.aborted)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    }
  }

  // ratings from the games; for the user's own unrated games, what their accuracy suggests
  const accuracy = reviewed.map((g) => (g.color === 'w' ? g.review!.accuracy.white : g.review!.accuracy.black))
  const fromAccuracy = accuracy.length ? estimateRating(accuracy.reduce((s, a) => s + a, 0) / accuracy.length) : null
  const byAccuracy = fromAccuracy ? Math.round(fromAccuracy / 50) * 50 : null
  // the ratings stored with the user's own games are often the bot's, not theirs
  const elo = (opts.source === 'local' ? (byAccuracy ?? typicalElo(games, opts.source)) : (typicalElo(games, opts.source) ?? byAccuracy)) ?? FALLBACK_ELO

  return {
    id: opts.id ?? uid(),
    name: opts.name,
    source: opts.source,
    username: opts.username,
    period: opts.period,
    createdAt: Date.now(),
    games: games.length,
    elo,
    book: buildBook(games),
    errors: counted() ? errors : undefined,
  }
}
