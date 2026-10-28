import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './pieces.css'
import { i18nReady } from './i18n'
import { App } from './App'
import { Capacitor } from '@capacitor/core'
import { useUpdate } from './ui/UpdateBanner'
import { reloadOnce } from './ui/ErrorBoundary'

// a lazy screen whose chunk vanished with a new deploy: reload once onto the new version
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault()
})

if (Capacitor.isNativePlatform()) {
  // a service worker inside the WebView would serve stale assets after an update
  void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()))
} else if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => useUpdate.setState({ apply: () => void update(true) }),
      // an installed app can stay open for days: look for a new version when it comes back and every hour
      onRegisteredSW: (_url, reg) => {
        if (!reg) return
        const check = () => void reg.update().catch(() => {})
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && navigator.onLine && check())
        setInterval(() => navigator.onLine && check(), 60 * 60 * 1000)
      },
    })
  })
}

void i18nReady.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
