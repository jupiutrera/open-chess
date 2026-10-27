import { Chess, type Square } from 'chess.js'
import type { Score } from '../../engine/engine'
import { isSacrifice, type MoveReview } from './classify'

export type Explanation =
  | { key: 'allowsMate'; n: number }
  | { key: 'missedMate'; n: number; best: string }
  | { key: 'hangs'; piece: string; square: string }

/**
 * A concrete reason for a bad move, when one can be read off the review: it allows mate,
 * it misses a mate that was there, or it leaves the moved piece en prise.
 * `before` is the score of the position before the move (the previous move's scoreAfter).
 */
export function explainMove(move: MoveReview, fenBefore: string, before?: Score): Explanation | null {
  if (!['inaccuracy', 'mistake', 'miss', 'blunder'].includes(move.quality)) return null
  const sign = move.color === 'w' ? 1 : -1
  const after = move.scoreAfter
  // scores are from White's view: a negative mate for the mover's side means the opponent mates
  if (after.mate !== undefined && after.mate * sign < 0) return { key: 'allowsMate', n: Math.abs(after.mate) }
  if (before?.mate !== undefined && before.mate * sign > 0 && (after.mate === undefined || after.mate * sign <= 0) && move.bestSan)
    return { key: 'missedMate', n: before.mate * sign, best: move.bestSan }
  if (isSacrifice(fenBefore, move.uci)) {
    const c = new Chess(fenBefore)
    const piece = c.get(move.uci.slice(0, 2) as Square)
    if (piece) return { key: 'hangs', piece: piece.type, square: move.uci.slice(2, 4) }
  }
  return null
}
