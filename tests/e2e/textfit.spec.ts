import { expect, test, type Page } from '@playwright/test';
import type {} from '../shared/hooks';

/**
 * Every text fits: in every language (German and Russian are the longest), on a 390 x 844 phone and a 1920 x 1080
 * screen, no label is cut off, wraps out of its box or leaves the screen, on every screen and dialog.
 */
const LANGS = ['de', 'ru', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'tr', 'en'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1920, height: 1080 },
];

/** text elements that overflow their box or the screen */
async function overflow(page: Page, where: string) {
  return page.evaluate((where) => {
    const sel = 'button, h2, h3, .k, .v, .tl, .lbl, .sub, .tut, .kv span, .kv b, .goal-time, .banner-cap b, .banner-cap span, .journey-count, .setting .lab span, .seg button, .restored, .star-hint, .sub-title, .big-score span, .jcell .name, .garden-foot div, .medal b, .new-best';
    const bad: string[] = [];
    const W = innerWidth;
    const H = innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>(`#ui ${sel.split(', ').join(', #ui ')}`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      // inside a scrolling list, only the horizontal direction matters
      const scroller = el.closest('.journey-list, .panel');
      const text = (el.innerText || '').trim().slice(0, 40);
      if (!text) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') bad.push(`${where}: "${text}" is cut off (${el.scrollWidth} > ${el.clientWidth})`);
      if (r.left < -1 || r.right > W + 1) bad.push(`${where}: "${text}" leaves the screen horizontally`);
      if (!scroller && (r.top < -1 || r.bottom > H + 1)) bad.push(`${where}: "${text}" leaves the screen vertically`);
      // a child sticking out of a button
      if (el.tagName === 'BUTTON') {
        for (const c of el.querySelectorAll<HTMLElement>('span:not(.badge)')) {
          const cr = c.getBoundingClientRect();
          if (cr.width && (cr.right > r.right + 2 || cr.left < r.left - 2)) bad.push(`${where}: "${(c.innerText || '').slice(0, 30)}" sticks out of its button`);
        }
      }
    }
    return bad;
  }, where);
}

for (const vp of VIEWPORTS)
  test(`all texts fit at ${vp.width}x${vp.height} in ${LANGS.length} languages`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'landscape', 'runs once (sets its own viewports)');
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const bad: string[] = [];
    for (const lang of LANGS) {
      const at = (s: string) => `${lang} ${s}`;
      await page.goto(`/?fresh&seed=5&lang=${lang}`);
      await page.waitForSelector('body[data-ready="1"]');
      // board 1 with the tutorial (steps 1 and 2)
      bad.push(...(await overflow(page, at('tutorial 1'))));
      const pair = (await page.evaluate(() => window.__mjg.pair()))!;
      for (const [x, y] of pair) await page.mouse.click(x, y);
      await expect.poll(() => page.evaluate(() => window.__mjg.state().tutorial)).toBe(2);
      bad.push(...(await overflow(page, at('tutorial 2'))));
      await page.click('[data-testid=tut-next]');
      bad.push(...(await overflow(page, at('tutorial 3'))));
      await page.click('[data-testid=tut-skip]');
      bad.push(...(await overflow(page, at('board'))));
      // dialogs on the board
      await page.click('[data-testid=menu]');
      bad.push(...(await overflow(page, at('pause'))));
      await page.click('[data-testid=pause-settings]');
      bad.push(...(await overflow(page, at('settings'))));
      await page.click('[data-testid=settings-close]');
      await page.click('[data-testid=resume]');
      for (let i = 0; i < 4; i++) await page.click('[data-testid=hint]');
      bad.push(...(await overflow(page, at('extra hint'))));
      await page.click('[data-testid=no-thanks]');
      await page.evaluate(() => window.__mjg.stuck());
      bad.push(...(await overflow(page, at('stuck'))));
      await page.click('[data-testid=stuck-shuffle]');
      await page.click('[data-testid=shuffle]');
      await page.click('[data-testid=shuffle]');
      await page.evaluate(() => window.__mjg.stuck());
      bad.push(...(await overflow(page, at('stuck (no shuffles)'))));
      await page.click('[data-testid=stuck-shuffle], [data-testid=reward-continue]');
      // the result screen
      await page.evaluate(() => window.__mjg.solve());
      await expect(page.locator('[data-testid=win]')).toBeVisible();
      await page.waitForTimeout(1600);
      bad.push(...(await overflow(page, at('win'))));
      await page.click('[data-testid=win-journey]');
      await page.waitForTimeout(300);
      bad.push(...(await overflow(page, at('journey'))));
      await page.click('[data-testid=stats]');
      bad.push(...(await overflow(page, at('statistics'))));
      await page.locator('[data-testid=stats-panel] .btn').click();
      await page.locator('.season-banner').first().click();
      bad.push(...(await overflow(page, at('garden'))));
      await page.click('[data-testid=back]');
      await page.click('[data-testid=back]');
      bad.push(...(await overflow(page, at('main menu'))));
      await page.click('[data-testid=settings]');
      await page.click('[data-testid=reset]');
      bad.push(...(await overflow(page, at('reset'))));
      await page.click('[data-testid=reset-no]');
      // the daily challenge result (medal)
      await page.click('[data-testid=settings-close]');
      await page.click('[data-testid=daily]');
      await page.evaluate(() => window.__mjg.solve());
      await expect(page.locator('[data-testid=win]')).toBeVisible();
      await page.waitForTimeout(1600);
      bad.push(...(await overflow(page, at('daily result'))));
    }
    expect([...new Set(bad)]).toEqual([]);
    expect(errors).toEqual([]);
    await ctx.close();
  });
