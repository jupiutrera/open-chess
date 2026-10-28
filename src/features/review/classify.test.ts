import { describe, expect, it } from 'vitest'
import { terminalScore, winPercent, moveAccuracy, gameAccuracy, isSacrifice, classifyMoves, estimateRating, repetitionDraws, retryAccepted, scoreFromWin, type PositionEval } from './classify'
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

describe('repetitionDraws', () => {
  it('marks the third occurrence of a position, ignoring the move counters', () => {
    const a = 'r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1'
    const b = 'r3k3/8/8/8/8/8/8/R3K3 b Qq - 1 1'
    const fens = [a, b, a.replace(' 0 1', ' 2 2'), b.replace(' 1 1', ' 3 2'), a.replace(' 0 1', ' 4 3'), b]
    expect(repetitionDraws(fens)).toEqual([false, false, false, false, true, true])
  })
  it('a lost castling right makes it a different position', () => {
    const fens = ['8/8/8/8/8/8/8/R3K2k w Q - 0 1', '8/8/8/8/8/8/8/R3K2k w - - 0 1', '8/8/8/8/8/8/8/R3K2k w - - 0 1']
    expect(repetitionDraws(fens)).toEqual([false, false, false])
  })
})

describe('scoreFromWin', () => {
  it('inverts winPercent', () => {
    for (const cp of [-600, -35, 0, 20, 400]) expect(scoreFromWin(winPercent({ cp })).cp).toBeCloseTo(cp, -1)
  })
})

describe('retryAccepted', () => {
  // White mates with Qg7# (the engine's choice) or Qf8#
  const fen = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'
  const before: PositionEval = { fen, score: { mate: 1 }, lines: [{ multipv: 1, depth: 12, score: { mate: 1 }, pv: ['f7g7'] }] }
  const after = (score: PositionEval['score']): PositionEval => ({ fen: '', lines: [], score })
  it('rejects a winning move that lets a forced mate go', () => {
    expect(retryAccepted(before, after({ cp: 1200 }), 'f7e7', 'f7d5')).toBe(false)
  })
  it('accepts the engine move and another mate', () => {
    expect(retryAccepted(before, after({ mate: 0, cp: 1 }), 'f7g7', 'f7d5')).toBe(true)
    expect(retryAccepted(before, after({ mate: 0, cp: 1 }), 'f7f8', 'f7d5')).toBe(true)
  })
  it('never accepts the move played in the game', () => {
    expect(retryAccepted(before, after({ mate: 0, cp: 1 }), 'f7f8', 'f7f8')).toBe(false)
  })
  it('uses the classification threshold: excellent passes, good does not', () => {
    const eq: PositionEval = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', score: { cp: 30 }, lines: [{ multipv: 1, depth: 12, score: { cp: 30 }, pv: ['e2e4'] }] }
    expect(retryAccepted(eq, after({ cp: 10 }), 'd2d4', 'a2a4')).toBe(true)
    expect(retryAccepted(eq, after({ cp: -60 }), 'b1a3', 'a2a4')).toBe(false)
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
  it('does not call every move best once the game is decided', () => {
    const kq = '7k/8/5K2/8/8/8/8/Q7 w - - 0 1'
    const after = '7k/8/5K2/8/8/8/Q7/8 b - - 1 1'
    const at = (before: PositionEval['score'], afterScore: PositionEval['score']) =>
      classifyMoves(
        [
          { fen: kq, score: before, lines: [{ multipv: 1, depth: 20, score: before, pv: ['a1h1'] }] },
          { fen: after, score: afterScore, lines: [] },
        ],
        [{ san: 'Qa2', uci: 'a1a2' }],
        () => false,
      )[0].quality
    // mate in 5 kept at the same pace, slightly slower, much slower
    expect(at({ mate: 5 }, { mate: 4 })).toBe('best')
    expect(at({ mate: 5 }, { mate: 6 })).toBe('excellent')
    expect(at({ mate: 5 }, { mate: 9 })).toBe('good')
    // +15 to +14.8 is fine; +15 to +11 throws away material although win% stays ~97
    expect(at({ cp: 1500 }, { cp: 1480 })).toBe('best')
    expect(at({ cp: 1500 }, { cp: 1100 })).toBe('good')
    // the losing side: the longest defence is best, hurrying the mate is not
    const black = classifyMoves(
      [
        { fen: '7k/8/5K2/8/8/8/8/Q7 b - - 0 1', score: { mate: 4 }, lines: [{ multipv: 1, depth: 20, score: { mate: 4 }, pv: ['h8g8'] }] },
        { fen: after, score: { mate: 1 }, lines: [] },
      ],
      [{ san: 'Kh7', uci: 'h8h7' }],
      () => false,
    )
    expect(black[0].quality).toBe('good')
  })
  it('calls letting a forced mate go a missed win', () => {
    const kq = '7k/8/5K2/8/8/8/8/Q7 w - - 0 1'
    const after = '7k/8/5K2/8/8/8/Q7/8 b - - 1 1'
    const at = (before: PositionEval['score'], afterScore: PositionEval['score']) =>
      classifyMoves(
        [
          { fen: kq, score: before, lines: [{ multipv: 1, depth: 20, score: before, pv: ['a1h1'] }] },
          { fen: after, score: afterScore, lines: [] },
        ],
        [{ san: 'Qa2', uci: 'a1a2' }],
        () => false,
      )[0].quality
    expect(at({ mate: 2 }, { cp: 1500 })).toBe('miss')
    expect(at({ mate: 3 }, { cp: 250 })).toBe('miss')
    // still mating, only slower: not a miss
    expect(at({ mate: 2 }, { mate: 3 })).toBe('excellent')
    // throwing the whole game away stays a blunder
    expect(at({ mate: 2 }, { cp: -400 })).toBe('blunder')
    // the engine's own move is never a miss, even if the search after it lost sight of the mate
    const own = classifyMoves(
      [
        { fen: kq, score: { mate: 4 }, lines: [{ multipv: 1, depth: 20, score: { mate: 4 }, pv: ['a1a2'] }] },
        { fen: after, score: { cp: 1500 }, lines: [] },
      ],
      [{ san: 'Qa2', uci: 'a1a2' }],
      () => false,
    )
    expect(own[0].quality).toBe('best')
    // a long mate the engine may lose at another depth is judged on the evaluation
    expect(at({ mate: 12 }, { cp: 1500 })).not.toBe('miss')
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
