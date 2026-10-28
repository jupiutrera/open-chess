import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import {
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  ArrowsDownUp,
  PencilSimple,
  Copy,
  UploadSimple,
  Cpu,
} from '@phosphor-icons/react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { Board } from '../../board/Board'
import { useBoardKeys } from '../../board/useBoardKeys'
import { BoardLayout } from '../../board/BoardLayout'
import { MoveList } from '../../board/MoveList'
import { EvalBar, EvalStrip } from '../../board/EvalBar'
import { useGame } from '../../chess/useGame'
import { gameResultText, normalizeFen, parseUci, positionProblem, uciLineToSan } from '../../chess/util'
import { winPercent } from '../review/classify'
import { formatScore } from '../../engine/engine'
import { useAnalysis } from './useAnalysis'
import { lookupOpening, type Opening } from '../openings/openingsData'
import { Panel, Sheet, Toggle, toast } from '../../ui/kit'
import { BoardEditor } from './BoardEditor'
import { TablebasePanel } from './TablebasePanel'
import { useAssist } from '../play/useAssist'

const RATE_ONLY = { eval: false, threats: false, suggest: false, feedback: true, engine: false }
const RATE_OFF = { ...RATE_ONLY, feedback: false }

export default function Analysis() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const game = useGame()
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [engineOn, setEngineOn] = useState(true)
  const [multipv, setMultipv] = useState(3)
  const [editing, setEditing] = useState(false)
  const [loader, setLoader] = useState(false)
  const [opening, setOpening] = useState<Opening | undefined>()
  const [rateMoves, setRateMoves] = useState(true)

  useEffect(() => {
    const raw = params.get('fen')
    const fen = raw && normalizeFen(raw)
    const pgn = params.get('pgn')
    try {
      if (pgn) game.loadPgn(pgn)
      else if (fen) {
        const problem = positionProblem(fen)
        if (problem) {
          toast(t(`analysis.illegal.${problem}`), 'error')
          return
        }
        game.reset(fen)
        if (fen.split(' ')[1] === 'b') setOrientation('black')
      }
    } catch {
      toast(t('analysis.invalidFen'), 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    void lookupOpening(game.fen).then((o) => o && setOpening(o))
  }, [game.fen])

  const { lines, depth } = useAnalysis(game.fen, engineOn, multipv)

  // move quality for both sides, as in game review
  const rating = useAssist({ assist: rateMoves ? RATE_ONLY : RATE_OFF, fen: game.fen, moves: game.moves, ply: game.ply, rate: 'both', rateAll: true, userTurn: false })
  const viewedMove = game.ply > 0 ? game.moves[game.ply - 1] : undefined
  const viewedQuality = rateMoves ? rating.quality(viewedMove) : undefined
  const badge = viewedMove && viewedQuality ? { square: viewedMove.to, quality: viewedQuality } : null
  // replayed up to the viewed ply so repetitions count; the 50-move rule doesn't end an analysis
  const outcome = useMemo(() => {
    try {
      const c = new Chess(game.startFen)
      for (const m of game.moves.slice(0, game.ply)) c.move(m.san)
      return gameResultText(c, { fiftyMoves: false })
    } catch {
      return null
    }
  }, [game.startFen, game.moves, game.ply])
  // a finished position has no engine lines; show the result instead
  const evalScore = outcome ? (outcome.reason === 'checkmate' ? { mate: 0, cp: outcome.result === '1-0' ? 1 : -1 } : { cp: 0 }) : lines[0]?.score
  const best = lines[0]
  const shapes: DrawShape[] = useMemo(
    () =>
      engineOn && best?.pv[0]
        ? [{ orig: best.pv[0].slice(0, 2) as never, dest: best.pv[0].slice(2, 4) as never, brush: 'paleBlue' }]
        : [],
    [engineOn, best],
  )

  useBoardKeys({ ply: game.ply, total: game.moves.length, goto: game.goto, flip: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')) })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(t('common.copied'), 'success')
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  const blackFirst = game.startFen.split(' ')[1] === 'b'
  const startNumber = Number(game.startFen.split(' ')[5] ?? 1)

  return (
    <>
      <BoardLayout
        above={engineOn ? <EvalStrip score={evalScore} orientation={orientation} /> : undefined}
        evalBar={engineOn ? <EvalBar score={evalScore} orientation={orientation} /> : undefined}
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable="both"
            lastMove={game.lastMove}
            shapes={shapes}
            badge={badge}
            outcome={outcome}
            onMove={(f, to, p) => game.move(f, to, p, true, true)}
          />
        }
        side={
          <Panel className="flex flex-col overflow-hidden lg:h-full">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Cpu size={20} weight="bold" className="text-fg-2" />
              <h1 className="text-[17px] font-extrabold">{t('analysis.title')}</h1>
            </div>
            <div className="border-b border-line px-4">
              <Toggle checked={engineOn} onChange={setEngineOn} label={`Stockfish${engineOn && depth ? ` · ${t('review.depth', { d: depth })}` : ''}`} />
            </div>
            <div className="border-b border-line px-4">
              <Toggle checked={rateMoves} onChange={setRateMoves} label={t('play.assistOpt.feedback')} />
            </div>
            {engineOn && !outcome && (
              <div className="border-b border-line">
                {[0, 1, 2].slice(0, multipv).map((i) => {
                  const l = lines[i]
                  return (
                    <button
                      key={i}
                      className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[13px] transition-colors duration-100 hover:bg-raise disabled:hover:bg-transparent"
                      disabled={!l}
                      onClick={() => {
                        if (!l?.pv[0]) return
                        const { from, to, promotion } = parseUci(l.pv[0])
                        game.move(from, to, promotion, true, true)
                      }}
                    >
                      <span
                        className={`tabular w-14 shrink-0 rounded px-1 py-0.5 text-center font-mono font-bold ${
                          l && winPercent(l.score) >= 50
                            ? 'bg-[#f1f1f1] text-[#262421]'
                            : 'bg-[#1b1a18] text-[#f1f1f1]'
                        }`}
                      >
                        {l ? formatScore(l.score) : '…'}
                      </span>
                      <span className="truncate text-fg-2">{l ? uciLineToSan(game.fen, l.pv, 10).join(' ') : ''}</span>
                    </button>
                  )
                })}
                <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-fg-3">
                  {t('analysis.lines')}
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMultipv(n)}
                      className={`tabular h-6 w-6 rounded font-bold ${multipv === n ? 'bg-raise-2 text-fg' : 'hover:bg-raise'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <TablebasePanel
              fen={game.fen}
              onPlay={(uci) => {
                const { from, to, promotion } = parseUci(uci)
                game.move(from, to, promotion, true, true)
              }}
            />
            {opening && (
              <div className="truncate border-b border-line px-4 py-2 text-[13px] text-fg-2">
                <span className="tabular font-bold text-fg-3">{opening.eco}</span> {opening.name}
              </div>
            )}
            <MoveList
              sans={game.sans}
              ply={game.ply}
              onSelect={game.goto}
              qualities={rateMoves ? game.moves.map((m) => rating.quality(m)) : undefined}
              blackFirst={blackFirst}
              startNumber={startNumber}
              className="min-h-[120px] flex-1 py-1"
            />
            <div className="grid grid-cols-4 gap-1.5 border-t border-line p-2.5">
              <button className="btn px-0" onClick={() => game.goto(0)} aria-label={t('review.first')}>
                <CaretDoubleLeft size={20} weight="bold" />
              </button>
              <button className="btn px-0" onClick={() => game.goto(game.ply - 1)} aria-label={t('review.prev')}>
                <CaretLeft size={20} weight="bold" />
              </button>
              <button className="btn px-0" onClick={() => game.goto(game.ply + 1)} aria-label={t('review.next')}>
                <CaretRight size={20} weight="bold" />
              </button>
              <button className="btn px-0" onClick={() => game.goto(game.moves.length)} aria-label={t('review.last')}>
                <CaretDoubleRight size={20} weight="bold" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 border-t border-line p-2.5 pt-0 lg:pt-2.5">
              <IconAction label={t('common.flip')} onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
                <ArrowsDownUp size={20} weight="bold" />
              </IconAction>
              <IconAction label={t('analysis.editorShort')} onClick={() => setEditing(true)}>
                <PencilSimple size={20} weight="bold" />
              </IconAction>
              <IconAction label={t('analysis.loadPgn')} onClick={() => setLoader(true)}>
                <UploadSimple size={20} weight="bold" />
              </IconAction>
              <IconAction label={t('analysis.copyPgn')} onClick={() => void copy(game.moves.length ? game.chess.pgn() : game.fen)}>
                <Copy size={20} weight="bold" />
              </IconAction>
            </div>
          </Panel>
        }
      />
      <Sheet open={editing} onClose={() => setEditing(false)} title={t('analysis.editor')}>
        <BoardEditor
          initialFen={game.fen}
          onDone={(fen) => {
            setEditing(false)
            game.reset(fen)
          }}
        />
      </Sheet>
      <Loader
        open={loader}
        onClose={() => setLoader(false)}
        onFen={(fen) => {
          game.reset(fen)
          setLoader(false)
        }}
        onPgn={(pgn) => {
          game.loadPgn(pgn)
          setLoader(false)
        }}
        fen={game.fen}
        onCopyFen={() => void copy(game.fen)}
      />
    </>
  )
}

function IconAction({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="btn h-auto flex-col gap-0.5 px-0 py-1.5 text-[11px] font-semibold" onClick={onClick} title={label}>
      {children}
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  )
}

function Loader({
  open,
  onClose,
  onFen,
  onPgn,
  fen,
  onCopyFen,
}: {
  open: boolean
  onClose: () => void
  onFen: (f: string) => void
  onPgn: (p: string) => void
  fen: string
  onCopyFen: () => void
}) {
  const { t } = useTranslation()
  const [fenText, setFenText] = useState('')
  const [pgnText, setPgnText] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title={t('analysis.loadPgn')}>
      <label className="mb-1.5 block text-[13px] font-bold text-fg-3" htmlFor="fen-in">
        FEN
      </label>
      <div className="mb-4 flex gap-2">
        <input id="fen-in" className="field font-mono text-[13px]" placeholder={fen} value={fenText} onChange={(e) => setFenText(e.target.value)} />
        <button
          className="btn"
          onClick={() => {
            const f = normalizeFen(fenText)
            const problem = positionProblem(f)
            if (problem) toast(t(`analysis.illegal.${problem}`), 'error')
            else onFen(f)
          }}
        >
          {t('analysis.loadFen')}
        </button>
      </div>
      <button className="btn btn-ghost mb-4 -ml-2" onClick={onCopyFen}>
        <Copy size={18} /> {t('analysis.copyFen')}
      </button>
      <label className="mb-1.5 block text-[13px] font-bold text-fg-3" htmlFor="pgn-in">
        PGN
      </label>
      <textarea
        id="pgn-in"
        className="field min-h-32 py-2 font-mono text-[13px]"
        value={pgnText}
        onChange={(e) => setPgnText(e.target.value)}
        placeholder="1. e4 e5 2. Nf3 Nc6"
      />
      <button
        className="btn btn-primary mt-3 w-full"
        onClick={() => {
          try {
            new Chess().loadPgn(pgnText)
            onPgn(pgnText)
          } catch {
            toast(t('analysis.invalidPgn'), 'error')
          }
        }}
      >
        {t('analysis.loadPgn')}
      </button>
    </Sheet>
  )
}

