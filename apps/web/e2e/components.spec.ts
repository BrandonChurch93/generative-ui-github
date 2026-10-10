import { expect, test, type Page } from '@playwright/test'

const DENSITIES = ['Compact', 'Comfortable', 'Spacious']
const CATEGORIES = ['Data', 'Text', 'Actions', 'Paths', 'System', 'Code', 'Inputs', 'Primitives']

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

const settled = (page: Page, category?: string) => page.locator(`[data-phase="settled"]${category ? `[data-category="${category}"]` : ''}`)
const cards = (page: Page) => page.locator('[data-entry]')
const category = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { name: new RegExp(`^${name}\\b`) })

/** Every component, by category, read off the page with motion off. */
async function componentNames(page: Page): Promise<string[]> {
  await page.goto('/components?still')
  const names: string[] = []
  for (const name of CATEGORIES) {
    await category(page, name).click()
    await expect(settled(page, name)).toBeVisible()
    names.push(...(await cards(page).evaluateAll(els => els.map(el => (el as HTMLElement).dataset.entry ?? ''))))
  }
  return names
}

test('the category bar counts every component, and the counts add up to the catalog', async ({ page }) => {
  await page.goto('/components?still')
  const labels = await page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio').allInnerTexts()
  expect(labels.map(l => l.replace(/\s+\d+$/, ''))).toEqual(CATEGORIES)
  const total = labels.reduce((sum, l) => sum + Number(l.match(/(\d+)$/)![1]), 0)
  await expect(page.getByText(`${total} components`)).toBeVisible()
  await expect(page.getByText('Pick a category and watch every component in it compose from its sample data. Click one to see all five of its states.')).toBeVisible()
})

test('every component opens with each state it supports, at every density', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectConsoleErrors(page)
  const names = await componentNames(page)
  expect(names.length).toBeGreaterThan(30)

  for (const name of names) {
    await page.goto(`/components/${name}?still`)
    const card = page.locator(`[data-entry="${name}"]`)
    await expect(card).toHaveAttribute('data-focused', 'true')
    await expect(settled(page)).toBeVisible()
    const panels = card.locator('[data-panel]')
    const states = await panels.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.state ?? ''))
    expect(states[0], name).toBe('default')
    for (const density of DENSITIES) {
      await page.getByRole('radiogroup', { name: 'Density' }).getByRole('radio', { name: density }).click()
      await expect(page.locator(`[data-phase="settled"] [data-density="${density.toLowerCase()}"]`)).toHaveCount(1)
      for (const panel of await card.locator('[data-panel]').all()) await expect(panel.locator(':scope > div > *').first()).toBeVisible()
    }
    await card.getByRole('button', { name: 'View JSON' }).click()
    await expect(card.getByTestId('catalog-json')).toContainText(`"component": "${name}"`)
  }
  expect(errors).toEqual([])
})

test('a state a component omits is not drawn, and the open card says why', async ({ page }) => {
  await page.goto('/components/ActionCard?still')
  const card = page.locator('[data-entry="ActionCard"]')
  await expect(card.locator('[data-panel]')).toHaveCount(3)
  await expect(card.getByText(/^Empty is left out · /)).toBeVisible()
  await expect(card.getByText(/^Warming is left out · /)).toBeVisible()
})

test('a category switch runs the old set out, then the new set in as skeleton frames that fill', async ({ page }) => {
  await page.goto('/components')
  await expect(settled(page, 'Data')).toBeVisible()
  const seen = page.evaluate(
    () =>
      new Promise<{ names: string; states: string; opacity: number }[]>(resolve => {
        const frames: { names: string; states: string; opacity: number }[] = []
        const start = performance.now()
        const tick = () => {
          const els = [...document.querySelectorAll<HTMLElement>('[data-entry]')]
          frames.push({
            names: els.map(el => el.dataset.entry).join(' '),
            states: els.map(el => el.dataset.state).join(' '),
            opacity: els[0] ? Number(getComputedStyle(els[0].firstElementChild!).opacity) : 1,
          })
          if (performance.now() - start < 3000) requestAnimationFrame(tick)
          else resolve(frames)
        }
        tick()
      }),
  )
  await category(page, 'Code').click()
  const frames = await seen
  const firstNew = frames.findIndex(f => f.names.startsWith('FileTree'))
  expect(firstNew).toBeGreaterThan(0)
  // The old set sank before the new one mounted, and the new one mounted in its skeleton frames.
  expect(Math.min(...frames.slice(0, firstNew).map(f => f.opacity))).toBeLessThan(0.2)
  expect(frames[firstNew]!.states).toBe('skeleton skeleton skeleton')
  expect(frames.at(-1)!.states).toBe('default default default')
  await expect(settled(page, 'Code')).toBeVisible()
})

