import { describe, expect, it } from 'vitest'
import { addPremove, plyOf, premoveLegal, virtualPlacement } from './premoves'

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

describe('premove queue', () => {
  it('queues moves against the position the earlier ones leave', () => {
    let q = addPremove(AFTER_E4, [], 'g1', 'f3')
    q = addPremove(AFTER_E4, q, 'f3', 'g5')
    expect(q).toEqual([
      { from: 'g1', to: 'f3', promotion: undefined },
      { from: 'f3', to: 'g5', promotion: undefined },
    ])
    expect(virtualPlacement(AFTER_E4, q)).toBe('rnbqkbnr/pppppppp/8/6N1/4P3/8/PPPP1PPP/RNBQKB1R')
  })

  it('ignores a premove from an empty square', () => {
    expect(addPremove(AFTER_E4, [], 'e2', 'e4')).toEqual([])
  })

  it('castles by moving the rook too, also when the king lands on its rook', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'
    const q = addPremove(fen, [], 'e1', 'h1')
    expect(q[0].to).toBe('g1')
    expect(virtualPlacement(fen, q)).toBe('r3k2r/8/8/8/8/8/8/R4RK1')
    expect(virtualPlacement(fen, addPremove(fen, [], 'e1', 'c1'))).toBe('r3k2r/8/8/8/8/8/8/2KR3R')
  })

  it('queens a pawn premoved to the last rank', () => {
    const fen = '7k/4P3/8/8/8/8/8/K7 b - - 0 1'
    const q = addPremove(fen, [], 'e7', 'e8')
    expect(q[0].promotion).toBe('q')
    expect(virtualPlacement(fen, q)).toBe('4Q2k/8/8/8/8/8/8/K7')
  })

  it('checks the first move against the real position', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    expect(premoveLegal(fen, { from: 'g1', to: 'f3' })).toBe(true)
    // the opponent's pawn now blocks the push
    expect(premoveLegal(fen, { from: 'e4', to: 'e5' })).toBe(false)
    expect(premoveLegal(fen, undefined)).toBe(false)
  })
})

describe('plyOf', () => {
  it('counts half-moves from the FEN counters', () => {
    expect(plyOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(0)
    expect(plyOf(AFTER_E4)).toBe(1)
    expect(plyOf('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')).toBe(2)
  })
})

it('does not guess en passant, so a pawn beside the target stays', () => {
  const fen = '4k3/8/8/8/3PP3/8/8/4K3 b - - 0 1'
  expect(virtualPlacement(fen, addPremove(fen, [], 'e4', 'd5'))).toBe('4k3/8/8/3P4/3P4/8/8/4K3')
})
