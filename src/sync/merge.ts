import type { LessonProgressRow, SyncRow } from '../db/db'

/** kv rows holding records ("best of"): merged by taking the max per key instead of last write wins. */
const MAX_MERGED = new Set(['rushBest'])

/**
 * A timestamp for a merge that must be pushed back: newer than both copies even when the other
 * device's clock runs ahead, since the server ignores rows that aren't newer than what it holds.
 */
const pushBack = (local: SyncRow, remote: SyncRow) => Math.max(Date.now(), local.updatedAt + 1, remote.updatedAt + 1)

/** The row to keep when a remote row arrives; null keeps the local one. */
export function mergeRow(tbl: string, local: SyncRow | undefined, remote: SyncRow): SyncRow | null {
  if (local && tbl === 'kv' && MAX_MERGED.has(remote.id) && !local.deleted && !remote.deleted) {
    const a = ((local as unknown as { value?: Record<string, number> }).value ?? {}) as Record<string, number>
    const b = ((remote as unknown as { value?: Record<string, number> }).value ?? {}) as Record<string, number>
    const value: Record<string, number> = { ...a }
    for (const [k, v] of Object.entries(b)) value[k] = Math.max(v, value[k] ?? 0)
    const sameAsRemote = Object.keys(value).every((k) => value[k] === b[k])
    // a merge that differs from the server must be pushed back, so it gets a fresh timestamp
    return { ...remote, value, updatedAt: sameAsRemote ? remote.updatedAt : pushBack(local, remote) } as SyncRow
  }
  if (local && tbl === 'kv' && remote.id === 'puzzleRating' && !local.deleted && !remote.deleted) {
    // the rating is one Glicko state, so two devices' results can't be combined: keep the copy that has
    // counted more games (each device starts from the last synced one). Without a count: last write wins.
    const games = (r: SyncRow) => (r as unknown as { value?: { games?: unknown } }).value?.games
    const l = games(local)
    const r = games(remote)
    if (typeof l === 'number' && typeof r === 'number' && l !== r) {
      if (r > l) return remote
      // the server copy lost to ours: push ours back
      return local.updatedAt < remote.updatedAt ? { ...local, updatedAt: pushBack(local, remote) } : null
    }
  }
  if (local && tbl === 'lessonProgress' && !local.deleted && !remote.deleted) {
    // progress only moves forward, like LessonPlayer's own save
    const l = local as LessonProgressRow
    const r = remote as LessonProgressRow
    const stepsDone = Math.max(l.stepsDone ?? 0, r.stepsDone ?? 0)
    const completed = !!l.completed || !!r.completed
    const sameAsRemote = stepsDone === r.stepsDone && completed === !!r.completed
    const sameAsLocal = stepsDone === l.stepsDone && completed === !!l.completed
    if (sameAsRemote && !sameAsLocal) return remote
    // the server copy is behind: the merge gets a fresh timestamp so it is pushed back
    if (!sameAsRemote) return { ...(sameAsLocal ? l : r), stepsDone, completed, updatedAt: pushBack(l, r) } as SyncRow
  }
  if (tbl === 'games' && local && !local.deleted && !remote.deleted) {
    // the same game imported on two devices shares its id: keep a review either side has
    const l = local as SyncRow & { review?: unknown; pgn?: string }
    const r = remote as SyncRow & { review?: unknown; pgn?: string }
    if (l.updatedAt < r.updatedAt && !r.review && l.review && l.pgn === r.pgn) return { ...r, review: l.review, updatedAt: pushBack(l, r) } as SyncRow
    if (l.updatedAt >= r.updatedAt && !l.review && r.review && l.pgn === r.pgn) return { ...l, review: r.review, updatedAt: pushBack(l, r) } as SyncRow
  }
  return !local || local.updatedAt < remote.updatedAt ? remote : null
}
