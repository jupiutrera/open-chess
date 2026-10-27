import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { Lightbulb, ArrowCounterClockwise, Flag, Handshake, ArrowsDownUp, CaretLeft, CaretRight, SlidersHorizontal } from '@phosphor-icons/react'
import { Board } from '../../board/Board'
import { useBoardKeys } from '../../board/useBoardKeys'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { BotAvatar, type Mood } from './BotAvatar'
import { botLine, type ChatEvent } from './botChat'
import { MoveList, MoveStrip } from '../../board/MoveList'
import { EvalBar, EvalStrip } from '../../board/EvalBar'
import { useGame } from '../../chess/useGame'
import { useClock } from '../../chess/useClock'
import { capturedPieces, gameResultText, parseUci, timeoutResult, uciLineToSan } from '../../chess/util'
import { play } from '../../chess/sounds'
import { formatScore, sharedEngine } from '../../engine/engine'
import { botAcceptsDraw, botById, botMove } from './bots'
import { timeControl } from './timeControl'
import { GameOverDialog, type GameEnd } from './GameOver'
import { saveGame } from '../../db/games'
import { clearLiveGame, loadLiveGame, saveLiveGame } from './liveGame'
import { winPercent } from '../review/classify'
import { Panel, Sheet, toast } from '../../ui/kit'
import { useSettings } from '../../settings'
import { useAssist } from './useAssist'
import { AssistToggles } from './AssistToggles'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { localize } from '../../i18n/content'

