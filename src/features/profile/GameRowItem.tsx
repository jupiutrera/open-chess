import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash, CaretRight, Robot, Users, Globe, FileText } from '@phosphor-icons/react'
import type { GameRow } from '../../db/db'
import { timeAgo } from '../../ui/kit'
import { useSettings } from '../../settings'
import { fmtDecimal } from '../../i18n/format'

const SOURCE_ICON = { bot: Robot, local: Users, chesscom: Globe, lichess: Globe, pgn: FileText }

export function GameRowItem({ game, onDelete }: { game: GameRow; onDelete?: () => void }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const Icon = SOURCE_ICON[game.source]
  const uc = game.userColor
  const outcome =
    game.result === '1/2-1/2' ? 'draw' : !uc ? null : (game.result === '1-0') === (uc === 'w') ? 'win' : game.result === '*' ? null : 'loss'
  const acc = game.review && uc ? (uc === 'w' ? game.review.accuracy.white : game.review.accuracy.black) : null
  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-raise/50">
      <Icon size={20} className="shrink-0 text-fg-3" />
      <Link to={`/review/${game.id}`} className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {game.white}
          {game.whiteElo ? <span className="tabular font-normal text-fg-3"> ({game.whiteElo})</span> : null}
          <span className="font-normal text-fg-3"> {t('games.vs')} </span>
          {game.black}
          {game.blackElo ? <span className="tabular font-normal text-fg-3"> ({game.blackElo})</span> : null}
        </div>
        <div className="truncate text-[13px] text-fg-3">
          {timeAgo(game.date, lang)}
          {game.opening ? ` · ${game.opening}` : ''}
        </div>
      </Link>
      {acc !== null && <span className="tabular hidden text-[13px] font-semibold text-fg-2 sm:block">{fmtDecimal(acc)}%</span>}
      <span
        className={`tabular w-14 rounded px-1.5 py-0.5 text-center text-[13px] font-bold ${
          outcome === 'win' ? 'bg-accent/20 text-accent' : outcome === 'loss' ? 'bg-danger/20 text-danger' : 'bg-raise text-fg-2'
        }`}
      >
        {game.result.replace('1/2-1/2', '½-½')}
      </span>
      {onDelete ? (
        <button className="btn btn-ghost btn-icon -mr-2" onClick={onDelete} aria-label={t('games.delete')}>
          <Trash size={18} />
        </button>
      ) : (
        <CaretRight size={18} className="text-fg-3" />
      )}
    </div>
  )
}
