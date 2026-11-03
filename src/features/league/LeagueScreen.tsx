import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowsClockwise, Info, Play } from '@phosphor-icons/react'
import { PageHeader, Panel, Segmented, SkeletonText, toast } from '../../ui/kit'
import { BotAvatar } from '../play/BotAvatar'
import { clearLiveGame, loadLiveGame } from '../play/liveGame'
import { timeControl } from '../play/timeControl'
import {
  START_LEVELS,
  findRival,
  isProvisional,
  meetAgain,
  newLeague,
  parseRivalId,
  recentRivals,
  record,
  rivalBot,
  rivalId,
  rivalProfile,
  settlePending,
  type LeagueGame,
  type LeagueState,
  type Rival,
} from './league'
import { saveLeague, updateLeague, useLeague } from './store'

/** clocks a league game can be played at: always with one, as rated play is */
const LEAGUE_CLOCKS = ['3+2', '5+0', '10+0', '15+10'] as const

export default function League() {
  const { t } = useTranslation()
  const league = useLeague()

  // a rated game left unfinished elsewhere counts as lost, once, on arrival
  const settled = useRef(false)
  useEffect(() => {
    if (!league || settled.current) return
    settled.current = true
    const pending = league.pending
    void updateLeague((s) => settlePending(s, loadLiveGame('bot')?.botId ?? null)).then((s) => {
      if (pending && s && !s.pending) toast(t('league.abandoned', { name: pending.handle }), 'error')
    })
  }, [league, t])

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader title={t('league.title')} back="/play" />
      <div className="grid gap-4 px-4 lg:px-6">
        {league === undefined ? (
          <Panel className="space-y-3 p-4">
            <SkeletonText width="60%" />
            <SkeletonText width="80%" />
          </Panel>
        ) : league === null ? (
          <StartPicker />
        ) : (
          <LeagueHome league={league} />
        )}
        <p className="flex gap-2 text-[13px] text-fg-3">
          <Info size={18} weight="bold" className="shrink-0" />
          {t('league.note')}
        </p>
      </div>
    </div>
  )
}

function StartPicker() {
  const { t } = useTranslation()
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <h2 className="text-[20px] font-extrabold">{t('league.startTitle')}</h2>
      <p className="text-fg-2">{t('league.startHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {START_LEVELS.map((l) => (
          <button key={l.id} className="btn justify-between" onClick={() => void saveLeague(newLeague(l.rating))}>
            <span>{t(`league.level.${l.id}`)}</span>
            <span className="tabular font-normal text-fg-3">{l.rating}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function LeagueHome({ league }: { league: LeagueState }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const rating = league.rating.rating
  const [rival, setRival] = useState<Rival>(() => findRival(rating))
  const [tc, setTc] = useState<string>('10+0')
  const live = loadLiveGame('bot')
  const liveRival = live?.botId ? parseRivalId(live.botId) : null

  const play = (r: Rival) => {
    clearLiveGame('bot')
    nav(`/play/bot/${rivalId(r)}?${new URLSearchParams({ color: 'r', tc })}`)
  }
  const overall = record(league.games)

  return (
    <>
      <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <div className="text-[13px] font-semibold text-fg-3">{t('league.rating')}</div>
          <div className="tabular text-[40px] font-extrabold leading-none" data-testid="league-rating">
            {rating}
            {isProvisional(league.rating) && <span className="text-fg-3">?</span>}
          </div>
          <div className="tabular mt-1 text-[13px] text-fg-3">
            {isProvisional(league.rating) ? t('league.provisional') : t('league.record', overall)}
          </div>
        </div>
        <RatingLine games={league.games} start={league.games[0]?.before ?? rating} />
      </Panel>

      {liveRival && live ? (
        <ContinueCard rival={liveRival} tc={live.tc} color={live.userColor ?? 'w'} />
      ) : (
        <RivalCard rival={rival} games={league.games} tc={tc} setTc={setTc} onPlay={() => play(rival)} onAnother={() => setRival(findRival(rating))} />
      )}

      <RecentRivals games={league.games} rating={rating} onRematch={liveRival ? undefined : (r) => play(meetAgain(r, rating))} />
      <History games={league.games} />
    </>
  )
}

/** The user's rating after each game; the list below is its table view. */
function RatingLine({ games, start }: { games: LeagueGame[]; start: number }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const points = useMemo(() => [start, ...games.slice(-50).map((g) => g.after)], [games, start])
  if (points.length < 3) return <p className="flex-1 text-[14px] text-fg-3 sm:text-right">{t('league.lineEmpty')}</p>
  const W = 320
  const H = 72
  const pad = 6
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const span = Math.max(20, hi - lo)
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad)
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad)
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const at = hover ?? points.length - 1
  return (
    <div className="relative min-w-0 flex-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[72px] w-full overflow-visible"
        role="img"
        aria-label={t('league.lineLabel', { from: points[0], to: points[points.length - 1] })}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - box.left) / box.width) * W
          const i = Math.round(((px - pad) / (W - 2 * pad)) * (points.length - 1))
          setHover(Math.max(0, Math.min(points.length - 1, i)))
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={pad} x2={W - pad} y1={y(points[0])} y2={y(points[0])} stroke="var(--line)" strokeDasharray="3 4" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(at)} cy={y(points[at])} r={4.5} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
      </svg>
      <span className="tabular pointer-events-none absolute right-0 top-0 rounded bg-raise-2 px-1.5 py-0.5 text-[12px] font-semibold">{points[at]}</span>
    </div>
  )
}

