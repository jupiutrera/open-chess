import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowsClockwise, Trash, UsersThree } from '@phosphor-icons/react'
import { PageHeader, Panel, Segmented, Sheet, toast, useOnline } from '../../ui/kit'
import { db, type CloneRow } from '../../db/db'
import { sharedEngine } from '../../engine/engine'
import { fmtDecimal } from '../../i18n/format'
import { BotAvatar } from '../play/BotAvatar'
import { NotFoundError, RateLimitError } from '../import/sources'
import { NoGamesError, buildClone, type BuildOptions, type BuildProgress } from './build'
import { PERIODS, cloneBot, errorRates, favourites, type ClonePeriod, type CloneSource } from './clone'

/** The usernames the import screen remembers, as a starting point. */
const USER_KEYS: Record<Exclude<CloneSource, 'local'>, string> = { chesscom: 'oc-user-chesscom', lichess: 'oc-user-lichess' }

function remembered(source: CloneSource): string {
  if (source === 'local') return ''
  try {
    return localStorage.getItem(USER_KEYS[source]) ?? ''
  } catch {
    return ''
  }
}

export default function CloneManager() {
  const { t } = useTranslation()
  const online = useOnline()
  const clones = useLiveQuery(() => db.clones.orderBy('createdAt').reverse().toArray(), [])
  const [source, setSource] = useState<CloneSource>('chesscom')
  const [username, setUsername] = useState(() => remembered('chesscom'))
  const [period, setPeriod] = useState<ClonePeriod>('year')
  const [progress, setProgress] = useState<BuildProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<CloneRow | null>(null)
  const abort = useRef<AbortController | null>(null)

  const pickSource = (s: CloneSource) => {
    setSource(s)
    setUsername(remembered(s))
    setError(null)
  }

  const run = async (opts: BuildOptions) => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setError(null)
    setProgress({ step: 'download', done: 0, total: 1 })
    try {
      const row = await buildClone(opts, sharedEngine(), (p) => !ctrl.signal.aborted && setProgress(p), ctrl.signal)
      if (ctrl.signal.aborted) return
      await db.clones.put(row)
      toast(t('clone.ready', { name: row.name }))
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(
        e instanceof NoGamesError
          ? t('clone.noGames')
          : e instanceof NotFoundError
            ? t('import.notFound')
            : e instanceof RateLimitError
              ? t('import.rateLimited')
              : online
                ? t('common.error')
                : t('common.offline'),
      )
    } finally {
      if (abort.current === ctrl) {
        abort.current = null
        setProgress(null)
      }
    }
  }

  const nameFor = (s: CloneSource, user: string, p: ClonePeriod) => (s === 'local' ? t(`clone.selfName.${p}`) : user.trim())
  const create = () => void run({ source, username: source === 'local' ? 'local' : username.trim(), period, name: nameFor(source, username, period) })
  const busy = !!progress

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <PageHeader title={t('clone.title')} back="/play?tab=clones" />
      <div className="grid gap-4 px-4 lg:px-6">
        <Panel className="space-y-4 p-4">
          <p className="text-fg-2">{t('clone.intro')}</p>
          <Segmented
            label={t('clone.source')}
            value={source}
            onChange={(s) => !busy && pickSource(s)}
            options={[
              { value: 'chesscom', label: t('import.chesscom') },
              { value: 'lichess', label: t('import.lichess') },
              { value: 'local', label: t('clone.local') },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {source !== 'local' && (
              <label className="text-[13px] font-semibold text-fg-3">
                {t('import.username')}
                <input
                  className="field mt-1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </label>
            )}
            <label className="text-[13px] font-semibold text-fg-3">
              {t('clone.period')}
              <select className="field mt-1" value={period} onChange={(e) => setPeriod(e.target.value as ClonePeriod)} disabled={busy}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`clone.periods.${p}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {progress ? (
            <div className="flex flex-wrap items-center gap-3" role="status">
              <span className="min-w-0 flex-1 text-[14px] text-fg-2">
                {progress.step === 'download' ? t('clone.downloading', { count: progress.done }) : t('clone.analysing', { done: progress.done + 1, total: progress.total })}
              </span>
              <button className="btn" onClick={() => abort.current?.abort()}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={create} disabled={source !== 'local' && !username.trim()}>
              <UsersThree size={20} weight="bold" /> {t('clone.create')}
            </button>
          )}
          {error && (
            <p className="text-[14px] text-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-[12px] text-fg-3">{t('clone.note')}</p>
        </Panel>

        <section>
          <h2 className="mb-2 text-[18px] font-extrabold">{t('clone.yours')}</h2>
          {clones && clones.length === 0 ? (
            <Panel className="p-4 text-fg-2">{t('clone.empty')}</Panel>
          ) : (
            <div className="grid gap-3">
              {(clones ?? []).map((c) => (
                <CloneCard
                  key={c.id}
                  clone={c}
                  busy={busy}
                  onUpdate={() => void run({ source: c.source, username: c.username, period: c.period, name: c.name, id: c.id })}
                  onDelete={() => setRemoving(c)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      <Sheet open={!!removing} onClose={() => setRemoving(null)} title={t('clone.deleteTitle')}>
        <p className="mb-4 text-fg-2">{t('clone.deleteConfirm', { name: removing?.name ?? '' })}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setRemoving(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (removing) void db.clones.delete(removing.id)
              setRemoving(null)
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function CloneCard({ clone, busy, onUpdate, onDelete }: { clone: CloneRow; busy: boolean; onUpdate: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const bot = cloneBot(clone, '')
  const fav = favourites(clone.book)
  const rates = errorRates(clone.errors)
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-3">
        <BotAvatar bot={bot} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold">
            {clone.name} <span className="tabular font-semibold text-fg-3">{clone.elo}</span>
          </div>
          <div className="text-[13px] text-fg-3">
            {t(`clone.sources.${clone.source}`)} · {t(`clone.periods.${clone.period}`)} · {t('clone.games', { count: clone.games })}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid gap-1 text-[14px]">
        {fav.white.length > 0 && <Fact label={t('clone.asWhite')} value={fav.white.join(', ')} />}
        {fav.vsE4.length > 0 && <Fact label={t('clone.vsE4')} value={fav.vsE4.join(', ')} />}
        {fav.vsD4.length > 0 && <Fact label={t('clone.vsD4')} value={fav.vsD4.join(', ')} />}
        <Fact
          label={t('clone.errors')}
          value={rates ? t('clone.errorRates', { blunders: fmtDecimal(rates.blunder * 100), mistakes: fmtDecimal(rates.mistake * 100) }) : t('clone.noErrors')}
        />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/play/bot/${bot.id}`} className="btn btn-primary">
          {t('clone.play')}
        </Link>
        <button className="btn" onClick={onUpdate} disabled={busy}>
          <ArrowsClockwise size={18} weight="bold" /> {t('clone.update')}
        </button>
        <button className="btn btn-ghost ml-auto" onClick={onDelete} aria-label={t('common.delete')}>
          <Trash size={18} weight="bold" />
        </button>
      </div>
    </Panel>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-fg-3">{label}</dt>
      <dd className="min-w-0 font-semibold">{value}</dd>
    </div>
  )
}
