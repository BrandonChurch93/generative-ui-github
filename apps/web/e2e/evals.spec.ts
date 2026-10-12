import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const RESULTS = fileURLToPath(new URL('../../../packages/evals/results/', import.meta.url))
const TITLES = { production: 'Production', sonnet: 'Sonnet alone', haiku: 'Haiku alone' } as const

// The page reads whatever runs are recorded, so the test asks the same directory what to expect.
const recorded = (Object.keys(TITLES) as (keyof typeof TITLES)[]).filter(model => readdirSync(RESULTS).some(name => name.endsWith(`-${model}.json`)))

test('the eval results page shows the recorded runs', async ({ page }) => {
  await page.goto('/evals')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How often the composer gets it right')
  await expect(page.locator('[data-footer]')).toBeVisible()

  if (!recorded.length) {
    await expect(page.locator('[data-evals-empty]')).toContainText('No eval run recorded yet')
    return
  }

  if (recorded.includes('production')) {
    const metrics = page.getByRole('region', { name: 'Production at a glance' })
    await expect(metrics.locator('[data-metric]')).toHaveCount(4)
    await expect(metrics).toContainText('Template accuracy')
    await expect(metrics).toContainText('Bindings pass rate')
    await expect(metrics).toContainText('Median time to done')
    await expect(metrics).toContainText('Cost per answer')
    await expect(page.locator('[data-latency]')).toBeVisible()
  }

  await expect(page.locator('[data-model-table]')).toHaveCount(recorded.length)
  for (const model of recorded) {
    const table = page.getByRole('region', { name: `${TITLES[model]} pass rates` })
    await expect(table.locator('[data-scorer]')).toHaveCount(7)
  }
  if (recorded.includes('sonnet')) {
    const sonnet = page.getByRole('region', { name: 'Sonnet alone pass rates' })
    for (const scorer of ['template', 'bindings']) await expect(sonnet.locator(`[data-scorer="${scorer}"]`)).toContainText('not scored · no routing')
    // Regression: the Comparison once showed mean F1 beside the table's pass rate. Both read the pass rate now.
    const newest = readdirSync(RESULTS).filter(name => name.endsWith('-sonnet.json')).sort().at(-1)!
    const rate = (JSON.parse(readFileSync(`${RESULTS}${newest}`, 'utf8')) as { aggregate: { pass: { components: { mean: number } } } }).aggregate.pass.components.mean
    await expect(sonnet.locator('[data-scorer="components"]')).toContainText(`${Math.round(rate * 100)}%`)
    await expect(page.locator('[data-card]', { hasText: 'Against Sonnet alone' })).toContainText(`${Number((rate * 100).toFixed(1))}%`)
  }

  const strip = page.locator('[data-evals-strip]')
  await expect(strip).toBeVisible()
  for (const model of recorded) await expect(strip).toContainText(TITLES[model].toLowerCase())
})

test('the eval results page fits a phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/evals')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
})
