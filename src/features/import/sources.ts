import { Chess } from 'chess.js'
import { db, put, type GameRow } from '../../db/db'
import { openingName } from '../../db/games'

export interface RemoteGame {
  externalId: string
  source: 'chesscom' | 'lichess'
  pgn: string
  white: string
  black: string
  whiteElo?: number
  blackElo?: number
  result: GameRow['result']
  date: number
  timeControl?: string
  url?: string
}

export class NotFoundError extends Error {}
/** The site asked us to slow down (HTTP 429); Lichess wants a full minute before retrying. */
export class RateLimitError extends Error {}

async function get(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status === 404) throw new NotFoundError()
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`)
  return res
}

/** Monthly archive URLs for a chess.com user, newest first. */
export async function chesscomArchives(user: string, signal?: AbortSignal): Promise<string[]> {
  const res = await get(`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`, { signal })
  const data = (await res.json()) as { archives: string[] }
  return [...data.archives].reverse()
}

interface ChesscomGame {
  url: string
  pgn?: string
  end_time: number
  time_control: string
  rules: string
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
}

function resultFrom(w: string, b: string): GameRow['result'] {
  if (w === 'win') return '1-0'
  if (b === 'win') return '0-1'
  return '1/2-1/2'
}

/** chess.com writes daily games as "1/86400" (one move per N seconds): shown as days. */
export function chesscomTimeControl(tc: string): string {
  const daily = /^1\/(\d+)$/.exec(tc)
  return daily ? `${Math.round(Number(daily[1]) / 86400)}d` : tc
}

export async function chesscomMonth(archiveUrl: string, signal?: AbortSignal): Promise<RemoteGame[]> {
  const res = await get(archiveUrl, { signal })
  const data = (await res.json()) as { games: ChesscomGame[] }
  return data.games
    .filter((g) => g.rules === 'chess' && g.pgn)
    .map((g) => ({
      externalId: g.url,
      source: 'chesscom' as const,
      pgn: g.pgn!,
      white: g.white.username,
      black: g.black.username,
      whiteElo: g.white.rating,
      blackElo: g.black.rating,
      result: resultFrom(g.white.result, g.black.result),
      date: g.end_time * 1000,
      timeControl: chesscomTimeControl(g.time_control),
      url: g.url,
    }))
    .reverse()
}

interface LichessGame {
  id: string
  variant: string
  createdAt: number
  status: string
  winner?: 'white' | 'black'
  clock?: { initial: number; increment: number }
  players: {
    white: { user?: { name: string }; rating?: number; aiLevel?: number }
    black: { user?: { name: string }; rating?: number; aiLevel?: number }
  }
  pgn: string
}

/** Lichess statuses for games that never finished; they have no real result. */
const UNFINISHED = new Set(['created', 'started', 'aborted', 'noStart', 'unknownFinish'])

/** NDJSON lines that parse; a truncated or corrupt line is skipped, not fatal. */
function ndjsonLines(ndjson: string): LichessGame[] {
  const out: LichessGame[] = []
  for (const l of ndjson.split('\n')) {
    if (!l.trim()) continue
    try {
      out.push(JSON.parse(l) as LichessGame)
    } catch {
      // skip
    }
  }
  return out
}

/** Parses the Lichess NDJSON export, keeping finished standard games. */
export function parseLichessGames(ndjson: string): RemoteGame[] {
  return ndjsonLines(ndjson)
    .filter((g) => g.variant === 'standard' && g.pgn && !UNFINISHED.has(g.status))
    .map((g) => ({
      externalId: `lichess:${g.id}`,
      source: 'lichess' as const,
      pgn: g.pgn,
      white: g.players.white.user?.name ?? (g.players.white.aiLevel ? `Stockfish ${g.players.white.aiLevel}` : '?'),
      black: g.players.black.user?.name ?? (g.players.black.aiLevel ? `Stockfish ${g.players.black.aiLevel}` : '?'),
      whiteElo: g.players.white.rating,
      blackElo: g.players.black.rating,
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2',
      date: g.createdAt,
      timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : undefined,
      url: `https://lichess.org/${g.id}`,
    }))
}

export interface LichessPage {
  games: RemoteGame[]
  /** pass as `until` to fetch the next, older page; absent on the last page */
  next?: number
}

