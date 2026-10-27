import { Chess } from 'chess.js'
import { db, put, type GameRow } from '../../db/db'
import { uid } from '../../chess/util'
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

/** Monthly archive URLs for a chess.com user, newest first. */
export async function chesscomArchives(user: string): Promise<string[]> {
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`)
  if (res.status === 404) throw new NotFoundError()
  if (!res.ok) throw new Error(`chess.com ${res.status}`)
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

export async function chesscomMonth(archiveUrl: string): Promise<RemoteGame[]> {
  const res = await fetch(archiveUrl)
  if (!res.ok) throw new Error(`chess.com ${res.status}`)
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
      timeControl: g.time_control,
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

/** Parses the Lichess NDJSON export, keeping finished standard games. */
export function parseLichessGames(ndjson: string): RemoteGame[] {
  return ndjson
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LichessGame)
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
export async function lichessGames(user: string, until?: number, max = 50): Promise<LichessPage> {
  const params = new URLSearchParams({ max: String(max), pgnInJson: 'true', clocks: 'false', evals: 'false', opening: 'true' })
  if (until) params.set('until', String(until))
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${params}`, {
    headers: { Accept: 'application/x-ndjson' },
  })
  if (res.status === 404) throw new NotFoundError()
  if (!res.ok) throw new Error(`lichess ${res.status}`)
  const text = await res.text()
  const raw = text.split('\n').filter(Boolean)
  const oldest = raw.length ? (JSON.parse(raw[raw.length - 1]) as LichessGame).createdAt : undefined
  return { games: parseLichessGames(text), next: raw.length === max && oldest ? oldest - 1 : undefined }
}

export async function importedIds(): Promise<Set<string>> {
  const rows = await db.games.filter((g) => !!g.externalId && !g.deleted).toArray()
  return new Set(rows.map((r) => r.externalId!))
}

/** Saves a remote game; returns the stored row (existing one if already imported). */
export async function importRemote(g: RemoteGame, username?: string): Promise<GameRow> {
  const existing = await db.games.where('externalId').equals(g.externalId).filter((r) => !r.deleted).first()
  if (existing) return existing
  const c = new Chess()
  c.loadPgn(g.pgn)
  const u = username?.toLowerCase()
  const userColor = u ? (g.white.toLowerCase() === u ? 'w' : g.black.toLowerCase() === u ? 'b' : undefined) : undefined
  return put<GameRow>('games', {
    id: uid(),
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

/** Splits a multi-game PGN file and stores every valid game. */
export async function importPgnText(text: string): Promise<GameRow[]> {
  const chunks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n(?=\[Event )/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: GameRow[] = []
  for (const pgn of chunks) {
    const c = new Chess()
    try {
      c.loadPgn(pgn)
    } catch {
      continue
    }
    if (!c.history().length) continue
    const h = c.getHeaders()
    const res = (h.Result as GameRow['result']) ?? '*'
    out.push(
      await put<GameRow>('games', {
        id: uid(),
        source: 'pgn',
        pgn: c.pgn(),
        white: h.White ?? '?',
        black: h.Black ?? '?',
        whiteElo: Number(h.WhiteElo) || undefined,
        blackElo: Number(h.BlackElo) || undefined,
        result: ['1-0', '0-1', '1/2-1/2'].includes(res) ? res : '*',
        date: h.Date ? Date.parse(h.Date.replace(/\./g, '-')) || Date.now() : Date.now(),
        opening: await openingName(c),
      }),
    )
  }
  return out
}
