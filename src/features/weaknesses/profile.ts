import { Chess } from 'chess.js'
import type { GameRow } from '../../db/db'
import { isEndgame } from '../../chess/tactics'
import { parseGame } from '../review/analyze'
import { explainPly, explanationTheme, type Theme } from '../review/explain'

/**
 * The weakness profile: where the user's own reviewed games go wrong, by phase, tactical theme
 * and opening, and a week of puzzles aimed at the worst of it. Pure, so it can be tested and
 * recomputed whenever the games change.
 */

export type Phase = 'opening' | 'middlegame' | 'endgame'
export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame']

/** A mistake, miss or blunder of the user's, where to find it and what it was about. */
export interface Mistake {
  gameId: string
  ply: number
  phase: Phase
  theme: Theme | null
  date: number
}

export interface Rate {
  moves: number
  mistakes: number
  /** mistakes per 100 of the user's moves */
  per100: number
}

export interface Weakness {
  theme: Theme
  count: number
  /** the most recent ones first, to open in the review */
  examples: Mistake[]
}

export interface Profile {
  games: number
  moves: number
  mistakes: Mistake[]
  overall: Rate
  byPhase: Record<Phase, Rate>
  /** worst first; only openings with enough games to say something */
  byOpening: (Rate & { name: string; games: number })[]
  /** top themes, most frequent first */
  weaknesses: Weakness[]
  /** the latest games against the ones before them, when there are enough of both */
  trend: { recent: Rate; before: Rate } | null
}

const BAD = ['mistake', 'miss', 'blunder']
/** plies counted as the opening (10 moves each) */
const OPENING_PLIES = 20
const MIN_OPENING_GAMES = 2
export const TREND_GAMES = 10
const TOP = 3

const rate = (moves: number, mistakes: number): Rate => ({ moves, mistakes, per100: moves ? (mistakes / moves) * 100 : 0 })

/** "B20 Sicilian Defense: Smith-Morra" and "B27 Sicilian Defense" are one family. */
export function openingFamily(name: string): string {
  return name.split(':')[0].replace(/^[A-E]\d\d\s+/, '').trim()
}

export function phaseOf(fenBefore: string, ply: number): Phase {
  if (ply <= OPENING_PLIES) return 'opening'
  return isEndgame(new Chess(fenBefore)) ? 'endgame' : 'middlegame'
}

type GameMistakes = { moves: Record<Phase, number>; mistakes: Mistake[] } | null

/** Per game, keyed by its version: replaying every game on each change of the table adds up. */
const cache = new Map<string, { version: number; result: GameMistakes }>()

/** The user's moves and mistakes in one reviewed game, or null when it cannot be read. */
export function gameMistakes(game: GameRow): GameMistakes {
  const hit = cache.get(game.id)
  if (hit && hit.version === game.updatedAt) return hit.result
  const result = readGame(game)
  cache.set(game.id, { version: game.updatedAt, result })
  return result
}

function readGame(game: GameRow): GameMistakes {
  const review = game.review
  if (!review || !game.userColor) return null
  let parsed
  try {
    parsed = parseGame(game.pgn)
  } catch {
    return null
  }
  const moves: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const mistakes: Mistake[] = []
  for (const m of review.moves) {
    if (m.color !== game.userColor || m.quality === 'book' || m.quality === 'forced') continue
    const fen = parsed.fens[m.ply - 1]
    if (!fen) break
    const phase = phaseOf(fen, m.ply)
    moves[phase]++
    if (!BAD.includes(m.quality)) continue
    const why = explainPly(review, parsed.fens, m.ply)
    mistakes.push({ gameId: game.id, ply: m.ply, phase, theme: why ? explanationTheme(why) : null, date: game.date })
  }
  return { moves, mistakes }
}

