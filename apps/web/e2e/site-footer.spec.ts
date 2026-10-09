import { expect, test } from '@playwright/test'

test('every page carries the portfolio and source links, and About links its byline, all in new tabs', async ({ page }, info) => {
  test.skip(info.project.name === 'unconfigured', 'one project is enough')
  for (const path of ['/', `/r/vercel/next.js?q=${encodeURIComponent("How's this repo doing?")}`, '/catalog', '/evals', '/about']) {
    await page.goto(path)
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: /Built by Brandon Church/ }), path).toHaveAttribute('href', 'https://brandonchurchportfolio.com')
    await expect(footer.getByRole('link', { name: /Source on GitHub/ }), path).toHaveAttribute('href', 'https://github.com/BrandonChurch93/generative-ui-github')
    for (const link of await footer.getByRole('link').all()) await expect(link).toHaveAttribute('target', '_blank')
  }
  await page.goto('/about')
  const byline = page.getByRole('main').getByRole('link', { name: /Brandon Church/ })
  await expect(byline).toHaveAttribute('href', 'https://brandonchurchportfolio.com')
  await expect(byline).toHaveAttribute('target', '_blank')
})
