import { defineConfig } from '@playwright/test';

/** e2e smoke test of the web build (dist/, `npm run build`) */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173/', trace: 'off' },
  webServer: { command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'landscape', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'portrait', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  ],
});
