import { Chess } from 'chess.js'
import { formatScore } from '../../engine/engine'
import type { GameRow } from '../../db/db'
import type { Quality } from './classify'

/** chess.com-style NAGs for the qualities that have one. */
const NAG: Partial<Record<Quality, string>> = { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', miss: '?', blunder: '??' }

/**
 * The game's PGN with the review written in: each move gets its quality, the better move
 * when there was one, and the engine score as a [%eval] tag that Lichess and ChessBase read.
 */
export function annotatedPgn(game: GameRow, label: (q: Quality) => string): string {
  const src = new Chess()
  src.loadPgn(game.pgn)
  const review = game.review
  if (!review) return src.pgn()
  const hist = src.history({ verbose: true })
  const out = new Chess(hist[0]?.before)
  for (const [k, v] of Object.entries(src.getHeaders())) if (v) out.setHeader(k, v)
  out.setHeader('Annotator', 'Open Chess')
  hist.forEach((m, i) => {
    out.move(m.san)
    const r = review.moves[i]
    if (!r) return
    const parts: string[] = []
    if (r.quality !== 'best' && r.quality !== 'excellent' && r.quality !== 'good' && r.quality !== 'forced') {
      parts.push(`${NAG[r.quality] ?? ''} ${label(r.quality)}.`.trim())
      if (r.bestSan && r.bestSan !== r.san && r.quality !== 'book' && r.quality !== 'brilliant' && r.quality !== 'great') parts.push(`${r.bestSan}!`)
    }
    const s = r.scoreAfter
    parts.push(`[%eval ${s.mate !== undefined ? `#${s.mate}` : formatScore(s).replace('+', '')}]`)
    out.setComment(parts.join(' '))
  })
  return out.pgn()
}

/** Several games as one PGN file, as stored (no annotations). */
export function gamesPgn(games: GameRow[]): string {
  return games.map((g) => g.pgn.trim()).join('\n\n') + '\n'
}
