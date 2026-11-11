// Y8 media (docs.y8.com/studio/media), all into submission-y8/media/, rendered from the real game (the Y8 build with
// its SDK blocked, so no ad ever covers the game):
//  - screenshot-760x570-{1..4}.jpg (Standard Screenshot) and screenshot-1280x720-{1..4}.jpg (Widescreen Screenshot):
//    the same four moments at both sizes, each laid out natively at its size (rendered at 2x, then downscaled)
//      1. Journey board 22 in play, a tile picked   2. a combo on board 10   3. a cleared board with its stars
//      4. the garden journey map (spring)
//  - promo-landscape-1920x1080.jpg, promo-portrait-1080x1920.jpg, promo-card-760x570.jpg: the game's cover art with its
//    logo (src/art/cover.ts, `?shot=cover`), laid out natively at each size
//  - gameplay-1280x720.mp4 and gameplay-960x720.mp4: one scripted take of real play (every move a real click on the
//    tile, the next pair from the game's own hint solver, seeded deal), recorded at each size: board 10 from its first
//    move, a hint, combos, the board cleared with its stars around 14 s, then Next and the start of board 11. No intro,
//    no menus, no sound. 26 s.
// Usage: node scripts/y8/media.mjs [--only shots,promos,video]   (runs `npm run build:y8` first)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : ['shots', 'promos', 'video'];
const OUT = 'submission-y8/media';
const MB = 1024 * 1024;
mkdirSync(OUT, { recursive: true });
execFileSync('npm', ['run', 'build:y8'], { stdio: 'inherit' });
const { url, close } = await serve(4186, 'y8');
const browser = await chromium.launch();

const jpg = (png, out, w, h, limit) => {
  execFileSync('convert', [png, '-filter', 'Lanczos', '-resize', `${w}x${h}!`, '-strip', '-sampling-factor', '4:2:0', '-quality', '90', '-interlace', 'JPEG', out]);
  rmSync(png);
  const s = statSync(out).size;
  if (s >= limit) throw new Error(`${out}: ${s} bytes, limit ${limit}`);
  console.log(`wrote ${out} (${(s / 1024).toFixed(0)} KB)`);
};

async function open(w, h, dpr, q = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  // no SDK: no ads in the pictures
  await p.route('https://cdn.y8.com/**', (r) => r.abort());
  await p.goto(`${url}?fresh&menu&${q}`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  return { ctx, p };
}
/** Journey board n (1-based), tutorial done */
async function board(p, n) {
  await p.evaluate((k) => {
    window.__mjg.setJourney(k - 1);
    window.__mjg.showTitle();
  }, n);
  await p.click('[data-testid=play]');
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__mjg.skipTutorial());
  await p.waitForTimeout(500);
}
async function match(p, gap = 40) {
  const pr = await p.evaluate(() => window.__mjg.pair());
  if (!pr) return false;
  for (const [x, y] of pr) {
    await p.mouse.click(x, y);
    await p.waitForTimeout(gap);
  }
  return true;
}

const MOMENTS = [
  async (p) => {
    await board(p, 22);
    for (let k = 0; k < 4; k++) await match(p);
    await p.waitForTimeout(600);
    const pr = await p.evaluate(() => window.__mjg.pair());
    await p.mouse.click(pr[0][0], pr[0][1]);
    await p.waitForTimeout(400);
  },
  async (p) => {
    await board(p, 10);
    for (let k = 0; k < 4; k++) await match(p, 120);
    await p.waitForTimeout(250);
  },
  async (p) => {
    await board(p, 5);
    for (let k = 0; k < 2; k++) await match(p);
    await p.evaluate(() => window.__mjg.setTime(94));
    await p.evaluate(() => window.__mjg.solve());
    await p.waitForSelector('[data-testid=win]');
    await p.waitForTimeout(2600);
  },
  async (p) => {
    await p.evaluate(() => window.__mjg.setJourney(9));
    await p.click('[data-testid=journey]');
    await p.locator('.season-banner:not([disabled])').last().click();
    await p.waitForTimeout(800);
  },
];

