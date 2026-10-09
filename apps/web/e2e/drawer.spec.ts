import { expect, test, type Page } from '@playwright/test'

// A committed golden composition: it opens with no network and no model call.
const GOLDEN = `/r/vercel/next.js?q=${encodeURIComponent("What's blocking the next release?")}`
const SECTIONS = ['Route', 'Latency', 'GitHub reads', 'What the model chose']

// Exact, so the built block (whose name ends with the same words) does not match.
const stripLink = (page: Page) => page.getByRole('button', { name: 'How this was built', exact: true })

async function settled(page: Page) {
  await page.goto(GOLDEN)
  await expect(stripLink(page)).toBeVisible({ timeout: 20_000 })
}

async function expectOpen(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'How this was built' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  for (const name of SECTIONS) await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'View the JSON' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(page.locator('form[data-tray]')).toHaveJSProperty('inert', true)
  return dialog
}

test('the built block opens the drawer; Escape closes it and focus returns', async ({ page }) => {
  await settled(page)
  const opener = page.locator('[data-built]')
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = await expectOpen(page)

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  await expect(page.locator('form[data-tray]')).toHaveJSProperty('inert', false)
})

test("the strip's link opens the drawer and View the JSON expands", async ({ page }) => {
  await settled(page)
  await stripLink(page).click()
  const dialog = await expectOpen(page)

  const toggle = dialog.getByRole('button', { name: /the JSON$/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const json = dialog.getByLabel('Composition JSON')
  await expect(json).toBeVisible()
  const parsed = JSON.parse((await json.textContent()) ?? '') as { regions: Record<string, { component: string; bound?: unknown }[]>; built: { template: string } }
  expect(parsed.built.template).toBe('release-blockers')
  expect(Object.values(parsed.regions).flat().every(p => p.component && p.bound === undefined)).toBe(true)

  await page.mouse.click(40, 400)
  await expect(dialog).toBeHidden()
})