/** One page of a user's games, newest first, created before `until` (ms) when given. */
export async function lichessGames(user: string, until?: number, signal?: AbortSignal, max = 50): Promise<LichessPage> {
  const params = new URLSearchParams({ max: String(max), pgnInJson: 'true', clocks: 'false', evals: 'false' })
  if (until) params.set('until', String(until))
  const res = await get(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${params}`, {
    headers: { Accept: 'application/x-ndjson' },
    signal,
  })
  const text = await res.text()
  const raw = ndjsonLines(text)
  const oldest = raw.length ? raw[raw.length - 1].createdAt : undefined
  return { games: parseLichessGames(text), next: raw.length === max && oldest ? oldest - 1 : undefined }
}

/** Which of these external ids are already stored (and not deleted), looked up by index. */
export async function importedIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await db.games.where('externalId').anyOf(ids).filter((g) => !g.deleted).toArray()
  return new Set(rows.map((r) => r.externalId!))
}

/** Saves a remote game; returns the stored row (existing one if already imported). */
export async function importRemote(g: RemoteGame, username?: string): Promise<GameRow> {
  const existing = await db.games.where('externalId').equals(g.externalId).filter((r) => !r.deleted).first()
  if (existing) return existing
  const c = new Chess()
  c.loadPgn(g.pgn)
  const userColor = userColorFor(g.white, g.black, username ? [username] : [])
  return put<GameRow>('games', {
    // derived from the external id, so the same game imported on two devices syncs as one row
    id: rowIdFor(g.externalId),
    source: g.source,
    pgn: g.pgn,
    white: g.white,
    black: g.black,
    whiteElo: g.whiteElo,
    blackElo: g.blackElo,
    result: g.result,
    userColor,
    timeControl: g.timeControl,
    date: g.date,
    externalId: g.externalId,
    opening: await openingName(c),
  })
}

/** The side one of these usernames played, ignoring case; none, or both sides (a game against yourself): undefined. */
export function userColorFor(white: string | undefined, black: string | undefined, usernames: string[]): 'w' | 'b' | undefined {
  const mine = new Set(usernames.map((u) => u.trim().toLowerCase()).filter(Boolean))
  const w = !!white && mine.has(white.trim().toLowerCase())
  const b = !!black && mine.has(black.trim().toLowerCase())
  return w === b ? undefined : w ? 'w' : 'b'
}

/** A URL-safe row id for an external id (chess.com ids are URLs). */
export function rowIdFor(externalId: string): string {
  return 'x-' + externalId.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-zA-Z0-9]+/g, '-')
}

/** FNV-1a 32-bit. Only kept to recognise games imported before `hash64`. */
function legacyHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

/** 64-bit hash (two independent 32-bit lanes, cyrb53-style mixing) for a stable PGN game id. */
export function hash64(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0')
}

/** What makes two PGN games "the same game": the main tags plus the full mainline. */
export function pgnIdentity(h: Record<string, string | undefined>, moves: string[]): string {
  return [h.Event, h.Site, h.White, h.Black, h.Date, h.Round, h.Result, moves.join(' ')].join('|')
}

/** The game's start time from its PGN tags, or undefined when even the year is unknown. */
export function pgnDate(h: Record<string, string | undefined>): number | undefined {
  // UTCDate + UTCTime pin the exact instant (Lichess, chess.com)
  const ud = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(h.UTCDate ?? '')
  const ut = /^(\d{2}):(\d{2}):(\d{2})$/.exec(h.UTCTime ?? '')
  if (ud && ut) return Date.UTC(+ud[1], +ud[2] - 1, +ud[3], +ut[1], +ut[2], +ut[3])
  // a bare calendar date is a local day: noon keeps it on that day in every time zone
  // partial dates ("2024.??.??") fall on the first day of what is known
  for (const tag of [h.Date, h.UTCDate]) {
    const d = /^(\d{4})\.(\d{2}|\?\?)\.(\d{2}|\?\?)$/.exec((tag ?? '').trim())
    if (!d) continue
    const month = d[2] === '??' ? 1 : +d[2]
    const day = d[2] === '??' || d[3] === '??' ? 1 : +d[3]
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    return new Date(+d[1], month - 1, day, 12).getTime()
  }
  return undefined
}

/**
 * Splits a multi-game PGN file. A game starts at a tag line that follows movetext,
 * whatever the first tag is (not every exporter starts with [Event).
 */
export function splitPgn(text: string): string[] {
  const games: string[] = []
  let current: string[] = []
  let sawMoves = false
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const isTag = /^\s*\[\w+\s+".*"\]\s*$/.test(line)
    if (isTag && sawMoves) {
      games.push(current.join('\n').trim())
      current = []
      sawMoves = false
    }
    if (!isTag && line.trim()) sawMoves = true
    current.push(line)
  }
  if (current.join('').trim()) games.push(current.join('\n').trim())
  return games.filter(Boolean)
}

/** A stored, not deleted PGN game with this identity, also matching ids from the old 32-bit hash. */
async function findPgnGame(identity: string, legacyIdentity: string): Promise<GameRow | undefined> {
  const live = (r: GameRow) => !r.deleted
  const hit = await db.games.where('externalId').equals(`pgn:${hash64(identity)}`).filter(live).first()
  if (hit) return hit
  // the old hash collides easily: only trust it when the stored game really is this one
  const old = await db.games.where('externalId').equals(`pgn:${legacyHash(legacyIdentity)}`).filter(live).toArray()
  return old.find((r) => {
    try {
      const c = new Chess()
      c.loadPgn(r.pgn)
      return pgnIdentity(c.getHeaders(), c.history()) === identity
    } catch {
      return false
    }
  })
}

export interface PgnImportOptions {
  /** the user's names on other sites: a game where one of them plays gets its userColor */
  usernames?: string[]
  /** called every few games with how many were read so far */
  onProgress?: (done: number, total: number) => void
}

/** games per write and between yields to the browser, so a big file doesn't freeze the page */
const PGN_CHUNK = 50

/**
 * Stores every valid game of a PGN file, keeping its text as written (variations,
 * comments, NAGs). Games already imported are returned but not stored again
 * (`existing` counts them); `failed` counts unreadable ones.
 */
export async function importPgnText(text: string, opts: PgnImportOptions = {}): Promise<{ rows: GameRow[]; existing: number; failed: number }> {
  const out: GameRow[] = []
  let failed = 0
  let existingCount = 0
  const texts = splitPgn(text)
  /** new rows not written yet, by external id: the same game twice in one file is stored once */
  const pending = new Map<string, GameRow>()
  /** every game this import added, flushed or not: a repeat later in the file is neither new nor "already had" */
  const added = new Set<string>()
  const flush = async () => {
    if (pending.size) await db.games.bulkPut([...pending.values()])
    pending.clear()
  }
  for (let i = 0; i < texts.length; i++) {
    if (i && i % PGN_CHUNK === 0) {
      await flush()
      opts.onProgress?.(i, texts.length)
      await new Promise((r) => setTimeout(r, 0))
    }
    const pgn = texts[i]
    const c = new Chess()
    try {
      c.loadPgn(pgn)
    } catch {
      failed++
      continue
    }
    if (!c.history().length) {
      failed++
      continue
    }
    const h = c.getHeaders()
    const moves = c.history()
    const identity = pgnIdentity(h, moves)
    const externalId = `pgn:${hash64(identity)}`
    if (added.has(externalId)) continue
    const existing = await findPgnGame(identity, [h.White, h.Black, h.Date, h.Round, moves.join(' ')].join('|'))
    if (existing) {
      out.push(existing)
      existingCount++
      continue
    }
    const res = (h.Result as GameRow['result']) ?? '*'
    const tc = h.TimeControl?.trim()
    const row: GameRow = {
      id: rowIdFor(externalId),
      externalId,
      source: 'pgn',
      pgn,
      white: h.White ?? '?',
      black: h.Black ?? '?',
      whiteElo: Number(h.WhiteElo) || undefined,
      blackElo: Number(h.BlackElo) || undefined,
      result: ['1-0', '0-1', '1/2-1/2'].includes(res) ? res : '*',
      userColor: userColorFor(h.White, h.Black, opts.usernames ?? []),
      timeControl: tc && tc !== '-' && tc !== '?' ? chesscomTimeControl(tc) : undefined,
      // no usable date at all: the import time keeps it sortable among recent games
      date: pgnDate(h) ?? Date.now(),
      opening: await openingName(c),
      updatedAt: Date.now(),
    }
    pending.set(externalId, row)
    added.add(externalId)
    out.push(row)
  }
  await flush()
  opts.onProgress?.(texts.length, texts.length)
  return { rows: out, existing: existingCount, failed }
}
