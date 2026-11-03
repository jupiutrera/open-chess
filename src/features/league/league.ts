import { DEFAULT_GLICKO, updateGlicko, type Glicko } from '../puzzles/glicko'
import type { Bot } from '../play/bots'
import type { ChatStyle } from '../play/botChat'
import type { PlayStyle } from '../play/styles'

/**
 * The league: rated games against rivals the app makes up, each one rebuilt from a seed, so a
 * rival you meet again is the same player. They are bots and say so; no one else is online.
 */

/** A rival as stored and linked: who (seed) and at what strength they were met. */
export interface Rival {
  seed: number
  elo: number
}

export interface RivalProfile {
  handle: string
  style: PlayStyle
  hue: number
  /** index of one of the RIVAL_PORTRAITS */
  portrait: number
  chat: ChatStyle
  book: NonNullable<Bot['book']>
  /** how long it takes over a move, against the usual pause */
  tempo: number
}

export interface LeagueGame {
  at: number
  /** `rivalId` of the rival */
  rival: string
  handle: string
  elo: number
  score: 0 | 0.5 | 1
  before: number
  after: number
  gameId?: string
  /** left unfinished, counted as a loss */
  abandoned?: boolean
}

export interface LeagueState {
  rating: Glicko
  /** newest last, capped at HISTORY */
  games: LeagueGame[]
  /** a rated game in progress: it counts as lost unless it is finished or picked up again */
  pending?: { rival: string; handle: string; elo: number; at: number }
}

export const RIVAL_PORTRAITS = 12
const HISTORY = 300
/** a rival's rating is what they play at: far more certain than the user's */
const RIVAL_RD = 80
/** the most one game can move the rating: a provisional rating swings hard on an upset */
const MAX_CHANGE = 200
/** above this RD the rating is still settling, shown as provisional */
export const PROVISIONAL_RD = 110

/** Starting points to pick from on the first visit. */
export const START_LEVELS = [
  { id: 'new', rating: 600 },
  { id: 'casual', rating: 1000 },
  { id: 'club', rating: 1400 },
  { id: 'strong', rating: 1800 },
] as const

export function newLeague(rating: number): LeagueState {
  return { rating: { ...DEFAULT_GLICKO, rating }, games: [] }
}

/** mulberry32: a small seeded generator, so a seed always gives the same rival */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]

// syllables that read as a name in any of the app's languages; handles are names, not words
const SYLLABLES = ['ka', 'ri', 'to', 'mel', 'ven', 'dra', 'lo', 'sa', 'mi', 'ro', 'tal', 'zen', 'bel', 'nor', 'fa', 'vik', 'lu', 'mar', 'sel', 'ga', 'den', 'or', 'pe', 'ty', 'no', 'ash', 'kai', 'lin', 'ru', 'el']

function handleFrom(r: () => number): string {
  const n = r() < 0.7 ? 2 : 3
  let name = ''
  for (let i = 0; i < n; i++) name += pick(r, SYLLABLES)
  name = name[0].toUpperCase() + name.slice(1)
  const tail = r()
  if (tail < 0.35) return name + Math.floor(10 + r() * 90)
  if (tail < 0.5) return `${name}_${Math.floor(1 + r() * 9)}`
  return name
}

/** Styles by how common they are among rivals. */
const STYLE_ODDS: [PlayStyle, number][] = [
  ['balanced', 0.3],
  ['aggressive', 0.2],
  ['solid', 0.2],
  ['simplifier', 0.15],
  ['tricky', 0.15],
]

const CHAT: Record<PlayStyle, ChatStyle[]> = {
  balanced: ['friendly', 'serious', 'studious'],
  aggressive: ['bold'],
  solid: ['calm', 'serious'],
  simplifier: ['cool'],
  tricky: ['friendly', 'cool'],
}

/** Openings each style reaches for; a rival keeps one or two of each. */
const BOOKS: Record<PlayStyle, { white: string[]; vsE4: string[]; vsD4: string[] }> = {
  balanced: { white: ['e4', 'd4', 'c4', 'Nf3'], vsE4: ['e5', 'c5', 'e6', 'c6'], vsD4: ['d5', 'Nf6'] },
  aggressive: { white: ['e4', 'f4'], vsE4: ['e5', 'c5'], vsD4: ['d5', 'Nf6', 'f5'] },
  solid: { white: ['d4', 'Nf3', 'c4'], vsE4: ['e6', 'c6'], vsD4: ['d5', 'e6'] },
  simplifier: { white: ['d4', 'e4'], vsE4: ['e5', 'c6'], vsD4: ['d5'] },
  tricky: { white: ['e4', 'b3', 'Nc3'], vsE4: ['c5', 'Nc6', 'd6'], vsD4: ['Nf6', 'c5'] },
}

/** One or two of the list, by a Fisher-Yates shuffle (sort() with a random comparator varies by browser). */
function keep(r: () => number, list: string[]): string[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, r() < 0.5 ? 1 : 2)
}

