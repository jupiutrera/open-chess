import { useTranslation } from 'react-i18next'
import { create } from 'zustand'

/** Set by the service worker registration when a new version is waiting. */
export const useUpdate = create<{ apply: (() => void) | null }>(() => ({ apply: null }))

/** A new version is offered instead of reloading by itself, which would cut a game or a Rush short. */
export function UpdateBanner() {
  const { t } = useTranslation()
  const apply = useUpdate((s) => s.apply)
  if (!apply) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[calc(8px+var(--inset-top))] z-50 mx-auto flex w-[min(100%-32px,420px)] items-center gap-3 rounded-lg bg-raise-2 px-4 py-2.5 text-[14px] font-semibold shadow-lg"
    >
      <span className="flex-1">{t('common.updateReady')}</span>
      <button className="btn btn-ghost" onClick={() => useUpdate.setState({ apply: null })}>
        {t('common.later')}
      </button>
      <button className="btn btn-primary" onClick={apply}>
        {t('common.update')}
      </button>
    </div>
  )
}
