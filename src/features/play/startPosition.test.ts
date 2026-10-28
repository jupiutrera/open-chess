import { describe, expect, it } from 'vitest'
import { START_FEN } from '../../chess/util'
import { customStartFen } from './startPosition'

describe('customStartFen', () => {
  it('accepts a playable position', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'
    expect(customStartFen(fen)).toBe(fen)
  })
  it('ignores a missing, invalid or finished position and the usual start', () => {
    expect(customStartFen(null)).toBeNull()
    expect(customStartFen('not a fen')).toBeNull()
    // only one king
    expect(customStartFen('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBeNull()
    // fool's mate
    expect(customStartFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toBeNull()
    expect(customStartFen(START_FEN)).toBeNull()
  })
  it('starts the 50-move count afresh', () => {
    expect(customStartFen('4k3/8/8/8/8/8/8/R3K3 w - - 120 90')).toBe('4k3/8/8/8/8/8/8/R3K3 w - - 0 90')
  })
})
