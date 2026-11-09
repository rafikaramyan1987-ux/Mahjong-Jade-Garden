// Checks a GamePix upload zip: node scripts/check-gamepix-zip.mjs [zip]   (default: submission-gamepix/mahjong-jade-garden-gamepix-v1.zip)
// - index.html at the ROOT of the zip (single-file build: the only entry)
// - the GamePix SDK v3 loaded from its URL as an external <script src> (once), with the manual lifecycle config
// - no CrazyGames / GameDistribution code or strings
// - no http(s) URL at all except the GamePix SDK URL (no external links, ads, analytics)
import { execFileSync } from 'node:child_process';

const SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
const zip = process.argv[2] || 'submission-gamepix/mahjong-jade-garden-gamepix-v1.zip';
const errors = [];

const entries = execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n');
if (entries.length !== 1 || entries[0] !== 'index.html') errors.push(`zip must contain only index.html at its root, found: ${entries.join(', ')}`);
const html = execFileSync('unzip', ['-p', zip, 'index.html'], { maxBuffer: 64 * 1024 * 1024 }).toString();
if (!/^<!doctype html>/i.test(html.trimStart())) errors.push('index.html does not start with <!doctype html>');
const tags = html.match(/<script[^>]*\bsrc="[^"]*gamepix\.sdk\.js"[^>]*><\/script>/g) || [];
if (tags.length !== 1 || !tags[0].includes(`src="${SDK_URL}"`)) errors.push(`the GamePix SDK must be loaded once from ${SDK_URL} (found ${tags.length})`);
if (!/window\.GamePixConfig\s*=\s*\{\s*lifecycle:\s*'manual'\s*\}/.test(html)) errors.push("window.GamePixConfig = { lifecycle: 'manual' } is missing");
const sdkAt = html.indexOf(SDK_URL);
const bundleAt = html.indexOf('<script type="module"');
if (sdkAt < 0 || bundleAt < 0 || sdkAt > bundleAt) errors.push('the GamePix SDK must come before the game bundle');
for (const bad of [/crazygames/i, /gamedistribution/i, /gdsdk/i, /GD_OPTIONS/]) if (bad.test(html)) errors.push(`other portal code found: ${bad}`);
const urls = [...new Set(html.match(/https?:\/\/[^\s"'`<>)\\]+/g) || [])].filter((u) => u !== SDK_URL);
if (urls.length) errors.push(`external URLs found: ${urls.join(', ')}`);

if (errors.length) {
  console.error(`${zip}:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`${zip}: OK (index.html at the root, GamePix SDK once before the bundle, no other portal code, no other URL)`);
