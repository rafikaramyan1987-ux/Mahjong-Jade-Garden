import { defineConfig } from '@playwright/test';

/** e2e smoke test of the GameDistribution build (dist-gd/, `npm run build:gd`) with a mocked GD SDK */
export default defineConfig({
  testDir: 'tests/e2e-gd',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4175/', trace: 'off' },
  webServer: { command: 'npx vite preview --mode gd --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'gd-landscape', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'gd-portrait', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
