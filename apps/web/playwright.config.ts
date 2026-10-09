import { defineConfig, devices } from '@playwright/test'

const CONFIGURED = 3100
const UNCONFIGURED = 3101

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], headless: true },
  projects: [
    {
      name: 'configured',
      testIgnore: /config-error\.spec\.ts/,
      use: { baseURL: `http://localhost:${CONFIGURED}` },
    },
    {
      name: 'unconfigured',
      testMatch: /(config-error|a11y)\.spec\.ts/,
      use: { baseURL: `http://localhost:${UNCONFIGURED}` },
    },
  ],
  webServer: [
    {
      command: `next start -p ${CONFIGURED}`,
      url: `http://localhost:${CONFIGURED}`,
      reuseExistingServer: false,
    },
    {
      // Empty values, not edits to .env.local: Next never overrides a variable the process already has.
      command: `next start -p ${UNCONFIGURED}`,
      url: `http://localhost:${UNCONFIGURED}`,
      reuseExistingServer: false,
      env: { GITHUB_TOKEN: '', ANTHROPIC_API_KEY: '' },
    },
  ],
})
