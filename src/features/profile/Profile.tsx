import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudArrowUp, SignOut, GoogleLogo, EnvelopeSimple, DownloadSimple, UploadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { PageHeader, Panel, Skeleton, SkeletonText, toast, timeAgo } from '../../ui/kit'
import { db, kvGet } from '../../db/db'
import { getPuzzleRating } from '../puzzles/puzzlesData'
import { BOTS } from '../play/bots'
import { BotAvatar } from '../play/BotAvatar'
import { RatingChart } from './RatingChart'
import { useSettings } from '../../settings'
import { exportBackup, importBackup, signInWithEmail, signInWithGoogle, signOut, syncConfigured, syncNow, useSync } from '../../sync/sync'
import { saveTextFile } from '../../ui/files'
import { fmtDecimal } from '../../i18n/format'

export default function Profile() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const data = useLiveQuery(async () => {
    const [rating, attempts, games, rush] = await Promise.all([
      getPuzzleRating(),
      db.puzzleAttempts.orderBy('date').filter((a) => !a.deleted).toArray(),
      db.games.filter((g) => !g.deleted).toArray(),
      kvGet<Record<string, number>>('rushBest', {}),
    ])
    const accs = games
      .filter((g) => g.review && g.userColor)
      .map((g) => (g.userColor === 'w' ? g.review!.accuracy.white : g.review!.accuracy.black))
    const history = attempts.filter((a) => a.ratingAfter !== undefined).map((a) => ({ date: a.date, rating: a.ratingAfter! }))
    const vsBots = BOTS.map((b) => {
      const r = { w: 0, d: 0, l: 0 }
      for (const g of games) {
        if (g.botId !== b.id || !g.userColor) continue
        if (g.result === '1/2-1/2') r.d++
        else if ((g.result === '1-0') === (g.userColor === 'w')) r.w++
        else r.l++
      }
      return { bot: b, ...r }
    }).filter((r) => r.w + r.d + r.l > 0)
    return {
      rating: rating.rating,
      solved: attempts.filter((a) => a.solved).length,
      gamesPlayed: games.length,
      avgAcc: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null,
      rushBest: Math.max(0, ...Object.values(rush)),
      history,
      vsBots,
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader title={t('profile.title')} />
      <div className="grid gap-4 px-4 lg:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t('profile.puzzleRating')} value={data?.rating} />
          <Stat label={t('profile.puzzlesSolved')} value={data?.solved} />
          <Stat label={t('profile.gamesPlayed')} value={data?.gamesPlayed} />
          <Stat label={t('profile.avgAccuracy')} value={data?.avgAcc != null ? `${fmtDecimal(data.avgAcc)}%` : '-'} />
          <Stat label={t('profile.rushBest')} value={data?.rushBest} />
        </div>

        <Panel className="p-4">
          <h2 className="mb-3 font-extrabold">{t('profile.ratingHistory')}</h2>
          {!data ? (
            <Skeleton className="h-40 rounded" />
          ) : data.history.length > 1 ? (
            <RatingChart points={data.history} lang={lang} />
          ) : (
            <p className="text-[14px] text-fg-3">{t('profile.noData')}</p>
          )}
        </Panel>

        {data && data.vsBots.length > 0 && (
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 font-extrabold">{t('profile.vsBots')}</h2>
            <ul className="divide-y divide-line">
              {data.vsBots.map((r) => (
                <li key={r.bot.id} className="flex items-center gap-3 px-4 py-2.5">
                  <BotAvatar bot={r.bot} size={32} />
                  <span className="flex-1 font-semibold">
                    {r.bot.name} <span className="tabular font-normal text-fg-3">{r.bot.elo}</span>
                  </span>
                  <span className="tabular text-[14px]">
                    <b className="text-accent">{r.w}</b> / <span className="text-fg-2">{r.d}</span> / <b className="text-danger">{r.l}</b>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <SyncPanel lang={lang} />
        <BackupPanel />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <Panel className="p-4">
      <div className="text-[12px] font-bold text-fg-3">{label}</div>
      <div className="tabular mt-1 text-[26px] font-extrabold leading-none">{value ?? <SkeletonText width="2.5ch" />}</div>
    </Panel>
  )
}

function SyncPanel({ lang }: { lang: string }) {
  const { t } = useTranslation()
  const { user, syncing, lastSync, error } = useSync()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <Panel className="p-4">
      <h2 className="mb-2 flex items-center gap-2 font-extrabold">
        <CloudArrowUp size={22} weight="bold" /> {t('profile.sync')}
      </h2>
      {!syncConfigured ? (
        <p className="text-[14px] text-fg-3">{t('profile.syncOff')}</p>
      ) : user ? (
        <div className="grid gap-3">
          <p className="text-[14px] text-fg-2">{t('profile.signedAs', { email: user.email })}</p>
          <p className="text-[13px] text-fg-3">{t('profile.lastSync', { when: lastSync ? timeAgo(lastSync, lang) : t('profile.never') })}</p>
          {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void syncNow()} disabled={syncing}>
              <ArrowsClockwise size={18} weight="bold" className={syncing ? 'animate-spin' : ''} /> {t('profile.syncNow')}
            </button>
            <button className="btn" onClick={() => void signOut()}>
              <SignOut size={18} weight="bold" /> {t('profile.signOut')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await signInWithEmail(email)
                setSent(true)
              } catch (err) {
                toast(err instanceof Error ? err.message : t('common.error'), 'error')
              }
            }}
          >
            <label htmlFor="sync-email" className="text-[13px] font-bold text-fg-3">
              {t('profile.email')}
            </label>
            <div className="flex gap-2">
              <input id="sync-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary">
                <EnvelopeSimple size={18} weight="bold" /> <span className="hidden sm:inline">{t('profile.sendLink')}</span>
              </button>
            </div>
            {sent && <p className="text-[13px] text-accent">{t('profile.linkSent')}</p>}
          </form>
          <button className="btn" onClick={() => void signInWithGoogle().catch((e) => toast(String(e.message ?? e), 'error'))}>
            <GoogleLogo size={18} weight="bold" /> {t('profile.google')}
          </button>
        </div>
      )}
    </Panel>
  )
}

function BackupPanel() {
  const { t } = useTranslation()
  const download = async () => {
    try {
      await saveTextFile(`open-chess-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup(), 'application/json')
    } catch (e) {
      // closing the share sheet rejects too; only real failures are worth a message
      if (!/cancel/i.test(String((e as Error)?.message ?? e))) toast(t('common.error'), 'error')
    }
  }
  return (
    <Panel className="p-4">
      <h2 className="mb-3 font-extrabold">{t('profile.backup')}</h2>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => void download()}>
          <DownloadSimple size={18} weight="bold" /> {t('profile.export')}
        </button>
        <label className="btn cursor-pointer">
          <UploadSimple size={18} weight="bold" /> {t('profile.importBackup')}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                await importBackup(await f.text())
                toast(t('profile.restored'), 'success')
              } catch {
                toast(t('common.error'), 'error')
              }
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </Panel>
  )
}
