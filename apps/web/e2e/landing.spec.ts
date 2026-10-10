import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const GROUPS = {
  Shipping: ["What's blocking the next release?", "What's been merged this week?", 'What changed between the last two releases?'],
  Health: ['Is CI getting slower?', 'How responsive are the maintainers?', 'Compare this month to last'],
  People: ["Who's carrying this repo?", 'When does this project get worked on?', 'Which issues have gone stale?'],
  'Getting started': ['Where would a new contributor start?', "How's this repo doing?", 'Show me the biggest open PR'],
}

/** What the committed sample file says of a repo, which is all its landing card may show. */
function sampleRepo(file: string) {
  const sample = JSON.parse(readFileSync(fileURLToPath(new URL(`../../../packages/data/samples/${file}.json`, import.meta.url)), 'utf8')) as {
    entries: Record<string, { value: unknown }>
  }
  const [, entry] = Object.entries(sample.entries).find(([key]) => /^repo:[^:]+:repo$/.test(key))!
  return entry.value as { owner: string; description: string | null; stars: number }
}

const composedAt = (repo: string, question: string) => (url: URL) => url.pathname === `/r/${repo}` && url.searchParams.get('q') === question

test('step 2 is whole but muted before a repo; touching it asks for a repo first, never leaving the page', async ({ page }) => {
  await page.goto('/')
  const ask = page.locator('section[data-step="2"]')
  await expect(ask).not.toHaveAttribute('data-ready')
  await expect(ask.getByRole('heading', { level: 2 })).toHaveText('2 · Ask it a question')
  await expect(ask.getByRole('textbox')).toBeVisible()
  await expect(ask.locator('button[data-question][aria-disabled="true"]')).toHaveCount(12)
  await expect(page.locator('[data-sample][aria-pressed="true"]')).toHaveCount(0)

  const repoField = page.getByRole('textbox', { name: 'Public GitHub repository' })
  // aria-disabled, not disabled: the click is how the step says what it needs.
  await ask.getByRole('button', { name: 'Is CI getting slower?' }).click({ force: true })
  await expect(page).toHaveURL(url => url.pathname === '/')
  await expect(repoField).toBeFocused()
  await expect(page.locator(`#${await repoField.getAttribute('aria-describedby')}`)).toHaveText('Pick a repo first')

  await ask.getByRole('textbox').click({ force: true })
  await expect(repoField).toBeFocused()
})

test('step 1 leads with five sample cards whose words come from the sample files, then the field', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('section[data-step="1"] [data-sample]')
  await expect(cards).toHaveCount(5)
  const names = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite']
  for (const [i, name] of names.entries()) await expect(cards.nth(i)).toHaveAccessibleName(name)

  const react = sampleRepo('react__react')
  const card = page.getByRole('button', { name: 'facebook/react' })
  await expect(card).toContainText(react.description!)
  await expect(card).toContainText(`${Math.round(react.stars / 1000)}k stars`)
  await expect(card.locator('img')).toHaveAttribute('src', `https://github.com/${react.owner}.png?size=64`)
  await expect(card.locator('img')).toHaveAttribute('loading', 'lazy')

  // The field is the fallback, after the cards.
  const field = page.getByRole('textbox', { name: 'Public GitHub repository' })
  const below = await Promise.all([cards.first().boundingBox(), field.boundingBox()])
  expect(below[1]!.y).toBeGreaterThan(below[0]!.y + below[0]!.height)
  await expect(page.getByText('Or paste any public GitHub repo')).toBeVisible()
  // The field is two cards wide and starts on the cards' edge; nothing else shares its row.
  const [first, second, box] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox(), page.locator('section[data-step="1"] form').boundingBox()])
  expect(Math.round(box!.x)).toBe(Math.round(first!.x))
  expect(Math.abs(box!.width - (second!.x + second!.width - first!.x))).toBeLessThan(2)
  await expect(page.locator('[data-offer]')).toHaveCount(0)
})

