import { Chess, type Move, type Square, type PieceSymbol, type Color } from 'chess.js'
import type { Key } from '@lichess-org/chessground/types'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Legal destinations in the shape chessground expects. */
export function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>()
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from as Key) ?? []
    list.push(m.to as Key)
    dests.set(m.from as Key, list)
  }
  return dests
}

export function turnColor(chess: Chess): 'white' | 'black' {
  return chess.turn() === 'w' ? 'white' : 'black'
}

export function uciOf(m: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return m.from + m.to + (m.promotion ?? '')
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: string } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci[4] : undefined,
  }
}

/** Plays a UCI move, returns the move or null when illegal. */
export function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move(parseUci(uci))
  } catch {
    return null
  }
}

export function isPromotion(chess: Chess, from: string, to: string): boolean {
  const piece = chess.get(from as Square)
  if (!piece || piece.type !== 'p') return false
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1')
}

/** FEN without the move counters: identifies a position for opening lookup. */
export function epd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

/** How a move list from this FEN is numbered: its first move number and whether Black moves first. */
export function moveNumbering(fen: string): { startNumber: number; blackFirst: boolean } {
  const parts = fen.split(' ')
  return { startNumber: Math.max(1, Number(parts[5]) || 1), blackFirst: parts[1] === 'b' }
}

/** Converts a list of UCI moves from a FEN to SAN. */
export function uciLineToSan(fen: string, ucis: string[], max = 99): string[] {
  const c = new Chess(fen)
  const out: string[] = []
  for (const u of ucis.slice(0, max)) {
    const m = playUci(c, u)
    if (!m) break
    out.push(m.san)
  }
  return out
}

export function materialCount(chess: Chess, color: Color): number {
  let total = 0
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) total += PIECE_VALUE[sq.type]
  return total
}

/** Captured pieces per side and the material difference, for the player bars. */
export function capturedPieces(fen: string) {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
  const count = { w: { ...start }, b: { ...start } } as Record<Color, Record<string, number>>
  const board = fen.split(' ')[0]
  const onBoard = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } } as Record<Color, Record<string, number>>
  for (const ch of board) {
    const lower = ch.toLowerCase()
    if (!'pnbrq'.includes(lower)) continue
    onBoard[ch === lower ? 'b' : 'w'][lower]++
  }
  const missing = (c: Color) =>
    (['q', 'r', 'b', 'n', 'p'] as const).flatMap((p) => Array(Math.max(0, count[c][p] - onBoard[c][p])).fill(p) as string[])
  const mat = (c: Color) => (['q', 'r', 'b', 'n', 'p'] as const).reduce((s, p) => s + onBoard[c][p] * PIECE_VALUE[p], 0)
  return {
    // pieces white has captured = black pieces missing
    byWhite: missing('b'),
    byBlack: missing('w'),
    diff: mat('w') - mat('b'),
  }
}

/**
 * How the game in `chess` has ended, or null. `fiftyMoves: false` leaves the 50-move rule
 * out (it is a claim, not the end of the position), as Analysis wants.
 */
export function gameResultText(
  chess: Chess,
  { fiftyMoves = true }: { fiftyMoves?: boolean } = {},
): { result: '1-0' | '0-1' | '1/2-1/2'; reason: string } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' }
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' }
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'repetition' }
  if (fiftyMoves && chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'fifty' }
  return null
}

/**
 * Whether `color` could still deliver mate by some legal sequence (FIDE 6.9: a flag fall
 * is only a loss if the opponent can mate). A lone minor piece can only mate with help
 * from the other side's own pieces.
 */
export function canMate(chess: Chess, color: Color): boolean {
  let minors = 0
  let theirs = 0
  for (const row of chess.board())
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue
      if (sq.color !== color) theirs++
      else if (sq.type === 'n' || sq.type === 'b') minors++
      else return true
    }
  return minors >= 2 || (minors === 1 && theirs > 0)
}

