import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GD_SCRIPT_ID, GD_SDK_URL, GDPlatform, REWARD_GRACE, type GDEvent } from '../../src/app/platform/gd';
import { AD_TIMEOUT } from '../../src/app/platform/types';

/** minimal browser globals for the wrapper (node test environment) */
interface FakeScript {
  id: string;
  src: string;
  async: boolean;
  onload?: () => void;
  onerror?: () => void;
}
let scripts: FakeScript[] = [];
type ShowAd = (type?: 'interstitial' | 'rewarded') => Promise<unknown> | void;

function installDom() {
  scripts = [];
  const w: Record<string, unknown> = {};
  (globalThis as unknown as { window: unknown }).window = w;
  (globalThis as unknown as { document: unknown }).document = {
    getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
    createElement: () => ({ id: '', src: '', async: false }) as FakeScript,
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
  return w as { GD_OPTIONS?: { gameId: string; onEvent: (e: GDEvent) => void }; gdsdk?: { showAd: ShowAd } };
}

/** fire an SDK event the way the real SDK does: through GD_OPTIONS.onEvent */
function emit(w: ReturnType<typeof installDom>, name: string) {
  w.GD_OPTIONS!.onEvent({ name });
}

describe('GameDistribution wrapper', () => {
  let w: ReturnType<typeof installDom>;
  let gd: GDPlatform;
  let pauses: boolean[];

  beforeEach(async () => {
    vi.useFakeTimers();
    w = installDom();
    gd = new GDPlatform('test-game-id');
    pauses = [];
    gd.onAdPause = (p) => pauses.push(p);
    const ready = gd.init(3000);
    // the SDK script loads
    scripts[0].onload?.();
    await ready;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets GD_OPTIONS with the game id and loads main.min.js exactly once', async () => {
    expect(w.GD_OPTIONS?.gameId).toBe('test-game-id');
    expect(typeof w.GD_OPTIONS?.onEvent).toBe('function');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(GD_SDK_URL);
    expect(scripts[0].id).toBe(GD_SCRIPT_ID);
    await gd.init();
    expect(scripts).toHaveLength(1);
  });

  it('without the SDK nothing is shown and rewards are refused at once (the game plays on)', async () => {
    expect(gd.available).toBe(false);
    await expect(gd.rewarded()).resolves.toBe(false);
    await expect(gd.interstitial('preroll')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('a slow or blocked SDK script does not block the game longer than the timeout', async () => {
    const w2 = installDom();
    const g2 = new GDPlatform('x');
    let done = false;
    void g2.init(3000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(w2.gdsdk).toBeUndefined();
  });

  it('SDK_GAME_PAUSE pauses and mutes, SDK_GAME_START resumes', () => {
    emit(w, 'SDK_GAME_PAUSE');
    emit(w, 'SDK_GAME_START');
    expect(pauses).toEqual([true, false]);
  });

  it('interstitial: resolves after the ad closes', async () => {
    const show = vi.fn<ShowAd>(() => {
      emit(w, 'SDK_GAME_PAUSE');
      return new Promise((res) =>
        setTimeout(() => {
          emit(w, 'SDK_GAME_START');
          res(undefined);
        }, 5000),
      );
    });
    w.gdsdk = { showAd: show };
    let settled = false;
    const p = gd.interstitial('between').then(() => (settled = true));
    expect(show).toHaveBeenCalledWith();
    await vi.advanceTimersByTimeAsync(4000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1001);
    await p;
    expect(pauses).toEqual([true, false]);
  });

  it('rewarded: granted only after SDK_REWARDED_WATCH_COMPLETE', async () => {
    w.gdsdk = {
      showAd: vi.fn<ShowAd>((type) => {
        expect(type).toBe('rewarded');
        emit(w, 'SDK_GAME_PAUSE');
        setTimeout(() => emit(w, 'SDK_REWARDED_WATCH_COMPLETE'), 15000);
        setTimeout(() => emit(w, 'SDK_GAME_START'), 15100);
        return new Promise(() => {});
      }),
    };
    const p = gd.rewarded();
    // a long ad that has started is not cut by the 8 s timeout
    await vi.advanceTimersByTimeAsync(15001);
    await expect(p).resolves.toBe(true);
    // the game resumed (exactly one pause / resume pair)
    await vi.advanceTimersByTimeAsync(200);
    expect(pauses).toEqual([true, false]);
  });

  it('rewarded: closed early (no watch-complete event) gives no reward', async () => {
    w.gdsdk = {
      showAd: () => {
        emit(w, 'SDK_GAME_PAUSE');
        setTimeout(() => emit(w, 'SDK_GAME_START'), 3000);
      },
    };
    const p = gd.rewarded();
    await vi.advanceTimersByTimeAsync(3000 + REWARD_GRACE + 1);
    await expect(p).resolves.toBe(false);
  });

  it('settles as failed when nothing starts within 8 s, and only once', async () => {
    w.gdsdk = { showAd: () => new Promise(() => {}) };
    const results: boolean[] = [];
    const p = gd.rewarded().then((r) => results.push(r));
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT - 1);
    expect(results).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(results).toEqual([false]);
    // late events from the SDK change nothing
    emit(w, 'SDK_REWARDED_WATCH_COMPLETE');
    emit(w, 'AD_ERROR');
    await vi.advanceTimersByTimeAsync(10000);
    expect(results).toEqual([false]);
  });

  it('AD_ERROR / AD_SDK_CANCELED / a rejected showAd settle as failed and resume the game', async () => {
    for (const ev of ['AD_ERROR', 'AD_SDK_CANCELED']) {
      w.gdsdk = {
        showAd: () => {
          emit(w, 'SDK_GAME_PAUSE');
          setTimeout(() => emit(w, ev), 100);
          return new Promise(() => {});
        },
      };
      const p = gd.rewarded();
      await vi.advanceTimersByTimeAsync(101);
      await expect(p).resolves.toBe(false);
    }
    w.gdsdk = { showAd: () => Promise.reject(new Error('no fill')) };
    const p = gd.rewarded();
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe(false);
    // every pause was matched by a resume
    expect(pauses.filter((x) => x).length).toBe(pauses.filter((x) => !x).length);
  });

  it('a second request while one is pending is refused at once', async () => {
    w.gdsdk = { showAd: () => new Promise(() => {}) };
    const first = gd.rewarded();
    await expect(gd.rewarded()).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 1);
    await expect(first).resolves.toBe(false);
  });

  it('a throwing showAd settles as failed', async () => {
    w.gdsdk = {
      showAd: () => {
        throw new Error('boom');
      },
    };
    await expect(gd.rewarded()).resolves.toBe(false);
  });
});
