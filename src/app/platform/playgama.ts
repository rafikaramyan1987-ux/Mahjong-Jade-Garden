/**
 * Playgama Bridge (https://github.com/Playgama/bridge) wrapper. index.html of the Playgama build loads Bridge from
 * Playgama's CDN (https://bridge.playgama.com/v2/stable/playgama-bridge.js) as its first script and initializes it
 * before the game bundle runs (vite.config.ts, scripts/playgama/boot.js); outside Playgama, Bridge runs its mock
 * platform (no ads, local storage).
 * - init: `bridge.initialize()` (called by index.html's boot script before the game bundle runs, see initBridge),
 *   then `platform.language` (Bridge's own fallback is the browser language; the game falls back to English; a language the player picked in Settings wins), the save through Bridge Storage (one
 *   `storage.get([...])` of every key), `platform.isAudioEnabled`, and the AUDIO_STATE_CHANGED / PAUSE_STATE_CHANGED
 *   events
 * - `game_ready` once the loading screen is gone and the player can play (`gameReady()`, called by main.ts)
 * - gameplay start → `level_started` (once per board); a cleared board → `level_completed` (`levelEnd()`, app.ts);
 *   Bridge has no gameplay start / stop
 * - interstitials (`advertisement.showInterstitial()`) only at the Next / Journey / Menu break after a cleared board,
 *   with the game's own rules (app.ts: never before the 3rd board is cleared, at most one per ~2 minutes,
 *   MIDGAME_GAP) plus `minimumDelayBetweenInterstitial: 120` in playgama-bridge-config.json; never during a board,
 *   no pre-roll
 * - rewarded (`advertisement.showRewarded()`) only from the labelled "Watch an ad: +1 …" buttons; `available` is
 *   Bridge's `isRewardedSupported` and app.ts hides those buttons when it is false; the reward is granted only when
 *   Bridge reports the `rewarded` state before `closed`; closed / failed without it: no reward ("No ad available")
 * - every ad request settles exactly once (closed / failed, or not opened within AD_TIMEOUT)
 * - an ad opening, Bridge's pause state and the page being hidden pause the board and mute all audio (the
 *   AudioContext is suspended); Bridge's audio state mutes without pausing; audio comes back only when nothing keeps
 *   the game silent, and then through the player's own music / sound settings (audio.ts)
 * - no context menu / touch callout on a long press (Playgama 1.4.5)
 */

import { AD_TIMEOUT, type AdSlot, type KeyValueStore, type Platform } from './types';

/** every storage key the game uses (src/app/save.ts SAVE_KEY), read in one `storage.get([...])` at startup */
export const PLAYGAMA_STORAGE_KEYS = ['mahjongjadegarden.save.v1'];

/**
 * Bridge after `bridge.initialize()`, or null when it failed (logged with console.error, never silent; the game then
 * plays on without the SDK). In the Playgama build index.html's boot script (scripts/playgama/boot.js) already called
 * initialize() and started the game only once it settled: its outcome is `window.__playgamaBridgeInit`. No timeout of
 * the game's own: Bridge settles the promise itself (Playgama: wait for initialization before anything else).
 */
export async function initBridge(): Promise<BridgeSdk | null> {
  if (typeof window === 'undefined') return null;
  const b = window.bridge;
  if (!b?.initialize) {
    console.error('[Playgama Bridge] window.bridge is missing: the game runs WITHOUT Playgama Bridge (no ads, no Bridge storage, no game_ready)');
    return null;
  }
  const booted = window.__playgamaBridgeInit;
  const err = booted
    ? await booted
    : await b.initialize().then(
        () => null,
        (e: unknown) => e ?? new Error('bridge.initialize() rejected'),
      );
  if (err) {
    // the boot script has logged it already
    if (!booted) console.error('[Playgama Bridge] bridge.initialize() failed; the game runs WITHOUT Playgama Bridge (no ads, no Bridge storage, no game_ready):', err);
    return null;
  }
  return b;
}

