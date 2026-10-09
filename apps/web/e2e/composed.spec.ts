import { expect, test, type Page } from '@playwright/test'

// The composed screen on the five samples: every golden question is a committed composition, so none of
// this needs the network or a model.

const GOLDEN = [
  "How's this repo doing?",
  "What's blocking the next release?",
  "Who's carrying this repo?",
  'Is CI getting slower?',
  "What's been merged this week?",
  'Which issues have gone stale?',
  'Show me the biggest open PR',
  'Where would a new contributor start?',
  'How responsive are the maintainers?',
  'Compare this month to last',
  'When does this project get worked on?',
  'What changed between the last two releases?',
]
const SAMPLES = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite']

const url = (repo: string, q: string) => `/r/${repo}?q=${encodeURIComponent(q)}`
const settled = (page: Page) => page.locator('[data-composition][data-phase="settled"]')

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

test.describe('composed screen', () => {
  // Playwright reads which fixtures a hook needs from its destructuring, so the empty pattern is required.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'unconfigured', 'the samples answer without configuration; one project is enough')
  })

  test('the twelve golden questions render from a sample with the full entrance', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = collectErrors(page)
    for (const q of GOLDEN) {
      await page.goto(url('vercel/next.js', q))
      await expect(settled(page)).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('[data-question]')).toHaveText(q)
      await expect(page.locator('[data-built]')).toBeVisible()
      await expect(page.locator('[data-built-strip]')).toBeVisible()
      const timing = await page.evaluate(() => {
        const start = performance.getEntriesByName('genui:screen:start').at(-1)!.startTime
        const insight = performance.getEntriesByName('genui:insight:visible').at(-1)
        return { total: performance.getEntriesByName('genui:screen', 'measure').at(-1)!.duration, insight: insight ? insight.startTime - start : null, pieces: document.querySelectorAll('[data-piece-id]').length }
      })
      expect(timing.pieces, q).toBeGreaterThan(2)
      expect(timing.insight, q).not.toBeNull()
      expect(timing.insight!, q).toBeLessThan(1000)
      expect(timing.total, q).toBeGreaterThan(1500)
    }
    expect(errors).toEqual([])
  })

  test('r replays the whole screen out and in', async ({ page }) => {
    await page.goto(url('vercel/next.js', GOLDEN[1]!))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    const id = await page.locator('[data-composition]').getAttribute('data-composition')
    // The empty moment between exit and entrance is short, so an observer records it rather than a poll.
    await page.evaluate(() => {
      const w = window as unknown as { fewest: number }
      w.fewest = Infinity
      new MutationObserver(() => {
        w.fewest = Math.min(w.fewest, document.querySelectorAll('[data-piece-id]').length)
      }).observe(document.body, { childList: true, subtree: true })
    })
    await page.keyboard.press('r')
    await expect(page.locator('[data-composition="replay"]')).toBeAttached()
    await expect(page.locator(`[data-composition="${id}"][data-phase="settled"]`)).toBeVisible({ timeout: 6000 })
    expect(await page.evaluate(() => (window as unknown as { fewest: number }).fewest)).toBe(0)
    await expect(page.locator('[data-piece-id]')).not.toHaveCount(0)
    await expect(page.locator('[data-question]')).toBeVisible()
  })

  test('typing r in the ask field does not replay', async ({ page }) => {
    await page.goto(url('vercel/next.js', GOLDEN[1]!))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('textbox', { name: /Ask another question/ }).fill('r')
    await page.getByRole('textbox', { name: /Ask another question/ }).press('r')
    await expect(page.locator('[data-composition="replay"]')).toHaveCount(0)
  })

  test('the density control sets the screen root and holds for the session', async ({ page }) => {
    await page.goto(url('vercel/next.js', GOLDEN[0]!))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    const density = page.getByRole('radiogroup', { name: 'Density' })
    await density.getByRole('radio', { name: 'Compact' }).click()
    await expect(page.locator('[data-composition]')).toHaveAttribute('data-density', 'compact')
    await expect(density.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true')
    await page.goto(url('vercel/next.js', GOLDEN[3]!))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-composition]')).toHaveAttribute('data-density', 'compact')
  })

  test('every golden question on every sample fits a 390px phone with no horizontal scroll', async ({ browser }) => {
    test.setTimeout(300_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true })
    const page = await context.newPage()
    const overflow: string[] = []
    for (const repo of SAMPLES) {
      for (const q of GOLDEN) {
        await page.goto(url(repo, q))
        await expect(settled(page)).toBeVisible({ timeout: 15_000 })
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
        if (scrollWidth !== clientWidth) overflow.push(`${repo} · ${q} · ${scrollWidth} > ${clientWidth}`)
      }
    }
    expect(overflow).toEqual([])
    await context.close()
  })
})

test('the footer line is on every page', async ({ page }, info) => {
  test.skip(info.project.name === 'unconfigured', 'one project is enough')
  for (const path of ['/', url('vercel/next.js', GOLDEN[0]!), '/catalog', '/evals', '/about']) {
    await page.goto(path)
    await expect(page.getByText('Nothing you paste is stored. Public repos only. Sample data is marked.'), path).toBeVisible()
  }
})

// A follow-up click asks Haiku, so it runs only when live calls are allowed: E2E_LIVE=1.
test('clicking Failing checks rewrites release blockers to check failures, the metric morphing in place', async ({ page }, info) => {
  test.skip(!process.env.E2E_LIVE || info.project.name === 'unconfigured', 'live model call; set E2E_LIVE=1')
  test.setTimeout(90_000)
  await page.goto(url('vercel/next.js', GOLDEN[1]!))
  await expect(settled(page)).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => {
    ;(window as unknown as { kept: Element | null }).kept = document.querySelector('[data-piece-id="metric:failing-checks"]')
  })
  await page.locator('[data-piece-id="metric:failing-checks"]').getByRole('button').first().click()
  await expect(page.locator('[data-composition^="cmp-"][data-phase="settled"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-question]')).toHaveText('Which checks are failing on canary?')
  await expect(page.locator('[data-built]')).toContainText('template check-failures')
  expect(await page.evaluate(() => document.querySelector('[data-piece-id="metric:failing-checks"]') === (window as unknown as { kept: Element | null }).kept)).toBe(true)
  expect(page.url()).toContain(encodeURIComponent('Which checks are failing on canary?'))
})
