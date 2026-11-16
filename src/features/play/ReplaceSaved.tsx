import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../ui/kit'
import { db } from '../../db/db'
import { useSettings } from '../../settings'
import { botById, botName } from './bots'
import { loadLiveGame, type LiveGame } from './liveGame'
import { parseRivalId, rivalBot } from '../league/league'

/** The "you have an unfinished game" question, shared by every way of starting a bot game. */
export function ReplaceSavedSheet({
  open,
  name,
  league,
  onCancel,
  onConfirm,
}: {
  open: boolean
  name: string
  /** the saved game is a rated league game, which would count as a loss */
  league: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onClose={onCancel} title={t('play.newGame')}>
      <p className="mb-4 text-fg-2">{t(league ? 'league.replaceSaved' : 'play.replaceSaved', { name })}</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="btn btn-primary" onClick={onConfirm}>
          {t('play.discard')}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Guards a screen that starts a game against `botId`: a saved game against another bot is
 * only replaced after asking. Continuing a saved game against the same bot is the caller's
 * business (it links to the resume URL instead of calling `guard`).
 */
export function useReplaceSaved() {
  const lang = useSettings((s) => s.lang)
  const [pending, setPending] = useState<{ live: LiveGame; go: () => void } | null>(null)
  const live = pending?.live
  const cloneId = live?.botId?.startsWith('clone-') ? live.botId.slice('clone-'.length) : null
  const clone = useLiveQuery(async () => (cloneId ? await db.clones.get(cloneId) : undefined), [cloneId])
  const rival = live?.botId ? parseRivalId(live.botId) : null
  const builtin = live?.botId ? botById(live.botId) : undefined
  const name = clone?.name ?? (rival ? rivalBot(rival).name : builtin ? botName(builtin, lang) : '')

  /** Runs `go` at once when nothing would be lost; otherwise asks and runs it on confirm. */
  const guard = (botId: string, go: () => void) => {
    const saved = loadLiveGame('bot')
    if (saved?.botId && saved.botId !== botId) setPending({ live: saved, go })
    else go()
  }
  const sheet = (
    <ReplaceSavedSheet
      open={!!pending}
      name={name}
      league={!!rival}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const go = pending?.go
        setPending(null)
        go?.()
      }}
    />
  )
  return { guard, sheet }
}