/** Builds the profile from the user's games (any order; unreviewed ones are skipped). */
export function buildProfile(games: GameRow[]): Profile {
  const read = games
    .filter((g) => !g.deleted)
    .map((g) => ({ g, r: gameMistakes(g) }))
    .filter((x): x is { g: GameRow; r: NonNullable<ReturnType<typeof gameMistakes>> } => !!x.r)
    .sort((a, b) => b.g.date - a.g.date)

  const phaseMoves: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const mistakes: Mistake[] = []
  const openings = new Map<string, { games: number; moves: number; mistakes: number }>()
  for (const { g, r } of read) {
    let gameMoves = 0
    for (const p of PHASES) {
      phaseMoves[p] += r.moves[p]
      gameMoves += r.moves[p]
    }
    mistakes.push(...r.mistakes)
    if (g.opening) {
      const family = openingFamily(g.opening)
      const o = openings.get(family) ?? { games: 0, moves: 0, mistakes: 0 }
      openings.set(family, { games: o.games + 1, moves: o.moves + gameMoves, mistakes: o.mistakes + r.mistakes.length })
    }
  }
  const total = PHASES.reduce((s, p) => s + phaseMoves[p], 0)

  const byPhase = Object.fromEntries(PHASES.map((p) => [p, rate(phaseMoves[p], mistakes.filter((m) => m.phase === p).length)])) as Record<Phase, Rate>

  const byOpening = [...openings]
    .filter(([, o]) => o.games >= MIN_OPENING_GAMES)
    .map(([name, o]) => ({ name, games: o.games, ...rate(o.moves, o.mistakes) }))
    .sort((a, b) => b.per100 - a.per100)

  const themes = new Map<Theme, Mistake[]>()
  for (const m of mistakes) if (m.theme) themes.set(m.theme, [...(themes.get(m.theme) ?? []), m])
  const weaknesses = [...themes]
    .map(([theme, list]) => ({ theme, count: list.length, examples: list.slice(0, 3) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP)

  const sum = (part: typeof read) =>
    rate(
      part.reduce((s, x) => s + PHASES.reduce((t, p) => t + x.r.moves[p], 0), 0),
      part.reduce((s, x) => s + x.r.mistakes.length, 0),
    )
  const trend = read.length >= TREND_GAMES * 2 ? { recent: sum(read.slice(0, TREND_GAMES)), before: sum(read.slice(TREND_GAMES)) } : null

  return { games: read.length, moves: total, mistakes, overall: rate(total, mistakes.length), byPhase, byOpening, weaknesses, trend }
}

/** One day of the weekly plan: a theme to train, or the puzzles made from the user's own mistakes. */
export interface PlanDay {
  /** local date, YYYY-MM-DD */
  day: string
  theme: Theme | 'mistakes'
  count: number
}

export interface WeeklyPlan {
  /** the Monday it starts on */
  start: string
  days: PlanDay[]
}

const PUZZLES_PER_DAY = 10
/** a phase's own puzzle theme, for profiles without enough tactical themes */
const PHASE_THEME: Record<Phase, Theme> = { opening: 'opening', middlegame: 'middlegame', endgame: 'endgame' }

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The Monday of the week `d` falls in, at local midnight. */
export function weekStart(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

/**
 * A week of puzzles: the worst theme three days, the second two, the third one, and the last day
 * on the user's own mistakes when there are any. Missing themes are filled from the worst phase.
 */
export function buildPlan(profile: Profile, now: Date, hasMistakePuzzles: boolean): WeeklyPlan {
  const worstPhase = [...PHASES].sort((a, b) => profile.byPhase[b].per100 - profile.byPhase[a].per100)[0]
  const pool: Theme[] = profile.weaknesses.map((w) => w.theme)
  for (const p of [worstPhase, ...PHASES]) if (pool.length < TOP && !pool.includes(PHASE_THEME[p])) pool.push(PHASE_THEME[p])
  const [a, b, c] = pool
  const order: (Theme | 'mistakes')[] = [a, b, a, c, b, a, hasMistakePuzzles ? 'mistakes' : c]
  const start = weekStart(now)
  const days = order.map((theme, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { day: dayKey(d), theme, count: PUZZLES_PER_DAY }
  })
  return { start: dayKey(start), days }
}

/** A stored plan is for the current week. */
export function planIsCurrent(plan: WeeklyPlan | null, now: Date): plan is WeeklyPlan {
  return !!plan && plan.start === dayKey(weekStart(now))
}

/** Puzzles done for a plan day, from the attempts of that day. */
export function dayProgress(day: PlanDay, attempts: { date: number; mode: string; theme?: string }[]): number {
  return attempts.filter(
    (a) => dayKey(new Date(a.date)) === day.day && (day.theme === 'mistakes' ? a.mode === 'mistakes' : a.mode === 'theme' && a.theme === day.theme),
  ).length
}
