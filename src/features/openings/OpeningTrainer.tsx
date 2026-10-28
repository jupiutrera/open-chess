import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { CheckCircle, XCircle, ArrowRight, Brain } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel } from '../../ui/kit'
import { answerQuality, dueCards, grade, nextInSession } from './repertoire'
import type { RepertoireRow } from '../../db/db'
import { parseUci, playUci } from '../../chess/util'
import { play, playMoveSound } from '../../chess/sounds'

/** 'wrong': the right move is shown and has to be played; 'fixed': it was, Next is open. */
type Result = null | 'right' | 'wrong' | 'fixed'

export default function OpeningTrainer() {
  const { color = 'w' } = useParams()
  const side = color === 'b' ? 'b' : 'w'
  const { t } = useTranslation()
  const nav = useNavigate()
  const [queue, setQueue] = useState<RepertoireRow[] | null>(null)
  const [card, setCard] = useState<RepertoireRow | null>(null)
  const [fen, setFen] = useState<string>('')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [result, setResult] = useState<Result>(null)
  const [highlights, setHighlights] = useState<Map<string, string> | undefined>()
  /** cards missed this session, asked again once before "all done" */
  const missed = useRef<RepertoireRow[]>([])
  const reasking = useRef(false)
  /** a wrong move on show, before the position snaps back */
  const [flashing, setFlashing] = useState(false)
  const flash = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cardLastMove = useRef<[string, string] | null>(null)
  useEffect(() => () => clearTimeout(flash.current), [])

  const load = useCallback(async () => {
    const q = await dueCards(side)
    missed.current = []
    reasking.current = false
    setQueue(q)
    show(q[0] ?? null)
  }, [side])

  // when the current card appeared, to grade by answer time
  const shownAt = useRef(0)

  const show = (c: RepertoireRow | null) => {
    shownAt.current = performance.now()
    clearTimeout(flash.current)
    setFlashing(false)
    setCard(c)
    setResult(null)
    setHighlights(undefined)
    if (!c) return
    setFen(c.fen)
    // last move: the move before this position in the line
    const sans = c.line.split(' ')
    const ch = new Chess()
    let prev: [string, string] | null = null
    for (const s of sans) {
      if (ch.fen().split(' ').slice(0, 4).join(' ') === c.epd) break
      try {
        const m = ch.move(s)
        prev = [m.from, m.to]
      } catch {
        break
      }
    }
    cardLastMove.current = prev
    setLastMove(prev)
  }

  useEffect(() => {
    void load()
  }, [load])

  /** Shows a wrong move for a moment, then puts the card's position back. */
  const rejectMove = (after: string, from: string, to: string) => {
    if (!card) return
    play('wrong')
    clearTimeout(flash.current)
    setFlashing(true)
    setFen(after)
    setLastMove([from, to])
    setHighlights(new Map([[to, 'wrong']]))
    flash.current = setTimeout(() => {
      setFen(card.fen)
      setLastMove(cardLastMove.current)
      setHighlights(undefined)
      setFlashing(false)
    }, 650)
  }

  const onMove = async (from: string, to: string, promotion?: string) => {
    if (!card || (result !== null && result !== 'wrong')) return
    const c = new Chess(card.fen)
    const m = playUci(c, from + to + (promotion ?? ''))
    if (!m) return
    const ok = m.from + m.to + (m.promotion ?? '') === card.uci
    if (result === 'wrong') {
      // after a miss the shown move has to be played before moving on; nothing is graded here
      if (!ok) return rejectMove(c.fen(), m.from, m.to)
      playMoveSound(m)
      setFen(c.fen())
      setLastMove([m.from, m.to])
      setHighlights(new Map([[m.to, 'right']]))
      setResult('fixed')
      return
    }
    if (ok) {
      playMoveSound(m)
      play('correct')
      setFen(c.fen())
      setLastMove([m.from, m.to])
      setHighlights(new Map([[m.to, 'right']]))
      setResult('right')
      await grade(card, answerQuality(true, performance.now() - shownAt.current))
    } else {
      setResult('wrong')
      rejectMove(c.fen(), m.from, m.to)
      const graded = await grade(card, answerQuality(false, 0))
      if (!reasking.current) missed.current.push(graded)
    }
  }

  const next = () => {
    if (!queue) return
    const step = nextInSession(queue.slice(1), missed.current, reasking.current)
    if (!step) return void load()
    if (step.reasking !== reasking.current) missed.current = []
    reasking.current = step.reasking
    setQueue(step.queue)
    show(step.queue[0])
  }

  const orientation = side === 'w' ? 'white' : 'black'
  // the move to play after a miss, as an arrow
  const shapes: DrawShape[] | undefined = useMemo(() => {
    if (!card || result !== 'wrong' || flashing) return undefined
    const { from, to } = parseUci(card.uci)
    return [{ orig: from as never, dest: to as never, brush: 'green' }]
  }, [card, result, flashing])
  const canMove = card && !flashing && (result === null || result === 'wrong')

  return (
    <BoardLayout
      board={
        <Board
          fen={fen || new Chess().fen()}
          orientation={orientation}
          lastMove={lastMove}
          highlights={highlights}
          shapes={shapes}
          movable={canMove ? orientation : 'none'}
          onMove={onMove}
        />
      }
      side={
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <Brain size={22} weight="fill" className="text-[var(--q-book)]" />
            <h1 className="text-[17px] font-extrabold">{side === 'w' ? t('openings.repertoireWhite') : t('openings.repertoireBlack')}</h1>
            {queue && <span className="tabular ml-auto text-[13px] text-fg-3">{t('openings.dueCount', { count: queue.length })}</span>}
          </div>
          <div className="min-h-[140px] p-4">
            {queue && !card && (
              <div className="pop">
                <p className="mb-4 text-[17px] font-bold">{t('openings.allDone')}</p>
                <button className="btn w-full" onClick={() => nav('/openings')}>
                  {t('common.back')}
                </button>
              </div>
            )}
            {card && !result && <p className="text-[18px] font-bold">{t('openings.yourMove')}</p>}
            {card && result === 'right' && (
              <div className="pop flex items-center gap-3">
                <CheckCircle size={36} weight="fill" className="text-accent" />
                <span className="text-[18px] font-bold">{t('openings.rightRep')}</span>
              </div>
            )}
            {card && (result === 'wrong' || result === 'fixed') && (
              <div className={`${result === 'wrong' ? 'shake' : ''} flex items-center gap-3`}>
                <XCircle size={36} weight="fill" className="text-danger" />
                <div>
                  <div className="text-[17px] font-bold">{t('openings.wrongRep', { san: card.san })}</div>
                  {result === 'wrong' && <div className="text-[14px] text-fg-3">{t('openings.playShown')}</div>}
                </div>
              </div>
            )}
            {card && <p className="mt-3 truncate text-[13px] text-fg-3">{card.line}</p>}
          </div>
          {(result === 'right' || result === 'fixed') && (
            <div className="border-t border-line p-3">
              <button className="btn btn-primary btn-lg w-full" onClick={next}>
                {t('common.next')} <ArrowRight size={20} weight="bold" />
              </button>
            </div>
          )}
        </Panel>
      }
    />
  )
}