export default function PlayBot() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { botId = 'ivan' } = useParams()
  const [params] = useSearchParams()
  const bot = botById(botId) ?? botById('ivan')!
  const tc = timeControl(params.get('tc'))
  const assist = useSettings((s) => s.assist)
  const lang = useSettings((s) => s.lang)

  const pickColor = useCallback(() => {
    const c = params.get('color')
    return c === 'b' ? 'b' : c === 'w' ? 'w' : Math.random() < 0.5 ? 'w' : 'b'
  }, [params])
  // a saved game in progress against this bot, when coming from "Continue"
  const [resumed] = useState(() => {
    const g = params.get('resume') ? loadLiveGame('bot') : null
    return g && g.botId === bot.id ? g : null
  })
  const [userColor, setUserColor] = useState<'w' | 'b'>(() => resumed?.userColor ?? pickColor())
  const [orientation, setOrientation] = useState<'white' | 'black'>(userColor === 'w' ? 'white' : 'black')
  const game = useGame()
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [offering, setOffering] = useState(false)
  // bumped to retry the bot's move when its search was cut short
  const [botRetry, setBotRetry] = useState(0)
  const [hint, setHint] = useState<DrawShape[]>([])
  const [confirmResign, setConfirmResign] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)
  const [chat, setChat] = useState<{ text: string; key: number } | null>(null)
  const lastChatPly = useRef(-10)
  const say = useCallback(
    (event: ChatEvent, chance = 1) => {
      if (Math.random() > chance) return
      setChat({ text: botLine(bot, event, lang), key: Date.now() })
    },
    [bot, lang],
  )
  const endRef = useRef<GameEnd | null>(null)

  const finish = useCallback(
    async (e: GameEnd) => {
      if (endRef.current) return
      endRef.current = e
      say(e.result === '1/2-1/2' ? 'draw' : (e.result === '1-0') === (userColor === 'w') ? 'lose' : 'win')
      setEnd(e)
      clock.stop()
      clearLiveGame('bot')
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
    [bot, userColor, tc, game.chess, say],
  )

  const clock = useClock(tc.base, tc.inc, (side) => void finish(timeoutResult(game.chess, side)))

  // put a resumed game back on the board, clock included
  useEffect(() => {
    if (!resumed) return
    game.replay(resumed.sans)
    if (resumed.clock) clock.restore(resumed.clock, game.chess.turn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // engine lifecycle
  useEffect(() => {
    void sharedEngine().newGame()
    play('start')
    const greet = setTimeout(() => say('greet'), 500)
    return () => {
      clearTimeout(greet)
      sharedEngine().stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the bot reacts to captures and checks, without talking on every move
  const moveCount = game.moves.length
  useEffect(() => {
    const m = game.moves[moveCount - 1]
    if (!m || endRef.current || moveCount - lastChatPly.current < 3) return
    const byBot = m.color !== userColor
    let spoke = false
    const react = (e: ChatEvent, chance: number) => {
      if (spoke || Math.random() > chance) return
      say(e)
      spoke = true
    }
    if (byBot && m.san.includes('+')) react('check', 0.35)
    if (byBot && m.captured) react('capture', m.captured === 'p' ? 0.15 : 0.5)
    if (!byBot && m.captured && m.captured !== 'p') react('lostPiece', 0.55)
    if (spoke) lastChatPly.current = moveCount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount])

  const turn = game.chess.turn()
  const liveFen = game.fens[game.fens.length - 1]

  // autosave after every move, and when the page is hidden or left (clock times)
  const persist = useRef(() => {})
  persist.current = () => {
    if (endRef.current) return
    saveLiveGame({
      kind: 'bot',
      botId: bot.id,
      userColor,
      tc: tc.id,
      sans: game.chess.history(),
      clock: clock.enabled ? { w: clock.left('w'), b: clock.left('b') } : undefined,
    })
  }
  // read at unmount: the live game object is replaced on resume and rematch
  const leaveNote = useRef(() => {})
  leaveNote.current = () => {
    if (!endRef.current && game.chess.history().length) toast(t('play.saved'))
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
      leaveNote.current()
    }
  }, [])

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
    const botClock = clock.enabled ? { left: clock.left(turn), inc: tc.inc * 1000 } : undefined
    botMove(bot, sharedEngine(), liveFen, game.chess.history(), botClock)
      .then(async (uci) => {
        const minThink = Math.min(350 + Math.random() * 500, botClock ? botClock.left / 60 : Infinity)
        const wait = Math.max(0, minThink - (performance.now() - started))
        await new Promise((r) => setTimeout(r, wait))
        if (cancelled || endRef.current) return
        setThinking(false)
        if (!uci) {
          // the search was superseded (e.g. by a hint or a draw offer): think again
          setBotRetry((n) => n + 1)
          return
        }
        const { from, to, promotion } = parseUci(uci)
        if (game.move(from, to, promotion)) clock.press(turn)
      })
      .catch(() => {
        if (cancelled) return
        setThinking(false)
        toast(t('review.engineFailed'), 'error')
      })
    return () => {
      cancelled = true
      setThinking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFen, turn, userColor, botRetry])

  useBoardKeys({ ply: game.ply, total: game.moves.length, goto: game.goto, flip: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')) })

  const userTurn = turn === userColor && game.atLive && !end
  const help = useAssist({ assist, fen: game.fen, moves: game.moves, ply: game.ply, rate: userColor, userTurn })

  const shapes = useMemo(() => {
    const out: DrawShape[] = [...hint]
    const arrow = (uci: string, brush: string): DrawShape => ({ orig: uci.slice(0, 2) as never, dest: uci.slice(2, 4) as never, brush })
    if (assist.suggest && userTurn && help.lines[0]?.pv[0] && !hint.length) out.push(arrow(help.lines[0].pv[0], 'green'))
    if (assist.threats && userTurn && help.threat) out.push(arrow(help.threat, 'red'))
    return out
  }, [hint, assist.suggest, assist.threats, userTurn, help.lines, help.threat])

  const viewedMove = game.ply > 0 ? game.moves[game.ply - 1] : undefined
  const viewedQuality = assist.feedback ? help.quality(viewedMove) : undefined
  const badge = viewedMove && viewedQuality ? { square: viewedMove.to, quality: viewedQuality } : null
  const qualities = game.moves.map((m) => help.quality(m))

  const lastFeedback = help.quality(game.moves[moveCount - 1])
  useEffect(() => {
    if (lastFeedback === 'blunder' && !endRef.current) {
      say('blunder', 0.7)
      lastChatPly.current = moveCount
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFeedback])

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
    const fen = liveFen
    const r = await sharedEngine().search(fen, { depth: 12 })
    if (!r.bestmove || game.fens[game.fens.length - 1] !== fen) return
    const { from, to } = parseUci(r.bestmove)
    setHint([{ orig: from as never, dest: to as never, brush: 'paleGreen' }])
  }

  const takeback = () => {
    if (endRef.current || thinking) return
    const n = turn === userColor ? 2 : 1
    if (game.moves.length < n) return
    sharedEngine().stop()
    for (const m of game.moves.slice(-n)) clock.unpress(m.color)
    game.undo(n)
    clock.setTurn(game.chess.turn())
    setHint([])
  }

  const offerDraw = async () => {
    if (endRef.current || thinking || offering) return
    setOffering(true)
    const r = await sharedEngine()
      .search(liveFen, { depth: 10 })
      .finally(() => setOffering(false))
    // interrupted (the user moved meanwhile): no answer rather than a guess
    if (!r.lines[0] || endRef.current) return
    const w = winPercent(r.lines[0].score)
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
    lastChatPly.current = -10
    clearLiveGame('bot')
    setTimeout(() => say('greet'), 500)
    game.reset()
    clock.reset()
    setUserColor(c)
    setOrientation(c === 'w' ? 'white' : 'black')
    void sharedEngine().newGame()
    play('start')
  }

  const cap = useMemo(() => capturedPieces(game.fen), [game.fen])
  const lineSans = useMemo(() => (assist.engine ? help.lines.slice(0, 3).map((l) => uciLineToSan(game.fen, l.pv, 8).join(' ')) : []), [assist.engine, help.lines, game.fen])
  const botEdge = userColor === 'w' ? -cap.diff : cap.diff
  const mood: Mood = end
    ? end.result === '1/2-1/2'
      ? 'neutral'
      : (end.result === '1-0') === (userColor === 'w')
        ? 'sad'
        : 'happy'
    : botEdge >= 3
      ? 'happy'
      : botEdge <= -3
        ? 'sad'
        : 'neutral'
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
      avatar={<BotAvatar bot={bot} mood={mood} size={40} />}
      bubble={chat ?? undefined}
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
        above={assist.eval ? <EvalStrip score={help.score} orientation={orientation} /> : undefined}
        top={flipped ? userBar : botBar}
        bottom={flipped ? botBar : userBar}
        evalBar={assist.eval ? <EvalBar score={help.score} orientation={orientation} /> : undefined}
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable={end || !game.atLive ? 'none' : userColor === 'w' ? 'white' : 'black'}
            lastMove={game.lastMove}
            onMove={onUserMove}
            shapes={shapes}
            badge={badge}
            premoves
            outcome={end && game.atLive ? end : null}
          />
        }
        side={
          <Panel className="flex flex-col lg:h-full">
            {/* on phones the game actions come first, right under the board; the bot card goes last */}
            <div className="flex items-center gap-3 border-b border-line p-3 max-lg:order-4 max-lg:border-b-0 max-lg:border-t">
              <BotAvatar bot={bot} mood={mood} size={44} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {bot.name} <span className="tabular font-normal text-fg-3">{bot.elo}</span>
                </div>
                <p key={chat?.key} className="enter truncate text-[13px] text-fg-2" title={chat?.text}>
                  {chat?.text ?? localize(bot.bio, lang, `bots.${bot.id}.bio`)}
                </p>
              </div>
              {tc.base > 0 && <span className="tabular shrink-0 text-[13px] text-fg-3">{tc.label}</span>}
              <button
                className="btn btn-ghost btn-icon -mr-1 shrink-0"
                onClick={() => setAssistOpen(true)}
                aria-label={t('play.assist')}
                title={t('play.assist')}
              >
                <SlidersHorizontal size={20} weight="bold" />
              </button>
            </div>
            {assist.engine && (
              <div className="border-b border-line py-1 max-lg:order-5">
                {[0, 1, 2].map((i) => {
                  const l = help.lines[i]
                  return (
                    <div key={i} className="flex items-baseline gap-2 px-3 py-1 text-[13px]">
                      <span
                        className={`tabular w-14 shrink-0 rounded px-1 py-0.5 text-center font-mono font-bold ${
                          l && (l.score.mate !== undefined ? l.score.mate > 0 : (l.score.cp ?? 0) >= 0) ? 'bg-[#f1f1f1] text-[#262421]' : 'bg-[#1b1a18] text-[#f1f1f1]'
                        }`}
                      >
                        {l ? formatScore(l.score) : '…'}
                      </span>
                      <span className="truncate text-fg-2">{l ? lineSans[i] : ''}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <MoveStrip sans={game.sans} ply={game.ply} onSelect={game.goto} qualities={assist.feedback ? qualities : undefined} className="border-b border-line max-lg:order-1 lg:hidden" />
            <MoveList
              sans={game.sans}
              ply={game.ply}
              onSelect={game.goto}
              qualities={assist.feedback ? qualities : undefined}
              className="hidden min-h-[120px] flex-1 py-1 lg:block"
            />
            <div className="flex items-center justify-center gap-1 border-t border-line p-2 max-lg:order-3">
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
            <div className="grid grid-cols-4 gap-2 border-t border-line p-3 max-lg:order-2 max-lg:border-t-0">
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
                  <ActionButton icon={<Lightbulb size={22} weight="bold" />} label={t('play.hint')} onClick={showHint} disabled={turn !== userColor} />
                  <ActionButton icon={<ArrowCounterClockwise size={22} weight="bold" />} label={t('play.undo')} onClick={takeback} disabled={game.moves.length < 1} />
                  <ActionButton icon={<Handshake size={22} weight="bold" />} label={t('play.draw')} onClick={offerDraw} disabled={thinking || offering} />
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
      <Sheet open={assistOpen} onClose={() => setAssistOpen(false)} title={t('play.assist')}>
        <AssistToggles />
      </Sheet>
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
