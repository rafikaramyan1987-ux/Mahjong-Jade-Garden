// CrazyGames trailers (v2) from real play of the web build (run `npm run build` first):
//   node scripts/trailer.mjs [outDir]  ->  trailer-1920x1080.mp4, trailer-1080x1920.mp4  (about 18 s, no sound)
// The first frame is the cover (rendered by the game at the trailer's size); then a brand-new player: the first
// seconds of the tutorial (the hand, the blocked tile), a fast combo chain that clears board 1, the 3-star result
// screen and the journey map where the restored garden element blooms.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { RIPPLE, encode, startCapture } from './capture.mjs';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'submission';
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4186);
const browser = await chromium.launch();

async function cover(viewport, dpr, file) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: dpr });
  await p.goto(`${url}?shot=cover&cg`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: file, type: 'jpeg', quality: 95 });
  await p.close();
}

async function trailer(name, viewport, dpr, touch) {
  const W = viewport.width * dpr;
  const H = viewport.height * dpr;
  const tmp = resolve(out, '.tmp-' + name);
  const still = resolve(out, `.cover-${name}.jpg`);
  await cover(viewport, dpr, still);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(RIPPLE);
  const p = await ctx.newPage();
  const tap = async (x, y) => (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  const tapSel = async (sel) => {
    const b = await p.locator(sel).boundingBox();
    await tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  // a brand-new player: straight into board 1 with the tutorial
  await p.goto(url + '?fresh');
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(250);
  const cap = await startCapture(ctx, p, tmp, W, H);
  const t0 = Date.now();
  const mark = (what) => console.log(`  ${name} ${((Date.now() - t0) / 1000 + 1).toFixed(1)} s: ${what}`);
  // the hand shows the pair
  await p.waitForTimeout(touch ? 2300 : 2700);
  let pr = await p.evaluate(() => window.__mjg.pair());
  await tap(...pr[0]);
  await p.waitForTimeout(260);
  await tap(...pr[1]);
  // the blocked tile is marked; tap it (a soft shake)
  await p.waitForTimeout(1000);
  const b = await p.evaluate(() => window.__mjg.blocked());
  if (b) await tap(...b);
  await p.waitForTimeout(500);
  // a fast combo chain clears the board
  for (;;) {
    const s = await p.evaluate(() => window.__mjg.state());
    if (s.modal === 'win' || !s.remaining) break;
    pr = await p.evaluate(() => window.__mjg.pair());
    if (!pr) break;
    await tap(...pr[0]);
    await p.waitForTimeout(120);
    await tap(...pr[1]);
    await p.waitForTimeout(260);
  }
  await p.waitForSelector('[data-testid=win]');
  mark('3-star result screen');
  // three stars pop in, the score counts up
  await p.waitForTimeout(touch ? 2800 : 3300);
  await tapSel('[data-testid=win-journey]');
  await p.waitForSelector('[data-testid=bloom]');
  mark('journey map, the garden blooms');
  // the journey map: the new garden element blooms
  await p.waitForTimeout(touch ? 3200 : 3600);
  const frames = await cap.stop();
  await ctx.close();
  encode(frames, { tmp, out: join(out, name + '.mp4'), W, H, still, stillSecs: 1.0, maxSecs: 18.5 });
  (await import('node:fs')).rmSync(still, { force: true });
}

await trailer('trailer-1920x1080', { width: 1280, height: 720 }, 1.5, false);
await trailer('trailer-1080x1920', { width: 540, height: 960 }, 2, true);
await browser.close();
close();
