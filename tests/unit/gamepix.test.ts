import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_MAX, GamePixPlatform, LOADED_TIMEOUT, type GPXAdResult, type GPXSdk } from '../../src/app/platform/gamepix';
import { AD_TIMEOUT } from '../../src/app/platform/types';

/** a fake GamePix SDK v3 recording every call; ads answer through `answer` */
function fakeSdk() {
  const calls: string[] = [];
  const handlers: Record<string, () => void> = {};
  let answer: (r: GPXAdResult) => void = () => {};
  let fail: (e: unknown) => void = () => {};
  let loadedResolve: () => void = () => {};
  const ad = () =>
    new Promise<GPXAdResult>((res, rej) => {
      answer = res;
      fail = rej;
    });
  const sdk: GPXSdk = {
    lang: () => 'fr',
    lifecycle: {
      loading: (p) => void calls.push(`loading:${p}`),
      loaded: () => {
        calls.push('loaded');
        return new Promise<void>((r) => (loadedResolve = r));
      },
      gameStart: () => void calls.push('gameStart'),
    },
    events: { on: (name, fn) => void (handlers[name] = fn) },
    ads: {
      interstitial: vi.fn(() => (calls.push('interstitial'), ad())),
      reward: vi.fn(() => (calls.push('reward'), ad())),
    },
    happyMoment: (n) => void calls.push(`happy:${n}`),
    sadMoment: (n) => void calls.push(`sad:${n}`),
  };
  return {
    sdk,
    calls,
    emit: (name: 'pause' | 'resume') => handlers[name]?.(),
    answer: (r: GPXAdResult) => answer(r),
    fail: (e: unknown) => fail(e),
    loaded: () => loadedResolve(),
  };
}

describe('GamePix SDK v3 wrapper', () => {
  let f: ReturnType<typeof fakeSdk>;
  let gp: GamePixPlatform;
  let pauses: boolean[];

  beforeEach(async () => {
    vi.useFakeTimers();
    f = fakeSdk();
    // boot progress goes to window.GamePix (shared with main.ts, before the platform exists)
    (globalThis as unknown as { window: unknown }).window = { GamePix: f.sdk };
    gp = new GamePixPlatform(() => f.sdk);
    pauses = [];
    gp.onAdPause = (p) => pauses.push(p);
    const init = gp.init();
    await vi.advanceTimersByTimeAsync(0);
    f.loaded();
    await init;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  // runs first: the boot progress is reported once per page (only increasing)
  it('reports loading 100, then waits for loaded(); the language comes from GamePix.lang()', () => {
    expect(f.calls.slice(0, 2)).toEqual(['loading:100', 'loaded']);
    gp.loading(50);
    expect(f.calls.filter((c) => c.startsWith('loading'))).toEqual(['loading:100']);
    expect(gp.available).toBe(true);
    expect(gp.locale()).toBe('fr');
    expect(gp.data()).toBeNull();
    expect(gp.muted).toBe(false);
  });

  it('loaded() that never resolves does not block the game', async () => {
    const g = fakeSdk();
    const p = new GamePixPlatform(() => g.sdk);
    let done = false;
    void p.init().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(LOADED_TIMEOUT + 10);
    expect(done).toBe(true);
    expect(p.available).toBe(true);
  });

  it('without the SDK the game plays on: no ads, rewarded resolves false', async () => {
    const p = new GamePixPlatform(() => undefined);
    await p.init();
    expect(p.available).toBe(false);
    expect(await p.rewarded()).toBe(false);
    await p.interstitial('between');
    expect(p.locale()).toBeNull();
  });

  it('gameStart is sent once; happy and sad moments use stable names', () => {
    gp.gameplayStart();
    gp.gameplayStop();
    gp.gameplayStart();
    gp.happytime();
    gp.sadMoment('game_over');
    expect(f.calls.filter((c) => c === 'gameStart')).toHaveLength(1);
    expect(f.calls).toContain('happy:level_complete');
    expect(f.calls).toContain('sad:game_over');
  });

  it('pause / resume events pause and resume the game, idempotently', () => {
    f.emit('pause');
    f.emit('pause');
    f.emit('resume');
    f.emit('resume');
    expect(pauses).toEqual([true, false]);
  });

  it('no pre-roll; interstitials only between boards', async () => {
    expect(gp.adSlot('preroll')).toBe(false);
    expect(gp.adSlot('between')).toBe(true);
    await gp.interstitial('preroll');
    expect(f.calls).not.toContain('interstitial');
  });

  it('rewarded: true only on success === true', async () => {
    let r = gp.rewarded();
    f.emit('pause');
    f.emit('resume');
    f.answer({ success: true });
    expect(await r).toBe(true);
    r = gp.rewarded();
    f.answer({ success: false, message: 'cancel' });
    expect(await r).toBe(false);
    r = gp.rewarded();
    f.fail(new Error('boom'));
    expect(await r).toBe(false);
  });

  it('settles exactly once, refuses a second concurrent request, times out when no ad starts', async () => {
    const a = gp.rewarded();
    expect(await gp.rewarded()).toBe(false);
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 1);
    expect(await a).toBe(false);
    f.answer({ success: true }); // late answer: ignored
    // the next request works again
    const b = gp.interstitial('between');
    f.answer({ success: true });
    await b;
  });

  it('an ad that started is not timed out after 8 s, and never leaves the game paused', async () => {
    const r = gp.rewarded();
    f.emit('pause');
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 4000);
    f.answer({ success: true }); // SDK forgot to send resume
    expect(await r).toBe(true);
    expect(pauses).toEqual([true, false]);
    // a hung ad releases the game after AD_MAX
    const h = gp.interstitial('between');
    f.emit('pause');
    await vi.advanceTimersByTimeAsync(AD_MAX + 1);
    await h;
    expect(pauses.at(-1)).toBe(false);
  });
});
