import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'
import { useSettings } from '../settings'

/** Wooden board sounds synthesized with Web Audio: no audio files to license. */
let ctx: AudioContext | null = null

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

function knock(freq: number, gain: number, decay: number, when = 0) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + when
  const len = Math.floor(a.sampleRate * decay)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 2.2
  const g = a.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + decay)
  src.connect(bp).connect(g).connect(a.destination)
  src.start(t)

  const osc = a.createOscillator()
  osc.frequency.setValueAtTime(freq * 0.55, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + decay)
  const og = a.createGain()
  og.gain.setValueAtTime(gain * 0.35, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.8)
  osc.connect(og).connect(a.destination)
  osc.start(t)
  osc.stop(t + decay)
}

function tone(freq: number, dur: number, when = 0, gain = 0.08) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + when
  const osc = a.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'end' | 'correct' | 'wrong' | 'start' | 'lowtime'

export function play(kind: SoundKind) {
  const s = useSettings.getState()
  if (s.haptics && Capacitor.isNativePlatform() && (kind === 'move' || kind === 'capture' || kind === 'check')) {
    void Haptics.impact({ style: kind === 'move' ? ImpactStyle.Light : ImpactStyle.Medium })
  }
  if (!s.sound) return
  switch (kind) {
    case 'move':
      knock(1500, 0.9, 0.09)
      break
    case 'capture':
      knock(1100, 1.2, 0.12)
      knock(1700, 0.5, 0.06, 0.03)
      break
    case 'castle':
      knock(1500, 0.8, 0.08)
      knock(1400, 0.8, 0.08, 0.1)
      break
    case 'check':
      knock(1300, 1, 0.1)
      tone(880, 0.18, 0.02, 0.05)
      break
    case 'promote':
      knock(1500, 0.8, 0.08)
      tone(1046, 0.2, 0.05, 0.05)
      break
    case 'start':
      tone(523, 0.12, 0, 0.05)
      tone(784, 0.18, 0.1, 0.05)
      break
    case 'end':
      tone(784, 0.15, 0, 0.06)
      tone(659, 0.15, 0.13, 0.06)
      tone(523, 0.3, 0.26, 0.06)
      break
    case 'correct':
      tone(880, 0.1, 0, 0.06)
      tone(1318, 0.18, 0.08, 0.06)
      break
    case 'wrong':
      tone(220, 0.22, 0, 0.08)
      break
    case 'lowtime':
      tone(1200, 0.06, 0, 0.04)
      break
  }
}

/** Picks the right sound for a chess.js move. */
export function playMoveSound(m: { san: string; flags: string }) {
  if (m.san.includes('#')) return play('check')
  if (m.san.includes('+')) return play('check')
  if (m.flags.includes('p')) return play('promote')
  if (m.flags.includes('k') || m.flags.includes('q')) return play('castle')
  if (m.flags.includes('c') || m.flags.includes('e')) return play('capture')
  play('move')
}
