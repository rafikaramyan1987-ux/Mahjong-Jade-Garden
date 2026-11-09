import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

declare global {
  interface Window {
    __ads: string[];
    __adMode: 'ok' | 'fail' | 'hang';
  }
}

/** a stand-in for html5.api.gamedistribution.com/main.min.js that follows the real SDK's event order */
const FAKE_SDK = `
window.__ads = [];
window.__adMode = 'ok';
window.gdsdk = {
  showAd(type) {
    window.__ads.push(type || 'interstitial');
    const o = window.GD_OPTIONS;
    if (window.__adMode === 'fail') return Promise.reject(new Error('no fill'));
    if (window.__adMode === 'hang') return new Promise(() => {});
    o.onEvent({ name: 'SDK_GAME_PAUSE' });
    return new Promise((res) => setTimeout(() => {
      if (type === 'rewarded') o.onEvent({ name: 'SDK_REWARDED_WATCH_COMPLETE' });
      o.onEvent({ name: 'SDK_GAME_START' });
      res();
    }, 400));
  },
};`;

async function boot(page: Page, sdk: 'fake' | 'blocked' = 'fake') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://html5.api.gamedistribution.com/main.min.js', (r) =>
    sdk === 'blocked' ? r.abort() : r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }),
  );
  await page.goto('/?fresh');
  await page.waitForSelector('body[data-ready="1"]');
  return errors;
}

const ads = (page: Page) => page.evaluate(() => window.__ads.slice());
const state = (page: Page) => page.evaluate(() => window.__mjg.state());

test('GD_OPTIONS uses the build game id and the SDK script is loaded once', async ({ page }) => {
  await boot(page);
  const info = await page.evaluate(() => ({ id: window.GD_OPTIONS?.gameId, n: document.querySelectorAll('script[src*="gamedistribution"]').length }));
  expect(info.id).toBe('2708776451364ee68eca7c869f5371e0');
  expect(info.n).toBe(1);
});

test('pre-roll on Play (once), no interstitial before the 3rd board, then at most one per 2 minutes', async ({ page }) => {
  await page.clock.install();
  const errors = await boot(page);
  await page.click('[data-testid=play]');
  await expect.poll(() => ads(page)).toEqual(['interstitial']);
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  // boards 1 and 2: Next starts the next board without an ad
  for (let b = 1; b <= 2; b++) {
    await page.evaluate(() => window.__mjg.solve());
    await expect(page.locator('[data-testid=win]')).toBeVisible();
    await page.click('[data-testid=next]');
    await expect.poll(() => state(page).then((s) => s.journey)).toBe(b);
    await page.waitForTimeout(600);
    expect(await ads(page)).toEqual(['interstitial']);
  }
  // board 3 cleared, but less than 2 minutes since the pre-roll: no ad yet
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=next]');
  await page.waitForTimeout(600);
  expect(await ads(page)).toEqual(['interstitial']);
  // board 4 cleared more than 2 minutes later: Next shows an interstitial, the game pauses and continues after it
  await page.clock.fastForward(125_000);
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=next]');
  await expect.poll(() => ads(page)).toEqual(['interstitial', 'interstitial']);
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(false);
  await expect.poll(() => state(page).then((s) => s.remaining)).toBeGreaterThan(16);
  // right after that ad: the next board change shows none (rate limit)
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=next]');
  await page.waitForTimeout(600);
  expect(await ads(page)).toEqual(['interstitial', 'interstitial']);
  // Menu then Play again: no second pre-roll
  await page.click('[data-testid=menu]');
  await page.click('[data-testid=to-menu]');
  await page.click('[data-testid=play]');
  await page.waitForTimeout(600);
  expect(await ads(page)).toEqual(['interstitial', 'interstitial']);
  expect(errors).toEqual([]);
});

