import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { Lightbulb, ArrowCounterClockwise, Flag, Handshake, ArrowsDownUp, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar, Avatar } from '../../board/PlayerBar'
import { MoveList } from '../../board/MoveList'
import { EvalBar, EvalStrip } from '../../board/EvalBar'
import { useGame } from '../../chess/useGame'
import { useClock } from '../../chess/useClock'
import { capturedPieces, gameResultText, parseUci } from '../../chess/util'
import { play } from '../../chess/sounds'
import { Engine, sharedEngine, type Score } from '../../engine/engine'
import { botAcceptsDraw, botById, botMove } from './bots'
import { TIME_CONTROLS } from './PlayHub'
import { GameOverDialog, type GameEnd } from './GameOver'
import { saveGame } from '../../db/games'
import { winPercent } from '../review/classify'
import { Panel, Sheet, toast } from '../../ui/kit'
import type { DrawShape } from '@lichess-org/chessground/draw'

export default function PlayBot() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { botId = 'ivan' } = useParams()
  const [params] = useSearchParams()
  const bot = botById(botId) ?? botById('ivan')!
  const tc = TIME_CONTROLS.find((c) => c.id === params.get('tc')) ?? TIME_CONTROLS[0]
  const allowHints = params.get('hints') !== '0'
  const allowUndo = params.get('undo') !== '0'
  const showEval = params.get('eval') === '1'

  const pickColor = useCallback(() => {
    const c = params.get('color')
    return c === 'b' ? 'b' : c === 'w' ? 'w' : Math.random() < 0.5 ? 'w' : 'b'
  }, [params])
  const [userColor, setUserColor] = useState<'w' | 'b'>(pickColor)
  const [orientation, setOrientation] = useState<'white' | 'black'>(userColor === 'w' ? 'white' : 'black')
  const game = useGame()
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [hint, setHint] = useState<DrawShape[]>([])
  const [evalScore, setEvalScore] = useState<Score | undefined>()
  const [confirmResign, setConfirmResign] = useState(false)
  const evalEngine = useRef<Engine | null>(null)
  const endRef = useRef<GameEnd | null>(null)

  const finish = useCallback(
    async (e: GameEnd) => {
      if (endRef.current) return
      endRef.current = e
      setEnd(e)
      clock.stop()
      play(e.result === '1/2-1/2' ? 'draw' : (e.result === '1-0') === (userColor === 'w') ? 'win' : 'lose')
      const row = await saveGame({
        source: 'bot',
        chess: cloneWithHistory(game.chess),
        white: userColor === 'w' ? t('common.you') : bot.name,
        black: userColor === 'b' ? t('common.you') : bot.name,
        whiteElo: userColor === 'w' ? undefined : bot.elo,
        blackElo: userColor === 'b' ? undefined : bot.elo,
        result: e.result,
        userColor,
        botId: bot.id,
        timeControl: tc.base ? `${tc.base}+${tc.inc}` : '-',
        termination: e.reason,
      })
      setSavedId(row.id)
      setTimeout(() => setDialog(true), 450)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bot, userColor, tc, game.chess],
  )

  const clock = useClock(tc.base, tc.inc, (side) => {
    const opp = side === 'w' ? 'b' : 'w'
    // insufficient material for the side with time left is a draw
    const c = game.chess
    const hasMating = c.board().flat().some((p) => p && p.color === opp && p.type !== 'k')
    void finish({ result: hasMating ? (opp === 'w' ? '1-0' : '0-1') : '1/2-1/2', reason: 'timeout' })
  })

  // engine lifecycle
  useEffect(() => {
    void sharedEngine().newGame()
    play('start')
    if (showEval) evalEngine.current = new Engine()
    return () => {
      sharedEngine().stop()
      evalEngine.current?.destroy()
    }
  }, [showEval])

  const turn = game.chess.turn()
  const liveFen = game.fens[game.fens.length - 1]

  // check end of game after every move
  useEffect(() => {
    const r = gameResultText(game.chess)
    if (r) void finish(r)
  }, [liveFen, finish, game.chess])

  // bot to move
  useEffect(() => {
    if (endRef.current || turn === userColor || game.chess.isGameOver()) return
    let cancelled = false
    setThinking(true)
    const started = performance.now()
    void botMove(bot, sharedEngine(), liveFen).then(async (uci) => {
      const minThink = 350 + Math.random() * 500
      const wait = Math.max(0, minThink - (performance.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      if (cancelled || endRef.current || !uci) return
      const { from, to, promotion } = parseUci(uci)
      if (game.move(from, to, promotion)) clock.press(turn)
      setThinking(false)
    })
    return () => {
      cancelled = true
      setThinking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFen, turn, userColor])

  // optional eval bar
  useEffect(() => {
    if (!showEval || !evalEngine.current) return
    void evalEngine.current.search(liveFen, { depth: 14 }).then((r) => r.lines[0] && setEvalScore(r.lines[0].score))
  }, [liveFen, showEval])

  const onUserMove = (from: string, to: string, promotion?: string) => {
    if (!game.atLive || endRef.current) return
    const m = game.move(from, to, promotion)
    if (m) {
      setHint([])
      clock.press(userColor)
    }
  }

  const showHint = async () => {
    if (turn !== userColor || endRef.current) return
    const r = await sharedEngine().search(liveFen, { depth: 12 })
    if (!r.bestmove) return
    const { from, to } = parseUci(r.bestmove)
    setHint([{ orig: from as never, dest: to as never, brush: 'paleGreen' }])
  }

  const takeback = () => {
    if (endRef.current || thinking) return
    const n = turn === userColor ? 2 : 1
    if (game.moves.length < n) return
    sharedEngine().stop()
    game.undo(n)
    setHint([])
  }

  const offerDraw = async () => {
    if (endRef.current) return
    const r = await sharedEngine().search(liveFen, { depth: 10 })
    const w = r.lines[0] ? winPercent(r.lines[0].score) : 50
    const botColor = userColor === 'w' ? 'b' : 'w'
    if (game.moves.length >= 20 && botAcceptsDraw(w, botColor)) {
      toast(t('play.drawAccepted'))
      void finish({ result: '1/2-1/2', reason: 'agreement' })
    } else toast(t('play.drawDeclined', { name: bot.name }))
  }

  const resign = () => {
    setConfirmResign(false)
    void finish({ result: userColor === 'w' ? '0-1' : '1-0', reason: 'resign' })
  }

  const restart = (sameColor: boolean) => {
    const c = sameColor ? (userColor === 'w' ? 'b' : 'w') : pickColor()
    endRef.current = null
    setEnd(null)
    setDialog(false)
    setSavedId(null)
    setHint([])
    game.reset()
    clock.reset()
    setUserColor(c)
    setOrientation(c === 'w' ? 'white' : 'black')
    void sharedEngine().newGame()
    play('start')
  }

  const cap = useMemo(() => capturedPieces(game.fen), [game.fen])
  const botBar = (
    <PlayerBar
      name={bot.name}
      rating={bot.elo}
      color={userColor === 'w' ? 'b' : 'w'}
      captured={userColor === 'w' ? cap.byBlack : cap.byWhite}
      advantage={userColor === 'w' ? -cap.diff : cap.diff}
      clock={clock.enabled ? clock.time[userColor === 'w' ? 'b' : 'w'] : undefined}
      clockActive={clock.active === (userColor === 'w' ? 'b' : 'w')}
      thinking={thinking ? t('play.thinking') : undefined}
      avatar={<Avatar label={bot.name} hue={bot.hue} size={40} />}
    />
  )
  const userBar = (
    <PlayerBar
      name={t('common.you')}
      color={userColor}
      captured={userColor === 'w' ? cap.byWhite : cap.byBlack}
      advantage={userColor === 'w' ? cap.diff : -cap.diff}
      clock={clock.enabled ? clock.time[userColor] : undefined}
      clockActive={clock.active === userColor}
    />
  )
  const flipped = orientation !== (userColor === 'w' ? 'white' : 'black')

  return (
    <>
      <BoardLayout
        above={showEval ? <EvalStrip score={evalScore} orientation={orientation} /> : undefined}
        top={flipped ? userBar : botBar}
        bottom={flipped ? botBar : userBar}
        evalBar={showEval ? <EvalBar score={evalScore} orientation={orientation} /> : undefined}
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable={end || !game.atLive ? 'none' : userColor === 'w' ? 'white' : 'black'}
            lastMove={game.lastMove}
            onMove={onUserMove}
            shapes={hint}
            premoves
          />
        }
        side={
          <Panel className="flex flex-col lg:h-full">
            <div className="flex items-center gap-3 border-b border-line p-3">
              <Avatar label={bot.name} hue={bot.hue} size={36} />
              <div className="font-bold">
                {bot.name} <span className="tabular font-normal text-fg-3">{bot.elo}</span>
              </div>
              {tc.base > 0 && <span className="tabular ml-auto text-[13px] text-fg-3">{tc.label}</span>}
            </div>
            <MoveList sans={game.sans} ply={game.ply} onSelect={game.goto} className="min-h-[120px] flex-1 py-1" />
            <div className="flex items-center justify-center gap-1 border-t border-line p-2">
              <button className="btn btn-ghost btn-icon" onClick={() => game.goto(game.ply - 1)} aria-label={t('review.prev')}>
                <CaretLeft size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => game.goto(game.ply + 1)} aria-label={t('review.next')}>
                <CaretRight size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label={t('common.flip')}>
                <ArrowsDownUp size={22} weight="bold" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 border-t border-line p-3">
              {end ? (
                <>
                  <button className="btn btn-primary col-span-4" disabled={!savedId} onClick={() => savedId && nav(`/review/${savedId}`)}>
                    {t('play.gameReview')}
                  </button>
                  <button className="btn col-span-2" onClick={() => restart(true)}>
                    {t('play.rematch')}
                  </button>
                  <button className="btn col-span-2" onClick={() => nav('/play')}>
                    {t('play.newGame')}
                  </button>
                </>
              ) : (
                <>
                  <ActionButton icon={<Lightbulb size={22} weight="bold" />} label={t('play.hint')} onClick={showHint} disabled={!allowHints || turn !== userColor} />
                  <ActionButton icon={<ArrowCounterClockwise size={22} weight="bold" />} label={t('play.undo')} onClick={takeback} disabled={!allowUndo || game.moves.length < 1} />
                  <ActionButton icon={<Handshake size={22} weight="bold" />} label={t('play.draw')} onClick={offerDraw} />
                  <ActionButton icon={<Flag size={22} weight="bold" />} label={t('play.resign')} onClick={() => setConfirmResign(true)} />
                </>
              )}
            </div>
          </Panel>
        }
      />
      {end && (
        <GameOverDialog
          end={end}
          userColor={userColor}
          open={dialog}
          onClose={() => setDialog(false)}
          onReview={() => savedId && nav(`/review/${savedId}`)}
          reviewReady={!!savedId}
          onRematch={() => restart(true)}
          onNew={() => nav('/play')}
        />
      )}
      <Sheet open={confirmResign} onClose={() => setConfirmResign(false)} title={t('play.resign')}>
        <p className="mb-4 text-fg-2">{t('play.confirmResign')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setConfirmResign(false)}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={resign}>
            {t('play.resign')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="btn flex-col gap-0.5 px-1 py-1.5 text-[11px] font-semibold" style={{ minHeight: 56 }} onClick={onClick} disabled={disabled} title={label}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/** chess.js has no clone; replaying the history keeps the PGN intact. */
export function cloneWithHistory(c: Chess): Chess {
  const copy = new Chess()
  copy.loadPgn(c.pgn())
  return copy
}
