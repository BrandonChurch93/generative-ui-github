import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('home has no serious accessibility issues @a11y', async ({ page }) => {
  await page.goto('/')
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map(v => `${v.id}: ${v.help}`)).toEqual([])
})
