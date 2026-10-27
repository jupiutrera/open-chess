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
