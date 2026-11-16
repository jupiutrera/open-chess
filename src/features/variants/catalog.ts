/**
 * The chess variants on offer. The rules themselves live in Fairy-Stockfish (the rules library
 * and the engine read the same definitions); this file only says which ones we show and how.
 */

export type Family = 'mini' | 'pieces' | 'armies' | 'rules'
export const FAMILIES: Family[] = ['mini', 'pieces', 'armies', 'rules']

/** What a letter stands for when it is not the usual piece. */
export type FairyKind = 'amazon' | 'chancellor' | 'archbishop' | 'commoner' | 'royalKnight'

export interface Variant {
  /** our id, used in routes and translation keys (`variants.v.<id>`) */
  id: string
  /** the start position (a test holds it to what the rules say), so lists can draw the board without loading the rules */
  fen: string
  /** the name Fairy-Stockfish knows it by */
  engine: string
  family: Family
  /** letters that are not the standard piece in this variant */
  fairy?: Record<string, FairyKind>
  /** the hill: a king that gets there wins, and the board marks the squares */
  marks?: string[]
  /** the FEN carries the checks each side may still receive ("3+3") */
  checks?: boolean
  /** the first king on the last rank wins */
  race?: boolean
  /** who the single-player side should be by default, when the armies differ */
  suggested?: 'w' | 'b'
}

/**
 * Variants Fairy-Stockfish does not ship built in, in its variants.ini format.
 * Loaded into both the rules library and the engine, so they always agree.
 */
export const VARIANTS_INI = `
# Microchess, 4x5
[microchess:gardner]
maxRank = 5
maxFile = d
startFen = rbnk/p3/4/3P/RBNK w - - 0 1

# Petty chess, 5x6
[petty:chess]
maxRank = 6
maxFile = e
startFen = qkbnr/ppppp/5/5/PPPPP/QKBNR w - - 0 1
castling = false
doubleStep = false
promotionRegionWhite = *6
promotionRegionBlack = *1

# Maharajah and the Sepoys: a lone amazon against a whole army
[maharajah]
pawn = p
knight = n
bishop = b
rook = r
queen = q
king = k
amazon = m
startFen = rnbqkbnr/pppppppp/8/8/8/8/8/4M3 w kq - 0 1
extinctionValue = loss
extinctionPieceTypes = m
extinctionPseudoRoyal = true

# Peasants' revolt
[peasant:chess]
startFen = 1nn1k1n1/4p3/8/8/8/8/PPPPPPPP/4K3 w - - 0 1

# Weak!
[weak:chess]
startFen = nnnnknnn/pppppppp/2p2p2/1pppppp1/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1

# Charge of the Light Brigade: three queens against seven knights
[brigade:chess]
startFen = nnnnknnn/pppppppp/8/8/8/8/PPPPPPPP/1Q1QK1Q1 w - - 0 1
castling = false
`

export const VARIANTS: Variant[] = [
  { id: 'gardner', fen: 'rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1', engine: 'gardner', family: 'mini' },
  { id: 'losalamos', fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', engine: 'losalamos', family: 'mini' },
  { id: 'microchess', fen: 'rbnk/p3/4/3P/RBNK w - - 0 1', engine: 'microchess', family: 'mini' },
  { id: 'petty', fen: 'qkbnr/ppppp/5/5/PPPPP/QKBNR w - - 0 1', engine: 'petty', family: 'mini' },

  { id: 'capablanca', fen: 'rnabqkbcnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNABQKBCNR w KQkq - 0 1', engine: 'capablanca', family: 'pieces', fairy: { a: 'archbishop', c: 'chancellor' } },
  { id: 'amazon', fen: 'rnbakbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBAKBNR w KQkq - 0 1', engine: 'amazon', family: 'pieces', fairy: { a: 'amazon' } },
  { id: 'almost', fen: 'rnbckbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBCKBNR w KQkq - 0 1', engine: 'almost', family: 'pieces', fairy: { c: 'chancellor' } },
  { id: 'knightmate', fen: 'rmbqkbmr/pppppppp/8/8/8/8/PPPPPPPP/RMBQKBMR w KQkq - 0 1', engine: 'knightmate', family: 'pieces', fairy: { k: 'royalKnight', m: 'commoner' } },

  { id: 'horde', fen: 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1', engine: 'horde', family: 'armies', suggested: 'b' },
  { id: 'maharajah', fen: 'rnbqkbnr/pppppppp/8/8/8/8/8/4M3 w kq - 0 1', engine: 'maharajah', family: 'armies', fairy: { m: 'amazon' }, suggested: 'b' },
  { id: 'peasant', fen: '1nn1k1n1/4p3/8/8/8/8/PPPPPPPP/4K3 w - - 0 1', engine: 'peasant', family: 'armies' },
  { id: 'weak', fen: 'nnnnknnn/pppppppp/2p2p2/1pppppp1/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1', engine: 'weak', family: 'armies' },
  { id: 'brigade', fen: 'nnnnknnn/pppppppp/8/8/8/8/PPPPPPPP/1Q1QK1Q1 w - - 0 1', engine: 'brigade', family: 'armies' },

  { id: 'kingofthehill', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', engine: 'kingofthehill', family: 'rules', marks: ['d4', 'e4', 'd5', 'e5'] },
  { id: 'threecheck', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 3+3 0 1', engine: '3check', family: 'rules', checks: true },
  { id: 'atomic', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', engine: 'atomic', family: 'rules' },
  { id: 'antichess', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', engine: 'antichess', family: 'rules' },
  { id: 'racingkings', fen: '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1', engine: 'racingkings', family: 'rules', race: true },
]

export function variantById(id: string | undefined): Variant | undefined {
  return VARIANTS.find((v) => v.id === id)
}

/** How strong the engine plays: its Skill Level (-20 to 20) and how long it may think. */
export interface Level {
  id: number
  skill: number
  movetime: number
}
export const LEVELS: Level[] = [
  { id: 1, skill: -20, movetime: 100 },
  { id: 2, skill: -9, movetime: 200 },
  { id: 3, skill: 1, movetime: 300 },
  { id: 4, skill: 10, movetime: 500 },
  { id: 5, skill: 20, movetime: 1200 },
]
export const DEFAULT_LEVEL = 2
export const levelById = (id: number): Level => LEVELS.find((l) => l.id === id) ?? LEVELS[DEFAULT_LEVEL - 1]
