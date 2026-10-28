import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { CaretLeft, CaretRight, ArrowsDownUp, Plus, MagnifyingGlass, ArrowCounterClockwise, Trash, Brain } from '@phosphor-icons/react'
import { Chess } from 'chess.js'
import { Board } from '../../board/Board'
import { BoardLayout } from '../../board/BoardLayout'
import { MoveList } from '../../board/MoveList'
import { PieceIcon } from '../../board/QualityIcon'
import { useGame } from '../../chess/useGame'
import { parseUci } from '../../chess/util'
import { Panel, Segmented, Sheet, Skeleton, toast, useOnline } from '../../ui/kit'
import { lookupOpening, namedContinuations, searchOpenings, type Opening } from './openingsData'
import { fetchExplorer, type ExplorerDb, type ExplorerResult } from './explorerApi'
import { addLine, removeLine } from './repertoire'
import { db } from '../../db/db'
import { fmtCompact } from '../../i18n/format'

type Tab = 'explorer' | 'repertoire'

export default function Openings() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('explorer')
  const game = useGame()
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [source, setSource] = useState<ExplorerDb | 'local'>('local')
  const [stats, setStats] = useState<ExplorerResult | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [named, setNamed] = useState<{ san: string; uci: string; opening: Opening }[]>([])
  const [opening, setOpening] = useState<Opening | undefined>()
  const [search, setSearch] = useState(false)
  const online = useOnline()

  useEffect(() => {
    // the latest named position up to the viewed ply; stale lookups are dropped
    let alive = true
    const fens = game.fens.slice(0, game.ply + 1).reverse()
    void Promise.all(fens.map(lookupOpening)).then((os) => alive && setOpening(os.find(Boolean)))
    void namedContinuations(game.fen).then((n) => alive && setNamed(n))
    return () => {
      alive = false
    }
  }, [game.fen, game.fens, game.ply])

  useEffect(() => {
    if (source === 'local' || !online) {
      setStats(null)
      return
    }
    let alive = true
    setStatsError(false)
    fetchExplorer(game.fen, source)
      .then((r) => alive && setStats(r))
      .catch(() => {
        if (!alive) return
        setStats(null)
        setStatsError(true)
      })
    return () => {
      alive = false
    }
  }, [game.fen, source, online])

  const play = (uci: string) => {
    const { from, to, promotion } = parseUci(uci)
    game.move(from, to, promotion, true, true)
  }

  const addToRepertoire = async () => {
    const color = orientation === 'white' ? 'w' : 'b'
    const n = await addLine(game.sans.slice(0, game.ply), color)
    toast(`${t('openings.added')} (+${n})`, 'success')
  }

  return (
    <>
      <BoardLayout
        board={
          <Board
            fen={game.fen}
            orientation={orientation}
            movable={tab === 'explorer' ? 'both' : 'none'}
            lastMove={game.lastMove}
            onMove={(f, to, p) => game.move(f, to, p, true, true)}
          />
        }
        side={
          <Panel className="flex flex-col overflow-hidden lg:h-full">
            <div className="border-b border-line p-3">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'explorer', label: t('openings.explorer') },
                  { value: 'repertoire', label: t('openings.trainer') },
                ]}
              />
            </div>
            {tab === 'explorer' ? (
              <>
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    {opening ? (
                      <div className="truncate font-bold">
                        <span className="tabular text-fg-3">{opening.eco}</span> {opening.name}
                      </div>
                    ) : (
                      <div className="font-bold text-fg-3">{t('openings.title')}</div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-icon -mr-2" onClick={() => setSearch(true)} aria-label={t('openings.search')}>
                    <MagnifyingGlass size={20} weight="bold" />
                  </button>
                </div>
                <div className="flex gap-1 border-b border-line px-3 py-2">
                  {(['local', 'masters', 'lichess'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSource(s)}
                      className={`rounded-md px-2.5 py-1 text-[13px] font-bold ${source === s ? 'bg-raise-2 text-fg' : 'text-fg-3 hover:text-fg'}`}
                    >
                      {s === 'local' ? t('openings.known') : s === 'masters' ? t('openings.masters') : t('openings.lichess')}
                    </button>
                  ))}
                </div>
                <div className="min-h-[160px] flex-1 overflow-y-auto">
                  {source !== 'local' && stats ? (
                    <StatsTable stats={stats} onPlay={play} />
                  ) : (
                    <>
                      {source !== 'local' && (statsError || !online) && (
                        <p className="px-4 pt-3 text-[13px] text-fg-3">
                          {online ? t('openings.needToken') : t('openings.offlineStats')}{' '}
                          {online && (
                            <Link to="/settings" className="font-semibold text-accent underline underline-offset-2">
                              {t('nav.settings')}
                            </Link>
                          )}
                        </p>
                      )}
                      {named.length === 0 ? (
                        <p className="px-4 py-3 text-[14px] text-fg-3">{t('openings.noStats')}</p>
                      ) : (
                        <ul className="py-1">
                          {named.map((n) => (
                            <li key={n.uci}>
                              <button
                                onClick={() => play(n.uci)}
                                className="flex w-full items-baseline gap-3 px-4 py-2 text-left transition-colors duration-100 hover:bg-raise"
                              >
                                <span className="w-14 shrink-0 font-bold">{n.san}</span>
                                <span className="truncate text-[13px] text-fg-2">
                                  <span className="tabular text-fg-3">{n.opening.eco}</span> {n.opening.name}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
                <MoveList sans={game.sans} ply={game.ply} onSelect={game.goto} className="max-h-28 border-t border-line py-1" />
                <div className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-1.5 border-t border-line p-2.5">
                  <button className="btn btn-icon" onClick={() => game.goto(game.ply - 1)} aria-label={t('review.prev')}>
                    <CaretLeft size={20} weight="bold" />
                  </button>
                  <button className="btn btn-icon" onClick={() => game.goto(game.ply + 1)} aria-label={t('review.next')}>
                    <CaretRight size={20} weight="bold" />
                  </button>
                  <button className="btn btn-icon" onClick={() => game.reset()} aria-label={t('analysis.reset')}>
                    <ArrowCounterClockwise size={20} weight="bold" />
                  </button>
                  <button className="btn btn-icon" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label={t('common.flip')}>
                    <ArrowsDownUp size={20} weight="bold" />
                  </button>
                  <button className="btn btn-primary px-3 text-[14px]" onClick={addToRepertoire} disabled={game.ply === 0}>
                    <Plus size={18} weight="bold" /> {t('openings.addToRepertoire')}
                  </button>
                </div>
              </>
            ) : (
              <RepertoirePanel
                onShow={(line, color) => {
                  game.reset()
                  const c = new Chess()
                  for (const san of line.split(' ')) {
                    try {
                      const m = c.move(san)
                      game.move(m.from, m.to, m.promotion, false)
                    } catch {
                      break
                    }
                  }
                  setOrientation(color === 'w' ? 'white' : 'black')
                }}
              />
            )}
          </Panel>
        }
      />
      <SearchSheet
        open={search}
        onClose={() => setSearch(false)}
        onPick={(o) => {
          setSearch(false)
          game.reset()
          const c = new Chess()
          for (const san of o.line.split(' ')) {
            try {
              const m = c.move(san)
              game.move(m.from, m.to, m.promotion, false)
            } catch {
              break
            }
          }
        }}
      />
    </>
  )
}

function StatsTable({ stats, onPlay }: { stats: ExplorerResult; onPlay: (uci: string) => void }) {
  const { t } = useTranslation()
  const total = (m: { white: number; draws: number; black: number }) => m.white + m.draws + m.black
  const fmt = (n: number) => fmtCompact(n)
  if (!stats.moves.length) return <p className="px-4 py-3 text-[14px] text-fg-3">{t('openings.noStats')}</p>
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-fg-3">
          <th className="px-3 py-1.5 font-semibold">{t('openings.moves')}</th>
          <th className="px-2 py-1.5 text-right font-semibold">{t('openings.games')}</th>
          <th className="px-3 py-1.5 font-semibold" />
        </tr>
      </thead>
      <tbody>
        {stats.moves.map((m) => {
          const n = total(m)
          const w = (m.white / n) * 100
          const d = (m.draws / n) * 100
          const b = 100 - w - d
          return (
            <tr key={m.uci} onClick={() => onPlay(m.uci)} className="cursor-pointer transition-colors duration-100 hover:bg-raise">
              <td className="px-3 py-1.5 font-bold">{m.san}</td>
              <td className="tabular px-2 py-1.5 text-right text-fg-2">{fmt(n)}</td>
              <td className="w-[55%] px-3 py-1.5">
                <div className="tabular flex h-5 overflow-hidden rounded-sm text-[11px] font-bold leading-5" title={`${w.toFixed(0)}% / ${d.toFixed(0)}% / ${b.toFixed(0)}%`}>
                  <span className="bg-[#f1f1f1] text-center text-[#262421]" style={{ width: `${w}%` }}>
                    {w >= 14 ? `${w.toFixed(0)}%` : ''}
                  </span>
                  <span className="bg-[#8b8987] text-center text-white" style={{ width: `${d}%` }}>
                    {d >= 14 ? `${d.toFixed(0)}%` : ''}
                  </span>
                  <span className="bg-[#1b1a18] text-center text-[#f1f1f1]" style={{ width: `${b}%` }}>
                    {b >= 14 ? `${b.toFixed(0)}%` : ''}
                  </span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RepertoirePanel({ onShow }: { onShow: (line: string, color: 'w' | 'b') => void }) {
  const { t } = useTranslation()
  const rows = useLiveQuery(() => db.repertoire.filter((r) => !r.deleted).toArray(), [])
  const now = Date.now()
  const lines = useMemo(() => {
    const m = new Map<string, { line: string; color: 'w' | 'b' }>()
    for (const r of rows ?? []) m.set(`${r.color}|${r.line}`, { line: r.line, color: r.color })
    return [...m.values()]
  }, [rows])

  if (!rows)
    return (
      <div className="grid gap-2 p-3" aria-busy>
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
      </div>
    )
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid gap-2">
        {(['w', 'b'] as const).map((c) => {
          const all = rows.filter((r) => r.color === c)
          const due = all.filter((r) => r.due <= now).length
          return (
            <div key={c} className="flex items-center gap-3 rounded-lg bg-panel-2 p-3">
              <PieceIcon piece="k" color={c} size={34} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{c === 'w' ? t('openings.repertoireWhite') : t('openings.repertoireBlack')}</div>
                <div className="tabular text-[13px] text-fg-3">
                  {t('openings.positions', { count: all.length })} · {t('openings.dueCount', { count: due })}
                </div>
              </div>
              <Link to={`/openings/trainer/${c}`} className={`btn ${due ? 'btn-primary' : ''}`} aria-disabled={!all.length}>
                <Brain size={18} weight="bold" /> {t('openings.train')}
              </Link>
            </div>
          )
        })}
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-[14px] text-fg-2">{t('openings.emptyRepertoire')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {lines.map((l) => (
            <li key={`${l.color}${l.line}`} className="flex items-center gap-2 py-2">
              <PieceIcon piece="k" color={l.color} size={18} />
              <button className="min-w-0 flex-1 truncate text-left text-[13px] text-fg-2 hover:text-fg" onClick={() => onShow(l.line, l.color)}>
                {l.line}
              </button>
              <button
                className="btn btn-ghost btn-icon"
                aria-label={t('openings.remove')}
                onClick={() => window.confirm(t('openings.removeConfirm', { line: l.line })) && void removeLine(l.line, l.color)}
              >
                <Trash size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (o: Opening) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Opening[]>([])
  useEffect(() => {
    void searchOpenings(q).then(setResults)
  }, [q])
  return (
    <Sheet open={open} onClose={onClose} title={t('openings.search')}>
      <input autoFocus className="field mb-3" placeholder="Sicilian, Italian, B20…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('openings.search')} />
      <ul className="max-h-[50dvh] overflow-y-auto">
        {results.map((o) => (
          <li key={o.epd}>
            <button className="w-full rounded-md px-2 py-2 text-left hover:bg-raise" onClick={() => onPick(o)}>
              <div className="text-[14px] font-semibold">
                <span className="tabular text-fg-3">{o.eco}</span> {o.name}
              </div>
              <div className="truncate text-[12px] text-fg-3">{o.line}</div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
