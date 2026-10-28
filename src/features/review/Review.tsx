import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { CaretDoubleLeft, CaretLeft, CaretRight, CaretDoubleRight, ArrowsDownUp, Star, ArrowCounterClockwise, MagnifyingGlass, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { Board } from '../../board/Board'
import { useBoardKeys } from '../../board/useBoardKeys'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { MoveList } from '../../board/MoveList'
import { EvalBar, EvalStrip } from '../../board/EvalBar'
import { QualityIcon, qualityColor } from '../../board/QualityIcon'
import { EvalGraph } from './EvalGraph'
import { analyzeGame, getGame, parseGame } from './analyze'
import { QUALITY_ORDER, countQualities, estimateRating, repetitionDraws, retryAccepted, scoreFromWin, terminalScore, winPercent, type MoveReview, type Quality } from './classify'
import { moveNumberLabel } from './moveNumber'
import { capturedPieces, playUci, uciLineToSan } from '../../chess/util'
import { playMoveSound, play } from '../../chess/sounds'
import { formatScore, sharedEngine, type PvLine, type Score } from '../../engine/engine'
import type { GameRow } from '../../db/db'
import { useSettings } from '../../settings'
import { BoardScreenSkeleton, Panel, toast } from '../../ui/kit'
import { botById } from '../play/bots'
import { BotAvatar } from '../play/BotAvatar'
import { playerName } from '../play/playerName'
import { fmtDecimal } from '../../i18n/format'
import { put } from '../../db/db'
import { saveTextFile } from '../../ui/files'
import { annotatedPgn } from './pgnExport'
import { explainMove } from './explain'

type Mode = 'summary' | 'moves'

export default function Review() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const depth = useSettings((s) => s.reviewDepth)
  const [game, setGame] = useState<GameRow | null | undefined>(undefined)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [engineFailed, setEngineFailed] = useState(false)
  const [mode, setMode] = useState<Mode>('summary')
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [variation, setVariation] = useState<{ fen: string; lastMove: [string, string]; quality?: Quality } | null>(null)
  const [retry, setRetry] = useState<null | 'waiting' | 'wrong' | 'right'>(null)
  // engine line whose first move is drawn on the board
  const [lineArrow, setLineArrow] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void getGame(id).then((g) => {
      if (!alive) return
      setGame(g ?? null)
      if (g?.userColor === 'b') setOrientation('black')
    })
    return () => {
      alive = false
    }
  }, [id])

  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // bumped whenever the retry is abandoned, so a pending engine check or reset timer is dropped
  const retryGen = useRef(0)
  const cancelRetry = useCallback(() => {
    retryGen.current++
    clearTimeout(retryTimer.current)
  }, [])
  useEffect(() => cancelRetry, [cancelRetry])

  // analyze when missing
  useEffect(() => {
    if (!game || game.review) return
    const signal = { cancelled: false }
    setProgress({ done: 0, total: 1 })
    setEngineFailed(false)
    analyzeGame(game, depth, (done, total) => setProgress({ done, total }), signal).then(
      (review) => {
        if (review && !signal.cancelled) {
          setGame({ ...game, review })
          setProgress(null)
        }
      },
      () => !signal.cancelled && setEngineFailed(true),
    )
    return () => {
      signal.cancelled = true
      sharedEngine().stop()
    }
  }, [game, depth])

  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game])
  const sans = useMemo(() => parsed?.moves.map((m) => m.san) ?? [], [parsed])
  const qualities = useMemo(() => game?.review?.moves.map((m) => m.quality), [game?.review])
  const review = game?.review
  const total = parsed?.moves.length ?? 0
  // the turning points: great finds and errors, the user's own when we know their colour
  const keyMoments = useMemo(
    () =>
      (review?.moves ?? []).filter(
        (m) => KEY_QUALITIES.includes(m.quality) && (!game?.userColor || m.color === game.userColor || m.quality === 'blunder'),
      ),
    [review, game?.userColor],
  )

  const exportPgn = () => {
    if (!game) return
    const name = `${game.white}-${game.black}-${new Date(game.date).toISOString().slice(0, 10)}`.replace(/[^\w-]+/g, '_')
    void saveTextFile(`${name}.pgn`, annotatedPgn(game, (q) => t(`review.q.${q}`)), 'application/x-chess-pgn').catch(() => {})
  }

  const reanalyze = async () => {
    if (!game) return
    // dropping the stored review makes the analysis effect run again at the current depth
    const fresh = await put<GameRow>('games', { ...game, review: undefined })
    setMode('summary')
    setGame(fresh)
  }

  const goto = useCallback(
    (p: number) => {
      if (!parsed) return
      const next = Math.max(0, Math.min(total, p))
      cancelRetry()
      setVariation(null)
      setRetry(null)
      setLineArrow(null)
      setPly((cur) => {
        if (next === cur + 1) {
          const c = new Chess(parsed.fens[cur])
          const m = playUci(c, parsed.moves[cur].uci)
          if (m) playMoveSound(m)
        }
        return next
      })
    },
    [parsed, total, cancelRetry],
  )

  useBoardKeys({ ply, total, goto, flip: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')) })

  if (game === undefined) return <BoardScreenSkeleton />
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
  const score: Score | undefined = current ? current.scoreAfter : review ? positionScore(review, 0) : undefined

  const showArrow =
    mode === 'moves' && !variation && !retry && current?.bestUci && !['best', 'book', 'forced', 'brilliant', 'great'].includes(current.quality)
  const positionLines = mode === 'moves' && !variation && !retry ? review?.lines?.[ply] : undefined
  const pickedUci = lineArrow !== null ? positionLines?.[lineArrow]?.pv[0] : undefined
  const shapes: DrawShape[] = pickedUci
    ? [{ orig: pickedUci.slice(0, 2) as never, dest: pickedUci.slice(2, 4) as never, brush: 'paleBlue' }]
    : showArrow
      ? [{ orig: current!.bestUci!.slice(0, 2) as never, dest: current!.bestUci!.slice(2, 4) as never, brush: 'green' }]
      : []
  const badge =
    mode === 'moves' && !retry
      ? variation
        ? variation.quality && { square: variation.lastMove[1], quality: variation.quality }
        : current && { square: parsed.moves[ply - 1].to, quality: current.quality }
      : null

  const h = parsed.headers
  const result = (h.Result ?? game.result) as '1-0' | '0-1' | '1/2-1/2' | '*'
  const outcome = ply === total && !variation && !retry && result !== '*' ? { result, reason: endReason(h.Termination, fen) } : null

  const cap = capturedPieces(fen)
  const bot = game.botId ? botById(game.botId) : undefined
  const whiteName = playerName(h.White ?? game.white, game.source, t)
  const blackName = playerName(h.Black ?? game.black, game.source, t)
  const bar = (c: 'w' | 'b') => (
    <PlayerBar
      name={c === 'w' ? whiteName : blackName}
      rating={c === 'w' ? h.WhiteElo || game.whiteElo : h.BlackElo || game.blackElo}
      color={c}
      captured={c === 'w' ? cap.byWhite : cap.byBlack}
      advantage={c === 'w' ? cap.diff : -cap.diff}
      hue={bot && game.userColor && c !== game.userColor ? bot.hue : c === 'w' ? 40 : 230}
      avatar={bot && game.userColor && c !== game.userColor ? <BotAvatar bot={bot} size={40} /> : undefined}
    />
  )

  const showBest = () => {
    if (!current?.bestUci) return
    const c = new Chess(parsed.fens[ply - 1])
    const m = playUci(c, current.bestUci)
    if (!m) return
    playMoveSound(m)
    cancelRetry()
    setRetry(null)
    setLineArrow(null)
    setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'best' })
  }

  const startRetry = () => {
    cancelRetry()
    setLineArrow(null)
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
    cancelRetry()
    const gen = retryGen.current
    const uci = m.from + m.to + (m.promotion ?? '')
    let good = uci === current.bestUci && uci !== current.uci
    if (!good && uci !== current.uci) {
      const moves = [...parsed.moves.slice(0, ply - 1).map((x) => x.uci), uci]
      let after: Score
      try {
        // a mating or stalemating retry ends the game, so the engine has no lines to score it;
        // nor does a third repetition, which is a draw
        after =
          terminalScore(c.fen()) ??
          (repetitionDraws([...parsed.fens.slice(0, ply), c.fen()])[ply] ? { cp: 0 } : null) ??
          (await sharedEngine().search(c.fen(), { depth: 12, history: { startFen: parsed.startFen, moves } })).lines[0]?.score ?? { cp: 0 }
      } catch {
        if (gen !== retryGen.current) return
        toast(t('review.retryFailed'), 'error')
        setVariation(null)
        setRetry(null)
        return
      }
      // the user moved on (or moved again) while the engine was thinking
      if (gen !== retryGen.current) return
      const beforePos = { fen: before, score: positionScore(review!, ply - 1), lines: positionLinesFor(review!, ply - 1, current.bestUci) }
      good = retryAccepted(beforePos, { fen: c.fen(), lines: [], score: after }, uci, current.uci)
    }
    if (good) {
      play('correct')
      setRetry('right')
      setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'best' })
    } else {
      play('wrong')
      setRetry('wrong')
      setVariation({ fen: c.fen(), lastMove: [m.from, m.to], quality: 'mistake' })
      retryTimer.current = setTimeout(() => {
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
          outcome={outcome}
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
            <Analyzing progress={progress} failed={engineFailed} />
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
              keyMoments={keyMoments}
              startFen={parsed.startFen}
              onExport={exportPgn}
              onReanalyze={reanalyze}
            />
          ) : (
            <>
              <Coach
                move={current}
                fenBefore={parsed.fens[ply - 1]}
                scoreBefore={ply > 0 ? positionScore(review, ply - 1) : undefined}
                retry={retry}
                variation={!!variation && !retry}
                onBest={showBest}
                onRetry={retryable ? startRetry : undefined}
              />
              {!variation && !retry && (
                <EngineLines
                  fen={parsed.fens[ply]}
                  lines={positionLines}
                  missing={!review.lines}
                  picked={lineArrow}
                  onPick={(i) => setLineArrow((cur) => (cur === i ? null : i))}
                />
              )}
              <div className="px-3 pt-3">
                <EvalGraph curve={review.curve} moves={review.moves} ply={ply} onSelect={goto} startFen={parsed.startFen} height={64} />
              </div>
              {keyMoments.length > 0 && (
                <div className="flex items-center gap-2 px-3 pt-2 text-[13px]">
                  <span className="font-semibold text-fg-3">{t('review.keyMoments')}</span>
                  <button
                    className="btn btn-ghost btn-icon ml-auto"
                    aria-label={t('review.prevKey')}
                    title={t('review.prevKey')}
                    disabled={!keyMoments.some((m) => m.ply < ply)}
                    onClick={() => goto([...keyMoments].reverse().find((m) => m.ply < ply)!.ply)}
                  >
                    <CaretLeft size={18} weight="bold" />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={t('review.nextKey')}
                    title={t('review.nextKey')}
                    disabled={!keyMoments.some((m) => m.ply > ply)}
                    onClick={() => goto(keyMoments.find((m) => m.ply > ply)!.ply)}
                  >
                    <CaretRight size={18} weight="bold" />
                  </button>
                </div>
              )}
              <MoveList
                sans={sans}
                ply={ply}
                onSelect={goto}
                qualities={qualities}
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

type StoredReview = NonNullable<GameRow['review']>

/** Score of the game's position `i`; the first one comes from its stored lines, or older reviews' win%. */
function positionScore(review: StoredReview, i: number): Score {
  if (i > 0) return review.moves[i - 1].scoreAfter
  return review.lines?.[0]?.[0]?.score ?? scoreFromWin(review.curve[0] ?? 50)
}

/** Stored engine lines of position `i`, or just the best move for reviews made before lines were kept. */
function positionLinesFor(review: StoredReview, i: number, bestUci: string | null): PvLine[] {
  const stored = review.lines?.[i]
  if (stored?.length) return stored
  return bestUci ? [{ multipv: 1, depth: review.depth, score: positionScore(review, i), pv: [bestUci] }] : []
}

/** Normalises our own, Lichess and chess.com termination headers. */
function endReason(termination: string | undefined, fen: string): string {
  const t = (termination ?? '').toLowerCase()
  if (new Chess(fen).isCheckmate() || t.includes('checkmate')) return 'checkmate'
  if (t.includes('resign')) return 'resign'
  if (t.includes('time')) return 'timeout'
  return t || 'other'
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button className="btn px-0" onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  )
}

function Analyzing({ progress, failed }: { progress: { done: number; total: number } | null; failed: boolean }) {
  const { t } = useTranslation()
  if (failed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-fg-2">{t('review.engineFailed')}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {t('review.reload')}
        </button>
      </div>
    )
  }
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
  keyMoments,
  startFen,
  onExport,
  onReanalyze,
}: {
  keyMoments: MoveReview[]
  startFen: string
  onExport: () => void
  onReanalyze: () => void
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
      <EvalGraph curve={curve} moves={moves} ply={ply} onSelect={onSelect} startFen={startFen} height={72} />
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
        <span />
        <span className="w-[76px] truncate text-center text-[13px] font-bold">{whiteName}</span>
        <span className="w-[76px] truncate text-center text-[13px] font-bold">{blackName}</span>

        <span className="font-semibold text-fg-2">{t('review.accuracy')}</span>
        <span className={`tabular rounded-md bg-[#f1f1f1] py-1.5 text-center text-[20px] font-extrabold text-[#262421] ${userColor === 'w' ? 'ring-2 ring-accent' : ''}`}>
          {fmtDecimal(accuracy.white)}
        </span>
        <span className={`tabular rounded-md bg-[#1b1a18] py-1.5 text-center text-[20px] font-extrabold text-[#f1f1f1] ${userColor === 'b' ? 'ring-2 ring-accent' : ''}`}>
          {fmtDecimal(accuracy.black)}
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
      {keyMoments.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h2 className="mb-1.5 text-[13px] font-bold text-fg-3">{t('review.keyMoments')}</h2>
          <ul className="grid gap-1">
            {keyMoments.slice(0, 8).map((m) => (
              <li key={m.ply}>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-raise" onClick={() => onSelect(m.ply)}>
                  <QualityIcon quality={m.quality} size={20} />
                  <span className="tabular w-10 text-[13px] text-fg-3">
                    {moveNumberLabel(m.ply, startFen, '...')}
                  </span>
                  <span className="font-bold">{m.san}</span>
                  <span className="ml-auto truncate text-[13px]" style={{ color: qualityColor(m.quality) }}>
                    {t(`review.q.${m.quality}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button className="btn btn-primary btn-lg mt-4 w-full" onClick={onStart}>
        {t('review.start')}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn" onClick={onExport}>
          <DownloadSimple size={18} weight="bold" /> {t('review.exportPgn')}
        </button>
        <button className="btn" onClick={onReanalyze}>
          <ArrowsClockwise size={18} weight="bold" /> {t('review.reanalyze')}
        </button>
      </div>
    </div>
  )
}

const KEY_QUALITIES: Quality[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']

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
  fenBefore,
  scoreBefore,
  retry,
  variation,
  onBest,
  onRetry,
}: {
  move?: MoveReview
  fenBefore?: string
  scoreBefore?: Score
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
  const why = !retry && fenBefore ? explainMove(move, fenBefore, scoreBefore) : null
  const whyText = why
    ? why.key === 'hangs'
      ? t('review.why.hangs', { piece: t(`common.piece.${PIECE_NAME[why.piece]}`).toLocaleLowerCase(), square: why.square })
      : why.key === 'missedMate'
        ? t('review.why.missedMate', { count: why.n, san: why.best })
        : t('review.why.allowsMate', { count: why.n })
    : null
  const showBestLine = !retry && move.bestSan && !['best', 'book', 'forced', 'brilliant', 'great'].includes(move.quality)
  return (
    <div key={move.ply + (retry ?? '')} className="enter border-b border-line p-4">
      <div className="flex items-start gap-3">
        <QualityIcon quality={retry === 'right' ? 'best' : retry === 'wrong' ? 'mistake' : move.quality} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-snug" style={{ color: retry ? undefined : qualityColor(move.quality) }}>
            {text}
          </p>
          {whyText && <p className="mt-0.5 text-[14px] text-fg">{whyText}</p>}
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

/** The stored engine lines for the viewed position; picking one draws its first move. */
function EngineLines({
  fen,
  lines,
  missing,
  picked,
  onPick,
}: {
  fen: string
  lines?: PvLine[]
  /** review made before lines were stored */
  missing: boolean
  picked: number | null
  onPick: (i: number) => void
}) {
  const { t } = useTranslation()
  if (missing) return <p className="border-b border-line px-4 py-2 text-[12px] text-fg-3">{t('review.engineLinesHint')}</p>
  // game-over positions have nothing to show
  if (!lines?.length) return null
  return (
    <div className="border-b border-line py-1" role="group" aria-label={t('review.engineLines')}>
      {lines.slice(0, 2).map((l, i) => (
        <button
          key={i}
          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[13px] transition-colors duration-100 hover:bg-raise ${picked === i ? 'bg-raise' : ''}`}
          aria-pressed={picked === i}
          onClick={() => onPick(i)}
        >
          <span
            className={`tabular w-14 shrink-0 rounded px-1 py-0.5 text-center font-mono font-bold ${
              winPercent(l.score) >= 50 ? 'bg-[#f1f1f1] text-[#262421]' : 'bg-[#1b1a18] text-[#f1f1f1]'
            }`}
          >
            {formatScore(l.score)}
          </span>
          <span className="truncate text-fg-2">{uciLineToSan(fen, l.pv, 6).join(' ')}</span>
        </button>
      ))}
    </div>
  )
}

const PIECE_NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
