import { expect, test, type Page } from '@playwright/test'

// The screens that take the answer's place, each forced with its query flag. None of them needs the network:
// the forced refusals return before any data is read, golden questions on samples are committed, and the
// near-empty repo is a recorded fixture.

const url = (repo: string, q: string, force: string) => `/r/${repo}?q=${encodeURIComponent(q)}&force=${force}`
const TIME = /\d{2}:\d{2}/
const tray = (page: Page) => page.locator('[data-tray] input[name="question"]')

test.describe('system screens', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === 'unconfigured', 'one project is enough')
  })

  test('rate limit: the sentence, a countdown, Try again, the samples and a closed tray', async ({ page }) => {
    const question = 'Is CI getting slower?'
    await page.goto(url('vitejs/vite', question, 'ratelimit'))
    const screen = page.locator('[data-system="rate-limit"]')
    await expect(screen.locator('[data-say]')).toHaveText(new RegExp(`GitHub's rate limit resets at ${TIME.source}`))
    await expect(screen.locator('[data-countdown]')).toHaveText(/^\d{2}:\d{2}$/)
    await expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    const links = screen.locator('[data-repo-link]')
    await expect(links).toHaveCount(4)
    await expect(links.first()).toHaveAttribute('href', `/r/vercel/next.js?q=${encodeURIComponent(question)}`)
    await expect(page.locator('[data-built]')).toHaveCount(0)
    await expect(tray(page)).toBeDisabled()
    await expect(tray(page)).toHaveAttribute('placeholder', new RegExp(`^New questions open at ${TIME.source}`))
  })

  test('daily cap: a golden question opens from cache with the notice, a live one gets the cap sentence', async ({ page }) => {
    await page.goto(url('vercel/next.js', "What's blocking the next release?", 'cap'))
    await expect(page.getByText('Cached-only mode.')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-built]')).toBeVisible()
    await expect(tray(page)).toBeDisabled()
    await expect(tray(page)).toHaveAttribute('placeholder', new RegExp(`^New questions open at ${TIME.source}`))

    await page.goto(url('vercel/next.js', 'are builds taking longer than they used to', 'cap'))
    const screen = page.locator('[data-system="daily-cap"]')
    await expect(screen.locator('[data-say]')).toHaveText('Live questions are paused for today. Sample repos and cached answers still work.')
    await expect(screen.locator('[data-repo-link]')).toHaveCount(4)
    await expect(tray(page)).toBeDisabled()
  })

  test('warming: the WarmingUp card with no receipt, then the composed answer', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(url('vercel/next.js', "What's blocking the next release?", 'warming'))
    await expect(page.locator('[data-piece="WarmingUp"]')).toBeVisible()
    await expect(page.locator('[data-built]')).toHaveCount(0)
    await expect(page.locator('[data-ask]')).toHaveCount(0)
    await expect(page.locator('[data-built]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-piece="WarmingUp"]')).toHaveCount(0)
  })

  test('near-empty: a real tiny repo with honest empty states and the system sentence', async ({ page }) => {
    await page.goto(url('vercel-labs/vercel-byoc', "What's blocking the next release?", 'empty'))
    await expect(page.locator('[data-piece="Insight"]')).toContainText('has 4 commits and no releases, so most of this is empty. Here is what there is.', { timeout: 15_000 })
    await expect(page.locator('[data-built]')).toContainText('template release-blockers')
    await expect(page.locator('[data-piece-id][data-state="empty"]').first()).toBeAttached()
    await expect(page.locator('[data-piece-id][data-state="error"], [data-piece-id][data-state="warming"]')).toHaveCount(0)
  })
})
