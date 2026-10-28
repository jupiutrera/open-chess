import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete } from '../../db/db'
import { PageHeader, Panel, Segmented, SkeletonRows, toast } from '../../ui/kit'
import { DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { GameRowItem } from './GameRowItem'
import { gameMatcher, NO_FILTER, type GameFilter } from './gameFilter'
import { gamesPgn } from '../review/pgnExport'
import { playerName } from '../play/playerName'
import { saveTextFile } from '../../ui/files'

const PAGE = 50

export default function Games() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<GameFilter>(NO_FILTER)
  const [limit, setLimit] = useState(PAGE)
  // typing shouldn't re-scan the table on every keystroke before React catches up
  const query = useDeferredValue(filter.query)
  const { source, result, color } = filter
  const match = useMemo(
    () => gameMatcher({ source, result, color, query }, (name, g) => playerName(name, g.source, t)),
    [source, result, color, query, t],
  )
  const filtered = filter.source !== 'all' || filter.result !== 'all' || filter.color !== 'all' || !!filter.query.trim()

  // one extra row tells whether there is another page
  const page = useLiveQuery(() => db.games.orderBy('date').reverse().filter(match).limit(limit + 1).toArray(), [match, limit])
  const games = page?.slice(0, limit)
  const more = !!page && page.length > limit

  const change = (patch: Partial<GameFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setLimit(PAGE)
  }

  /** Every game matching the filters, not just the pages on screen. */
  const exportPgn = async () => {
    try {
      const all = await db.games.orderBy('date').reverse().filter(match).toArray()
      if (all.length) await saveTextFile(`open-chess-${new Date().toISOString().slice(0, 10)}.pgn`, gamesPgn(all), 'application/x-chess-pgn')
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        title={t('games.title')}
        right={
          games?.length ? (
            <button className="btn" aria-label={t('review.exportPgn')} onClick={() => void exportPgn()}>
              <DownloadSimple size={18} weight="bold" /> <span className="hidden sm:inline">{t('review.exportPgn')}</span>
            </button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-6">
        <Segmented
          className="mb-3 max-w-md"
          value={filter.source}
          onChange={(source) => change({ source })}
          options={[
            { value: 'all', label: t('games.all') },
            { value: 'bot', label: t('nav.play') },
            { value: 'imported', label: t('nav.import') },
          ]}
        />
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">{t('games.search')}</span>
            <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
            <input
              type="search"
              className="field pl-9"
              value={filter.query}
              onChange={(e) => change({ query: e.target.value })}
              placeholder={t('games.search')}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <select
            className="field w-auto"
            aria-label={t('games.result')}
            value={filter.result}
            onChange={(e) => change({ result: e.target.value as GameFilter['result'] })}
          >
            <option value="all">{t('games.anyResult')}</option>
            <option value="win">{t('games.wins')}</option>
            <option value="draw">{t('games.draws')}</option>
            <option value="loss">{t('games.losses')}</option>
          </select>
          <select
            className="field w-auto"
            aria-label={t('games.color')}
            value={filter.color}
            onChange={(e) => change({ color: e.target.value as GameFilter['color'] })}
          >
            <option value="all">{t('games.anyColor')}</option>
            <option value="w">{t('common.white')}</option>
            <option value="b">{t('common.black')}</option>
          </select>
        </div>
        <Panel className="overflow-hidden">
          {games?.length === 0 &&
            (filtered ? (
              <div className="flex flex-col items-start gap-3 p-5">
                <p className="text-fg-2">{t('games.noMatch')}</p>
                <button className="btn" onClick={() => change(NO_FILTER)}>
                  {t('games.clearFilters')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 p-5">
                <p className="text-fg-2">{t('games.empty')}</p>
                <div className="flex gap-2">
                  <Link to="/play" className="btn btn-primary">
                    {t('nav.play')}
                  </Link>
                  <Link to="/import" className="btn">
                    {t('nav.import')}
                  </Link>
                </div>
              </div>
            ))}
          <div className="divide-y divide-line">
            {games ? games.map((g) => <GameRowItem key={g.id} game={g} onDelete={() => void softDelete('games', g.id)} />) : <SkeletonRows count={6} />}
          </div>
          {more && (
            <div className="border-t border-line p-3 text-center">
              <button className="btn" onClick={() => setLimit((n) => n + PAGE)}>
                {t('games.loadMore')}
              </button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
