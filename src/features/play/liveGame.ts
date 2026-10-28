/**
 * The game in progress, saved after every move so leaving the screen, the Android
 * back button or a reload never loses it. One slot per mode; finished games move to the DB.
 */
import type { ChallengePly } from './challenges'

export interface LiveGame {
  kind: 'bot' | 'local'
  /** bot games */
  botId?: string
  userColor?: 'w' | 'b'
  /** local games */
  autoFlip?: boolean
  tc: string
  /** the start position, when it isn't the usual one */
  fen?: string
  sans: string[]
  clock?: { w: number; b: number }
  /** challenge bots: their state after each ply (see challenges.ts) */
  challenge?: ChallengePly[]
  savedAt: number
}

const key = (kind: LiveGame['kind']) => `oc-live-${kind}`

export function loadLiveGame(kind: LiveGame['kind']): LiveGame | null {
  try {
    const raw = localStorage.getItem(key(kind))
    if (!raw) return null
    const g = JSON.parse(raw) as LiveGame
    return g.kind === kind && Array.isArray(g.sans) && g.sans.length > 0 ? g : null
  } catch {
    return null
  }
}

/** Saves the game; an empty one is ignored so opening a new board never wipes a saved game. */
export function saveLiveGame(g: Omit<LiveGame, 'savedAt'>) {
  if (!g.sans.length) return
  try {
    localStorage.setItem(key(g.kind), JSON.stringify({ ...g, savedAt: Date.now() }))
  } catch {
    // storage full or blocked: the game just isn't resumable
  }
}

export function clearLiveGame(kind: LiveGame['kind']) {
  try {
    localStorage.removeItem(key(kind))
  } catch {
    // ignore
  }
}
