import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { Lightbulb, ArrowCounterClockwise, Flag, Handshake, ArrowsDownUp, CaretLeft, CaretRight, SlidersHorizontal, X } from '@phosphor-icons/react'
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
import { START_FEN, capturedPieces, gameResultText, moveNumbering, parseUci, timeoutResult, uciLineToSan } from '../../chess/util'
import { play } from '../../chess/sounds'
import { formatScore, sharedEngine, type SearchResult } from '../../engine/engine'
import { botAcceptsDraw, botById, botMove, botName } from './bots'
import { CHALLENGES, challengeMove, useChallenge, validPlies, type EloChange } from './challenges'
import { timeControl } from './timeControl'
import { GameOverDialog, endAnnouncement, type GameEnd } from './GameOver'
import { GameAnnouncer } from '../../board/GameAnnouncer'
import { MoveInput } from '../../board/MoveInput'
import { saveGame } from '../../db/games'
import { clearLiveGame, loadLiveGame, saveLiveGame } from './liveGame'
import { winPercent } from '../review/classify'
import { Panel, Sheet, toast } from '../../ui/kit'
import { useSettings } from '../../settings'
import { useAssist } from './useAssist'
import { AssistToggles } from './AssistToggles'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { localize } from '../../i18n/content'
import { PLAYER } from './playerName'
import { customStartFen } from './startPosition'

