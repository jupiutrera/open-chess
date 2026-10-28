import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync } from 'node:fs'

// the defaults in src/settings.ts: only these are precached, the other sets cache when picked
const DEFAULT_PIECES = 'staunty'
const DEFAULT_SOUNDS = 'wood'
const otherSoundSets = readdirSync('public/sounds').filter((d) => d !== DEFAULT_SOUNDS)

/**
 * Content Security Policy for the built app (the dev server needs inline scripts for hot reload).
 * Network access is limited to the public chess APIs and, when configured, the Supabase project.
 */
function csp(): Plugin {
  return {
    name: 'open-chess-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const supabase = process.env.VITE_SUPABASE_URL ? new URL(process.env.VITE_SUPABASE_URL).origin : ''
      const connect = ["'self'", 'https://lichess.org', 'https://explorer.lichess.ovh', 'https://tablebase.lichess.ovh', 'https://api.chess.com', supabase, supabase.replace('https://', 'wss://')]
      const policy = [
        "default-src 'self'",
        // Stockfish is WebAssembly
        "script-src 'self' 'wasm-unsafe-eval'",
        "worker-src 'self' blob:",
        // inline style attributes (board squares, transforms)
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self' data: blob:",
        `connect-src ${connect.filter(Boolean).join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
      return html.replace('<head>', `<head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    },
  }
}

export default defineConfig({
  base: './',
  build: {
    // the default piece set ships inline in the CSS; the others load on demand
    assetsInlineLimit: (file) => (file.includes('/pieces/') ? file.includes(`/${DEFAULT_PIECES}/`) : undefined),
    rollupOptions: {
      output: {
        // piece sets keep their name, so the service worker can leave the unused ones out
        assetFileNames: (info) => {
          const set = (info.originalFileNames ?? []).map((f) => /pieces\/([a-z]+)\//.exec(f)?.[1]).find(Boolean)
          return set ? `assets/pieces-${set}/[name]-[hash][extname]` : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    csp(),
    VitePWA({
      // the app asks before switching versions (see UpdateBanner)
      registerType: 'prompt',
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
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the opening book and puzzle index are small and needed everywhere; puzzle buckets (15 MB) cache as they load
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,mp3}', 'data/openings.json', 'data/puzzles/index.json'],
        // other piece and sound sets, and scripts the app's languages don't use, load on demand
        globIgnores: ['**/assets/pieces-*/**', ...otherSoundSets.map((d) => `**/sounds/${d}/**`), '**/*-{cyrillic,cyrillic-ext,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // puzzle buckets are ~0.5 MB each: keep the cached copy instead of refetching it on every
            // first open (stale-while-revalidate did); a regenerated bucket is picked up after a month
            urlPattern: /\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'chess-data', expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: /\/(assets\/pieces-|sounds\/)|\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'chess-assets', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