function RivalCard({
  rival,
  games,
  tc,
  setTc,
  onPlay,
  onAnother,
}: {
  rival: Rival
  games: LeagueGame[]
  tc: string
  setTc: (tc: string) => void
  onPlay: () => void
  onAnother: () => void
}) {
  const { t } = useTranslation()
  const p = rivalProfile(rival.seed)
  const bot = rivalBot(rival)
  const vs = record(games, rival.seed)
  const met = vs.w + vs.d + vs.l > 0
  return (
    <Panel className="flex flex-col gap-4 p-4">
      <h2 className="text-[18px] font-extrabold">{t('league.findTitle')}</h2>
      <div key={rival.seed} className="enter flex items-center gap-3">
        <BotAvatar bot={bot} size={64} />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold" data-testid="rival-name">
            {p.handle} <span className="tabular font-normal text-fg-3">{rival.elo}</span>
          </div>
          <div className="text-[13px] font-semibold text-accent">{t(`league.style.${p.style}`)}</div>
          <p className="text-[14px] text-fg-2">{t(`league.bio.${p.style}`)}</p>
          <p className="tabular text-[13px] text-fg-3">{met ? t('league.vsYou', vs) : t('league.firstMeet')}</p>
        </div>
      </div>
      <Segmented
        value={tc}
        onChange={setTc}
        label={t('league.time')}
        options={LEAGUE_CLOCKS.map((id) => ({ value: id, label: timeControl(id).label }))}
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-primary btn-lg" onClick={onPlay}>
          <Play size={20} weight="fill" /> {t('league.play')}
        </button>
        <button className="btn btn-lg" onClick={onAnother}>
          <ArrowsClockwise size={20} weight="bold" /> {t('league.another')}
        </button>
      </div>
    </Panel>
  )
}

function ContinueCard({ rival, tc, color }: { rival: Rival; tc: string; color: string }) {
  const { t } = useTranslation()
  const bot = rivalBot(rival)
  return (
    <Panel className="flex flex-wrap items-center gap-3 p-4">
      <BotAvatar bot={bot} size={48} />
      <div className="min-w-0 flex-1 font-bold">{t('league.continue', { name: bot.name })}</div>
      <Link to={`/play/bot/${rivalId(rival)}?${new URLSearchParams({ tc, color, resume: '1' })}`} className="btn btn-primary">
        {t('play.continue')}
      </Link>
    </Panel>
  )
}

function RecentRivals({ games, rating, onRematch }: { games: LeagueGame[]; rating: number; onRematch?: (r: Rival) => void }) {
  const { t } = useTranslation()
  const rivals = recentRivals(games)
  if (!rivals.length) return null
  return (
    <section>
      <h2 className="mb-2 text-[18px] font-extrabold">{t('league.recent')}</h2>
      <Panel className="divide-y divide-line overflow-hidden">
        {rivals.map((r) => {
          const again = meetAgain(r, rating)
          const vs = record(games, r.seed)
          return (
            <div key={r.seed} className="flex items-center gap-3 px-4 py-3">
              <BotAvatar bot={rivalBot(again)} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">
                  {rivalProfile(r.seed).handle} <span className="tabular font-normal text-fg-3">{again.elo}</span>
                </div>
                <div className="tabular text-[13px] text-fg-3">{t('league.vsYou', vs)}</div>
              </div>
              {onRematch && (
                <button className="btn shrink-0" onClick={() => onRematch(r)}>
                  {t('league.rematch')}
                </button>
              )}
            </div>
          )
        })}
      </Panel>
    </section>
  )
}

function History({ games }: { games: LeagueGame[] }) {
  const { t } = useTranslation()
  const last = games.slice(-15).reverse()
  return (
    <section>
      <h2 className="mb-2 text-[18px] font-extrabold">{t('league.history')}</h2>
      {!last.length ? (
        <Panel className="p-4 text-fg-2">{t('league.empty')}</Panel>
      ) : (
        <Panel className="divide-y divide-line overflow-hidden">
          {last.map((g) => {
            const delta = g.after - g.before
            const label = g.abandoned ? t('league.abandonedTag') : t(g.score === 1 ? 'league.won' : g.score === 0.5 ? 'league.drew' : 'league.lost')
            const row = (
              <>
                <span className={`w-20 shrink-0 text-[13px] font-semibold ${g.score === 1 ? 'text-accent' : 'text-fg-3'}`}>{label}</span>
                <span className="min-w-0 flex-1 truncate">
                  {g.handle} <span className="tabular text-fg-3">{g.elo}</span>
                </span>
                <span className="tabular shrink-0 text-[14px] font-semibold">
                  {delta >= 0 ? '+' : '−'}
                  {Math.abs(delta)}
                </span>
              </>
            )
            return g.gameId ? (
              <Link key={g.at} to={`/review/${g.gameId}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raise">
                {row}
              </Link>
            ) : (
              <div key={g.at} className="flex items-center gap-3 px-4 py-2.5">
                {row}
              </div>
            )
          })}
        </Panel>
      )}
    </section>
  )
}
