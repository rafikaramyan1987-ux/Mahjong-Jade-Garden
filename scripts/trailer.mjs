// Trailers from the real game (CDP screencast, real taps), max 20 s:
//   node scripts/trailer.mjs [outDir]  ->  trailer-1920x1080.mp4, trailer-1080x1620.mp4   (run `npm run build` first)
// Shows the title, the illustrated Garden tiles, matches with the glow / sparkle effect, the board being cleared,
// the garden element restored on the result screen, and the Jade Garden journey.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'submission';
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4186);
const browser = await chromium.launch();

const RIPPLE = () => {
  addEventListener(
    'pointerdown',
    (e) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;left:${e.clientX - 24}px;top:${e.clientY - 24}px;width:48px;height:48px;border-radius:50%;border:4px solid rgba(255,236,170,.95);box-shadow:0 0 14px rgba(255,220,120,.8);pointer-events:none;z-index:99;transition:transform .45s ease-out,opacity .45s ease-out`;
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

async function trailer(name, viewport, dpr, touch, board) {
  const tmp = resolve(out, '.tmp-' + name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(RIPPLE);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const tap = async (x, y) => (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  const tapSel = async (sel) => {
    const b = await p.locator(sel).boundingBox();
    await tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  await p.goto(url + '?fresh&seed=88');
  await p.waitForSelector('body[data-ready="1"]');
  // a player a few boards into the journey, so the garden already has some colour
  await p.evaluate((n) => {
    window.__mjg.demoProgress(n);
    window.__mjg.skipTutorial();
    window.__mjg.showJourney();
  }, board - 1);
  // back to the title, now showing "Continue · Board n"
  await p.click('[data-testid=back]');
  await p.waitForTimeout(200);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: viewport.width * dpr, maxHeight: viewport.height * dpr });
  const t0 = Date.now();
  await p.waitForTimeout(1300);
  await tapSel('[data-testid=play]');
  await p.waitForTimeout(700);
  // clear the board with real taps on the tiles
  for (;;) {
    const s = await p.evaluate(() => window.__mjg.state());
    if (s.modal === 'win' || !s.remaining) break;
    const pr = await p.evaluate(() => window.__mjg.pair());
    if (!pr) break;
    await tap(...pr[0]);
    await p.waitForTimeout(200);
    await tap(...pr[1]);
    await p.waitForTimeout(260);
  }
  await p.waitForSelector('[data-testid=win]');
  // the restored garden element fades in on the result screen
  await p.waitForTimeout(2600);
  await p.evaluate(() => window.__mjg.showJourney());
  await p.waitForTimeout(1200);
  await p.click('[data-testid=back]');
  await p.click('[data-testid=garden]');
  await p.waitForTimeout(2000);
  const secs = (Date.now() - t0) / 1000;
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`).join('\n');
  writeFileSync(join(tmp, 'list.txt'), `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
  const mp4 = join(out, name + '.mp4');
  const W = viewport.width * dpr;
  const H = viewport.height * dpr;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-t', '20', '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', mp4]);
  rmSync(tmp, { recursive: true, force: true });
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  console.log(`wrote ${mp4} (${W}x${H}, ${Number(dur).toFixed(1)} s, captured ${secs.toFixed(1)} s)`);
}

await trailer('trailer-1920x1080', { width: 1280, height: 720 }, 1.5, false, 7);
await trailer('trailer-1080x1620', { width: 540, height: 810 }, 2, true, 7);
await browser.close();
close();
