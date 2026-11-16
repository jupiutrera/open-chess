import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { FAMILIES, VARIANTS, variantById } from './catalog'
import { parsePosition, pieceKind } from './fen'
import { createRules, type Ffish, type Rules } from './rules'
import es from '../../i18n/es.json'

let rules: Rules

beforeAll(async () => {
  // the built library, as the app serves it; Node hands it the WebAssembly bytes
  const dir = resolve('public/fairy')
  const lib = (await import(/* @vite-ignore */ pathToFileURL(`${dir}/ffish.js`).href)) as { default: (options: object) => Promise<Ffish> }
  rules = createRules(await lib.default({ wasmBinary: readFileSync(`${dir}/ffish.wasm`) }))
})

const play = (id: string, moves: string[]) => {
  const game = rules.newGame(variantById(id)!)
  for (const m of moves) expect(game.push(m), `${id}: ${m}`).toBe(true)
  return game
}

describe('the catalog', () => {
  it('has every family, and texts for every variant', () => {
    for (const f of FAMILIES) expect(VARIANTS.some((v) => v.family === f)).toBe(true)
    const texts = es.variants.v as Record<string, { name: string; rule: string }>
    expect(Object.keys(texts).sort()).toEqual(VARIANTS.map((v) => v.id).sort())
  })

  it.each(VARIANTS.map((v) => [v.id, v] as const))('%s starts where Fairy-Stockfish says', (_, v) => {
    expect(v.fen).toBe(rules.startFen(v))
    const game = rules.newGame(v)
    expect(game.fen).toBe(v.fen)
    expect(game.end()).toBeNull()
    // every legal move is one the board can show (no drops, no squares off the board)
    const pos = parsePosition(game.fen)
    const moves = game.legalMoves()
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) expect(pos.pieces.get(m.from)?.color, m.uci).toBe('w')
    // every letter on the board is a piece we can draw
    const known = new Set(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'amazon', 'chancellor', 'archbishop', 'commoner', 'royalKnight'])
    for (const p of pos.pieces.values()) {
      expect('pnbrqk'.includes(p.letter) || !!v.fairy?.[p.letter], `${v.id}: ${p.letter}`).toBe(true)
      expect(known.has(pieceKind(p.letter, v.fairy))).toBe(true)
    }
    game.dispose()
  })
})

describe('a game', () => {
  it('records moves, and takes them back', () => {
    const game = play('gardner', ['b2b3', 'c4b3'])
    expect(game.sans).toEqual(['b3', 'cxb3'])
    expect(game.turn).toBe('w')
    expect(game.fens).toHaveLength(3)
    game.undo(2)
    expect(game.moves).toEqual([])
    expect(game.fen).toBe(game.startFen)
    expect(game.push('a1a5')).toBe(false)
    game.dispose()
  })

  it('offers every piece a pawn may become', () => {
    // the queen is an amazon here, so that is what a pawn turns into
    const game = play('amazon', ['h2h4', 'g7g5', 'h4g5', 'h7h6', 'g5h6', 'f8g7', 'h6g7', 'g8f6'])
    const letters = game
      .legalMoves()
      .filter((m) => m.from === 'g7' && m.to === 'g8')
      .map((m) => m.promotion)
    expect(letters.sort()).toEqual(['a', 'b', 'n', 'r'])
    game.dispose()
  })

  it('ends by checkmate', () => {
    // fool's mate
    const game = play('kingofthehill', ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
    expect(game.end()).toEqual({ result: '0-1', reason: 'checkmate' })
    game.dispose()
  })

  it('ends by the variant’s goal: the king on the hill', () => {
    const game = play('kingofthehill', ['e2e4', 'e7e5', 'e1e2', 'a7a6', 'e2e3', 'a6a5', 'e3d3', 'a5a4', 'd3c4', 'a4a3', 'c4d5'])
    expect(game.end()).toEqual({ result: '1-0', reason: 'goal' })
    game.dispose()
  })

  it('ends by the variant’s goal: the third check', () => {
    const game = play('threecheck', ['e2e4', 'e7e5', 'f1b5', 'a7a6', 'b5d7', 'e8d7', 'd1g4', 'd7e8'])
    expect(parsePosition(game.fens[5]).checksLeft).toEqual({ b: 2, w: 3 })
    expect(parsePosition(game.fen).checksLeft).toEqual({ b: 1, w: 3 })
    expect(game.checked()).toEqual([])
    expect(game.end()).toBeNull()
    // a check the king could simply take is still the third
    game.push('g4d7')
    expect(game.checked()).toEqual(['e8'])
    expect(game.end()).toEqual({ result: '1-0', reason: 'goal' })
    game.dispose()
  })

  it('treats the lone amazon as a king: it cannot walk into capture, and an attack on it is a check', () => {
    const game = rules.newGame(variantById('maharajah')!)
    for (const m of ['e1e7', 'e1e6']) expect(game.push(m)).toBe(false)
    for (const m of ['e1h4', 'g7g5']) expect(game.push(m)).toBe(true)
    expect(game.checked()).toEqual(['h4'])
    game.dispose()
  })

  it('ends when a king is blown up', () => {
    const game = play('atomic', ['g1f3', 'f7f6', 'f3e5', 'a7a6', 'e5d7'])
    // the capture on d7 takes the king on e8 with it
    expect(game.end()).toEqual({ result: '1-0', reason: 'goal' })
    game.dispose()
  })

  it('ends when one side has given all its pieces away', () => {
    const game = play('antichess', ['e2e3', 'b7b5', 'f1b5', 'a7a6', 'b5d7', 'e8d7', 'd1g4', 'd7e8'])
    expect(game.end()).toBeNull()
    // captures are compulsory
    expect(game.legalMoves().every((m) => m.to === 'c8' || m.to === 'g7')).toBe(true)
    game.dispose()
  })

  it('draws by repetition', () => {
    const game = play('losalamos', ['b1c3', 'b6c4', 'c3b1', 'c4b6', 'b1c3', 'b6c4', 'c3b1', 'c4b6'])
    expect(game.end()).toEqual({ result: '1/2-1/2', reason: 'repetition' })
    game.dispose()
  })
})
