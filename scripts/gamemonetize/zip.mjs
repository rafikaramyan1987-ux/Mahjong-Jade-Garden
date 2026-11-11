// GameMonetize upload: zips dist-gamemonetize/ (run `npm run build:gamemonetize` first) so that index.html sits at the
// zip root (GameMonetize README: "Root folder of .ZIP file must include index.html and game files"), relative paths
// only, then runs the static checks (scripts/gamemonetize/check.mjs).
// Usage: node scripts/gamemonetize/zip.mjs [out.zip] [--no-images]   (default submission-gamemonetize/mahjong-jade-garden-gamemonetize-v1.zip)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'submission-gamemonetize/mahjong-jade-garden-gamemonetize-v1.zip');
const dist = resolve('dist-gamemonetize');
if (!existsSync(`${dist}/index.html`)) throw new Error('dist-gamemonetize/index.html missing: run `npm run build:gamemonetize` first');
mkdirSync(dirname(out), { recursive: true });
rmSync(out, { force: true });
// the folder's *contents* (cwd = dist): index.html at the root; -X: no extra attributes, -D: no directory entries
execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
execFileSync('node', ['scripts/gamemonetize/check.mjs', out, ...args.filter((a) => a.startsWith('--'))], { stdio: 'inherit' });
