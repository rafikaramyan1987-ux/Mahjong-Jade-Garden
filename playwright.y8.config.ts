import { defineConfig } from '@playwright/test';

/** e2e smoke test of the Y8 build (dist-y8/, `npm run build:y8`) with a stubbed SDK */
export default defineConfig({
  testDir: 'tests/e2e-y8',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4178/', trace: 'off' },
  webServer: { command: 'npx vite preview --mode y8 --host 127.0.0.1 --port 4178 --strictPort', url: 'http://127.0.0.1:4178/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'y8-landscape', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'y8-portrait', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
