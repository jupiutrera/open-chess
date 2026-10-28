import { describe, expect, it } from 'vitest'
import { terminalScore, winPercent, moveAccuracy, gameAccuracy, isSacrifice, classifyMoves, estimateRating, type PositionEval } from './classify'
import { parseInfo } from '../../engine/engine'

describe('winPercent', () => {
  it('is 50 at equality and symmetric', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50)
    expect(winPercent({ cp: 300 }) + winPercent({ cp: -300 })).toBeCloseTo(100)
  })
  it('maps mates to the extremes', () => {
    expect(winPercent({ mate: 3 })).toBe(100)
    expect(winPercent({ mate: -2 })).toBe(0)
  })
})

describe('accuracy', () => {
  it('a move that keeps the evaluation is 100% accurate', () => {
    expect(moveAccuracy(60, 60)).toBe(100)
    expect(moveAccuracy(60, 70)).toBe(100)
  })
  it('a large drop is very inaccurate', () => {
    expect(moveAccuracy(80, 20)).toBeLessThan(15)
  })
  it('a flawless game is near 100 for both sides', () => {
    const curve = Array(40).fill(52)
    const a = gameAccuracy(curve)
    expect(a.white).toBeGreaterThan(99)
    expect(a.black).toBeGreaterThan(99)
  })
  it('the side that blunders scores lower', () => {
    const curve = [52, 53, 52, 54, 53, 15, 14, 13, 12, 10, 9]
    const a = gameAccuracy(curve)
    expect(a.white).toBeLessThan(a.black)
  })
  it('attributes moves correctly when Black moves first', () => {
    // White's win% jumps at index 4 -> 5: a Black blunder when Black moves first
    const curve = [48, 47, 48, 46, 47, 85, 86, 87, 88, 90, 91]
    const a = gameAccuracy(curve, 'b')
    expect(a.black).toBeLessThan(a.white)
    // read as a White-first game the same jump is a White gain, so nobody erred
    const wrong = gameAccuracy(curve)
    expect(wrong.black).toBeGreaterThan(a.black)
  })
  it('rating estimate grows with accuracy', () => {
    expect(estimateRating(90)).toBeGreaterThan(estimateRating(70))
  })
})

describe('terminalScore', () => {
  it('scores mate and stalemate without the engine', () => {
    expect(terminalScore('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toEqual({ mate: 0, cp: -1 })
    expect(terminalScore('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({ cp: 0 })
    expect(terminalScore('8/8/4k3/8/8/4K3/8/8 w - - 0 1')).toEqual({ cp: 0 })
  })
  it('still searches positions past the 50-move mark', () => {
    expect(terminalScore('8/8/4k3/8/8/4K3/4Q3/8 w - - 120 90')).toBeNull()
    expect(terminalScore('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull()
  })
})

describe('isSacrifice', () => {
  it('detects a bishop left en prise', () => {
    // Bxf7+ in the Italian: bishop can be taken by the king
    expect(isSacrifice('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', 'c4f7')).toBe(true)
  })
  it('a normal developing move is not a sacrifice', () => {
    expect(isSacrifice('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'g1f3')).toBe(false)
  })
})

describe('classifyMoves', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const afterA3 = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1'
  it('marks the engine move as best and a big drop as blunder', () => {
    const pos = (fen: string, cp: number, pv: string[] = []): PositionEval => ({
      fen,
      score: { cp },
      lines: [{ multipv: 1, depth: 10, score: { cp }, pv }],
    })
    const best = classifyMoves([pos(start, 30, ['e2e4']), pos(afterE4, 30)], [{ san: 'e4', uci: 'e2e4' }], () => false)
    expect(best[0].quality).toBe('best')
    const blunder = classifyMoves([pos(start, 30, ['e2e4']), pos(afterA3, -600)], [{ san: 'a3', uci: 'a2a3' }], () => false)
    expect(blunder[0].quality).toBe('blunder')
  })
  it('uses book while the game follows theory', () => {
    const r = classifyMoves(
      [
        { fen: start, score: { cp: 30 }, lines: [] },
        { fen: afterE4, score: { cp: 30 }, lines: [] },
      ],
      [{ san: 'e4', uci: 'e2e4' }],
      () => true,
    )
    expect(r[0].quality).toBe('book')
  })
})

describe('parseInfo', () => {
  it('flips the score to White POV when Black is to move', () => {
    const l = parseInfo('info depth 12 seldepth 18 multipv 1 score cp 45 nodes 1000 pv e7e5 g1f3', false)!
    expect(l.score.cp).toBe(-45)
    expect(l.pv).toEqual(['e7e5', 'g1f3'])
  })
  it('parses mate scores', () => {
    const l = parseInfo('info depth 5 multipv 2 score mate 3 pv d1h5', true)!
    expect(l.score.mate).toBe(3)
    expect(l.multipv).toBe(2)
  })
})
