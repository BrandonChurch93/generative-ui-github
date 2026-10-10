import { expect, test, type Page } from '@playwright/test'

const DENSITIES = ['compact', 'comfortable', 'spacious']
const STATES = ['default', 'skeleton', 'empty', 'error', 'warming']

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

async function componentNames(page: Page): Promise<string[]> {
  await page.goto('/components')
  const nav = page.getByRole('navigation', { name: 'Catalog' })
  const hrefs = await nav.getByRole('link').evaluateAll(links => links.map(a => a.getAttribute('href') ?? ''))
  return hrefs.filter(h => /^\/catalog\/[A-Z]/.test(h)).map(h => h.split('/').pop()!)
}

test('every catalog component renders in every state and density it supports', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  const names = await componentNames(page)
  expect(names.length).toBeGreaterThan(0)

  for (const name of names) {
    await page.goto(`/components/${name}`)
    await expect(page.locator('#component-name')).toHaveText(name)
    const stateGroup = page.getByRole('radiogroup', { name: 'State' })
    const skipped = await stateGroup
      .getByRole('radio')
      .evaluateAll(radios => radios.filter(r => r.getAttribute('aria-disabled') === 'true').map(r => r.textContent ?? ''))

    for (const density of DENSITIES) {
      for (const state of STATES) {
        if (skipped.some(label => label.toLowerCase().startsWith(state))) continue
        await page.goto(`/components/${name}?density=${density}&state=${state}`)
        const piece = page.getByTestId('catalog-piece')
        await expect(piece).toHaveAttribute('data-state', state)
        await expect(piece.locator(':scope > *').first()).toBeVisible()
        await expect(page.locator(`[data-density="${density}"]`)).toHaveCount(1)
      }
    }

    await page.getByRole('button', { name: 'View JSON' }).click()
    await expect(page.getByTestId('catalog-json')).toContainText(`"component": "${name}"`)
  }
  expect(errors).toEqual([])
})

test('a skipped state is a disabled segment that says why', async ({ page }) => {
  const names = await componentNames(page)
  let checked = 0
  for (const name of names) {
    await page.goto(`/components/${name}`)
    const disabled = page.getByRole('radiogroup', { name: 'State' }).locator('[aria-disabled="true"]')
    for (const radio of await disabled.all()) {
      await expect(radio).toContainText('Not available:')
      checked++
    }
  }
  test.skip(checked === 0, 'no registered component skips a state yet')
})

test('the catalog opens on its intro, and picking a component swaps the pane in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.goto('/components')
  const main = page.getByRole('main')
  await expect(main).toContainText('Pick a component. It renders from sample data, then rebuilds each time you switch state or density.')
  await expect(page.getByTestId('catalog-piece')).toHaveCount(0)

  await page.evaluate(() => window.scrollTo(0, 200))
  const scrolled = await page.evaluate(() => window.scrollY)
  expect(scrolled).toBeGreaterThan(0)
  const nav = page.getByRole('navigation', { name: 'Catalog' })
  await nav.getByRole('link', { name: 'Heatmap', exact: true }).click()
  await expect(page).toHaveURL(/\/catalog\/Heatmap(\?|$)/)
  await expect(page.locator('#component-name')).toHaveText('Heatmap')
  await expect(main).not.toContainText('Pick a component.')
  expect(await page.evaluate(() => [window.scrollY, window.location.hash])).toEqual([scrolled, ''])
  await expect(nav.getByRole('link', { name: 'Heatmap', exact: true })).toHaveAttribute('aria-current', 'page')

  // The sidebar holds still while a tall pane scrolls past, and scrolls on its own.
  await page.getByRole('button', { name: 'View JSON' }).click()
  await page.evaluate(() => window.scrollTo(0, 600))
  const sidebar = page.getByRole('searchbox', { name: 'Filter components' }).locator('xpath=../..')
  const box = (await sidebar.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeLessThan(40)
  expect(box.y + box.height).toBeLessThanOrEqual(700)

  await page.reload()
  await expect(page.locator('#component-name')).toHaveText('Heatmap')
})

test('the filter narrows the sidebar by name and says when nothing matches', async ({ page }) => {
  await page.goto('/components')
  const nav = page.getByRole('navigation', { name: 'Catalog' })
  const field = page.getByRole('searchbox', { name: 'Filter components' })
  await field.fill('CHART')
  const shown = await nav.getByRole('link').allInnerTexts()
  expect(shown.length).toBeGreaterThan(0)
  for (const label of shown) expect(label.toLowerCase()).toContain('chart')
  await field.fill('no such piece')
  await expect(nav.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'No component matches' })).toBeVisible()
  await field.fill('')
  expect(await nav.getByRole('link').count()).toBeGreaterThan(shown.length)
})

async function opacities(page: Page, ms: number): Promise<{ opacity: number; state: string }[]> {
  return page.getByTestId('catalog-piece').evaluate(
    (el, until) =>
      new Promise(resolve => {
        const seen: { opacity: number; state: string }[] = []
        const start = performance.now()
        const tick = () => {
          seen.push({ opacity: Number(getComputedStyle(el).opacity), state: (el as HTMLElement).dataset.state ?? '' })
          if (performance.now() - start < until) requestAnimationFrame(tick)
          else resolve(seen)
        }
        tick()
      }),
    ms,
  )
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`a state switch runs the old piece out, then the new one in (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/components/Metric?state=default')
    const piece = page.getByTestId('catalog-piece')
    await expect(piece).toHaveCSS('opacity', '1')
    const watching = opacities(page, 1600)
    await page.getByRole('radiogroup', { name: 'State' }).getByRole('radio', { name: 'Error' }).click()
    const seen = await watching
    const firstNew = seen.findIndex(s => s.state === 'error')
    expect(firstNew).toBeGreaterThan(0)
    // The old piece faded before the new one was drawn, and the new one arrived from nothing.
    expect(Math.min(...seen.slice(0, firstNew).map(s => s.opacity))).toBeLessThan(0.2)
    expect(seen[firstNew]!.opacity).toBeLessThan(0.5)
    await expect(piece).toHaveCSS('opacity', '1')
    await expect(page).toHaveURL(/state=error/)
  })
}

test('with still, a switch draws the new state at once', async ({ page }) => {
  await page.goto('/components/Metric?state=default&still')
  const piece = page.getByTestId('catalog-piece')
  await page.getByRole('radiogroup', { name: 'Density' }).getByRole('radio', { name: 'Compact' }).click()
  await page.getByRole('radiogroup', { name: 'State' }).getByRole('radio', { name: 'Skeleton' }).click()
  await expect(piece).toHaveAttribute('data-state', 'skeleton')
  await expect(piece).toHaveCSS('opacity', '1')
  await expect(page.locator('[data-density="compact"]')).toHaveCount(1)
})

test('on a phone the sidebar folds to the filter and one row above the pane', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/components/Metric?still')
  const nav = page.getByRole('navigation', { name: 'Catalog' })
  expect((await nav.boundingBox())!.height).toBeLessThan(80)
  expect((await page.locator('#component-name').boundingBox())!.y).toBeLessThan(844)
  const field = page.getByRole('searchbox', { name: 'Filter components' })
  expect(await field.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(scrollWidth).toBe(clientWidth)
  await context.close()
})
