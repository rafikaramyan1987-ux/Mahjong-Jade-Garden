import { defineConfig } from '@playwright/test';

/** e2e smoke test of the CrazyGames build (dist-crazygames/, `npm run build:crazygames`) with a mocked SDK v3 */
export default defineConfig({
  testDir: 'tests/e2e-cg',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4176/', trace: 'off' },
  webServer: { command: 'npx vite preview --mode crazygames --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'cg-landscape', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'cg-portrait', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