test('arrow keys on the page switch categories; inside a text field they do not', async ({ page }) => {
  await page.goto('/components?still')
  await page.locator('h1').click()
  await page.keyboard.press('ArrowRight')
  await expect(category(page, 'Text')).toHaveAttribute('aria-checked', 'true')
  await expect(settled(page, 'Text')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(category(page, 'Primitives')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('searchbox').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(category(page, 'Primitives')).toHaveAttribute('aria-checked', 'true')
})

test('clicking a card opens it across the row in place; Escape closes it and focus returns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/components')
  await expect(settled(page, 'Data')).toBeVisible()
  const card = page.locator('[data-entry="Metric"]')
  const narrow = (await card.boundingBox())!.width
  await page.evaluate(() => window.scrollTo(0, 120))
  const scrolled = await page.evaluate(() => window.scrollY)
  await card.getByRole('button', { name: 'Metric', exact: true }).click()
  await expect(page).toHaveURL(/\/components\/Metric$/)
  await expect(card).toHaveAttribute('data-focused', 'true')
  await expect(card.getByRole('button', { name: 'Metric', exact: true })).toHaveAttribute('aria-expanded', 'true')
  expect((await card.boundingBox())!.width).toBeGreaterThan(narrow * 3)
  await expect(card.locator('[data-panel]')).toHaveCount(5)
  expect(await page.evaluate(() => [window.scrollY, window.location.hash])).toEqual([scrolled, ''])

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/components$/)
  await expect(card).not.toHaveAttribute('data-focused')
  await expect(card.getByRole('button', { name: 'Metric', exact: true })).toBeFocused()

  // A click on the card itself opens it, and a second click on its head closes it.
  const sparkline = page.locator('[data-entry="Sparkline"]')
  await sparkline.locator(':scope > div > div').nth(1).click()
  await expect(sparkline).toHaveAttribute('data-focused', 'true')
  await expect(page).toHaveURL(/\/components\/Sparkline$/)
  await sparkline.locator(':scope > div > [data-card-head]').click({ position: { x: 600, y: 10 } })
  await expect(sparkline).not.toHaveAttribute('data-focused')
  await expect(page).toHaveURL(/\/components$/)
})

test('a link to one component opens its category with the card open, drawn by the server', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/components/Heatmap')
  await expect(category(page, 'Data')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-entry="Heatmap"]')).toHaveAttribute('data-focused', 'true')
  await expect(page.locator('[data-entry="Heatmap"] [data-panel]')).toHaveCount(5)
  await context.close()
})

test('the filter narrows the selected category and says when nothing matches', async ({ page }) => {
  await page.goto('/components?still')
  const field = page.getByRole('searchbox', { name: 'Filter Data components' })
  await field.fill('CHART')
  await expect(cards(page)).toHaveCount(2)
  for (const name of await cards(page).evaluateAll(els => els.map(el => (el as HTMLElement).dataset.entry ?? ''))) expect(name.toLowerCase()).toContain('chart')
  await field.fill('no such piece')
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Nothing in Data matches no such piece' })).toBeVisible()
  await field.fill('')
  await expect(cards(page)).toHaveCount(15)
})

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`replay and density rebuild the set with its exit and entrance (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/components')
    await page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { name: /^Text/ }).click()
    await expect(settled(page, 'Text')).toBeVisible()
    const insight = page.locator('[data-entry="Insight"]')
    await page.getByTestId('components-bar').getByRole('button', { name: 'Replay' }).click()
    await expect(insight).toHaveAttribute('data-state', 'skeleton')
    await expect(insight).toHaveAttribute('data-state', 'default')
    await page.getByRole('radiogroup', { name: 'Density' }).getByRole('radio', { name: 'Spacious' }).click()
    await expect(page.locator('[data-phase="settled"] [data-density="spacious"]')).toHaveCount(1)
    await expect(insight.locator(':scope > div')).toHaveCSS('opacity', '1')
  })
}

test('with still, a switch draws the new set at once', async ({ page }) => {
  await page.goto('/components?still')
  await category(page, 'Code').click()
  await expect(page.locator('[data-entry="FileTree"]')).toHaveAttribute('data-state', 'default')
  await expect(page.locator('[data-entry="FileTree"] > div')).toHaveCSS('opacity', '1')
})

test('on a phone the categories stay in reach and nothing scrolls sideways', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/components?still')
  const field = page.getByRole('searchbox')
  expect(await field.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
  await page.evaluate(() => window.scrollTo(0, 2000))
  const bar = page.getByRole('radiogroup', { name: 'Category' })
  const box = (await bar.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeLessThan(40)
  const main = await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)
  expect(main).toBe(true)
  await context.close()
})
