import { test, expect, type Page } from '@playwright/test'

async function clickSquare(page: Page, sq: string, orientation: 'white' | 'black' = 'white') {
  const box = (await page.locator('cg-board').first().boundingBox())!
  const f = 'abcdefgh'.indexOf(sq[0])
  const r = Number(sq[1]) - 1
  const col = orientation === 'white' ? f : 7 - f
  const row = orientation === 'white' ? 7 - r : r
  const size = box.width / 8
  await page.mouse.click(box.x + size * (col + 0.5), box.y + size * (row + 0.5))
}

async function move(page: Page, from: string, to: string) {
  await clickSquare(page, from)
  await clickSquare(page, to)
}

/** Writes rows straight into the app's database, once the app has created the store. */
async function seed(page: Page, store: string, rows: object[]) {
  await page.evaluate(
    ({ store, rows }) =>
      new Promise<void>((resolve, reject) => {
        const attempt = (left: number) => {
          const req = indexedDB.open('open-chess')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(store)) {
              // not created yet: let go at once, or the app's own upgrade would be blocked
              db.close()
              if (!left) return reject(new Error(`no ${store} store`))
              return setTimeout(() => attempt(left - 1), 250)
            }
            const tx = db.transaction(store, 'readwrite')
            for (const r of rows) tx.objectStore(store).put(r)
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }
        attempt(40)
      }),
    { store, rows },
  )
}

test('play a bot, resign, review the game', async ({ page }) => {
  await page.goto('/#/play/bot/pip?color=w&tc=none&hints=1&undo=1&eval=0')
  await expect(page.locator('cg-board')).toBeVisible()

  // the mobile move strip is in the DOM too (hidden on desktop), so count only visible moves
  const moves = page.locator('.tabular button:visible')
  await move(page, 'e2', 'e4')
  await expect(moves).toHaveCount(2, { timeout: 20_000 })
  await move(page, 'g1', 'f3')
  await expect(moves).toHaveCount(4, { timeout: 20_000 })
  await move(page, 'f1', 'c4')
  await expect(moves).toHaveCount(6, { timeout: 20_000 })

  await page.getByRole('button', { name: /Abandonar|Resign/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /Abandonar|Resign/ }).click()
  await page.getByRole('button', { name: /Revisar partida|Game review/ }).first().click()

  await expect(page).toHaveURL(/#\/review\//)
  const start = page.getByRole('button', { name: /Empezar revisión|Start review/ })
  await expect(start).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Precisión|Accuracy/)).toBeVisible()
  await start.click()
  await expect(page.locator('.q-badge')).toBeVisible()
})

// the browser runs in English (playwright.config.ts); null: the screen has no h1 of its own yet
const PAGES: [string, RegExp | null][] = [
  ['/', /What are we training today/],
  ['/play', /^Play$/],
  ['/play/local', /Two players/],
  ['/puzzles', /^Puzzles$/],
  ['/training', /^Your weak spots$/],
  ['/clones', /^Clones$/],
  ['/puzzles/rated', /Rated puzzles/],
  ['/openings', /Openings/],
  ['/lessons', /^Lessons$/],
  ['/lessons/forks', /./],
  ['/analysis', /Analysis board/],
  ['/games', /My games/],
  ['/import', /Import games/],
  ['/profile', /^Profile$/],
  ['/settings', /^Settings$/],
]

test('every page renders without errors', { tag: '@mobile' }, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const [r, h1] of PAGES) {
    await page.goto(`/#${r}`)
    await expect(page.locator('main')).toBeVisible()
    if (h1) await expect(page.locator('main h1').first(), r).toHaveText(h1)
    await expect(page).toHaveTitle(/Open Chess/)
  }
  expect(errors).toEqual([])
})

test('an unknown link shows a way home', { tag: '@mobile' }, async ({ page }) => {
  await page.goto('/#/no/such/page')
  await expect(page.locator('main h1')).toHaveText('Page not found')
  await expect(page).toHaveTitle(/Page not found/)
  await page.getByRole('link', { name: 'Go to home' }).click()
  await expect(page.locator('main h1')).toHaveText(/What are we training today/)
})

test('navigating names the tab and focuses the new heading', { tag: '@mobile' }, async ({ page }) => {
  await page.goto('/#/')
  await expect(page.locator('main h1')).toBeVisible()
  // rail on desktop, bottom bar on phones: whichever is showing
  await page.locator('nav a:visible', { hasText: /^Puzzles$/ }).click()
  await expect(page.locator('main h1')).toHaveText('Puzzles')
  await expect(page.locator('main h1')).toBeFocused()
  await expect(page).toHaveTitle('Puzzles · Open Chess')
})

