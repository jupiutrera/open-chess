import type { SupabaseClient, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { EntityTable } from 'dexie'
import i18n from 'i18next'
import { db, SYNC_TABLES, type SyncRow } from '../db/db'
import { mergeRow } from './merge'
import { serialRunner } from './runner'
import { backupSettings, settingsPatch, useSettings } from '../settings'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const syncConfigured = !!(url && key)

let client: Promise<SupabaseClient> | null = null
/** The Supabase SDK is only downloaded when sync is configured. */
function supabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, key!))
  return client
}

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
/**
 * account the cursors and the local data belong to: another account must start from scratch,
 * and must not receive that data without asking. Kept after a sign-out that keeps the data.
 */
const CURSOR_USER_KEY = 'oc-sync-user'

function resetCursors() {
  // a sync in flight read the old cursors: it must not write them back
  runner.invalidate()
  localStorage.removeItem(PUSH_KEY)
  localStorage.removeItem(PULL_SEQ_KEY)
  localStorage.removeItem(PULL_TS_KEY)
}

function table(name: string) {
  return db[name as (typeof SYNC_TABLES)[number]] as unknown as EntityTable<SyncRow, 'id'>
}

const runner = serialRunner(doSync, () => !!useSync.getState().user)

/** Pushes local changes, then pulls remote ones. Last write (updatedAt) wins. */
export function syncNow(): Promise<void> {
  if (!syncConfigured || !useSync.getState().user) return Promise.resolve()
  return runner.run()
}

/** `stale` turns true when the cursors were reset meanwhile: then nothing more is written. */
async function doSync(stale: () => boolean) {
  const sb = await supabase()
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
    if (stale()) return
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
      if (stale()) return
      if (!data?.length) break
      const page = data as { tbl: string; id: string; data: SyncRow; updated_at: number; server_ts: string; seq: number }[]
      const byTable = new Map<string, SyncRow[]>()
      for (const r of page) {
        if (!SYNC_TABLES.includes(r.tbl as never)) continue
        let rows = byTable.get(r.tbl)
        if (!rows) byTable.set(r.tbl, (rows = []))
        rows.push({ ...r.data, id: r.id, updatedAt: r.updated_at })
      }
      // one transaction per page: a local write can't land between reading a row and merging over it
      const applied = await db.transaction('rw', SYNC_TABLES.map(table), async () => {
        if (stale()) return false
        for (const [name, remote] of byTable) {
          const t = table(name)
          const local = await t.bulkGet(remote.map((r) => r.id))
          const keep = remote.flatMap((r, i) => mergeRow(name, local[i], r) ?? [])
          if (keep.length) await t.bulkPut(keep)
        }
        return true
      })
      if (!applied || stale()) return
      for (const r of page) {
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
  if (!syncConfigured) return () => {}
  let stopped = false
  let unsubscribe = () => {}
  void supabase().then((sb) => {
    if (stopped) return
    let chain = Promise.resolve()
    let declined: string | null = null
    const onSession = async (user: User | null) => {
      const prev = useSync.getState().user
      if (stopped || (user && user.id === declined)) return
      const owner = localStorage.getItem(CURSOR_USER_KEY)
      if (user && user.id !== prev?.id && owner && owner !== user.id && (await hasLocalData()) && !window.confirm(i18n.t('profile.foreignData'))) {
        // the data here belongs to another account: don't upload it into this one
        declined = user.id
        await sb.auth.signOut()
        return
      }
      if (!user) declined = null
      useSync.setState({ user })
      if (user && owner !== user.id) {
        // a different account (even without a sign-out in between) must not reuse the cursors
        resetCursors()
        localStorage.setItem(CURSOR_USER_KEY, user.id)
      }
      if (user && user.id !== prev?.id) void syncNow()
    }
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      // auth calls inside this callback deadlock: handle it afterwards, one event at a time
      setTimeout(() => (chain = chain.then(() => onSession(session?.user ?? null)).catch(() => undefined)), 0)
    })
    unsubscribe = () => sub.subscription.unsubscribe()
  })
  const onOnline = () => void syncNow()
  const onHide = () => document.visibilityState === 'hidden' && void syncNow()
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onHide)
  const timer = setInterval(() => void syncNow(), 3 * 60_000)
  return () => {
    stopped = true
    unsubscribe()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onHide)
    clearInterval(timer)
  }
}

