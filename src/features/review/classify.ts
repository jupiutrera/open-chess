import { Chess, type Square } from 'chess.js'
import type { Score, PvLine } from '../../engine/engine'
import { PIECE_VALUE, playUci } from '../../chess/util'

export type Quality =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced'

export const QUALITY_ORDER: Quality[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

/** Text annotation for qualities that have one; the rest render as icons. */
export const QUALITY_SYMBOL: Partial<Record<Quality, string>> = {
  brilliant: '!!',
  great: '!',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

/** Score of a game-over position (no engine needed), or null when there are moves to search. */
export function terminalScore(fen: string): Score | null {
  const c = new Chess(fen)
  if (c.isCheckmate()) return { mate: 0, cp: c.turn() === 'w' ? -1 : 1 } // side to move is mated
  // not isDraw(): a 50-move position is only drawn if claimed, so it still gets searched
  if (c.isStalemate() || c.isInsufficientMaterial() || c.isThreefoldRepetition()) return { cp: 0 }
  return null
}

/** Lichess win probability (0-100) from White's point of view. */
export function winPercent(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 || (s.mate === 0 && (s.cp ?? 0) > 0) ? 100 : 0
  const cp = Math.max(-1000, Math.min(1000, s.cp ?? 0))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** Lichess per-move accuracy from the mover's win% before and after. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411
  return Math.max(0, Math.min(100, raw + 1))
}

function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

/**
 * Game accuracy per colour, Lichess style: volatility-weighted mean averaged
 * with the harmonic mean of per-move accuracies.
 * @param whiteWins win% (White POV) for every position, length = moves + 1
 * @param firstMover side to move in the first position (games set up from a FEN may start with Black)
 */
export function gameAccuracy(whiteWins: number[], firstMover: 'w' | 'b' = 'w'): { white: number; black: number } {
  const n = whiteWins.length - 1
  if (n < 1) return { white: 100, black: 100 }
  const windowSize = Math.max(2, Math.min(8, Math.floor(n / 10)))
  const weights: number[] = []
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, Math.min(i, n - windowSize))
    const win = whiteWins.slice(start, start + windowSize + 1)
    weights.push(Math.max(0.5, Math.min(12, stdev(win))))
  }
  const acc = { w: [] as number[], b: [] as number[] }
  const wts = { w: [] as number[], b: [] as number[] }
  for (let i = 0; i < n; i++) {
    const white = (i % 2 === 0) === (firstMover === 'w')
    const before = white ? whiteWins[i] : 100 - whiteWins[i]
    const after = white ? whiteWins[i + 1] : 100 - whiteWins[i + 1]
    const a = moveAccuracy(before, after)
    acc[white ? 'w' : 'b'].push(a)
    wts[white ? 'w' : 'b'].push(weights[i])
  }
  const combine = (a: number[], w: number[]) => {
    if (!a.length) return 100
    const weighted = a.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0)
    const harmonic = a.length / a.reduce((s, x) => s + 1 / Math.max(x, 1), 0)
    return (weighted + harmonic) / 2
  }
  return { white: combine(acc.w, wts.w), black: combine(acc.b, wts.b) }
}

/** Rough performance estimate from accuracy, shown as an estimate only. */
export function estimateRating(accuracy: number): number {
  const table: [number, number][] = [
    [0, 100],
    [40, 250],
    [50, 400],
    [60, 750],
    [70, 1150],
    [78, 1500],
    [84, 1850],
    [88, 2100],
    [92, 2400],
    [95, 2700],
    [98, 3000],
    [100, 3200],
  ]
  for (let i = 1; i < table.length; i++) {
    const [a0, r0] = table[i - 1]
    const [a1, r1] = table[i]
    if (accuracy <= a1) return Math.round((r0 + ((accuracy - a0) / (a1 - a0)) * (r1 - r0)) / 50) * 50
  }
  return 3200
}

/**
 * True when the moved piece is left en prise (a real sacrifice). Only the moved
 * piece counts: leaving another piece hanging (e.g. ignoring a pin) is not detected.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const c = new Chess(fenBefore)
  const mover = c.turn()
  const captured = c.get(uci.slice(2, 4) as Square)
  const move = playUci(c, uci)
  if (!move) return false
  const to = move.to as Square
  const piece = c.get(to)
  if (!piece || piece.type === 'p' || piece.type === 'k') return false
  // a promotion on an attacked square only risks the pawn
  const value = move.promotion ? PIECE_VALUE.p : PIECE_VALUE[piece.type]
  const gained = captured ? PIECE_VALUE[captured.type] : 0
  // legal captures only: a pinned attacker cannot take
  const attackers = [...new Set(c.moves({ verbose: true }).filter((m) => m.to === to).map((m) => m.from))]
  if (!attackers.length) return false
  const defenders = c.attackers(to, mover)
  const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[c.get(sq)!.type] || 100))
  const netLoss = value - gained
  return netLoss >= 2 && (defenders.length === 0 || cheapest < value)
}

export interface PositionEval {
  fen: string
  /** best lines from this position (multipv 2) */
  lines: PvLine[]
  /** final score from White's POV; for terminal positions set directly */
  score: Score
}

