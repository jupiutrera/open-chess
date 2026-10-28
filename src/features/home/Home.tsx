import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { DownloadSimple, CaretRight } from '@phosphor-icons/react'
import { AppIcon, type AppIconName } from '../../ui/AppIcon'
import { PieceIcon } from '../../board/QualityIcon'
import { Chess } from 'chess.js'
import { Board } from '../../board/Board'
import { Panel, Skeleton, SkeletonRows } from '../../ui/kit'
import { Logo } from '../../ui/Logo'
import { db } from '../../db/db'
import { recentGames } from '../../db/games'
import { dailyPuzzle, getPuzzleRating, type Puzzle } from '../puzzles/puzzlesData'
import { playUci } from '../../chess/util'
import { GameRowItem } from '../profile/GameRowItem'
import { playerName } from '../play/playerName'

export function Home() {
  const { t } = useTranslation()
  const games = useLiveQuery(() => recentGames(5), [])
  const rating = useLiveQuery(() => getPuzzleRating(), [])
  const due = useLiveQuery(() => db.repertoire.where('due').below(Date.now()).filter((r) => !r.deleted).count(), [])
  const [daily, setDaily] = useState<{ p: Puzzle; fen: string; color: 'white' | 'black' } | null>(null)
  const [dailyFailed, setDailyFailed] = useState(false)

  useEffect(() => {
    void dailyPuzzle()
      .then((p) => {
        if (!p) return setDailyFailed(true)
        const c = new Chess(p.fen)
        playUci(c, p.moves[0])
        setDaily({ p, fen: c.fen(), color: c.turn() === 'w' ? 'white' : 'black' })
      })
      // offline before the puzzles were ever cached
      .catch(() => setDailyFailed(true))
  }, [])

  const last = games?.[0]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 lg:px-6 lg:pt-6">
      <div className="mb-5 flex items-center gap-3 lg:hidden">
        <Logo size={34} />
        <span className="text-[21px] font-extrabold tracking-tight">Open Chess</span>
      </div>
      <h1 className="mb-4 text-[24px] font-extrabold tracking-tight lg:text-[28px]">{t('home.greeting')}</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-3">
          <Link to="/play" className="group">
            <Panel className="flex items-center gap-4 p-5 transition-colors duration-150 group-hover:bg-raise">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-accent shadow-[0_3px_0_0_var(--accent-lo)]">
                <PieceIcon piece="n" color="w" size={50} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[22px] font-extrabold">{t('home.playBot')}</div>
                <div className="text-fg-2">{t('home.playBotSub')}</div>
              </div>
              <CaretRight size={24} className="text-fg-3" />
            </Panel>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Tile to="/puzzles/rated" icon="puzzles" title={t('home.puzzles')} sub={rating ? `${t('home.puzzleRating')}: ${rating.rating}` : undefined} />
            <Tile to="/puzzles" icon="rush" title={t('home.rush')} />
            <Tile to="/lessons" icon="learn" title={t('home.lessons')} />
            <Tile
              to="/openings"
              icon="openings"
              title={t('home.openings')}
              sub={due ? t('home.due', { count: due }) : undefined}
            />
          </div>

          {last && (
            <Link to={`/review/${last.id}`} className="group">
              <Panel className="flex items-center gap-4 p-4 transition-colors duration-150 group-hover:bg-raise">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-raise">
                  <AppIcon name="analysis" size={30} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-extrabold">{t('home.review')}</div>
                  <div className="truncate text-[14px] text-fg-2">
                    {playerName(last.white, last.source, t)} {t('games.vs')} {playerName(last.black, last.source, t)} · {last.result.replace('1/2-1/2', '½-½')}
                  </div>
                </div>
                <CaretRight size={22} className="text-fg-3" />
              </Panel>
            </Link>
          )}

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-extrabold">{t('home.recent')}</h2>
              <Link to="/games" className="text-[14px] font-semibold text-fg-3 hover:text-fg">
                {t('nav.games')}
              </Link>
            </div>
            {games && games.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-4">
                <p className="text-fg-2">{t('home.noGames')}</p>
                <Link to="/import" className="btn">
                  <DownloadSimple size={20} weight="bold" /> {t('home.import')}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-line">{games ? games.map((g) => <GameRowItem key={g.id} game={g} />) : <SkeletonRows count={3} />}</div>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-3">
          <Link to="/puzzles/daily" className="group">
            <Panel className="overflow-hidden transition-colors duration-150 group-hover:bg-raise">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="flex items-center gap-2 font-extrabold">
                  <AppIcon name="daily" size={22} /> {t('home.dailyPuzzle')}
                </h2>
                {daily && <span className="tabular text-[13px] text-fg-3">{daily.p.rating}</span>}
              </div>
              <div className="px-3 pb-3">
                {daily ? (
                  <Board fen={daily.fen} orientation={daily.color} />
                ) : dailyFailed ? (
                  <div className="grid aspect-square w-full place-items-center rounded bg-panel-2 p-4 text-center text-[14px] text-fg-3">{t('common.offline')}</div>
                ) : (
                  <Skeleton className="aspect-square w-full rounded" />
                )}
              </div>
            </Panel>
          </Link>
          <Link to="/import" className="group">
            <Panel className="flex items-center gap-3 p-4 transition-colors duration-150 group-hover:bg-raise">
              <AppIcon name="import" size={28} />
              <span className="flex-1 font-semibold">{t('home.import')}</span>
              <CaretRight size={20} className="text-fg-3" />
            </Panel>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Tile({ to, icon, title, sub }: { to: string; icon: AppIconName; title: string; sub?: string }) {
  return (
    <Link to={to} className="group">
      <Panel className="flex h-full flex-col gap-2 p-4 transition-colors duration-150 group-hover:bg-raise">
        <span className="grid h-11 w-11 place-items-center transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.06]">
          <AppIcon name={icon} size={40} />
        </span>
        <div className="text-[16px] font-extrabold leading-tight">{title}</div>
        {sub && <div className="tabular -mt-1 text-[13px] text-fg-3">{sub}</div>}
      </Panel>
    </Link>
  )
}
