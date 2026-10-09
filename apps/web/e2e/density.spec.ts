import { expect, test } from '@playwright/test'

const metricSize = (page: import('@playwright/test').Page, density: string) =>
  page.getByTestId(`density-${density}`).evaluate(el => getComputedStyle(el).getPropertyValue('--metric-size').trim())

test('each density root resolves its own metric size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/catalog/density')
  expect(await metricSize(page, 'compact')).toBe('30px')
  expect(await metricSize(page, 'comfortable')).toBe('38px')
  expect(await metricSize(page, 'spacious')).toBe('46px')
})

test('spacious steps down to comfortable under 640px', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  await page.goto('/catalog/density')
  expect(await metricSize(page, 'spacious')).toBe('38px')
  expect(await metricSize(page, 'compact')).toBe('30px')
})
