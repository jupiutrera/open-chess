import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudArrowUp, SignOut, GoogleLogo, EnvelopeSimple, DownloadSimple, UploadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { PageHeader, Panel, Skeleton, SkeletonText, toast, timeAgo } from '../../ui/kit'
import { db, kvGet } from '../../db/db'
import { getPuzzleRating } from '../puzzles/puzzlesData'
import { BOTS, botName } from '../play/bots'
import { BotAvatar } from '../play/BotAvatar'
import { RatingChart } from './RatingChart'
import { useSettings } from '../../settings'
import { exportBackup, importBackup, signInWithEmail, signInWithGoogle, signOut, syncConfigured, syncNow, useSync } from '../../sync/sync'
import { saveTextFile } from '../../ui/files'
import { fmtDecimal } from '../../i18n/format'
import { PieceIcon } from '../../board/QualityIcon'
import { gameOutcome, gameSpeed, SPEEDS, type Outcome } from './gameFilter'

type Wdl = Record<Outcome, number>
const wdl = (): Wdl => ({ win: 0, draw: 0, loss: 0 })

export default function Profile() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const data = useLiveQuery(async () => {
    // rows are streamed with each() and reduced to a few numbers, so the PGNs and
    // reviews of every game are never held in memory at once
    let solved = 0
    const history: { date: number; rating: number }[] = []
    const attemptsDone = db.puzzleAttempts.orderBy('date').each((a) => {
      if (a.deleted) return
      if (a.solved) solved++
      if (a.ratingAfter !== undefined) history.push({ date: a.date, rating: a.ratingAfter })
    })
    let gamesPlayed = 0
    let accSum = 0
    let accN = 0
    const botResults = new Map<string, { w: number; d: number; l: number }>()
    // the user's results overall, by colour and by speed
    const results = { all: wdl(), w: wdl(), b: wdl(), ...Object.fromEntries(SPEEDS.map((sp) => [sp, wdl()])) } as Record<string, Wdl>
    // results by opening (family name before the colon), for games where we know the user's side
    const byOpening = new Map<string, { n: number; points: number; accSum: number; accN: number; color: 'w' | 'b' }>()
    const gamesDone = db.games.each((g) => {
      if (g.deleted) return
      gamesPlayed++
      const uc = g.userColor
      if (!uc) return
      const acc = g.review ? (uc === 'w' ? g.review.accuracy.white : g.review.accuracy.black) : null
      if (acc !== null) {
        accSum += acc
        accN++
      }
      const outcome = gameOutcome(g)
      if (!outcome) return
      results.all[outcome]++
      results[uc][outcome]++
      const speed = gameSpeed(g.timeControl)
      if (speed) results[speed][outcome]++
      if (g.botId) {
        const r = botResults.get(g.botId) ?? { w: 0, d: 0, l: 0 }
        r[outcome === 'win' ? 'w' : outcome === 'draw' ? 'd' : 'l']++
        botResults.set(g.botId, r)
      }
      if (!g.opening) return
      // "B20 Sicilian Defense: …" and "B27 Sicilian Defense" are one family: the ECO code goes too
      const key = `${uc}|${g.opening.split(':')[0].replace(/^[A-E]\d\d\s+/, '').trim()}`
      const row = byOpening.get(key) ?? { n: 0, points: 0, accSum: 0, accN: 0, color: uc }
      row.n++
      row.points += outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0
      if (acc !== null) {
        row.accSum += acc
        row.accN++
      }
      byOpening.set(key, row)
    })
    const [rating, rush] = await Promise.all([getPuzzleRating(), kvGet<Record<string, number>>('rushBest', {}), attemptsDone, gamesDone])
    const vsBots = BOTS.flatMap((b) => {
      const r = botResults.get(b.id)
      return r ? [{ bot: b, ...r }] : []
    })
    const openings = [...byOpening.entries()]
      .map(([key, r]) => ({ name: key.slice(2), n: r.n, color: r.color, score: (r.points / r.n) * 100, avgAcc: r.accN ? r.accSum / r.accN : null }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
    return {
      rating: rating.rating,
      solved,
      gamesPlayed,
      avgAcc: accN ? accSum / accN : null,
      // the Puzzle Streak record shares the rushBest row but isn't a Rush score
      rushBest: Math.max(0, ...Object.entries(rush).flatMap(([k, v]) => (k === 'streak' ? [] : [v]))),
      history,
      vsBots,
      openings,
      results,
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

        {data && data.results.all.win + data.results.all.draw + data.results.all.loss > 0 && (
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 font-extrabold">{t('profile.results')}</h2>
            <ul className="divide-y divide-line">
              {(['all', 'w', 'b', ...SPEEDS] as const).map((k) => (
                <ResultRow
                  key={k}
                  label={k === 'all' ? t('profile.overall') : k === 'w' ? t('profile.withWhite') : k === 'b' ? t('profile.withBlack') : t(`games.${k}`)}
                  r={data.results[k]}
                />
              ))}
            </ul>
          </Panel>
        )}

        {data && data.vsBots.length > 0 && (
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 font-extrabold">{t('profile.vsBots')}</h2>
            <ul className="divide-y divide-line">
              {data.vsBots.map((r) => (
                <li key={r.bot.id} className="flex items-center gap-3 px-4 py-2.5">
                  <BotAvatar bot={r.bot} size={32} />
                  <span className="flex-1 font-semibold">
                    {botName(r.bot, lang)} <span className="tabular font-normal text-fg-3">{r.bot.elo}</span>
                  </span>
                  <span className="tabular text-[14px]">
                    <b className="text-accent">{r.w}</b> / <span className="text-fg-2">{r.d}</span> / <b className="text-danger">{r.l}</b>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {data && data.openings.length > 0 && (
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 font-extrabold">{t('profile.byOpening')}</h2>
            <ul className="divide-y divide-line">
              {data.openings.map((o) => (
                <li key={o.color + o.name} className="flex items-center gap-3 px-4 py-2.5">
                  <PieceIcon piece="k" color={o.color} size={22} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.name}</span>
                  <span className="tabular w-12 text-right text-[13px] text-fg-3">{t('profile.gamesShort', { count: o.n })}</span>
                  <span className={`tabular w-14 text-right font-bold ${o.score >= 50 ? 'text-accent' : 'text-danger'}`}>{Math.round(o.score)}%</span>
                  <span className="tabular hidden w-16 text-right text-[13px] text-fg-2 sm:block">{o.avgAcc !== null ? fmtDecimal(o.avgAcc) : '–'}</span>
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

/** One line of the results table: games, a won/drawn/lost bar and the three counts. Empty speeds are skipped. */
function ResultRow({ label, r }: { label: string; r: Wdl }) {
  const { t } = useTranslation()
  const n = r.win + r.draw + r.loss
  if (!n) return null
  const pct = (x: number) => `${(x / n) * 100}%`
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-28 shrink-0 truncate font-semibold sm:w-32">{label}</span>
      <span className="tabular w-12 shrink-0 text-right text-[13px] text-fg-3">{t('profile.gamesShort', { count: n })}</span>
      <span
        className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raise"
        role="img"
        aria-label={`${t('profile.won')} ${r.win}, ${t('profile.drawn')} ${r.draw}, ${t('profile.lost')} ${r.loss}`}
      >
        <span className="bg-accent" style={{ width: pct(r.win) }} />
        <span className="bg-fg-3" style={{ width: pct(r.draw) }} />
        <span className="bg-danger" style={{ width: pct(r.loss) }} />
      </span>
      <span className="tabular w-24 shrink-0 text-right text-[14px]" aria-hidden>
        <b className="text-accent">{r.win}</b> / <span className="text-fg-2">{r.draw}</span> / <b className="text-danger">{r.loss}</b>
      </span>
    </li>
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
