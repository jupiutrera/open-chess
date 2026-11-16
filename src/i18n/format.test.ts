import { describe, expect, it } from 'vitest'
import { localDay } from './format'

describe('localDay', () => {
  it('uses the local calendar day, zero-padded', () => {
    expect(localDay(new Date(2024, 0, 5, 23, 59).getTime())).toBe('2024-01-05')
    expect(localDay(new Date(2024, 11, 31, 0, 1).getTime())).toBe('2024-12-31')
  })
})
