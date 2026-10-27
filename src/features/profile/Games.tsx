import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete } from '../../db/db'
import { PageHeader, Panel, Segmented, SkeletonRows } from '../../ui/kit'
import { DownloadSimple } from '@phosphor-icons/react'
import { GameRowItem } from './GameRowItem'
import { gamesPgn } from '../review/pgnExport'
import { saveTextFile } from '../../ui/files'

export default function Games() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'bot' | 'imported'>('all')
  const games = useLiveQuery(
    () =>
      db.games
        .orderBy('date')
        .reverse()
        .filter((g) => !g.deleted && (filter === 'all' || (filter === 'bot' ? g.source === 'bot' || g.source === 'local' : g.source !== 'bot' && g.source !== 'local')))
        .limit(300)
        .toArray(),
    [filter],
  )
  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        title={t('games.title')}
        right={
          games?.length ? (
            <button
              className="btn"
              aria-label={t('review.exportPgn')}
              onClick={() => void saveTextFile(`open-chess-${new Date().toISOString().slice(0, 10)}.pgn`, gamesPgn(games), 'application/x-chess-pgn').catch(() => {})}
            >
              <DownloadSimple size={18} weight="bold" /> <span className="hidden sm:inline">{t('review.exportPgn')}</span>
            </button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-6">
        <Segmented
          className="mb-3 max-w-md"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('games.all') },
            { value: 'bot', label: t('nav.play') },
            { value: 'imported', label: t('nav.import') },
          ]}
        />
        <Panel className="overflow-hidden">
          {games?.length === 0 && (
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
          )}
          <div className="divide-y divide-line">
            {games ? games.map((g) => <GameRowItem key={g.id} game={g} onDelete={() => void softDelete('games', g.id)} />) : <SkeletonRows count={6} />}
          </div>
        </Panel>
      </div>
    </div>
  )
}
