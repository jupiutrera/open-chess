import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowsDownUp, ArrowCounterClockwise, Flag, CaretLeft, CaretRight, Handshake, X } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { useBoardKeys } from '../../board/useBoardKeys'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { MoveList, MoveStrip } from '../../board/MoveList'
import { useGame } from '../../chess/useGame'
import { useClock } from '../../chess/useClock'
import { capturedPieces, gameResultText, moveNumbering, timeoutResult } from '../../chess/util'
import { play } from '../../chess/sounds'
import { saveGame } from '../../db/games'
import { GameOverDialog, endAnnouncement, type GameEnd } from './GameOver'
import { GameAnnouncer } from '../../board/GameAnnouncer'
import { MoveInput } from '../../board/MoveInput'
import { timeControl } from './timeControl'
import { TimeControlPicker } from './TimeControlPicker'
import { Panel, Sheet, Toggle, toast } from '../../ui/kit'
import { ActionButton, cloneWithHistory } from './PlayBot'
import { clearLiveGame, loadLiveGame, saveLiveGame, type LiveGame } from './liveGame'
import { PLAYER } from './playerName'

export default function PlayLocal() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [tcId, setTcId] = useState('none')
  const [started, setStarted] = useState(false)
  const [autoFlip, setAutoFlip] = useState(false)
  const tc = timeControl(tcId)
  const game = useGame()
  const [flip, setFlip] = useState(false)
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const ended = useRef(false)
  const [saved, setSaved] = useState(() => loadLiveGame('local'))
  // applied once the chosen time control has reset the clock
  const pendingResume = useRef<LiveGame | null>(null)
  const [confirm, setConfirm] = useState<'resign' | 'draw' | null>(null)
  // bumped on a new game, so a save still running for the previous one can't attach its id to it
  const gameToken = useRef(0)
  const dialogTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hadMoves = useRef(false)

  const finish = async (e: GameEnd) => {
    if (ended.current) return
    ended.current = true
    setEnd(e)
    clock.stop()
    play('end')
    const token = gameToken.current
    const pending = saveGame({
      source: 'local',
      chess: cloneWithHistory(game.chess),
      white: PLAYER.white,
      black: PLAYER.black,
      result: e.result,
      timeControl: tc.base ? `${tc.base}+${tc.inc}` : '-',
      termination: e.reason,
    })
    // until it's in the DB the game stays resumable
    const row = await pending.catch(() => null)
    if (token !== gameToken.current) return
    if (row) {
      clearLiveGame('local')
      setSavedId(row.id)
    } else toast(t('play.saveFailed'), 'error')
    dialogTimer.current = setTimeout(() => setDialog(true), 400)
  }

  const clock = useClock(tc.base, tc.inc, (side) => void finish(timeoutResult(game.chess, side)))
  const liveFen = game.fens[game.fens.length - 1]

  useEffect(() => {
    const g = pendingResume.current
    if (!started || !g) return
    pendingResume.current = null
    game.replay(g.sans)
    if (g.clock) clock.restore(g.clock, game.chess.turn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, tc.base])

  const resume = (g: LiveGame) => {
    pendingResume.current = g
    setTcId(timeControl(g.tc).id)
    setAutoFlip(!!g.autoFlip)
    setStarted(true)
    play('start')
  }

  // autosave after every move and when the page is hidden or left
  const persist = useRef(() => {})
  persist.current = () => {
    if (ended.current || !started) return
    // taken back to the start: the old saved position mustn't stay resumable
    if (!game.chess.history().length) {
      if (hadMoves.current) clearLiveGame('local')
      return
    }
    hadMoves.current = true
    saveLiveGame({
      kind: 'local',
      tc: tcId,
      autoFlip,
      sans: game.chess.history(),
      clock: clock.enabled ? { w: clock.left('w'), b: clock.left('b') } : undefined,
    })
  }
  useEffect(() => persist.current(), [liveFen])
  useEffect(() => {
    const save = () => persist.current()
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', save)
    return () => {
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', save)
      save()
      clearTimeout(dialogTimer.current)
    }
  }, [])

  useEffect(() => {
    const r = gameResultText(game.chess)
    if (r) void finish(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFen])

  useBoardKeys({ ply: game.ply, total: game.moves.length, goto: game.goto, flip: () => setFlip((f) => !f) })

  const turn = game.chess.turn()
  const orientation = (autoFlip ? turn === 'b' : false) !== flip ? 'black' : 'white'
  const cap = useMemo(() => capturedPieces(game.fen), [game.fen])
  const numbering = useMemo(() => moveNumbering(game.startFen), [game.startFen])

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
        {saved && (
          <Panel className="mb-4 flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{t('play.localInProgress')}</div>
              <div className="tabular text-[13px] text-fg-3">{t('play.movesPlayed', { count: Math.ceil(saved.sans.length / 2) })}</div>
            </div>
            <button
              className="btn"
              onClick={() => {
                clearLiveGame('local')
                setSaved(null)
              }}
            >
              {t('play.discard')}
            </button>
            <button className="btn btn-primary" onClick={() => resume(saved)}>
              {t('play.continue')}
            </button>
          </Panel>
        )}
        <Panel className="space-y-4 p-4">
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('play.time')}</div>
            <TimeControlPicker value={tcId} onChange={setTcId} />
          </div>
          <Toggle checked={autoFlip} onChange={setAutoFlip} label={t('play.autoFlip')} />
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={() => {
              clearLiveGame('local')
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

  // from the board or typed in
  const onMove = (from: string, to: string, promotion?: string) => {
    if (ended.current || !game.atLive) return
    const before = game.chess.turn()
    if (game.move(from, to, promotion)) clock.press(before)
  }

  const newGame = () => {
    gameToken.current++
    clearTimeout(dialogTimer.current)
    hadMoves.current = false
    ended.current = false
    setEnd(null)
    setDialog(false)
    setSavedId(null)
    clearLiveGame('local')
    game.reset()
    clock.reset()
  }

  // before both sides have moved the game is dropped without a result, back to the setup
  const canAbort = game.moves.length < 2
  const abort = () => {
    newGame()
    setSaved(null)
    setStarted(false)
    toast(t('play.aborted'))
  }

  const decide = () => {
    const kind = confirm
    setConfirm(null)
    if (kind === 'resign') void finish({ result: turn === 'w' ? '0-1' : '1-0', reason: 'resign' })
    else if (kind === 'draw') void finish({ result: '1/2-1/2', reason: 'agreement' })
  }

  return (
    <>
      <GameAnnouncer moves={game.moves} result={end ? endAnnouncement(end, undefined, t) : null} />
      <BoardLayout
        top={orientation === 'white' ? bar('b') : bar('w')}
        bottom={orientation === 'white' ? bar('w') : bar('b')}
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable={end || !game.atLive ? 'none' : 'both'}
            outcome={end && game.atLive ? end : null}
            lastMove={game.lastMove}
            onMove={onMove}
          />
        }
        side={
          <Panel className="flex flex-col lg:h-full">
            <MoveStrip sans={game.sans} ply={game.ply} onSelect={game.goto} {...numbering} className="border-b border-line lg:hidden" />
            <MoveList sans={game.sans} ply={game.ply} onSelect={game.goto} {...numbering} className="hidden min-h-[120px] flex-1 py-1 lg:block" />
            {!end && <MoveInput fen={liveFen} disabled={!game.atLive} onMove={onMove} className="border-t border-line p-3" />}
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
            <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
              {end ? (
                <button className="btn btn-primary col-span-3" disabled={!savedId} onClick={() => savedId && nav(`/review/${savedId}`)}>
                  {t('play.gameReview')}
                </button>
              ) : (
                <>
                  <ActionButton
                    icon={<ArrowCounterClockwise size={22} weight="bold" />}
                    label={t('play.undo')}
                    onClick={() => {
                      const last = game.moves[game.moves.length - 1]
                      if (last) clock.unpress(last.color)
                      game.undo(1)
                      clock.setTurn(game.chess.turn())
                    }}
                    disabled={!game.moves.length}
                  />
                  <ActionButton icon={<Handshake size={22} weight="bold" />} label={t('play.draw')} onClick={() => setConfirm('draw')} disabled={canAbort} />
                  {canAbort ? (
                    <ActionButton icon={<X size={22} weight="bold" />} label={t('play.abort')} onClick={abort} />
                  ) : (
                    <ActionButton icon={<Flag size={22} weight="bold" />} label={t('play.resign')} onClick={() => setConfirm('resign')} />
                  )}
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
          onNew={newGame}
        />
      )}
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'draw' ? t('play.draw') : t('play.resign')}>
        <p className="mb-4 text-fg-2">
          {confirm === 'draw' ? t('play.confirmDraw') : t('play.confirmResignSide', { side: turn === 'w' ? t('common.white') : t('common.black') })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={decide}>
            {confirm === 'draw' ? t('play.acceptDraw') : t('play.resign')}
          </button>
        </div>
      </Sheet>
    </>
  )
}
