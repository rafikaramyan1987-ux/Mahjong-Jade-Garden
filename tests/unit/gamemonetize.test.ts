import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMonetizePlatform, GM_GAME_ID, GM_SCRIPT_ID, GM_SDK_URL } from '../../src/app/platform/gamemonetize';
import { AD_GAP, AD_MAX, AD_TIMEOUT } from '../../src/app/platform/types';

/** a GameMonetize `sdk` stand-in: `behave` decides what showBanner() does with the SDK's event callback */
type Emit = (name: string) => void;
function setup(behave: (emit: Emit) => void = () => {}, ready = true) {
  const gm = new GameMonetizePlatform();
  const emit: Emit = (name) => gm.onEvent({ name });
  const showBanner = vi.fn(() => behave(emit));
  vi.stubGlobal('window', { sdk: { showBanner } });
  const log: string[] = [];
  gm.onAdPause = (p) => log.push(p ? 'pause' : 'resume');
  if (ready) emit('SDK_READY');
  return { gm, emit, showBanner, log };
}

describe('GameMonetize wrapper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('game ID of Mahjong Jade Garden', () => {
    expect(GM_GAME_ID).toBe('ux7a998kv63s60z7m9q5dbm2241i0e09');
  });

  it('init: SDK_OPTIONS { gameId, onEvent } set before sdk.js is inserted once, before the first script (the README loader)', async () => {
    const order: string[] = [];
    const inserted: { id: string; src: string; onerror?: () => void; onload?: () => void }[] = [];
    const win: { SDK_OPTIONS?: { gameId: string; onEvent: unknown } } = {};
    const first = { parentNode: { insertBefore: (e: (typeof inserted)[number]) => (order.push(`insert:${win.SDK_OPTIONS?.gameId}:${typeof win.SDK_OPTIONS?.onEvent}`), inserted.push(e)) } };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      getElementById: (id: string) => inserted.find((e) => e.id === id) ?? null,
      getElementsByTagName: () => [first],
      createElement: () => ({}),
      head: { appendChild: () => {} },
    });
    const gm = new GameMonetizePlatform();
    const p = gm.init(1000);
    expect(order).toEqual([`insert:${GM_GAME_ID}:function`]);
    expect(inserted.map((e) => [e.id, e.src])).toEqual([[GM_SCRIPT_ID, GM_SDK_URL]]);
    inserted[0].onerror?.(); // blocked: the game plays on
    await p;
    await gm.init(1000);
    expect(inserted).toHaveLength(1);
    // a script that never answers: init gives up after the timeout, never throws
    const slow = new GameMonetizePlatform();
    inserted.length = 0;
    const q = slow.init(500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(q).resolves.toBeUndefined();
  });

  it('SDK_GAME_PAUSE pauses + mutes; SDK_GAME_START resumes + restores audio and settles the interstitial', async () => {
    let emit: Emit = () => {};
    const { gm, showBanner, log } = setup((e) => (emit = e));
    let done = false;
    void gm.interstitial('preroll').then(() => (done = true));
    expect(showBanner).toHaveBeenCalledTimes(1);
    emit('SDK_GAME_PAUSE');
    expect(log).toEqual(['pause']);
    // a started ad may run longer than the 8 s "not started" timeout
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT * 3);
    expect(done).toBe(false);
    emit('SDK_GAME_START');
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    expect(log).toEqual(['pause', 'resume']);
  });

  it('pause / resume also follow ads the SDK shows by itself', () => {
    const { emit, log } = setup();
    emit('SDK_GAME_PAUSE');
    emit('SDK_GAME_PAUSE');
    emit('SDK_GAME_START');
    expect(log).toEqual(['pause', 'resume']);
  });

  it('settles exactly once: nothing started within 8 s; late events cannot settle it again', async () => {
    let emit: Emit = () => {};
    const { gm, log } = setup((e) => (emit = e));
    const settled: number[] = [];
    void gm.interstitial('preroll').then(() => settled.push(1));
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT - 1);
    expect(settled).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual([1]);
    emit('SDK_GAME_PAUSE');
    emit('SDK_GAME_START');
    emit('SDK_GAME_START');
    await vi.advanceTimersByTimeAsync(AD_MAX * 2);
    expect(settled).toEqual([1]);
    expect(log).toEqual(['pause', 'resume']);
  });

  it('settles on an error, a throwing showBanner() and a started ad that never ends (the game never gets stuck)', async () => {
    const e = setup((emit) => emit('AD_ERROR'));
    let a = false;
    void e.gm.interstitial('preroll').then(() => (a = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(a).toBe(true);
    vi.unstubAllGlobals();

    const t = setup(() => {
      throw new Error('boom');
    });
    let b = false;
    void t.gm.interstitial('preroll').then(() => (b = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(b).toBe(true);
    vi.unstubAllGlobals();

    const h = setup((emit) => emit('SDK_GAME_PAUSE'));
    let c = false;
    void h.gm.interstitial('preroll').then(() => (c = true));
    await vi.advanceTimersByTimeAsync(AD_MAX - 1);
    expect(c).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(c).toBe(true);
    expect(h.log).toEqual(['pause', 'resume']);
  });

  it('at most one interstitial per ~2 minutes, never during gameplay, none before SDK_READY, one at a time', async () => {
    const { gm, showBanner } = setup((e) => {
      e('SDK_GAME_PAUSE');
      e('SDK_GAME_START');
    });
    await gm.interstitial('preroll');
    expect(showBanner).toHaveBeenCalledTimes(1);
    await gm.interstitial('between');
    expect(showBanner).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AD_GAP);
    gm.gameplayStart();
    await gm.interstitial('between');
    expect(showBanner).toHaveBeenCalledTimes(1);
    gm.gameplayStop();
    await gm.interstitial('between');
    expect(showBanner).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();

    const early = setup(() => {}, false);
    await early.gm.interstitial('preroll');
    expect(early.showBanner).not.toHaveBeenCalled();
    vi.unstubAllGlobals();

    // no SDK at all (ad blocker): nothing to call, resolves at once
    vi.stubGlobal('window', {});
    const none = new GameMonetizePlatform();
    none.onEvent({ name: 'SDK_READY' });
    await expect(none.interstitial('preroll')).resolves.toBeUndefined();
  });

  it('rewarded: no API in the SDK, so the buttons are hidden (available=false) and nothing is shown or granted', async () => {
    const { gm, showBanner } = setup();
    expect(gm.available).toBe(false);
    expect(await gm.rewarded()).toBe(false);
    expect(showBanner).not.toHaveBeenCalled();
    // saves stay in localStorage
    expect(gm.data()).toBeNull();
  });
});
