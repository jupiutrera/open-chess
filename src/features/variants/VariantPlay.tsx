import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowCounterClockwise, ArrowsDownUp, CaretLeft, CaretRight, Flag, Robot } from '@phosphor-icons/react'
import { BoardLayout } from '../../board/BoardLayout'
import { PlayerBar } from '../../board/PlayerBar'
import { MoveList, MoveStrip } from '../../board/MoveList'
import { useBoardKeys } from '../../board/useBoardKeys'
import { GameAnnouncer } from '../../board/GameAnnouncer'
import { play, sanSound } from '../../chess/sounds'
import { BoardScreenSkeleton, Panel, Sheet, toast } from '../../ui/kit'
import { NotFound } from '../../ui/NotFound'
import { ActionButton } from '../play/PlayBot'
import { GameOverDialog, endAnnouncement, endTitle } from '../play/GameOver'
import { levelById, variantById, type Level, type Variant } from './catalog'
import { FairyEngine } from './fairyEngine'
import { materialDiff, parsePosition, type VariantMove } from './fen'
import { loadRules, type Rules, type VariantEnd, type VariantGame } from './rules'
import { VariantBoard, VariantPiece, pieceNameKey } from './VariantBoard'

/** The variant from the URL, once the rules library has loaded. */
export default function VariantPlay() {
  const { t } = useTranslation()
  const { id } = useParams()
  const variant = variantById(id)
  const [rules, setRules] = useState<Rules | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setFailed(false)
    loadRules().then(
      (r) => live && setRules(r),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [attempt])

  if (!variant) return <NotFound />
  if (failed)
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-fg-2">{t('variants.loadFailed')}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
          {t('common.retry')}
        </button>
      </div>
    )
  if (!rules) return <BoardScreenSkeleton />
  return <Game key={variant.id} variant={variant} rules={rules} />
}

