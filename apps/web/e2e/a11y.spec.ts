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
  await page.goto('/components')
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

const GOLDEN_PATHS = [
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
].map(q => `/r/vercel/next.js?q=${encodeURIComponent(q)}`)

test('every shell screen has no serious accessibility issues @a11y', async ({ browser }, info) => {
  test.skip(info.project.name === 'unconfigured', 'the samples and the force flags answer without configuration')
  test.setTimeout(240_000)
  const found: string[] = []
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    for (const path of GOLDEN_PATHS) {
      await page.goto(path)
      await page.locator('[data-composition][data-phase="settled"]').waitFor()
      found.push(...(await serious(page)))
    }
    const q = encodeURIComponent("What's blocking the next release?")
    for (const force of ['warming', 'ratelimit', 'cap', 'empty']) {
      await page.goto(`/r/vercel/next.js?q=${q}&force=${force}`)
      await page.locator('[data-phase="done"], [data-phase="refused"]').first().waitFor()
      // Contrast is measured on the settled screen, never mid-fade: a composition says when it has settled; a refusal's entrance is a few staggered fades.
      if (force === 'ratelimit') await page.waitForTimeout(1500)
      else await page.locator('[data-composition][data-phase="settled"]').waitFor()
      found.push(...(await serious(page)))
    }
    await page.goto(`/r/vercel/next.js?q=${encodeURIComponent('a question with no cached answer')}&force=cap`)
    await page.locator('[data-phase="refused"]').waitFor()
    await page.waitForTimeout(1500)
    found.push(...(await serious(page)))
    for (const path of ['/evals', '/about']) {
      await page.goto(path)
      found.push(...(await serious(page)))
    }
    await context.close()
  }
  expect(found).toEqual([])
})

test('fields are 16px under 480px, so iOS does not zoom @a11y', async ({ browser }, info) => {
  test.skip(info.project.name === 'unconfigured', 'one project is enough')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const sizes: string[] = []
  for (const path of ['/', `/r/vercel/next.js?q=${encodeURIComponent("How's this repo doing?")}`]) {
    await page.goto(path)
    for (const field of await page.locator('input:visible, textarea:visible, select:visible').all()) {
      const size = await field.evaluate(el => getComputedStyle(el).fontSize)
      if (parseFloat(size) < 16) sizes.push(`${path} ${await field.evaluate(el => el.outerHTML.slice(0, 80))} ${size}`)
    }
  }
  expect(sizes).toEqual([])
  await context.close()
})
