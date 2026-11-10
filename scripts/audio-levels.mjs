// Loudness of every sound effect and both music tracks, rendered offline by the game itself (run `npm run build`
// first): node scripts/audio-levels.mjs [--md docs/audio-levels.md] [--strict]
// Effects must be within ±2 dB of each other; music sits 10-16 dB under the effects. --strict exits 1 otherwise.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const md = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;
const strict = process.argv.includes('--strict');
const { url, close } = await serve(4191);
const browser = await chromium.launch();
const p = await browser.newPage();
await p.goto(url + '?shot=levels');
await p.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
const lv = await p.evaluate(() => window.__levels);
await browser.close();
close();

const sfx = Object.entries(lv).filter(([k]) => !k.startsWith('music'));
const vals = sfx.map(([, v]) => v).sort((a, b) => a - b);
const median = vals[Math.floor(vals.length / 2)];
const music = [lv.music1, lv.music2];
const problems = [];
const rows = sfx.map(([k, v]) => {
  const d = v - median;
  if (Math.abs(d) > 2) problems.push(`${k} is ${d.toFixed(1)} dB from the others`);
  return `| ${k} | ${v.toFixed(1)} | ${d >= 0 ? '+' : ''}${d.toFixed(1)} | ${(10 ** (-d / 20)).toFixed(2)} |`;
});
for (const [i, m] of music.entries()) {
  const under = median - m;
  if (under < 10 || under > 16) problems.push(`music ${i + 1} is ${under.toFixed(1)} dB under the effects (want 10-16)`);
}
const text = `# Audio levels

Measured by \`node scripts/audio-levels.mjs\`: every effect rendered offline by the game (Web Audio, as played in the game,
through \`SFX_LEVEL\` and its own \`SFX_GAIN\`), loudness = the loudest 300 ms window (RMS, dBFS). Music = the average over
20 s at \`MUSIC_LEVEL\`. Effects stay within ±2 dB of each other; music plays 10–16 dB under them.

| effect | loudness (dBFS) | vs. median | gain to centre |
|---|---|---|---|
${rows.join('\n')}

| music | loudness (dBFS) | under the effects |
|---|---|---|
| Morning Tea | ${music[0].toFixed(1)} | ${(median - music[0]).toFixed(1)} dB |
| Lantern Walk | ${music[1].toFixed(1)} | ${(median - music[1]).toFixed(1)} dB |

${problems.length ? 'Problems:\n\n' + problems.map((x) => '- ' + x).join('\n') : 'All effects within ±2 dB; both tracks 10–16 dB under the effects.'}
`;
console.log(text);
if (md) writeFileSync(md, text);
if (strict && problems.length) process.exit(1);
