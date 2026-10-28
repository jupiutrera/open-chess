import type { GameRow } from '../../db/db'

export type Outcome = 'win' | 'draw' | 'loss'

export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily'
export const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily']

/**
 * The speed of a stored time control ("180+2" in seconds, "600", daily "3d" or "1/86400"), by its
 * estimated length, base + 40 × increment, as Lichess classifies them. No clock ("-") or unknown: null.
 */
export function gameSpeed(timeControl: string | undefined): Speed | null {
  const tc = (timeControl ?? '').trim()
  if (/^\d+d$/.test(tc) || /^1\/\d+$/.test(tc)) return 'daily'
  const m = /^(\d+)(?:\+(\d+))?$/.exec(tc)
  if (!m) return null
  const est = Number(m[1]) + 40 * Number(m[2] ?? 0)
  if (!est) return null
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : est < 1500 ? 'rapid' : 'classical'
}

export interface GameFilter {
  source: 'all' | 'bot' | 'imported'
  result: 'all' | Outcome
  color: 'all' | 'w' | 'b'
  speed: 'all' | Speed
  /** matched against both players' names and the opening */
  query: string
}

export const NO_FILTER: GameFilter = { source: 'all', result: 'all', color: 'all', speed: 'all', query: '' }

/** The game's result for the user; draws are draws whoever played, wins and losses need the user's side. */
export function gameOutcome(g: Pick<GameRow, 'result' | 'userColor'>): Outcome | null {
  if (g.result === '1/2-1/2') return 'draw'
  if (!g.userColor || g.result === '*') return null
  return (g.result === '1-0') === (g.userColor === 'w') ? 'win' : 'loss'
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * A predicate for Dexie's `filter`, deleted rows excluded. `shownName` gives a player's name
 * as the list displays it ("Tú" for a stored "You"), so the search finds what is on screen.
 */
export function gameMatcher(f: GameFilter, shownName: (name: string, g: GameRow) => string = (n) => n): (g: GameRow) => boolean {
  const q = fold(f.query.trim())
  return (g) => {
    if (g.deleted) return false
    const played = g.source === 'bot' || g.source === 'local'
    if (f.source === 'bot' && !played) return false
    if (f.source === 'imported' && played) return false
    if (f.color !== 'all' && g.userColor !== f.color) return false
    if (f.result !== 'all' && gameOutcome(g) !== f.result) return false
    if (f.speed !== 'all' && gameSpeed(g.timeControl) !== f.speed) return false
    if (q && !fold(`${shownName(g.white, g)}\n${shownName(g.black, g)}\n${g.opening ?? ''}`).includes(q)) return false
    return true
  }
}
