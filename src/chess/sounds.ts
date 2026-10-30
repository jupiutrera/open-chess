import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'
import { useSettings, type SoundSet } from '../settings'

/**
 * Recorded board sounds, one folder per set in public/sounds (see
 * scripts/build-sounds.mjs for sources and licences). Each file is fetched and
 * decoded once, with the mp3 encoder's leading silence trimmed so a move sounds
 * the instant it lands.
 */
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

const KINDS: SoundKind[] = ['move', 'capture', 'check', 'castle', 'promote', 'end', 'win', 'lose', 'draw', 'correct', 'wrong', 'start', 'lowtime']

let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function trimLeadingSilence(a: AudioContext, buf: AudioBuffer): AudioBuffer {
  const data = buf.getChannelData(0)
  let start = 0
  while (start < data.length && Math.abs(data[start]) < 0.003) start++
  start = Math.max(0, start - Math.floor(buf.sampleRate * 0.002))
  if (start < buf.sampleRate * 0.003 || start >= data.length) return buf
  const out = a.createBuffer(buf.numberOfChannels, buf.length - start, buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(start), ch)
  return out
}

function load(set: SoundSet, kind: SoundKind): Promise<AudioBuffer | null> {
  const key = `${set}/${kind}`
  let p = buffers.get(key)
  if (!p) {
    const a = audio()
    p = !a
      ? Promise.resolve(null)
      : fetch(`${import.meta.env.BASE_URL}sounds/${key}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((bytes) => a.decodeAudioData(bytes))
          .then((b) => trimLeadingSilence(a, b))
          .catch(() => {
            buffers.delete(key)
            return null
          })
    buffers.set(key, p)
  }
  return p
}

/** The shared audio context and a decoded sound of the chosen set, for mixing into a recording. */
export function soundContext(): AudioContext | null {
  return audio()
}
export function soundBuffer(kind: SoundKind, set: SoundSet = useSettings.getState().soundSet): Promise<AudioBuffer | null> {
  return load(set, kind)
}

/** The sound of a move read from its SAN alone (for moves replayed without flags). */
export function sanSound(san: string): SoundKind {
  if (/[+#]/.test(san)) return 'check'
  if (san.includes('=')) return 'promote'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}

/** Fetches and decodes a whole set ahead of time. */
export function preloadSounds(set: SoundSet = useSettings.getState().soundSet) {
  for (const k of KINDS) void load(set, k)
}

export function play(kind: SoundKind) {
  const s = useSettings.getState()
  if (s.haptics && Capacitor.isNativePlatform() && (kind === 'move' || kind === 'capture' || kind === 'check' || kind === 'castle')) {
    void Haptics.impact({ style: kind === 'move' ? ImpactStyle.Light : ImpactStyle.Medium })
  }
  if (!s.sound) return
  const a = audio()
  if (!a) return
  void load(s.soundSet, kind).then((buf) => {
    if (!buf) return
    const src = a.createBufferSource()
    src.buffer = buf
    const g = a.createGain()
    g.gain.value = 0.9
    src.connect(g).connect(a.destination)
    src.start()
  })
}

/** Picks the right sound for a chess.js move. */
export function playMoveSound(m: { san: string; flags: string }) {
  if (m.san.includes('#') || m.san.includes('+')) return play('check')
  if (m.flags.includes('p')) return play('promote')
  if (m.flags.includes('k') || m.flags.includes('q')) return play('castle')
  if (m.flags.includes('c') || m.flags.includes('e')) return play('capture')
  play('move')
}
