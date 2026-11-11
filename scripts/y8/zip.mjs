// Y8 upload (Builds tab): zips dist-y8/ (run `npm run build:y8` first) with index.html at the zip root, relative paths
// only, then runs the static checks (scripts/y8/check.mjs). The game is a single-player HTML5 game, so it is uploaded
// to Y8 directly (docs.y8.com/studio/iframe-game-hosting: iframe hosting is only for complex multiplayer games).
// Usage: node scripts/y8/zip.mjs [out.zip] [--no-media]   (default submission-y8/mahjong-jade-garden-y8-v1.zip)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'submission-y8/mahjong-jade-garden-y8-v1.zip');
const dist = resolve('dist-y8');
if (!existsSync(`${dist}/index.html`)) throw new Error('dist-y8/index.html missing: run `npm run build:y8` first');
mkdirSync(dirname(out), { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
execFileSync('node', ['scripts/y8/check.mjs', out, ...args.filter((a) => a.startsWith('--'))], { stdio: 'inherit' });
