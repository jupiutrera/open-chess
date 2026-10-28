import { defineConfig, devices } from '@playwright/test'

// CI can build once and hand dist/ over (E2E_PREBUILT=1); otherwise the server builds first.
// E2E_PORT moves the preview server off 4173 when something else holds it.
const port = Number(process.env.E2E_PORT ?? 4173)
const preview = `npx vite preview --port ${port} --strictPort`

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${port}`, locale: 'en-US', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } } },
    // the phone layout (bottom bar, stacked board screens) on the quick page checks only
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'en-US' }, grep: /@mobile/ },
  ],
  // the production build, so the CSP, service worker and copied engine are what gets tested
  webServer: {
    command: process.env.E2E_PREBUILT ? preview : `npm run build && ${preview}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
