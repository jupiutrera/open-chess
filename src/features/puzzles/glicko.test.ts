import { describe, expect, it } from 'vitest'
import { DEFAULT_GLICKO, updateGlicko } from './glicko'
import { sm2 } from '../openings/repertoire'

describe('glicko-2', () => {
  it('solving raises the rating, failing lowers it', () => {
    expect(updateGlicko(DEFAULT_GLICKO, 1200, 80, 1).rating).toBeGreaterThan(1200)
    expect(updateGlicko(DEFAULT_GLICKO, 1200, 80, 0).rating).toBeLessThan(1200)
  })
  it('beating a harder puzzle is worth more', () => {
    const easy = updateGlicko(DEFAULT_GLICKO, 900, 80, 1).rating
    const hard = updateGlicko(DEFAULT_GLICKO, 1600, 80, 1).rating
    expect(hard).toBeGreaterThan(easy)
  })
  it('deviation shrinks as results come in', () => {
    let g = DEFAULT_GLICKO
    for (let i = 0; i < 10; i++) g = updateGlicko(g, 1200, 80, (i % 2) as 0 | 1)
    expect(g.rd).toBeLessThan(DEFAULT_GLICKO.rd)
  })
})

describe('sm-2', () => {
  const fresh = { ease: 2.5, interval: 0, reps: 0 }
  it('intervals grow with correct answers', () => {
    const a = sm2(fresh, 4, 0)
    const b = sm2(a, 4, 0)
    const c = sm2(b, 4, 0)
    expect([a.interval, b.interval]).toEqual([1, 3])
    expect(c.interval).toBeGreaterThan(3)
  })
  it('a miss resets the card and brings it back soon', () => {
    const r = sm2({ ease: 2.5, interval: 10, reps: 4 }, 1, 0)
    expect(r.reps).toBe(0)
    expect(r.due).toBeLessThan(60 * 60_000)
  })
})
