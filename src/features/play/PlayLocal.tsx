import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowsDownUp, ArrowCounterClockwise, Flag, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { MoveList } from '../../board/MoveList'
import { useGame } from '../../chess/useGame'
import { useClock } from '../../chess/useClock'
import { capturedPieces, gameResultText } from '../../chess/util'
import { play } from '../../chess/sounds'
import { saveGame } from '../../db/games'
import { GameOverDialog, type GameEnd } from './GameOver'
import { TIME_CONTROLS } from './PlayHub'
import { Panel, Toggle } from '../../ui/kit'
import { cloneWithHistory } from './PlayBot'

export default function PlayLocal() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [tcId, setTcId] = useState('none')
  const [started, setStarted] = useState(false)
  const [autoFlip, setAutoFlip] = useState(false)
  const tc = TIME_CONTROLS.find((c) => c.id === tcId)!
  const game = useGame()
  const [flip, setFlip] = useState(false)
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const ended = useRef(false)

  const finish = async (e: GameEnd) => {
    if (ended.current) return
    ended.current = true
    setEnd(e)
    clock.stop()
    play('end')
    const row = await saveGame({
      source: 'local',
      chess: cloneWithHistory(game.chess),
      white: t('common.white'),
      black: t('common.black'),
      result: e.result,
      timeControl: tc.base ? `${tc.base}+${tc.inc}` : '-',
      termination: e.reason,
    })
    setSavedId(row.id)
    setTimeout(() => setDialog(true), 400)
  }

  const clock = useClock(tc.base, tc.inc, (side) => void finish({ result: side === 'w' ? '0-1' : '1-0', reason: 'timeout' }))
  const liveFen = game.fens[game.fens.length - 1]

  useEffect(() => {
    const r = gameResultText(game.chess)
    if (r) void finish(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFen])

  const turn = game.chess.turn()
  const orientation = (autoFlip ? turn === 'b' : false) !== flip ? 'black' : 'white'
  const cap = useMemo(() => capturedPieces(game.fen), [game.fen])

  const bar = (c: 'w' | 'b') => (
    <PlayerBar
      name={c === 'w' ? t('common.white') : t('common.black')}
      color={c}
      captured={c === 'w' ? cap.byWhite : cap.byBlack}
      advantage={c === 'w' ? cap.diff : -cap.diff}
      clock={clock.enabled ? clock.time[c] : undefined}
      clockActive={clock.active === c}
      hue={c === 'w' ? 40 : 230}
    />
  )

  if (!started) {
    return (
      <div className="mx-auto max-w-md p-4 lg:p-6">
        <h1 className="mb-4 text-[24px] font-extrabold">{t('play.local')}</h1>
        <Panel className="space-y-4 p-4">
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('play.time')}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_CONTROLS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTcId(c.id)}
                  className={`tabular min-h-10 rounded-md text-[14px] font-bold ${tcId === c.id ? 'bg-raise-2 ring-2 ring-accent' : 'bg-panel-2 text-fg-2'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle checked={autoFlip} onChange={setAutoFlip} label={t('play.autoFlip')} />
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={() => {
              setStarted(true)
              play('start')
            }}
          >
            {t('common.start')}
          </button>
        </Panel>
      </div>
    )
  }

  return (
    <>
      <BoardLayout
        top={orientation === 'white' ? bar('b') : bar('w')}
        bottom={orientation === 'white' ? bar('w') : bar('b')}
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable={end || !game.atLive ? 'none' : 'both'}
            lastMove={game.lastMove}
            onMove={(f, to, p) => {
              const before = game.chess.turn()
              if (game.move(f, to, p)) clock.press(before)
            }}
          />
        }
        side={
          <Panel className="flex flex-col lg:h-[min(calc(100dvh-140px),720px)]">
            <MoveList sans={game.sans} ply={game.ply} onSelect={game.goto} className="min-h-[120px] flex-1 py-1" />
            <div className="flex items-center justify-center gap-1 border-t border-line p-2">
              <button className="btn btn-ghost btn-icon" onClick={() => game.goto(game.ply - 1)} aria-label={t('review.prev')}>
                <CaretLeft size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => game.goto(game.ply + 1)} aria-label={t('review.next')}>
                <CaretRight size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => setFlip((f) => !f)} aria-label={t('common.flip')}>
                <ArrowsDownUp size={22} weight="bold" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              {end ? (
                <button className="btn btn-primary col-span-2" disabled={!savedId} onClick={() => savedId && nav(`/review/${savedId}`)}>
                  {t('play.gameReview')}
                </button>
              ) : (
                <>
                  <button className="btn" onClick={() => game.undo(1)} disabled={!game.moves.length}>
                    <ArrowCounterClockwise size={20} weight="bold" /> {t('play.undo')}
                  </button>
                  <button className="btn" onClick={() => void finish({ result: turn === 'w' ? '0-1' : '1-0', reason: 'resign' })}>
                    <Flag size={20} weight="bold" /> {t('play.resign')}
                  </button>
                </>
              )}
            </div>
          </Panel>
        }
      />
      {end && (
        <GameOverDialog
          end={end}
          open={dialog}
          onClose={() => setDialog(false)}
          onReview={() => savedId && nav(`/review/${savedId}`)}
          reviewReady={!!savedId}
          onNew={() => {
            ended.current = false
            setEnd(null)
            setDialog(false)
            game.reset()
            clock.reset()
          }}
        />
      )}
    </>
  )
}
