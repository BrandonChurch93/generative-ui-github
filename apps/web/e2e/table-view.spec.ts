import { expect, test } from '@playwright/test'

const CHARTS = ['LineChart', 'Distribution', 'Comparison', 'ContributorRank', 'Heatmap', 'BarChart']

for (const name of CHARTS) {
  test(`${name} flips to a real table of the same data and back`, async ({ page }) => {
    const response = await page.goto(`/components/${name}?still`)
    test.skip(response?.status() === 404, `${name} is not in the catalog yet`)
    const piece = page.getByTestId('catalog-piece')
    const toggle = piece.getByRole('button', { name: 'Table' })
    const table = piece.locator('table[data-table-view]')
    const plot = piece.locator('[data-chart-body]').first()

    await expect(plot).toBeVisible()
    await expect(table).not.toBeInViewport()
    await toggle.click()
    await expect(piece.getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true')
    await expect(table).toBeVisible()
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(1)
    expect((await table.boundingBox())!.height).toBeGreaterThan(40)
    await expect(plot).toBeHidden()

    await piece.getByRole('button', { name: 'Chart' }).click()
    await expect(plot).toBeVisible()
  })
}