function Game({ variant, rules }: { variant: Variant; rules: Rules }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const twoPlayers = params.get('vs') === 'human'
  const level: Level = levelById(Number(params.get('level')))
  const pickColor = (): 'w' | 'b' => {
    const c = params.get('color')
    return c === 'w' || c === 'b' ? c : Math.random() < 0.5 ? 'w' : 'b'
  }
  const [userColor, setUserColor] = useState<'w' | 'b'>(pickColor)
  const [orientation, setOrientation] = useState<'w' | 'b'>(userColor)

  // the game lives in WebAssembly memory: one per round, freed when the round or the screen ends
  const [round, setRound] = useState(0)
  const [game, setGame] = useState<VariantGame | null>(null)
  // the game object mutates in place; this counts its moves so React follows along
  const [count, setCount] = useState(0)
  const [ply, setPly] = useState(0)
  // the ply reached by stepping one move forward: only then does the board slide the piece in
  const [stepped, setStepped] = useState<number | null>(null)
  const [end, setEnd] = useState<VariantEnd | null>(null)
  const [dialog, setDialog] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [botFailed, setBotFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [promo, setPromo] = useState<VariantMove[] | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const engine = useRef<FairyEngine | null>(null)
  const dialogTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const g = rules.newGame(variant)
    setGame(g)
    setCount(0)
    setPly(0)
    setEnd(null)
    setDialog(false)
    setBotFailed(false)
    play('start')
    return () => {
      clearTimeout(dialogTimer.current)
      g.dispose()
    }
  }, [rules, variant, round])
  useEffect(() => () => engine.current?.destroy(), [])

  const finish = useCallback(
    (e: VariantEnd) => {
      setEnd(e)
      // a question left open (resign?) is about a game that no longer goes on
      setConfirmResign(false)
      setPromo(null)
      const draw = e.result === '1/2-1/2'
      const userWon = (e.result === '1-0') === (userColor === 'w')
      play(draw ? 'draw' : twoPlayers || userWon ? 'win' : 'lose')
      dialogTimer.current = setTimeout(() => setDialog(true), 450)
    },
    [userColor, twoPlayers],
  )

  const playMove = useCallback(
    (g: VariantGame, uci: string) => {
      if (!g.push(uci)) return false
      play(sanSound(g.sans[g.sans.length - 1]))
      setCount(g.moves.length)
      setPly(g.moves.length)
      setStepped(g.moves.length)
      const e = g.end()
      if (e) finish(e)
      return true
    },
    [finish],
  )

  const atLive = !!game && ply === game.moves.length
  const turn = game && count === game.moves.length ? game.turn : 'w'
  const botTurn = !!game && !twoPlayers && !end && turn !== userColor

  // the engine answers
  useEffect(() => {
    if (!game || !botTurn) return
    let cancelled = false
    setThinking(true)
    setBotFailed(false)
    const started = performance.now()
    const fairy = (engine.current ??= new FairyEngine())
    fairy
      .bestMove(variant, game.startFen, [...game.moves], level)
      .then(async (uci) => {
        // a reply that lands at once reads as a glitch
        await new Promise((r) => setTimeout(r, Math.max(0, 450 - (performance.now() - started))))
        if (cancelled) return
        setThinking(false)
        if (uci) playMove(game, uci)
      })
      .catch(() => {
        if (cancelled) return
        setThinking(false)
        setBotFailed(true)
        toast(t('play.botFailed'), 'error')
      })
    return () => {
      cancelled = true
      setThinking(false)
      fairy.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, count, botTurn, retry])

  const fen = game?.fens[Math.min(ply, game.fens.length - 1)]
  const position = useMemo(() => (fen ? parsePosition(fen) : null), [fen])
  const userMoves = useMemo(
    () => (game && atLive && !end && (twoPlayers || turn === userColor) ? game.legalMoves() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, count, atLive, end, twoPlayers, turn, userColor],
  )
  const lastMove = useMemo<[string, string] | null>(() => {
    const uci = game && ply > 0 ? game.moves[ply - 1] : null
    const m = uci ? /^([a-l]\d+)([a-l]\d+)/.exec(uci) : null
    return m ? [m[1], m[2]] : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, ply, count])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checked = useMemo(() => (game && atLive ? game.checked() : []), [game, atLive, count])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sans = useMemo(() => (game ? [...game.sans] : []), [game, count])
  // every variant here starts with White to move
  const spoken = useMemo(() => sans.map((san, i) => ({ san, color: i % 2 === 0 ? ('w' as const) : ('b' as const) })), [sans])
  const startDiff = useMemo(() => materialDiff(parsePosition(variant.fen), variant.fairy), [variant])

  const goto = useCallback(
    (p: number) => {
      const to = Math.max(0, Math.min(p, game?.moves.length ?? 0))
      setStepped(to === ply + 1 ? to : null)
      setPly(to)
    },
    [game, ply],
  )
  const flip = () => setOrientation((o) => (o === 'w' ? 'b' : 'w'))
  useBoardKeys({ ply, total: count, goto, flip })

  const onMove = useCallback(
    (from: string, to: string) => {
      if (!game) return
      const options = userMoves.filter((m) => m.from === from && m.to === to)
      if (options.length > 1) setPromo(options)
      else if (options[0]) playMove(game, options[0].uci)
    },
    [game, userMoves, playMove],
  )

  const takeback = () => {
    if (!game || !game.moves.length) return
    engine.current?.cancel()
    clearTimeout(dialogTimer.current)
    // back to the user's own last move: both plies when the engine has already answered
    const plies = twoPlayers || game.turn !== userColor ? 1 : 2
    game.undo(Math.min(plies, game.moves.length))
    setCount(game.moves.length)
    setPly(game.moves.length)
    setStepped(null)
    setEnd(null)
    setDialog(false)
  }

  const resign = () => {
    setConfirmResign(false)
    if (end) return
    // with two players, the side to move is the one giving up
    const loser = twoPlayers ? turn : userColor
    finish({ result: loser === 'w' ? '0-1' : '1-0', reason: 'resign' })
  }

  const rematch = () => {
    engine.current?.cancel()
    // against the engine the colours swap; two players at one screen keep their seats
    if (!twoPlayers) {
      const next = userColor === 'w' ? 'b' : 'w'
      setUserColor(next)
      setOrientation(next)
    }
    setRound((n) => n + 1)
  }

  if (!game || !position) return <BoardScreenSkeleton />

  const name = t(`variants.v.${variant.id}.name`)
  // who has gained material since the start: the armies of some variants are uneven from move one
  const diff = variant.noMaterial ? 0 : materialDiff(position, variant.fairy) - startDiff
  const sideName = (c: 'w' | 'b') => t(c === 'w' ? 'common.white' : 'common.black')
  const bar = (c: 'w' | 'b') => {
    const isBot = !twoPlayers && c !== userColor
    // three-check: each bar counts the checks its side has given
    const tags = [
      isBot ? t('variants.levelShort', { level: level.id }) : null,
      position.checksLeft ? t('variants.checksGiven', { n: 3 - position.checksLeft[c === 'w' ? 'b' : 'w'] }) : null,
    ].filter(Boolean)
    return (
      <PlayerBar
        name={twoPlayers ? sideName(c) : isBot ? 'Fairy-Stockfish' : t('common.you')}
        rating={tags.length ? tags.join(' · ') : undefined}
        color={c}
        captured={[]}
        advantage={c === 'w' ? diff : -diff}
        thinking={isBot && thinking ? t('play.thinking') : undefined}
        avatar={
          isBot ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-raise-2 text-fg-2" aria-hidden>
              <Robot size={24} weight="fill" />
            </span>
          ) : undefined
        }
      />
    )
  }
  const top = orientation === 'w' ? 'b' : 'w'

  return (
    <>
      <GameAnnouncer moves={spoken} result={end ? endAnnouncement(end, twoPlayers ? undefined : userColor, t) : null} />
      <BoardLayout
        top={bar(top)}
        bottom={bar(orientation)}
        board={
          <VariantBoard
            position={position}
            fairy={variant.fairy}
            orientation={orientation}
            moves={userMoves}
            lastMove={lastMove}
            slide={stepped === ply}
            checked={checked}
            marks={variant.marks}
            onMove={onMove}
          />
        }
        side={
          <Panel className="flex flex-col lg:h-full">
            <div className="border-b border-line p-3 max-lg:order-4 max-lg:border-b-0 max-lg:border-t">
              <h1 tabIndex={-1} className="text-[17px] font-extrabold">
                {name}
              </h1>
              <p className="mt-1 text-[13px] leading-snug text-fg-2">{t(`variants.v.${variant.id}.rule`)}</p>
            </div>
            <MoveStrip sans={sans} ply={ply} onSelect={goto} startNumber={1} blackFirst={false} className="border-b border-line max-lg:order-1 lg:hidden" />
            <MoveList sans={sans} ply={ply} onSelect={goto} startNumber={1} blackFirst={false} className="hidden min-h-[120px] flex-1 py-1 lg:block" />
            <div className="flex items-center justify-center gap-1 border-t border-line p-2 max-lg:order-3">
              <button className="btn btn-ghost btn-icon" onClick={() => goto(ply - 1)} aria-label={t('review.prev')}>
                <CaretLeft size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => goto(ply + 1)} aria-label={t('review.next')}>
                <CaretRight size={22} weight="bold" />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={flip} aria-label={t('common.flip')}>
                <ArrowsDownUp size={22} weight="bold" />
              </button>
            </div>
            {botFailed && !end && (
              <div className="flex items-center gap-3 border-t border-line p-3 max-lg:order-2" role="alert">
                <p className="min-w-0 flex-1 text-[13px] text-fg-2">{t('play.botFailed')}</p>
                <button className="btn shrink-0" onClick={() => setRetry((n) => n + 1)}>
                  {t('common.retry')}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3 max-lg:order-2 max-lg:border-t-0">
              {end ? (
                <>
                  <p className="col-span-2 text-center text-[15px] font-bold" role="status">
                    {endTitle(end, twoPlayers ? undefined : userColor, t)} <span className="font-normal text-fg-2">{t(`play.by.${end.reason}`)}</span>
                  </p>
                  <button className="btn btn-primary" onClick={rematch}>
                    {t('play.rematch')}
                  </button>
                  <button className="btn" onClick={() => nav('/variants')}>
                    {t('variants.other')}
                  </button>
                </>
              ) : (
                <>
                  <ActionButton icon={<ArrowCounterClockwise size={22} weight="bold" />} label={t('play.undo')} onClick={takeback} disabled={!count} />
                  <ActionButton icon={<Flag size={22} weight="bold" />} label={t('play.resign')} onClick={() => setConfirmResign(true)} disabled={!count} />
                </>
              )}
            </div>
          </Panel>
        }
      />
      {end && (
        <GameOverDialog
          end={end}
          userColor={twoPlayers ? undefined : userColor}
          open={dialog}
          onClose={() => setDialog(false)}
          onRematch={rematch}
          onNew={() => nav('/variants')}
        />
      )}
      <Sheet open={!!promo} onClose={() => setPromo(null)} title={t('common.promotion')}>
        <div className="flex flex-wrap justify-center gap-2">
          {promo?.map((m) => (
            <button
              key={m.uci}
              className="btn relative h-16 w-16 p-0"
              aria-label={t(pieceNameKey(m.promotion ?? 'q', variant.fairy))}
              onClick={() => {
                setPromo(null)
                playMove(game, m.uci)
              }}
            >
              <VariantPiece letter={m.promotion ?? 'q'} color={turn} fairy={variant.fairy} />
            </button>
          ))}
        </div>
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
