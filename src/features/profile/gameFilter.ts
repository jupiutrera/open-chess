import type { GameRow } from '../../db/db'

export type Outcome = 'win' | 'draw' | 'loss'

export interface GameFilter {
  source: 'all' | 'bot' | 'imported'
  result: 'all' | Outcome
  color: 'all' | 'w' | 'b'
  /** matched against both players' names and the opening */
  query: string
}

export const NO_FILTER: GameFilter = { source: 'all', result: 'all', color: 'all', query: '' }

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
    if (q && !fold(`${shownName(g.white, g)}\n${shownName(g.black, g)}\n${g.opening ?? ''}`).includes(q)) return false
    return true
  }
}
