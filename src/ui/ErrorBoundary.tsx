import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const RELOADED = 'oc-chunk-reload'

/**
 * After a deploy the old hashed chunks are gone, so a lazy screen fails to load. One reload picks up the
 * new version; the session flag stops a loop when the failure is something else (offline, a real bug).
 */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED)) return false
    sessionStorage.setItem(RELOADED, String(Date.now()))
  } catch {
    return false
  }
  location.reload()
  return true
}

/** Called once the app has run fine for a while: a later deploy in the same session may reload again. */
export function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOADED)
  } catch {
    // storage blocked: reloadOnce never reloads then, which is the safe side
  }
}

const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|Unable to preload|Loading chunk/i.test(e.message)

type Props = { children: ReactNode; resetKey: string }

/** Keeps a crash in one screen from blanking the whole app; navigating elsewhere (resetKey) clears it. */
export class ErrorBoundary extends Component<Props, { error: unknown; key: string }> {
  state = { error: null as unknown, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: { key: string }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkError(error) && reloadOnce()) return
    console.error(error, info.componentStack)
  }

  render() {
    return this.state.error ? <ErrorScreen /> : this.props.children
  }
}

function ErrorScreen() {
  const { t } = useTranslation()
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-3 px-6 py-16 text-center">
      <h1 tabIndex={-1} className="text-[22px] font-extrabold tracking-tight">
        {t('common.errorTitle')}
      </h1>
      <p className="text-[15px] text-fg-2">{t('common.errorBody')}</p>
      <button className="btn btn-primary mt-2" onClick={() => location.reload()}>
        {t('common.reload')}
      </button>
    </div>
  )
}
