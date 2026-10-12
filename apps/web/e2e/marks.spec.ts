import { expect, test, type Locator, type Page } from '@playwright/test'

// Runs against `next start`, where the bundles load Mark's stylesheet after its hosts': a host that styled the
// mark itself once lost there (the hot mark fell to the card's left edge). Every host now places the mark in its
// own slot; this holds each slot where its README puts it, at every density.

const DENSITIES = ['compact', 'comfortable', 'spacious'] as const

interface Placement {
  kind: string | null
  /** Vertical centre of the mark less that of the line box of the first text it sits beside. */
  dy: number
  /** Mark's left edge from the card's left, and its right edge from the card's right, less the density's inset. */
  left: number
  right: number
}

/** Each mark in `section`, against the first visible line of text in `lineHost` (its row, its card). */
async function placements(section: Locator, lineHost: string): Promise<Placement[]> {
  return section.evaluate((root, hostSelector) => {
    const inset = parseFloat(getComputedStyle(root).getPropertyValue('--inset'))
    const firstLine = (host: Element) => {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
      for (let node; (node = walker.nextNode()); ) {
        // Screen-reader text is clipped to a pixel but still lays out its glyphs: skip it by its element's width.
        if (!node.textContent?.trim() || node.parentElement!.getBoundingClientRect().width <= 2) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const box = [...range.getClientRects()].find(r => r.width > 2)
        if (!box) continue
        // The middle of the line box the text sits in, which is what a slot centres on, not the glyphs' own box.
        const el = node.parentElement!
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
        const lines = [...range.getClientRects()].filter(r => r.width > 2)
        const top = lines.length > 1 ? box.top - (lineHeight - box.height) / 2 : el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)
        return { top, height: lineHeight }
      }
      return null
    }
    return [...root.querySelectorAll('[data-mark]')].map(mark => {
      const m = mark.getBoundingClientRect()
      const card = (mark.closest('[data-card]') ?? root).getBoundingClientRect()
      const host = mark.closest(hostSelector) ?? root
      const line = firstLine(host)
      return {
        kind: mark.getAttribute('data-kind'),
        dy: line ? m.top + m.height / 2 - (line.top + line.height / 2) : Number.NaN,
        left: m.left - card.left - inset,
        right: card.right - m.right - inset,
      }
    })
  }, lineHost)
}

const near = (value: number, label: string) => expect(Math.abs(value), label).toBeLessThan(1.5)

const at = (page: Page, id: string, density: string) => page.locator(`[data-case="${id}"][data-density="${density}"]`)

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dev/marks')
  await expect(page.locator('[data-case] [data-mark]').first()).toBeVisible()
})

for (const density of DENSITIES) {
  test(`marks sit in their slots at ${density}`, async ({ page }) => {
    // Metric: the hot mark at the card's top right, centred on the label line.
    const [hot] = await placements(at(page, 'metric-hot', density), '[data-card]')
    expect(hot?.kind).toBe('crit')
    near(hot!.right, 'hot mark right inset')
    near(hot!.dy, 'hot mark on the label line')

    // DiffView: each message's mark leads its row at the inset, centred on the title line.
    for (const id of ['diff-limit', 'diff-omitted', 'diff-binary']) {
      const marks = await placements(at(page, id, density), '[data-message]')
      expect(marks.map(m => m.kind), id).toEqual(['neutral'])
      near(marks[0]!.left, `${id} mark left inset`)
      near(marks[0]!.dy, `${id} mark on the title line`)
    }

    // Timeline: every node in one column at the inset, each on its row's title line.
    const nodes = await placements(at(page, 'timeline', density), 'li')
    expect(nodes.length).toBeGreaterThan(1)
    for (const [i, node] of nodes.entries()) {
      near(node.left, `node ${i} left inset`)
      near(node.dy, `node ${i} on its title line`)
    }

    // WarmingUp: the lead mark on the sentence's first line, at the lead's own edge.
    const lead = at(page, 'warmingup', density).locator('[data-lead]')
    const [leadMark] = await placements(lead, '[data-lead]')
    near(leadMark!.dy, 'lead mark on the first line')
    const edge = await lead.evaluate(el => el.querySelector('[data-mark]')!.getBoundingClientRect().left - el.getBoundingClientRect().left)
    near(edge, 'lead mark at the lead edge')

    // ActionCard: the result mark leads the result row at the card's content edge, while working and once done.
    const action = at(page, 'actioncard', density)
    await action.getByRole('button', { name: 'Nudge reviewers' }).click()
    await page.waitForTimeout(450)
    await action.getByRole('button', { name: 'Confirm' }).click()
    for (const kind of ['warming', 'good']) {
      await expect(action.locator(`[role="status"] [data-mark][data-kind="${kind}"]`)).toBeVisible({ timeout: 10_000 })
      const [result] = await placements(action, '[role="status"]')
      near(result!.left, `result mark (${kind}) left inset`)
      near(result!.dy, `result mark (${kind}) on the title line`)
    }
  })
}