export default function PlayBot() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { botId = 'ivan' } = useParams()
  const [params, setParams] = useSearchParams()
  const bot = botById(botId) ?? botById('ivan')!
  const tc = timeControl(params.get('tc'))
  const assist = useSettings((s) => s.assist)
  const lang = useSettings((s) => s.lang)
  const name = botName(bot, lang)
  // a challenge may fix the start position and the user's side
  const rules = bot.challenge ? CHALLENGES[bot.challenge] : undefined

  // a saved game in progress against this bot, when coming from "Continue" or reloading
  const [resumed] = useState(() => {
    const g = params.get('resume') ? loadLiveGame('bot') : null
    return g && g.botId === bot.id ? g : null
  })
  // a game from a given position ("play this position" from analysis); kept for rematches
  const [startFen] = useState(() => customStartFen(rules?.startFen ?? (resumed ? resumed.fen : params.get('fen'))) ?? START_FEN)
  const pickColor = useCallback(() => {
    if (rules?.userColor) return rules.userColor
    const c = params.get('color')
    if (c === 'w' || c === 'b') return c
    // from a given position the user takes the side to move, as on the analysis board,
    // unless they chose random
    if (c !== 'r' && startFen !== START_FEN) return new Chess(startFen).turn()
    return Math.random() < 0.5 ? 'w' : 'b'
  }, [params, startFen, rules])
  const [userColor, setUserColor] = useState<'w' | 'b'>(() => resumed?.userColor ?? pickColor())
  const [orientation, setOrientation] = useState<'white' | 'black'>(userColor === 'w' ? 'white' : 'black')
  const game = useGame(startFen)
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [offering, setOffering] = useState(false)
  // bumped to retry the bot's move when its search was cut short
  const [botRetry, setBotRetry] = useState(0)
  // the engine crashed twice on this move: the user retries by hand
  const [botFailed, setBotFailed] = useState(false)
  const retriedAt = useRef<string | null>(null)
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
  // bumped on rematch, so a save still running for the previous game can't attach its id to this one
  const gameToken = useRef(0)
  const dialogTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // aborted games aren't saved, not even as a game in progress
  const aborted = useRef(false)

  // challenge bots: their Elo (and the like) after every ply
  const challenge = useChallenge(bot, validPlies(resumed?.challenge))
  const announce = (c: EloChange) => {
    // the per-move drift shows on the rating alone
    if (c.reason === 'move') return
    const delta = `${c.to > c.from ? '+' : '−'}${Math.abs(c.to - c.from)}`
    toast(c.reason === 'capture' ? t('play.challengeCapture', { elo: c.to }) : t(`play.challenge_${c.reason}`, { delta }))
  }

  const finish = useCallback(
    async (e: GameEnd) => {
      if (endRef.current) return
      endRef.current = e
      say(e.result === '1/2-1/2' ? 'draw' : (e.result === '1-0') === (userColor === 'w') ? 'lose' : 'win')
      setEnd(e)
      clock.stop()
      play(e.result === '1/2-1/2' ? 'draw' : (e.result === '1-0') === (userColor === 'w') ? 'win' : 'lose')
      const token = gameToken.current
      // a challenge bot is saved at the Elo it ended on
      const botElo = challenge.plies.current.at(-1)?.elo ?? bot.elo
      const pending = saveGame({
        source: 'bot',
        chess: cloneWithHistory(game.chess),
        white: userColor === 'w' ? PLAYER.you : name,
        black: userColor === 'b' ? PLAYER.you : name,
        whiteElo: userColor === 'w' ? undefined : botElo,
        blackElo: userColor === 'b' ? undefined : botElo,
        result: e.result,
        userColor,
        botId: bot.id,
        timeControl: tc.base ? `${tc.base}+${tc.inc}` : '-',
        termination: e.reason,
      })
      // until it's in the DB the game stays resumable
      const row = await pending.catch(() => null)
      if (token !== gameToken.current) return
      if (row) {
        clearLiveGame('bot')
        setSavedId(row.id)
      } else toast(t('play.saveFailed'), 'error')
      dialogTimer.current = setTimeout(() => setDialog(true), 450)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bot, name, userColor, tc, game.chess, say, t],
  )

  const clock = useClock(tc.base, tc.inc, (side) => void finish(timeoutResult(game.chess, side)))

  // put a resumed game back on the board, clock included
  useEffect(() => {
    if (!resumed) return
    game.replay(resumed.sans, startFen)
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
  const hadMoves = useRef(false)
  persist.current = () => {
    if (endRef.current || aborted.current) return
    // taken back to the start: the old saved position mustn't stay resumable
    if (!game.chess.history().length) {
      if (hadMoves.current) clearLiveGame('bot')
      return
    }
    hadMoves.current = true
    saveLiveGame({
      kind: 'bot',
      botId: bot.id,
      userColor,
      tc: tc.id,
      fen: startFen !== START_FEN ? startFen : undefined,
      sans: game.chess.history(),
      clock: clock.enabled ? { w: clock.left('w'), b: clock.left('b') } : undefined,
      challenge: challenge.kind ? challenge.plies.current : undefined,
    })
  }
  // read at unmount: the live game object is replaced on resume and rematch
  const leaveNote = useRef(() => {})
  leaveNote.current = () => {
    if (!endRef.current && !aborted.current && game.chess.history().length) toast(t('play.saved'))
  }
  useEffect(() => persist.current(), [liveFen])
  // once there is a saved game, mark the URL so a reload picks it up instead of starting over it
  const hasMoves = game.moves.length > 0
  useEffect(() => {
    if (!hasMoves || endRef.current || (params.get('resume') && params.get('color') === userColor)) return
    setParams(
      (p) => {
        p.set('resume', '1')
        p.set('color', userColor)
        return p
      },
      { replace: true },
    )
  }, [hasMoves, userColor, params, setParams])
  useEffect(() => {
    const save = () => persist.current()
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', save)
    return () => {
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', save)
      save()
      leaveNote.current()
      clearTimeout(dialogTimer.current)
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
    setBotFailed(false)
    setThinking(true)
    const started = performance.now()
    const botClock = clock.enabled ? { left: clock.left(turn), inc: tc.inc * 1000 } : undefined
    const history = { startFen: game.startFen, moves: game.moves }
    const think = async () => {
      if (!challenge.kind) return botMove(bot, sharedEngine(), liveFen, history, botClock)
      // count the user's move first (rating it when the rules need it), then play by the new state
      const state = await challenge.catchUp(sharedEngine(), history, userColor, announce, () => !cancelled, botClock)
      return state && challengeMove(challenge.kind, sharedEngine(), liveFen, state, history, botClock)
    }
    think()
      .then(async (uci) => {
        const minThink = Math.min(350 + Math.random() * 500, botClock ? botClock.left / 60 : Infinity)
        const wait = Math.max(0, minThink - (performance.now() - started))
        await new Promise((r) => setTimeout(r, wait))
        if (cancelled) return
        // also when the game ended meanwhile: thinking pauses the assist engine
        setThinking(false)
        if (endRef.current) return
        if (!uci) {
          // the search was superseded (e.g. by a hint or a draw offer): think again
          setBotRetry((n) => n + 1)
          return
        }
        const { from, to, promotion } = parseUci(uci)
        const m = game.move(from, to, promotion)
        if (!m) return
        clock.press(turn)
        // the bot's own move never needs the engine: this counts it at once
        void challenge.catchUp(sharedEngine(), { startFen: game.startFen, moves: [...game.moves, m] }, userColor, announce)
      })
      .catch(() => {
        if (cancelled) return
        setThinking(false)
        // sharedEngine() replaces a crashed worker: try once more on our own, then let the user retry
        if (retriedAt.current !== liveFen) {
          retriedAt.current = liveFen
          setBotRetry((n) => n + 1)
          return
        }
        toast(t('play.botFailed'), 'error')
        setBotFailed(true)
      })
    return () => {
      cancelled = true
      setThinking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFen, turn, userColor, botRetry])

  useBoardKeys({ ply: game.ply, total: game.moves.length, goto: game.goto, flip: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')) })

  const userTurn = turn === userColor && game.atLive && !end
  const help = useAssist({ assist, fen: game.fen, moves: game.moves, ply: game.ply, rate: userColor, userTurn, paused: thinking })

  // the clock re-renders this screen every 100ms: keep the board's props stable so its memo holds
  // (help.lines is a new empty array on every render while the position is unevaluated)
  // and only while it's the user's turn, so the bot's thinking doesn't touch them (it would cost a premove)
  const suggestion = userTurn ? help.lines[0]?.pv[0] : undefined
  const threat = userTurn ? help.threat : undefined
  const shapes = useMemo(() => {
    // the hint is for the live position, not one browsed back to
    const out: DrawShape[] = game.atLive ? [...hint] : []
    const arrow = (uci: string, brush: string): DrawShape => ({ orig: uci.slice(0, 2) as never, dest: uci.slice(2, 4) as never, brush })
    if (assist.suggest && suggestion && !hint.length) out.push(arrow(suggestion, 'green'))
    if (assist.threats && threat) out.push(arrow(threat, 'red'))
    return out
  }, [hint, game.atLive, assist.suggest, assist.threats, suggestion, threat])

  const viewedMove = game.ply > 0 ? game.moves[game.ply - 1] : undefined
  const viewedQuality = assist.feedback ? help.quality(viewedMove) : undefined
  const badge = useMemo(() => (viewedMove && viewedQuality ? { square: viewedMove.to, quality: viewedQuality } : null), [viewedMove, viewedQuality])
  // help.quality is a new function every render; the ratings only change as moves get rated
  const qualityList = game.moves.map((m) => help.quality(m))
  const qualityKey = qualityList.join()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const qualities = useMemo(() => qualityList, [game.moves, qualityKey])

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
    // read the live game, not this render's state: it goes stale while the engine thinks
    const fen = game.chess.fen()
    const r = await sharedEngine().search(fen, { depth: 12 })
    if (!r.bestmove || endRef.current || game.chess.fen() !== fen) return
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
    challenge.truncate(game.moves.length - n)
    clock.setTurn(game.chess.turn())
    setHint([])
  }

  const offerDraw = async () => {
    if (endRef.current || thinking || offering) return
    // Drawfish takes any draw
    if (rules?.acceptsDraws) {
      toast(t('play.drawAccepted'))
      void finish({ result: '1/2-1/2', reason: 'agreement' })
      return
    }
    setOffering(true)
    const fen = game.chess.fen()
    const depth = 10
    let r: SearchResult | undefined
    try {
      // a search stopped early (e.g. by a hint) resolves with shallow lines: look again rather than judge on them
      for (let i = 0; i < 3 && (!r || r.depth < depth) && game.chess.fen() === fen; i++) r = await sharedEngine().search(fen, { depth })
    } finally {
      setOffering(false)
    }
    // the position moved on (a move or takeback) or the game ended: the offer lapses unanswered
    if (!r?.lines[0] || endRef.current || game.chess.fen() !== fen) return
    const w = winPercent(r.lines[0].score)
    const botColor = userColor === 'w' ? 'b' : 'w'
    if (game.moves.length >= 20 && botAcceptsDraw(w, botColor)) {
      toast(t('play.drawAccepted'))
      void finish({ result: '1/2-1/2', reason: 'agreement' })
    } else toast(t('play.drawDeclined', { name }))
  }

  const resign = () => {
    setConfirmResign(false)
    void finish({ result: userColor === 'w' ? '0-1' : '1-0', reason: 'resign' })
  }

  // chess.com style: before both sides have moved the game can be dropped without a result
  const canAbort = game.moves.length < 2
  const abort = () => {
    aborted.current = true
    clock.stop()
    sharedEngine().stop()
    clearLiveGame('bot')
    toast(t('play.aborted'))
    nav('/play')
  }

  const restart = (sameColor: boolean) => {
    const c = rules?.userColor ?? (sameColor ? (userColor === 'w' ? 'b' : 'w') : pickColor())
    gameToken.current++
    clearTimeout(dialogTimer.current)
    hadMoves.current = false
    retriedAt.current = null
    setBotFailed(false)
    endRef.current = null
    setEnd(null)
    setDialog(false)
    setSavedId(null)
    setHint([])
    lastChatPly.current = -10
    clearLiveGame('bot')
    setTimeout(() => say('greet'), 500)
    game.reset(startFen)
    challenge.reset()
    clock.reset()
    setUserColor(c)
    setOrientation(c === 'w' ? 'white' : 'black')
    void sharedEngine().newGame()
    play('start')
  }

  const cap = useMemo(() => capturedPieces(game.fen), [game.fen])
  const numbering = useMemo(() => moveNumbering(game.startFen), [game.startFen])
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
      name={name}
      rating={challenge.elo}
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
      <GameAnnouncer moves={game.moves} result={end ? endAnnouncement(end, userColor, t) : null} />
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
                  {name}{' '}
                  <span key={challenge.elo} className={`tabular font-normal text-fg-3 ${rules?.dynamic ? 'enter inline-block' : ''}`}>
                    {challenge.elo}
                  </span>
                </div>
                {/* a challenge's rule is what the game is about: let it wrap instead of cutting it off */}
                <p key={chat?.key} className={`enter text-[13px] text-fg-2 ${bot.challenge ? 'line-clamp-3' : 'truncate'}`} title={chat?.text}>
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
            <MoveStrip sans={game.sans} ply={game.ply} onSelect={game.goto} qualities={assist.feedback ? qualities : undefined} {...numbering} className="border-b border-line max-lg:order-1 lg:hidden" />
            <MoveList
              sans={game.sans}
              ply={game.ply}
              onSelect={game.goto}
              qualities={assist.feedback ? qualities : undefined}
              {...numbering}
              className="hidden min-h-[120px] flex-1 py-1 lg:block"
            />
            {!end && <MoveInput fen={liveFen} disabled={!userTurn} onMove={onUserMove} className="border-t border-line p-3" />}
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
            {botFailed && !end && (
              <div className="flex items-center gap-3 border-t border-line p-3 max-lg:order-2" role="alert">
                <p className="min-w-0 flex-1 text-[13px] text-fg-2">{t('play.botFailed')}</p>
                <button className="btn shrink-0" onClick={() => setBotRetry((n) => n + 1)}>
                  {t('common.retry')}
                </button>
              </div>
            )}
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
                  {canAbort ? (
                    <ActionButton icon={<X size={22} weight="bold" />} label={t('play.abort')} onClick={abort} />
                  ) : (
                    <ActionButton icon={<Flag size={22} weight="bold" />} label={t('play.resign')} onClick={() => setConfirmResign(true)} />
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

export function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
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
