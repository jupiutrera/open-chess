import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { CheckCircle, XCircle, ArrowRight, ArrowCounterClockwise, GraduationCap, Lightbulb } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel } from '../../ui/kit'
import { LESSONS, type LessonStep } from './lessonData'
import { useSettings } from '../../settings'
import { parseUci, playUci } from '../../chess/util'
import { play, playMoveSound } from '../../chess/sounds'
import { sharedEngine } from '../../engine/engine'
import { db, put, type LessonProgressRow } from '../../db/db'

type State = 'playing' | 'wrong' | 'stepDone' | 'failed' | 'thinking'

export default function LessonPlayer() {
  const { id } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const idx = LESSONS.findIndex((l) => l.id === id)
  const lesson = LESSONS[idx]
  const [stepIdx, setStepIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const step: LessonStep | undefined = lesson?.steps[stepIdx]
  const chess = useRef(new Chess())
  const [fen, setFen] = useState(step?.fen ?? '')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [state, setState] = useState<State>('playing')
  const [highlights, setHighlights] = useState<Map<string, string> | undefined>()
  const ply = useRef(0)
  const [attempt, setAttempt] = useState(0)

  const solver: 'w' | 'b' = step ? (new Chess(step.fen).turn() as 'w' | 'b') : 'w'

  useEffect(() => {
    if (!step) return
    chess.current = new Chess(step.fen)
    ply.current = 0
    setFen(step.fen)
    setLastMove(null)
    setHighlights(undefined)
    setState('playing')
    if (step.kind === 'practice') void sharedEngine().newGame()
  }, [step, attempt])

  const saveProgress = useCallback(
    async (stepsDone: number, completed: boolean) => {
      if (!lesson) return
      const existing = await db.lessonProgress.where('lessonId').equals(lesson.id).first()
      await put<LessonProgressRow>('lessonProgress', {
        id: existing?.id ?? lesson.id,
        lessonId: lesson.id,
        stepsDone: Math.max(stepsDone, existing?.stepsDone ?? 0),
        completed: completed || !!existing?.completed,
      })
    },
    [lesson],
  )

  const stepComplete = () => {
    play('correct')
    setState('stepDone')
    const isLast = stepIdx === lesson!.steps.length - 1
    void saveProgress(stepIdx + 1, isLast)
  }

  const engineReply = async () => {
    if (!step || step.kind !== 'practice') return
    setState('thinking')
    const r = await sharedEngine().search(chess.current.fen(), { movetime: 350, elo: step.elo })
    if (!r.bestmove) return
    const m = playUci(chess.current, r.bestmove)
    if (m) {
      playMoveSound(m)
      setLastMove([m.from, m.to])
      setFen(chess.current.fen())
    }
    if (chess.current.isGameOver()) {
      play('wrong')
      setState('failed')
    } else setState('playing')
  }

  const onMove = (from: string, to: string, promotion?: string) => {
    if (!step || state !== 'playing') return
    if (step.kind === 'puzzle') {
      const expected = step.moves[ply.current]
      const trial = new Chess(chess.current.fen())
      const m = playUci(trial, from + to + (promotion ?? (expected?.length === 5 ? expected[4] : '')))
      if (!m) return
      const uci = m.from + m.to + (m.promotion ?? '')
      const last = ply.current === step.moves.length - 1
      if (uci === expected || (last && trial.isCheckmate())) {
        chess.current = trial
        playMoveSound(m)
        setFen(trial.fen())
        setLastMove([m.from, m.to])
        setHighlights(new Map([[m.to, 'right']]))
        ply.current++
        if (ply.current >= step.moves.length) return stepComplete()
        setTimeout(() => {
          const reply = playUci(chess.current, step.moves[ply.current])
          if (reply) {
            playMoveSound(reply)
            setLastMove([reply.from, reply.to])
          }
          ply.current++
          setFen(chess.current.fen())
          setHighlights(undefined)
        }, 450)
      } else {
        play('wrong')
        setState('wrong')
        setFen(trial.fen())
        setHighlights(new Map([[m.to, 'wrong']]))
        setTimeout(() => {
          setFen(chess.current.fen())
          setHighlights(undefined)
          setState('playing')
        }, 700)
      }
      return
    }
    // practice against the engine
    const m = playUci(chess.current, from + to + (promotion ?? ''))
    if (!m) return
    playMoveSound(m)
    setLastMove([m.from, m.to])
    setFen(chess.current.fen())
    if (chess.current.isCheckmate()) return stepComplete()
    if (chess.current.isGameOver()) {
      if (step.goal === 'draw') return stepComplete()
      play('wrong')
      return setState('failed')
    }
    void engineReply()
  }

  const hint = () => {
    if (!step || state !== 'playing') return
    if (step.kind === 'puzzle') {
      setHighlights(new Map([[parseUci(step.moves[ply.current]).from, 'hint-from']]))
    } else {
      void sharedEngine()
        .search(chess.current.fen(), { depth: 14 })
        .then((r) => r.bestmove && setHighlights(new Map([[parseUci(r.bestmove).from, 'hint-from']])))
    }
  }

  if (!lesson || !step) {
    return <div className="p-6 text-fg-2">404</div>
  }

  const next = () => {
    if (stepIdx < lesson.steps.length - 1) setStepIdx((s) => s + 1)
    else setFinished(true)
  }
  const nextLesson = LESSONS[idx + 1]
  const orientation = solver === 'w' ? 'white' : 'black'

  return (
    <BoardLayout
      board={
        <Board
          key={`${stepIdx}-${attempt}`}
          fen={fen}
          orientation={orientation}
          lastMove={lastMove}
          highlights={highlights}
          movable={state === 'playing' && !finished ? orientation : 'none'}
          onMove={onMove}
        />
      }
      side={
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <GraduationCap size={22} weight="fill" className="text-[#3d8fd1]" />
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{lesson.title[lang]}</h1>
            <span className="tabular text-[13px] text-fg-3">{t('lessons.step', { n: stepIdx + 1, total: lesson.steps.length })}</span>
          </div>
          <div className="flex gap-1 px-4 pt-3" aria-hidden>
            {lesson.steps.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < stepIdx || (i === stepIdx && (state === 'stepDone' || finished)) ? 'bg-accent' : 'bg-raise'}`} />
            ))}
          </div>
          <div className="p-4">
            {finished ? (
              <div className="pop text-center">
                <CheckCircle size={44} weight="fill" className="mx-auto text-accent" />
                <p className="mt-2 text-[20px] font-extrabold">{t('lessons.finished')}</p>
                <div className="mt-4 grid gap-2">
                  {nextLesson && (
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => {
                        setStepIdx(0)
                        setFinished(false)
                        nav(`/lessons/${nextLesson.id}`)
                      }}
                    >
                      {t('lessons.nextLesson')} <ArrowRight size={20} weight="bold" />
                    </button>
                  )}
                  <button className="btn" onClick={() => nav('/lessons')}>
                    {t('lessons.title')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {stepIdx === 0 && <p className="mb-3 max-w-[60ch] text-[14px] text-fg-2">{lesson.intro[lang]}</p>}
                <p className="text-[17px] font-bold">{step.text[lang]}</p>
                {step.kind === 'practice' && (
                  <p className="mt-1 text-[13px] text-fg-3">
                    {t('lessons.practice')} · {t('lessons.practiceGoal', { goal: t(`lessons.goal.${step.goal}`) })}
                  </p>
                )}
                <div className="mt-4 min-h-10">
                  {state === 'wrong' && (
                    <div className="shake flex items-center gap-2 font-bold text-danger">
                      <XCircle size={26} weight="fill" /> {t('lessons.tryAgain')}
                    </div>
                  )}
                  {state === 'stepDone' && (
                    <div className="pop flex items-center gap-2 font-bold text-accent">
                      <CheckCircle size={26} weight="fill" /> {step.kind === 'practice' ? t('lessons.success') : t('lessons.wellDone')}
                    </div>
                  )}
                  {state === 'failed' && (
                    <div className="shake flex items-center gap-2 font-bold text-danger">
                      <XCircle size={26} weight="fill" /> {t('lessons.failure')}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {!finished && (
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              {state === 'stepDone' ? (
                <button className="btn btn-primary col-span-2 btn-lg" onClick={next}>
                  {t('common.next')} <ArrowRight size={20} weight="bold" />
                </button>
              ) : (
                <>
                  <button className="btn" onClick={hint} disabled={state !== 'playing'}>
                    <Lightbulb size={20} weight="bold" /> {t('puzzles.hint')}
                  </button>
                  <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
                    <ArrowCounterClockwise size={20} weight="bold" /> {t('common.retry')}
                  </button>
                </>
              )}
            </div>
          )}
        </Panel>
      }
    />
  )
}
