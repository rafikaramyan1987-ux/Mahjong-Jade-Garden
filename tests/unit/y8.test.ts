import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Y8Platform, Y8_APP_ID, Y8_GAME_ID, type Y8ShowAdOptions } from '../../src/app/platform/y8';
import { AD_MAX, AD_TIMEOUT } from '../../src/app/platform/types';

type Handler = (e?: unknown) => void;
/** minimal window / document with event listeners, a `y8` global and a recordable showAd */
function env(behave: (o: Y8ShowAdOptions) => Promise<unknown> | unknown = () => new Promise(() => {}), opts: { sdk?: boolean; loadedEarly?: boolean } = {}) {
  const on: Record<string, { fn: Handler; once?: boolean }[]> = {};
  const target = () => ({
    addEventListener: (t: string, fn: Handler, o?: { once?: boolean }) => (on[t] ??= []).push({ fn, once: o?.once }),
  });
  const fire = (t: string) => {
    const hs = on[t] ?? [];
    on[t] = hs.filter((h) => !h.once);
    hs.forEach((h) => h.fn());
  };
  const calls: string[] = [];
  const showAd = vi.fn((o: Y8ShowAdOptions) => {
    calls.push(`showAd:${o.type}`);
    return behave(o);
  });
  const sdk = {
    init: vi.fn((_app: unknown, ad: { onReady: () => void }) => {
      calls.push('init');
      ad.onReady();
    }),
    onAuth: vi.fn(),
    showAd,
  };
  const win = {
    ...target(),
    y8:
      opts.sdk === false
        ? undefined
        : {
            sdk: () => sdk,
            // the real SDK re-dispatches y8sdk.ready when asked (only once it has loaded)
            emitReadyEvent: () => opts.loadedEarly && fire('y8sdk.ready'),
          },
  };
  const doc = { ...target(), hidden: false, focused: true, hasFocus: () => doc.focused };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const y8 = new Y8Platform();
  const log: string[] = [];
  y8.onAdPause = (p) => log.push(p ? 'pause' : 'resume');
  return { y8, sdk, showAd, calls, log, fire, doc };
}

async function ready(e: ReturnType<typeof env>) {
  const p = e.y8.init(1000);
  e.fire('y8sdk.ready');
  await p;
}

