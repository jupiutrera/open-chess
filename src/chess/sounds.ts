import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'
import { useSettings } from '../settings'

/**
 * Board sounds built with modal synthesis: each sound is a sum of decaying
 * resonances (the wooden piece, the board underneath) plus a short contact
 * transient, rendered once into buffers and played through a small room
 * reverb. No audio files, so nothing to license.
 */
let ctx: AudioContext | null = null
let out: AudioNode | null = null
const cache = new Map<string, AudioBuffer[]>()

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    comp.attack.value = 0.002
    comp.release.value = 0.12
    comp.connect(ctx.destination)
    const dry = ctx.createGain()
    dry.gain.value = 0.9
    dry.connect(comp)
    const wet = ctx.createGain()
    wet.gain.value = 0.16
    const verb = ctx.createConvolver()
    verb.buffer = roomImpulse(ctx)
    verb.connect(wet).connect(comp)
    const bus = ctx.createGain()
    bus.connect(dry)
    bus.connect(verb)
    out = bus
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function roomImpulse(a: AudioContext): AudioBuffer {
  const len = Math.floor(a.sampleRate * 0.35)
  const buf = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.055))
  }
  return buf
}

interface Mode {
  /** frequency in Hz */
  f: number
  /** amplitude */
  a: number
  /** decay time constant in seconds */
  d: number
}

interface Hit {
  at: number
  modes: Mode[]
  /** contact click: amplitude and brightness (0-1, higher is sharper) */
  click?: number
  bright?: number
  gain?: number
}

/** Renders a list of struck resonators into one mono buffer. */
function render(a: AudioContext, hits: Hit[], length: number, detune: number): AudioBuffer {
  const sr = a.sampleRate
  const n = Math.floor(sr * length)
  const buf = a.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  for (const h of hits) {
    const start = Math.floor(h.at * sr)
    const g = h.gain ?? 1
    for (const m of h.modes) {
      const w = (2 * Math.PI * m.f * detune) / sr
      const k = Math.exp(-1 / (m.d * sr))
      const phase = Math.random() * Math.PI
      let env = m.a * g
      for (let i = start; i < n && env > 1e-4; i++) {
        d[i] += env * Math.sin(w * (i - start) + phase)
        env *= k
      }
    }
    if (h.click) {
      // one-pole high-passed noise burst: the moment of contact
      const bright = h.bright ?? 0.6
      const tau = (0.0006 + (1 - bright) * 0.0014) * sr
      let prev = 0
      for (let i = 0; i < tau * 6 && start + i < n; i++) {
        const x = Math.random() * 2 - 1
        const hp = x - prev * (0.35 + bright * 0.5)
        prev = x
        d[start + i] += hp * h.click * g * Math.exp(-i / tau)
      }
    }
  }
  // soften the first samples and normalise
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]))
  const norm = peak > 0 ? 0.9 / peak : 1
  const fade = Math.floor(sr * 0.0004)
  for (let i = 0; i < n; i++) d[i] *= norm * (i < fade ? i / fade : 1) * (i > n - 64 ? (n - i) / 64 : 1)
  return buf
}

/* Building blocks */

/** A wooden piece set down on the board. */
const place = (at: number, pitch = 1, gain = 1): Hit => ({
  at,
  gain,
  click: 0.55,
  bright: 0.55,
  modes: [
    { f: 165 * pitch, a: 0.55, d: 0.05 }, // board body
    { f: 248 * pitch, a: 0.3, d: 0.035 },
    { f: 720 * pitch, a: 1, d: 0.032 }, // piece
    { f: 1240 * pitch, a: 0.55, d: 0.022 },
    { f: 2130 * pitch, a: 0.3, d: 0.012 },
    { f: 3380 * pitch, a: 0.14, d: 0.007 },
  ],
})

/** Piece knocking against piece: brighter and shorter. */
const knock = (at: number, gain = 1): Hit => ({
  at,
  gain,
  click: 0.9,
  bright: 0.9,
  modes: [
    { f: 1480, a: 1, d: 0.02 },
    { f: 2310, a: 0.6, d: 0.014 },
    { f: 3720, a: 0.35, d: 0.008 },
    { f: 5200, a: 0.18, d: 0.005 },
  ],
})

/** Soft mallet note (marimba-like) used for notifications. */
const note = (at: number, f: number, gain = 0.5, length = 0.6): Hit => ({
  at,
  gain,
  click: 0.05,
  bright: 0.2,
  modes: [
    { f, a: 1, d: length * 0.45 },
    { f: f * 3.99, a: 0.22, d: length * 0.1 },
    { f: f * 9.9, a: 0.05, d: length * 0.03 },
  ],
})

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, A4: 440, E4: 329.63, C4: 261.63 }

