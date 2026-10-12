// `pnpm thumbnails`: screenshots /thumbnail from a production build at 2x, into the portfolio thumbnail and the
// Open Graph image. A production server, not dev, so no dev overlay can land in the picture. Fails, writing
// nothing, if a line of text crosses the frame's edge or the hot metric is not wholly in frame.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const PORT = Number(process.env.THUMBNAIL_PORT ?? 3107)
const out = s => process.stdout.write(`${s}\n`)

const SHOTS = [
  { query: '', height: 800, file: resolve(root, 'design-system/exports/portfolio-thumbnail.png') },
  { query: '?size=og', height: 630, file: resolve(web, 'public/og.png') },
]

const free = port =>
  new Promise(done => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.listen(port, () => probe.close(() => done(true)))
  })

if (!(await free(PORT))) {
  out(`port ${PORT} is in use: set THUMBNAIL_PORT to a free one`)
  process.exit(1)
}

const server = spawn(resolve(web, 'node_modules/.bin/next'), ['start', '-p', String(PORT)], { cwd: web, stdio: ['ignore', 'pipe', 'inherit'] })
const base = `http://localhost:${PORT}`
const stop = () => server.kill('SIGTERM')

async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/thumbnail`)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('next start did not answer within 30 s: run next build first')
}

const browser = await chromium.launch()
let failed = false
try {
  await ready()
  const shots = []
  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1200, height: shot.height }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
    await page.goto(`${base}/thumbnail${shot.query}`)
    await page.waitForSelector('[data-thumbnail] [data-composition][data-phase="settled"]', { timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    // Reduced motion still fades each piece in over 200 ms; wait out the last one and two frames more.
    await page.waitForTimeout(600)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

    const problems = await page.evaluate(() => {
      const canvas = document.querySelector('[data-thumbnail]').getBoundingClientRect()
      const found = []
      const walker = document.createTreeWalker(document.querySelector('[data-thumbnail]'), NodeFilter.SHOW_TEXT)
      for (let node; (node = walker.nextNode()); ) {
        if (!node.textContent.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const box of range.getClientRects()) {
          const crosses = (box.top < canvas.bottom && box.bottom > canvas.bottom) || (box.left < canvas.right && box.right > canvas.right)
          if (crosses) found.push(`"${node.textContent.trim().slice(0, 40)}" crosses the frame's edge`)
        }
      }
      const hot = [...document.querySelectorAll('[data-thumbnail] [data-hot]')].map(el => el.getBoundingClientRect())
      if (!hot.some(b => b.top >= canvas.top && b.bottom <= canvas.bottom && b.right <= canvas.right)) found.push('no hot metric is wholly in frame')
      return found
    })
    if (problems.length) {
      failed = true
      out(`/thumbnail${shot.query}:\n  ${problems.join('\n  ')}`)
    } else shots.push({ page, shot })
  }
  if (!failed)
    for (const { page, shot } of shots) {
      mkdirSync(dirname(shot.file), { recursive: true })
      await page.locator('[data-thumbnail]').screenshot({ path: shot.file })
      out(`wrote ${shot.file.replace(`${root}/`, '')} · 2400 by ${shot.height * 2}`)
    }
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
