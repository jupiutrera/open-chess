import { describe, expect, it } from 'vitest'
import { clearPartial, loadPartial, savePartial } from './partial'
import type { PositionEval } from './classify'

function memStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const fens = ['a', 'b', 'c', 'd']
const pos = (fen: string): PositionEval => ({ fen, lines: [], score: { cp: 10 } })

describe('partial review progress', () => {
  it('resumes the evaluated prefix of the same game and depth', () => {
    const s = memStore()
    savePartial('g1', 14, 'pgn', [pos('a'), pos('b')], s)
    expect(loadPartial('g1', 14, 'pgn', fens, s).map((p) => p.fen)).toEqual(['a', 'b'])
  })
  it('ignores progress for another game, depth or edited PGN', () => {
    const s = memStore()
    savePartial('g1', 14, 'pgn', [pos('a')], s)
    expect(loadPartial('g2', 14, 'pgn', fens, s)).toEqual([])
    expect(loadPartial('g1', 18, 'pgn', fens, s)).toEqual([])
    expect(loadPartial('g1', 14, 'other', fens, s)).toEqual([])
  })
  it('stops at the first position that does not match', () => {
    const s = memStore()
    savePartial('g1', 14, 'pgn', [pos('a'), pos('x'), pos('c')], s)
    expect(loadPartial('g1', 14, 'pgn', fens, s)).toHaveLength(1)
  })
  it('survives corrupt data and is cleared when done', () => {
    const s = memStore()
    s.setItem('oc-review-partial', '{nope')
    expect(loadPartial('g1', 14, 'pgn', fens, s)).toEqual([])
    savePartial('g1', 14, 'pgn', [pos('a')], s)
    clearPartial('g2', s)
    expect(loadPartial('g1', 14, 'pgn', fens, s)).toHaveLength(1)
    clearPartial('g1', s)
    expect(loadPartial('g1', 14, 'pgn', fens, s)).toEqual([])
  })
})
