import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

declare global {
  interface Window {
    __y8: { calls: string[]; mode: 'viewed' | 'noAd' | 'dismissed'; hold: boolean; finish?: () => void };
  }
}

const Y8_SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';

/**
 * stand-in for y8.min.js: fires `y8sdk.ready` on load (and again on emitReadyEvent); showAd() records the call (and
 * whether init() came first), then plays the documented callbacks: beforeAd → (reward: adViewed / adDismissed) →
 * afterAd → adBreakDone, or only adBreakDone({ breakStatus: 'noAdPreloaded' })
 */
const STUB = `(() => {
  const g = (window.__y8 = window.__y8 || { calls: [], mode: 'viewed', hold: false });
  let inited = false;
  const sdk = {
    init(app, ad) { g.calls.push('init:' + app.appId + ':' + app.autoLogin + ':' + ad.gameId + ':' + ad.preloadAdBreaks + ':' + ad.sound); inited = true; setTimeout(() => ad.onReady && ad.onReady(), 0); },
    onAuth(cb) { setTimeout(() => cb(null, null), 0); },
    showAd(o) {
      g.calls.push((inited ? '' : 'BEFORE-INIT:') + o.type);
      return new Promise((res) => {
        if (g.mode === 'noAd') { o.adBreakDone && o.adBreakDone({ breakStatus: 'noAdPreloaded' }); return res(); }
        const play = () => {
          o.beforeAd && o.beforeAd();
          g.finish = () => {
            if (o.type === 'reward') (g.mode === 'viewed' ? o.adViewed : o.adDismissed)();
            o.afterAd && o.afterAd();
            o.adBreakDone && o.adBreakDone({ breakStatus: g.mode });
            res();
          };
          if (!g.hold) setTimeout(g.finish, 300);
        };
        if (o.type === 'reward') o.beforeReward(play); else play();
      });
    },
  };
  const ready = () => window.dispatchEvent(new Event('y8sdk.ready'));
  window.y8 = { sdk: () => sdk, emitReadyEvent: ready };
  ready();
})();`;

async function boot(page: Page, sdk: 'stub' | 'blocked' = 'stub') {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !(sdk === 'blocked' && /Failed to load resource/.test(m.text()))) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.route(Y8_SDK, (r) => (sdk === 'stub' ? r.fulfill({ contentType: 'application/javascript', body: STUB }) : r.abort()));
  await page.goto('/?fresh&menu');
  await page.waitForSelector('body[data-ready="1"]');
  return { errors, requests };
}

const state = (page: Page) => page.evaluate(() => window.__mjg.state());
const calls = (page: Page) => page.evaluate(() => (window.__y8?.calls ?? []).slice(1));

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

test('y8.min.js from the CDN once (async, in <head>), initialized with the App ID + Game ID, no ad before Play, no other portal', async ({ page }) => {
  const { errors, requests } = await boot(page);
  await expect(page.locator('[data-testid=play]')).toBeVisible();
  expect(await page.locator(`head script[src="${Y8_SDK}"][async]`).count()).toBe(1);
  expect(requests.filter((u) => u === Y8_SDK)).toHaveLength(1);
  expect(requests.some((u) => /crazygames|gamedistribution|gamepix|playgama|gamemonetize|googlesyndication/i.test(u))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__y8.calls)).toEqual(['init:6af4b118ca1c6869a74e0363:true:292543:on:on']);
  expect(errors).toEqual([]);
});

test('Play: start ad (paused + muted in beforeAd, resumed in afterAd), a board is played; Next and Menu: next ads; never before init', async ({ page }) => {
  const { errors } = await boot(page);
  await page.evaluate(() => (window.__y8.hold = true));
  await page.click('[data-testid=play]');
  await expect.poll(() => calls(page)).toEqual(['start']);
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(true);
  expect((await state(page)).audio).toMatchObject({ silent: true, suspend: true });
  await page.evaluate(() => window.__y8.finish!());
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  expect((await state(page)).adPaused).toBe(false);
  await page.evaluate(() => (window.__y8.hold = false));
  await page.evaluate(() => window.__mjg.skipTutorial());
  await playPairs(page, 3);
  // no ad during a board
  expect(await calls(page)).toEqual(['start']);
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => calls(page)).toEqual(['start', 'next']);
  // board 2 is open once the ad is over
  await expect.poll(() => state(page).then((s) => s.modal === null && (s.remaining ?? 0) > 0)).toBe(true);
  expect((await state(page)).journey).toBe(1);
  // a break with no ad continues at once
  await page.evaluate(() => (window.__y8.mode = 'noAd'));
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=win-menu]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('title');
  expect(await calls(page)).toEqual(['start', 'next', 'next']);
  // Play again: no second start ad
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  expect(await calls(page)).toEqual(['start', 'next', 'next']);
  expect(await page.evaluate(() => window.__y8.calls.some((c) => c.startsWith('BEFORE-INIT')))).toBe(false);
  expect(errors).toEqual([]);
});

test('rewarded +1 hint: explained first; no ad → "No ad available right now, try later"; dismissed → nothing; viewed → the hint', async ({ page }) => {
  const { errors } = await boot(page);
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await expect(page.locator('[data-testid=hint] .badge')).toHaveText('+1');
  await page.click('[data-testid=hint]');
  const btn = page.locator('[data-testid=reward]');
  await expect(btn).toHaveText(/Watch an ad: \+1 hint/);
  await page.evaluate(() => (window.__y8.mode = 'noAd'));
  await btn.click();
  await expect(btn).toHaveText('No ad available right now, try later');
  await expect(btn).toBeEnabled({ timeout: 5000 });
  await page.evaluate(() => (window.__y8.mode = 'dismissed'));
  await btn.click();
  await expect(btn).toHaveText('No ad available right now, try later');
  await expect(btn).toBeEnabled({ timeout: 5000 });
  expect((await state(page)).hintsLeft).toBe(0);
  await page.evaluate(() => (window.__y8.mode = 'viewed'));
  await btn.click();
  await expect(btn).toHaveCount(0);
  expect((await state(page)).adPaused).toBe(false);
  expect((await calls(page)).filter((c) => c === 'reward')).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('hidden page / lost focus pauses and mutes the game; coming back resumes it', async ({ page }) => {
  const { errors } = await boot(page);
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => {
    document.hasFocus = () => false;
    window.dispatchEvent(new Event('blur'));
  });
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(true);
  expect((await state(page)).audio.silent).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(false);
  expect(errors).toEqual([]);
});

test('with the SDK blocked (ad blocker) the game plays a board, without rewarded buttons', async ({ page }) => {
  const { errors } = await boot(page, 'blocked');
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  await playPairs(page, 2);
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await expect(page.locator('[data-testid=hint] .badge')).toHaveText('0');
  await page.click('[data-testid=hint]');
  await page.waitForTimeout(300);
  expect(await page.locator('[data-testid=reward]').count()).toBe(0);
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((s) => s.journey)).toBe(1);
  expect(errors).toEqual([]);
});
