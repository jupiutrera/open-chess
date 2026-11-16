/**
 * Reading Fairy-Stockfish positions and moves: boards of any size, any piece letter.
 * Pure: the rules themselves are in rules.ts.
 */

export interface BoardPiece {
  /** lower-case piece letter as in the FEN */
  letter: string
  color: 'w' | 'b'
}

export interface Position {
  width: number
  height: number
  /** pieces by square name ("e4", "j10") */
  pieces: Map<string, BoardPiece>
  turn: 'w' | 'b'
  /** three-check: the checks each side may still receive before losing */
  checksLeft?: { w: number; b: number }
}

export const FILES = 'abcdefghijkl'

export const squareName = (file: number, rank: number) => `${FILES[file]}${rank + 1}`

/** File and rank (both from 0) of a square name. */
export function squareCoords(square: string): { file: number; rank: number } {
  return { file: FILES.indexOf(square[0]), rank: Number(square.slice(1)) - 1 }
}

export function parsePosition(fen: string): Position {
  const fields = fen.trim().split(/\s+/)
  // a pocket ("[...]") follows the board in drop variants; none of ours has one, but the engine may print it
  const rows = fields[0].replace(/\[.*\]$/, '').split('/')
  const pieces = new Map<string, BoardPiece>()
  let width = 0
  rows.forEach((row, i) => {
    const rank = rows.length - 1 - i
    let file = 0
    // digits may run together ("10" empty squares on a ten-file board)
    for (const token of row.match(/\d+|[a-zA-Z]/g) ?? []) {
      if (/\d/.test(token)) file += Number(token)
      else {
        pieces.set(squareName(file, rank), { letter: token.toLowerCase(), color: token === token.toLowerCase() ? 'b' : 'w' })
        file++
      }
    }
    width = Math.max(width, file)
  })
  const checks = fields.find((f, i) => i > 3 && /^\d+\+\d+$/.test(f))
  const [w, b] = checks ? checks.split('+').map(Number) : []
  return {
    width,
    height: rows.length,
    pieces,
    turn: fields[1] === 'b' ? 'b' : 'w',
    // the first number is what White may still give, i.e. what Black may still receive
    checksLeft: checks ? { w: b, b: w } : undefined,
  }
}

export interface VariantMove {
  uci: string
  from: string
  to: string
  /** the piece letter a pawn turns into */
  promotion?: string
}

/** "e2e4", "a7a8q", "a9a10": null for anything else (drops, which no variant here has). */
export function parseMove(uci: string): VariantMove | null {
  const m = /^([a-l]\d{1,2})([a-l]\d{1,2})([a-z])?$/.exec(uci)
  return m ? { uci, from: m[1], to: m[2], promotion: m[3] } : null
}

/** Legal moves grouped by origin square. */
export function movesByOrigin(moves: VariantMove[]): Map<string, VariantMove[]> {
  const out = new Map<string, VariantMove[]>()
  for (const m of moves) out.set(m.from, [...(out.get(m.from) ?? []), m])
  return out
}

/** Material on the board per side, in pawns, for the "who is ahead" hint. Fairy pieces by their usual worth. */
const WORTH: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0, amazon: 12, chancellor: 8, archbishop: 7, commoner: 3, royalKnight: 0 }
const STANDARD: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** What a letter is in a variant: a fairy piece when the variant says so, the standard one otherwise. */
export function pieceKind(letter: string, fairy?: Record<string, string>): string {
  return fairy?.[letter] ?? STANDARD[letter] ?? 'pawn'
}

export function materialDiff(pos: Position, fairy?: Record<string, string>): number {
  let diff = 0
  for (const p of pos.pieces.values()) diff += (p.color === 'w' ? 1 : -1) * (WORTH[pieceKind(p.letter, fairy)] ?? 0)
  return diff
}
