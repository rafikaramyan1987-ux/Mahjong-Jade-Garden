import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';


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
  const r0 = (await page.evaluate(() => window.__mjg.state().remaining))!;
  const pair = await page.evaluate(() => window.__mjg.pair());
  expect(pair).not.toBeNull();
  for (const [x, y] of pair!) await tap(page, x, y);
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBe(r0 - 2);
  await expect.poll(() => page.evaluate(() => window.__mjg.state().tutorial)).toBe(2);
  await page.click('[data-testid=tut-next]');
  await page.click('[data-testid=tut-next]');
  await expect(page.locator('[data-testid=tutorial]')).toHaveCount(0);
  // hint and undo work
  await page.click('[data-testid=hint]');
  await page.click('[data-testid=undo]');
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBe(r0);
  // every tile on the board is reachable: play it out
  await page.evaluate(() => window.__mjg.solve());
  await expect(page.locator('[data-testid=win]')).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => window.__mjg.state().journey)).toBe(1);
  await page.click('[data-testid=next]');
  await expect.poll(() => page.evaluate(() => window.__mjg.state().remaining)).toBeGreaterThan(40);
  expect(await page.evaluate(() => window.__mjg.state().journey)).toBe(1);
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
