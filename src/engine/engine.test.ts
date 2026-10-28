import { describe, expect, it } from 'vitest'
import { formatScore, legalMoveCount, parseInfo } from './engine'

describe('parseInfo', () => {
  const line = 'info depth 18 seldepth 24 multipv 2 score cp 35 nodes 1 nps 1 time 1 pv e2e4 e7e5 g1f3'

  it('keeps the score as is when White is to move', () => {
    expect(parseInfo(line, true)).toEqual({ multipv: 2, depth: 18, score: { cp: 35 }, pv: ['e2e4', 'e7e5', 'g1f3'] })
  })

  it("flips the score to White's point of view when Black is to move", () => {
    expect(parseInfo(line, false)?.score).toEqual({ cp: -35 })
    expect(parseInfo('info depth 5 score mate 3 pv d8h4', false)?.score).toEqual({ mate: -3 })
  })

  it('defaults multipv to 1 and ignores lines without a score', () => {
    expect(parseInfo('info depth 5 score cp 0 pv e2e4', true)?.multipv).toBe(1)
    expect(parseInfo('info depth 5 currmove e2e4', true)).toBeNull()
  })
})

describe('formatScore', () => {
  it('formats centipawns and mates', () => {
    expect(formatScore({ cp: 42 })).toBe('+0.4')
    expect(formatScore({ cp: -1250 })).toBe('-13')
    expect(formatScore({ mate: -2 })).toBe('-M2')
    expect(formatScore(undefined)).toBe('0.0')
  })

  it('never prints a signed zero and rounds before picking the precision', () => {
    expect(formatScore({ cp: -4 })).toBe('0.0')
    expect(formatScore({ cp: 3 })).toBe('0.0')
    expect(formatScore({ cp: -5 })).toBe('-0.1')
    expect(formatScore({ cp: 996 })).toBe('+10')
    expect(formatScore({ cp: -994 })).toBe('-9.9')
  })
})

describe('legalMoveCount', () => {
  it('counts legal moves, so MultiPV can be capped', () => {
    expect(legalMoveCount('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(20)
    expect(legalMoveCount('k7/8/1K6/8/8/8/8/7R b - - 0 1')).toBe(1)
    expect(legalMoveCount('not a fen')).toBe(Infinity)
  })
})
