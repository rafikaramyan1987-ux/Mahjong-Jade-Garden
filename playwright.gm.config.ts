import { defineConfig } from '@playwright/test';

/** e2e smoke test of the GameMonetize build (dist-gamemonetize/, `npm run build:gamemonetize`) with a stubbed SDK */
export default defineConfig({
  testDir: 'tests/e2e-gm',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4177/', trace: 'off' },
  webServer: { command: 'npx vite preview --mode gamemonetize --host 127.0.0.1 --port 4177 --strictPort', url: 'http://127.0.0.1:4177/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'gm-landscape', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'gm-portrait', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
