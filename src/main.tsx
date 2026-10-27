import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './pieces.css'
import { i18nReady } from './i18n'
import { App } from './App'
import { Capacitor } from '@capacitor/core'

if (Capacitor.isNativePlatform()) {
  // a service worker inside the WebView would serve stale assets after an update
  void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()))
} else if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

void i18nReady.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
