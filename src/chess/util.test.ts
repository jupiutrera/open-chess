import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { START_FEN, canMate, gameResultText, moveNumbering, normalizeFen, positionProblem, timeoutResult } from './util'

describe('timeoutResult', () => {
  it('is a loss when the opponent has mating material', () => {
    expect(timeoutResult(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'b').result).toBe('1-0')
  })
  it('is a draw against a lone king', () => {
    expect(timeoutResult(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'w')).toEqual({ result: '1/2-1/2', reason: 'timeoutVsInsufficient' })
  })
  it('is a draw against king and knight with nothing to help', () => {
    expect(timeoutResult(new Chess('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1'), 'b').result).toBe('1/2-1/2')
  })
})

describe('canMate', () => {
  it('a lone minor can mate only with the other side’s pieces in the way', () => {
    expect(canMate(new Chess('4k3/4p3/8/8/8/8/8/1N2K3 w - - 0 1'), 'w')).toBe(true)
    expect(canMate(new Chess('4k3/8/8/8/8/8/8/1NB1K3 w - - 0 1'), 'w')).toBe(true)
    expect(canMate(new Chess('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'), 'w')).toBe(true)
  })
})

describe('positionProblem', () => {
  it('accepts the start position', () => {
    expect(positionProblem('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull()
  })
  it('rejects the side not to move in check', () => {
    expect(positionProblem('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1')).toBe('check')
  })
  it('rejects pawns on the back ranks and missing kings', () => {
    expect(positionProblem('P3k3/8/8/8/8/8/8/4K3 w - - 0 1')).not.toBeNull()
    expect(positionProblem('8/8/8/8/8/8/8/4K3 w - - 0 1')).not.toBeNull()
    expect(positionProblem('garbage')).toBe('invalid')
  })
})

describe('normalizeFen', () => {
  it('keeps a valid FEN as is', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(normalizeFen(start)).toBe(start)
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(normalizeFen(afterE4)).toBe(afterE4)
  })
  it('drops castling rights without the king and rook at home', () => {
    expect(normalizeFen('r3k3/8/8/8/8/8/8/4K2R w KQkq - 0 1')).toBe('r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1')
    expect(normalizeFen('4k3/8/8/8/8/8/8/R4K1R w KQ - 0 1')).toBe('4k3/8/8/8/8/8/8/R4K1R w - - 0 1')
  })
  it('drops an en-passant square no pawn could have skipped', () => {
    // no pawn on e4
    expect(normalizeFen('4k3/8/8/8/8/8/8/4K3 b - e3 0 1')).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1')
    // wrong side to move for a rank-3 square
    expect(normalizeFen('4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1')).toBe('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1')
    // the square the pawn came from is occupied
    expect(normalizeFen('4k3/3p4/8/3p4/8/8/8/4K3 w - d6 0 1')).toBe('4k3/3p4/8/3p4/8/8/8/4K3 w - - 0 1')
    expect(normalizeFen('4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1')).toBe('4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1')
  })
  it('fills in missing trailing fields and trims whitespace', () => {
    expect(normalizeFen('  4k3/8/8/8/8/8/8/4K3 w  ')).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(positionProblem(normalizeFen('4k3/8/8/8/8/8/8/4K3 b'))).toBeNull()
  })
  it('leaves unreadable input for positionProblem to reject', () => {
    expect(positionProblem(normalizeFen('hello'))).toBe('invalid')
  })
})

describe('gameResultText', () => {
  const fifty = '4k3/8/8/8/8/8/8/R3K3 w - - 100 80'
  it('ends on the 50-move rule unless asked not to', () => {
    expect(gameResultText(new Chess(fifty))?.reason).toBe('fifty')
    expect(gameResultText(new Chess(fifty), { fiftyMoves: false })).toBeNull()
  })
  it('still reports checkmate without the 50-move rule', () => {
    expect(gameResultText(new Chess('R3k3/8/4K3/8/8/8/8/8 b - - 100 80'), { fiftyMoves: false })?.reason).toBe('checkmate')
  })
})

describe('moveNumbering', () => {
  it('reads the move number and side to move', () => {
    expect(moveNumbering(START_FEN)).toEqual({ startNumber: 1, blackFirst: false })
    expect(moveNumbering('4k3/8/8/8/8/8/8/R3K3 b - - 0 34')).toEqual({ startNumber: 34, blackFirst: true })
  })
  it('falls back to move 1 without counters', () => {
    expect(moveNumbering('4k3/8/8/8/8/8/8/R3K3 w - -')).toEqual({ startNumber: 1, blackFirst: false })
  })
})
