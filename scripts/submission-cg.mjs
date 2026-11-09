// CrazyGames submission: node scripts/submission-cg.mjs   (builds the CrazyGames and web builds itself)
// -> submission/mahjong-jade-garden-v1.zip  (unzips to mahjong-jade-garden-v1/index.html, one single-file build)
// -> submission/cover-1920x1080.png, cover-800x1200.png, cover-800x800.png (top-left corner kept clear)
// -> submission/trailer-1920x1080.mp4, trailer-1080x1620.mp4 (<= 20 s of real gameplay, scripts/trailer.mjs)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const OUT = 'submission';
const NAME = 'mahjong-jade-garden-v1';
mkdirSync(OUT, { recursive: true });
execFileSync('npm', ['run', 'build:crazygames'], { stdio: 'inherit' });

// zip with a single top folder holding index.html
const stage = `${OUT}/.stage`;
rmSync(stage, { recursive: true, force: true });
mkdirSync(`${stage}/${NAME}`, { recursive: true });
copyFileSync('dist-crazygames/index.html', `${stage}/${NAME}/index.html`);
rmSync(`${OUT}/${NAME}.zip`, { force: true });
execFileSync('zip', ['-r', '-X', '-9', `../${NAME}.zip`, NAME], { cwd: stage });
rmSync(stage, { recursive: true, force: true });
const listing = execFileSync('unzip', ['-Z1', `${OUT}/${NAME}.zip`]).toString().trim().split('\n');
if (listing.join(',') !== `${NAME}/,${NAME}/index.html`) throw new Error('unexpected zip layout: ' + listing.join(', '));
console.log(`wrote ${OUT}/${NAME}.zip (${(statSync(`${OUT}/${NAME}.zip`).size / 1024).toFixed(0)} KB): ${listing.join(', ')}`);

// covers from the game's own cover renderer (CrazyGames build, SDK blocked), top-left corner clear for the label
const { url, close } = await serve(4187, 'crazygames');
const browser = await chromium.launch();
for (const [w, h] of [
  [1920, 1080],
  [800, 1200],
  [800, 800],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.route('https://sdk.crazygames.com/**', (r) => r.abort());
  await p.goto(`${url}?shot=cover&cg`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/cover-${w}x${h}.png` });
  console.log('wrote', `${OUT}/cover-${w}x${h}.png`);
  await p.close();
}
await browser.close();
close();

// trailers: real gameplay of the web build (same game, no portal SDK in the frame)
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
execFileSync('node', ['scripts/trailer.mjs', OUT], { stdio: 'inherit' });
