import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { PIECE_VALUE, playUci } from './util'

/**
 * Deterministic tactical patterns read off a position, for explaining review mistakes.
 * Rough on purpose: each detector answers one yes/no question with a simple exchange
 * rule, never a search. The engine already said the move was bad; these only name why.
 */

export interface Target {
  piece: PieceSymbol
  square: Square
}

const FILES = 'abcdefgh'
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

function step(sq: Square, df: number, dr: number): Square | null {
  const f = FILES.indexOf(sq[0]) + df
  const r = Number(sq[1]) + dr
  return f >= 0 && f < 8 && r >= 1 && r <= 8 ? ((FILES[f] + r) as Square) : null
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

function piecesOf(c: Chess, color: Color): Target[] {
  const out: Target[] = []
  for (const row of c.board()) for (const p of row) if (p && p.color === color) out.push({ piece: p.type, square: p.square })
  return out
}

/**
 * The piece on `sq` can be won: its side is not to move, the side to move can take it
 * legally, and it is undefended or a cheaper piece takes it.
 */
function canBeWon(c: Chess, sq: Square): boolean {
  const piece = c.get(sq)
  if (!piece || piece.color === c.turn()) return false
  const takers = c.moves({ verbose: true }).filter((m) => m.to === sq)
  if (!takers.length) return false
  const cheapest = Math.min(...takers.map((m) => PIECE_VALUE[m.piece] || 100))
  return c.attackers(sq, piece.color).length === 0 || cheapest < PIECE_VALUE[piece.type]
}

/** The piece on `sq`, whose side is to move, is under a threat it should answer. */
function threatened(c: Chess, sq: Square): boolean {
  const piece = c.get(sq)
  if (!piece) return false
  const attackers = c.attackers(sq, other(piece.color))
  if (!attackers.length) return false
  const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[c.get(a)!.type] || 100))
  return c.attackers(sq, piece.color).length === 0 || cheapest < PIECE_VALUE[piece.type]
}

/**
 * After `uci`, the moved piece attacks two or more worthwhile targets: the king, a piece
 * worth more than itself, or an undefended piece. Pawns are not counted as targets, and a
 * forking piece that is simply lost is no fork.
 */
export function forkAfter(fen: string, uci: string): { square: Square; targets: Target[] } | null {
  const c = new Chess(fen)
  const mover = c.turn()
  const move = playUci(c, uci)
  if (!move || move.piece === 'k') return null
  const to = move.to as Square
  if (canBeWon(c, to)) return null
  const value = PIECE_VALUE[c.get(to)!.type]
  const targets = piecesOf(c, other(mover)).filter(
    (t) =>
      t.piece !== 'p' &&
      c.attackers(t.square, mover).includes(to) &&
      (t.piece === 'k' || PIECE_VALUE[t.piece] > value || c.attackers(t.square, other(mover)).length === 0),
  )
  return targets.length >= 2 ? { square: to, targets } : null
}

/**
 * After `uci`, the moved bishop, rook or queen pins an enemy piece to the king or to a more
 * valuable piece behind it. A pinned piece that can take the pinner along the line is not
 * counted: it is a trade, not a pin.
 */
export function pinAfter(fen: string, uci: string): { pinned: Target; behind: Target } | null {
  const c = new Chess(fen)
  const mover = c.turn()
  const move = playUci(c, uci)
  if (!move || !['b', 'r', 'q'].includes(move.piece)) return null
  const from = move.to as Square
  if (canBeWon(c, from)) return null
  const dirs = [...(move.piece !== 'b' ? ROOK_DIRS : []), ...(move.piece !== 'r' ? BISHOP_DIRS : [])]
  for (const [df, dr] of dirs) {
    const diagonal = df !== 0 && dr !== 0
    let pinned: Target | null = null
    for (let sq = step(from, df, dr); sq; sq = step(sq, df, dr)) {
      const p = c.get(sq)
      if (!p) continue
      if (p.color === mover) break
      if (!pinned) {
        // a queen, or a rook on a file / bishop on a diagonal, just takes back along the line
        if (p.type === 'k' || p.type === 'p' || p.type === 'q' || p.type === (diagonal ? 'b' : 'r')) break
        pinned = { piece: p.type, square: sq }
        continue
      }
      if (p.type === 'k' || PIECE_VALUE[p.type] > PIECE_VALUE[pinned.piece]) return { pinned, behind: { piece: p.type, square: sq } }
      break
    }
  }
  return null
}

/** Playing `line` from `fen` ends in mate by a rook or queen on the mated king's first rank. */
export function backRankMate(fen: string, line: string[]): boolean {
  const c = new Chess(fen)
  let last = null
  for (const uci of line) {
    last = playUci(c, uci)
    if (!last) return false
    if (c.isCheckmate()) break
  }
  if (!last || !c.isCheckmate() || !['r', 'q'].includes(last.piece)) return false
  const rank = c.turn() === 'w' ? '1' : '8'
  const king = piecesOf(c, c.turn()).find((p) => p.piece === 'k')!
  return king.square[1] === rank && last.to[1] === rank
}

/**
 * After the reply `uci` (played from `fen`), a knight, bishop, rook or queen of the side
 * now to move is threatened, has moves of its own, and no move at all saves it: each of its
 * moves lands where it can be won, and no other move (taking the attacker, defending it,
 * blocking) leaves it safe where it stands.
 */
export function trappedAfter(fen: string, uci: string): Target | null {
  const c = new Chess(fen)
  if (!playUci(c, uci) || c.inCheck()) return null
  const all = c.moves({ verbose: true })
  for (const t of piecesOf(c, c.turn())) {
    if (t.piece === 'p' || t.piece === 'k' || !threatened(c, t.square)) continue
    if (!all.some((m) => m.from === t.square)) continue
    const saved = all.some((m) => {
      // trading itself for something as valuable is a way out
      if (m.from === t.square && m.captured && PIECE_VALUE[m.captured] >= PIECE_VALUE[t.piece]) return true
      const next = new Chess(c.fen())
      next.move(m)
      return !canBeWon(next, m.from === t.square ? (m.to as Square) : t.square)
    })
    if (!saved) return t
  }
  return null
}

/** No queens and at most a rook and two minor pieces a side, or a lone queen each. */
export function isEndgame(c: Chess): boolean {
  const material = (color: Color) => piecesOf(c, color).reduce((s, p) => s + (p.piece === 'p' || p.piece === 'k' ? 0 : PIECE_VALUE[p.piece]), 0)
  const queens = c.board().flat().some((p) => p?.type === 'q')
  const limit = queens ? 9 : 11
  return material('w') <= limit && material('b') <= limit
}

/** `uci` captures and the reply `reply` takes back on the same square, leaving an endgame. */
export function tradeIntoEndgame(fen: string, uci: string, reply: string | undefined): boolean {
  const c = new Chess(fen)
  const move = playUci(c, uci)
  if (!move?.captured || !reply || reply.slice(2, 4) !== move.to) return false
  const back = playUci(c, reply)
  return !!back?.captured && isEndgame(c)
}