test("a long description stops at three lines on a word, and the whole of it stays in the card's description", async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('button', { name: 'anthropics/claude-code' })
  const description = card.locator('[id$="-description"]')
  const full = sampleRepo('anthropics__claude-code').description!
  const shown = (await description.textContent())!
  const lines = await description.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
  expect(lines).toBeLessThanOrEqual(3)
  if (shown !== full) {
    expect(shown.endsWith('…')).toBe(true)
    // The words before the ellipsis are whole words of the description, never part of one.
    expect(full.startsWith(shown.slice(0, -1))).toBe(true)
    expect(full.charAt(shown.length - 1)).toMatch(/[\s,.;:]/)
  }
  await expect(card).toHaveAccessibleDescription(new RegExp(full.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('a sample, once picked, fills the field with a check and brings step 2 to life with the twelve questions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'vercel/next.js' }).click()
  await expect(page).toHaveURL(url => url.pathname === '/')
  const repoField = page.getByRole('textbox', { name: 'Public GitHub repository' })
  await expect(repoField).toHaveValue('vercel/next.js')
  await expect(page.locator('[data-message-line][data-kind="resolved"]:not([aria-hidden])')).toHaveText('Found vercel/next.js on GitHub · ready for a question')
  await expect(page.locator('[data-check]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'vercel/next.js' })).toHaveAttribute('aria-pressed', 'true')
  const ask = page.locator('section[data-step="2"]')
  await expect(ask).toHaveAttribute('data-ready', '')
  await expect(ask.getByRole('heading', { level: 2 })).toHaveText('2 · Ask vercel/next.js a question')
  await expect(ask.locator('h2 code')).toHaveText('vercel/next.js')
  await expect(ask.locator('a[data-question]')).toHaveCount(12)
  for (const [label, questions] of Object.entries(GROUPS)) {
    const group = page.locator(`[data-group="${label}"]`)
    await expect(group.getByRole('heading', { level: 3 })).toHaveText(label)
    await expect(group.getByRole('link')).toHaveText(questions)
  }
  // One column per kind, three cards of one height, and the reader's own question after them.
  const lefts = await page.locator('[data-group]').evaluateAll(gs => new Set(gs.map(g => Math.round(g.getBoundingClientRect().left))).size)
  expect(lefts).toBe(4)
  const heights = await ask.locator('a[data-question]').evaluateAll(qs => new Set(qs.map(q => Math.round(q.getBoundingClientRect().height))).size)
  expect(heights).toBe(1)
  const [lastCard, own] = await Promise.all([ask.locator('a[data-question]').last().boundingBox(), ask.getByRole('textbox').boundingBox()])
  expect(own!.y).toBeGreaterThan(lastCard!.y)
  await expect(ask.getByText('Or ask your own question')).toBeVisible()
})

test('a question asks it of the picked sample, and of another once that is picked', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'facebook/react' }).click()
  await expect(page.getByRole('button', { name: 'facebook/react' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: 'Is CI getting slower?' })).toHaveAttribute('href', '/r/facebook/react?q=Is%20CI%20getting%20slower%3F')

  await page.getByRole('button', { name: 'vercel/next.js' }).click()
  await expect(page.getByRole('button', { name: 'facebook/react' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('link', { name: "What's been merged this week?" }).click()
  await expect(page).toHaveURL(composedAt('vercel/next.js', "What's been merged this week?"))
})

test("a question of the reader's own on a sample goes to the composed screen", async ({ page }) => {
  // Only the route is under test; a question off the golden set would cost a live composer call.
  await page.route('**/api/compose**', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'vitejs/vite' }).click()
  const field = page.getByRole('textbox', { name: 'Or ask your own question about vitejs/vite' })
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(field).toBeFocused()
  await field.fill('Which plugins changed the most?')
  await field.press('Enter')
  await expect(page).toHaveURL(composedAt('vitejs/vite', 'Which plugins changed the most?'))
})

test('a typed repo resolves with a check and opens step 2 for it, staying on the page', async ({ page }) => {
  // The check is the server's word on whether GitHub has the repo; stood in here so the test reads no network.
  await page.route('**/api/resolve**', route => route.fulfill({ json: { ok: true, repo: 'withastro/astro', sample: false } }))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Public GitHub repository' }).fill('github.com/withastro/astro')
  await expect(page.locator('[data-message-line][data-kind="resolved"]:not([aria-hidden])')).toHaveText('Found withastro/astro on GitHub · ready for a question')
  await expect(page.locator('section[data-step="2"]')).toHaveAttribute('data-ready', '')
  await expect(page).toHaveURL(url => url.pathname === '/')
  await expect(page.getByRole('link', { name: 'Is CI getting slower?' })).toHaveAttribute('href', '/r/withastro/astro?q=Is%20CI%20getting%20slower%3F')
})

test('a repo GitHub does not have says so and keeps step 2 muted', async ({ page }) => {
  await page.route('**/api/resolve**', route => route.fulfill({ status: 404, json: { ok: false, kind: 'missing', message: "That repo is private or doesn't exist" } }))
  await page.goto('/')
  const field = page.getByRole('textbox', { name: 'Public GitHub repository' })
  await field.fill('someone/private-thing')
  await page.getByRole('button', { name: 'Use repo' }).click()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator(`#${await field.getAttribute('aria-describedby')}`)).toHaveText("That repo is private or doesn't exist")
  await expect(page.locator('section[data-step="2"]')).not.toHaveAttribute('data-ready')
})

test('a sample picked on a phone brings step 2 into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'tailwindlabs/tailwindcss' }).click()
  await expect(page.getByRole('link', { name: "What's blocking the next release?" })).toBeInViewport()
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
  await expect(page.locator('section[data-step="2"]')).toHaveAttribute('data-ready', '')
  await expect(page).toHaveURL(url => url.pathname === '/')
})

test('how it works sits inline, and its link scrolls to it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const section = page.getByRole('region', { name: 'How it works' })
  await expect(section.getByRole('listitem')).toHaveCount(3)
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(['Pick a repo', 'Ask a question', 'Click anything and the screen rebuilds around it'])
  const top = () => section.evaluate(el => el.getBoundingClientRect().top)
  const before = await top()

  await page.getByRole('link', { name: 'How it works' }).click()
  // The page may end before the section can reach the top, so the scroll is checked as travel toward it.
  await expect.poll(top).toBeLessThan(before / 2)
  await expect(section.getByRole('heading', { level: 2 })).toBeInViewport()
  await expect(section).toBeFocused()
  await expect(page).toHaveURL(url => url.hash === '#how-it-works')
  await expect(section.locator('[data-callout]')).toHaveCount(3)
})

test('there is no Recent repo: nothing about a visit is kept in the browser', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'vitejs/vite' }).click()
  await page.reload()
  await expect(page.locator('[data-offer]')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})
