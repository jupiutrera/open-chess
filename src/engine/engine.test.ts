import { describe, expect, it } from 'vitest'
import { formatScore, parseInfo } from './engine'

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
})
