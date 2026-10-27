import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MagnifyingGlass, DownloadSimple, CheckCircle, FileArrowUp } from '@phosphor-icons/react'
import { PageHeader, Panel, Segmented, Skeleton, toast, useOnline } from '../../ui/kit'
import { chesscomArchives, chesscomMonth, importPgnText, importRemote, importedIds, lichessGames, NotFoundError, RateLimitError, type RemoteGame } from './sources'
import { useSettings } from '../../settings'

type Source = 'chesscom' | 'lichess' | 'pgn'

function remembered(source: string) {
  try {
    return localStorage.getItem(`oc-user-${source}`) ?? ''
  } catch {
    return ''
  }
}

export default function Import() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const online = useOnline()
  const [source, setSource] = useState<Source>('chesscom')
  const [user, setUser] = useState(remembered('chesscom'))
  const [archives, setArchives] = useState<string[]>([])
  const [month, setMonth] = useState<string>('')
  const [games, setGames] = useState<RemoteGame[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [have, setHave] = useState<Set<string>>(new Set())
  const [pgn, setPgn] = useState('')
  /** `until` cursor for the next page of Lichess games */
  const [lichessNext, setLichessNext] = useState<number | undefined>(undefined)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    void importedIds().then(setHave)
  }, [games])

  useEffect(() => {
    setUser(remembered(source))
    setGames(null)
    setArchives([])
    setLichessNext(undefined)
    setError(null)
  }, [source])

  const fetchGames = async () => {
    const u = user.trim()
    if (!u) return
    try {
      localStorage.setItem(`oc-user-${source}`, u)
    } catch {
      /* private mode */
    }
    setLoading(true)
    setError(null)
    setGames(null)
    setLichessNext(undefined)
    try {
      if (source === 'chesscom') {
        const a = await chesscomArchives(u)
        setArchives(a)
        if (!a.length) {
          setGames([])
          return
        }
        setMonth(a[0])
        setGames(await chesscomMonth(a[0]))
      } else {
        const page = await lichessGames(u)
        setGames(page.games)
        setLichessNext(page.next)
      }
    } catch (e) {
      setError(e instanceof NotFoundError ? t('import.notFound') : e instanceof RateLimitError ? t('import.rateLimited') : online ? t('common.error') : t('common.offline'))
    } finally {
      setLoading(false)
    }
  }

  const changeMonth = async (m: string) => {
    setMonth(m)
    setLoading(true)
    try {
      setGames(await chesscomMonth(m))
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const loadMoreLichess = async () => {
    if (!lichessNext) return
    setLoadingMore(true)
    try {
      const page = await lichessGames(user.trim(), lichessNext)
      setGames((gs) => [...(gs ?? []), ...page.games])
      setLichessNext(page.next)
    } catch {
      toast(online ? t('common.error') : t('common.offline'), 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  const review = async (g: RemoteGame) => {
    const row = await importRemote(g, user.trim())
    nav(`/review/${row.id}`)
  }

  const importAll = async () => {
    if (!games) return
    let n = 0
    let failed = 0
    for (const g of games) {
      if (have.has(g.externalId)) continue
      // one unreadable game must not stop the rest
      try {
        await importRemote(g, user.trim())
        n++
      } catch {
        failed++
      }
    }
    setHave(await importedIds())
    toast(t('import.imported', { count: n }), 'success')
    if (failed) toast(t('import.failed', { count: failed }), 'error')
  }

  const importPgn = async (text: string) => {
    const { rows, failed } = await importPgnText(text)
    if (failed && rows.length) toast(t('import.failed', { count: failed }), 'error')
    if (!rows.length) {
      toast(t('analysis.invalidPgn'), 'error')
      return
    }
    toast(t('import.imported', { count: rows.length }), 'success')
    setPgn('')
    if (rows.length === 1) nav(`/review/${rows[0].id}`)
    else nav('/games')
  }

  const monthLabel = (url: string) => {
    const [y, m] = url.split('/').slice(-2)
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' })
  }

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <PageHeader title={t('import.title')} />
      <div className="px-4 lg:px-6">
        <Segmented
          className="mb-3"
          value={source}
          onChange={setSource}
          options={[
            { value: 'chesscom', label: t('import.chesscom') },
            { value: 'lichess', label: t('import.lichess') },
            { value: 'pgn', label: t('import.pgn') },
          ]}
        />

        {source !== 'pgn' ? (
          <>
            <Panel className="p-4">
              <label htmlFor="imp-user" className="mb-1.5 block text-[13px] font-bold text-fg-3">
                {t('import.username')}
              </label>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void fetchGames()
                }}
              >
                <input
                  id="imp-user"
                  className="field"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={source === 'chesscom' ? 'hikaru' : 'DrNykterstein'}
                />
                <button className="btn btn-primary" disabled={!user.trim() || loading}>
                  <MagnifyingGlass size={20} weight="bold" /> <span className="hidden sm:inline">{t('import.fetch')}</span>
                </button>
              </form>
              {error && <p className="mt-2 text-[14px] font-semibold text-danger">{error}</p>}
              {archives.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="imp-month" className="text-[13px] font-bold text-fg-3">
                    {t('import.month')}
                  </label>
                  <select id="imp-month" className="field max-w-[240px] capitalize" value={month} onChange={(e) => void changeMonth(e.target.value)}>
                    {archives.map((a) => (
                      <option key={a} value={a}>
                        {monthLabel(a)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Panel>

            {loading && (
              <div className="mt-3 grid gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            )}

            {games && !loading && (
              <Panel className="mt-3 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="tabular text-[14px] font-semibold text-fg-2">{games.length}</span>
                  {games.length > 0 && (
                    <button className="btn btn-ghost -mr-2 min-h-9 text-[14px]" onClick={() => void importAll()}>
                      <DownloadSimple size={18} weight="bold" /> {t('import.importAll')}
                    </button>
                  )}
                </div>
                {games.length === 0 && <p className="p-4 text-fg-2">{t('import.none')}</p>}
                <ul className="divide-y divide-line">
                  {games.map((g) => {
                    const u = user.trim().toLowerCase()
                    const mine = g.white.toLowerCase() === u ? 'w' : g.black.toLowerCase() === u ? 'b' : null
                    const won = mine && g.result !== '1/2-1/2' && (g.result === '1-0') === (mine === 'w')
                    const lost = mine && g.result !== '1/2-1/2' && !won
                    return (
                      <li key={g.externalId} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-semibold">
                            {g.white} <span className="tabular font-normal text-fg-3">({g.whiteElo ?? '?'})</span>
                            <span className="font-normal text-fg-3"> {t('games.vs')} </span>
                            {g.black} <span className="tabular font-normal text-fg-3">({g.blackElo ?? '?'})</span>
                          </div>
                          <div className="tabular text-[13px] text-fg-3">
                            {new Date(g.date).toLocaleDateString(lang)} {g.timeControl ? `· ${g.timeControl}` : ''}
                          </div>
                        </div>
                        <span
                          className={`tabular w-12 rounded px-1 py-0.5 text-center text-[13px] font-bold ${
                            won ? 'bg-accent/20 text-accent' : lost ? 'bg-danger/20 text-danger' : 'bg-raise text-fg-2'
                          }`}
                        >
                          {g.result.replace('1/2-1/2', '½-½')}
                        </span>
                        <button className="btn min-h-10 px-3 text-[14px]" onClick={() => void review(g)}>
                          {have.has(g.externalId) && <CheckCircle size={18} weight="fill" className="text-accent" />}
                          {t('games.review')}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {source === 'lichess' && lichessNext && (
                  <div className="border-t border-line p-3 text-center">
                    <button className="btn" disabled={loadingMore} onClick={() => void loadMoreLichess()}>
                      {t('import.loadMore')}
                    </button>
                  </div>
                )}
              </Panel>
            )}
          </>
        ) : (
          <Panel className="p-4">
            <label htmlFor="imp-pgn" className="mb-1.5 block text-[13px] font-bold text-fg-3">
              {t('import.pastePgn')}
            </label>
            <textarea
              id="imp-pgn"
              className="field min-h-48 py-2 font-mono text-[13px]"
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={'[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" disabled={!pgn.trim()} onClick={() => void importPgn(pgn)}>
                {t('import.importPgn')}
              </button>
              <label className="btn cursor-pointer">
                <FileArrowUp size={20} weight="bold" /> {t('import.file')}
                <input
                  type="file"
                  accept=".pgn,text/plain"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (f) await importPgn(await f.text())
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
