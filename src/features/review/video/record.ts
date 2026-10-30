import { sanSound, soundBuffer, soundContext } from '../../../chess/sounds'
import { HEIGHT, WIDTH, drawMoment, type VideoGame, type VideoText, type VideoTheme } from './render'
import { buildTimeline, landings, momentAt, totalMs, type VideoMode, type VideoSpeed } from './timeline'

/** Recording the review video in the browser: the canvas and the move sounds go through MediaRecorder, no server. */

const FPS = 30

export interface VideoOptions {
  mode: VideoMode
  speed: VideoSpeed
  sound: boolean
}

/** The page stopped being visible mid-recording: hidden pages get throttled, so the clip would stutter. */
export class HiddenError extends Error {}

/** MP4 where the browser can record it (shares everywhere), WebM otherwise. */
const FORMATS = [
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
]

export function videoFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime)) ?? null
}

/**
 * Plays the timeline on `canvas` in real time while recording it, and resolves with the file.
 * `onProgress` gets 0..1; aborting stops the recording and rejects, and so does the page being hidden.
 */
export async function recordVideo(
  canvas: HTMLCanvasElement,
  game: VideoGame,
  text: VideoText,
  theme: VideoTheme,
  opts: VideoOptions,
  onProgress: (share: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  const format = videoFormat()
  if (!format) throw new Error('recording not supported')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!
  const beats = buildTimeline(game.qualities, opts.mode, opts.speed)
  const total = totalMs(beats)
  const check = () => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (document.hidden) throw new HiddenError()
  }
  // the first frame is on the canvas before the stream starts
  drawMoment(ctx, game, text, theme, momentAt(beats, 0)!)

  // everything opened below is closed in `finally`, whatever goes wrong
  const tracks: MediaStreamTrack[] = []
  const sources: AudioBufferSourceNode[] = []
  let recorder: MediaRecorder | null = null
  let stopped: Promise<void> = Promise.resolve()
  const chunks: Blob[] = []
  try {
    tracks.push(...canvas.captureStream(FPS).getVideoTracks())
    const audio = opts.sound ? soundContext() : null
    let audioStart = 0
    if (audio) {
      const dest = audio.createMediaStreamDestination()
      tracks.push(...dest.stream.getAudioTracks())
      // decode first, then schedule every landing on the audio clock so sound and picture stay together
      const marks = landings(beats)
      const buffers = await Promise.all(marks.map((l) => soundBuffer(sanSound(game.moves[l.ply - 1].san))))
      check()
      audioStart = audio.currentTime + 0.1
      marks.forEach((l, i) => {
        const buf = buffers[i]
        if (!buf) return
        const src = audio.createBufferSource()
        src.buffer = buf
        src.connect(dest)
        src.start(audioStart + l.at / 1000)
        sources.push(src)
      })
    }

    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: format.mime, videoBitsPerSecond: 6_000_000 })
    recorder = rec
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    stopped = new Promise<void>((resolve) => (rec.onstop = () => resolve()))
    rec.start(1000)
    const started = audio ? performance.now() + (audioStart - audio.currentTime) * 1000 : performance.now()

    for (;;) {
      check()
      const t = Math.max(0, performance.now() - started)
      const m = momentAt(beats, t)
      if (!m) break
      drawMoment(ctx, game, text, theme, m)
      onProgress(Math.min(1, t / total))
      await new Promise((r) => setTimeout(r, 1000 / FPS))
    }
  } finally {
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        // already ended
      }
    }
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    for (const tr of tracks) tr.stop()
  }
  await stopped
  onProgress(1)
  return { blob: new Blob(chunks, { type: format.mime.split(';')[0] }), ext: format.ext }
}
