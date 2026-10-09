import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function serious(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${page.url()} ${v.id}: ${v.help} (${v.nodes.map(n => n.target.join(' ')).join(', ')})`)
}

test('/ has no serious accessibility issues @a11y', async ({ page }) => {
  await page.goto('/')
  expect(await serious(page)).toEqual([])
})

test('every catalog page and state has no serious accessibility issues @a11y', async ({ page }, info) => {
  test.skip(info.project.name === 'unconfigured', 'the catalog does not depend on configuration')
  // Every component in every state: this grows with the catalog.
  test.setTimeout(240_000)
  await page.goto('/catalog')
  const hrefs = await page
    .getByRole('navigation', { name: 'Catalog' })
    .getByRole('link')
    .evaluateAll(links => links.map(a => a.getAttribute('href') ?? ''))
  const found: string[] = []
  for (const href of hrefs) {
    const component = /^\/catalog\/[A-Z]/.test(href)
    for (const state of component ? ['default', 'skeleton', 'empty', 'error', 'warming'] : ['']) {
      // `still` skips the entrance, so contrast is measured on the settled piece, never mid-fade.
      await page.goto(state ? `${href}?state=${state}&still` : href)
      found.push(...(await serious(page)))
    }
  }
  expect(found).toEqual([])
})

test('the three composed screens have no serious accessibility issues @a11y', async ({ page }, info) => {
  test.skip(info.project.name === 'unconfigured', 'the renderer does not depend on configuration')
  for (const fixture of ['1', '2', '3']) {
    // Reduced motion, so contrast is measured on the settled screen, never mid-fade.
    await page.goto(`/dev/render?fixture=${fixture}&reduced`)
    await page.locator('[data-phase="settled"]').waitFor()
    expect(await serious(page)).toEqual([])
  }
})
