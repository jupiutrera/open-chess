import { Chess, type Move } from 'chess.js'
import { playUci } from '../../chess/util'

/**
 * The position `steps` moves into an engine line, and the move that led there.
 * Stops early at a move that isn't legal (a stored PV should never have one).
 */
export function playLine(fen: string, pv: string[], steps: number): { fen: string; last: Move | null; played: number } {
  const c = new Chess(fen)
  let last: Move | null = null
  let played = 0
  for (const u of pv.slice(0, steps)) {
    const m = playUci(c, u)
    if (!m) break
    last = m
    played++
  }
  return { fen: c.fen(), last, played }
}
