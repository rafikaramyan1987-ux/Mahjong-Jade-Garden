// Records a ~60 s gameplay video of the real game (run `npm run build` first):
//   node scripts/record.mjs [outDir]  ->  gameplay-landscape-1280x720.mp4 (1920x1080 pixels),
//   gameplay-portrait-390x844.mp4 (780x1688 pixels)
// Every move is a real tap on the tile's screen position (the next pair comes from the in-game hint solver).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'docs/media';
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4181);
const browser = await chromium.launch();

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

async function record(name, viewport, dpr, touch) {
  const tmp = resolve(out, '.tmp-' + name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(RIPPLE);
  const p = await ctx.newPage();
  // CDP screencast: frames at full device-pixel resolution with their timestamps
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: viewport.width * dpr, maxHeight: viewport.height * dpr });
  const tap = async (x, y) => (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  const tapSel = async (sel) => {
    const b = await p.locator(sel).boundingBox();
    await tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const t0 = Date.now();
  await p.goto(url + '?fresh&menu&seed=1987');
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(2500);
  await tapSel('[data-testid=play]');
  await p.waitForSelector('[data-testid=tutorial]');
  await p.waitForTimeout(2600);
  // tutorial step 1: match the pair the hand shows; step 2: the blocked tile
  let pr = await p.evaluate(() => window.__mjg.pair());
  await tap(...pr[0]);
  await p.waitForTimeout(600);
  await tap(...pr[1]);
  await p.waitForTimeout(2000);
  await tapSel('[data-testid=tut-next]');
  await p.waitForTimeout(700);
  let k = 0;
  for (;;) {
    const s = await p.evaluate(() => window.__mjg.state());
    if (s.modal === 'win' || s.remaining === null || s.remaining === 0) break;
    if (s.modal === 'stuck') {
      await tapSel('[data-testid=stuck-shuffle], [data-testid=reward-continue]');
      await p.waitForTimeout(600);
      continue;
    }
    k++;
    if (k === 8) {
      // ask for a hint, then play the glowing pair
      await tapSel('[data-testid=hint]');
      await p.waitForTimeout(1300);
    }
    pr = await p.evaluate(() => window.__mjg.pair());
    if (!pr) break;
    await tap(...pr[0]);
    await p.waitForTimeout(260);
    await tap(...pr[1]);
    await p.waitForTimeout(k === 8 ? 700 : 340);
    if (k === 16) {
      await tapSel('[data-testid=undo]');
      await p.waitForTimeout(800);
    }
  }
  await p.waitForSelector('[data-testid=win]');
  await p.waitForTimeout(5500);
  const secs = Math.round((Date.now() - t0) / 1000);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  // variable frame durations from the screencast timestamps -> constant 30 fps mp4
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`).join('\n');
  writeFileSync(join(tmp, 'list.txt'), `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
  const mp4 = join(out, name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-movflags', '+faststart', mp4]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${mp4} (${secs} s)`);
}

await record('gameplay-landscape-1280x720', { width: 1280, height: 720 }, 1.5, false);
await record('gameplay-portrait-390x844', { width: 390, height: 844 }, 2, true);
await browser.close();
close();
