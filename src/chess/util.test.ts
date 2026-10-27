import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { canMate, positionProblem, timeoutResult } from './util'

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
