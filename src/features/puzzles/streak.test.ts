import { describe, expect, it } from 'vitest'
import { STREAK_MARGIN, STREAK_STEP, streakTarget } from './streak'

describe('streakTarget', () => {
  it('starts below the user rating and climbs with each puzzle', () => {
    expect(streakTarget(1500, 0)).toBe(1500 - STREAK_MARGIN)
    expect(streakTarget(1500, 10)).toBe(1500 - STREAK_MARGIN + 10 * STREAK_STEP)
    expect(streakTarget(1500, 11)).toBeGreaterThan(streakTarget(1500, 10))
  })
  it('never starts below the easiest puzzles', () => {
    expect(streakTarget(700, 0)).toBe(600)
    expect(streakTarget(700, 1)).toBe(600 + STREAK_STEP)
  })
})
