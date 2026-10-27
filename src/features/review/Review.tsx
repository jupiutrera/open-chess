import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { CaretDoubleLeft, CaretLeft, CaretRight, CaretDoubleRight, ArrowsDownUp, Star, ArrowCounterClockwise, MagnifyingGlass } from '@phosphor-icons/react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { MoveList } from '../../board/MoveList'
import { EvalBar, EvalStrip } from '../../board/EvalBar'
import { QualityIcon, qualityColor } from '../../board/QualityIcon'
import { EvalGraph } from './EvalGraph'
import { analyzeGame, getGame, parseGame } from './analyze'
import { QUALITY_ORDER, countQualities, estimateRating, winPercent, type MoveReview, type Quality } from './classify'
import { capturedPieces, playUci } from '../../chess/util'
import { playMoveSound, play } from '../../chess/sounds'
import { formatScore, sharedEngine, type Score } from '../../engine/engine'
import type { GameRow } from '../../db/db'
import { useSettings } from '../../settings'
import { Panel } from '../../ui/kit'
import { botById } from '../play/bots'

type Mode = 'summary' | 'moves'

export default function Review() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const depth = useSettings((s) => s.reviewDepth)
  const [game, setGame] = useState<GameRow | null | undefined>(undefined)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [mode, setMode] = useState<Mode>('summary')
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [variation, setVariation] = useState<{ fen: string; lastMove: [string, string]; quality?: Quality } | null>(null)
  const [retry, setRetry] = useState<null | 'waiting' | 'wrong' | 'right'>(null)

  useEffect(() => {
    void getGame(id).then((g) => {
      setGame(g ?? null)
      if (g?.userColor === 'b') setOrientation('black')
    })
  }, [id])

  // analyze when missing
  useEffect(() => {
    if (!game || game.review) return
    const signal = { cancelled: false }
    setProgress({ done: 0, total: 1 })
    void analyzeGame(game, depth, (done, total) => setProgress({ done, total }), signal).then((review) => {
      if (review && !signal.cancelled) {
        setGame({ ...game, review })
        setProgress(null)
      }
    })
    return () => {
      signal.cancelled = true
      sharedEngine().stop()
    }
  }, [game, depth])

  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game])
  const review = game?.review
  const total = parsed?.moves.length ?? 0

  const goto = useCallback(
    (p: number) => {
      if (!parsed) return
      const next = Math.max(0, Math.min(total, p))
      setVariation(null)
      setRetry(null)
      setPly((cur) => {
        if (next === cur + 1) {
          const c = new Chess(parsed.fens[cur])
          const m = playUci(c, parsed.moves[cur].uci)
          if (m) playMoveSound(m)
        }
        return next
      })
    },
    [parsed, total],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') goto(ply - 1)
      else if (e.key === 'ArrowRight') goto(ply + 1)
      else if (e.key === 'Home') goto(0)
      else if (e.key === 'End') goto(total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goto, ply, total])

  if (game === undefined) return null
  if (game === null || !parsed)
    return (
      <div className="p-6 text-fg-2">
        {t('review.notFound')}
        <button className="btn ml-3" onClick={() => nav('/games')}>
          {t('nav.games')}
        </button>
      </div>
    )

  const current: MoveReview | undefined = review && ply > 0 ? review.moves[ply - 1] : undefined
  const fen = variation?.fen ?? (retry ? parsed.fens[ply - 1] : parsed.fens[ply])
  const lastMove: [string, string] | null = variation
    ? variation.lastMove
    : retry
      ? ply > 1
        ? [parsed.moves[ply - 2].from, parsed.moves[ply - 2].to]
        : null
      : ply > 0
        ? [parsed.moves[ply - 1].from, parsed.moves[ply - 1].to]
        : null
  const score: Score | undefined = current ? current.scoreAfter : review ? { cp: 20 } : undefined

  const showArrow =
    mode === 'moves' && !variation && !retry && current?.bestUci && !['best', 'book', 'forced', 'brilliant', 'great'].includes(current.quality)
  const shapes: DrawShape[] = showArrow
    ? [{ orig: current!.bestUci!.slice(0, 2) as never, dest: current!.bestUci!.slice(2, 4) as never, brush: 'green' }]
    : []
  const badge =
    mode === 'moves' && !retry
      ? variation
        ? variation.quality && { square: variation.lastMove[1], quality: variation.quality }
        : current && { square: parsed.moves[ply - 1].to, quality: current.quality }
      : null

  const cap = capturedPieces(fen)
  const bot = game.botId ? botById(game.botId) : undefined
  const h = parsed.headers
  const whiteName = h.White ?? game.white
  const blackName = h.Black ?? game.black
  const bar = (c: 'w' | 'b') => (
    <PlayerBar
      name={c === 'w' ? whiteName : blackName}
      rating={c === 'w' ? h.WhiteElo || game.whiteElo : h.BlackElo || game.blackElo}
      color={c}
      captured={c === 'w' ? cap.byWhite : cap.byBlack}
      advantage={c === 'w' ? cap.diff : -cap.diff}
      hue={bot && game.userColor && c !== game.userColor ? bot.hue : c === 'w' ? 40 : 230}
    />
  )

  const showBest = () => {
    if (!current?.bestUci) return
    const c = new Chess(parsed.fens[ply - 1])
    const m = playUci(c, current.bestUci)
    if (!m) return
    playMoveSound(m)
    setRetry(null)
    setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'best' })
  }

  const startRetry = () => {
    setVariation(null)
    setRetry('waiting')
  }

  const onRetryMove = async (from: string, to: string, promotion?: string) => {
    if (!current) return
    const before = parsed.fens[ply - 1]
    const c = new Chess(before)
    const m = playUci(c, from + to + (promotion ?? ''))
    if (!m) return
    playMoveSound(m)
    const uci = m.from + m.to + (m.promotion ?? '')
    let good = uci === current.bestUci
    if (!good) {
      const r = await sharedEngine().search(c.fen(), { depth: 12 })
      const after = r.lines[0]?.score ?? { cp: 0 }
      const mover = current.color
      const w = winPercent(after)
      const prevBest = review!.curve[ply - 1]
      const loss = mover === 'w' ? prevBest - w : w - prevBest
      good = loss < 3
    }
    if (good) {
      play('correct')
      setRetry('right')
      setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'best' })
    } else {
      play('wrong')
      setRetry('wrong')
      setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'mistake' })
      setTimeout(() => {
        setVariation(null)
        setRetry('waiting')
      }, 900)
    }
  }

  const userColor = game.userColor
  const retryable = current && ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(current.quality)

  return (
    <BoardLayout
      above={review ? <EvalStrip score={score} orientation={orientation} /> : undefined}
      top={orientation === 'white' ? bar('b') : bar('w')}
      bottom={orientation === 'white' ? bar('w') : bar('b')}
      evalBar={review ? <EvalBar score={score} orientation={orientation} /> : undefined}
      board={
        <Board
          fen={fen}
          orientation={orientation}
          lastMove={lastMove}
          shapes={shapes}
          badge={badge || null}
          movable={retry === 'waiting' && current ? (current.color === 'w' ? 'white' : 'black') : 'none'}
          onMove={onRetryMove}
        />
      }
      side={
        <Panel className="flex flex-col overflow-hidden lg:h-full">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Star size={20} weight="fill" className="text-accent" />
            <h1 className="text-[17px] font-extrabold">{t('review.title')}</h1>
            <button
              className="btn btn-ghost btn-icon ml-auto -mr-2"
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              aria-label={t('common.flip')}
            >
              <ArrowsDownUp size={20} weight="bold" />
            </button>
          </div>

          {!review ? (
            <Analyzing progress={progress} />
          ) : mode === 'summary' ? (
            <Summary
              game={game}
              whiteName={whiteName}
              blackName={blackName}
              moves={review.moves}
              accuracy={review.accuracy}
              userColor={userColor}
              onStart={() => {
                setMode('moves')
                goto(1)
              }}
              curve={review.curve}
              ply={ply}
              onSelect={(p) => {
                setMode('moves')
                goto(p)
              }}
            />
          ) : (
            <>
              <Coach
                move={current}
                retry={retry}
                variation={!!variation && !retry}
                onBest={showBest}
                onRetry={retryable ? startRetry : undefined}
              />
              <div className="px-3 pt-3">
                <EvalGraph curve={review.curve} moves={review.moves} ply={ply} onSelect={goto} height={64} />
              </div>
              <MoveList
                sans={parsed.moves.map((m) => m.san)}
                ply={ply}
                onSelect={goto}
                qualities={review.moves.map((m) => m.quality)}
                blackFirst={parsed.startFen.split(' ')[1] === 'b'}
                startNumber={Number(parsed.startFen.split(' ')[5] ?? 1)}
                className="min-h-[140px] flex-1 py-2"
              />
            </>
          )}

          <div className="grid grid-cols-5 gap-1.5 border-t border-line p-2.5">
            <NavBtn onClick={() => goto(0)} label={t('review.first')}>
              <CaretDoubleLeft size={22} weight="bold" />
            </NavBtn>
            <NavBtn onClick={() => goto(ply - 1)} label={t('review.prev')}>
              <CaretLeft size={22} weight="bold" />
            </NavBtn>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (mode === 'summary' && review) {
                  setMode('moves')
                  goto(Math.max(ply, 1))
                } else goto(ply + 1)
              }}
              aria-label={t('review.next')}
              disabled={!review}
            >
              <CaretRight size={24} weight="bold" />
            </button>
            <NavBtn onClick={() => goto(total)} label={t('review.last')}>
              <CaretDoubleRight size={22} weight="bold" />
            </NavBtn>
            <NavBtn onClick={() => nav(`/analysis?fen=${encodeURIComponent(fen)}`)} label={t('nav.analysis')}>
              <MagnifyingGlass size={22} weight="bold" />
            </NavBtn>
          </div>
        </Panel>
      }
    />
  )
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button className="btn px-0" onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  )
}

