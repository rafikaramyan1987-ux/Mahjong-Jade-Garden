// Portrait board screenshots at 390x844 (2x) from the built game: node scripts/portrait-shots.mjs <outDir> <board numbers...>
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const [out = 'docs/art/portrait', ...ns] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { url, close } = await serve(4182);
const b = await chromium.launch();
for (const n of ns.length ? ns : ['1', '5', '16', '41', '63']) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await p.goto(url + '?fresh');
  await p.waitForSelector('body[data-ready="1"]');
  await p.evaluate((k) => window.__mjg.setJourney(k - 1), +n);
  await p.click('[data-testid=play]');
  await p.evaluate(() => window.__mjg.skipTutorial());
  await p.waitForTimeout(400);
  const s = await p.evaluate(() => window.__mjg.state());
  await p.screenshot({ path: `${out}/board-${n}-390x844.png` });
  console.log(`board ${n}: ${s.remaining} tiles, ${s.variant}, tile width ${s.tileWidth}px`);
  await p.close();
}
await b.close();
close();
