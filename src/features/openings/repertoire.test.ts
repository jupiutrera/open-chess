import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { cardId, dedupeCards, lineMoves, planLineRemoval, sm2 } from './repertoire'
import { epd } from '../../chess/util'
import type { RepertoireRow } from '../../db/db'

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

/** EPD after playing `sans` from the start. */
const pos = (...sans: string[]) => {
  const c = new Chess()
  for (const s of sans) c.move(s)
  return epd(c.fen())
}
const card = (id: string, line: string, key: string, san: string, updatedAt = 1) =>
  ({ id, color: 'w', epd: key, fen: `${key} 0 1`, san, uci: '', ease: 2.5, interval: 5, due: 0, reps: 3, line, updatedAt }) as RepertoireRow
const START = pos()

describe('repertoire cards', () => {
  it('gives the same position the same id regardless of move counters', () => {
    const later = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 9')
    expect(cardId('w', epd(later.fen()))).toBe(cardId('w', START))
    expect(cardId('w', START)).not.toBe(cardId('b', START))
  })

  it('folds duplicate cards into the canonical id, keeping the newest copy', () => {
    const rows = [card('rand-1', 'e4 e5', START, 'e4', 1), card('rand-2', 'e4 c5', START, 'e4', 5)]
    const { keep, write, remove } = dedupeCards(rows)
    expect(keep).toHaveLength(1)
    expect(keep[0]).toMatchObject({ id: cardId('w', START), line: 'e4 c5' })
    expect(write).toEqual(keep)
    expect(remove.sort()).toEqual(['rand-1', 'rand-2'])
  })

  it('leaves an already canonical card alone', () => {
    const rows = [card(cardId('w', START), 'e4', START, 'e4')]
    expect(dedupeCards(rows)).toEqual({ keep: rows, write: [], remove: [] })
  })

  it('reads the moves of one side from a line', () => {
    const m = lineMoves('e4 e5 Nf3', 'w')
    expect([...m.keys()]).toEqual([START, pos('e4', 'e5')])
    expect(m.get(START)).toEqual({ san: 'e4', uci: 'e2e4' })
  })

  it('removing a line keeps the cards another line still needs', () => {
    // both lines start with 1.e4; that card was stored with the first line's text
    const rows = [
      card('a', 'e4 e5 Nf3', START, 'e4'),
      card('b', 'e4 e5 Nf3', pos('e4', 'e5'), 'Nf3'),
      card('c', 'e4 c5 Nf3', pos('e4', 'c5'), 'Nf3'),
    ]
    const { remove, update } = planLineRemoval(rows, 'e4 e5 Nf3', 'w')
    expect(remove).toEqual(['b'])
    expect(update).toEqual([{ ...rows[0], line: 'e4 c5 Nf3' }])
  })

  it('switches a kept card to the move the remaining line plays there', () => {
    // 1.e4 e5 2.Nf3 was added, then 1.d4 d5 took over the first move
    const rows = [card('a', 'd4 d5', START, 'd4'), card('b', 'e4 e5 Nf3', pos('e4', 'e5'), 'Nf3')]
    const { remove, update } = planLineRemoval(rows, 'd4 d5', 'w')
    expect(remove).toEqual([])
    expect(update[0]).toMatchObject({ id: 'a', san: 'e4', uci: 'e2e4', line: 'e4 e5 Nf3', reps: 0, interval: 0 })
  })
})
