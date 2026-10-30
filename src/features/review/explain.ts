import { Chess, type PieceSymbol, type Square } from 'chess.js'
import type { Score } from '../../engine/engine'
import type { THEMES } from '../puzzles/puzzlesData'
import { playUci } from '../../chess/util'
import { backRankMate, forkAfter, pinAfter, trappedAfter, tradeIntoEndgame, type Target } from '../../chess/tactics'
import { isSacrifice, winPercent, type MoveReview } from './classify'

export type Explanation =
  | { key: 'allowsMate'; n: number }
  | { key: 'backRank'; n: number }
  | { key: 'missedMate'; n: number; best: string }
  | { key: 'hangs'; piece: PieceSymbol; square: string }
  | { key: 'allowsFork' | 'missedFork'; san: string; targets: Target[] }
  | { key: 'allowsPin' | 'missedPin'; san: string; pinned: Target; behind: Target }
  | { key: 'trapped'; san: string; piece: Target }
  | { key: 'losingTrade' }

export type Theme = (typeof THEMES)[number]

const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder']

function sanOf(fen: string, uci: string): string | null {
  return playUci(new Chess(fen), uci)?.san ?? null
}

/**
 * A concrete reason for a bad move, when one can be read off the review. In order: it allows
 * mate (on the back rank, if so), misses a mate, leaves the moved piece en prise, allows a fork,
 * gets a piece trapped, allows a pin, trades into a lost-looking ending, or missed a fork or pin.
 * `before` is the score of the position before the move (the previous move's scoreAfter);
 * `line` is the engine's best line after the move, starting with the opponent's reply.
 */
export function explainMove(move: MoveReview, fenBefore: string, before?: Score, line?: string[]): Explanation | null {
  if (!BAD.includes(move.quality)) return null
  const sign = move.color === 'w' ? 1 : -1
  const after = move.scoreAfter
  const fenAfter = (() => {
    const c = new Chess(fenBefore)
    return playUci(c, move.uci) ? c.fen() : null
  })()
  const reply = line?.[0]

  // scores are from White's view: a negative mate for the mover's side means the opponent mates
  if (after.mate !== undefined && after.mate * sign < 0) {
    const n = Math.abs(after.mate)
    return fenAfter && line && backRankMate(fenAfter, line) ? { key: 'backRank', n } : { key: 'allowsMate', n }
  }
  if (before?.mate !== undefined && before.mate * sign > 0 && (after.mate === undefined || after.mate * sign <= 0) && move.bestSan)
    return { key: 'missedMate', n: before.mate * sign, best: move.bestSan }
  if (isSacrifice(fenBefore, move.uci)) {
    const piece = new Chess(fenBefore).get(move.uci.slice(0, 2) as Square)
    if (piece) return { key: 'hangs', piece: piece.type, square: move.uci.slice(2, 4) }
  }

  if (fenAfter && reply) {
    const san = sanOf(fenAfter, reply)
    if (san) {
      const fork = forkAfter(fenAfter, reply)
      if (fork) return { key: 'allowsFork', san, targets: fork.targets }
      const trapped = trappedAfter(fenAfter, reply)
      if (trapped) return { key: 'trapped', san, piece: trapped }
      const pin = pinAfter(fenAfter, reply)
      if (pin) return { key: 'allowsPin', san, ...pin }
    }
  }

  if (before && reply && tradeIntoEndgame(fenBefore, move.uci, reply)) {
    const pov = (s: Score) => (move.color === 'w' ? winPercent(s) : 100 - winPercent(s))
    if (pov(before) >= 80 && pov(after) <= 60) return { key: 'losingTrade' }
  }

  if (move.bestUci && move.bestSan && move.bestUci !== move.uci) {
    const fork = forkAfter(fenBefore, move.bestUci)
    if (fork) return { key: 'missedFork', san: move.bestSan, targets: fork.targets }
    const pin = pinAfter(fenBefore, move.bestUci)
    if (pin) return { key: 'missedPin', san: move.bestSan, ...pin }
  }
  return null
}

/** The explanation is about the opponent's reply, which is worth drawing on the board. */
export function aboutReply(e: Explanation): boolean {
  switch (e.key) {
    case 'allowsFork':
    case 'allowsPin':
    case 'trapped':
    case 'backRank':
      return true
    default:
      return false
  }
}

/** The puzzle theme an explanation belongs to, for training what went wrong. */
export function explanationTheme(e: Explanation): Theme {
  switch (e.key) {
    case 'allowsMate':
    case 'missedMate':
      return e.n <= 4 ? (`mateIn${e.n}` as Theme) : 'mate'
    case 'backRank':
      return 'backRankMate'
    case 'hangs':
      return 'hangingPiece'
    case 'allowsFork':
    case 'missedFork':
      return 'fork'
    case 'allowsPin':
    case 'missedPin':
      return 'pin'
    case 'trapped':
      return 'trappedPiece'
    case 'losingTrade':
      return 'endgame'
  }
}
