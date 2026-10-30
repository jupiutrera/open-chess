import type { Quality } from '../classify'

/**
 * The video's script: a title card, then each shown move (slid in, then held on screen) and a
 * closing card. Pure timing, so the renderer only asks "what is on screen at t?".
 */

export type VideoMode = 'all' | 'key'
export type VideoSpeed = 'slow' | 'normal' | 'fast'

export interface Beat {
  kind: 'intro' | 'move' | 'outro'
  /** for moves: the position index after the move (1 = after the first move) */
  ply: number
  start: number
  /** the position before the move, shown still when the previous beat was elsewhere in the game */
  lead: number
  /** the piece sliding */
  move: number
  /** the result on screen, with its badge */
  hold: number
}

export interface Moment {
  beat: Beat
  phase: 'intro' | 'lead' | 'move' | 'hold' | 'outro'
  /** 0..1 within the phase */
  progress: number
}

const INTRO = 1800
const OUTRO = 2400
const LEAD = 700
const MOVE = 320
const HOLD = 650
/** key moments stay longer, for the badge and the eval swing to sink in */
const KEY_HOLD = 1700
const SPEED: Record<VideoSpeed, number> = { slow: 1.5, normal: 1, fast: 0.6 }
/** a clip of key moments stays short enough to share */
const MAX_KEY = 12

export const KEY_QUALITIES: Quality[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']

/** The plies a video of this mode shows; key mode falls back to every move when nothing stands out. */
export function shownPlies(qualities: Quality[], mode: VideoMode): number[] {
  const all = qualities.map((_, i) => i + 1)
  if (mode === 'all') return all
  const key = all.filter((p) => KEY_QUALITIES.includes(qualities[p - 1])).slice(0, MAX_KEY)
  return key.length ? key : all
}

export function buildTimeline(qualities: Quality[], mode: VideoMode, speed: VideoSpeed): Beat[] {
  const k = SPEED[speed]
  const beats: Beat[] = [{ kind: 'intro', ply: 0, start: 0, lead: 0, move: 0, hold: INTRO * k }]
  let t = INTRO * k
  let shown = 0
  for (const ply of shownPlies(qualities, mode)) {
    const key = KEY_QUALITIES.includes(qualities[ply - 1])
    const beat: Beat = {
      kind: 'move',
      ply,
      start: t,
      lead: ply - 1 === shown ? 0 : LEAD * k,
      move: MOVE * k,
      hold: (key ? KEY_HOLD : HOLD) * k,
    }
    beats.push(beat)
    t += beat.lead + beat.move + beat.hold
    shown = ply
  }
  beats.push({
    kind: 'outro',
    ply: shown,
    start: t,
    lead: 0,
    move: 0,
    hold: OUTRO * k,
  })
  return beats
}

export function totalMs(beats: Beat[]): number {
  const last = beats[beats.length - 1]
  return last.start + last.lead + last.move + last.hold
}

/** What is on screen at `t` ms; null once the video is over. */
export function momentAt(beats: Beat[], t: number): Moment | null {
  for (const beat of beats) {
    const end = beat.start + beat.lead + beat.move + beat.hold
    if (t >= end) continue
    if (beat.kind !== 'move') return { beat, phase: beat.kind, progress: (t - beat.start) / beat.hold }
    const local = t - beat.start
    if (local < beat.lead) return { beat, phase: 'lead', progress: local / beat.lead }
    if (local < beat.lead + beat.move) return { beat, phase: 'move', progress: (local - beat.lead) / beat.move }
    return {
      beat,
      phase: 'hold',
      progress: (local - beat.lead - beat.move) / beat.hold,
    }
  }
  return null
}

/** When each shown move lands (for its sound), in ms. */
export function landings(beats: Beat[]): { ply: number; at: number }[] {
  return beats.filter((b) => b.kind === 'move').map((b) => ({ ply: b.ply, at: b.start + b.lead + b.move }))
}
