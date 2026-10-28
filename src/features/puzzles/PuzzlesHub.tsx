import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Timer, Infinity as InfinityIcon, CaretRight, CheckCircle, XCircle, Fire } from '@phosphor-icons/react'
import { AppIcon } from '../../ui/AppIcon'
import { PageHeader, Panel, SkeletonText } from '../../ui/kit'
import { db, kvGet } from '../../db/db'
import { getPuzzleRating, THEMES } from './puzzlesData'
import { useSettings } from '../../settings'

export default function PuzzlesHub() {
  const { t } = useTranslation()
  const rating = useLiveQuery(() => getPuzzleRating(), [])
  const solved = useLiveQuery(() => db.puzzleAttempts.filter((a) => a.solved && !a.deleted).count(), [])
  const rush = useLiveQuery(() => kvGet<Record<string, number>>('rushBest', {}), [])
  const lang = useSettings((s) => s.lang)
  // last rated attempts: the history list and the current run of solved puzzles
  const recent = useLiveQuery(
    () =>
      db.puzzleAttempts
        .orderBy('date')
        .reverse()
        .filter((a) => !a.deleted && (a.mode === 'rated' || a.mode === 'theme' || a.mode === 'daily'))
        .limit(50)
        .toArray(),
    [],
  )
  const streak = recent ? recent.findIndex((a) => !a.solved) : 0
  const run = streak === -1 ? (recent?.length ?? 0) : streak

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader title={t('puzzles.title')} />
      <div className="grid gap-3 px-4 lg:px-6">
        <Link to="/puzzles/rated" className="group">
          <Panel className="flex items-center gap-4 p-5 transition-colors duration-150 group-hover:bg-raise">
            <AppIcon name="puzzles" size={52} />
            <div className="flex-1">
              <div className="text-[20px] font-extrabold">{t('puzzles.rated')}</div>
              <div className="tabular text-fg-2">
                {t('common.rating')}: <b className="text-fg">{rating?.rating ?? <SkeletonText width="4ch" />}</b>
                {solved !== undefined && (
                  <span className="text-fg-3">
                    {' '}
                    · {t('profile.puzzlesSolved')}: {solved}
                  </span>
                )}
                {run > 1 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-warn">
                    <Fire size={16} weight="fill" /> {t('puzzles.streak')}: {run}
                  </span>
                )}
              </div>
            </div>
            <CaretRight size={22} className="text-fg-3" />
          </Panel>
        </Link>

        <Panel className="p-5">
          <div className="mb-1 flex items-center gap-3">
            <AppIcon name="rush" size={40} />
            <div>
              <div className="text-[18px] font-extrabold">{t('puzzles.rush')}</div>
              <div className="text-[13px] text-fg-3">{t('puzzles.rushSub')}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { mode: '3', label: t('puzzles.rush3'), icon: Timer },
              { mode: '5', label: t('puzzles.rush5'), icon: Timer },
              { mode: 'survival', label: t('puzzles.survival'), icon: InfinityIcon },
            ].map((m) => (
              <Link key={m.mode} to={`/puzzles/rush/${m.mode}`} className="btn h-auto flex-col gap-0.5 py-3">
                <m.icon size={22} weight="bold" />
                <span className="text-[14px]">{m.label}</span>
                <span className="tabular text-[12px] font-semibold text-fg-3">
                  {t('puzzles.best')}: {rush?.[m.mode] ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Link to="/puzzles/rush/streak" className="group">
          <Panel className="flex items-center gap-4 p-5 transition-colors duration-150 group-hover:bg-raise">
            <span className="grid h-10 w-10 shrink-0 place-items-center">
              <Fire size={36} weight="fill" className="text-warn" />
            </span>
            <div className="flex-1">
              <div className="text-[18px] font-extrabold">{t('puzzles.streakMode')}</div>
              <div className="text-[13px] text-fg-3">{t('puzzles.streakSub')}</div>
            </div>
            <span className="tabular text-[13px] font-semibold text-fg-3">
              {t('puzzles.best')}: {rush?.streak ?? 0}
            </span>
            <CaretRight size={22} className="text-fg-3" />
          </Panel>
        </Link>

        <Link to="/puzzles/mistakes" className="group">
          <Panel className="flex items-center gap-4 p-5 transition-colors duration-150 group-hover:bg-raise">
            <AppIcon name="analysis" size={40} />
            <div className="flex-1">
              <div className="text-[18px] font-extrabold">{t('puzzles.mistakes')}</div>
              <div className="text-[13px] text-fg-3">{t('puzzles.mistakesSub')}</div>
            </div>
            <CaretRight size={22} className="text-fg-3" />
          </Panel>
        </Link>

        <Link to="/puzzles/daily" className="group">
          <Panel className="flex items-center gap-4 p-5 transition-colors duration-150 group-hover:bg-raise">
            <AppIcon name="daily" size={40} />
            <div className="flex-1 text-[18px] font-extrabold">{t('puzzles.daily')}</div>
            <CaretRight size={22} className="text-fg-3" />
          </Panel>
        </Link>

        <Panel className="p-5">
          <h2 className="mb-3 text-[18px] font-extrabold">{t('puzzles.themes')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((th) => (
              <Link
                key={th}
                to={`/puzzles/rated?theme=${th}`}
                className="rounded-lg bg-panel-2 px-3 py-3 text-[14px] font-semibold text-fg-2 transition-colors duration-150 hover:bg-raise hover:text-fg"
              >
                {t(`themes.${th}`, th)}
              </Link>
            ))}
          </div>
        </Panel>

        {recent && recent.length > 0 && (
          <Panel className="p-5">
            <h2 className="mb-2 text-[18px] font-extrabold">{t('puzzles.history')}</h2>
            <ul className="divide-y divide-line">
              {recent.slice(0, 12).map((a) => (
                <li key={a.id} className="tabular flex items-center gap-3 py-2 text-[14px]">
                  {a.solved ? (
                    <CheckCircle size={20} weight="fill" className="text-accent" aria-label={t('puzzles.solved')} />
                  ) : (
                    <XCircle size={20} weight="fill" className="text-danger" aria-label={t('puzzles.failed')} />
                  )}
                  <span className="font-semibold">{t('puzzles.puzzleRating', { rating: a.rating })}</span>
                  <span className="text-fg-3">{new Date(a.date).toLocaleDateString(lang)}</span>
                  {a.ratingAfter !== undefined && <span className="ml-auto font-bold">{a.ratingAfter}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}
