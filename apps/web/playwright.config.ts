import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
  },
  webServer: {
    command: 'zsh -lc "npx --yes pnpm --filter @customreport/web exec next dev -p 3100"',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
