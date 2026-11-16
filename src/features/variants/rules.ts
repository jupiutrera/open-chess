/**
 * The rules of every variant, from ffish.js (Fairy-Stockfish's move generator compiled to
 * WebAssembly, see engines/fairy-stockfish). A game here is the list of moves from the
 * variant's start position.
 */
import { VARIANTS_INI, type Variant } from './catalog'
import { parseMove, parsePosition, squareCoords, type VariantMove } from './fen'

export interface VariantEnd {
  result: '1-0' | '0-1' | '1/2-1/2'
  /** a `play.by.*` key */
  reason: string
}

/** The parts of ffish.js used here. */
interface Board {
  legalMoves(): string
  numberLegalMoves(): number
  push(uci: string): boolean
  pop(): void
  fen(): string
  sanMove(uci: string): string
  /** true is White */
  turn(): boolean
  isCheck(): boolean
  checkedPieces(): string
  isGameOver(claimDraw?: boolean): boolean
  result(claimDraw?: boolean): string
  isInsufficientMaterial(): boolean
  delete(): void
}
export interface Ffish {
  loadVariantConfig(ini: string): void
  startingFen(variant: string): string
  Board: new (variant: string) => Board
}

export interface Rules {
  startFen(v: Variant): string
  newGame(v: Variant): VariantGame
}

/** Wraps a loaded ffish module; the variants Fairy-Stockfish doesn't ship are added once. */
export function createRules(ffish: Ffish): Rules {
  ffish.loadVariantConfig(VARIANTS_INI)
  return {
    startFen: (v) => ffish.startingFen(v.engine),
    newGame: (v) => new VariantGame(new ffish.Board(v.engine), v),
  }
}

let loading: Promise<Rules> | null = null
/** The rules in the browser: the library and its WebAssembly load on first use, from the app's own files. */
export function loadRules(): Promise<Rules> {
  // a file of public/, not of the bundle: the address has to be absolute, as import() resolves against this script
  const url = new URL('fairy/ffish.js', document.baseURI).href
  loading ??= (import(/* @vite-ignore */ url) as Promise<{ default: () => Promise<Ffish> }>)
    .then((lib) => lib.default())
    .then(createRules)
    .catch((e) => {
      // a failed download can be retried
      loading = null
      throw e
    })
  return loading
}

/** One game in progress. Call `dispose` when done: the board lives in WebAssembly memory. */
export class VariantGame {
  readonly startFen: string
  /** UCI moves played so far */
  readonly moves: string[] = []
  readonly sans: string[] = []
  /** positions after each ply; fens[0] is the start */
  readonly fens: string[]
  private board: Board | null

  constructor(
    board: Board,
    private readonly variant: Variant,
  ) {
    this.board = board
    this.startFen = board.fen()
    this.fens = [this.startFen]
  }

  private get b(): Board {
    if (!this.board) throw new Error('game disposed')
    return this.board
  }

  get fen(): string {
    return this.fens[this.fens.length - 1]
  }

  get turn(): 'w' | 'b' {
    // ffish: true is White
    return this.b.turn() ? 'w' : 'b'
  }

  legalMoves(): VariantMove[] {
    const text = this.b.legalMoves()
    return text ? text.split(' ').flatMap((u) => parseMove(u) ?? []) : []
  }

  /** Squares of the royal pieces in check right now. */
  checked(): string[] {
    const text = this.b.checkedPieces()
    return text ? text.split(' ') : []
  }

  /** Plays a legal UCI move; false (and nothing changes) when it isn't one. */
  push(uci: string): boolean {
    if (!this.b.legalMoves().split(' ').includes(uci)) return false
    const san = this.b.sanMove(uci)
    this.b.push(uci)
    this.moves.push(uci)
    this.sans.push(san)
    this.fens.push(this.b.fen())
    return true
  }

  undo(plies = 1) {
    for (let i = 0; i < plies && this.moves.length; i++) {
      this.b.pop()
      this.moves.pop()
      this.sans.pop()
      this.fens.pop()
    }
  }

  /**
   * True when the position shows the variant's own way of winning (third check, king on the hill,
   * king home in the race). The library reports no legal moves after any ending, so this is what
   * tells those endings from mate and stalemate.
   */
  private goalMet(): boolean {
    const v = this.variant
    const pos = parsePosition(this.fen)
    if (v.checks && pos.checksLeft && (pos.checksLeft.w === 0 || pos.checksLeft.b === 0)) return true
    const kings = [...pos.pieces].filter(([, p]) => p.letter === 'k').map(([sq]) => sq)
    if (v.marks && kings.some((sq) => v.marks!.includes(sq))) return true
    return !!v.race && kings.some((sq) => squareCoords(sq).rank === pos.height - 1)
  }

  /** How the game ended, or null while it goes on. Draws by repetition and move count are claimed for the players. */
  end(): VariantEnd | null {
    const b = this.b
    if (!b.isGameOver(true)) return null
    const text = b.result(true)
    const result = text === '1-0' || text === '0-1' ? text : '1/2-1/2'
    // only over because a draw was claimed
    if (!b.isGameOver(false)) {
      // the position without its counters, as repetition compares it
      const key = (fen: string) => fen.split(' ').slice(0, -2).join(' ')
      const repeated = this.fens.filter((f) => key(f) === key(this.fen)).length >= 3
      return { result: '1/2-1/2', reason: repeated ? 'repetition' : 'fifty' }
    }
    const goal = this.goalMet()
    if (result === '1/2-1/2') return { result, reason: goal ? 'goal' : b.isInsufficientMaterial() ? 'insufficient' : 'stalemate' }
    // a decisive end in check is mate; out of check it is the variant's own (no pieces left, the king blown up)
    return { result, reason: !goal && b.isCheck() ? 'checkmate' : 'goal' }
  }

  dispose() {
    this.board?.delete()
    this.board = null
  }
}