test('rewarded ad gives an extra shuffle only after the watch-complete event', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  await page.click('[data-testid=shuffle]');
  await page.click('[data-testid=shuffle]');
  expect((await state(page)).shufflesLeft).toBe(0);
  await page.click('[data-testid=shuffle]');
  await expect(page.locator('[data-testid=reward]')).toBeVisible();
  const before = await page.evaluate(() => window.__ads.length);
  await page.click('[data-testid=reward]');
  await expect.poll(() => ads(page).then((a) => a.slice(before))).toEqual(['rewarded']);
  // reward granted and used at once: the panel closes, still 0 left, the board was shuffled
  await expect(page.locator('[data-testid=reward]')).toHaveCount(0);
  expect((await state(page)).shufflesLeft).toBe(0);
});

test('no ad: the button says so for 2.5 s, then works again; settles after 8 s if nothing starts', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  await page.evaluate(() => (window.__adMode = 'fail'));
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await page.click('[data-testid=hint]');
  const btn = page.locator('[data-testid=reward]');
  const label = await btn.innerText();
  await btn.click();
  await expect(btn).toHaveText('No ad available right now, try later');
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveText(label, { timeout: 4000 });
  await expect(btn).toBeEnabled();
  expect((await state(page)).hintsLeft).toBe(0);
  // an ad that never starts: settles by itself after 8 s
  await page.evaluate(() => (window.__adMode = 'hang'));
  const t0 = Date.now();
  await btn.click();
  await expect(btn).toHaveText('No ad available right now, try later', { timeout: 10000 });
  expect(Date.now() - t0).toBeGreaterThan(7000);
  await expect(btn).toBeEnabled({ timeout: 4000 });
});

test('the game stays fully playable when the SDK cannot load', async ({ page }) => {
  const errors = await boot(page, 'blocked');
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.skipTutorial());
  const pair = (await page.evaluate(() => window.__mjg.pair()))!;
  const r0 = (await state(page)).remaining!;
  for (const [x, y] of pair) {
    if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  }
  await expect.poll(() => state(page).then((s) => s.remaining)).toBe(r0 - 2);
  for (let i = 0; i < 4; i++) await page.click('[data-testid=hint]');
  await page.click('[data-testid=reward]');
  await expect(page.locator('[data-testid=reward]')).toHaveText('No ad available right now, try later');
  await page.locator('.panel .btn', { hasText: 'Close' }).click();
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((s) => s.journey)).toBe(1);
  expect(errors).toEqual([]);
});

test('rewarded extras: "Watch an ad: +1" for Hint, Undo and a rewarded Continue when stuck', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  // hints run out -> the hint button offers a rewarded +1
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await expect(page.locator('[data-testid=hint] .badge')).toHaveText('+1');
  await page.click('[data-testid=hint]');
  await expect(page.locator('[data-testid=reward]')).toHaveText(/Watch an ad: \+1 Hint/);
  await page.click('[data-testid=reward]');
  await expect.poll(() => ads(page).then((a) => a.at(-1))).toBe('rewarded');
  await expect(page.locator('[data-testid=reward]')).toHaveCount(0);
  // undos run out -> rewarded +1 Undo
  for (let k = 0; k < 6; k++) {
    const pr = (await page.evaluate(() => window.__mjg.pair()))!;
    for (const [x, y] of pr) {
      if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
  }
  for (let i = 0; i < 5; i++) await page.click('[data-testid=undo]');
  expect((await state(page)).undosLeft).toBe(0);
  await page.click('[data-testid=undo]');
  await expect(page.locator('[data-testid=reward]')).toHaveText(/Watch an ad: \+1 Undo/);
  const before = (await state(page)).remaining!;
  await page.click('[data-testid=reward]');
  await expect.poll(() => state(page).then((s) => s.remaining)).toBe(before + 2);
  // no shuffles left and stuck -> rewarded Continue
  await page.click('[data-testid=shuffle]');
  await page.click('[data-testid=shuffle]');
  await page.evaluate(() => window.__mjg.stuck());
  await expect(page.locator('[data-testid=reward-continue]')).toHaveText(/Watch an ad: Continue/);
  await page.click('[data-testid=reward-continue]');
  await expect(page.locator('[data-testid=stuck]')).toHaveCount(0);
  expect((await state(page)).matches).toBeGreaterThan(0);
});
