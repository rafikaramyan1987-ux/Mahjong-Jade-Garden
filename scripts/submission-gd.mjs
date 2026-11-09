// GameDistribution submission: node scripts/submission-gd.mjs (runs `npm run build:gd` first)
// -> submission-gd/mahjong-jade-garden-gd-v1.zip (index.html at the root of the zip)
// -> submission-gd/thumb-*.jpg rendered by the game's own cover renderer, and screenshots from the real game
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const OUT = 'submission-gd';
const ZIP = `${OUT}/mahjong-jade-garden-gd-v1.zip`;
mkdirSync(OUT, { recursive: true });
execFileSync('npm', ['run', 'build:gd'], { stdio: 'inherit' });

// zip: index.html at the root, nothing else needed (single-file build)
rmSync(ZIP, { force: true });
execFileSync('zip', ['-j', '-X', '-9', ZIP, 'dist-gd/index.html']);
const listing = execFileSync('unzip', ['-Z1', ZIP]).toString().trim().split('\n');
if (listing.length !== 1 || listing[0] !== 'index.html') throw new Error('zip must hold index.html at its root: ' + listing);
console.log(`wrote ${ZIP} (${(statSync(ZIP).size / 1024).toFixed(0)} KB): ${listing.join(', ')}`);
// game id, SDK once, no other portal's code
execFileSync('node', ['scripts/check-gd-zip.mjs', ZIP], { stdio: 'inherit' });

// thumbnails from the real game's cover renderer, at the exact sizes GD asks for
const { url, close } = await serve(4183, 'gd');
const browser = await chromium.launch();
const sizes = [
  [512, 384],
  [512, 512],
  [200, 120],
  [1280, 720],
  [1280, 550],
];
for (const [w, h] of sizes) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // block the portal SDK while rendering art
  await p.route('https://html5.api.gamedistribution.com/**', (r) => r.abort());
  const small = w < 400;
  // the game's own cover art (no portal label or branding)
  await p.goto(`${url}?shot=cover${small ? '&notag' : ''}`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  const file = `${OUT}/thumb-${w}x${h}.jpg`;
  await p.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('wrote', file);
  await p.close();
}
await browser.close();
close();

// screenshots for the store page (rendered by scripts/art.mjs from the real game)
mkdirSync(`${OUT}/screenshots`, { recursive: true });
for (const f of ['gameplay-landscape-1920x1080.png', 'gameplay-portrait-1080x1920.png', 'garden-journey-spring-1920x1080.png', 'title-landscape-1920x1080.png', 'board-cleared-1920x1080.png'])
  try {
    copyFileSync(`docs/art/${f}`, `${OUT}/screenshots/${f}`);
  } catch {
    console.warn('missing docs/art/' + f + ' (run node scripts/art.mjs)');
  }
