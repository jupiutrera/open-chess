import { describe, expect, it } from 'vitest'
import { timeControl } from './timeControl'

describe('timeControl', () => {
  it('finds presets', () => {
    expect(timeControl('3+2')).toMatchObject({ base: 180, inc: 2 })
  })
  it('parses custom clocks and clamps them', () => {
    expect(timeControl('7+3')).toMatchObject({ id: '7+3', base: 420, inc: 3, label: '7 | 3' })
    expect(timeControl('999+99')).toMatchObject({ base: 180 * 60, inc: 60 })
  })
  it('falls back to no clock', () => {
    expect(timeControl('nonsense').base).toBe(0)
    expect(timeControl(null).base).toBe(0)
  })
})
