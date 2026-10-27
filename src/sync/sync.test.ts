import { describe, expect, it } from 'vitest'
import { mergeRow } from './merge'
import type { SyncRow } from '../db/db'

const kv = (value: Record<string, number>, updatedAt: number) => ({ id: 'rushBest', value, updatedAt }) as unknown as SyncRow

describe('mergeRow', () => {
  it('last write wins for ordinary rows', () => {
    const local = { id: 'a', updatedAt: 5 }
    expect(mergeRow('games', local, { id: 'a', updatedAt: 9 })).toEqual({ id: 'a', updatedAt: 9 })
    expect(mergeRow('games', local, { id: 'a', updatedAt: 1 })).toBeNull()
    expect(mergeRow('games', undefined, { id: 'a', updatedAt: 1 })).toEqual({ id: 'a', updatedAt: 1 })
  })
  it('keeps the best Rush score of each device', () => {
    const merged = mergeRow('kv', kv({ '3': 30, '5': 10 }, 1), kv({ '3': 25, survival: 8 }, 2)) as unknown as { value: Record<string, number> }
    expect(merged.value).toEqual({ '3': 30, '5': 10, survival: 8 })
  })
})

describe('mergeRow for games', () => {
  const g = (updatedAt: number, review?: object) => ({ id: 'x-1', pgn: '1. e4 *', updatedAt, ...(review ? { review } : {}) }) as unknown as SyncRow
  it('keeps a local review when the same game is re-imported elsewhere', () => {
    const kept = mergeRow('games', g(1, { depth: 14 }), g(5)) as unknown as { review?: object; updatedAt: number }
    expect(kept.review).toEqual({ depth: 14 })
    expect(kept.updatedAt).toBeGreaterThan(5)
  })
  it('takes a remote review onto a newer local copy without one', () => {
    const kept = mergeRow('games', g(9), g(5, { depth: 14 })) as unknown as { review?: object }
    expect(kept.review).toEqual({ depth: 14 })
  })
})
