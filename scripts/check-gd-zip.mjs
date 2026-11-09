// Checks a GameDistribution upload zip: node scripts/check-gd-zip.mjs [zip]   (default: submission-gd/mahjong-jade-garden-gd-v1.zip)
// - exactly one entry, index.html, at the ROOT of the zip (no folder)
// - the GD game id of Mahjong Jade Garden, exactly as configured (and no placeholder)
// - the GD SDK loaded from https://html5.api.gamedistribution.com/main.min.js, referenced once
// - no CrazyGames SDK or other portal code
// Also checks that the web and CrazyGames builds (if built) do not contain the GD SDK or the game id.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const GD_GAME_ID = '2708776451364ee68eca7c869f5371e0';
const SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';
const zip = process.argv[2] || 'submission-gd/mahjong-jade-garden-gd-v1.zip';
const errors = [];
const count = (s, needle) => s.split(needle).length - 1;

const entries = execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n');
if (entries.length !== 1 || entries[0] !== 'index.html') errors.push(`zip must contain only index.html at its root, found: ${entries.join(', ')}`);
const html = execFileSync('unzip', ['-p', zip, 'index.html'], { maxBuffer: 64 * 1024 * 1024 }).toString();
if (count(html, `"${GD_GAME_ID}"`) < 1) errors.push(`the GD game id ${GD_GAME_ID} is missing`);
if (/TODO_GD_GAME_ID/.test(html)) errors.push('the placeholder TODO_GD_GAME_ID is still in the build');
if (count(html, SDK_URL) !== 1) errors.push(`the GD SDK URL ${SDK_URL} must appear exactly once (found ${count(html, SDK_URL)})`);
for (const bad of ['sdk.crazygames.com', 'crazygames-sdk', 'CrazyGames.SDK']) if (html.includes(bad)) errors.push(`CrazyGames code found in the GD build: ${bad}`);
if (!/^<!doctype html>/i.test(html.trimStart())) errors.push('index.html does not start with <!doctype html>');

for (const other of ['dist/index.html', 'dist-crazygames/index.html']) {
  if (!existsSync(other)) continue;
  const s = readFileSync(other, 'utf8');
  if (s.includes(GD_GAME_ID)) errors.push(`${other} contains the GD game id`);
  if (s.includes('html5.api.gamedistribution.com')) errors.push(`${other} contains the GD SDK`);
}

if (errors.length) {
  console.error(`${zip}:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`${zip}: OK (index.html at the root, game id ${GD_GAME_ID}, GD SDK once, no CrazyGames code)`);