export async function signInWithEmail(email: string) {
  if (!syncConfigured) throw new Error('sync not configured')
  const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  if (error) throw error
}

export async function signInWithGoogle() {
  if (!syncConfigured) throw new Error('sync not configured')
  const { error } = await (await supabase()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
  if (error) throw error
}

async function hasLocalData() {
  for (const name of SYNC_TABLES) if (await table(name).filter((r) => !r.deleted).first()) return true
  return false
}

/**
 * Signs out. The user may also erase the synced data from this device (after a last sync, so nothing
 * is lost); data that stays is remembered as this account's, and another account asks before taking it.
 */
export async function signOut() {
  let clear = !!useSync.getState().user && window.confirm(i18n.t('profile.signOutClear'))
  if (clear) {
    // a sync already running may be past its push: make it rerun so the last push covers everything
    runner.invalidate()
    await syncNow()
    if (useSync.getState().error) {
      window.alert(i18n.t('profile.signOutKept'))
      clear = false
    }
  }
  if (syncConfigured) await (await supabase()).auth.signOut()
  resetCursors()
  if (clear) {
    localStorage.removeItem(CURSOR_USER_KEY)
    clearDeviceState()
    // clones are local only, but they are still this account's
    await db.transaction('rw', [...SYNC_TABLES.map(table), db.clones], () => Promise.all([...SYNC_TABLES.map((name) => table(name).clear()), db.clones.clear()]))
    // in-memory caches (seen puzzles, live queries) still hold the old data
    location.reload()
  }
}

/** Account data kept outside the synced tables: games in progress, saved analysis, a partial review, usernames, the Lichess token. */
const DEVICE_KEYS = ['oc-analysis', 'oc-review-partial', 'oc-last-sync']
const DEVICE_PREFIXES = ['oc-live-', 'oc-user-']

function clearDeviceState() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '')
    for (const k of keys) if (DEVICE_KEYS.includes(k) || DEVICE_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k)
  } catch {
    /* storage unavailable */
  }
  useSettings.getState().set({ lichessToken: '' })
}

/** Full local backup as JSON (works without an account): live rows plus settings, without the Lichess token. */
export async function exportBackup(): Promise<string> {
  const out: Record<string, unknown[]> = {}
  for (const name of SYNC_TABLES) out[name] = await table(name).filter((r) => !r.deleted).toArray()
  return JSON.stringify({ app: 'open-chess', version: 1, exportedAt: Date.now(), tables: out, settings: backupSettings() })
}

/** Restores a backup in one transaction (a bad file changes nothing); newer local rows are kept. */
export async function importBackup(json: string) {
  const parsed = JSON.parse(json) as { app?: string; tables?: Record<string, unknown>; settings?: unknown }
  if (parsed?.app !== 'open-chess' || typeof parsed.tables !== 'object' || !parsed.tables) throw new Error('not an Open Chess backup')
  const rows = new Map<string, SyncRow[]>()
  for (const name of SYNC_TABLES) {
    const list = parsed.tables[name] ?? []
    if (!Array.isArray(list)) throw new Error(`bad table ${name}`)
    for (const r of list as SyncRow[]) if (typeof r?.id !== 'string' || typeof r.updatedAt !== 'number') throw new Error(`bad row in ${name}`)
    rows.set(name, list as SyncRow[])
  }
  await db.transaction('rw', SYNC_TABLES.map(table), async () => {
    for (const [name, list] of rows) {
      const local = await table(name).bulkGet(list.map((r) => r.id))
      const write = list.flatMap((row, i) => {
        const l = local[i]
        if (!l || l.updatedAt < row.updatedAt) return [row]
        // deleted here after the backup was made: restoring means bringing it back, so it must beat the tombstone
        if (l.deleted && !row.deleted) return [{ ...row, updatedAt: Date.now() }]
        return []
      })
      await table(name).bulkPut(write)
    }
  })
  // older backups have no settings; the token, if any, never came from a file
  const settings = useSettings.getState()
  settings.set(settingsPatch(parsed.settings, settings))
  // restored rows keep their old updatedAt, which can be below the push cursor: push everything once
  runner.invalidate()
  localStorage.removeItem(PUSH_KEY)
  void syncNow()
}
