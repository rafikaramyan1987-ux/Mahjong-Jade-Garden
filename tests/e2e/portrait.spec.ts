import { expect, test } from '@playwright/test';
import type {} from '../shared/hooks';


// boards from every season, including the largest (144 tiles) and the tallest stacks
const BOARDS = [0, 4, 8, 15, 20, 31, 40, 47, 52, 58, 62, 63];

test('portrait 390x844: tiles at least 34 px wide and the board fills the space between the bars', async ({ page }, info) => {
  test.skip(info.project.name !== 'portrait', 'portrait only');
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  for (const n of BOARDS) {
    await page.goto('/?fresh');
    await page.waitForSelector('body[data-ready="1"]');
    await page.evaluate((k) => window.__mjg.setJourney(k), n);
    await page.click('[data-testid=play]');
    await page.evaluate(() => window.__mjg.skipTutorial());
    const f = (await page.evaluate(() => window.__mjg.fill()))!;
    expect(await page.evaluate(() => window.__mjg.state().variant), `board ${n + 1}`).toBe('portrait');
    expect(f.tileWidth, `board ${n + 1} tile width`).toBeGreaterThanOrEqual(34);
    // the board reaches (almost) the full width or the full height of the free area, and stays inside it
    const used = Math.max(f.box.w / f.area.w, f.box.h / f.area.h);
    expect(used, `board ${n + 1} fill`).toBeGreaterThan(0.86);
    expect(f.box.x).toBeGreaterThanOrEqual(f.area.x - 2);
    expect(f.box.y).toBeGreaterThanOrEqual(f.area.y - 2);
    expect(f.box.x + f.box.w).toBeLessThanOrEqual(f.area.x + f.area.w + 2);
    expect(f.box.y + f.box.h).toBeLessThanOrEqual(f.area.y + f.area.h + 2);
  }
});