type Listener = (v: never) => void;
export interface BridgeSdk {
  initialize(): Promise<unknown>;
  EVENT_NAME: Record<'INTERSTITIAL_STATE_CHANGED' | 'REWARDED_STATE_CHANGED' | 'AUDIO_STATE_CHANGED' | 'PAUSE_STATE_CHANGED', string>;
  platform: {
    id: string;
    language: string;
    isAudioEnabled: boolean;
    sendMessage(message: string, options?: Record<string, unknown>): unknown;
    on(event: string, fn: Listener): void;
  };
  advertisement: {
    isInterstitialSupported: boolean;
    isRewardedSupported: boolean;
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    on(event: string, fn: Listener): void;
  };
  storage: {
    get(keys: string[]): Promise<unknown[]>;
    set(key: string, value: string): Promise<unknown>;
  };
}

declare global {
  interface Window {
    bridge?: BridgeSdk;
    /** the Playgama platform, for scripts/playgama/test.mjs */
    __playgama?: PlaygamaPlatform;
    /** set by the Playgama build's boot script: bridge.initialize()'s outcome (null = initialized, else the error) */
    __playgamaBridgeInit?: Promise<unknown>;
  }
}

type PauseReason = 'sdk' | 'hidden' | 'ad';
type AdType = 'interstitial' | 'rewarded';
interface Pending {
  type: AdType;
  opened: boolean;
  earned: boolean;
  finish: (ok: boolean) => void;
}

