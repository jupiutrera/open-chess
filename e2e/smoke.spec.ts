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

test('every page renders without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const r of ['/', '/play', '/play/local', '/puzzles', '/puzzles/rated', '/openings', '/lessons', '/lessons/forks', '/analysis', '/games', '/import', '/profile', '/settings']) {
    await page.goto(`/#${r}`)
    await page.waitForTimeout(400)
    await expect(page.locator('main')).toBeVisible()
  }
  expect(errors).toEqual([])
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