function Analyzing({ progress }: { progress: { done: number; total: number } | null }) {
  const { t } = useTranslation()
  const pct = progress ? (progress.done / Math.max(1, progress.total)) * 100 : 0
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-[17px] font-bold">{t('review.analyzing')}</div>
      <div className="h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ transform: `translateX(${pct - 100}%)`, transition: 'transform 300ms var(--ease-out)' }}
        />
      </div>
      {progress && (
        <div className="tabular text-[13px] text-fg-3">{t('review.progress', { n: progress.done, total: progress.total })}</div>
      )}
    </div>
  )
}

function Summary({
  game,
  whiteName,
  blackName,
  moves,
  accuracy,
  userColor,
  onStart,
  curve,
  ply,
  onSelect,
}: {
  game: GameRow
  whiteName: string
  blackName: string
  moves: MoveReview[]
  accuracy: { white: number; black: number }
  userColor?: 'w' | 'b'
  onStart: () => void
  curve: number[]
  ply: number
  onSelect: (p: number) => void
}) {
  const { t } = useTranslation()
  const w = countQualities(moves, 'w')
  const b = countQualities(moves, 'b')
  return (
    <div className="enter flex-1 overflow-y-auto p-4">
      <EvalGraph curve={curve} moves={moves} ply={ply} onSelect={onSelect} height={72} />
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
        <span />
        <span className="w-[76px] truncate text-center text-[13px] font-bold">{whiteName}</span>
        <span className="w-[76px] truncate text-center text-[13px] font-bold">{blackName}</span>

        <span className="font-semibold text-fg-2">{t('review.accuracy')}</span>
        <span className={`tabular rounded-md bg-[#f1f1f1] py-1.5 text-center text-[20px] font-extrabold text-[#262421] ${userColor === 'w' ? 'ring-2 ring-accent' : ''}`}>
          {accuracy.white.toFixed(1)}
        </span>
        <span className={`tabular rounded-md bg-[#1b1a18] py-1.5 text-center text-[20px] font-extrabold text-[#f1f1f1] ${userColor === 'b' ? 'ring-2 ring-accent' : ''}`}>
          {accuracy.black.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1">
        {QUALITY_ORDER.map((q) => (
          <QualityRow key={q} q={q} w={w[q]} b={b[q]} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-line pt-3">
        <span className="font-semibold text-fg-2">{t('review.gameRating')}</span>
        <span className="tabular w-[76px] rounded-md border border-line py-1 text-center text-[17px] font-extrabold">{estimateRating(accuracy.white)}</span>
        <span className="tabular w-[76px] rounded-md border border-line py-1 text-center text-[17px] font-extrabold">{estimateRating(accuracy.black)}</span>
      </div>
      {game.opening && (
        <p className="mt-3 text-[13px] text-fg-3">
          {t('review.opening')}: <span className="text-fg-2">{game.opening}</span>
        </p>
      )}
      <button className="btn btn-primary btn-lg mt-4 w-full" onClick={onStart}>
        {t('review.start')}
      </button>
    </div>
  )
}

function QualityRow({ q, w, b }: { q: Quality; w: number; b: number }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="text-[14px] font-semibold" style={{ color: qualityColor(q) }}>
        {t(`review.q.${q}`)}
      </span>
      <span className={`tabular w-[60px] text-center font-bold ${w ? '' : 'text-fg-3'}`}>{w}</span>
      <QualityIcon quality={q} size={22} />
      <span className={`tabular w-[60px] text-center font-bold ${b ? '' : 'text-fg-3'}`}>{b}</span>
    </>
  )
}

function Coach({
  move,
  retry,
  variation,
  onBest,
  onRetry,
}: {
  move?: MoveReview
  retry: null | 'waiting' | 'wrong' | 'right'
  variation: boolean
  onBest: () => void
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  if (!move)
    return (
      <div className="border-b border-line p-4 text-fg-2">
        <p>{t('review.start')}</p>
      </div>
    )
  const text =
    retry === 'waiting'
      ? t('review.retryPrompt')
      : retry === 'wrong'
        ? t('review.retryWrong')
        : retry === 'right'
          ? t('review.retryRight')
          : t(`review.explain.${move.quality}`, { san: move.san })
  const showBestLine = !retry && move.bestSan && !['best', 'book', 'forced', 'brilliant', 'great'].includes(move.quality)
  return (
    <div key={move.ply + (retry ?? '')} className="enter border-b border-line p-4">
      <div className="flex items-start gap-3">
        <QualityIcon quality={retry === 'right' ? 'best' : retry === 'wrong' ? 'mistake' : move.quality} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-snug" style={{ color: retry ? undefined : qualityColor(move.quality) }}>
            {text}
          </p>
          {showBestLine && <p className="mt-0.5 text-[14px] text-fg-2">{t('review.bestWas', { san: move.bestSan })}</p>}
        </div>
        <span className="tabular rounded bg-panel-2 px-2 py-1 font-mono text-[13px] font-bold">{formatScore(move.scoreAfter)}</span>
      </div>
      {showBestLine && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className={`btn ${variation ? 'ring-2 ring-accent' : ''}`} onClick={onBest}>
            <Star size={18} weight="fill" style={{ color: 'var(--q-best)' }} /> {t('review.showBest')}
          </button>
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              <ArrowCounterClockwise size={18} weight="bold" /> {t('review.retry')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