describe('Y8 wrapper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('IDs of Mahjong Jade Garden', () => {
    expect(Y8_APP_ID).toBe('6af4b118ca1c6869a74e0363');
    expect(Y8_GAME_ID).toBe('292543');
  });

  it('init: the portal snippet (appId, autoLogin, gameId, preloadAdBreaks, sound, onReady, onAuth); no ad call before init', async () => {
    const e = env();
    await e.y8.interstitial('preroll');
    await e.y8.interstitial('between');
    expect(await e.y8.rewarded()).toBe(false);
    expect(e.showAd).not.toHaveBeenCalled();
    expect(e.y8.available).toBe(false);
    await ready(e);
    expect(e.sdk.init).toHaveBeenCalledWith(
      { appId: Y8_APP_ID, autoLogin: true },
      expect.objectContaining({ gameId: Y8_GAME_ID, preloadAdBreaks: 'on', sound: 'on', onReady: expect.any(Function) }),
    );
    expect(e.sdk.onAuth).toHaveBeenCalledTimes(1);
    expect(e.y8.available).toBe(true);
    expect(e.y8.adSystemReady).toBe(true);
    // y8sdk.ready is handled once
    e.fire('y8sdk.ready');
    expect(e.sdk.init).toHaveBeenCalledTimes(1);
  });

  it('init: an SDK that loaded first is picked up through emitReadyEvent()', async () => {
    const e = env(undefined, { loadedEarly: true });
    await e.y8.init(1000);
    expect(e.calls).toEqual(['init']);
  });

  it('init: no SDK (ad blocker) → resolves after the timeout, no ads, no rewarded buttons, never throws', async () => {
    const e = env(undefined, { sdk: false });
    const p = e.y8.init(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(e.y8.available).toBe(false);
    await e.y8.interstitial('preroll');
    expect(await e.y8.rewarded()).toBe(false);
  });

  it('interstitial: pause + mute in beforeAd, resume + restore in afterAd, settles on adBreakDone', async () => {
    let o!: Y8ShowAdOptions;
    const e = env((x) => {
      o = x;
      return new Promise(() => {});
    });
    await ready(e);
    let done = false;
    void e.y8.interstitial('preroll').then(() => (done = true));
    expect(e.showAd).toHaveBeenCalledWith(expect.objectContaining({ type: 'start' }));
    expect(e.log).toEqual([]); // no pause before the SDK says an ad starts
    o.beforeAd!();
    expect(e.log).toEqual(['pause']);
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT * 3); // a started ad may run long
    expect(done).toBe(false);
    o.afterAd!();
    expect(e.log).toEqual(['pause', 'resume']);
    o.adBreakDone!({ breakStatus: 'viewed' });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('start only on the first Play; next at every break (no cap of our own); never during gameplay', async () => {
    const e = env((o) => o.adBreakDone?.({ breakStatus: 'frequencyCapped' }));
    await ready(e);
    await e.y8.interstitial('preroll');
    await e.y8.interstitial('preroll');
    await e.y8.interstitial('between');
    await e.y8.interstitial('between');
    await e.y8.interstitial('between');
    e.y8.gameplayStart();
    await e.y8.interstitial('between');
    expect(e.calls).toEqual(['init', 'showAd:start', 'showAd:next', 'showAd:next', 'showAd:next']);
    expect(e.log).toEqual([]); // a break with no ad never paused anything: the game continues at once
  });

  it('settles exactly once: adBreakDone twice, .catch(), a throw, nothing started in AD_TIMEOUT, AD_MAX', async () => {
    for (const how of ['double', 'reject', 'throw', 'timeout', 'hung']) {
      let o!: Y8ShowAdOptions;
      const e = env((x) => {
        o = x;
        if (how === 'throw') throw new Error('boom');
        if (how === 'reject') return Promise.reject(new Error('no ad'));
        if (how === 'double') {
          x.adBreakDone!({ breakStatus: 'noAdPreloaded' });
          x.adBreakDone!({ breakStatus: 'other' });
        }
        if (how === 'hung') x.beforeAd!();
        return new Promise(() => {});
      });
      await ready(e);
      const settled: number[] = [];
      void e.y8.interstitial('between').then(() => settled.push(1));
      await vi.advanceTimersByTimeAsync(how === 'timeout' ? AD_TIMEOUT : how === 'hung' ? AD_MAX : 0);
      expect(settled, how).toEqual([1]);
      // late callbacks change nothing; the game is not left paused
      o.adBreakDone?.({});
      o.beforeAd?.();
      await vi.advanceTimersByTimeAsync(AD_MAX);
      expect(settled, how).toEqual([1]);
      expect(e.log.at(-1) ?? 'resume', how).toBe('resume');
      vi.unstubAllGlobals();
    }
  });

  it('rewarded: showAdFn() called in beforeReward; the reward only after adViewed', async () => {
    const e = env((o) => {
      o.beforeReward!(() => {
        o.beforeAd!();
        o.adViewed!();
        o.afterAd!();
        o.adBreakDone!({ breakStatus: 'viewed' });
      });
    });
    await ready(e);
    expect(await e.y8.rewarded()).toBe(true);
    expect(e.showAd).toHaveBeenCalledWith(expect.objectContaining({ type: 'reward' }));
    expect(e.log).toEqual(['pause', 'resume']);
  });

  it('rewarded: adDismissed, no ad (no beforeReward), .catch() or a timeout → no reward', async () => {
    for (const how of ['dismissed', 'noAd', 'reject', 'timeout']) {
      const e = env((o) => {
        if (how === 'reject') return Promise.reject(new Error('x'));
        if (how === 'timeout') return new Promise(() => {});
        if (how === 'noAd') return o.adBreakDone!({ breakStatus: 'noAdPreloaded' });
        o.beforeReward!(() => {
          o.beforeAd!();
          o.adDismissed!();
          o.afterAd!();
          o.adBreakDone!({ breakStatus: 'dismissed' });
        });
      });
      await ready(e);
      const r = e.y8.rewarded();
      await vi.advanceTimersByTimeAsync(AD_TIMEOUT);
      expect(await r, how).toBe(false);
      expect(e.log.at(-1) ?? 'resume', how).toBe('resume');
      vi.unstubAllGlobals();
    }
  });

  it('a hidden page or a lost focus pauses + mutes; back → resumes; an ad during it keeps the game paused', async () => {
    let o!: Y8ShowAdOptions;
    const e = env((x) => {
      o = x;
      return new Promise(() => {});
    });
    await ready(e);
    e.doc.hidden = true;
    e.fire('visibilitychange');
    expect(e.log).toEqual(['pause']);
    e.doc.hidden = false;
    e.fire('visibilitychange');
    expect(e.log).toEqual(['pause', 'resume']);
    e.log.length = 0;
    // focus that moved into a child frame (the ad player) is not a loss of focus
    e.fire('blur');
    await vi.advanceTimersByTimeAsync(0);
    expect(e.log).toEqual([]);
    e.doc.focused = false;
    e.fire('blur');
    await vi.advanceTimersByTimeAsync(0);
    expect(e.log).toEqual(['pause']);
    void e.y8.interstitial('between');
    o.beforeAd!();
    e.doc.focused = true;
    e.fire('focus');
    expect(e.log).toEqual(['pause']); // the ad still runs
    o.afterAd!();
    o.adBreakDone!({});
    expect(e.log).toEqual(['pause', 'resume']);
  });
});
