import { Chess, type Move } from 'chess.js'

/**
 * A typed move in SAN ("Nf3", "exd5", "O-O", "e8=Q") or UCI ("g1f3", "e7e8q"),
 * checked against the position; null when it isn't legal there.
 */
export function parseMoveInput(fen: string, input: string): Move | null {
  const text = input.trim().replace(/0/g, 'O').replace(/[!?]+$/, '')
  if (!text) return null
  const tryMove = (m: string | { from: string; to: string; promotion?: string }) => {
    try {
      return new Chess(fen).move(m)
    } catch {
      return null
    }
  }
  const uci = /^([a-h][1-8])-?([a-h][1-8])([qrbn])?$/i.exec(text)
  if (uci) return tryMove({ from: uci[1].toLowerCase(), to: uci[2].toLowerCase(), promotion: uci[3]?.toLowerCase() })
  // a lowercase piece letter ("nf3") is forgiven; not "b", which is also a pawn's file
  return tryMove(text) ?? (/^[nrqk]/.test(text) ? tryMove(text[0].toUpperCase() + text.slice(1)) : null)
}
