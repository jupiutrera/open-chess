import { describe, expect, it } from 'vitest'
import { capturedPieces, materialDiff, movesByOrigin, parseMove, parsePosition, pieceKind, squareCoords, squareName } from './fen'
import { strengthFor } from './catalog'

describe('parsePosition', () => {
  it('reads a small board', () => {
    const p = parsePosition('rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1')
    expect([p.width, p.height]).toEqual([5, 5])
    expect(p.turn).toBe('w')
    expect(p.pieces.get('a1')).toEqual({ letter: 'r', color: 'w' })
    expect(p.pieces.get('e5')).toEqual({ letter: 'k', color: 'b' })
    expect(p.pieces.size).toBe(20)
  })

  it('reads empty runs of two digits on a wide board', () => {
    const p = parsePosition('rnabqkbcnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNABQKBCNR b KQkq - 0 1')
    expect([p.width, p.height]).toEqual([10, 8])
    expect(p.turn).toBe('b')
    expect(p.pieces.get('j1')).toEqual({ letter: 'r', color: 'w' })
    expect(p.pieces.get('c8')).toEqual({ letter: 'a', color: 'b' })
    expect(p.pieces.has('e4')).toBe(false)
  })

  it('reads the checks left in three-check', () => {
    const p = parsePosition('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 2+3 0 2')
    // the first number is what White may still give, so what Black may still receive
    expect(p.checksLeft).toEqual({ b: 2, w: 3 })
    expect(parsePosition('8/8/8/8/8/8/8/K1k5 w - - 0 1').checksLeft).toBeUndefined()
  })
})

describe('squares and moves', () => {
  it('names squares beyond the eighth file and rank', () => {
    expect(squareName(9, 9)).toBe('j10')
    expect(squareCoords('j10')).toEqual({ file: 9, rank: 9 })
    expect(squareCoords('a1')).toEqual({ file: 0, rank: 0 })
  })

  it('parses UCI moves with two-digit ranks and promotions', () => {
    expect(parseMove('e2e4')).toEqual({ uci: 'e2e4', from: 'e2', to: 'e4', promotion: undefined })
    expect(parseMove('a9a10')).toMatchObject({ from: 'a9', to: 'a10' })
    expect(parseMove('e7e8c')).toMatchObject({ from: 'e7', to: 'e8', promotion: 'c' })
    expect(parseMove('P@e4')).toBeNull()
  })

  it('groups moves by the square they start from', () => {
    const by = movesByOrigin(['e2e3', 'e2e4', 'g1f3'].map((u) => parseMove(u)!))
    expect(by.get('e2')!.map((m) => m.to)).toEqual(['e3', 'e4'])
    expect(by.get('g1')).toHaveLength(1)
  })
})

describe('pieces', () => {
  it('names standard letters and the variant’s own', () => {
    expect(pieceKind('n')).toBe('knight')
    expect(pieceKind('a', { a: 'archbishop' })).toBe('archbishop')
    // a variant may give a standard letter another piece (the royal knight of Knightmate)
    expect(pieceKind('k', { k: 'royalKnight' })).toBe('royalKnight')
  })

  it('counts material with the fairy pieces', () => {
    const even = parsePosition('rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1')
    expect(materialDiff(even)).toBe(0)
    const up = parsePosition('4k/5/5/5/A3K w - - 0 1')
    expect(materialDiff(up, { a: 'amazon' })).toBeGreaterThan(9)
  })

  it('lists what each side has taken, the least valuable first', () => {
    const start = parsePosition('rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1')
    // Black is missing a pawn and the queen, White a knight
    const now = parsePosition('rnb1k/pp1pp/5/PPPPP/R1BQK w - - 0 9')
    expect(capturedPieces(start, now)).toEqual({ byWhite: ['p', 'q'], byBlack: ['n'] })
  })

  it('does not count a promoted pawn as captured', () => {
    const start = parsePosition('4k/P4/5/5/4K w - - 0 1')
    const now = parsePosition('Q3k/5/5/5/4K b - - 0 1')
    expect(capturedPieces(start, now)).toEqual({ byWhite: [], byBlack: [] })
  })
})

describe('strengthFor', () => {
  it('leaves the strongest bot unlimited and hands the rest to the engine limiter', () => {
    expect(strengthFor(3200).elo).toBeUndefined()
    expect(strengthFor(1400)).toMatchObject({ elo: 1400, random: 0 })
  })

  it('weakens the bots below the limiter with moves at random', () => {
    const pip = strengthFor(250)
    expect(pip.elo).toBe(500)
    expect(pip.random).toBeGreaterThan(strengthFor(400).random)
    expect(strengthFor(400).random).toBeGreaterThan(0)
  })
})
