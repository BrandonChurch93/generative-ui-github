import { expect, test, type Page } from '@playwright/test'

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

const settled = (page: Page, composition: string) =>
  expect(page.locator(`[data-composition="${composition}"][data-phase="settled"]`)).toBeVisible({ timeout: 10_000 })

const piece = (page: Page, id: string) => page.locator(`[data-piece-id="${id}"]`)

/** Keeps a handle on every piece now on screen, so the next screen can be checked for the same DOM nodes. */
async function remember(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { kept: Map<string, Element> }
    w.kept = new Map([...document.querySelectorAll('[data-piece-id]')].map(el => [el.getAttribute('data-piece-id')!, el]))
  })
}

async function sameNodes(page: Page, ids: string[]): Promise<Record<string, boolean>> {
  return page.evaluate(ids => {
    const w = window as unknown as { kept: Map<string, Element> }
    return Object.fromEntries(ids.map(id => [id, document.querySelector(`[data-piece-id="${id}"]`) === w.kept.get(id)]))
  }, ids)
}

test('fixture 1 composes in 2.2 to 2.6s, with the insight readable under 1s', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/dev/render?fixture=1')
  await settled(page, 'cmp-release-blockers')
  const timing = await page.evaluate(() => {
    const start = performance.getEntriesByName('genui:screen:start').at(-1)!.startTime
    return {
      total: performance.getEntriesByName('genui:screen', 'measure').at(-1)!.duration,
      insight: performance.getEntriesByName('genui:insight:visible').at(-1)!.startTime - start,
    }
  })
  expect(timing.total).toBeGreaterThanOrEqual(2200)
  expect(timing.total).toBeLessThanOrEqual(2600)
  expect(timing.insight).toBeLessThan(1000)
  expect(errors).toEqual([])
})

test('the three-screen rewrite morphs survivors in place, 1 to 2, 2 to 3, 3 to 1', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/dev/render?fixture=1')
  await settled(page, 'cmp-release-blockers')
  await expect(page.locator('[data-question]')).toHaveText("What's blocking the next release?")

  // 1 to 2: a click on the failing checks metric asks its question.
  await remember(page)
  await page.evaluate(() => {
    const w = window as unknown as { counted: string[] }
    const number = document.querySelector('[data-piece-id="metric:failing-checks"] [data-number]')!
    w.counted = [number.textContent ?? '']
    new MutationObserver(() => w.counted.push(number.textContent ?? '')).observe(number, { childList: true, characterData: true, subtree: true })
  })
  await piece(page, 'metric:failing-checks').getByRole('button').click()
  await settled(page, 'cmp-check-failures')
  expect(await sameNodes(page, ['insight:answer', 'metric:failing-checks', 'linechart:ci-p50'])).toEqual({
    'insight:answer': true,
    'metric:failing-checks': true,
    'linechart:ci-p50': true,
  })
  const counted = await page.evaluate(() => (window as unknown as { counted: string[] }).counted)
  expect(counted[0]).toBe('1')
  expect(counted.at(-1)).toBe('2')
  await expect(piece(page, 'metric:failing-checks').locator('[data-delta]')).toHaveText('both on canary')
  for (const gone of ['metric:open-prs', 'metric:awaiting-review', 'metric:milestone-issues-open', 'statuslist:pull:milestone-v16.2']) {
    await expect(piece(page, gone)).toHaveCount(0)
  }
  for (const arrived of ['metric:failing-since', 'metric:ci-p50', 'metric:flaky-rate', 'statuslist:check:branch-canary']) {
    await expect(piece(page, arrived)).toHaveCount(1)
  }
  await expect(page.locator('[data-question]')).toHaveText('Which checks are failing on canary?')

  // 2 to 3.
  await remember(page)
  await page.getByRole('radiogroup', { name: 'Composition' }).getByRole('radio', { name: 'Contributors' }).click()
  await settled(page, 'cmp-contributors')
  expect(await sameNodes(page, ['insight:answer'])).toEqual({ 'insight:answer': true })
  await expect(piece(page, 'rank:commits:90d')).toHaveCount(1)
  await expect(piece(page, 'statuslist:check:branch-canary')).toHaveCount(0)

  // 3 to 1: awaiting review asks for the release blockers and moves from the fourth slot to the second.
  await remember(page)
  const from = await piece(page, 'metric:awaiting-review').boundingBox()
  await piece(page, 'metric:awaiting-review').getByRole('button').click()
  await settled(page, 'cmp-release-blockers')
  expect(await sameNodes(page, ['insight:answer', 'metric:awaiting-review'])).toEqual({ 'insight:answer': true, 'metric:awaiting-review': true })
  const to = await piece(page, 'metric:awaiting-review').boundingBox()
  expect(to!.x).toBeLessThan(from!.x)
  expect(errors).toEqual([])
})

test('a new rewrite during a rewrite finishes the first and settles on the second', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/dev/render?fixture=1')
  await settled(page, 'cmp-release-blockers')
  const radios = page.getByRole('radiogroup', { name: 'Composition' })
  await radios.getByRole('radio', { name: 'Check failures' }).click()
  await page.waitForTimeout(150)
  await radios.getByRole('radio', { name: 'Contributors' }).click()
  await settled(page, 'cmp-contributors')
  const ids = await page.locator('[data-piece-id]').evaluateAll(els => els.map(el => el.getAttribute('data-piece-id')))
  expect(ids).toEqual([
    'insight:answer',
    'metric:contributors',
    'metric:bus-factor',
    'metric:core-share',
    'metric:awaiting-review',
    'rank:commits:90d',
    'linechart:core-share+community-share',
  ])
  const hidden = await page.locator('[data-piece-id]').evaluateAll(els => els.filter(el => getComputedStyle(el).opacity !== '1').length)
  expect(hidden).toBe(0)
  expect(errors).toEqual([])
})
