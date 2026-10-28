import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Lightning, Fire, Trophy, Eye, ArrowCounterClockwise, MagnifyingGlass, CaretLeft, CaretRight, SkipForward } from '@phosphor-icons/react'
import { Chess } from 'chess.js'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel, Skeleton } from '../../ui/kit'
import { getPuzzleRating, runPuzzle, rushPuzzle, recordAttempt, type Puzzle } from './puzzlesData'
import { streakTarget } from './streak'
import { usePuzzle } from './usePuzzle'
import { StatusBlock } from './PuzzleRated'
import { formatClock } from '../../board/PlayerBar'
import { kvGet, kvSet } from '../../db/db'
import { play } from '../../chess/sounds'
import { playUci } from '../../chess/util'

/** One puzzle of the run, kept for the review on the end screen. */
interface Played {
  puzzle: Puzzle
  solved: boolean
}

const MODES = ['3', '5', 'survival', 'streak']

export default function PuzzleRush() {
  const { mode = '3' } = useParams()
  // an unknown mode would run untimed under a made-up best-score key
  if (!MODES.includes(mode)) return <Navigate to="/puzzles" replace />
  return <RushRun key={mode} mode={mode} />
}

function RushRun({ mode }: { mode: string }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  // 'streak' is Puzzle Streak: untimed, harder from the user's own rating, one miss ends it
  const streak = mode === 'streak'
  const seconds = mode === '5' ? 300 : mode === '3' ? 180 : 0
  const maxStrikes = streak ? 1 : 3
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [score, setScore] = useState(0)
  const [played, setPlayed] = useState<Played[]>([])
  const [left, setLeft] = useState(seconds * 1000)
  const [best, setBest] = useState(0)
  const [record, setRecord] = useState(false)
  /** a missed puzzle opened from the end screen, and a counter to restart it */
  const [reviewing, setReviewing] = useState<Puzzle | null>(null)
  const [reviewKey, setReviewKey] = useState(0)
  /** a streak may skip one puzzle per run */
  const [skipped, setSkipped] = useState(false)
  const seen = useRef(new Set<string>())
  /** puzzle rating when the streak started; its ladder is built from it */
  const streakBase = useRef(0)
  // guards against a double end (time running out on the third miss) and late callbacks
  const over = useRef(false)
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(nextTimer.current), [])
  const strikes = played.filter((r) => !r.solved).length
  const missed = played.filter((r) => !r.solved).map((r) => r.puzzle)

  const end = useCallback(
    async (finalScore: number) => {
      if (over.current) return
      over.current = true
      clearTimeout(nextTimer.current)
      setPhase('over')
      play('end')
      const all = await kvGet<Record<string, number>>('rushBest', {})
      if (finalScore > (all[mode] ?? 0)) {
        await kvSet('rushBest', { ...all, [mode]: finalScore })
        setBest(finalScore)
        setRecord(true)
      }
    },
    [mode],
  )

  const advance = useCallback(
    async (n: number, currentScore: number) => {
      const p = streak ? await runPuzzle(streakTarget(streakBase.current, n), seen.current) : await rushPuzzle(n, seen.current)
      if (over.current) return
      if (!p) {
        // nothing left to play (e.g. offline with no cached puzzles): end the run, keeping its score
        void end(currentScore)
        return
      }
      seen.current.add(p.id)
      setPuzzle(p)
    },
    [streak, end],
  )

  const start = async () => {
    over.current = false
    seen.current = new Set()
    setScore(0)
    setPlayed([])
    setReviewing(null)
    setLeft(seconds * 1000)
    setRecord(false)
    setSkipped(false)
    setPuzzle(null)
    setPhase('running')
    play('start')
    if (streak) streakBase.current = (await getPuzzleRating()).rating
    void advance(0, 0)
  }

  const skip = () => {
    if (skipped || over.current) return
    setSkipped(true)
    setPuzzle(null)
    // same rung of the ladder: a skip neither scores nor makes the next one harder
    void advance(played.length, score)
  }

  useEffect(() => {
    void kvGet<Record<string, number>>('rushBest', {}).then((r) => setBest(r[mode] ?? 0))
  }, [mode])

  // timer
  useEffect(() => {
    if (phase !== 'running' || !seconds) return
    const t0 = performance.now()
    const startLeft = left
    const id = setInterval(() => {
      const l = startLeft - (performance.now() - t0)
      setLeft(Math.max(0, l))
      if (l <= 0) {
        clearInterval(id)
        void end(score)
      }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, score])

  const pz = usePuzzle(phase === 'running' ? puzzle : null, {
    stopOnWrong: true,
    onDone: (solved) => {
      if (!puzzle || over.current) return
      void recordAttempt(puzzle, solved, 'rush', false)
      const next = [...played, { puzzle, solved }]
      setPlayed(next)
      const nextScore = score + (solved ? 1 : 0)
      setScore(nextScore)
      if (next.filter((r) => !r.solved).length >= maxStrikes) {
        void end(nextScore)
        return
      }
      nextTimer.current = setTimeout(() => void advance(next.length, nextScore), solved ? 250 : 500)
    },
  })
  // replay of a missed puzzle: nothing is recorded
  const rv = usePuzzle(phase === 'over' ? reviewing : null)

  const openReview = (p: Puzzle) => {
    setReviewing({ ...p })
    setReviewKey((k) => k + 1)
  }

  const analysisFen = (p: Puzzle) => {
    const c = new Chess(p.fen)
    playUci(c, p.moves[0])
    return c.fen()
  }

  const orientation = pz.solverColor === 'w' ? 'white' : 'black'
  const rvOrientation = rv.solverColor === 'w' ? 'white' : 'black'

  return (
    <BoardLayout
      board={
        phase === 'running' && puzzle ? (
          <Board
            key={puzzle.id}
            fen={pz.fen}
            orientation={orientation}
            lastMove={pz.lastMove}
            highlights={pz.highlights}
            movable={pz.status === 'playing' || pz.status === 'correct' ? orientation : 'none'}
            onMove={pz.onMove}
          />
        ) : phase === 'running' ? (
          <Skeleton className="aspect-square w-full" />
        ) : phase === 'over' && reviewing ? (
          <Board
            key={`review-${reviewKey}`}
            fen={rv.fen}
            orientation={rvOrientation}
            lastMove={rv.lastMove}
            highlights={rv.highlights}
            movable={rv.status === 'playing' || rv.status === 'correct' ? rvOrientation : 'none'}
            onMove={rv.onMove}
          />
        ) : (
          <Board fen="r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3" />
        )
      }
      side={
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            {streak ? <Fire size={22} weight="fill" className="text-warn" /> : <Lightning size={22} weight="fill" className="text-[#e3742f]" />}
            <h1 className="text-[17px] font-extrabold">
              {streak
                ? t('puzzles.streakMode')
                : `${t('puzzles.rush')} · ${mode === 'survival' ? t('puzzles.survival') : mode === '5' ? t('puzzles.rush5') : t('puzzles.rush3')}`}
            </h1>
          </div>

          {phase === 'ready' && (
            <div className="p-5">
              <p className="mb-4 text-fg-2">{streak ? t('puzzles.streakSub') : t('puzzles.rushSub')}</p>
              <p className="tabular mb-4 text-fg-3">
                {t('puzzles.best')}: <b className="text-fg">{best}</b>
              </p>
              <button className="btn btn-primary btn-lg w-full" onClick={() => void start()}>
                {t('common.start')}
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-bold text-fg-3">{t('puzzles.score')}</div>
                  <div key={score} className="pop tabular text-[44px] font-extrabold leading-none">
                    {score}
                  </div>
                </div>
                {seconds > 0 && (
                  <div className={`tabular rounded-md px-3 py-1.5 font-mono text-[26px] font-bold ${left < 15000 ? 'bg-danger text-white' : 'bg-panel-2'}`}>
                    {formatClock(left)}
                  </div>
                )}
              </div>
              {!streak && (
                <div className="mt-3 flex gap-1.5" aria-label={t('puzzles.strikes')}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-200 ${i < strikes ? 'bg-danger text-white' : 'bg-panel-2 text-fg-3'}`}
                    >
                      <X size={18} weight="bold" />
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 min-h-[60px]">
                <StatusBlock status={pz.status === 'solved' ? 'correct' : pz.status} color={pz.solverColor} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {played.map((r, i) => (
                  <span key={i} className={`h-2.5 w-2.5 rounded-sm ${r.solved ? 'bg-accent' : 'bg-danger'}`} />
                ))}
              </div>
              {streak && (
                <button className="btn mt-4 w-full" onClick={skip} disabled={skipped || !puzzle || pz.status !== 'playing'}>
                  <SkipForward size={20} weight="bold" /> {skipped ? t('puzzles.skipUsed') : t('puzzles.skip')}
                </button>
              )}
            </div>
          )}

          {phase === 'over' && reviewing && (
            <div>
              <div className="flex min-h-[100px] items-center gap-3 p-4">
                <StatusBlock status={rv.status} color={rv.solverColor} />
              </div>
              <p className="tabular px-4 pb-3 text-[13px] text-fg-3">
                {t('puzzles.puzzleRating', { rating: reviewing.rating })}
                {' · '}
                {reviewing.themes
                  .slice(0, 3)
                  .map((th) => t(`themes.${th}`, th))
                  .join(', ')}
              </p>
              <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
                <button className="btn" onClick={rv.showSolution} disabled={rv.status === 'loading'}>
                  <Eye size={20} weight="bold" /> {t('puzzles.solution')}
                </button>
                <button className="btn" onClick={() => openReview(reviewing)}>
                  <ArrowCounterClockwise size={20} weight="bold" /> {t('puzzles.retry')}
                </button>
                <button className="btn" onClick={() => nav(`/analysis?fen=${encodeURIComponent(analysisFen(reviewing))}`)}>
                  <MagnifyingGlass size={20} weight="bold" /> {t('puzzles.analyze')}
                </button>
                <button className="btn" onClick={() => setReviewing(null)}>
                  <CaretLeft size={20} weight="bold" /> {t('puzzles.results')}
                </button>
              </div>
            </div>
          )}

          {phase === 'over' && !reviewing && (
            <>
              <div className="pop p-5 text-center">
                <Trophy size={40} weight="fill" className="mx-auto text-[#e3742f]" />
                <div className="mt-2 text-[15px] font-bold text-fg-2">{streak ? t('puzzles.streakOver') : t('puzzles.rushOver')}</div>
                <div className="tabular text-[56px] font-extrabold leading-tight">{score}</div>
                {record ? (
                  <div className="font-bold text-accent">{t('puzzles.newRecord')}</div>
                ) : (
                  <div className="tabular text-fg-3">
                    {t('puzzles.best')}: {best}
                  </div>
                )}
                <div className="mt-5 grid gap-2">
                  <button className="btn btn-primary btn-lg" onClick={() => void start()}>
                    {t('puzzles.playAgain')}
                  </button>
                  <button className="btn" onClick={() => nav('/puzzles')}>
                    {t('common.back')}
                  </button>
                </div>
              </div>
              {missed.length > 0 && (
                <div className="border-t border-line">
                  <h2 className="px-4 pt-3 pb-1 text-[13px] font-bold text-fg-3">{t('puzzles.missed')}</h2>
                  <ul className="divide-y divide-line">
                    {missed.map((p) => (
                      <li key={p.id}>
                        <button
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-raise/50"
                          onClick={() => openReview(p)}
                        >
                          <span className="tabular w-12 shrink-0 font-bold">{p.rating}</span>
                          <span className="min-w-0 flex-1 truncate text-[14px] text-fg-2">
                            {p.themes
                              .slice(0, 3)
                              .map((th) => t(`themes.${th}`, th))
                              .join(', ')}
                          </span>
                          <CaretRight size={18} className="shrink-0 text-fg-3" aria-hidden />
                          <span className="sr-only">{t('puzzles.view')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      }
    />
  )
}
