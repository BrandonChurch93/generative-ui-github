import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PAGES = ['/', '/catalog/Probe', '/catalog/parts', '/catalog/density', '/catalog/motion']

for (const path of PAGES) {
  test(`${path} has no serious accessibility issues @a11y`, async ({ page }, info) => {
    test.skip(info.project.name === 'unconfigured' && path !== '/', 'only the home page depends on configuration')
    await page.goto(path)
    const { violations } = await new AxeBuilder({ page }).analyze()
    const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map(v => `${v.id}: ${v.help} (${v.nodes.map(n => n.target.join(' ')).join(', ')})`)).toEqual([])
  })
}
