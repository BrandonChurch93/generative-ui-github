import { expect, test, type Locator, type Page } from '@playwright/test'

// The composed screen's chrome and layout, polish round two: the "Ask next" eyebrow and the chip rule
// (interactive is sans in a bordered surface, data is mono with no border), one unit for the closure ratio,
// and the split that stacks when main has one piece and side has two. Every question here is a golden one.

const url = (repo: string, q: string) => `/r/${repo}?q=${encodeURIComponent(q)}`
const settled = (page: Page) => page.locator('[data-composition][data-phase="settled"]')
const SAMPLES = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite']

const look = (l: Locator) =>
  l.evaluate(el => {
    const s = getComputedStyle(el)
    return { mono: /mono/i.test(s.fontFamily), border: parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' }
  })

const box = async (l: Locator) => (await l.boundingBox())!

test.describe('composed chrome', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'unconfigured', 'the samples answer without configuration; one project is enough')
  })

  test('"Ask next" heads the follow-ups; the follow-ups are interactive chips and the eyebrow chips are data', async ({ page }) => {
    await page.goto(url('vercel/next.js', 'How responsive are the maintainers?'))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    const nav = page.getByRole('navigation', { name: 'Ask next' })
    await expect(nav.getByText('Ask next', { exact: true })).toBeVisible()
    const label = await box(nav.getByText('Ask next', { exact: true }))
    const chips = nav.locator('[data-ask]')
    await expect(chips.first()).toBeVisible()
    expect((await box(chips.first())).y).toBeGreaterThan(label.y + label.height - 1)
    expect(await look(nav.getByText('Ask next', { exact: true }))).toEqual({ mono: false, border: false })

    for (const chip of await chips.all()) expect(await look(chip)).toEqual({ mono: false, border: true })
    const eyebrow = page.locator('[data-chrome]')
    for (const text of ['vercel/next.js', /^sample · read /, /^asked /]) {
      expect(await look(eyebrow.getByText(text).first())).toEqual({ mono: true, border: false })
    }

    await chips.first().focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const ring = await chips.first().evaluate(el => {
      const s = getComputedStyle(el)
      const probe = document.createElement('i')
      probe.style.color = 'var(--focus)'
      el.append(probe)
      const focus = getComputedStyle(probe).color
      probe.remove()
      return { style: s.outlineStyle, color: s.outlineColor, focus }
    })
    expect(ring.style).toBe('solid')
    expect(ring.color).toBe(ring.focus)
  })

  test('the closure ratio reads in × on the metric, the chart and the insight, on every sample', async ({ page }) => {
    test.setTimeout(90_000)
    for (const repo of SAMPLES) {
      await page.goto(url(repo, 'How responsive are the maintainers?'))
      await expect(settled(page)).toBeVisible({ timeout: 15_000 })
      const metric = page.locator('[data-piece-id="metric:closure-ratio"]')
      await expect(metric).toContainText('×')
      const chart = page.locator('[data-component="LineChart"]').filter({ hasText: 'Closure ratio' })
      await expect(chart.locator('[data-end-value]')).toBeVisible()
      const end = (await chart.locator('[data-end-value]').locator('..').innerText()).replace(/\s+/g, '')
      expect(end, repo).toMatch(/^\d+\.\d×$/)
      expect(await chart.locator('[data-plot]').getAttribute('aria-label'), repo).not.toContain('%')
      const insight = await page.locator('[data-component="Insight"]').first().innerText()
      expect(insight, repo).not.toMatch(/closure ratio[^.]*\d%/i)
    }
  })

  test('one piece in main and two in side stack as one column; one and one stay side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    for (const q of ['Is CI getting slower?', 'How responsive are the maintainers?']) {
      await page.goto(url('vercel/next.js', q))
      await expect(settled(page)).toBeVisible({ timeout: 15_000 })
      const [main, side] = [await box(page.locator('[data-region="main"]')), await box(page.locator('[data-region="side"]'))]
      expect(side.y, q).toBeGreaterThanOrEqual(main.y + main.height)
      expect(Math.round(side.width), q).toBe(Math.round(main.width))
    }
    await page.goto(url('vercel/next.js', "What's blocking the next release?"))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    const [main, side] = [await box(page.locator('[data-region="main"]')), await box(page.locator('[data-region="side"]'))]
    expect(Math.round(side.y)).toBe(Math.round(main.y))
    expect(side.x).toBeGreaterThan(main.x + main.width)
  })
})

test.describe('composed chrome, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'unconfigured', 'the samples answer without configuration; one project is enough')
  })

  test('the eyebrow and the chips arrive with the 200ms fade and nothing moves', async ({ page }) => {
    await page.goto(url('vercel/next.js', 'Is CI getting slower?'))
    await expect(settled(page)).toBeVisible({ timeout: 15_000 })
    const nav = page.getByRole('navigation', { name: 'Ask next' })
    await expect(nav.getByText('Ask next', { exact: true })).toBeVisible()
    await expect.poll(() => nav.locator('[data-asks-label], [data-ask]').evaluateAll(els => els.every(el => getComputedStyle(el).opacity === '1'))).toBe(true)
    const parts = await nav.locator('[data-asks-label], [data-ask]').evaluateAll(els => els.map(el => getComputedStyle(el).transform))
    expect(parts.every(t => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)')).toBe(true)
  })
})
