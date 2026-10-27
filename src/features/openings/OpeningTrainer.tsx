import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { CheckCircle, XCircle, ArrowRight, Brain } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { Panel } from '../../ui/kit'
import { answerQuality, dueCards, grade } from './repertoire'
import type { RepertoireRow } from '../../db/db'
import { playUci } from '../../chess/util'
import { play, playMoveSound } from '../../chess/sounds'

export default function OpeningTrainer() {
  const { color = 'w' } = useParams()
  const side = color === 'b' ? 'b' : 'w'
  const { t } = useTranslation()
  const nav = useNavigate()
  const [queue, setQueue] = useState<RepertoireRow[] | null>(null)
  const [card, setCard] = useState<RepertoireRow | null>(null)
  const [fen, setFen] = useState<string>('')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [result, setResult] = useState<null | 'right' | 'wrong'>(null)
  const [highlights, setHighlights] = useState<Map<string, string> | undefined>()

  const load = useCallback(async () => {
    const q = await dueCards(side)
    setQueue(q)
    show(q[0] ?? null)
  }, [side])

  // when the current card appeared, to grade by answer time
  const shownAt = useRef(0)

  const show = (c: RepertoireRow | null) => {
    shownAt.current = performance.now()
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
    setLastMove(prev)
  }

  useEffect(() => {
    void load()
  }, [load])

  const onMove = async (from: string, to: string, promotion?: string) => {
    if (!card || result) return
    const c = new Chess(card.fen)
    const m = playUci(c, from + to + (promotion ?? ''))
    if (!m) return
    const ok = m.from + m.to + (m.promotion ?? '') === card.uci
    if (ok) {
      playMoveSound(m)
      play('correct')
      setFen(c.fen())
      setLastMove([m.from, m.to])
      setHighlights(new Map([[m.to, 'right']]))
      setResult('right')
      await grade(card, answerQuality(true, performance.now() - shownAt.current))
    } else {
      play('wrong')
      setResult('wrong')
      const right = new Chess(card.fen)
      const rm = playUci(right, card.uci)!
      setFen(right.fen())
      setLastMove([rm.from, rm.to])
      setHighlights(new Map([[m.to, 'wrong'], [rm.to, 'right']]))
      await grade(card, answerQuality(false, 0))
    }
  }

  const next = () => {
    if (!queue) return
    const rest = queue.slice(1)
    setQueue(rest)
    if (rest.length) show(rest[0])
    else void load()
  }

  const orientation = side === 'w' ? 'white' : 'black'

  return (
    <BoardLayout
      board={<Board fen={fen || new Chess().fen()} orientation={orientation} lastMove={lastMove} highlights={highlights} movable={card && !result ? orientation : 'none'} onMove={onMove} />}
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
            {card && result === 'wrong' && (
              <div className="shake flex items-center gap-3">
                <XCircle size={36} weight="fill" className="text-danger" />
                <span className="text-[17px] font-bold">{t('openings.wrongRep', { san: card.san })}</span>
              </div>
            )}
            {card && <p className="mt-3 truncate text-[13px] text-fg-3">{card.line}</p>}
          </div>
          {result && (
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
