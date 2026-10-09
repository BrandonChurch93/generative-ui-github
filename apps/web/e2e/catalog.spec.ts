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
  await page.goto('/catalog')
  const nav = page.getByRole('navigation', { name: 'Catalog' })
  const hrefs = await nav.getByRole('link').evaluateAll(links => links.map(a => a.getAttribute('href') ?? ''))
  return hrefs.filter(h => /^\/catalog\/[A-Z]/.test(h)).map(h => h.split('/').pop()!)
}

test('every catalog component renders in every state and density it supports', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  const names = await componentNames(page)
  expect(names.length).toBeGreaterThan(0)
  await expect(page).toHaveURL(new RegExp(`/catalog/${names[0]}`))

  for (const name of names) {
    await page.goto(`/catalog/${name}`)
    await expect(page.locator('#component-name')).toHaveText(name)
    const stateGroup = page.getByRole('radiogroup', { name: 'State' })
    const skipped = await stateGroup
      .getByRole('radio')
      .evaluateAll(radios => radios.filter(r => r.getAttribute('aria-disabled') === 'true').map(r => r.textContent ?? ''))

    for (const density of DENSITIES) {
      for (const state of STATES) {
        if (skipped.some(label => label.toLowerCase().startsWith(state))) continue
        await page.goto(`/catalog/${name}?density=${density}&state=${state}`)
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
    await page.goto(`/catalog/${name}`)
    const disabled = page.getByRole('radiogroup', { name: 'State' }).locator('[aria-disabled="true"]')
    for (const radio of await disabled.all()) {
      await expect(radio).toContainText('Not available:')
      checked++
    }
  }
  test.skip(checked === 0, 'no registered component skips a state yet')
})
