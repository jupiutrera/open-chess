import { describe, expect, it } from 'vitest'
import { forMover, mateInMoves, normalizeCategory } from './tablebase'

describe('mateInMoves', () => {
  it('counts the move itself for a move list entry', () => {
    // the mating move leaves the opponent mated (dtm 0)
    expect(mateInMoves(0, true)).toBe(1)
    // opponent is mated in 2 plies after the move: we mate on our next move
    expect(mateInMoves(-2, true)).toBe(2)
    // a losing move: the opponent mates in 3 plies, i.e. 2 moves
    expect(mateInMoves(3, true)).toBe(2)
  })
  it('rounds plies up for the position itself', () => {
    expect(mateInMoves(1, false)).toBe(1)
    expect(mateInMoves(5, false)).toBe(3)
    expect(mateInMoves(-4, false)).toBe(2)
  })
})

describe('normalizeCategory', () => {
  it('reads syzygy results as plain wins and losses', () => {
    expect(normalizeCategory('syzygy-win')).toBe('win')
    expect(normalizeCategory('syzygy-loss')).toBe('loss')
    expect(forMover(normalizeCategory('syzygy-loss'))).toBe('win')
  })
  it('keeps known categories and maps new ones to unknown', () => {
    expect(normalizeCategory('cursed-win')).toBe('cursed-win')
    expect(normalizeCategory('something-new')).toBe('unknown')
  })
})