export type SoundKind =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'promote'
  | 'end'
  | 'win'
  | 'lose'
  | 'draw'
  | 'correct'
  | 'wrong'
  | 'start'
  | 'lowtime'

const SPECS: Record<SoundKind, { length: number; hits: () => Hit[]; variants?: number; volume: number }> = {
  move: { length: 0.22, volume: 0.75, variants: 4, hits: () => [place(0)] },
  capture: { length: 0.26, volume: 0.9, variants: 4, hits: () => [knock(0, 0.7), place(0.028, 0.92, 1.1)] },
  castle: { length: 0.36, volume: 0.75, variants: 2, hits: () => [place(0, 1.02), place(0.12, 0.94, 0.85)] },
  check: {
    length: 0.5,
    volume: 0.8,
    variants: 2,
    hits: () => [place(0, 1.05, 1.1), note(0.02, NOTE.E6, 0.22, 0.45)],
  },
  promote: {
    length: 0.6,
    volume: 0.8,
    hits: () => [place(0), note(0.06, NOTE.C6, 0.25, 0.4), note(0.13, NOTE.E6, 0.22, 0.45)],
  },
  start: { length: 0.8, volume: 0.6, hits: () => [note(0, NOTE.G4, 0.5), note(0.11, NOTE.C5, 0.55), note(0.22, NOTE.E5, 0.55, 0.8)] },
  end: { length: 1, volume: 0.6, hits: () => [note(0, NOTE.E5, 0.5), note(0.13, NOTE.C5, 0.5), note(0.26, NOTE.G4, 0.55, 0.9)] },
  win: {
    length: 1.2,
    volume: 0.65,
    hits: () => [note(0, NOTE.C5, 0.5), note(0.1, NOTE.E5, 0.5), note(0.2, NOTE.G5, 0.5), note(0.3, NOTE.C6, 0.6, 1), note(0.3, NOTE.E5, 0.3, 1)],
  },
  lose: { length: 1.1, volume: 0.6, hits: () => [note(0, NOTE.A4, 0.5), note(0.16, NOTE.E4, 0.5), note(0.32, NOTE.C4, 0.55, 1)] },
  draw: { length: 0.9, volume: 0.6, hits: () => [note(0, NOTE.C5, 0.45), note(0.14, NOTE.G4, 0.45), note(0.28, NOTE.C5, 0.5, 0.8)] },
  correct: { length: 0.6, volume: 0.65, hits: () => [note(0, NOTE.E5, 0.45, 0.4), note(0.08, NOTE.A5, 0.55, 0.6)] },
  wrong: {
    length: 0.45,
    volume: 0.7,
    hits: () => [
      { at: 0, click: 0.3, bright: 0.2, modes: [{ f: 196, a: 1, d: 0.09 }, { f: 392, a: 0.3, d: 0.05 }] },
      { at: 0.1, click: 0.3, bright: 0.2, modes: [{ f: 165, a: 1, d: 0.12 }, { f: 330, a: 0.3, d: 0.06 }] },
    ],
  },
  lowtime: { length: 0.15, volume: 0.45, hits: () => [knock(0, 0.6)] },
}

function buffers(a: AudioContext, kind: SoundKind): AudioBuffer[] {
  let list = cache.get(kind)
  if (!list) {
    const spec = SPECS[kind]
    list = Array.from({ length: spec.variants ?? 1 }, (_, i) => render(a, spec.hits(), spec.length, 1 + (i - 1) * 0.025))
    cache.set(kind, list)
  }
  return list
}

export function play(kind: SoundKind) {
  const s = useSettings.getState()
  if (s.haptics && Capacitor.isNativePlatform() && (kind === 'move' || kind === 'capture' || kind === 'check' || kind === 'castle')) {
    void Haptics.impact({ style: kind === 'move' ? ImpactStyle.Light : ImpactStyle.Medium })
  }
  if (!s.sound) return
  const a = audio()
  if (!a || !out) return
  const list = buffers(a, kind)
  const src = a.createBufferSource()
  src.buffer = list[Math.floor(Math.random() * list.length)]
  // tiny pitch and level variation so repeated moves don't sound mechanical
  src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.04
  const g = a.createGain()
  g.gain.value = SPECS[kind].volume * (0.92 + Math.random() * 0.08)
  src.connect(g).connect(out)
  src.start()
}

/** Picks the right sound for a chess.js move. */
export function playMoveSound(m: { san: string; flags: string }) {
  if (m.san.includes('#') || m.san.includes('+')) return play('check')
  if (m.flags.includes('p')) return play('promote')
  if (m.flags.includes('k') || m.flags.includes('q')) return play('castle')
  if (m.flags.includes('c') || m.flags.includes('e')) return play('capture')
  play('move')
}