export interface MoveReview {
  ply: number
  san: string
  uci: string
  color: 'w' | 'b'
  quality: Quality
  /** win% loss for the mover (0-100) */
  loss: number
  accuracy: number
  bestUci: string | null
  bestSan: string | null
  scoreAfter: Score
}

/** A score as centipawns from `color`'s side, with a forced mate beyond any material count. */
function moverCp(s: Score, color: 'w' | 'b'): number {
  const sign = color === 'w' ? 1 : -1
  if (s.mate !== undefined) {
    const whiteMates = s.mate > 0 || (s.mate === 0 && (s.cp ?? 0) > 0)
    return (whiteMates ? 1 : -1) * sign * (10000 - Math.abs(s.mate) * 10)
  }
  return sign * (s.cp ?? 0)
}

/**
 * Win% saturates in decided positions (+10 and +20 are both ~97%, any mate is 100%), so in a
 * won or lost endgame almost every move "loses" nothing. For a move that isn't the engine's
 * choice, compare the raw evaluations instead: a slower mate or a dropped piece is not "best".
 */
function saturatedQuality(before: Score, after: Score, color: 'w' | 'b'): Quality {
  const sign = color === 'w' ? 1 : -1
  // mover's mate in N before; the opponent, now to move, is mated in N-1 after the best move
  const mateBefore = before.mate !== undefined ? before.mate * sign : undefined
  const mateAfter = after.mate !== undefined ? after.mate * sign : undefined
  if (mateBefore !== undefined && mateBefore > 0 && mateAfter !== undefined) {
    if (mateAfter === 0) return 'best' // delivered mate
    if (mateAfter > 0) {
      const slower = mateAfter - (mateBefore - 1)
      return slower <= 0 ? 'best' : slower <= 2 ? 'excellent' : 'good'
    }
  }
  if (mateBefore !== undefined && mateBefore < 0 && mateAfter !== undefined && mateAfter < 0) {
    // getting mated: the best defence lasts as long as the engine's line
    const faster = -mateBefore - -mateAfter
    return faster <= 0 ? 'best' : faster <= 2 ? 'excellent' : 'good'
  }
  const cpLoss = moverCp(before, color) - moverCp(after, color)
  return cpLoss < 50 ? 'best' : cpLoss < 150 ? 'excellent' : 'good'
}

export function classifyMoves(
  positions: PositionEval[],
  moves: { san: string; uci: string }[],
  isBook: (fenAfter: string, ply: number) => boolean,
): MoveReview[] {
  const out: MoveReview[] = []
  let bookRun = true
  for (let i = 0; i < moves.length; i++) {
    const before = positions[i]
    const after = positions[i + 1]
    const color: 'w' | 'b' = before.fen.split(' ')[1] === 'b' ? 'b' : 'w'
    const pov = (w: number) => (color === 'w' ? w : 100 - w)
    const winBefore = pov(winPercent(before.score))
    const winAfter = pov(winPercent(after.score))
    const loss = Math.max(0, winBefore - winAfter)
    const best = before.lines[0]?.pv[0] ?? null
    const second = before.lines[1]
    const legal = new Chess(before.fen).moves().length
    const { san, uci } = moves[i]

    let quality: Quality
    if (bookRun && isBook(after.fen, i + 1)) {
      quality = 'book'
    } else {
      bookRun = false
      if (legal === 1) quality = 'forced'
      else if (uci === best) quality = 'best'
      else if (loss < 0.5) quality = saturatedQuality(before.score, after.score, color)
      else if (loss < 2) quality = 'excellent'
      else if (loss < 5) quality = 'good'
      else if (loss < 10) quality = 'inaccuracy'
      else if (loss < 20) quality = 'mistake'
      else quality = 'blunder'

      const prev = out[i - 1]
      const opponentErred = prev && (prev.quality === 'mistake' || prev.quality === 'blunder' || prev.quality === 'miss')
      if (opponentErred && (quality === 'inaccuracy' || quality === 'mistake' || quality === 'blunder') && loss >= 8 && winBefore >= 60 && winAfter >= 50) {
        quality = 'miss'
      }

      if (quality === 'best' || quality === 'excellent') {
        const secondWin = second ? pov(winPercent(second.score)) : null
        if (winAfter >= 50 && winBefore < 97 && loss < 2 && isSacrifice(before.fen, uci)) {
          quality = 'brilliant'
        } else if (uci === best && secondWin !== null && winAfter - secondWin >= 15 && winBefore < 90 && legal > 1) {
          quality = 'great'
        }
      }
    }

    let bestSan: string | null = null
    if (best) {
      const c = new Chess(before.fen)
      bestSan = playUci(c, best)?.san ?? null
    }
    out.push({
      ply: i + 1,
      san,
      uci,
      color,
      quality,
      loss,
      accuracy: moveAccuracy(winBefore, winAfter),
      bestUci: best,
      bestSan,
      scoreAfter: after.score,
    })
  }
  return out
}

export function countQualities(reviews: MoveReview[], color: 'w' | 'b'): Record<Quality, number> {
  const c = Object.fromEntries(QUALITY_ORDER.concat('forced').map((q) => [q, 0])) as Record<Quality, number>
  for (const r of reviews) if (r.color === color) c[r.quality]++
  return c
}
