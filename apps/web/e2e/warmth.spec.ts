import { expect, test } from '@playwright/test'

type TraceEvent = { name: string; ph: string; dur?: number; args?: { data?: { type?: string } } }

const centre = (page: import('@playwright/test').Page) =>
  page.locator('[data-cursor-warmth]').evaluate(el => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), opacity: getComputedStyle(el).opacity }
  })

test('the warmth follows the pointer, and each frame of following costs under 16ms', async ({ page, browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'tracing is Chromium only')
  await page.goto('/components/parts')

  // Keep moving until hydration has attached the listener; the first move can arrive before it.
  await expect
    .poll(async () => {
      await page.mouse.move(300 + Math.random(), 200)
      await page.mouse.move(300, 200)
      return centre(page)
    })
    .toMatchObject({ x: 300, y: 200 })
  await page.mouse.move(900, 500, { steps: 5 })
  await expect.poll(() => centre(page)).toMatchObject({ x: 900, y: 500 })
  await expect.poll(async () => Number((await centre(page)).opacity)).toBeGreaterThan(0.9)

  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] })
  for (let i = 0; i < 60; i++) await page.mouse.move(200 + i * 15, 150 + (i % 10) * 30)
  const buffer = await browser.stopTracing()
  const { traceEvents } = JSON.parse(buffer.toString()) as { traceEvents: TraceEvent[] }

  const pointerWork = traceEvents.filter(
    e => e.ph === 'X' && ((e.name === 'EventDispatch' && e.args?.data?.type === 'pointermove') || e.name === 'FireAnimationFrame'),
  )
  expect(pointerWork.length).toBeGreaterThan(30)
  const slowest = Math.max(...pointerWork.map(e => (e.dur ?? 0) / 1000))
  expect(slowest).toBeLessThan(16)
})

test('the warmth is off under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/components/parts')
  await page.mouse.move(300, 200)
  await expect(page.locator('[data-cursor-warmth]')).toBeHidden()
})
