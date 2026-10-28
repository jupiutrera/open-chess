import { describe, expect, it } from 'vitest'
import { START_FEN } from '../chess/util'
import { parseMoveInput } from './parseMove'

const uci = (fen: string, s: string) => {
  const m = parseMoveInput(fen, s)
  return m ? m.from + m.to + (m.promotion ?? '') : null
}

describe('parseMoveInput', () => {
  it('reads SAN and UCI', () => {
    expect(uci(START_FEN, 'e4')).toBe('e2e4')
    expect(uci(START_FEN, 'Nf3')).toBe('g1f3')
    expect(uci(START_FEN, 'nf3')).toBe('g1f3')
    expect(uci(START_FEN, 'e2e4')).toBe('e2e4')
    expect(uci(START_FEN, ' G1F3 ')).toBe('g1f3')
  })
  it('reads castling and promotion', () => {
    const castle = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
    expect(uci(castle, 'O-O')).toBe('e1g1')
    expect(uci(castle, '0-0-0')).toBe('e1c1')
    const promo = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1'
    expect(uci(promo, 'e8=N')).toBe('e7e8n')
    expect(uci(promo, 'e7e8q')).toBe('e7e8q')
  })
  it('rejects illegal or unreadable input', () => {
    expect(uci(START_FEN, 'e5')).toBeNull()
    expect(uci(START_FEN, 'e2e5')).toBeNull()
    expect(uci(START_FEN, 'hello')).toBeNull()
    expect(uci(START_FEN, '')).toBeNull()
  })
})
