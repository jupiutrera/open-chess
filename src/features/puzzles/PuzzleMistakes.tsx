import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, ArrowRight, MagnifyingGlass, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel, Skeleton } from '../../ui/kit'
import { recordAttempt } from './puzzlesData'
import { usePuzzle } from './usePuzzle'
import { StatusBlock } from './PuzzleRated'
import { mistakePuzzles, type MistakePuzzle } from './mistakes'

/** Replays the positions where the user went wrong in their reviewed games. */
export default function PuzzleMistakes() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [list, setList] = useState<MistakePuzzle[] | null>(null)
  const [i, setI] = useState(0)
  const [key, setKey] = useState(0)
  const recorded = useRef<string | null>(null)

  useEffect(() => {
    void mistakePuzzles().then(setList)
  }, [])

  // a fresh object per attempt: usePuzzle restarts when the puzzle changes
  const puzzle = useMemo(() => (list?.[i] ? { ...list[i] } : null), [list, i, key])
  const pz = usePuzzle(puzzle, {
    onDone: (solved) => {
      if (!puzzle || recorded.current === puzzle.id + key) return
      recorded.current = puzzle.id + key
      void recordAttempt(puzzle, solved, 'mistakes', false)
    },
  })
  const orientation = pz.solverColor === 'w' ? 'white' : 'black'
  const done = pz.status === 'solved' || pz.status === 'failed'

  if (list && !list.length)
    return (
      <div className="mx-auto max-w-md p-6">
        <Panel className="space-y-3 p-5">
          <h1 className="text-[19px] font-extrabold">{t('puzzles.mistakes')}</h1>
          <p className="text-fg-2">{t('puzzles.mistakesEmpty')}</p>
          <Link to="/games" className="btn btn-primary">
            {t('nav.games')}
          </Link>
        </Panel>
      </div>
    )

  return (
    <BoardLayout
      board={
        puzzle ? (
          <Board
            key={`${puzzle.id}-${key}`}
            fen={pz.fen}
            orientation={orientation}
            lastMove={pz.lastMove}
            highlights={pz.highlights}
            movable={pz.status === 'playing' ? orientation : 'none'}
            onMove={pz.onMove}
          />
        ) : (
          <Skeleton className="aspect-square w-full" />
        )
      }
      side={
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <h1 className="text-[17px] font-extrabold">{t('puzzles.mistakes')}</h1>
            {list && (
              <span className="tabular ml-auto text-[13px] font-semibold text-fg-3">
                {i + 1} / {list.length}
              </span>
            )}
          </div>
          <div className="flex min-h-[132px] items-center gap-3 p-4">
            <StatusBlock status={pz.status} color={pz.solverColor} />
          </div>
          {puzzle && (
            <p className="px-4 pb-3 text-[14px] text-fg-2">
              {t('puzzles.mistakeContext', { opponent: puzzle.opponent, san: puzzle.san, quality: t(`review.q.${puzzle.quality}`).toLocaleLowerCase() })}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
            {done ? (
              <>
                {list && i + 1 < list.length && (
                  <button
                    className="btn btn-primary btn-lg col-span-2"
                    onClick={() => {
                      setI(i + 1)
                      setKey((k) => k + 1)
                    }}
                  >
                    {t('puzzles.next')} <ArrowRight size={20} weight="bold" />
                  </button>
                )}
                <button className="btn" onClick={() => setKey((k) => k + 1)}>
                  <ArrowCounterClockwise size={20} weight="bold" /> {t('puzzles.retry')}
                </button>
                <button className="btn" onClick={() => puzzle && nav(`/review/${puzzle.gameId}`)}>
                  <MagnifyingGlass size={20} weight="bold" /> {t('puzzles.seeGame')}
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
