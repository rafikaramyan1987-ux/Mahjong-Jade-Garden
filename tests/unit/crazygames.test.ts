import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CG_SCRIPT_ID, CG_SDK_URL, CrazyGamesPlatform, type CGSdk } from '../../src/app/platform/crazygames';
import { AD_TIMEOUT } from '../../src/app/platform/types';

interface FakeScript {
  id: string;
  src: string;
  async: boolean;
  onload?: () => void;
  onerror?: () => void;
}
type Cb = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };

let scripts: FakeScript[] = [];
function installDom() {
  scripts = [];
  const w: Record<string, unknown> = {};
  (globalThis as unknown as { window: unknown }).window = w;
  (globalThis as unknown as { document: unknown }).document = {
    getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
    createElement: () => ({ id: '', src: '', async: false }) as FakeScript,
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
  return w as { CrazyGames?: { SDK: CGSdk } };
}

/** a fake SDK v3 recording every call */
function fakeSdk(env: CGSdk['environment'] = 'crazygames') {
  const calls: string[] = [];
  let listener: ((s: { muteAudio?: boolean }) => void) | null = null;
  const store = new Map<string, string>();
  const sdk = {
    environment: env,
    init: vi.fn(async () => {}),
    game: {
      gameplayStart: () => calls.push('gameplayStart'),
      gameplayStop: () => calls.push('gameplayStop'),
      loadingStart: () => calls.push('loadingStart'),
      loadingStop: () => calls.push('loadingStop'),
      happytime: () => calls.push('happytime'),
      settings: { muteAudio: false },
      addSettingsChangeListener: (cb: (s: { muteAudio?: boolean }) => void) => (listener = cb),
    },
    ad: { requestAd: vi.fn<(type: 'midgame' | 'rewarded', cb: Cb) => void>() },
    data: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    user: { systemInfo: { locale: 'fr-FR' } },
  };
  return { sdk, calls, store, setMute: (m: boolean) => listener?.({ muteAudio: m }) };
}

describe('CrazyGames SDK v3 wrapper', () => {
  let w: ReturnType<typeof installDom>;
  let cg: CrazyGamesPlatform;
  let f: ReturnType<typeof fakeSdk>;
  let pauses: boolean[];

  beforeEach(async () => {
    vi.useFakeTimers();
    w = installDom();
    f = fakeSdk();
    cg = new CrazyGamesPlatform();
    pauses = [];
    cg.onAdPause = (p) => pauses.push(p);
    const ready = cg.init(3000);
    // the SDK script loads and defines window.CrazyGames
    w.CrazyGames = { SDK: f.sdk as unknown as CGSdk };
    scripts[0].onload?.();
    await ready;
  });
  afterEach(() => vi.useRealTimers());

  it('loads the SDK v3 script once and initialises it', async () => {
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(CG_SDK_URL);
    expect(scripts[0].id).toBe(CG_SCRIPT_ID);
    expect(f.sdk.init).toHaveBeenCalledTimes(1);
    expect(cg.available).toBe(true);
    expect(cg.initBeforeStart).toBe(true);
    await cg.init();
    expect(scripts).toHaveLength(1);
  });

  it('loading / gameplay events are de-duplicated; happytime passes through', () => {
    cg.loadingStart();
    cg.loadingStart();
    cg.loadingStop();
    cg.gameplayStart();
    cg.gameplayStart();
    cg.gameplayStop();
    cg.gameplayStop();
    cg.happytime();
    expect(f.calls).toEqual(['loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'happytime']);
  });

  it('saves go to the Data Module; locale and mute come from the platform', () => {
    const d = cg.data()!;
    d.setItem('k', 'v');
    expect(f.store.get('k')).toBe('v');
    expect(d.getItem('k')).toBe('v');
    expect(cg.locale()).toBe('fr-FR');
    const mutes: boolean[] = [];
    cg.onMute = (m) => mutes.push(m);
    f.setMute(true);
    f.setMute(false);
    expect(mutes).toEqual([true, false]);
    expect(cg.muted).toBe(false);
  });

  it('interstitials only between boards (no pre-roll on CrazyGames)', async () => {
    expect(cg.adSlot('preroll')).toBe(false);
    expect(cg.adSlot('between')).toBe(true);
    await cg.interstitial('preroll');
    expect(f.sdk.ad.requestAd).not.toHaveBeenCalled();
    f.sdk.ad.requestAd.mockImplementation((type, cb) => {
      expect(type).toBe('midgame');
      cb.adStarted?.();
      setTimeout(() => cb.adFinished?.(), 15000);
    });
    const p = cg.interstitial('between');
    // a started ad is not cut by the 8 s timeout
    await vi.advanceTimersByTimeAsync(15001);
    await p;
    expect(pauses).toEqual([true, false]);
  });

  it('rewarded: true only after adFinished', async () => {
    f.sdk.ad.requestAd.mockImplementation((type, cb) => {
      expect(type).toBe('rewarded');
      cb.adStarted?.();
      setTimeout(() => cb.adFinished?.(), 20000);
    });
    const p = cg.rewarded();
    await vi.advanceTimersByTimeAsync(20001);
    await expect(p).resolves.toBe(true);
    expect(pauses).toEqual([true, false]);
  });

  it('adError, a throwing requestAd and no start within 8 s all settle as "no ad", exactly once', async () => {
    f.sdk.ad.requestAd.mockImplementation((_t, cb) => setTimeout(() => cb.adError?.('no fill'), 100));
    const a = cg.rewarded();
    await vi.advanceTimersByTimeAsync(101);
    await expect(a).resolves.toBe(false);

    f.sdk.ad.requestAd.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(cg.rewarded()).resolves.toBe(false);

    let late: Cb = {};
    f.sdk.ad.requestAd.mockImplementation((_t, cb) => (late = cb));
    const results: boolean[] = [];
    const c = cg.rewarded().then((r) => results.push(r));
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT - 1);
    expect(results).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    await c;
    expect(results).toEqual([false]);
    // late callbacks change nothing
    late.adStarted?.();
    late.adFinished?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(results).toEqual([false]);
    // no ad ever started, so the game was never paused
    expect(pauses).toEqual([]);
  });

  it('a second request while one is pending is refused at once', async () => {
    f.sdk.ad.requestAd.mockImplementation(() => {});
    const first = cg.rewarded();
    await expect(cg.rewarded()).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 1);
    await expect(first).resolves.toBe(false);
  });
});

describe('CrazyGames wrapper without the SDK', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a blocked script: init gives up within the timeout, the game plays on, rewards say "no ad"', async () => {
    installDom();
    const cg = new CrazyGamesPlatform();
    let done = false;
    void cg.init(3000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(3001);
    expect(done).toBe(true);
    expect(cg.available).toBe(false);
    expect(cg.data()).toBeNull();
    await expect(cg.rewarded()).resolves.toBe(false);
    cg.gameplayStart();
    cg.happytime();
  });

  it('environment "disabled" (not on CrazyGames): no ads, localStorage saves', async () => {
    const w = installDom();
    const f = fakeSdk('disabled');
    w.CrazyGames = { SDK: f.sdk as unknown as CGSdk };
    const cg = new CrazyGamesPlatform();
    await cg.init();
    expect(cg.available).toBe(false);
    expect(cg.data()).toBeNull();
  });
});
