import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, ArrowRight, MagnifyingGlass, CheckCircle, XCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Chess } from 'chess.js'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel, Skeleton } from '../../ui/kit'
import { dailyPuzzle, getPuzzleRating, nextPuzzle, noPuzzleReason, recordAttempt, triedIn, type NoPuzzleReason, type Puzzle } from './puzzlesData'
import { usePuzzle } from './usePuzzle'
import { PieceIcon } from '../../board/QualityIcon'
import { playUci } from '../../chess/util'

export default function PuzzleRated({ daily = false }: { daily?: boolean }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const theme = params.get('theme') ?? undefined
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [empty, setEmpty] = useState<NoPuzzleReason | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [delta, setDelta] = useState<number | null>(null)
  const [key, setKey] = useState(0)
  /** the theme ('' for none) whose unplayed puzzles ran out and the user asked for played ones again */
  const [seenOk, setSeenOk] = useState<string | null>(null)
  const includeSeen = seenOk === (theme ?? '')
  const setIncludeSeen = () => setSeenOk(theme ?? '')

  const load = useCallback(async () => {
    setDelta(null)
    const r = await getPuzzleRating()
    setRating(r.rating)
    const p = daily ? await dailyPuzzle() : await nextPuzzle(r.rating, { theme, includeSeen })
    setEmpty(p ? null : await noPuzzleReason())
    setPuzzle(p)
    setKey((k) => k + 1)
  }, [daily, theme, includeSeen])

  useEffect(() => {
    void load()
  }, [load])

  const recorded = useRef<string | null>(null)
  const retry = () => {
    setPuzzle((p) => (p ? { ...p } : p))
    setKey((k) => k + 1)
  }

  const pz = usePuzzle(puzzle, {
    onDone: async (solved) => {
      if (!puzzle || recorded.current === puzzle.id) return
      recorded.current = puzzle.id
      // the daily puzzle counts once: coming back to it later is practice
      if (daily && (await triedIn(puzzle.id, 'daily'))) return
      const before = rating ?? 0
      const after = await recordAttempt(puzzle, solved, daily ? 'daily' : theme ? 'theme' : 'rated', !daily)
      if (after !== undefined) {
        setDelta(after - before)
        setRating(after)
      }
    },
  })

  const orientation = pz.solverColor === 'w' ? 'white' : 'black'
  const done = pz.status === 'solved' || pz.status === 'failed'

  if (empty)
    return (
      <div className="mx-auto max-w-md p-6">
        <Panel className="space-y-4 p-5">
          <p className="text-fg-2">
            {empty === 'offline' ? t('puzzles.offline') : empty === 'missing' ? t('puzzles.noData') : theme ? t('puzzles.themeExhausted') : t('puzzles.exhausted')}
          </p>
          <div className="flex flex-wrap gap-2">
            {empty === 'exhausted' && !daily && (
              <button className="btn btn-primary" onClick={setIncludeSeen}>
                {t('puzzles.includePlayed')}
              </button>
            )}
            {empty === 'offline' && (
              <button className="btn btn-primary" onClick={() => void load()}>
                <ArrowCounterClockwise size={20} weight="bold" /> {t('common.retry')}
              </button>
            )}
            <button className="btn" onClick={() => nav('/puzzles')}>
              {t('common.back')}
            </button>
          </div>
        </Panel>
      </div>
    )

  const analysisFen = () => {
    if (!puzzle) return ''
    const c = new Chess(puzzle.fen)
    playUci(c, puzzle.moves[0])
    return c.fen()
  }

  return (
    <BoardLayout
      board={
        puzzle ? (
          <Board
            key={key}
            fen={pz.fen}
            orientation={orientation}
            lastMove={pz.lastMove}
            highlights={pz.highlights}
            movable={pz.status === 'playing' || pz.status === 'correct' ? orientation : 'none'}
            onMove={pz.onMove}
          />
        ) : (
          <Skeleton className="aspect-square w-full" />
        )
      }
      side={
        <Panel className="flex flex-col overflow-hidden">
          <div className="border-b border-line p-4">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-extrabold">
                {daily ? t('puzzles.daily') : theme ? t(`themes.${theme}`, theme) : t('puzzles.rated')}
              </h1>
              {rating !== null && !daily && (
                <span className="tabular ml-auto rounded-md bg-panel-2 px-2.5 py-1 font-bold">
                  {rating}
                  {delta !== null && (
                    <span className={`ml-1.5 ${delta >= 0 ? 'text-accent' : 'text-danger'}`}>
                      {delta >= 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-h-[132px] items-center gap-3 p-4">
            <StatusBlock status={pz.status} color={pz.solverColor} />
          </div>

          {puzzle && done && (
            <p className="tabular px-4 pb-3 text-[13px] text-fg-3">
              {t('puzzles.puzzleRating', { rating: puzzle.rating })}
              {' · '}
              {puzzle.themes
                .slice(0, 4)
                .map((th) => t(`themes.${th}`, th))
                .join(', ')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
            {done ? (
              <>
                {!daily && (
                  <button className="btn btn-primary col-span-2 btn-lg" onClick={() => void load()}>
                    {t('puzzles.next')} <ArrowRight size={20} weight="bold" />
                  </button>
                )}
                <button className="btn" onClick={retry}>
                  <ArrowCounterClockwise size={20} weight="bold" /> {t('puzzles.retry')}
                </button>
                <button className="btn" onClick={() => nav(`/analysis?fen=${encodeURIComponent(analysisFen())}`)}>
                  <MagnifyingGlass size={20} weight="bold" /> {t('puzzles.analyze')}
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={pz.hint} disabled={pz.status !== 'playing'}>
                  <Lightbulb size={20} weight="bold" /> {t('puzzles.hint')}
                </button>
                <button className="btn" onClick={pz.showSolution} disabled={pz.status === 'loading'}>
                  <Eye size={20} weight="bold" /> {t('puzzles.solution')}
                </button>
              </>
            )}
          </div>
        </Panel>
      }
    />
  )
}

export function StatusBlock({ status, color }: { status: string; color: 'w' | 'b' }) {
  const { t } = useTranslation()
  if (status === 'solved')
    return (
      <div key="s" className="pop flex items-center gap-3">
        <CheckCircle size={40} weight="fill" className="text-accent" />
        <span className="text-[20px] font-extrabold">{t('puzzles.solved')}</span>
      </div>
    )
  if (status === 'failed')
    return (
      <div key="f" className="pop flex items-center gap-3">
        <XCircle size={40} weight="fill" className="text-danger" />
        <span className="text-[20px] font-extrabold">{t('puzzles.failed')}</span>
      </div>
    )
  if (status === 'wrong')
    return (
      <div key="w" className="shake flex items-center gap-3">
        <XCircle size={40} weight="fill" className="text-danger" />
        <span className="text-[18px] font-bold">{t('puzzles.incorrect')}</span>
      </div>
    )
  if (status === 'checking')
    return (
      <div className="flex items-center gap-3" aria-live="polite">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-raise border-t-accent motion-reduce:animate-none" aria-hidden />
        <span className="text-[18px] font-bold">{t('puzzles.checking')}</span>
      </div>
    )
  if (status === 'correct')
    return (
      <div key="c" className="pop flex items-center gap-3">
        <CheckCircle size={40} weight="fill" className="text-accent" />
        <span className="text-[18px] font-bold">{t('puzzles.keepGoing')}</span>
      </div>
    )
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-11 w-11 place-items-center rounded-lg ${color === 'w' ? 'bg-[#f1f1f1]' : 'bg-[#1b1a18]'}`}>
        <PieceIcon piece="k" color={color} size={34} />
      </span>
      <div>
        <div className="text-[18px] font-extrabold">{color === 'w' ? t('puzzles.yourTurn') : t('puzzles.yourTurnBlack')}</div>
        <div className="text-[14px] text-fg-3">{t('puzzles.findBest')}</div>
      </div>
    </div>
  )
}
