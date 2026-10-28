import { describe, expect, it } from 'vitest'
import { externalCovers } from './useAssist'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const line = (multipv: number) => ({ multipv, depth: 14, score: { cp: 20 }, pv: ['e2e4'] })

describe('externalCovers', () => {
  it('takes outside lines once they are deep enough and have a second line', () => {
    expect(externalCovers({ fen: start, lines: [line(1), line(2)], depth: 14, done: false }, start)).toBe(true)
    expect(externalCovers({ fen: start, lines: [line(1), line(2)], depth: 8, done: false }, start)).toBe(false)
    expect(externalCovers({ fen: start, lines: [line(1)], depth: 14, done: false }, start)).toBe(false)
  })
  it('a finished search counts even if short of the depth', () => {
    expect(externalCovers({ fen: start, lines: [line(1), line(2)], depth: 6, done: true }, start)).toBe(true)
  })
  it('one line is enough when there is only one legal move', () => {
    const fen = 'k7/8/1K6/8/8/8/8/7R b - - 0 1'
    expect(externalCovers({ fen, lines: [line(1)], depth: 14, done: false }, fen)).toBe(true)
  })
  it('never uses lines of another position', () => {
    expect(externalCovers({ fen: start, lines: [line(1), line(2)], depth: 20, done: true }, start.replace(' w ', ' b '))).toBe(false)
    expect(externalCovers(undefined, start)).toBe(false)
  })
})
