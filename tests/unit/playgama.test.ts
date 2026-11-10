import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaygamaPlatform, PLAYGAMA_STORAGE_KEYS, type BridgeSdk } from '../../src/app/platform/playgama';
import { AD_TIMEOUT } from '../../src/app/platform/types';
import { SAVE_KEY } from '../../src/app/save';

/** a Playgama Bridge stand-in: `ad` decides what an ad does (it emits Bridge's ad states) */
type Emit = (event: string, value: unknown) => void;
async function setup(ad: (kind: 'interstitial' | 'rewarded', emit: Emit) => void, opts: { audio?: boolean; rewarded?: boolean; saved?: string | null } = {}) {
  const handlers: Record<string, ((v: unknown) => void)[]> = {};
  const emit: Emit = (n, v) => handlers[n]?.forEach((f) => f(v));
  const on = (n: string, f: (v: unknown) => void) => (handlers[n] ??= []).push(f);
  const docListeners: (() => void)[] = [];
  const doc = { hidden: false, addEventListener: (n: string, f: () => void) => n === 'visibilitychange' && docListeners.push(f) };
  const sent: string[] = [];
  const stored: Record<string, string> = {};
  const bridge = {
    initialize: vi.fn(async () => {}),
    EVENT_NAME: { INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed', REWARDED_STATE_CHANGED: 'rewarded_state_changed', AUDIO_STATE_CHANGED: 'audio_state_changed', PAUSE_STATE_CHANGED: 'pause_state_changed' },
    platform: { id: 'playgama', language: 'fr', isAudioEnabled: opts.audio ?? true, sendMessage: vi.fn((m: string) => sent.push(m)), on },
    advertisement: {
      isInterstitialSupported: true,
      isRewardedSupported: opts.rewarded ?? true,
      showInterstitial: vi.fn(() => ad('interstitial', emit)),
      showRewarded: vi.fn(() => ad('rewarded', emit)),
      on,
    },
    storage: {
      get: vi.fn(async (keys: string[]) => keys.map((k) => (k === SAVE_KEY ? (opts.saved ?? null) : null))),
      set: vi.fn(async (k: string, v: string) => void (stored[k] = v)),
    },
  };
  vi.stubGlobal('window', { bridge: bridge as unknown as BridgeSdk });
  vi.stubGlobal('document', doc);
  const pg = new PlaygamaPlatform();
  const log: string[] = [];
  pg.onAdPause = (p) => log.push(p ? 'pause' : 'resume');
  pg.onMute = (m) => log.push(m ? 'mute' : 'unmute');
  await pg.init();
  const visibility = (hidden: boolean) => {
    doc.hidden = hidden;
    docListeners.forEach((f) => f());
  };
  return { pg, bridge, emit, log, sent, stored, visibility };
}
/** an ad that opens, plays and closes; `reward` emits the rewarded state first */
const watched =
  (reward: boolean) =>
  (kind: 'interstitial' | 'rewarded', emit: Emit) => {
    const ev = kind === 'rewarded' ? 'rewarded_state_changed' : 'interstitial_state_changed';
    emit(ev, 'loading');
    setTimeout(() => emit(ev, 'opened'), 100);
    if (reward) setTimeout(() => emit(ev, 'rewarded'), 900);
    setTimeout(() => emit(ev, 'closed'), 1000);
  };

describe('Playgama platform (Bridge)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('init: Bridge initialized, platform language, every save key read in one storage.get, writes to Bridge Storage', async () => {
    const { pg, bridge, stored } = await setup(watched(true), { saved: '{"v":1,"journey":7}' });
    expect(bridge.initialize).toHaveBeenCalledOnce();
    expect(pg.locale()).toBe('fr');
    expect(PLAYGAMA_STORAGE_KEYS).toEqual([SAVE_KEY]);
    expect(bridge.storage.get).toHaveBeenCalledOnce();
    expect(bridge.storage.get).toHaveBeenCalledWith([SAVE_KEY]);
    const st = pg.data()!;
    expect(st.getItem(SAVE_KEY)).toBe('{"v":1,"journey":7}');
    st.setItem(SAVE_KEY, '{"v":1,"journey":9}');
    st.setItem(SAVE_KEY, '{"v":1,"journey":9}'); // unchanged: no second write
    await Promise.resolve();
    expect(bridge.storage.set).toHaveBeenCalledOnce();
    expect(stored[SAVE_KEY]).toBe('{"v":1,"journey":9}');
  });

  it('game_ready once; level_started once per level, level_completed / level_failed at its end', async () => {
    const { pg, sent } = await setup(watched(true));
    pg.gameReady();
    pg.gameReady();
    pg.gameplayStart();
    pg.gameplayStop();
    pg.gameplayStart(); // resume after a pause: same level
    pg.levelEnd(true);
    pg.gameplayStart();
    pg.levelEnd(false);
    expect(sent).toEqual(['game_ready', 'level_started', 'level_completed', 'level_started', 'level_failed']);
  });

  it('a board that starts while the loading screen still shows: level_started follows game_ready', async () => {
    const { pg, sent } = await setup(watched(true));
    pg.gameplayStart();
    expect(sent).toEqual([]);
    pg.gameReady();
    pg.levelEnd(true);
    expect(sent).toEqual(['game_ready', 'level_started', 'level_completed']);
  });

  it('rewarded: granted only after the `rewarded` state; muted + paused while the ad is open, audio back after', async () => {
    const { pg, log } = await setup(watched(true));
    expect(pg.available).toBe(true);
    const p = pg.rewarded();
    await vi.advanceTimersByTimeAsync(500);
    expect(pg.muted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe(true);
    expect(pg.muted).toBe(false);
    expect(log).toEqual(['pause', 'mute', 'resume', 'unmute']);
  });

  it('rewarded: closed without the reward (cancelled) or failed → no reward', async () => {
    const { pg } = await setup(watched(false));
    const p = pg.rewarded();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toBe(false);
    const f = await setup((_kind, emit) => setTimeout(() => emit('rewarded_state_changed', 'failed'), 200));
    const q = f.pg.rewarded();
    await vi.advanceTimersByTimeAsync(300);
    expect(await q).toBe(false);
  });

  it('settles exactly once: an ad that never opens gives up after AD_TIMEOUT; late states are ignored', async () => {
    const { pg, emit } = await setup(() => {});
    const p = pg.rewarded();
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 10);
    expect(await p).toBe(false);
    emit('rewarded_state_changed', 'opened');
    emit('rewarded_state_changed', 'rewarded');
    emit('rewarded_state_changed', 'closed');
    expect(pg.muted).toBe(false);
  });

  it('no rewarded ads where Bridge has none: `available` false, rewarded() never asks Bridge', async () => {
    const { pg, bridge } = await setup(watched(true), { rewarded: false });
    expect(pg.available).toBe(false);
    expect(await pg.rewarded()).toBe(false);
    expect(bridge.advertisement.showRewarded).not.toHaveBeenCalled();
  });

  it('interstitials: between boards only (app.ts keeps the 3-board / MIDGAME_GAP rules), never in a board or as a pre-roll, one at a time', async () => {
    const { pg, bridge } = await setup(watched(false));
    expect(pg.adSlot('preroll')).toBe(false);
    expect(pg.adSlot('between')).toBe(true);
    await pg.interstitial('preroll');
    expect(bridge.advertisement.showInterstitial).not.toHaveBeenCalled();
    pg.gameplayStart();
    await pg.interstitial('between'); // in a board
    expect(bridge.advertisement.showInterstitial).not.toHaveBeenCalled();
    pg.gameplayStop();
    const p = pg.interstitial('between');
    void pg.interstitial('between'); // a second request while one is showing: ignored
    await vi.advanceTimersByTimeAsync(1500);
    await p;
    expect(bridge.advertisement.showInterstitial).toHaveBeenCalledOnce();
    expect(pg.muted).toBe(false);
  });

  it('interstitial: muted + paused while open; an interstitial that never opens settles after AD_TIMEOUT', async () => {
    const { pg, log } = await setup(watched(false));
    const p = pg.interstitial('between');
    await vi.advanceTimersByTimeAsync(500);
    expect(pg.muted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(log).toEqual(['pause', 'mute', 'resume', 'unmute']);
    const n = await setup(() => {});
    const q = n.pg.interstitial('between');
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 10);
    await q;
    expect(n.pg.muted).toBe(false);
  });

  it("platform audio off mutes without pausing; Bridge's pause and a hidden page pause + mute; restore only when nothing is left", async () => {
    const { pg, emit, log, visibility } = await setup(watched(true), { audio: false });
    expect(pg.muted).toBe(true);
    emit('audio_state_changed', true);
    expect(pg.muted).toBe(false);
    emit('pause_state_changed', true);
    visibility(true);
    expect(pg.muted).toBe(true);
    emit('pause_state_changed', false);
    expect(pg.muted).toBe(true); // still hidden
    visibility(false);
    expect(pg.muted).toBe(false);
    emit('audio_state_changed', false);
    expect(pg.muted).toBe(true);
    expect(log).toEqual(['mute', 'unmute', 'pause', 'mute', 'resume', 'unmute', 'mute']);
  });

  it('without Bridge (script blocked) the game plays on: no ads, no SDK storage', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { hidden: false, addEventListener: () => {} });
    const pg = new PlaygamaPlatform();
    await pg.init();
    expect(pg.available).toBe(false);
    expect(pg.data()).toBe(null);
    expect(await pg.rewarded()).toBe(false);
    await pg.interstitial('between');
  });
});