export class PlaygamaPlatform implements Platform {
  readonly name = 'playgama';
  /** the save lives in Bridge Storage: read it before the game starts */
  readonly initBeforeStart = true;
  private b: BridgeSdk | null = null;
  private playing = false;
  private levelOn = false;
  private readySent = false;
  /** gameplay messages waiting for game_ready (see send) */
  private held: string[] = [];
  private pausedBy = new Set<PauseReason>();
  paused = false;
  /** Bridge says the platform's audio is off (independent of pauses) */
  private soundOff = false;
  private lang: string | null = null;
  private store: KeyValueStore | null = null;
  private pending: Pending | null = null;
  muted = false;
  /** what was sent to / received from Bridge (messages, ad states), for scripts/playgama/test.mjs */
  readonly log: string[] = [];
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};

  async init() {
    if (typeof window !== 'undefined') window.__playgama = this;
    this.b = await initBridge();
    const s = this.b;
    if (s) {
      try {
        this.lang = s.platform.language || null;
      } catch {
        this.lang = null;
      }
      await this.loadStore(s);
      const E = s.EVENT_NAME;
      try {
        this.soundOff = s.platform.isAudioEnabled === false;
        s.platform.on(E.AUDIO_STATE_CHANGED, ((on: boolean) => this.setSound(on !== false)) as Listener);
        s.platform.on(E.PAUSE_STATE_CHANGED, ((p: boolean) => this.setPaused('sdk', !!p)) as Listener);
        s.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, ((st: string) => this.onAdState('interstitial', st)) as Listener);
        s.advertisement.on(E.REWARDED_STATE_CHANGED, ((st: string) => this.onAdState('rewarded', st)) as Listener);
      } catch {
        /* no events: play on */
      }
      this.updateMute();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.setPaused('hidden', document.hidden));
      // Playgama 1.4.5: a long press on the game opens no context menu, callout or magnifier
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.documentElement?.style?.setProperty('-webkit-touch-callout', 'none');
    }
  }

  /** every key in one `storage.get([...])`, kept in memory; writes go to Bridge Storage (its default storage type) */
  private async loadStore(s: BridgeSdk) {
    const mem = new Map<string, string>();
    try {
      const vals = await s.storage.get(PLAYGAMA_STORAGE_KEYS);
      PLAYGAMA_STORAGE_KEYS.forEach((k, i) => {
        const v = Array.isArray(vals) ? vals[i] : null;
        if (v !== null && v !== undefined) mem.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      });
    } catch {
      /* nothing saved yet / storage unavailable: defaults */
    }
    this.store = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        if (mem.get(k) === v) return;
        mem.set(k, v);
        try {
          void Promise.resolve(s.storage.set(k, v)).catch(() => {});
        } catch {
          /* keep playing; the in-memory copy stays */
        }
      },
    };
  }

  /** rewarded ads exist here: Bridge is up and supports them (otherwise app.ts hides the rewarded buttons) */
  get available() {
    try {
      return !!this.b && this.b.advertisement.isRewardedSupported === true;
    } catch {
      return false;
    }
  }

  /** pause the board + mute; idempotent, reasons tracked separately */
  setPaused(reason: PauseReason, on: boolean) {
    if (on === this.pausedBy.has(reason)) return;
    if (on) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    const p = this.pausedBy.size > 0;
    if (p !== this.paused) {
      this.paused = p;
      this.onAdPause(p);
    }
    this.updateMute();
  }

  /** the platform's audio state: off mutes (no pause), on restores only if nothing else keeps the game silent */
  setSound(on: boolean) {
    if (this.soundOff === !on) return;
    this.soundOff = !on;
    this.updateMute();
  }

  private updateMute() {
    const m = this.paused || this.soundOff;
    if (m === this.muted) return;
    this.muted = m;
    this.onMute(m);
  }

  private onAdState(type: AdType, state: string) {
    this.log.push(`${type}:${state}`);
    const p = this.pending;
    if (!p || p.type !== type) return;
    if (state === 'opened') {
      p.opened = true;
      this.setPaused('ad', true);
    } else if (state === 'rewarded') p.earned = true;
    else if (state === 'closed') p.finish(type === 'rewarded' ? p.earned : true);
    else if (state === 'failed') p.finish(false);
  }

  locale() {
    return this.lang;
  }
  data() {
    return this.store;
  }
  loadingStart() {}
  loadingStop() {}
  /** the loading screen is gone and the player can play: Bridge's `game_ready`, once */
  gameReady() {
    if (this.readySent || !this.b) return;
    this.readySent = true;
    this.send('game_ready');
    // gameplay messages sent while the loading screen was still up (a new player's board 1 starts behind it) follow
    // game_ready, in their order
    for (const m of this.held.splice(0)) this.send(m);
  }
  gameplayStart() {
    this.playing = true;
    if (this.levelOn) return;
    this.levelOn = true;
    this.send('level_started');
  }
  gameplayStop() {
    this.playing = false;
  }
  /** a board ended (result screen): the next gameplayStart is a new level */
  levelEnd(won: boolean) {
    if (!this.levelOn) return;
    this.levelOn = false;
    this.send(won ? 'level_completed' : 'level_failed');
  }
  happytime() {}
  sadMoment() {}
  /**
   * Every Bridge message goes through here. Playgama: `game_ready` comes first, so any gameplay message (level_started,
   * level_completed, …) before it is held and sent right after it.
   */
  private send(m: string) {
    if (!this.b) return;
    if (m !== 'game_ready' && !this.readySent) {
      this.held.push(m);
      return;
    }
    this.log.push(m);
    try {
      void Promise.resolve(this.b?.platform.sendMessage(m)).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /** Show an ad and settle exactly once: closed / failed, or not opened within AD_TIMEOUT. Resumes the game after. */
  private requestAd(type: AdType): Promise<boolean> {
    const s = this.b;
    if (!s || this.pending) return Promise.resolve(false);
    return new Promise((res) => {
      let done = false;
      const pending: Pending = {
        type,
        opened: false,
        earned: false,
        finish: (ok) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (this.pending === pending) this.pending = null;
          this.setPaused('ad', false);
          res(ok);
        },
      };
      this.pending = pending;
      const timer = setTimeout(() => {
        if (!pending.opened) pending.finish(false);
      }, AD_TIMEOUT);
      try {
        if (type === 'rewarded') s.advertisement.showRewarded();
        else s.advertisement.showInterstitial();
      } catch {
        pending.finish(false);
      }
    });
  }

  /** no pre-roll: Play on the title starts at once. Interstitials only at the break after a cleared board. */
  adSlot(slot: AdSlot) {
    return slot === 'between';
  }

  /** Interstitial between boards (app.ts decides when: 3+ boards cleared, MIDGAME_GAP). Never in a board, one at a time. */
  async interstitial(slot: AdSlot): Promise<void> {
    if (!this.adSlot(slot) || this.playing || !this.b || this.pending) return;
    try {
      if (!this.b.advertisement.isInterstitialSupported) return;
    } catch {
      return;
    }
    await this.requestAd('interstitial');
  }

  /** Rewarded ad; true only when Bridge reported the `rewarded` state before the ad closed. */
  async rewarded(): Promise<boolean> {
    if (!this.available) return false;
    return this.requestAd('rewarded');
  }
}
