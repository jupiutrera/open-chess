import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Segmented, Sheet, Toggle, toast } from '../../../ui/kit'
import { useSettings } from '../../../settings'
import { fmtDecimal } from '../../../i18n/format'
import { saveBlobFile } from '../../../ui/files'
import type { GameRow } from '../../../db/db'
import type { ParsedGame } from '../analyze'
import { QUALITIES, type Quality } from '../classify'
import { moveNumberLabel } from '../moveNumber'
import { loadTheme, type VideoGame, type VideoText } from './render'
import { HiddenError, recordVideo, videoFormat, type VideoOptions } from './record'
import type { VideoMode, VideoSpeed } from './timeline'


/** Whether this browser can record the video at all (MediaRecorder on a canvas). */
export const canExportVideo = () => videoFormat() !== null

export function VideoExport({
  open,
  onClose,
  game,
  parsed,
  whiteName,
  blackName,
  orientation,
}: {
  open: boolean
  onClose: () => void
  game: GameRow
  parsed: ParsedGame
  whiteName: string
  blackName: string
  orientation: 'white' | 'black'
}) {
  const { t } = useTranslation()
  const soundOn = useSettings((s) => s.sound)
  const pieceSet = useSettings((s) => s.pieces)
  const [mode, setMode] = useState<VideoMode>('key')
  const [speed, setSpeed] = useState<VideoSpeed>('normal')
  const [sound, setSound] = useState(soundOn)
  const [progress, setProgress] = useState<number | null>(null)
  const preview = useRef<HTMLDivElement>(null)
  const abort = useRef<AbortController | null>(null)
  // the live preview is the video playing: left out when motion is reduced
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => () => abort.current?.abort(), [])
  // each opening starts from the app's sound setting as it is now
  useEffect(() => {
    if (open) setSound(soundOn)
  }, [open, soundOn])

  const close = () => {
    abort.current?.abort()
    onClose()
  }

  const create = async () => {
    const review = game.review
    if (!review) return
    // named before recording: a bad date must not cost the finished clip
    const day = Number.isFinite(game.date) ? new Date(game.date).toISOString().slice(0, 10) : 'game'
    const name = `${whiteName}-${blackName}-${day}`.replace(/[^\p{L}\p{N}-]+/gu, '_')
    const ctrl = new AbortController()
    abort.current = ctrl
    setProgress(0)
    const canvas = document.createElement('canvas')
    canvas.className = 'h-full w-full rounded-lg'
    if (!reduced) preview.current?.replaceChildren(canvas)
    const winner = game.result === '1-0' ? whiteName : game.result === '0-1' ? blackName : null
    const data: VideoGame = {
      white: whiteName,
      black: blackName,
      result: game.result.replace('1/2-1/2', '½-½'),
      accuracy: review.accuracy,
      fens: parsed.fens,
      moves: parsed.moves,
      qualities: review.moves.map((m) => m.quality),
      curve: review.curve,
      orientation,
    }
    const text: VideoText = {
      quality: Object.fromEntries(QUALITIES.map((q) => [q, t(`review.q.${q}`)])) as Record<Quality, string>,
      accuracy: (v) => t('review.video.accuracy', { value: fmtDecimal(v) }),
      moveNumber: (ply) => moveNumberLabel(ply, parsed.startFen, '…'),
      result: winner ? t('review.video.wins', { name: winner }) : game.result === '*' ? '' : t('review.video.draw'),
      footer: 'Open Chess',
      vs: t('games.vs'),
    }
    const opts: VideoOptions = { mode, speed, sound }
    try {
      const theme = await loadTheme(pieceSet)
      const { blob, ext } = await recordVideo(canvas, data, text, theme, opts, setProgress, ctrl.signal)
      await saveBlobFile(`${name}.${ext}`, blob)
      toast(t('review.video.saved'))
      onClose()
    } catch (e) {
      if (!ctrl.signal.aborted) toast(t(e instanceof HiddenError ? 'review.video.hidden' : 'review.video.failed'))
    } finally {
      if (abort.current === ctrl) abort.current = null
      setProgress(null)
      preview.current?.replaceChildren()
    }
  }

  const busy = progress !== null
  return (
    <Sheet open={open} onClose={close} title={t('review.video.title')}>
      <div className="space-y-4">
        <p className="text-[14px] text-fg-2">{t('review.video.intro')}</p>
        <Segmented
          label={t('review.video.what')}
          value={mode}
          onChange={(v) => !busy && setMode(v)}
          options={[
            { value: 'key', label: t('review.video.key') },
            { value: 'all', label: t('review.video.all') },
          ]}
        />
        <Segmented
          label={t('review.video.speed')}
          value={speed}
          onChange={(v) => !busy && setSpeed(v)}
          options={[
            { value: 'slow', label: t('review.video.slow') },
            { value: 'normal', label: t('review.video.normal') },
            { value: 'fast', label: t('review.video.fast') },
          ]}
        />
        <div className="border-y border-line">
          <Toggle checked={sound} onChange={(v) => !busy && setSound(v)} label={t('review.video.sound')} />
        </div>
        {/* mounted before recording starts, so the canvas can be put in it straight away */}
        <div ref={preview} className={busy && !reduced ? 'mx-auto aspect-[9/16] w-40 overflow-hidden rounded-lg bg-panel-2' : 'hidden'} />
        {busy ? (
          <div className="space-y-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-panel-2"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p className="text-[13px] text-fg-3">
              {t('review.video.recording', {
                percent: Math.round(progress * 100),
              })}
            </p>
            <button className="btn w-full" onClick={() => abort.current?.abort()}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary w-full" onClick={() => void create()}>
            {t('review.video.create')}
          </button>
        )}
      </div>
    </Sheet>
  )
}
