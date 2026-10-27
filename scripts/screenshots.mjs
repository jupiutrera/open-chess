// Regenerates the README screenshots: `npm run dev` in one terminal, then
// `node scripts/screenshots.mjs`. Output goes to docs/screenshots/.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/#'
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const GAMES = {
  opera: `[Event "Opera Game"]
[Site "Paris"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`,
  immortal: `[Event "Immortal Game"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`,
}

async function clickSquare(page, sq, orientation = 'white') {
  const box = await page.locator('cg-board').first().boundingBox()
  const f = 'abcdefgh'.indexOf(sq[0])
  const r = Number(sq[1]) - 1
  const col = orientation === 'white' ? f : 7 - f
  const row = orientation === 'white' ? 7 - r : r
  const size = box.width / 8
  await page.mouse.click(box.x + size * (col + 0.5), box.y + size * (row + 0.5))
}

async function importAndReview(page, pgn) {
  await page.goto(`${BASE}/import`)
  await page.getByRole('radio', { name: 'PGN' }).click()
  await page.locator('#imp-pgn').fill(pgn)
  await page.getByRole('button', { name: 'Importar PGN' }).click()
  await page.getByRole('button', { name: 'Empezar revisión' }).waitFor({ timeout: 180_000 })
}

async function openMove(page, san) {
  await page.getByRole('button', { name: 'Empezar revisión' }).click()
  await page.locator('.tabular button', { hasText: new RegExp(`${san.replace('+', '\\+')}$`) }).first().click()
  await page.evaluate(() => document.activeElement?.blur?.())
  await page.mouse.move(0, 0)
  await page.waitForTimeout(700)
}

const browser = await chromium.launch()
const gifOnly = process.argv.includes('--gif-only')

/* Desktop */
if (!gifOnly) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'es-ES' })
  // show off the in-game helps in the bot game shot
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('oc-settings'))
      localStorage.setItem('oc-settings', JSON.stringify({ state: { lang: 'es', assist: { eval: true, threats: false, suggest: true, feedback: true, engine: true } }, version: 0 }))
  })
  const page = await ctx.newPage()
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

  await importAndReview(page, GAMES.immortal)
  await importAndReview(page, GAMES.opera)
  await shot('review-summary')
  await openMove(page, 'Rxd7')
  await shot('review-brilliant')

  await page.goto(`${BASE}/`)
  await page.waitForTimeout(1500)
  await shot('home')

  await page.goto(`${BASE}/play`)
  await page.getByRole('button', { name: /Kira/ }).click()
  await page.waitForTimeout(500)
  await shot('play-bots')

  await page.goto(`${BASE}/play/bot/kira?color=w&tc=10%2B0`)
  await page.waitForTimeout(800)
  const moves = page.locator('.tabular button')
  for (const [a, b, n] of [['e2', 'e4', 2], ['g1', 'f3', 4], ['f1', 'c4', 6], ['b1', 'c3', 8], ['e1', 'g1', 10]]) {
    await clickSquare(page, a)
    await clickSquare(page, b)
    await moves.nth(n - 1).waitFor({ timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(1500)
  await shot('play-game')

  await page.goto(`${BASE}/puzzles/rated`)
  await page.waitForTimeout(2000)
  await shot('puzzle')

  await page.goto(`${BASE}/openings`)
  await page.waitForTimeout(800)
  for (const [a, b] of [['e2', 'e4'], ['c7', 'c5'], ['g1', 'f3']]) {
    await clickSquare(page, a)
    await clickSquare(page, b)
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(800)
  await shot('openings')

  await page.goto(`${BASE}/analysis?fen=${encodeURIComponent('r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 1 23')}`)
  await page.waitForTimeout(4500)
  await shot('analysis')

  await page.goto(`${BASE}/lessons`)
  await page.waitForTimeout(1200)
  await shot('lessons')

  await page.goto(`${BASE}/puzzles`)
  await page.waitForTimeout(1000)
  await shot('puzzles-hub')
  await ctx.close()
}

/* Mobile */
if (!gifOnly) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

  await importAndReview(page, GAMES.opera)
  await openMove(page, 'Rxd7')
  await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0))
  await shot('mobile-review')

  await page.goto(`${BASE}/`)
  await page.waitForTimeout(1500)
  await shot('mobile-home')

  await page.goto(`${BASE}/puzzles/rated`)
  await page.waitForTimeout(2000)
  await shot('mobile-puzzle')

  await page.goto(`${BASE}/lessons/smothered-mate`)
  await page.waitForTimeout(1200)
  await shot('mobile-lesson')
  await ctx.close()
}

/* Review walkthrough video, converted to GIF afterwards with ffmpeg */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'es-ES',
    recordVideo: { dir: `${OUT}/.video`, size: { width: 1280, height: 800 } },
  })
  const page = await ctx.newPage()
  await importAndReview(page, GAMES.opera)
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Empezar revisión' }).click()
  await page.locator('.tabular button', { hasText: /^O-O-O$/ }).first().click()
  await page.evaluate(() => document.activeElement?.blur?.())
  await page.waitForTimeout(1200)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1100)
  }
  await page.waitForTimeout(800)
  await ctx.close()
}

await browser.close()
if (gifOnly || process.argv.includes('--gif')) {
  // trim the analysis wait and keep the walkthrough, then encode with a full palette
  const { execFileSync } = await import('node:child_process')
  const { readdirSync, rmSync } = await import('node:fs')
  const video = `${OUT}/.video/${readdirSync(`${OUT}/.video`)[0]}`
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString())
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, dur - 12.5)), '-i', video, '-vf',
    'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    `${OUT}/review.gif`])
  rmSync(`${OUT}/.video`, { recursive: true, force: true })
}
console.log('done')
