import { Chess } from 'chess.js'
import { read, write } from '@lichess-org/chessground/fen'
import type { Key, Pieces } from '@lichess-org/chessground/types'

/** A move queued while the opponent thinks; `promotion` is set once a pawn reaches the last rank. */
export interface Premove {
  from: string
  to: string
  promotion?: string
}

/**
 * chessground lets a king premove onto its own rook (rookCastle): that's the castle,
 * so it becomes the two-square king move chess.js knows.
 */
function castleTarget(pieces: Pieces, from: string, to: string): string {
  const king = pieces.get(from as Key)
  const rook = pieces.get(to as Key)
  if (king?.role !== 'king' || rook?.role !== 'rook' || rook.color !== king.color || from[1] !== to[1]) return to
  return (to[0] > from[0] ? 'g' : 'c') + to[1]
}

/** Moves a piece on a bare placement, by geometry alone: castling takes the rook along, a pawn on the last rank queens. */
function shift(pieces: Pieces, from: string, to: string): Premove | null {
  const piece = pieces.get(from as Key)
  if (!piece) return null
  to = castleTarget(pieces, from, to)
  const df = to.charCodeAt(0) - from.charCodeAt(0)
  if (piece.role === 'king' && Math.abs(df) === 2 && from[1] === to[1]) {
    const rookFrom = (df > 0 ? 'h' : 'a') + from[1]
    const rook = pieces.get(rookFrom as Key)
    if (rook?.role === 'rook') {
      pieces.delete(rookFrom as Key)
      pieces.set(((df > 0 ? 'f' : 'd') + from[1]) as Key, rook)
    }
  }
  // en passant: a diagonal pawn step onto an empty square removes the pawn beside it
  if (piece.role === 'pawn' && df !== 0 && !pieces.has(to as Key)) pieces.delete((to[0] + from[1]) as Key)
  pieces.delete(from as Key)
  const promotes = piece.role === 'pawn' && (to[1] === '8' || to[1] === '1')
  pieces.set(to as Key, promotes ? { ...piece, role: 'queen' } : piece)
  return { from, to, promotion: promotes ? 'q' : undefined }
}

/**
 * Adds a premove to the queue, read against the position as it will look once the queue
 * is played. Returns the queue unchanged when there is no piece to move.
 */
export function addPremove(fen: string, queue: Premove[], from: string, to: string): Premove[] {
  const pieces = read(virtualPlacement(fen, queue))
  const move = shift(pieces, from, to)
  return move ? [...queue, move] : queue
}

/** The placement (FEN board field) with every queued move made, so the board shows where pieces are headed. */
export function virtualPlacement(fen: string, queue: Premove[]): string {
  const pieces = read(fen)
  for (const m of queue) shift(pieces, m.from, m.to)
  return write(pieces)
}

/** Whether the first queued move is legal in the real position. */
export function premoveLegal(fen: string, move: Premove | undefined): boolean {
  if (!move) return false
  try {
    new Chess(fen).move({ from: move.from, to: move.to, promotion: move.promotion })
    return true
  } catch {
    return false
  }
}