if (only.includes('shots'))
  for (const [w, h, limit] of [
    [1280, 720, 5 * MB],
    [760, 570, 2 * MB],
  ])
    for (const [i, run] of MOMENTS.entries()) {
      const { ctx, p } = await open(w, h, 2, 'seed=21');
      await run(p);
      const png = `${OUT}/.tmp.png`;
      await p.screenshot({ path: png });
      await ctx.close();
      jpg(png, `${OUT}/screenshot-${w}x${h}-${i + 1}.jpg`, w, h, limit);
    }

if (only.includes('promos'))
  for (const [w, h, file, limit] of [
    [1920, 1080, 'promo-landscape-1920x1080.jpg', 5 * MB],
    [1080, 1920, 'promo-portrait-1080x1920.jpg', 5 * MB],
    [760, 570, 'promo-card-760x570.jpg', 2 * MB],
  ]) {
    const dpr = w >= 1080 ? 1 : 2;
    const { ctx, p } = await open(w, h, dpr, 'shot=cover');
    const png = `${OUT}/.tmp.png`;
    await p.screenshot({ path: png });
    await ctx.close();
    jpg(png, `${OUT}/${file}`, w, h, limit);
  }

// a soft ring where the player clicks, so viewers can follow the moves
const RIPPLE = () => {
  addEventListener(
    'pointerdown',
    (e) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,236,170,.95);box-shadow:0 0 12px rgba(255,220,120,.8);pointer-events:none;z-index:99;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(d);
      requestAnimationFrame(() => {
        d.style.transform = 'scale(1.6)';
        d.style.opacity = '0';
      });
      setTimeout(() => d.remove(), 500);
    },
    true,
  );
};
const CLIP = 26;

async function record(w, h) {
  const out = resolve(OUT, `gameplay-${w}x${h}.mp4`);
  const tmp = resolve(OUT, `.frames-${w}x${h}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const { ctx, p } = await open(w, h, 1, 'seed=1987');
  await ctx.addInitScript(RIPPLE);
  await p.evaluate(RIPPLE);
  await board(p, 10);
  // CDP screencast: every painted frame with its timestamp
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h });
  const t0 = Date.now();
  await p.waitForTimeout(500);
  let k = 0;
  const playBoard = async (stopAt) => {
    for (;;) {
      if (Date.now() - t0 > stopAt * 1000) return;
      const s = await p.evaluate(() => window.__mjg.state());
      if (s.modal === 'win' || !s.remaining) return;
      if (s.modal === 'stuck') {
        await p.click('[data-testid=stuck-shuffle]');
        await p.waitForTimeout(600);
        continue;
      }
      k++;
      if (k === 6) {
        // a hint, then the glowing pair
        await p.click('[data-testid=hint]');
        await p.waitForTimeout(1000);
      }
      const pr = await p.evaluate(() => window.__mjg.pair());
      if (!pr) return;
      await p.mouse.click(...pr[0]);
      await p.waitForTimeout(170);
      await p.mouse.click(...pr[1]);
      await p.waitForTimeout(k === 6 ? 500 : 250);
    }
  };
  await playBoard(CLIP);
  await p.waitForSelector('[data-testid=win]');
  console.log(`  ${w}x${h}: board cleared at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.waitForTimeout(4200);
  await p.click('[data-testid=next]');
  await p.waitForTimeout(900);
  await playBoard(CLIP + 0.5);
  while (Date.now() - t0 < (CLIP + 1) * 1000) await p.waitForTimeout(100);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`).join('\n');
  writeFileSync(join(tmp, 'list.txt'), `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-t', String(CLIP), '-vf', `fps=30,scale=${w}:${h}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', '-an', out]);
  rmSync(tmp, { recursive: true, force: true });
  const s = statSync(out).size;
  if (s >= 50 * MB) throw new Error(`${out}: ${s} bytes (limit 50 MB)`);
  console.log(`wrote ${out} (${(s / MB).toFixed(1)} MB, ${CLIP} s)`);
}
if (only.includes('video')) {
  await record(1280, 720);
  await record(960, 720);
}
await browser.close();
close();
