import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __mjg: {
      state(): { screen: string; modal: string | null; remaining: number | null; matches: number | null; journey: number; tutorial: number };
      pair(): [number, number][] | null;
      solve(leave?: number): boolean;
    };
  }
}

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=5');
  await page.waitForSelector('body[data-ready="1"]');
  return errors;
}

async function tap(page: Page, x: number, y: number) {
  if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('title → tutorial → match tiles → clear the board → next board', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('[data-testid=play]')).toBeVisible();
  await page.click('[data-testid=play]');
  await expect(page.locator('[data-testid=tutorial]')).toBeVisible();
  // step 1: match the glowing pair by tapping the tiles
  const pair = await page.evaluate(() => window.__mjg.pair());
  expect(pair).not.toBeNull();
  for (const [x, y] of pair!) await tap(page, x, y);
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBe(142);
  await expect.poll(() => page.evaluate(() => window.__mjg.state().tutorial)).toBe(2);
  await page.click('[data-testid=tut-next]');
  await page.click('[data-testid=tut-next]');
  await expect(page.locator('[data-testid=tutorial]')).toHaveCount(0);
  // hint and undo work
  await page.click('[data-testid=hint]');
  await page.click('[data-testid=undo]');
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBe(144);
  // every tile on the board is reachable: play it out
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => window.__mjg.state().journey)).toBe(1);
  await page.click('[data-testid=next]');
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBe(144);
  expect(errors).toEqual([]);
});

test('menus: settings, statistics, garden, language', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-testid=settings]');
  await expect(page.locator('[data-testid=settings-panel]')).toBeVisible();
  await page.click('[data-testid=lang-fr]');
  await expect(page.locator('[data-testid=play]')).toContainText('Jouer');
  await page.click('[data-testid=lang-en]');
  await page.keyboard.press('Escape');
  await page.locator('.panel .btn', { hasText: 'Close' }).click();
  await page.click('[data-testid=stats]');
  await expect(page.locator('[data-testid=stats-panel]')).toBeVisible();
  await page.locator('.panel .btn', { hasText: 'Close' }).click();
  await page.click('[data-testid=garden]');
  await expect(page.locator('[data-testid=garden-screen]')).toBeVisible();
  await page.click('[data-testid=back]');
  await expect(page.locator('[data-testid=play]')).toBeVisible();
  // nothing overflows the viewport horizontally
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
