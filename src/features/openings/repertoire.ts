import { Chess } from 'chess.js'
import { db, put, type RepertoireRow } from '../../db/db'
import { epd, uid } from '../../chess/util'

const DAY = 86_400_000

/** SM-2 scheduling. quality: 0-5 (>=3 is a pass). */
export function sm2(card: Pick<RepertoireRow, 'ease' | 'interval' | 'reps'>, quality: number, now = Date.now()) {
  let { ease, interval, reps } = card
  if (quality < 3) {
    reps = 0
    interval = 0
  } else {
    reps += 1
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease)
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  // failed cards come back in ten minutes
  const due = interval === 0 ? now + 10 * 60_000 : now + interval * DAY
  return { ease, interval, reps, due }
}

/** Adds every move of `color` in the line as a card; returns how many were new. */
export async function addLine(sans: string[], color: 'w' | 'b', startFen?: string): Promise<number> {
  const c = new Chess(startFen)
  const lineText = sans.join(' ')
  let added = 0
  for (const san of sans) {
    const fen = c.fen()
    const toMove = c.turn()
    const m = c.move(san)
    if (toMove !== color) continue
    const key = epd(fen)
    const existing = await db.repertoire.where('epd').equals(key).filter((r) => r.color === color && !r.deleted).first()
    if (existing) {
      if (existing.san !== m.san) {
        await put<RepertoireRow>('repertoire', { ...existing, san: m.san, uci: m.from + m.to + (m.promotion ?? ''), line: lineText })
      }
      continue
    }
    await put<RepertoireRow>('repertoire', {
      id: uid(),
      color,
      epd: key,
      fen,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      ease: 2.5,
      interval: 0,
      reps: 0,
      due: Date.now(),
      line: lineText,
    })
    added++
  }
  return added
}

export async function dueCards(color: 'w' | 'b'): Promise<RepertoireRow[]> {
  const now = Date.now()
  const rows = await db.repertoire.where('color').equals(color).filter((r) => !r.deleted && r.due <= now).toArray()
  // shallow positions first so lines are learned in order
  return rows.sort((a, b) => Number(a.fen.split(' ')[5]) - Number(b.fen.split(' ')[5]) || a.due - b.due)
}

export async function grade(card: RepertoireRow, quality: number) {
  await put<RepertoireRow>('repertoire', { ...card, ...sm2(card, quality) })
}
