import { defineConfig } from '@playwright/test'
import { globSync } from 'node:fs'

// Use Replit's installed browser when available, otherwise Playwright's default.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0]

export default defineConfig({
  testDir: './tests',
  outputDir: '../../generated-artifacts/browser-tests',
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:80',
    headless: true,
    launchOptions: {
      executablePath,
    },
  },
})
