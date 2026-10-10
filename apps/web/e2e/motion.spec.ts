import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`all seven moves run in and out with no console errors (${reducedMotion})`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()))
    page.on('pageerror', err => errors.push(err.message))
    await page.emulateMedia({ reducedMotion })
    await page.goto('/components/motion')

    const moves = ['wipe', 'extend', 'slide', 'draw', 'count', 'bloom', 'rise']
    await expect(page.locator('[data-move]')).toHaveCount(moves.length)
    await page.getByRole('button', { name: 'Play all' }).click()
    await expect(page.getByTestId('motion-runs')).toHaveText('7 runs')
    await page.waitForTimeout(1600)
    for (const name of moves) {
      await page.getByRole('region', { name }).getByRole('button', { name: 'Out' }).click()
    }
    await page.waitForTimeout(800)
    await expect(page.getByTestId('motion-runs')).toHaveText('14 runs')
    expect(errors).toEqual([])
  })
}
