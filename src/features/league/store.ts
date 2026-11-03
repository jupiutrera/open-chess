import { useLiveQuery } from 'dexie-react-hooks'
import { db, kvGet, kvSet } from '../../db/db'
import type { LeagueState } from './league'

const KEY = 'league'

/** A stored league as it can come back (another version, or synced): unusable shapes read as none. */
function sound(v: unknown): LeagueState | null {
  const s = v as LeagueState | null
  if (!s || typeof s.rating?.rating !== 'number' || typeof s.rating.rd !== 'number' || !Array.isArray(s.games)) return null
  return s
}

export async function loadLeague(): Promise<LeagueState | null> {
  return sound(await kvGet<unknown>(KEY, null))
}

/** Applies `fn` to the stored league (none yet: nothing happens) and returns what was saved. */
export async function updateLeague(fn: (s: LeagueState) => LeagueState): Promise<LeagueState | null> {
  return db.transaction('rw', db.kv, async () => {
    const s = await loadLeague()
    if (!s) return null
    const next = fn(s)
    if (next !== s) await kvSet(KEY, next)
    return next
  })
}

export async function saveLeague(s: LeagueState) {
  await kvSet(KEY, s)
}

/** The league, live: undefined while loading, null before the first visit. */
export function useLeague(): LeagueState | null | undefined {
  return useLiveQuery(async () => {
    const row = await db.kv.get(KEY)
    return sound(row && !row.deleted ? row.value : null)
  }, [])
}
