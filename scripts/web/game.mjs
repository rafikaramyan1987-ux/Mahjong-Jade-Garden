// Game-specific settings for the open-portal web zip (scripts/web/zip.mjs) and its checker (scripts/web/check.mjs).
export default {
  slug: 'mahjong-jade-garden',
  /** the plain web build (`vite build`, platform `web`, the same build as GitHub Pages): no portal SDK, no ads */
  build: 'npm run build:web',
  /** a single self-contained index.html (fonts, art and code inlined) */
  dist: 'dist',
  /** nothing to leave out (zip.mjs always passes a `-x` list) */
  exclude: ['.DS_Store'],
  /** the only localStorage keys the game writes (src/app/save.ts); `__mjg` is a write probe removed straight away */
  storageKeys: ['mahjongjadegarden.save.v1', '__mjg'],
  /** a brand-new player: board 1 of the journey starts at once, with the hands-on tutorial inside it */
  query: '',
  canvasSelector: 'canvas#bg',
  /** a Canvas 2D game (no WebGL): Chromium's default flags; forced SwiftShader GL makes a 1280x720 screenshot take ~50 s */
  browserArgs: [],
  /** anything with the "watch an ad" TV icon (src/ui/icons.ts `tv`: rewarded-ad buttons, the HUD's "+1" badges) or a
   * rewarded button showing "no ad available" (src/app/app.ts adButton); the web build has neither: when hints,
   * shuffles or undos run out its "+1" extras are free ("Free: +1 hint") and no ad is ever asked for */
  adSelector: ':is(button, .badge):has(path[d="M10.4 10.4v4.8l4-2.4z"]), [data-state="noad"]',
  async ready(frame) {
    await frame.waitForFunction(() => document.body.dataset.ready === '1' && window.__mjg, null, { timeout: 60_000 });
    await frame.waitForTimeout(800);
  },
  /** board 1 for a new player, played for real: every pair is tapped (the pair comes from the game's own hint
   * search, like the e2e tests), the tutorial's blocked tile too, until the board is cleared and the stars show */
  async play(frame, page) {
    await frame.waitForFunction(() => window.__mjg.state().screen === 'board', null, { timeout: 30_000 });
    let pairs = 0;
    for (let n = 0; n < 80; n++) {
      const s = await frame.evaluate(() => window.__mjg.state());
      if (s.modal === 'win' || s.remaining === 0) break;
      if (s.modal === 'stuck') {
        await frame.locator('[data-testid=stuck-shuffle]').click();
      } else if (s.tutorial === 2) {
        const b = await frame.evaluate(() => window.__mjg.blocked());
        if (b) await tap(frame, page, b);
        await frame.waitForTimeout(250);
      } else {
        const pair = await frame.evaluate(() => window.__mjg.pair());
        if (!pair) {
          await frame.waitForTimeout(500);
          continue;
        }
        for (const c of pair) await tap(frame, page, c);
        pairs++;
      }
      await frame.waitForTimeout(450);
    }
    const won = await frame
      .locator('[data-testid=win]')
      .waitFor({ timeout: 15_000 })
      .then(() => true, () => false);
    await frame.waitForTimeout(2500);
    return { won, why: won ? '' : 'no star screen', note: `board 1 cleared in ${pairs} tapped pairs, tutorial included` };
  },
  // ---------------------------------------------------------------- store images (scripts/web/store.mjs)
  /** the main cover (submission/, rendered by the game), cropped to 630:500 around the tiles and the title */
  cover: { src: 'submission/cover-1920x1080.png', crop: '1180x937+370+40' },
  icon: 'submission-gamepix/icon-512x512.png',
  /** 1280x720 shots of the web build, played through the game's own pairs (taps) and test hooks */
  shots: [
    {
      name: 'start: board 1 for a new player, the tutorial hand on the first pair',
      query: '',
      run: async (f) => {
        await f.locator('[data-testid=hand]').waitFor();
        await f.waitForTimeout(2500);
      },
    },
    {
      name: 'mid-level: Journey board 15, a bit more than half cleared',
      query: '?seed=7',
      save: returning,
      run: async (f) => {
        await f.locator('[data-testid=play]').click();
        await f.waitForFunction(() => window.__mjg.state().screen === 'board');
        await f.waitForTimeout(800);
        await f.evaluate(() => window.__mjg.solve(Math.round(window.__mjg.state().remaining * 0.45 / 2) * 2));
        await f.waitForTimeout(2500);
      },
    },
    {
      name: 'a mechanic: quick matches build a combo (multiplier, bonus points)',
      query: '?seed=7',
      save: returning,
      run: async (f, page) => {
        await f.locator('[data-testid=play]').click();
        await f.waitForFunction(() => window.__mjg.state().screen === 'board');
        await f.waitForTimeout(800);
        for (let k = 0; k < 3; k++) {
          for (const c of await f.evaluate(() => window.__mjg.pair())) await tap(f, page, c);
          await f.waitForTimeout(350);
        }
        // the combo label of the last match, held at its fully shown frame (it floats up and fades within 1 s)
        await f.locator('[data-testid=combo]').last().waitFor();
        await f.evaluate(() => {
          const c = [...document.querySelectorAll('[data-testid=combo]')].pop();
          c.remove = () => {};
          for (const a of c.getAnimations({ subtree: true })) {
            a.currentTime = a.animationName === 'float-up' ? 420 : 400;
            a.pause();
          }
        });
        await f.waitForTimeout(600);
      },
    },
    {
      name: 'win screen: board 15 cleared, three stars',
      query: '?seed=7',
      save: returning,
      run: async (f) => {
        await f.locator('[data-testid=play]').click();
        await f.waitForFunction(() => window.__mjg.state().screen === 'board');
        // a realistic clear time for the result (the solve itself is instant)
        await f.evaluate(() => window.__mjg.setTime(118));
        await f.evaluate(() => window.__mjg.solve());
        await f.locator('[data-testid=win]').waitFor();
        await f.waitForTimeout(3500);
      },
    },
  ],
};

/** a returning player: tutorial done, 14 journey boards won (the title screen shows, Play opens board 15) */
function returning() {
  const n = 14;
  localStorage.setItem(
    'mahjongjadegarden.save.v1',
    JSON.stringify({
      v: 1,
      tutorialDone: true,
      journey: n,
      stars: Array.from({ length: n }, (_, k) => (k % 4 === 3 ? 2 : 3)),
      bestTimes: Array.from({ length: n }, (_, k) => 60 + k * 9),
      bestScores: Array.from({ length: n }, (_, k) => 300 + k * 40),
      stats: { played: n + 2, won: n, bestTime: 58, totalTime: 2400, bestScore: 900, tilesMatched: 900 },
    }),
  );
}

/** tap a point given in the game frame's coordinates (mouse, or touch in a touch context) */
async function tap(frame, page, [x, y]) {
  const el = frame === page.mainFrame() ? null : await frame.frameElement();
  const box = el ? await el.boundingBox() : { x: 0, y: 0 };
  const px = box.x + x, py = box.y + y;
  if (await frame.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}
