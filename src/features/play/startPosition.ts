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
  if (c.isGameOver() || epd(c.fen()) === epd(START_FEN)) return null
  return c.fen()
}
