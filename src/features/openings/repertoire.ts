import { Chess } from 'chess.js'
import { db, put, softDelete, type RepertoireRow } from '../../db/db'
import { epd } from '../../chess/util'

const DAY = 86_400_000

/** SM-2 quality of an answer: a quick correct one is easy (5) so the ease can recover after failures. */
export function answerQuality(correct: boolean, ms: number): number {
  if (!correct) return 2
  return ms < 6000 ? 5 : 4
}

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

/**
 * One card per side and position, with the same id on every device (the EPD has no move counters),
 * so adding a line on two devices syncs into one card instead of two.
 */
export function cardId(color: 'w' | 'b', key: string): string {
  return `rep:${color}:${key}`
}

/** A fresh schedule: a different move at a position is a new card to learn. */
const fresh = () => ({ ease: 2.5, interval: 0, reps: 0, due: Date.now() })

/** Moves `color` plays in a line (SAN, from the start position), by EPD of the position before each. */
export function lineMoves(line: string, color: 'w' | 'b'): Map<string, { san: string; uci: string }> {
  const out = new Map<string, { san: string; uci: string }>()
  const c = new Chess()
  for (const san of line.split(' ').filter(Boolean)) {
    const key = epd(c.fen())
    const toMove = c.turn()
    let m
    try {
      m = c.move(san)
    } catch {
      break
    }
    if (toMove === color && !out.has(key)) out.set(key, { san: m.san, uci: m.from + m.to + (m.promotion ?? '') })
  }
  return out
}

/**
 * Collapses live cards for the same side and position into the canonical-id one. Older versions gave
 * each card a random id, so two devices could hold duplicates; the most recently updated copy wins.
 */
export function dedupeCards(rows: RepertoireRow[]): { keep: RepertoireRow[]; write: RepertoireRow[]; remove: string[] } {
  const groups = new Map<string, RepertoireRow[]>()
  for (const r of rows) {
    if (r.deleted) continue
    const id = cardId(r.color, r.epd)
    groups.set(id, [...(groups.get(id) ?? []), r])
  }
  const keep: RepertoireRow[] = []
  const write: RepertoireRow[] = []
  const remove: string[] = []
  for (const [id, group] of groups) {
    const winner = group.find((r) => r.id === id) ?? group.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
    const card = winner.id === id ? winner : { ...winner, id }
    keep.push(card)
    if (card !== winner) write.push(card)
    for (const r of group) if (r.id !== id) remove.push(r.id)
  }
  return { keep, write, remove }
}

/** Live cards of one side, migrating duplicates to their canonical id on the way. */
async function cardsOf(color: 'w' | 'b'): Promise<RepertoireRow[]> {
  return db.transaction('rw', db.repertoire, async () => {
    const { keep, write, remove } = dedupeCards(await db.repertoire.where('color').equals(color).toArray())
    for (const card of write) await put<RepertoireRow>('repertoire', card)
    for (const id of remove) await softDelete('repertoire', id)
    return keep
  })
}

/**
 * Adds every move of `color` in the line (from the start position, as lineMoves replays it to find
 * cards shared between lines) as a card; returns how many were new.
 */
export async function addLine(sans: string[], color: 'w' | 'b'): Promise<number> {
  return db.transaction('rw', db.repertoire, async () => {
    const c = new Chess()
    const lineText = sans.join(' ')
    let added = 0
    for (const san of sans) {
      const fen = c.fen()
      const toMove = c.turn()
      const m = c.move(san)
      if (toMove !== color) continue
      const key = epd(fen)
      const id = cardId(color, key)
      const uci = m.from + m.to + (m.promotion ?? '')
      const live = await db.repertoire.where('epd').equals(key).filter((r) => r.color === color && !r.deleted).toArray()
      // every copy of this position (old random ids too) folds into the canonical card
      for (const r of live) if (r.id !== id) await softDelete('repertoire', r.id)
      const existing = live.find((r) => r.id === id) ?? live.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (existing) {
        if (existing.san !== m.san) await put<RepertoireRow>('repertoire', { ...existing, id, san: m.san, uci, line: lineText, ...fresh() })
        else if (existing.id !== id) await put<RepertoireRow>('repertoire', { ...existing, id })
        continue
      }
      // a fresh row: it also replaces a soft-deleted card with this id
      await put<RepertoireRow>('repertoire', { id, color, epd: key, fen, san: m.san, uci, line: lineText, ...fresh() })
      added++
    }
    return added
  })
}

/**
 * What removing one line (as grouped by its stored text) changes: cards still on another line stay,
 * moved over to that line (and to its move, if it plays a different one there); the rest are deleted.
 */
export function planLineRemoval(rows: RepertoireRow[], line: string, color: 'w' | 'b'): { remove: string[]; update: RepertoireRow[] } {
  const live = rows.filter((r) => r.color === color && !r.deleted)
  const used = new Map<string, { san: string; uci: string; line: string }>()
  for (const other of new Set(live.map((r) => r.line))) {
    if (other === line) continue
    for (const [key, m] of lineMoves(other, color)) if (!used.has(key)) used.set(key, { ...m, line: other })
  }
  const remove: string[] = []
  const update: RepertoireRow[] = []
  for (const r of live) {
    if (r.line !== line) continue
    const u = used.get(r.epd)
    if (!u) remove.push(r.id)
    else update.push(u.san === r.san ? { ...r, line: u.line } : { ...r, san: u.san, uci: u.uci, line: u.line, ...fresh() })
  }
  return { remove, update }
}

export async function removeLine(line: string, color: 'w' | 'b') {
  await db.transaction('rw', db.repertoire, async () => {
    const { remove, update } = planLineRemoval(await cardsOf(color), line, color)
    for (const id of remove) await softDelete('repertoire', id)
    for (const card of update) await put<RepertoireRow>('repertoire', card)
  })
}

export async function dueCards(color: 'w' | 'b'): Promise<RepertoireRow[]> {
  const now = Date.now()
  const rows = (await cardsOf(color)).filter((r) => r.due <= now)
  // shallow positions first so lines are learned in order
  return rows.sort((a, b) => Number(a.fen.split(' ')[5]) - Number(b.fen.split(' ')[5]) || a.due - b.due)
}

export async function grade(card: RepertoireRow, quality: number) {
  await put<RepertoireRow>('repertoire', { ...card, ...sm2(card, quality) })
}
