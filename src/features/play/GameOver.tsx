import { useTranslation } from 'react-i18next'
import { Trophy, Handshake, SmileySad, MagnifyingGlass } from '@phosphor-icons/react'
import { Sheet } from '../../ui/kit'

export interface GameEnd {
  result: '1-0' | '0-1' | '1/2-1/2'
  reason: string
}

export function GameOverDialog({
  end,
  userColor,
  open,
  onClose,
  onReview,
  onRematch,
  onNew,
  reviewReady = true,
}: {
  end: GameEnd
  /** undefined for two-player games */
  userColor?: 'w' | 'b'
  open: boolean
  onClose: () => void
  onReview: () => void
  onRematch?: () => void
  onNew?: () => void
  reviewReady?: boolean
}) {
  const { t } = useTranslation()
  const draw = end.result === '1/2-1/2'
  const userWon = userColor && !draw && (end.result === '1-0') === (userColor === 'w')
  const title = draw
    ? t('play.draw_')
    : userColor
      ? userWon
        ? t('play.youWin')
        : t('play.youLose')
      : end.result === '1-0'
        ? t('play.whiteWins')
        : t('play.blackWins')
  const Icon = draw ? Handshake : userColor && !userWon ? SmileySad : Trophy
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="flex flex-col items-center gap-1 pb-2 pt-1 text-center">
        <span className={`mb-1 grid h-14 w-14 place-items-center rounded-full ${userWon || (!userColor && !draw) ? 'bg-accent text-white' : 'bg-raise-2 text-fg'}`}>
          <Icon size={30} weight="fill" />
        </span>
        <h2 className="text-[26px] font-extrabold">{title}</h2>
        <p className="text-fg-2">{t(`play.by.${end.reason}`)}</p>
        <p className="tabular mt-1 font-mono text-[18px] font-bold text-fg-3">{end.result.replace('1/2', '½')}</p>
      </div>
      <div className="mt-4 grid gap-2">
        <button className="btn btn-primary btn-lg w-full" onClick={onReview} disabled={!reviewReady}>
          <MagnifyingGlass size={22} weight="bold" /> {t('play.gameReview')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {onRematch && (
            <button className="btn" onClick={onRematch}>
              {t('play.rematch')}
            </button>
          )}
          {onNew && (
            <button className="btn" onClick={onNew}>
              {t('play.newGame')}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
