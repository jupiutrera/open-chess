import { describe, expect, it } from 'vitest'
import {
  RIVAL_PORTRAITS,
  findRival,
  isProvisional,
  meetAgain,
  newLeague,
  parseRivalId,
  recentRivals,
  record,
  recordResult,
  rivalBot,
  rivalId,
  rivalProfile,
  settlePending,
} from './league'

const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('rivals', () => {
  it('rebuilds the same rival from its seed', () => {
    expect(rivalProfile(12345)).toEqual(rivalProfile(12345))
    expect(rivalProfile(12345).handle).not.toBe(rivalProfile(54321).handle)
  })

  it('gives every rival a portrait, a book and a known style', () => {
    for (let seed = 1; seed < 200; seed++) {
      const p = rivalProfile(seed)
      expect(p.portrait).toBeGreaterThanOrEqual(0)
      expect(p.portrait).toBeLessThan(RIVAL_PORTRAITS)
      expect(p.book.white?.length).toBeGreaterThan(0)
      expect(['balanced', 'aggressive', 'solid', 'simplifier', 'tricky']).toContain(p.style)
      expect(p.handle).toMatch(/^[A-Z][a-z]+(_?\d+)?$/)
    }
  })

  it('finds rivals within 150 of the rating, inside the playable range', () => {
    expect(findRival(1500, seq(0.5, 0)).elo).toBe(1350)
    expect(findRival(1500, seq(0.5, 0.9999)).elo).toBe(1650)
    expect(findRival(100, seq(0.5, 0)).elo).toBe(250)
  })

  it('round-trips the id and builds a bot that plays the rival', () => {
    const r = { seed: 77, elo: 1430 }
    expect(parseRivalId(rivalId(r))).toEqual(r)
    expect(parseRivalId('ivan')).toBeNull()
    const bot = rivalBot(r, 'bio')
    expect(bot.id).toBe(rivalId(r))
    expect(bot.elo).toBe(1430)
    expect(bot.league).toEqual(r)
    expect(bot.playStyle).toBe(rivalProfile(77).style)
  })

  it('meets an old rival again near the user, but no further than 100 from before', () => {
    expect(meetAgain({ seed: 1, elo: 1200 }, 1250).elo).toBe(1250)
    expect(meetAgain({ seed: 1, elo: 1200 }, 1600).elo).toBe(1300)
    expect(meetAgain({ seed: 1, elo: 1200 }, 900).elo).toBe(1100)
  })
})

describe('rating and record', () => {
  const r = { seed: 9, elo: 1200 }

  it('a win against an equal rival raises the rating, a loss lowers it, a draw barely moves it', () => {
    const s = newLeague(1200)
    expect(recordResult(s, r, 1, { now: 1 }).rating.rating).toBeGreaterThan(1200)
    expect(recordResult(s, r, 0, { now: 1 }).rating.rating).toBeLessThan(1200)
    expect(Math.abs(recordResult(s, r, 0.5, { now: 1 }).rating.rating - 1200)).toBeLessThan(5)
  })

  it('moves the rating at most 200 on one game', () => {
    expect(recordResult(newLeague(1400), { seed: 1, elo: 800 }, 0, { now: 1 }).rating.rating).toBe(1200)
  })

  it('keeps the game on the record with the rating before and after', () => {
    const s = recordResult(newLeague(1200), r, 1, { now: 1, gameId: 'g1' })
    expect(s.games).toHaveLength(1)
    expect(s.games[0]).toMatchObject({ rival: rivalId(r), elo: 1200, score: 1, before: 1200, gameId: 'g1' })
    expect(s.games[0].after).toBe(s.rating.rating)
  })

  it('settles as provisional at first and firms up with games', () => {
    let s = newLeague(1200)
    expect(isProvisional(s.rating)).toBe(true)
    for (let i = 0; i < 25; i++) s = recordResult(s, { seed: i, elo: 1200 }, i % 2 ? 1 : 0, { now: 1 + i })
    expect(isProvisional(s.rating)).toBe(false)
  })

  it('counts a game left unfinished as lost, unless it is still there to continue', () => {
    const pending = { rival: rivalId(r), handle: 'x', elo: 1200, at: 0 }
    const s = { ...newLeague(1200), pending }
    expect(settlePending(s, rivalId(r))).toBe(s)
    const settled = settlePending(s, null, 5)
    expect(settled.pending).toBeUndefined()
    expect(settled.games[0]).toMatchObject({ score: 0, abandoned: true })
    // finishing it clears the pending mark
    expect(recordResult(s, r, 1, { now: 2 }).pending).toBeUndefined()
  })

  it('tallies the record per rival and lists recent rivals once each', () => {
    let s = newLeague(1200)
    s = recordResult(s, { seed: 1, elo: 1200 }, 1, { now: 1 })
    s = recordResult(s, { seed: 2, elo: 1250 }, 0.5, { now: 2 })
    s = recordResult(s, { seed: 1, elo: 1300 }, 0, { now: 3 })
    expect(record(s.games)).toEqual({ w: 1, d: 1, l: 1 })
    expect(record(s.games, 1)).toEqual({ w: 1, d: 0, l: 1 })
    expect(recentRivals(s.games).map((x) => x.seed)).toEqual([1, 2])
  })
})
