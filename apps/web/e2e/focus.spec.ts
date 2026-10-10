import { expect, test } from '@playwright/test'

test('every interactive element on /components/parts shows the focus ring', async ({ page }) => {
  await page.goto('/components/parts')
  const focus = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--focus').trim())
  const expected = await page.evaluate(hex => {
    const probe = document.createElement('span')
    probe.style.color = hex
    document.body.append(probe)
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  }, focus)

  const tabStops = await page.locator('main').evaluate(main => {
    const candidates = main.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
    return [...candidates].filter(el => el.tabIndex >= 0 && !el.hasAttribute('disabled')).length
  })
  expect(tabStops).toBeGreaterThan(5)

  const seen: string[] = []
  const failures: string[] = []
  for (let i = 0; i < 200 && seen.length < tabStops; i++) {
    await page.keyboard.press('Tab')
    const result = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body || !el.closest('main')) return null
      const own = getComputedStyle(el)
      const shape = getComputedStyle(el, '::after')
      // Rows draw their ring on the lifted shape so it stays inside the card.
      const ring = own.outlineStyle !== 'none' ? own : shape
      return {
        name: `${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 40)}`,
        style: ring.outlineStyle,
        width: ring.outlineWidth,
        offset: ring.outlineOffset,
        color: ring.outlineColor,
      }
    })
    if (!result) continue
    seen.push(result.name)
    if (result.style !== 'solid' || result.width !== '2px' || result.offset !== '2px' || result.color !== expected) {
      failures.push(`${result.name}: ${result.style} ${result.width} offset ${result.offset} ${result.color}`)
    }
  }
  expect(seen.length).toBe(tabStops)
  expect(failures).toEqual([])
})

test('the components bar and every card name show the focus ring', async ({ page }) => {
  await page.goto('/components?still')
  await page.locator('[data-phase="settled"]').waitFor()
  const focus = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--focus').trim())
  const expected = await page.evaluate(hex => {
    const probe = document.createElement('span')
    probe.style.color = hex
    document.body.append(probe)
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  }, focus)
  const ring = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const s = getComputedStyle(el)
      const label = el instanceof HTMLInputElement ? (el.labels?.[0]?.textContent ?? '') : (el.textContent?.trim() ?? '')
      return { label, ring: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineOffset} ${s.outlineColor}` }
    })

  const data = page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { name: /^Data/ })
  for (let i = 0; i < 40 && !(await data.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(data).toBeFocused()
  const seen = [await ring()]
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    seen.push(await ring())
  }
  expect(seen.map(s => s.label)).toEqual(['Data 15', 'Comfortable', 'Replay', 'Filter Data components', 'Metric'])
  for (const s of seen) expect(s.ring, s.label).toBe(`solid 2px 2px ${expected}`)
})