/** Everything about a rival but its strength, from its seed alone. */
export function rivalProfile(seed: number): RivalProfile {
  const r = rng(seed)
  const handle = handleFrom(r)
  let x = r()
  let style: PlayStyle = 'balanced'
  for (const [s, p] of STYLE_ODDS) {
    if ((x -= p) <= 0) {
      style = s
      break
    }
  }
  const b = BOOKS[style]
  return {
    handle,
    style,
    hue: Math.floor(r() * 360),
    portrait: Math.floor(r() * RIVAL_PORTRAITS),
    chat: pick(r, CHAT[style]),
    book: { white: keep(r, b.white), vsE4: keep(r, b.vsE4), vsD4: keep(r, b.vsD4) },
    tempo: pick(r, [0.6, 1, 1, 1.6]),
  }
}

export const rivalId = (r: Rival) => `league-${r.seed}-${r.elo}`

export function parseRivalId(id: string): Rival | null {
  const m = /^league-(\d+)-(\d+)$/.exec(id)
  return m ? { seed: Number(m[1]), elo: Number(m[2]) } : null
}

/** A rival close to the user's rating; `rnd` picks who. */
export function findRival(rating: number, rnd = Math.random): Rival {
  const seed = Math.floor(rnd() * 2 ** 31)
  const elo = Math.round((rating + (rnd() * 2 - 1) * 150) / 10) * 10
  return { seed, elo: Math.max(250, Math.min(2900, elo)) }
}

/** The same rival, at the strength it has now: it follows the user's level within its range. */
export function meetAgain(rival: Rival, rating: number): Rival {
  return { seed: rival.seed, elo: Math.max(250, Math.min(2900, Math.round(Math.max(rival.elo - 100, Math.min(rival.elo + 100, rating)) / 10) * 10)) }
}

/** The rival as a bot to play. `bio` is its line, already in the user's language. */
export function rivalBot(rival: Rival, bio = ''): Bot {
  const p = rivalProfile(rival.seed)
  return {
    id: rivalId(rival),
    name: p.handle,
    elo: rival.elo,
    group: 'league',
    hue: p.hue,
    bio: { es: bio, en: bio },
    style: p.chat,
    playStyle: p.style,
    book: p.book,
    avatar: `rival-${p.portrait}`,
    tempo: p.tempo,
    league: rival,
  }
}

/** The state with a rated result in: the new rating, and the game on the record. */
export function recordResult(
  state: LeagueState,
  rival: Rival,
  score: 0 | 0.5 | 1,
  opts: { gameId?: string; abandoned?: boolean; now?: number } = {},
): LeagueState {
  const now = opts.now ?? Date.now()
  const raw = updateGlicko(state.rating, rival.elo, RIVAL_RD, score, now)
  const before = state.rating.rating
  const rating = { ...raw, rating: Math.max(before - MAX_CHANGE, Math.min(before + MAX_CHANGE, raw.rating)) }
  const game: LeagueGame = {
    at: now,
    rival: rivalId(rival),
    handle: rivalProfile(rival.seed).handle,
    elo: rival.elo,
    score,
    before: state.rating.rating,
    after: rating.rating,
    gameId: opts.gameId,
    abandoned: opts.abandoned || undefined,
  }
  const id = rivalId(rival)
  return { rating, games: [...state.games, game].slice(-HISTORY), pending: state.pending?.rival === id ? undefined : state.pending }
}

/** A game left unfinished counts as lost, unless it is the one still saved to continue. */
export function settlePending(state: LeagueState, resumable: string | null, now = Date.now()): LeagueState {
  const p = state.pending
  if (!p || p.rival === resumable) return state
  const rival = parseRivalId(p.rival)
  if (!rival) return { ...state, pending: undefined }
  return recordResult(state, rival, 0, { abandoned: true, now })
}

/** Wins, draws and losses, overall or against one rival (by seed, whatever the strength). */
export function record(games: LeagueGame[], seed?: number): { w: number; d: number; l: number } {
  const out = { w: 0, d: 0, l: 0 }
  for (const g of games) {
    if (seed !== undefined && parseRivalId(g.rival)?.seed !== seed) continue
    if (g.score === 1) out.w++
    else if (g.score === 0.5) out.d++
    else out.l++
  }
  return out
}

/** The rivals met lately, newest first, one entry each. */
export function recentRivals(games: LeagueGame[], max = 5): Rival[] {
  const seen = new Set<number>()
  const out: Rival[] = []
  for (let i = games.length - 1; i >= 0 && out.length < max; i--) {
    const r = parseRivalId(games[i].rival)
    if (!r || seen.has(r.seed)) continue
    seen.add(r.seed)
    out.push(r)
  }
  return out
}

export function isProvisional(g: Glicko): boolean {
  return g.rd > PROVISIONAL_RD
}
