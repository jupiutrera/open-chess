import Dexie, { type EntityTable } from 'dexie'
import type { MoveReview } from '../features/review/classify'

/** Every synced row carries these. */
export interface SyncRow {
  id: string
  updatedAt: number
  deleted?: boolean
}

export type GameSource = 'bot' | 'local' | 'chesscom' | 'lichess' | 'pgn'

export interface GameRow extends SyncRow {
  source: GameSource
  pgn: string
  white: string
  black: string
  whiteElo?: number
  blackElo?: number
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  /** which side the user played, when known */
  userColor?: 'w' | 'b'
  botId?: string
  timeControl?: string
  date: number
  externalId?: string
  opening?: string
  review?: {
    depth: number
    accuracy: { white: number; black: number }
    moves: MoveReview[]
    /** win% (White POV) per position */
    curve: number[]
  }
}

export interface PuzzleAttemptRow extends SyncRow {
  puzzleId: string
  rating: number
  solved: boolean
  mode: 'rated' | 'rush' | 'daily' | 'theme' | 'mistakes'
  date: number
  ratingAfter?: number
}

export interface RepertoireRow extends SyncRow {
  color: 'w' | 'b'
  /** EPD of the position where the user must play */
  epd: string
  fen: string
  /** move the user wants to play, SAN */
  san: string
  uci: string
  /** SM-2 */
  ease: number
  interval: number
  due: number
  reps: number
  line: string
}

export interface LessonProgressRow extends SyncRow {
  lessonId: string
  stepsDone: number
  completed: boolean
}

/** Small key/value records: ratings, settings, rush records, bot results. */
export interface KvRow extends SyncRow {
  value: unknown
}

export class OpenChessDB extends Dexie {
  games!: EntityTable<GameRow, 'id'>
  puzzleAttempts!: EntityTable<PuzzleAttemptRow, 'id'>
  repertoire!: EntityTable<RepertoireRow, 'id'>
  lessonProgress!: EntityTable<LessonProgressRow, 'id'>
  kv!: EntityTable<KvRow, 'id'>

  constructor() {
    super('open-chess')
    this.version(1).stores({
      games: 'id, updatedAt, date, source, externalId',
      puzzleAttempts: 'id, updatedAt, date, puzzleId, mode',
      repertoire: 'id, updatedAt, color, epd, due',
      lessonProgress: 'id, updatedAt, lessonId',
      kv: 'id, updatedAt',
    })
  }
}

export const db = new OpenChessDB()

export const SYNC_TABLES = ['games', 'puzzleAttempts', 'repertoire', 'lessonProgress', 'kv'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

/** Writes a row stamping updatedAt so the sync engine picks it up. */
export async function put<T extends SyncRow>(table: SyncTable, row: Omit<T, 'updatedAt'> & { updatedAt?: number }) {
  const stamped = { ...row, updatedAt: Date.now() }
  await (db[table] as unknown as EntityTable<SyncRow, 'id'>).put(stamped as SyncRow)
  return stamped as T
}

export async function softDelete(table: SyncTable, id: string) {
  await (db[table] as unknown as EntityTable<SyncRow, 'id'>).update(id, { deleted: true, updatedAt: Date.now() })
}

export async function kvGet<T>(id: string, fallback: T): Promise<T> {
  const row = await db.kv.get(id)
  return row && !row.deleted ? (row.value as T) : fallback
}

export async function kvSet<T>(id: string, value: T) {
  await put<KvRow>('kv', { id, value })
}
