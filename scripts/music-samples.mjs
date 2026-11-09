// Renders 30 s mp3 samples of each music track from the game's own synth (offline audio rendering in Chromium):
//   node scripts/music-samples.mjs [outDir] [seconds]   (run `npm run build` first)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const out = process.argv[2] || 'docs/media';
const secs = Number(process.argv[3] || 30);
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4184);
const browser = await chromium.launch();
const names = ['music-1-morning-tea', 'music-2-lantern-walk'];
for (let i = 0; i < names.length; i++) {
  const p = await browser.newPage();
  await p.goto(`${url}?shot=music&track=${i}&secs=${secs}`);
  await p.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
  const b64 = await p.evaluate(() => window.__wav);
  const wav = `${out}/${names[i]}.wav`;
  writeFileSync(wav, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', `${out}/${names[i]}.mp3`]);
  rmSync(wav);
  console.log(`wrote ${out}/${names[i]}.mp3`);
  await p.close();
}
await browser.close();
close();
