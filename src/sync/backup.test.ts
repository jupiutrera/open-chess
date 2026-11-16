import { describe, expect, it } from 'vitest'
import { readBackupClones } from './backup'

const clone = { id: 'c1', name: 'ana', source: 'lichess', username: 'ana', period: 'year', createdAt: 5, games: 10, elo: 1500, book: {} }

describe('readBackupClones', () => {
  it('accepts backups made before clones were included', () => {
    expect(readBackupClones(undefined)).toEqual([])
  })
  it('returns valid clone rows', () => {
    expect(readBackupClones([clone])).toEqual([clone])
  })
  it('rejects anything that is not a list of clone rows', () => {
    expect(() => readBackupClones({})).toThrow()
    expect(() => readBackupClones([{ ...clone, id: 3 }])).toThrow()
    expect(() => readBackupClones([{ ...clone, book: null }])).toThrow()
    expect(() => readBackupClones([null])).toThrow()
  })
})
