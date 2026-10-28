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

describe('mergeRow for the puzzle rating', () => {
  const rating = (r: number, updatedAt: number, games?: number) =>
    ({ id: 'puzzleRating', value: { rating: r, rd: 80, vol: 0.06, ...(games === undefined ? {} : { games }) }, updatedAt }) as unknown as SyncRow
  it('keeps the copy that counted more games, even if older', () => {
    expect(mergeRow('kv', rating(1500, 1, 30), rating(1400, 9, 31))).toEqual(rating(1400, 9, 31))
    const kept = mergeRow('kv', rating(1500, 1, 40), rating(1400, 9, 31)) as unknown as { value: { rating: number }; updatedAt: number }
    expect(kept.value.rating).toBe(1500)
    // re-stamped so it is pushed over the server copy
    expect(kept.updatedAt).toBeGreaterThan(9)
    expect(mergeRow('kv', rating(1500, 9, 40), rating(1400, 1, 31))).toBeNull()
  })
  it('falls back to last write wins without a count', () => {
    expect(mergeRow('kv', rating(1500, 1), rating(1400, 9, 3))).toEqual(rating(1400, 9, 3))
    expect(mergeRow('kv', rating(1500, 9, 3), rating(1400, 1))).toBeNull()
  })
})

describe('mergeRow for lesson progress', () => {
  const p = (stepsDone: number, completed: boolean, updatedAt: number) => ({ id: 'l1', lessonId: 'l1', stepsDone, completed, updatedAt }) as unknown as SyncRow
  it('never moves progress backwards', () => {
    const kept = mergeRow('lessonProgress', p(5, true, 1), p(2, false, 9)) as unknown as { stepsDone: number; completed: boolean; updatedAt: number }
    expect(kept).toMatchObject({ stepsDone: 5, completed: true })
    expect(kept.updatedAt).toBeGreaterThan(9)
  })
  it('combines steps from one side with completion from the other', () => {
    expect(mergeRow('lessonProgress', p(1, true, 1), p(4, false, 9))).toMatchObject({ stepsDone: 4, completed: true })
  })
  it('takes a remote copy that is ahead, and ignores an identical one', () => {
    expect(mergeRow('lessonProgress', p(2, false, 9), p(4, false, 1))).toEqual(p(4, false, 1))
    expect(mergeRow('lessonProgress', p(4, false, 9), p(4, false, 1))).toBeNull()
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
