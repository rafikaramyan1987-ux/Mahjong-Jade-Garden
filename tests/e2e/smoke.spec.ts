import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

async function boot(page: Page, query = '?fresh&seed=5') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + query);
  await page.waitForSelector('body[data-ready="1"]');
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__mjg.state());

async function tap(page: Page, x: number, y: number) {
  if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
async function matchPair(page: Page) {
  const pair = (await page.evaluate(() => window.__mjg.pair()))!;
  for (const [x, y] of pair) await tap(page, x, y);
}

test('a new player is in board 1 within 5 s: tutorial with the hand, a blocked tile, the helpers; never again after that', async ({ page }) => {
  const t0 = Date.now();
  const errors = await boot(page, '?seed=5');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  expect(Date.now() - t0).toBeLessThan(5000);
  // no title or text page before playing: the board, the goal (tiles left, progress, star target) and the tutorial
  await expect(page.locator('[data-testid=title-screen]')).toHaveCount(0);
  await expect(page.locator('[data-testid=goal]')).toBeVisible();
  await expect(page.locator('.progress')).toBeVisible();
  await expect(page.locator('[data-testid=tutorial]')).toBeVisible();
  await expect(page.locator('[data-testid=hand]')).toBeVisible();
  const tiles0 = (await state(page)).remaining!;
  expect(tiles0).toBeLessThanOrEqual(24);
  // step 1: match the pair the hand shows
  await matchPair(page);
  await expect.poll(() => state(page).then((s) => s.remaining)).toBe(tiles0 - 2);
  // step 2: a blocked tile is marked; tapping it gives a soft shake and moves on
  await expect.poll(() => state(page).then((s) => s.tutorial)).toBe(2);
  const b = (await page.evaluate(() => window.__mjg.blocked()))!;
  expect(b).not.toBeNull();
  await tap(page, b[0], b[1]);
  await expect.poll(() => state(page).then((s) => s.tutorial)).toBe(3);
  // step 3 goes away on its own (or with the next match)
  await matchPair(page);
  await expect(page.locator('[data-testid=tutorial]')).toHaveCount(0);
  expect((await state(page)).tutorialDone).toBe(true);
  // the tutorial is never shown again
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]');
  await expect(page.locator('[data-testid=title-screen]')).toBeVisible();
  await page.click('[data-testid=play]');
  await expect(page.locator('[data-testid=tutorial]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the tutorial can be skipped at once', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=tut-skip]');
  await expect(page.locator('[data-testid=tutorial]')).toHaveCount(0);
  expect((await state(page)).tutorialDone).toBe(true);
});

test('quick matches build a combo with a label; clearing the board shows the animated star screen; next board', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-testid=tut-skip]');
  await matchPair(page);
  await matchPair(page);
  await expect(page.locator('[data-testid=combo]').first()).toBeVisible();
  const s = await state(page);
  expect(s.combo).toBeGreaterThanOrEqual(2);
  expect(s.comboSecs).toBeGreaterThan(0);
  expect(s.score).toBeGreaterThan(20);
  // hint and undo work
  await page.click('[data-testid=hint]');
  const r = (await state(page)).remaining!;
  await page.click('[data-testid=undo]');
  await expect.poll(() => state(page).then((x) => x.remaining)).toBe(r + 2);
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid=win]')).toHaveAttribute('data-stars', '3');
  await expect(page.locator('[data-testid=win] .stars span.on')).toHaveCount(3);
  await expect.poll(() => page.locator('[data-testid=win-score]').innerText().then(Number)).toBeGreaterThan(0);
  expect((await state(page)).journey).toBe(1);
  await page.click('[data-testid=next]');
  await expect.poll(() => state(page).then((x) => x.remaining)).toBeGreaterThan(16);
  expect(errors).toEqual([]);
});

test('no moves left: Shuffle is offered automatically and is free once per board', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.evaluate(() => window.__mjg.stuck());
  await expect(page.locator('[data-testid=stuck]')).toBeVisible();
  const before = (await state(page)).shufflesLeft;
  await page.click('[data-testid=stuck-shuffle]');
  await expect.poll(() => state(page).then((s) => s.matches)).toBeGreaterThan(0);
  expect((await state(page)).shufflesLeft).toBe(before);
  // the second time it uses one of the board's shuffles
  await page.evaluate(() => window.__mjg.stuck());
  await expect(page.locator('[data-testid=stuck-shuffle]')).toContainText(String(before));
});

