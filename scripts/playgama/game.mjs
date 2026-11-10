// Game-specific settings for the Playgama zip (scripts/playgama/zip.mjs) and its tests (scripts/playgama/test.mjs).
import web from '../web/game.mjs';

export default {
  slug: web.slug,
  title: 'Mahjong Jade Garden',
  dist: 'dist-playgama',
  exclude: web.exclude,
  /** the game's query for the tests: a brand-new player, board 1 of the journey (as in scripts/web/check.mjs) */
  query: '',
  ready: web.ready,
  /** play board 1 to its star screen, tapping every pair (as in scripts/web/check.mjs) */
  play: web.play,
  /** the labelled rewarded button ("Watch an ad: +1 hint", TV icon) offered once a board's hints are used up */
  reward: {
    selector: '[data-testid=reward]',
    /** on a board: use the board's 3 free hints, then tap Hint again (the "+1" offer opens if rewarded ads exist) */
    async open(frame) {
      for (let k = 0; k < 4; k++) {
        await frame.locator('[data-testid=hint]').click();
        await frame.waitForTimeout(500);
      }
    },
    /** the reward: the offer closes and the extra hint is shown (0 while the offer is still open) */
    value: (frame) => frame.evaluate(() => (window.__mjg.state().modal === 'offer-hint' ? 0 : 1)),
  },
  /** the game's own interstitial rules (app.ts): none before 3 boards are cleared; pretend a player who has 3 */
  async prepareBetween(frame) {
    await frame.evaluate(() => window.__mjg.demoProgress(3));
  },
  /** after the star screen: Next board (the between-boards interstitial slot), then the next board opens */
  async next(frame) {
    await frame.locator('[data-testid=next]').click({ force: true });
  },
  async nextLevelOpened(frame) {
    await frame.waitForFunction(() => {
      const s = window.__mjg.state();
      return s.screen === 'board' && s.modal === null && s.remaining > 0;
    }, null, { timeout: 60_000 });
  },
};
