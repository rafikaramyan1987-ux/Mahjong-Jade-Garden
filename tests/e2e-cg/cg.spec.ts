import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

declare global {
  interface Window {
    __cg: { calls: string[]; ads: string[]; store: Record<string, string>; mode: 'ok' | 'fail' | 'hang' };
  }
}

/** a stand-in for sdk.crazygames.com/crazygames-sdk-v3.js that records every call */
const FAKE_SDK = `
window.__cg = { calls: [], ads: [], store: {}, mode: 'ok' };
const rec = (n) => () => window.__cg.calls.push(n);
window.CrazyGames = { SDK: {
  environment: 'crazygames',
  init: () => Promise.resolve(),
  game: {
    gameplayStart: rec('gameplayStart'), gameplayStop: rec('gameplayStop'),
    loadingStart: rec('loadingStart'), loadingStop: rec('loadingStop'), happytime: rec('happytime'),
    settings: { muteAudio: false }, addSettingsChangeListener: () => {},
  },
  ad: { requestAd(type, cb) {
    window.__cg.ads.push(type);
    if (window.__cg.mode === 'fail') return setTimeout(() => cb.adError && cb.adError('no fill'), 50);
    if (window.__cg.mode === 'hang') return;
    cb.adStarted && cb.adStarted();
    setTimeout(() => cb.adFinished && cb.adFinished(), 300);
  } },
  data: { getItem: (k) => (k in window.__cg.store ? window.__cg.store[k] : null), setItem: (k, v) => { window.__cg.store[k] = v; } },
  user: { systemInfo: { locale: 'en-US' } },
} };`;

async function boot(page: Page, sdk: 'fake' | 'blocked' = 'fake') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', (r) =>
    sdk === 'blocked' ? r.abort() : r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }),
  );
  await page.goto('/');
  await page.waitForSelector('body[data-ready="1"]');
  return errors;
}
const calls = (p: Page) => p.evaluate(() => window.__cg.calls.slice());
const ads = (p: Page) => p.evaluate(() => window.__cg.ads.slice());
const state = (p: Page) => p.evaluate(() => window.__mjg.state());
const last = (a: string[], k: string[]) => a.filter((c) => k.includes(c)).at(-1);

test('SDK v3 lifecycle: loading, gameplay only during real play, happytime, Data Module saves, no pre-roll', async ({ page }) => {
  const errors = await boot(page);
  expect(await calls(page)).toEqual(['loadingStart', 'loadingStop']);
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  // no pre-roll on CrazyGames
  expect(await ads(page)).toEqual([]);
  await page.evaluate(() => window.__mjg.skipTutorial());
  await expect.poll(() => calls(page).then((c) => last(c, ['gameplayStart', 'gameplayStop']))).toBe('gameplayStart');
  // the pause menu stops gameplay, Resume starts it again
  await page.click('[data-testid=menu]');
  expect(last(await calls(page), ['gameplayStart', 'gameplayStop'])).toBe('gameplayStop');
  await page.click('[data-testid=resume]');
  expect(last(await calls(page), ['gameplayStart', 'gameplayStop'])).toBe('gameplayStart');
  // solving the board: happytime, gameplay stops on the result screen
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  const c = await calls(page);
  expect(c).toContain('happytime');
  expect(last(c, ['gameplayStart', 'gameplayStop'])).toBe('gameplayStop');
  // progress is stored in the Data Module
  await expect.poll(() => page.evaluate(() => Object.keys(window.__cg.store).length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => JSON.parse(Object.values(window.__cg.store)[0]).journey)).toBe(1);
  // menus are not gameplay
  await page.click('[data-testid=win-menu]');
  expect(last(await calls(page), ['gameplayStart', 'gameplayStop'])).toBe('gameplayStop');
  expect(errors).toEqual([]);
});

test('midgame only between boards: never before the 3rd board, at most one per 2 minutes', async ({ page }) => {
  await page.clock.install();
  await boot(page);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  for (let b = 1; b <= 3; b++) {
    await page.evaluate(() => window.__mjg.solve());
    await page.click('[data-testid=next]');
    await expect.poll(() => state(page).then((s) => s.journey)).toBe(b);
  }
  // 3 boards cleared: the Next after board 3 already qualifies (no pre-roll on CrazyGames)
  await expect.poll(() => ads(page)).toEqual(['midgame']);
  // the next board right after: no ad (2-minute gap); later one: an ad
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=next]');
  await page.waitForTimeout(500);
  expect(await ads(page)).toEqual(['midgame']);
  await page.clock.fastForward(125_000);
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=next]');
  await expect.poll(() => ads(page)).toEqual(['midgame', 'midgame']);
  await expect.poll(() => state(page).then((s) => s.adPaused)).toBe(false);
});

test('rewarded +1 Hint after the ad; "No ad available" for 2.5 s when there is none', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  for (let i = 0; i < 3; i++) await page.click('[data-testid=hint]');
  await page.click('[data-testid=hint]');
  const btn = page.locator('[data-testid=reward]');
  await expect(btn).toHaveText(/Watch an ad: \+1 Hint/);
  await page.evaluate(() => (window.__cg.mode = 'fail'));
  await btn.click();
  await expect(btn).toHaveText('No ad available right now, try later');
  await expect(btn).toBeEnabled({ timeout: 4000 });
  await page.evaluate(() => (window.__cg.mode = 'ok'));
  await btn.click();
  await expect(btn).toHaveCount(0);
  expect((await ads(page)).filter((a) => a === 'rewarded')).toHaveLength(2);
  // the hint was granted and used
  expect((await state(page)).hintsLeft).toBe(0);
});

test('the game stays fully playable when the SDK cannot load (localStorage saves)', async ({ page }) => {
  const errors = await boot(page, 'blocked');
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((s) => s.journey)).toBe(1);
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('mahjongjadegarden')))).toBe(true);
  expect(errors).toEqual([]);
});
