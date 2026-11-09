// GamePix submission: node scripts/submission-gamepix.mjs   (runs `npm run build:gamepix` first)
// -> submission-gamepix/mahjong-jade-garden-gamepix-v1.zip  (index.html at the root of the zip, single-file build)
// -> submission-gamepix/icon-512x512.png, cover-1280x720.png  (the game's own cover renderer, GamePix art)
// -> submission-gamepix/gameplay-gamepix-1280x720.mp4  (start, one board, a rewarded ad, the local fake interstitial;
//    the real GamePix SDK in its local simulation mode, so it needs integration.gamepix.com)
// Pass --no-video to skip the recording.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const OUT = 'submission-gamepix';
const ZIP = `${OUT}/mahjong-jade-garden-gamepix-v1.zip`;
mkdirSync(OUT, { recursive: true });
execFileSync('npm', ['run', 'build:gamepix'], { stdio: 'inherit' });

// zip: index.html at the root, nothing else (single-file build)
rmSync(ZIP, { force: true });
execFileSync('zip', ['-j', '-X', '-9', ZIP, 'dist-gamepix/index.html']);
console.log(`wrote ${ZIP} (${(statSync(ZIP).size / 1024).toFixed(0)} KB)`);
execFileSync('node', ['scripts/check-gamepix-zip.mjs', ZIP], { stdio: 'inherit' });

const { url, close } = await serve(4189, 'gamepix');
const browser = await chromium.launch();

// icon and cover from the game's own cover renderer (the SDK is not needed for art)
for (const [w, h, file, q] of [
  [512, 512, 'icon-512x512.png', '&notag'],
  [1280, 720, 'cover-1280x720.png', ''],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.route('https://integration.gamepix.com/**', (r) => r.abort());
  await p.goto(`${url}?shot=cover${q}`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${file}` });
  console.log('wrote', `${OUT}/${file}`);
  await p.close();
}

if (!process.argv.includes('--no-video')) {
  // a soft ring where the player taps, so viewers can follow the moves
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
  const tmp = resolve(OUT, '.video');
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
  await ctx.addInitScript(RIPPLE);
  const p = await ctx.newPage();
  const tap = (x, y) => p.mouse.click(x, y);
  const tapSel = async (sel) => {
    const b = await p.locator(sel).boundingBox();
    await tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const playPair = async (gap = 300) => {
    const pr = await p.evaluate(() => window.__mjg.pair());
    if (!pr) return false;
    await tap(...pr[0]);
    await p.waitForTimeout(gap);
    await tap(...pr[1]);
    await p.waitForTimeout(gap + 120);
    return true;
  };
  // the local SDK simulation: rewarded ads succeed, interstitials show the fake ad overlay
  await p.goto(url + '?fresh&seed=7&gpx_reward=success');
  await p.waitForSelector('body[data-ready="1"]');
  // three boards already cleared, so the between-board interstitial is allowed (game rule)
  await p.evaluate(() => {
    window.__mjg.demoProgress(3);
    // redraw the title so Play shows board 4
    window.__mjg.showJourney();
    (document.querySelector('[data-testid=back]'))?.click();
  });
  await p.waitForTimeout(2500);
  await tapSel('[data-testid=play]');
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__mjg.skipTutorial());
  await p.waitForTimeout(800);
  for (let k = 0; k < 3; k++) await playPair();
  // three hints, then the rewarded offer for one more
  for (let k = 0; k < 3; k++) {
    await tapSel('[data-testid=hint]');
    await p.waitForTimeout(900);
    await playPair(250);
  }
  await tapSel('[data-testid=hint]');
  await p.waitForSelector('[data-testid=offer-hint]');
  await p.waitForTimeout(1800);
  await tapSel('[data-testid=reward]');
  await p.waitForTimeout(1600);
  for (;;) {
    const s = await p.evaluate(() => window.__mjg.state());
    if (s.modal === 'win' || !s.remaining) break;
    if (s.modal === 'stuck') {
      await tapSel('[data-testid=stuck] .btn.primary');
      await p.waitForTimeout(500);
      continue;
    }
    if (!(await playPair(220))) break;
  }
  await p.waitForSelector('[data-testid=win]');
  await p.waitForTimeout(3500);
  // Next: the between-board interstitial (the SDK's fake ad locally, about 12 s)
  await tapSel('[data-testid=next]');
  await p.waitForTimeout(1000);
  await p.waitForFunction(() => !window.__mjg.state().adPaused, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  await ctx.close();
  const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  const mp4 = `${OUT}/gameplay-gamepix-1280x720.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, webm), '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'medium', '-movflags', '+faststart', '-an', mp4]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${mp4} (${(statSync(mp4).size / 1024 / 1024).toFixed(1)} MB)`);
}
await browser.close();
close();
