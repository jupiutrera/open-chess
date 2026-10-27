import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Lightning, Trophy } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel, Skeleton } from '../../ui/kit'
import { rushPuzzle, recordAttempt, type Puzzle } from './puzzlesData'
import { usePuzzle } from './usePuzzle'
import { StatusBlock } from './PuzzleRated'
import { formatClock } from '../../board/PlayerBar'
import { kvGet, kvSet } from '../../db/db'
import { play } from '../../chess/sounds'

export default function PuzzleRush() {
  const { mode = '3' } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const seconds = mode === '5' ? 300 : mode === '3' ? 180 : 0
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [score, setScore] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [left, setLeft] = useState(seconds * 1000)
  const [best, setBest] = useState(0)
  const [record, setRecord] = useState(false)
  const seen = useRef(new Set<string>())
  // guards against a double end (time running out on the third miss) and late callbacks
  const over = useRef(false)
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(nextTimer.current), [])
  const strikes = results.filter((r) => !r).length

  const advance = useCallback(async (n: number) => {
    const p = await rushPuzzle(n, seen.current)
    if (over.current) return
    if (!p) {
      // nothing left to play (e.g. offline with no cached puzzles): end the run instead of hanging
      setPhase('over')
      over.current = true
      return
    }
    seen.current.add(p.id)
    setPuzzle(p)
  }, [])

  const start = () => {
    over.current = false
    seen.current = new Set()
    setScore(0)
    setResults([])
    setLeft(seconds * 1000)
    setRecord(false)
    setPhase('running')
    play('start')
    void advance(0)
  }

  useEffect(() => {
    void kvGet<Record<string, number>>('rushBest', {}).then((r) => setBest(r[mode] ?? 0))
  }, [mode])

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
      const nextResults = [...results, solved]
      setResults(nextResults)
      const nextScore = score + (solved ? 1 : 0)
      setScore(nextScore)
      if (nextResults.filter((r) => !r).length >= 3) {
        void end(nextScore)
        return
      }
      nextTimer.current = setTimeout(() => void advance(nextResults.length), solved ? 250 : 500)
    },
  })

  const orientation = pz.solverColor === 'w' ? 'white' : 'black'

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
        ) : (
          <Board fen="r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3" />
        )
      }
      side={
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <Lightning size={22} weight="fill" className="text-[#e3742f]" />
            <h1 className="text-[17px] font-extrabold">
              {t('puzzles.rush')} · {mode === 'survival' ? t('puzzles.survival') : mode === '5' ? t('puzzles.rush5') : t('puzzles.rush3')}
            </h1>
          </div>

          {phase === 'ready' && (
            <div className="p-5">
              <p className="mb-4 text-fg-2">{t('puzzles.rushSub')}</p>
              <p className="tabular mb-4 text-fg-3">
                {t('puzzles.best')}: <b className="text-fg">{best}</b>
              </p>
              <button className="btn btn-primary btn-lg w-full" onClick={start}>
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
              <div className="mt-4 min-h-[60px]">
                <StatusBlock status={pz.status === 'solved' ? 'correct' : pz.status} color={pz.solverColor} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {results.map((r, i) => (
                  <span key={i} className={`h-2.5 w-2.5 rounded-sm ${r ? 'bg-accent' : 'bg-danger'}`} />
                ))}
              </div>
            </div>
          )}

          {phase === 'over' && (
            <div className="pop p-5 text-center">
              <Trophy size={40} weight="fill" className="mx-auto text-[#e3742f]" />
              <div className="mt-2 text-[15px] font-bold text-fg-2">{t('puzzles.rushOver')}</div>
              <div className="tabular text-[56px] font-extrabold leading-tight">{score}</div>
              {record ? (
                <div className="font-bold text-accent">{t('puzzles.newRecord')}</div>
              ) : (
                <div className="tabular text-fg-3">
                  {t('puzzles.best')}: {best}
                </div>
              )}
              <div className="mt-5 grid gap-2">
                <button className="btn btn-primary btn-lg" onClick={start}>
                  {t('puzzles.playAgain')}
                </button>
                <button className="btn" onClick={() => nav('/puzzles')}>
                  {t('common.back')}
                </button>
              </div>
            </div>
          )}
        </Panel>
      }
    />
  )
}
