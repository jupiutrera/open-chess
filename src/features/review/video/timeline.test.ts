import { describe, expect, it } from 'vitest'
import type { Quality } from '../classify'
import { buildTimeline, landings, momentAt, shownPlies, totalMs } from './timeline'

const q = (...list: Quality[]) => list

describe('video timeline', () => {
  const game = q('book', 'book', 'good', 'blunder', 'best', 'great')

  it('shows every move, or only the key ones', () => {
    expect(shownPlies(game, 'all')).toEqual([1, 2, 3, 4, 5, 6])
    expect(shownPlies(game, 'key')).toEqual([4, 6])
    // nothing stands out: the whole game rather than an empty clip
    expect(shownPlies(q('good', 'best'), 'key')).toEqual([1, 2])
  })

  it('opens with a title, closes with the result, and holds key moments longer', () => {
    const beats = buildTimeline(game, 'all', 'normal')
    expect(beats[0].kind).toBe('intro')
    expect(beats.at(-1)!.kind).toBe('outro')
    const blunder = beats.find((b) => b.ply === 4)!
    const good = beats.find((b) => b.ply === 3)!
    expect(blunder.hold).toBeGreaterThan(good.hold)
    // consecutive moves need no lead-in
    expect(beats.filter((b) => b.kind === 'move').every((b) => b.lead === 0)).toBe(true)
  })

  it('leads into a key moment from the position before it', () => {
    const beats = buildTimeline(game, 'key', 'normal')
    expect(beats.filter((b) => b.kind === 'move').every((b) => b.lead > 0)).toBe(true)
  })

  it('scales with the speed', () => {
    expect(totalMs(buildTimeline(game, 'all', 'fast'))).toBeLessThan(totalMs(buildTimeline(game, 'all', 'normal')))
    expect(totalMs(buildTimeline(game, 'all', 'slow'))).toBeGreaterThan(totalMs(buildTimeline(game, 'all', 'normal')))
  })

  it('says what is on screen at any time, and when it is over', () => {
    const beats = buildTimeline(game, 'key', 'normal')
    expect(momentAt(beats, 0)).toMatchObject({ phase: 'intro', progress: 0 })
    const first = beats[1]
    expect(momentAt(beats, first.start + 1)?.phase).toBe('lead')
    expect(momentAt(beats, first.start + first.lead + 1)?.phase).toBe('move')
    expect(momentAt(beats, first.start + first.lead + first.move + 1)?.phase).toBe('hold')
    expect(momentAt(beats, totalMs(beats))).toBeNull()
  })

  it('lands each move once, in order, for its sound', () => {
    const marks = landings(buildTimeline(game, 'all', 'normal'))
    expect(marks.map((m) => m.ply)).toEqual([1, 2, 3, 4, 5, 6])
    expect(marks.every((m, i) => i === 0 || m.at > marks[i - 1].at)).toBe(true)
  })
})
