import { describe, expect, it } from 'vitest'
import { sm2 } from './repertoire'

const DAY = 86_400_000
const fresh = { ease: 2.5, interval: 0, reps: 0 }

describe('sm2', () => {
  it('schedules 1 day, 3 days, then interval × ease on correct answers', () => {
    const a = sm2(fresh, 5, 0)
    expect(a).toMatchObject({ reps: 1, interval: 1, due: DAY })
    const b = sm2(a, 5, 0)
    expect(b).toMatchObject({ reps: 2, interval: 3 })
    const c = sm2(b, 4, 0)
    expect(c.interval).toBe(Math.round(3 * b.ease))
  })

  it('resets a failed card and brings it back in ten minutes', () => {
    const r = sm2({ ease: 2.5, interval: 10, reps: 4 }, 1, 0)
    expect(r).toMatchObject({ reps: 0, interval: 0, due: 10 * 60_000 })
    expect(r.ease).toBeLessThan(2.5)
  })

  it('never lets ease drop below 1.3', () => {
    let card = fresh
    for (let i = 0; i < 20; i++) card = { ...card, ...sm2(card, 0, 0) }
    expect(card.ease).toBe(1.3)
  })
})
