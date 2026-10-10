import { expect, test } from '@playwright/test'

test('every interactive element on /catalog/parts shows the focus ring', async ({ page }) => {
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

test('the catalog filter and its sidebar links show the focus ring', async ({ page }) => {
  await page.goto('/components/Metric')
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
      return { label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName, ring: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineOffset} ${s.outlineColor}` }
    })

  const field = page.getByRole('searchbox', { name: 'Filter components' })
  for (let i = 0; i < 40 && !(await field.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(field).toBeFocused()
  expect((await ring()).ring).toBe(`solid 2px 2px ${expected}`)
  await page.keyboard.press('Tab')
  const link = await ring()
  expect(link.label).toBe('Metric')
  expect(link.ring).toBe(`solid 2px 2px ${expected}`)
})