test('keyboard shortcuts by physical key: H hint, U undo, S shuffle, P pause; Escape does nothing', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.keyboard.press('KeyH');
  expect((await state(page)).hintsLeft).toBe(2);
  await matchPair(page);
  const r = (await state(page)).remaining!;
  await page.keyboard.press('KeyU');
  await expect.poll(() => state(page).then((s) => s.remaining)).toBe(r + 2);
  await page.keyboard.press('KeyS');
  expect((await state(page)).shufflesLeft).toBe(1);
  await page.keyboard.press('Escape');
  expect((await state(page)).modal).toBeNull();
  await page.keyboard.press('KeyP');
  await expect(page.locator('[data-testid=pause]')).toBeVisible();
  // Ctrl / Cmd combinations are never used
  await page.keyboard.press('Control+KeyH');
  expect((await state(page)).hintsLeft).toBe(2);
  await page.keyboard.press('KeyP');
  await expect(page.locator('[data-testid=pause]')).toHaveCount(0);
});

test('pause: Resume, Settings (back to pause), Main menu; main menu has Play, Journey, Daily, Settings', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.click('[data-testid=menu]');
  await page.click('[data-testid=pause-settings]');
  await expect(page.locator('[data-testid=settings-panel]')).toBeVisible();
  await page.click('[data-testid=settings-close]');
  await expect(page.locator('[data-testid=pause]')).toBeVisible();
  await page.click('[data-testid=to-menu]');
  for (const id of ['play', 'journey', 'daily', 'settings']) await expect(page.locator(`[data-testid=${id}]`)).toBeVisible();
  await expect(page.locator('[data-testid=play]')).toContainText('Continue');
  expect(errors).toEqual([]);
});

test('settings: music, sounds, language (saved), tile size, reset progress with confirmation', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.evaluate(() => window.__mjg.solve());
  await page.click('[data-testid=win-menu]');
  await page.click('[data-testid=settings]');
  await page.click('[data-testid=set-music]');
  await expect(page.locator('[data-testid=set-music]')).toHaveAttribute('aria-checked', 'false');
  expect((await state(page)).audio.music).toBe(false);
  // language
  await page.selectOption('[data-testid=lang]', 'de');
  await expect(page.locator('[data-testid=play]')).toContainText('Spielen');
  expect((await state(page)).lang).toBe('de');
  await page.selectOption('[data-testid=lang]', 'en');
  // tile size: large zooms the board in
  await page.click('[data-testid=size-large]');
  await page.click('[data-testid=settings-close]');
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  // reset progress, after a confirmation
  await page.click('[data-testid=menu]');
  await page.click('[data-testid=to-menu]');
  await page.click('[data-testid=settings]');
  await page.click('[data-testid=reset]');
  await page.click('[data-testid=reset-no]');
  await expect(page.locator('[data-testid=settings-panel]')).toBeVisible();
  expect((await state(page)).journey).toBe(1);
  await page.click('[data-testid=reset]');
  await page.click('[data-testid=reset-yes]');
  expect((await state(page)).journey).toBe(0);
  expect(errors).toEqual([]);
});

test('large tiles: the board starts zoomed in and can be fitted again', async ({ page }) => {
  await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.evaluate(() => window.__mjg.setJourney(40));
  await page.click('[data-testid=menu]');
  await page.click('[data-testid=pause-settings]');
  await page.click('[data-testid=size-large]');
  await page.click('[data-testid=settings-close]');
  await page.click('[data-testid=to-menu]');
  await page.click('[data-testid=play]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  const s = await state(page);
  if (s.tileWidth! < 84) {
    expect(s.zoom).toBeGreaterThan(1);
    await page.click('.fit-btn');
    expect((await state(page)).zoom).toBe(1);
  }
});

test('journey: the garden blooms after a win; finished boards can be replayed; statistics; daily challenge medal', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-testid=tut-skip]');
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  await page.click('[data-testid=win-journey]');
  await expect(page.locator('[data-testid=journey-screen]')).toBeVisible();
  await expect(page.locator('[data-testid=bloom]')).toBeVisible();
  await expect(page.locator('[data-testid=board-1]')).toHaveClass(/done/);
  await expect(page.locator('[data-testid=board-2]')).toHaveClass(/next/);
  await expect(page.locator('[data-testid=board-3]')).toBeDisabled();
  await expect(page.locator('[data-testid=board-1] .mini-stars i.on')).not.toHaveCount(0);
  await page.click('[data-testid=stats]');
  await expect(page.locator('[data-testid=stats-panel]')).toBeVisible();
  await page.locator('[data-testid=stats-panel] .btn').click();
  // replay board 1
  await page.click('[data-testid=board-1]');
  await expect.poll(() => state(page).then((s) => s.screen)).toBe('board');
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible();
  expect((await state(page)).journey).toBe(1);
  await page.click('[data-testid=win-menu]');
  await expect(page.locator('[data-testid=play]')).toContainText('2');
  // daily challenge: a medal, a personal best and the streak
  await page.click('[data-testid=daily]');
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=medal-gold]')).toBeVisible();
  await page.click('[data-testid=win-menu]');
  await expect(page.locator('[data-testid=daily-note]')).toContainText('✓');
  // nothing overflows the viewport horizontally
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
