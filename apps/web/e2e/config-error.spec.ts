import { expect, test } from '@playwright/test'

test('without tokens the home page shows the config error state', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Generative UI for GitHub Repos' })).toBeVisible()

  const card = page.getByTestId('config-error')
  await expect(card.getByRole('heading', { name: 'Configuration' })).toBeVisible()
  await expect(card).toContainText("Couldn't start the composer")
  await expect(card).toContainText('GITHUB_TOKEN and ANTHROPIC_API_KEY are not set')
})
