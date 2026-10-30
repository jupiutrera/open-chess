import { describe, expect, it } from 'vitest'
import { backRankMate, forkAfter, pinAfter, trappedAfter, tradeIntoEndgame } from './tactics'

describe('forkAfter', () => {
  it('finds a knight hitting king and rook', () => {
    expect(forkAfter('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'd5c7')).toEqual({
      square: 'c7',
      targets: [
        { piece: 'r', square: 'a8' },
        { piece: 'k', square: 'e8' },
      ],
    })
  })
  it('is no fork when the forking piece is simply taken', () => {
    expect(forkAfter('rb2k3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'd5c7')).toBeNull()
  })
  it('ignores pawns and defended pieces of the same value', () => {
    // the knight on c3 hits a pawn and a knight that the c6 pawn defends: nothing to win
    expect(forkAfter('4k3/8/2p5/1n6/4p3/8/8/3NK3 w - - 0 1', 'd1c3')).toBeNull()
  })
})

describe('pinAfter', () => {
  it('finds a bishop pinning a knight to the king', () => {
    expect(pinAfter('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1b5')).toEqual({
      pinned: { piece: 'n', square: 'c6' },
      behind: { piece: 'k', square: 'e8' },
    })
  })
  it('a rook that can take back along the file is no pin', () => {
    expect(pinAfter('4k3/4r3/8/8/8/8/8/3K3R w - - 0 1', 'h1e1')).toBeNull()
  })
  it('needs something worth more behind', () => {
    // a knight in front of a bishop: the same value, so nothing is pinned
    expect(pinAfter('4b1k1/8/8/4n3/8/8/8/R5K1 w - - 0 1', 'a1e1')).toBeNull()
  })
})

describe('backRankMate', () => {
  it('spots a rook mate on the first rank', () => {
    expect(backRankMate('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', ['a1a8'])).toBe(true)
  })
  it('is not one when the king has air', () => {
    expect(backRankMate('6k1/5pp1/7p/8/8/8/8/R5K1 w - - 0 1', ['a1a8'])).toBe(false)
  })
})

describe('trappedAfter', () => {
  it('finds a bishop shut in on a7', () => {
    expect(trappedAfter('r2rk3/Bpp5/8/8/8/8/8/4K3 b - - 0 1', 'b7b6')).toEqual({ piece: 'b', square: 'a7' })
  })
  it('is not trapped when another piece can deal with the attacker', () => {
    // b6 opens the long diagonal: the queen takes the a8 rook and the bishop is safe
    expect(trappedAfter('r2rk3/Bpp5/8/8/8/8/8/4K2Q b - - 0 1', 'b7b6')).toBeNull()
  })
  it('is not trapped when it can take its way out', () => {
    expect(trappedAfter('r3k3/Bp6/8/8/8/8/8/4K3 b - - 0 1', 'b7b6')).toBeNull()
  })
})

describe('tradeIntoEndgame', () => {
  it('sees a rook trade into an ending', () => {
    expect(tradeIntoEndgame('3rk3/8/8/3r4/8/8/3R4/4K3 w - - 0 1', 'd2d5', 'd8d5')).toBe(true)
  })
  it('needs a recapture on the same square', () => {
    expect(tradeIntoEndgame('3rk3/8/8/3r4/8/8/3R4/4K3 w - - 0 1', 'd2d5', 'e8e7')).toBe(false)
  })
})
