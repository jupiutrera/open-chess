import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { EntityTable } from 'dexie'
import { db, SYNC_TABLES, type SyncRow } from '../db/db'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const syncConfigured = !!supabase

interface SyncState {
  user: User | null
  syncing: boolean
  lastSync: number | null
  error: string | null
}

export const useSync = create<SyncState>(() => ({
  user: null,
  syncing: false,
  lastSync: Number(localStorage.getItem('oc-last-sync')) || null,
  error: null,
}))

const PUSH_KEY = 'oc-sync-push'
/** last pulled seq, and the server_ts of that row */
const PULL_SEQ_KEY = 'oc-sync-pull-seq'
const PULL_TS_KEY = 'oc-sync-pull-ts'
/** rows committed late can carry a seq below the cursor; re-read this window to catch them */
const PULL_OVERLAP_MS = 2 * 60_000

function table(name: string) {
  return db[name as (typeof SYNC_TABLES)[number]] as unknown as EntityTable<SyncRow, 'id'>
}

let running: Promise<void> | null = null

/** Pushes local changes, then pulls remote ones. Last write (updatedAt) wins. */
export function syncNow(): Promise<void> {
  if (!supabase || !useSync.getState().user) return Promise.resolve()
  running ??= doSync().finally(() => (running = null))
  return running
}

async function doSync() {
  const sb = supabase!
  useSync.setState({ syncing: true, error: null })
  try {
    const lastPush = Number(localStorage.getItem(PUSH_KEY)) || 0
    const pushStart = Date.now()
    for (const name of SYNC_TABLES) {
      const rows = await table(name).where('updatedAt').above(lastPush).toArray()
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((r) => ({
          tbl: name,
          id: r.id,
          data: r,
          updated_at: r.updatedAt,
          deleted: !!r.deleted,
        }))
        const { error } = await sb.from('records').upsert(chunk, { onConflict: 'user_id,tbl,id' })
        if (error) throw error
      }
    }
    localStorage.setItem(PUSH_KEY, String(pushStart))

    let cursor = Number(localStorage.getItem(PULL_SEQ_KEY)) || 0
    let lastTs = localStorage.getItem(PULL_TS_KEY)
    let first = true
    for (;;) {
      let q = sb.from('records').select('tbl,id,data,updated_at,server_ts,seq')
      // the first page also re-reads recent rows, in case one committed behind the cursor
      q = first && lastTs ? q.or(`seq.gt.${cursor},server_ts.gt.${new Date(Date.parse(lastTs) - PULL_OVERLAP_MS).toISOString()}`) : q.gt('seq', cursor)
      first = false
      const { data, error } = await q.order('seq', { ascending: true }).limit(500)
      if (error) throw error
      if (!data?.length) break
      for (const r of data as { tbl: string; id: string; data: SyncRow; updated_at: number; server_ts: string; seq: number }[]) {
        if (SYNC_TABLES.includes(r.tbl as never)) {
          const t = table(r.tbl)
          const local = await t.get(r.id)
          if (!local || local.updatedAt < r.updated_at) await t.put({ ...r.data, updatedAt: r.updated_at })
        }
        if (r.seq > cursor) {
          cursor = r.seq
          lastTs = r.server_ts
        }
      }
      localStorage.setItem(PULL_SEQ_KEY, String(cursor))
      if (lastTs) localStorage.setItem(PULL_TS_KEY, lastTs)
      if (data.length < 500) break
    }
    const now = Date.now()
    localStorage.setItem('oc-last-sync', String(now))
    useSync.setState({ lastSync: now })
  } catch (e) {
    useSync.setState({ error: e instanceof Error ? e.message : String(e) })
  } finally {
    useSync.setState({ syncing: false })
  }
}

/** Wires auth state and periodic sync; returns a cleanup. */
export function startSync(): () => void {
  if (!supabase) return () => {}
  const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
    const user = session?.user ?? null
    const prev = useSync.getState().user
    useSync.setState({ user })
    if (user && user.id !== prev?.id) void syncNow()
  })
  const onOnline = () => void syncNow()
  const onHide = () => document.visibilityState === 'hidden' && void syncNow()
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onHide)
  const timer = setInterval(() => void syncNow(), 3 * 60_000)
  return () => {
    sub.subscription.unsubscribe()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onHide)
    clearInterval(timer)
  }
}

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('sync not configured')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  if (error) throw error
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('sync not configured')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
  localStorage.removeItem(PUSH_KEY)
  localStorage.removeItem(PULL_SEQ_KEY)
  localStorage.removeItem(PULL_TS_KEY)
}

/** Full local backup as JSON (works without an account). */
export async function exportBackup(): Promise<string> {
  const out: Record<string, unknown[]> = {}
  for (const name of SYNC_TABLES) out[name] = await table(name).toArray()
  return JSON.stringify({ app: 'open-chess', version: 1, exportedAt: Date.now(), tables: out })
}

export async function importBackup(json: string) {
  const parsed = JSON.parse(json) as { app: string; tables: Record<string, SyncRow[]> }
  if (parsed.app !== 'open-chess') throw new Error('not an Open Chess backup')
  for (const name of SYNC_TABLES) {
    for (const row of parsed.tables[name] ?? []) {
      const local = await table(name).get(row.id)
      if (!local || local.updatedAt < row.updatedAt) await table(name).put(row)
    }
  }
}
