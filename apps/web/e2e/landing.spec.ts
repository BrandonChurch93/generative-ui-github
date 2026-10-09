import { expect, test } from '@playwright/test'

const GROUPS = {
  Shipping: ["What's blocking the next release?", "What's been merged this week?", 'What changed between the last two releases?'],
  Health: ['Is CI getting slower?', 'How responsive are the maintainers?', 'Compare this month to last'],
  People: ["Who's carrying this repo?", 'When does this project get worked on?', 'Which issues have gone stale?'],
  'Getting started': ['Where would a new contributor start?', "How's this repo doing?", 'Show me the biggest open PR'],
}

const composedAt = (repo: string, question: string) => (url: URL) => url.pathname === `/r/${repo}` && url.searchParams.get('q') === question

test('the twelve golden questions sit in four groups', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-question]')).toHaveCount(12)
  for (const [label, questions] of Object.entries(GROUPS)) {
    const group = page.locator(`[data-group="${label}"]`)
    await expect(group.getByRole('heading', { level: 3 })).toHaveText(label)
    await expect(group.getByRole('link')).toHaveText(questions)
  }
})

test('a question asks it of the preselected sample, and of another once it is picked', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'vercel/next.js' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'facebook/react' }).click()
  await expect(page.getByRole('button', { name: 'facebook/react' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: 'Is CI getting slower?' })).toHaveAttribute('href', '/r/facebook/react?q=Is%20CI%20getting%20slower%3F')

  await page.getByRole('button', { name: 'vercel/next.js' }).click()
  await page.getByRole('link', { name: "What's been merged this week?" }).click()
  await expect(page).toHaveURL(composedAt('vercel/next.js', "What's been merged this week?"))
})

test('a repo the field cannot read says why in its validation line', async ({ page }) => {
  await page.goto('/')
  const field = page.getByRole('textbox', { name: 'Public GitHub repository' })
  await field.fill('gitlab.com/foo/bar')
  await field.press('Enter')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  const line = page.locator(`#${await field.getAttribute('aria-describedby')}`)
  await expect(line).toHaveText('Only github.com repos')
  await expect(page).toHaveURL(url => url.pathname === '/')

  await field.fill('github.com/vitejs/vite')
  await field.press('Enter')
  await expect(page).toHaveURL(url => url.pathname === '/r/vitejs/vite')
})

test('how this works opens over an inert page, keeps focus, and closes with Escape', async ({ page }) => {
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'How this works' })
  const behindIsInert = () => page.evaluate(() => document.getElementById('main')?.closest('[inert]') != null)
  await opener.click()

  const dialog = page.getByRole('dialog', { name: 'How this works' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('listitem')).toHaveCount(4)
  expect(await behindIsInert()).toBe(true)
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(await behindIsInert()).toBe(false)

  await opener.click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('a second visit offers the last repo again', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-offer]')).toHaveCount(0)
  await page.evaluate(() => localStorage.setItem('genui:last-repo', 'vitejs/vite'))
  await page.reload()
  const offer = page.getByRole('link', { name: 'Pick up where you left off vitejs/vite' })
  await expect(offer).toBeVisible()
  await expect(offer).toHaveAttribute('href', '/r/vitejs/vite')
})
