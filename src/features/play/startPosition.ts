import { Chess } from 'chess.js'
import { START_FEN, epd, positionProblem } from '../../chess/util'

/**
 * The position a game against a bot starts from, given the `fen` URL parameter
 * (e.g. "play this position" from the analysis board). Null when there is none,
 * when it is the usual start, or when it can't be played (illegal or already over).
 */
export function customStartFen(param: string | null | undefined): string | null {
  const fen = param?.trim()
  if (!fen || positionProblem(fen)) return null
  const c = new Chess(fen)
  // not isGameOver(): past the 50-move mark the game goes on until someone claims it
  if (c.isCheckmate() || c.isStalemate() || c.isInsufficientMaterial() || epd(c.fen()) === epd(START_FEN)) return null
  // a halfmove clock near 100 would end the game within a move or two: the count starts here
  const parts = c.fen().split(' ')
  parts[4] = '0'
  return parts.join(' ')
}
