/**
 * GamePix JS SDK v3 wrapper (https://integration.gamepix.com/sdk/v3/gamepix.sdk.js, loaded by index.html in the
 * GamePix build only, with `window.GamePixConfig = { lifecycle: 'manual' }`, before the game bundle).
 * - lifecycle: `loading(0..100)` (integer, only increasing) while the game boots, `await loaded()` before the menu
 *   is shown (never longer than LOADED_TIMEOUT), `gameStart()` once, when the first board starts
 * - `pause` / `resume` events (also sent by the SDK around its ads): pause the game (clock, input) and mute all
 *   audio / resume and restore the player's own audio settings; both idempotent
 * - interstitials (`GamePix.ads.interstitial()`) only between boards (no pre-roll on GamePix); rewarded ads
 *   (`GamePix.ads.reward()`) only from an explicit click; the reward only when `success === true`
 * - every ad request settles exactly once: the SDK's answer, a throwing call, a second concurrent request, or
 *   nothing started within AD_TIMEOUT
 * - happyMoment('level_complete') when a board is solved, sadMoment('game_over') at a real dead end
 * - language from `GamePix.lang()`; the save stays in plain localStorage (synchronised by the SDK)
 * - without the SDK (blocked, offline) the game plays on: no ads, the extras say "no ad available"
 */
import { gpxLoading } from './gamepixLoading';
import { AD_TIMEOUT, type AdSlot, type Platform } from './types';

export const GPX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
/** loaded() resolves even without a Player; this is only a safety net so the menu always appears */
export const LOADED_TIMEOUT = 5000;
/** an ad that started but never answers releases the game after this long (ms) */
export const AD_MAX = 120_000;

export interface GPXAdResult {
  success: boolean;
  message?: string;
}
export interface GPXSdk {
  lang?(): string;
  lifecycle: { loading(p: number): void; loaded(): Promise<unknown>; gameStart(): void };
  events: { on(name: 'pause' | 'resume', fn: () => void): void };
  ads: { interstitial(): Promise<GPXAdResult>; reward(): Promise<GPXAdResult> };
  happyMoment?(name: string): void;
  sadMoment?(name: string): void;
}

declare global {
  interface Window {
    GamePix?: GPXSdk;
    GamePixConfig?: { lifecycle?: 'auto' | 'manual' };
  }
}

export class GamePixPlatform implements Platform {
  readonly name = 'gamepix';
  readonly initBeforeStart = true;
  readonly muted = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};
  private isLoaded = false;
  private started = false;
  private paused = false;
  private busy = false;
  /** the request in flight is told when the SDK pauses the game for its ad */
  private adStarted: (() => void) | null = null;
  private blocker: HTMLElement | null = null;

  constructor(private readonly get: () => GPXSdk | undefined = () => window.GamePix) {}

  private get s() {
    return this.get();
  }

  get available() {
    return this.isLoaded && !!this.s?.ads;
  }

  loading(p: number) {
    if (this.s) gpxLoading(p);
  }

  /** pause / resume handlers, then `loaded()` (the game can be shown); never throws, never blocks long */
  async init(timeoutMs = LOADED_TIMEOUT) {
    const s = this.s;
    if (!s) return;
    this.call(() => {
      s.events.on('pause', () => this.setPaused(true));
      s.events.on('resume', () => this.setPaused(false));
    });
    this.loading(100);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.resolve().then(() => s.lifecycle.loaded()), new Promise((res) => (timer = setTimeout(res, timeoutMs)))]);
    } catch {
      /* the game is shown anyway */
    } finally {
      clearTimeout(timer);
    }
    this.isLoaded = true;
  }

  /** the Player (or an ad) pauses / resumes the game. Idempotent: repeated calls change nothing. */
  setPaused(p: boolean) {
    if (p && this.adStarted) this.adStarted();
    if (this.paused === p) return;
    this.paused = p;
    this.block(p);
    this.onAdPause(p);
  }

  /** while paused nothing in the game takes input (the ad or the Player is on top) */
  private block(on: boolean) {
    if (on && !this.blocker && typeof document !== 'undefined') {
      const b = document.createElement('div');
      b.dataset.testid = 'gpx-pause';
      b.style.cssText = 'position:fixed;inset:0;z-index:50;background:transparent;touch-action:none';
      for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'wheel'])
        b.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      document.body.append(b);
      this.blocker = b;
    } else if (!on && this.blocker) {
      this.blocker.remove();
      this.blocker = null;
    }
  }

  locale() {
    let l: string | null = null;
    this.call(() => {
      const v = this.s?.lang?.();
      if (typeof v === 'string' && v) l = v;
    });
    return l;
  }
  /** plain localStorage (the SDK synchronises it) */
  data() {
    return null;
  }
  loadingStart() {
    this.loading(1);
  }
  loadingStop() {}
  /** the first board starts: gameStart() once per session */
  gameplayStart() {
    if (this.started || !this.isLoaded) return;
    this.started = true;
    this.call(() => this.s?.lifecycle.gameStart());
  }
  gameplayStop() {}
  happytime() {
    this.happyMoment('level_complete');
  }
  happyMoment(name: string) {
    if (this.isLoaded) this.call(() => this.s?.happyMoment?.(name));
  }
  sadMoment(name: string) {
    if (this.isLoaded) this.call(() => this.s?.sadMoment?.(name));
  }
  /** an SDK hiccup must never break the game */
  private call(f: () => void) {
    try {
      f();
    } catch {
      /* ignore */
    }
  }

  /** GamePix has no pre-roll: interstitials only between boards */
  adSlot(slot: AdSlot) {
    return slot === 'between';
  }

  /**
   * Ask the SDK for an ad and settle exactly once: true only on `{ success: true }`; false on success !== true,
   * a rejection, a throwing call, a second concurrent request, or no ad started (no pause) and no answer within
   * AD_TIMEOUT. The SDK pauses / resumes the game around its ad; settling always leaves the game resumed.
   */
  private requestAd(type: 'interstitial' | 'reward'): Promise<boolean> {
    const s = this.s;
    if (!s || !this.isLoaded || this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        this.busy = false;
        this.adStarted = null;
        clearTimeout(timer);
        // never leave the game paused by an ad that did not send resume
        this.setPaused(false);
        res(ok);
      };
      let timer = setTimeout(() => finish(false), AD_TIMEOUT);
      // the ad is playing: no 8 s timeout now, only a long safety net
      this.adStarted = () => {
        this.adStarted = null;
        clearTimeout(timer);
        timer = setTimeout(() => finish(false), AD_MAX);
      };
      try {
        const r = type === 'reward' ? s.ads.reward() : s.ads.interstitial();
        Promise.resolve(r).then(
          (v) => finish(!!v && v.success === true),
          () => finish(false),
        );
      } catch {
        finish(false);
      }
    });
  }

  async interstitial(slot: AdSlot): Promise<void> {
    if (!this.adSlot(slot)) return;
    await this.requestAd('interstitial');
  }

  async rewarded(): Promise<boolean> {
    return this.requestAd('reward');
  }
}
