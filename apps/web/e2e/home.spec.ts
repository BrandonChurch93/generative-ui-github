import { expect, test } from '@playwright/test'

const SENTENCE = 'Paste a GitHub repo, ask a question, and an agent composes the interface that answers it.'

test('the landing sentence is set in the display face', async ({ page }) => {
  await page.goto('/')
  const title = page.getByRole('heading', { level: 1, name: SENTENCE })
  await expect(title).toBeVisible()

  const face = await title.evaluate(async el => {
    await document.fonts.ready
    const style = getComputedStyle(el)
    const family = style.fontFamily.split(',')[0]!.trim()
    return {
      family,
      weight: style.fontWeight,
      loaded: document.fonts.check(`${style.fontWeight} ${style.fontSize} ${family}`),
    }
  })
  expect(face.family).toMatch(/Plus Jakarta Sans/)
  expect(face.weight).toBe('700')
  expect(face.loaded).toBe(true)
})

test('tokens.css reaches the browser', async ({ page }) => {
  await page.goto('/')
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
  expect(accent).toBe('#c4492f')
})
