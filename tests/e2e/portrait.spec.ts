import { expect, test } from '@playwright/test';
import type {} from '../shared/hooks';

/** board numbers (1-based): every season, and the explicit checks for boards 1, 32 and 64 */
const PORTRAIT_BOARDS = [1, 5, 10, 16, 21, 32, 40, 48, 53, 60, 64];
const KEY_BOARDS = [1, 32, 64];

async function open(page: import('@playwright/test').Page, board: number) {
  await page.goto('/?fresh');
  await page.waitForSelector('body[data-ready="1"]');
  await page.evaluate((k) => window.__mjg.setJourney(k - 1), board);
  await page.click('[data-testid=play]');
  await page.evaluate(() => window.__mjg.skipTutorial());
  return (await page.evaluate(() => window.__mjg.fill()))!;
}

test('portrait 390x844: tiles >= 56 px on every board, the board fills the width and the space between the bars', async ({ page }, info) => {
  test.skip(info.project.name !== 'portrait', 'portrait only');
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  for (const n of PORTRAIT_BOARDS) {
    const f = await open(page, n);
    expect(await page.evaluate(() => window.__mjg.state().variant), `board ${n}`).toBe('portrait');
    expect(f.tileWidth, `board ${n} tile width`).toBeGreaterThanOrEqual(56);
    // small side margins only: the free area is the screen width minus ~8 px on each side
    expect(f.area.x).toBeLessThanOrEqual(8);
    expect(f.area.w).toBeGreaterThanOrEqual(390 - 16);
    // the board reaches (almost) the full width or the full height of the free area, and stays inside it
    const used = Math.max(f.box.w / f.area.w, f.box.h / f.area.h);
    expect(used, `board ${n} fill`).toBeGreaterThan(0.86);
    expect(f.box.x).toBeGreaterThanOrEqual(f.area.x - 2);
    expect(f.box.y).toBeGreaterThanOrEqual(f.area.y - 2);
    expect(f.box.x + f.box.w).toBeLessThanOrEqual(f.area.x + f.area.w + 2);
    expect(f.box.y + f.box.h).toBeLessThanOrEqual(f.area.y + f.area.h + 2);
  }
});

for (const n of KEY_BOARDS)
  test(`board ${n}: minimum tile size (56 px on 390x844 portrait, 64 px on 1280x720 landscape)`, async ({ page }, info) => {
    const f = await open(page, n);
    if (info.project.name === 'portrait') expect(f.tileWidth).toBeGreaterThanOrEqual(56);
    else expect(f.tileWidth).toBeGreaterThanOrEqual(64);
  });
