// Static checks of a GameMonetize zip (scripts/gamemonetize/zip.mjs) and the submission images. Fails if
//  - index.html is not at the zip root, or a path in the zip is absolute / leaves the zip,
//  - index.html references a file by a non-relative path, or the bundle names another http(s) URL than GameMonetize's
//    sdk.js (no external links),
//  - the bundle lacks the game ID / sdk.js / SDK_OPTIONS / the SDK_GAME_PAUSE + SDK_GAME_START handling, or contains
//    another portal's or ad network's code (crazygames / gamedistribution / gamepix / playgama / y8 / googlesyndication),
//    an iframe or window.open,
//  - a submission image is missing, not a 512x384 / 512x512 / 512x340 JPEG, or 300 KB or more (--no-images: skipped).
// Usage: node scripts/gamemonetize/check.mjs [zip] [--no-images]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const zip = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'submission-gamemonetize/mahjong-jade-garden-gamemonetize-v1.zip');
const GAME_ID = 'ux7a998kv63s60z7m9q5dbm2241i0e09';
const SDK = 'https://api.gamemonetize.com/sdk.js';
const BANNED = ['crazygames', 'gamedistribution', 'gamepix', 'playgama', 'cdn.y8.com', 'y8sdk', 'googlesyndication', '<iframe', 'window.open'];
/** URLs that are data, not requests (XML namespaces) */
const NAMESPACE = /^https?:\/\/www\.w3\.org\//;
const errors = [];
const check = (bad, badMsg, okMsg) => {
  if (bad) {
    errors.push(badMsg);
    console.log(`  ✗ ${badMsg}`);
  } else console.log(`  ✓ ${okMsg}`);
};

console.log(`zip: ${zip} (${(statSync(zip).size / 1024).toFixed(0)} KB)`);
const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
check(!entries.includes('index.html'), 'index.html is not at the zip root', 'index.html at the zip root');
const unsafe = entries.filter((e) => e.startsWith('/') || e.split('/').includes('..') || e.includes('\\'));
check(unsafe.length, `unsafe paths in the zip: ${unsafe.join(', ')}`, `${entries.length} file(s), all relative: ${entries.join(', ')}`);

const dir = mkdtempSync(join(tmpdir(), 'gmzip-'));
execFileSync('unzip', ['-q', zip, '-d', dir]);
const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
walk(dir);
const text = files.filter((f) => /\.(html|js|css|json)$/.test(f)).map((f) => [f.slice(dir.length + 1), readFileSync(f, 'utf8')]);
const all = text.map(([, s]) => s).join('\n');

if (existsSync(join(dir, 'index.html'))) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
  const bad = refs.filter((r) => /^(https?:)?\/\//.test(r) || r.startsWith('/'));
  check(bad.length, `index.html references non-relative paths: ${bad.join(', ')}`, `index.html: ${refs.length} references, none absolute`);
}
const hits = [];
for (const [f, s] of text) for (const b of BANNED) if (s.toLowerCase().includes(b)) hits.push(`${f}: "${b}"`);
check(hits.length, `banned strings: ${hits.join('; ')}`, `no ${BANNED.join(' / ')} in the bundle`);
const urls = [...new Set(all.match(/https?:\/\/[A-Za-z0-9.\-_/]+/g) ?? [])].filter((u) => !NAMESPACE.test(u));
const other = urls.filter((u) => u !== SDK);
check(other.length, `external URLs other than the SDK: ${other.join(', ')}`, `the only external URL is ${SDK}`);
for (const [needle, what] of [
  [SDK, 'GameMonetize sdk.js'],
  [GAME_ID, `game ID ${GAME_ID}`],
  ['SDK_OPTIONS', 'window.SDK_OPTIONS'],
  ['gamemonetize-sdk', 'README loader id "gamemonetize-sdk"'],
  ['SDK_GAME_PAUSE', 'SDK_GAME_PAUSE handling'],
  ['SDK_GAME_START', 'SDK_GAME_START handling'],
  ['SDK_READY', 'SDK_READY handling'],
  ['showBanner', 'sdk.showBanner()'],
]) check(!all.includes(needle), `${what} missing`, `${what} in the bundle`);
check(statSync(zip).size >= 50 * 1024 * 1024, 'zip is 50 MB or more', 'zip under 50 MB');

if (!args.includes('--no-images')) {
  for (const [w, h] of [
    [512, 384],
    [512, 512],
    [512, 340],
  ]) {
    const f = `submission-gamemonetize/mahjong-jade-garden-${w}x${h}.jpg`;
    if (!existsSync(f)) {
      check(true, `${f} missing`, '');
      continue;
    }
    const [iw, ih, fmt] = execFileSync('identify', ['-format', '%w %h %m', f], { encoding: 'utf8' }).trim().split(' ');
    const size = statSync(f).size;
    check(+iw !== w || +ih !== h || fmt !== 'JPEG', `${f}: ${iw}x${ih} ${fmt} (want ${w}x${h} JPEG)`, `${f}: ${w}x${h} JPEG`);
    check(size >= 300 * 1024, `${f}: ${size} bytes (limit 300 KB)`, `${f}: ${(size / 1024).toFixed(0)} KB < 300 KB`);
  }
}

if (errors.length) {
  console.log(`\nFAILED: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log('\nOK');
