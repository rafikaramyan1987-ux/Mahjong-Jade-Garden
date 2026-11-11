// GameMonetize thumbnails: the game's own cover / title scene (src/art/cover.ts, `?shot=cover&nologo`: the garden and
// the tile fan, NO title text and NO logo, as GameMonetize asks) rendered at 2x the three GameMonetize sizes, then
// downscaled to a JPG under 300 KB each.
//   node scripts/gamemonetize/images.mjs        (runs `npm run build:gamemonetize` first)
// Out: submission-gamemonetize/mahjong-jade-garden-{512x384,512x512,512x340}.jpg
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';

const OUT = 'submission-gamemonetize';
mkdirSync(OUT, { recursive: true });
execFileSync('npm', ['run', 'build:gamemonetize'], { stdio: 'inherit' });
const { url, close } = await serve(4185, 'gamemonetize');
const browser = await chromium.launch();
for (const [w, h] of [
  [512, 384],
  [512, 512],
  [512, 340],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // art only: the portal SDK is not needed
  await p.route('https://api.gamemonetize.com/**', (r) => r.abort());
  await p.goto(`${url}?shot=cover&nologo`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(400);
  const png = `${OUT}/.tmp-${w}x${h}.png`;
  await p.screenshot({ path: png });
  await p.close();
  const jpg = `${OUT}/mahjong-jade-garden-${w}x${h}.jpg`;
  execFileSync('convert', [png, '-filter', 'Lanczos', '-resize', `${w}x${h}!`, '-strip', '-sampling-factor', '4:2:0', '-quality', '90', '-interlace', 'JPEG', jpg]);
  rmSync(png);
  const size = statSync(jpg).size;
  if (size >= 300 * 1024) throw new Error(`${jpg}: ${size} bytes (limit 300 KB)`);
  console.log(`wrote ${jpg} (${(size / 1024).toFixed(0)} KB)`);
}
await browser.close();
close();