test('a bot game starts without scrolling and the bot never talks over the board', { tag: '@mobile' }, async ({ page }) => {
  // a small phone: the whole setup has to fit above the bottom bar
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/#/play')
  const play = page.getByRole('button', { name: /^Play$/ })
  await expect(play).toBeInViewport({ ratio: 1 })
  await page.getByRole('button', { name: /^Time:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '5 min' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await play.click()
  await expect(page).toHaveURL(/tc=5%2B0/)

  // the greeting bubble sits in the bot's bar, above the board's top edge
  const bubble = page.locator('.speech')
  await expect(bubble).toBeVisible()
  const b = (await bubble.boundingBox())!
  const board = (await page.locator('cg-board').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(board.y + 1)
})

test('a game left in the middle can be continued, clock included', async ({ page }) => {
  // as Black against Pip: the bot opens, then it's our move
  await page.goto('/#/play/bot/pip?color=b&tc=5%2B0')
  await expect(page.locator('cg-board')).toBeVisible()
  const moves = page.locator('.tabular button:visible')
  await expect(moves).toHaveCount(1, { timeout: 20_000 })
  await clickSquare(page, 'e7', 'black')
  await clickSquare(page, 'e5', 'black')
  await expect(moves).toHaveCount(3, { timeout: 20_000 })

  await page.goto('/#/play')
  await page.getByRole('button', { name: /Continuar|Continue/ }).click()
  await expect(page).toHaveURL(/resume=1/)
  await expect(moves).toHaveCount(3)
  // Black (us) is to move, so Black's clock is the one running
  await expect(page.locator('[data-clock="b"][data-running]')).toBeVisible()
  await expect(page.locator('[data-clock="w"][data-running]')).toHaveCount(0)
})

test('a clone plays its own opening moves', async ({ page }) => {
  await page.goto('/#/clones')
  await expect(page.locator('main h1')).toHaveText('Clones')
  // a clone as the builder leaves it, without going to the network: 1.Nf3 is its only first move
  await seed(page, 'clones', [
    {
      id: 'e2e',
      name: 'Friend',
      source: 'lichess',
      username: 'friend',
      period: 'year',
      createdAt: Date.now(),
      games: 12,
      elo: 1500,
      book: { 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': { g1f3: 3 } },
    },
  ])
  // written behind Dexie's back: a reload makes the app read it
  await page.goto('/#/play?tab=clones')
  await page.reload()
  await expect(page.getByRole('button', { name: /Friend/ })).toBeVisible()
  await page.goto('/#/play/bot/clone-e2e?color=b&tc=none')
  await expect(page.locator('.tabular button:visible').first()).toHaveText('Nf3', { timeout: 20_000 })
})

test('a reviewed game exports as a vertical video', async ({ page }) => {
  await page.goto('/#/games')
  await expect(page.locator('main h1')).toBeVisible()
  // a reviewed game written straight to the database: 3.Qxe5+?? is the one key moment
  const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5+', 'Nxe5']
  const ucis = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5e5', 'c6e5']
  const moves = sans.map((san, i) => ({
    ply: i + 1,
    san,
    uci: ucis[i],
    color: i % 2 ? 'b' : 'w',
    quality: i === 4 ? 'blunder' : 'good',
    loss: i === 4 ? 60 : 1,
    accuracy: 80,
    bestUci: null,
    bestSan: null,
    scoreAfter: { cp: i >= 4 ? -900 : 20 },
  }))
  await seed(page, 'games', [
    {
      id: 'video',
      updatedAt: Date.now(),
      source: 'pgn',
      pgn: '1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 0-1',
      white: 'White',
      black: 'Black',
      result: '0-1',
      userColor: 'w',
      date: Date.now(),
      review: { depth: 12, accuracy: { white: 40, black: 90 }, moves, curve: [52, 52, 51, 50, 50, 8, 8] },
    },
  ])
  await page.goto('/#/review/video')
  await page.reload()
  await page.getByRole('button', { name: 'Export video' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'Fast' }).click()
  const download = page.waitForEvent('download', { timeout: 60_000 })
  await dialog.getByRole('button', { name: 'Create video' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^White-Black-.*\.(webm|mp4)$/)
  const path = await file.path()
  const { statSync } = await import('node:fs')
  expect(statSync(path).size).toBeGreaterThan(10_000)
})
