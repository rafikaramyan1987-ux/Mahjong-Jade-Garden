// The first 60 seconds of a brand-new player on a 390 x 844 phone (run `npm run build` first):
//   node scripts/first-minute.mjs [out]  ->  docs/media/first-minute-v2-390x844.mp4  (780 x 1688 pixels, no sound)
// Real taps at a human pace: loading, the tutorial inside board 1 (hand, blocked tile, helpers), board 1 with a
// combo, the result screen, board 2, its result screen.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { RIPPLE, encode, startCapture } from './capture.mjs';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'docs/media/first-minute-v2-390x844.mp4';
mkdirSync(dirname(out), { recursive: true });
const { url, close } = await serve(4185);
const browser = await chromium.launch();
const viewport = { width: 390, height: 844 };
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(RIPPLE);
const p = await ctx.newPage();
const tmp = resolve(dirname(out), '.tmp-first-minute');
const cap = await startCapture(ctx, p, tmp, 780, 1688);
const t0 = Date.now();
const tap = (x, y) => p.touchscreen.tap(x, y);
const tapSel = async (sel) => {
  const b = await p.locator(sel).boundingBox();
  await tap(b.x + b.width / 2, b.y + b.height / 2);
};
const pair = () => p.evaluate(() => window.__mjg.pair());
const play = async (gapIn, gapOut) => {
  const pr = await pair();
  if (!pr) return false;
  await tap(...pr[0]);
  await p.waitForTimeout(gapIn);
  await tap(...pr[1]);
  await p.waitForTimeout(gapOut);
  return true;
};
// loading: the player opens the game
await p.goto(url + '?fresh');
await p.waitForSelector('body[data-ready="1"]');
console.log(`in board 1 after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// tutorial: watch the hand, match the pair
await p.waitForTimeout(3200);
await play(700, 1800);
// the blocked tile: read the line, tap it
const b = await p.evaluate(() => window.__mjg.blocked());
await p.waitForTimeout(1200);
if (b) await tap(...b);
await p.waitForTimeout(2600);
// board 1: a calm start, then a quick run of matches (a combo)
let k = 0;
for (;;) {
  const s = await p.evaluate(() => window.__mjg.state());
  if (s.modal === 'win' || !s.remaining) break;
  if (s.modal === 'stuck') {
    await tapSel('[data-testid=stuck-shuffle]');
    continue;
  }
  k++;
  const quick = k >= 3 && k <= 6;
  if (!(await play(quick ? 220 : 650, quick ? 380 : 1500))) break;
}
await p.waitForSelector('[data-testid=win]');
await p.waitForTimeout(4200);
await tapSel('[data-testid=next]');
await p.waitForTimeout(1500);
// board 2, a little faster now, with one combo
k = 0;
while (Date.now() - t0 < 52000) {
  const s = await p.evaluate(() => window.__mjg.state());
  if (s.modal === 'win' || !s.remaining) break;
  if (s.modal === 'stuck') {
    await tapSel('[data-testid=stuck-shuffle]');
    continue;
  }
  k++;
  const quick = k >= 4 && k <= 6;
  if (!(await play(quick ? 220 : 900, quick ? 380 : 1900))) break;
}
// whatever is left of board 2 (keeps the video near 60 s)
while (!(await p.evaluate(() => window.__mjg.state().modal === 'win'))) if (!(await play(200, 330))) break;
await p.waitForSelector('[data-testid=win]');
await p.waitForTimeout(Math.max(3500, 60000 - (Date.now() - t0)));
const frames = await cap.stop();
await ctx.close();
encode(frames, { tmp, out, W: 780, H: 1688, maxSecs: 60, crf: 23 });
await browser.close();
close();
