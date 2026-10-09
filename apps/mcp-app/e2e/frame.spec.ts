import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { framed } from '../src/frame'
import type { Composition } from '@genui-github/renderer/core'

// A stand-in host: it answers the frame's ui/initialize, then hands it the tool's input and result, the way
// MCP Apps 2026-01-26 hosts do, and checks the composition fits the frame it was given.

const html = readFileSync(fileURLToPath(new URL('../dist/view.html', import.meta.url)), 'utf8')
const fixture = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../packages/renderer/fixtures/${name}.json`, import.meta.url)), 'utf8')) as Composition
const FIXTURES = ['1-release-blockers', '2-check-failures', '3-contributors']

async function host(page: Page, width: number, composition: Composition) {
  const result = { kind: 'composition', repo: 'vercel/next.js', question: 'a question', url: 'https://example.test/r/vercel/next.js', composition: framed(composition) }
  await page.setContent(`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-same-origin" style="border:0;width:${width}px;height:1400px"></iframe></body>`)
  await page.evaluate(
    ({ html, width, result }) => {
      const frame = document.getElementById('f') as HTMLIFrameElement
      const w = window as unknown as { seen: string[] }
      w.seen = []
      window.addEventListener('message', event => {
        const msg = event.data as { id?: number; method?: string }
        if (!msg?.method) return
        w.seen.push(msg.method)
        const reply = (body: object) => frame.contentWindow!.postMessage({ jsonrpc: '2.0', ...body }, '*')
        if (msg.method === 'ui/initialize') {
          reply({
            id: msg.id,
            result: { protocolVersion: '2026-01-26', hostCapabilities: { openLinks: {}, serverTools: {} }, hostInfo: { name: 'test-host', version: '1.0.0' }, hostContext: { theme: 'light', displayMode: 'inline', containerDimensions: { width } } },
          })
        } else if (msg.method === 'ui/notifications/initialized') {
          reply({ method: 'ui/notifications/tool-input', params: { arguments: { repo: result.repo, question: result.question } } })
          reply({ method: 'ui/notifications/tool-result', params: { content: [{ type: 'text', text: 'answer' }], structuredContent: result } })
        } else if (msg.id !== undefined) {
          reply({ id: msg.id, result: {} })
        }
      })
      frame.srcdoc = html
    },
    { html, width, result },
  )
}

for (const name of FIXTURES) {
  for (const width of [420, 360]) {
    test(`${name} composes inside a ${width}px frame with no horizontal scroll`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await host(page, width, fixture(name))
      const frame = page.frameLocator('#f')
      await expect(frame.locator('[data-composition][data-phase="settled"]')).toBeVisible({ timeout: 15_000 })
      await expect(frame.locator('[data-region="insight"]')).toBeVisible()
      const fit = await frame.locator('body').evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      expect(fit.sw).toBe(fit.cw)
      const columns = await frame.locator('[data-region="metrics"]').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      expect(columns).toBe(width >= 400 ? 2 : 1)
      expect(await frame.locator('[data-region="side"] [data-piece-id]').count()).toBe(0)
      await expect(frame.getByRole('button', { name: 'Open in Generative UI' })).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toContain('ui/initialize')
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${width}.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }
}
