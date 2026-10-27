import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: {
    // the default piece set ships inline in the CSS; the others load on demand
    assetsInlineLimit: (file) => (file.includes('/pieces/') ? file.includes('/staunty/') : undefined),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // registered from main.tsx only on the web; the Android app ships its assets in the APK
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Open Chess',
        short_name: 'Open Chess',
        description: 'Entrena ajedrez gratis: bots, revisión de partidas, puzzles, aperturas y lecciones.',
        theme_color: '#262421',
        background_color: '#302e2b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,mp3}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'chess-data', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
