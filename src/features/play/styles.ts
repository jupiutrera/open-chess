import { Chess, type Color, type Square } from 'chess.js'
import { PIECE_VALUE, playUci } from '../../chess/util'
import { isSacrifice } from '../review/classify'
import type { RankedMove } from './bots'

/**
 * How a bot likes to play. The style never decides how strong a move is, only which of the
 * moves about as good as the one its Elo would play it picks, so its rating holds.
 */
export type PlayStyle = 'balanced' | 'aggressive' | 'solid' | 'simplifier' | 'tricky'

/** What a move does, as the styles see it. */
export interface MoveTraits {
  check: boolean
  sacrifice: boolean
  /** steps the moved piece came closer to the enemy king (negative: further), capped at 2 */
  kingPressure: number
  /** a pawn push next to the enemy king */
  pawnStorm: boolean
  /** a capture of equal or greater value the opponent can take back */
  trade: boolean
  queenTrade: boolean
  castle: boolean
  /** a pawn push in front of our own castled king */
  shieldBreak: boolean
  /** enemy pieces the moved piece now attacks that are worth more or are undefended */
  threats: number
  /** the king walks toward the centre with few pieces left */
  kingActivity: boolean
}

type Weights = Partial<Record<keyof MoveTraits, number>>

/** Bonus per trait, in win% points; `margin` scales how far from its Elo's move it may stray. */
const STYLE: Record<PlayStyle, { weights: Weights; margin: number }> = {
  balanced: { weights: {}, margin: 0 },
  aggressive: { weights: { check: 2, sacrifice: 3, kingPressure: 1, pawnStorm: 1.5, threats: 1, trade: -1.5 }, margin: 1 },
  solid: { weights: { castle: 3, shieldBreak: -3, trade: 1, sacrifice: -3, kingPressure: -0.3 }, margin: 1 },
  simplifier: { weights: { trade: 3, queenTrade: 2, kingActivity: 2, sacrifice: -2 }, margin: 1 },
  tricky: { weights: { threats: 2, sacrifice: 2, check: 1 }, margin: 1.5 },
}

const dist = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])))

function kingSquare(c: Chess, color: Color): string | null {
  for (const row of c.board()) for (const p of row) if (p?.type === 'k' && p.color === color) return p.square
  return null
}

function pieceMaterial(c: Chess): number {
  let total = 0
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') total += PIECE_VALUE[p.type]
  return total
}

/** The traits of a legal move in `fen`, or null when it isn't legal. */
export function moveTraits(fen: string, uci: string): MoveTraits | null {
  const c = new Chess(fen)
  const me = c.turn()
  const them: Color = me === 'w' ? 'b' : 'w'
  const theirKing = kingSquare(c, them)
  const myKing = kingSquare(c, me)
  const move = playUci(c, uci)
  if (!move || !theirKing || !myKing) return null
  const moved = move.promotion ?? move.piece
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0
  // legal replies only: a pinned piece, or a king stepping into check, can't take back
  const recapture = c.moves({ verbose: true }).some((m) => m.to === move.to)
  // a king tucked on a wing of its home rank while the pieces are still on: castled, or as good as
  const homeRank = me === 'w' ? '1' : '8'
  const castled = myKing[1] === homeRank && 'bcgh'.includes(myKing[0]) && pieceMaterial(c) > 14
  const theirPieces: { square: Square; value: number }[] = []
  for (const row of c.board()) for (const p of row) if (p?.color === them && p.type !== 'k') theirPieces.push({ square: p.square, value: PIECE_VALUE[p.type] })
  const threats = theirPieces.filter(
    (p) => c.attackers(p.square, me).includes(move.to as Square) && (p.value > PIECE_VALUE[moved] || c.attackers(p.square, them).length === 0),
  ).length
  return {
    check: c.inCheck(),
    sacrifice: isSacrifice(fen, uci),
    kingPressure: move.piece === 'k' ? 0 : Math.max(-2, Math.min(2, dist(move.from, theirKing) - dist(move.to, theirKing))),
    pawnStorm: move.piece === 'p' && !move.captured && Math.abs(move.to.charCodeAt(0) - theirKing.charCodeAt(0)) <= 1,
    trade: captured > 0 && captured >= PIECE_VALUE[move.piece] && recapture,
    queenTrade: move.captured === 'q' && move.piece === 'q' && recapture,
    castle: move.isKingsideCastle() || move.isQueensideCastle(),
    shieldBreak: castled && move.piece === 'p' && Math.abs(move.from.charCodeAt(0) - myKing.charCodeAt(0)) <= 1,
    threats,
    kingActivity: move.piece === 'k' && pieceMaterial(c) <= 14 && dist(move.to, 'e4') + dist(move.to, 'd5') < dist(move.from, 'e4') + dist(move.from, 'd5'),
  }
}

/** How much the style likes a move, in win% points. */
export function styleBonus(fen: string, uci: string, style: PlayStyle): number {
  const w = STYLE[style].weights
  if (!Object.keys(w).length) return 0
  const t = moveTraits(fen, uci)
  if (!t) return 0
  let bonus = 0
  for (const [k, weight] of Object.entries(w) as [keyof MoveTraits, number][]) bonus += Number(t[k]) * weight
  return bonus
}

/** Win% the style may give up (or pass up) around its Elo's move: wider for weaker players, as their own choices are. */
export function styleMargin(elo: number, style: PlayStyle): number {
  return Math.min(6, Math.max(2, 8 - elo / 500)) * STYLE[style].margin
}

/**
 * Picks among `ranked` (best first) a move within `margin` win% of `ref`, the one its Elo chose,
 * weighing what the style likes against straying from it. Decisive positions keep `ref`.
 * `ranked` comes from a quick search, so the margin is approximate: a few win% of noise is
 * within what a player at that level misjudges anyway.
 */
export function pickStyled(fen: string, ranked: RankedMove[], ref: string, style: PlayStyle, margin: number, rnd = Math.random): string {
  const base = ranked.find((m) => m.uci === ref)
  if (!base || margin <= 0 || (ranked[0]?.win ?? 0) >= 95) return ref
  const candidates = ranked.filter((m) => Math.abs(m.win - base.win) <= margin)
  const scores = candidates.map((m) => styleBonus(fen, m.uci, style) - Math.abs(m.win - base.win) * 0.5)
  const best = Math.max(...scores)
  const weights = scores.map((s) => Math.exp(s - best))
  let x = rnd() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < candidates.length; i++) {
    x -= weights[i]
    if (x <= 0) return candidates[i].uci
  }
  return ref
}
