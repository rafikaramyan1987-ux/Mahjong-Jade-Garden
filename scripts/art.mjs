// Renders the store / review art from the real game (run `npm run build` first): node scripts/art.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'docs/art';
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4180);
const browser = await chromium.launch();

async function page(w, h, dpr, q = '', touch = false) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  await p.goto(url + '?fresh&' + q);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  return p;
}

async function shot(p, name) {
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${out}/${name}` });
  console.log('wrote', `${out}/${name}`);
  await p.close();
}

/** play n matches by clicking tiles, then select one free tile */
async function playSome(p, n, touch, board = 1) {
  await p.evaluate((k) => window.__mjg.setJourney(k - 1), board);
  await p.click('[data-testid=play]');
  await p.waitForSelector('[data-testid=tutorial]');
  for (let i = 0; i < 3; i++) await p.click('[data-testid=tut-next]');
  for (let k = 0; k < n; k++) {
    const pr = await p.evaluate(() => window.__mjg.pair());
    for (const [x, y] of pr) await (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    await p.waitForTimeout(40);
  }
  await p.waitForTimeout(500);
}

// 1. cover / title art 1920x1080
await shot(await page(1920, 1080, 1, 'shot=cover'), 'cover-1920x1080.png');
// 2. gameplay landscape 1920x1080 (1280x720 at 1.5x) and portrait 1080x1920 (540x960 at 2x)
{
  const p = await page(1280, 720, 1.5, 'seed=21');
  await playSome(p, 4, false, 22);
  const pr = await p.evaluate(() => window.__mjg.pair());
  await p.mouse.click(pr[0][0], pr[0][1]);
  await shot(p, 'gameplay-landscape-1920x1080.png');
}
{
  const p = await page(540, 960, 2, 'seed=21', true);
  await playSome(p, 4, true, 22);
  const pr = await p.evaluate(() => window.__mjg.pair());
  await p.touchscreen.tap(pr[0][0], pr[0][1]);
  await shot(p, 'gameplay-portrait-1080x1920.png');
}
// 3. the full tile set
await shot(await page(1920, 1080, 1, 'shot=tiles'), 'tile-set-1920x1080.png');
await shot(await page(1920, 1080, 1, 'shot=tiles-classic'), 'tile-set-classic-1920x1080.png');
await shot(await page(1920, 1080, 1, 'shot=tiles-contrast'), 'tile-set-classic-colorblind-1920x1080.png');
// 4. the garden journey (spring, 9 of 16 restored) and a later season
for (const [journey, name] of [
  [9, 'garden-journey-spring-1920x1080.png'],
  [16 * 2 + 12, 'garden-journey-autumn-1920x1080.png'],
  [16 * 3 + 16, 'garden-journey-winter-1920x1080.png'],
]) {
  const p = await page(1280, 720, 1.5);
  await p.evaluate((n) => window.__mjg.setJourney(n), journey);
  await p.click('[data-testid=garden]');
  await shot(p, name);
}
// 5. title screens and the board-cleared screen
await shot(await page(1280, 720, 1.5), 'title-landscape-1920x1080.png');
await shot(await page(540, 960, 2, '', true), 'title-portrait-1080x1920.png');
{
  const p = await page(1280, 720, 1.5, 'seed=21');
  await playSome(p, 2, false, 5);
  await p.evaluate(() => window.__mjg.solve());
  await p.waitForSelector('[data-testid=win]');
  await p.waitForTimeout(2600);
  await shot(p, 'board-cleared-1920x1080.png');
}
await browser.close();
close();
