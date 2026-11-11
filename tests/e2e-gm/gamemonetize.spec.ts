import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

declare global {
  interface Window {
    __gm: { calls: number; hold: boolean; finish?: () => void };
  }
}

const GM_SDK = 'https://api.gamemonetize.com/sdk.js';

/** stand-in for GameMonetize's sdk.js: SDK_READY at load; showBanner() sends SDK_GAME_PAUSE, then SDK_GAME_START */
const STUB = `(() => {
  const ev = (name) => window.SDK_OPTIONS && window.SDK_OPTIONS.onEvent({ name });
  const g = (window.__gm = window.__gm || { calls: 0, hold: false });
  window.sdk = {
    showBanner() {
      g.calls++;
      ev('SDK_GAME_PAUSE');
      g.finish = () => ev('SDK_GAME_START');
      if (!g.hold) setTimeout(g.finish, 300);
    },
  };
  ev('SDK_READY');
})();`;

async function boot(page: Page, sdk: 'stub' | 'blocked' = 'stub') {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // a blocked SDK shows up as a failed resource load: that is the case under test, not a game error
    if (m.type() === 'error' && !(sdk === 'blocked' && /Failed to load resource/.test(m.text()))) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.route(GM_SDK, (r) => (sdk === 'stub' ? r.fulfill({ contentType: 'application/javascript', body: STUB }) : r.abort()));
  await page.goto('/?fresh&menu');
  await page.waitForSelector('body[data-ready="1"]');
  return { errors, requests };
}

const state = (page: Page) => page.evaluate(() => window.__mjg.state());
const calls = (page: Page) => page.evaluate(() => window.__gm?.calls ?? 0);

/** play n real pairs by tapping / clicking the tiles */
async function playPairs(page: Page, n: number) {
  for (let k = 0; k < n; k++) {
    const r0 = (await state(page)).remaining!;
    const pr = (await page.evaluate(() => window.__mjg.pair()))!;
    for (const [x, y] of pr) {
      if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
    await expect.poll(() => state(page).then((s) => s.remaining)).toBe(r0 - 2);
  }
}

test('loads sdk.js once at boot with SDK_OPTIONS (game ID + onEvent), no other portal SDK, no ad before Play', async ({ page }) => {
  const { errors, requests } = await boot(page);
  await expect(page.locator('[data-testid=play]')).toBeVisible();
  const info = await page.evaluate(() => ({ id: window.SDK_OPTIONS?.gameId, onEvent: typeof window.SDK_OPTIONS?.onEvent, n: document.querySelectorAll('script#gamemonetize-sdk').length }));
  expect(info).toEqual({ id: 'ux7a998kv63s60z7m9q5dbm2241i0e09', onEvent: 'function', n: 1 });
  expect(requests.filter((u) => u === GM_SDK)).toHaveLength(1);
  expect(requests.some((u) => /crazygames|gamedistribution|gamepix|playgama|y8\.com|googlesyndication/i.test(u))).toBe(false);
  expect(await calls(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('Play: one interstitial (game paused, audio suspended), then a board is played and cleared; no ad before the 3rd board', async ({ page }) => {
  const { errors } = await boot(page);
  await page.evaluate(() => (window.__gm.hold = true));
  await page.click('[data-testid=play]');
  await expect.poll(() => calls(page)).toBe(1);
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(true);
  expect((await state(page)).audio).toMatchObject({ silent: true, suspend: true });
  expect((await state(page)).screen).not.toBe('board');
  await page.evaluate(() => window.__gm.finish!());
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  expect((await state(page)).adPaused).toBe(false);
  expect((await state(page)).audio.suspend).toBe(false);
  await page.evaluate(() => window.__mjg.skipTutorial());
  await playPairs(page, 3);
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((s) => s.journey)).toBe(1);
  await page.waitForTimeout(500);
  expect(await calls(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('no "watch an ad" buttons: used-up hints show 0 and offer no rewarded ad (the SDK has no rewarded API)', async ({ page }) => {
  const { errors } = await boot(page);
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await expect(page.locator('[data-testid=hint] .badge')).toHaveText('0');
  await page.click('[data-testid=hint]');
  await page.waitForTimeout(300);
  expect(await page.locator('[data-testid=reward], [data-testid^=offer-]').count()).toBe(0);
  await page.click('[data-testid=shuffle]');
  await page.click('[data-testid=shuffle]');
  await page.evaluate(() => window.__mjg.stuck());
  await page.click('[data-testid=stuck-shuffle]');
  await page.evaluate(() => window.__mjg.stuck());
  await expect(page.locator('[data-testid=stuck]')).toBeVisible();
  expect(await page.locator('[data-testid=reward-continue]').count()).toBe(0);
  expect(await page.locator('text=/watch an ad/i').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('the game is fully playable when sdk.js fails to load (ad blocker)', async ({ page }) => {
  const { errors } = await boot(page, 'blocked');
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  await playPairs(page, 2);
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((s) => s.journey)).toBe(1);
  expect(errors).toEqual([]);
});
