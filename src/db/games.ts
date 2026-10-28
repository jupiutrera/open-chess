import { Chess } from 'chess.js'
import { db, put, type GameRow, type GameSource } from './db'
import { uid } from '../chess/util'
import { latestOpening } from '../features/openings/openingsData'

export interface SaveGameInput {
  source: GameSource
  chess: Chess
  white: string
  black: string
  whiteElo?: number
  blackElo?: number
  result: GameRow['result']
  userColor?: 'w' | 'b'
  botId?: string
  timeControl?: string
  termination?: string
}

export async function saveGame(input: SaveGameInput): Promise<GameRow> {
  const c = input.chess
  const date = new Date()
  c.setHeader('Event', input.source === 'bot' ? 'Open Chess vs bot' : 'Open Chess')
  c.setHeader('Site', 'Open Chess')
  c.setHeader('Date', `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`)
  c.setHeader('White', input.white)
  c.setHeader('Black', input.black)
  c.setHeader('Result', input.result)
  if (input.whiteElo) c.setHeader('WhiteElo', String(input.whiteElo))
  if (input.blackElo) c.setHeader('BlackElo', String(input.blackElo))
  if (input.timeControl) c.setHeader('TimeControl', input.timeControl)
  if (input.termination) c.setHeader('Termination', input.termination)
  const opening = await openingName(c)
  const row: Omit<GameRow, 'updatedAt'> = {
    id: uid(),
    source: input.source,
    pgn: c.pgn(),
    white: input.white,
    black: input.black,
    whiteElo: input.whiteElo,
    blackElo: input.blackElo,
    result: input.result,
    userColor: input.userColor,
    botId: input.botId,
    timeControl: input.timeControl,
    date: Date.now(),
    opening,
  }
  return put<GameRow>('games', row)
}

/** Deepest named opening reached in the game. */
export async function openingName(c: Chess): Promise<string | undefined> {
  const o = await latestOpening(c.history({ verbose: true }).slice(0, 30).map((m) => m.after))
  return o && `${o.eco} ${o.name}`
}

export async function recentGames(limit = 20): Promise<GameRow[]> {
  // filter before limit so tombstones don't eat into the page
  return db.games.orderBy('date').reverse().filter((r) => !r.deleted).limit(limit).toArray()
}
