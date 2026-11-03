import { describe, expect, it } from 'vitest'
import type { RankedMove } from './bots'
import { moveTraits, pickStyled, styleBonus, styleMargin } from './styles'

const ranked = (...moves: [string, number][]): RankedMove[] =>
  moves.map(([uci, win]) => ({ uci, win, value: (win - 50) * 10, score: { cp: (win - 50) * 10 } }))
const mid = () => 0.5

describe('move traits', () => {
  it('sees checks, pressure on the king and trades', () => {
    const t = moveTraits('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1a4')!
    expect(t.check).toBe(true)
    expect(t.kingPressure).toBe(2)
    const trade = moveTraits('3qk3/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1d8')!
    expect(trade.trade).toBe(true)
    expect(trade.queenTrade).toBe(true)
  })

  it('sees castling and pawns pushed in front of the castled king', () => {
    expect(moveTraits('r3k2r/8/8/8/8/8/5PPP/R3K2R w KQkq - 0 1', 'e1g1')!.castle).toBe(true)
    expect(moveTraits('r4rk1/8/8/8/8/8/5PPP/R4RK1 w - - 0 1', 'g2g4')!.shieldBreak).toBe(true)
  })

  it('is null for an illegal move', () => {
    expect(moveTraits('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1e8')).toBeNull()
  })
})

describe('styled picks', () => {
  it('the aggressive bot gives check when it costs nothing', () => {
    const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
    expect(pickStyled(fen, ranked(['d1d2', 50], ['d1a4', 50]), 'd1d2', 'aggressive', 4, mid)).toBe('d1a4')
  })

  it('the solid bot castles', () => {
    const fen = 'r3k2r/8/8/8/8/8/5PPP/R3K2R w KQkq - 0 1'
    expect(pickStyled(fen, ranked(['a1b1', 50], ['e1g1', 50]), 'a1b1', 'solid', 4, mid)).toBe('e1g1')
  })

  it('the simplifier trades queens', () => {
    const fen = '3qk3/8/8/8/8/8/8/3QK3 w - - 0 1'
    expect(styleBonus(fen, 'd1d8', 'simplifier')).toBeGreaterThan(styleBonus(fen, 'd1c2', 'simplifier'))
    expect(pickStyled(fen, ranked(['d1c2', 50], ['d1d8', 50]), 'd1c2', 'simplifier', 4, mid)).toBe('d1d8')
  })

  it('never strays further than the margin from its Elo move', () => {
    const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(pickStyled(fen, ranked(['d1d2', 50], ['d1a4', 40]), 'd1d2', 'aggressive', 4, () => r)).toBe('d1d2')
    }
  })

  it('keeps its move when balanced, when the game is decided, or when the move was not ranked', () => {
    const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
    expect(pickStyled(fen, ranked(['d1d2', 50], ['d1a4', 50]), 'd1d2', 'balanced', styleMargin(1500, 'balanced'), mid)).toBe('d1d2')
    expect(pickStyled(fen, ranked(['d1d2', 99], ['d1a4', 98]), 'd1d2', 'aggressive', 4, mid)).toBe('d1d2')
    expect(pickStyled(fen, ranked(['d1a4', 50]), 'd1d2', 'aggressive', 4, mid)).toBe('d1d2')
  })

  it('strays less the stronger it plays', () => {
    expect(styleMargin(1350, 'solid')).toBeGreaterThan(styleMargin(2500, 'solid'))
    expect(styleMargin(3000, 'solid')).toBe(2)
    expect(styleMargin(1500, 'tricky')).toBeGreaterThan(styleMargin(1500, 'solid'))
    expect(styleMargin(1500, 'balanced')).toBe(0)
  })
})

describe('trait edge cases', () => {
  it('a capture the opponent cannot take back is no trade', () => {
    // the bishop on e6 is pinned to its king by the rook on e1, so it can't retake on d5
    expect(moveTraits('4k3/8/4b3/3r4/8/8/8/3RR2K w - - 0 1', 'd1d5')!.trade).toBe(false)
    expect(moveTraits('4k3/8/4b3/3r4/8/8/8/R2R3K w - - 0 1', 'd1d5')!.trade).toBe(true)
  })

  it('a king walked to the wing in an endgame is not castled', () => {
    expect(moveTraits('6k1/8/8/8/8/8/6PP/6K1 w - - 0 1', 'g2g4')!.shieldBreak).toBe(false)
  })

  it('caps the pull toward the king', () => {
    expect(moveTraits('7k/8/8/8/8/8/8/Q6K w - - 0 1', 'a1g7')!.kingPressure).toBe(2)
  })
})
