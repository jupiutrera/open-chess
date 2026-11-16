import { describe, expect, it } from 'vitest'
import type { SearchResult } from '../../engine/engine'
import { isCut } from './analyze'

const result = (lines: number, depth: number): SearchResult => ({
  bestmove: 'e2e4',
  lines: Array.from({ length: lines }, (_, i) => ({ multipv: i + 1, depth, score: { cp: 10 }, pv: ['e2e4'] })),
  depth,
})

describe('isCut', () => {
  it('flags a search that returned no lines', () => {
    expect(isCut(result(0, 0), 14, 5)).toBe(true)
  })
  it('flags a search stopped early below the requested depth', () => {
    expect(isCut(result(2, 6), 14, 300)).toBe(true)
  })
  it('accepts one that reached the depth, or ran out of time legitimately', () => {
    expect(isCut(result(2, 14), 14, 400)).toBe(false)
    expect(isCut(result(2, 9), 14, 1200)).toBe(false)
  })
})