/** Result when `flagged` runs out of time. */
export function timeoutResult(chess: Chess, flagged: Color): { result: '1-0' | '0-1' | '1/2-1/2'; reason: string } {
  const opp: Color = flagged === 'w' ? 'b' : 'w'
  if (!canMate(chess, opp)) return { result: '1/2-1/2', reason: 'timeoutVsInsufficient' }
  return { result: opp === 'w' ? '1-0' : '0-1', reason: 'timeout' }
}

/**
 * Cleans up a pasted FEN: fills in missing trailing fields, drops castling rights whose
 * king or rook is not on its home square and an en-passant square no pawn could have
 * just skipped. chess.js accepts (or rejects) these, and the engine misplays them.
 * Anything it can't read is returned trimmed, for positionProblem to report.
 */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/)
  const rows = parts[0]?.split('/') ?? []
  if (parts.length < 2 || rows.length !== 8) return parts.join(' ')
  const defaults = ['', '', '-', '-', '0', '1']
  for (let i = parts.length; i < 6; i++) parts.push(defaults[i])
  // grid[rank][file], rank 0 = rank 8
  const grid = rows.map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))))
  const at = (sq: string) => grid[8 - Number(sq[1])]?.[sq.charCodeAt(0) - 97] ?? ''
  const home: Record<string, [string, string, string, string]> = {
    K: ['e1', 'K', 'h1', 'R'],
    Q: ['e1', 'K', 'a1', 'R'],
    k: ['e8', 'k', 'h8', 'r'],
    q: ['e8', 'k', 'a8', 'r'],
  }
  const castling = parts[2]
    .split('')
    .filter((f) => home[f] && at(home[f][0]) === home[f][1] && at(home[f][2]) === home[f][3])
  parts[2] = castling.length ? [...new Set(castling)].join('') : '-'
  // a double push by the side that just moved: its pawn in front, both squares behind it empty
  const ep = parts[3]
  if (ep !== '-') {
    const file = ep[0]
    const ok =
      /^[a-h][36]$/.test(ep) &&
      (parts[1] === 'b'
        ? ep[1] === '3' && at(`${file}4`) === 'P' && at(`${file}3`) === '.' && at(`${file}2`) === '.'
        : ep[1] === '6' && at(`${file}5`) === 'p' && at(`${file}6`) === '.' && at(`${file}7`) === '.')
    if (!ok) parts[3] = '-'
  }
  return parts.slice(0, 6).join(' ')
}

export type PositionProblem = 'invalid' | 'kings' | 'pawns' | 'count' | 'check'

/**
 * Why a FEN is not a playable position, or null. chess.js accepts some impossible ones
 * (e.g. the side not to move in check), which the engine cannot handle.
 */
export function positionProblem(fen: string): PositionProblem | null {
  let c: Chess
  try {
    c = new Chess(fen)
  } catch {
    return 'invalid'
  }
  const n = { w: { k: 0, p: 0, all: 0 }, b: { k: 0, p: 0, all: 0 } }
  const board = c.board()
  for (let r = 0; r < 8; r++)
    for (const sq of board[r]) {
      if (!sq) continue
      const side = n[sq.color]
      side.all++
      if (sq.type === 'k') side.k++
      if (sq.type === 'p') {
        side.p++
        if (r === 0 || r === 7) return 'pawns'
      }
    }
  if (n.w.k !== 1 || n.b.k !== 1) return 'kings'
  if (n.w.p > 8 || n.b.p > 8 || n.w.all > 16 || n.b.all > 16) return 'count'
  const waiting: Color = c.turn() === 'w' ? 'b' : 'w'
  const king = board.flat().find((sq) => sq?.type === 'k' && sq.color === waiting)!
  if (c.isAttacked(king.square, c.turn())) return 'check'
  return null
}

export function uid(): string {
  return crypto.randomUUID()
}
