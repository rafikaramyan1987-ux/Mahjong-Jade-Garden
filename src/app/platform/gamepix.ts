/**
 * GamePix JS SDK v3 wrapper (https://integration.gamepix.com/sdk/v3/gamepix.sdk.js, loaded by index.html in the
 * GamePix build only, with `window.GamePixConfig = { lifecycle: 'manual' }`, before the game bundle).
 * - lifecycle: `loading(0..100)` (integer, only increasing) while the game boots, `await loaded()` before the menu
 *   is shown (never longer than LOADED_TIMEOUT), `gameStart()` once, when the first board starts
 * - `pause` / `resume` events (also sent by the SDK around its ads): pause the game (clock, input) and mute all
 *   audio / resume and restore the player's own audio settings; both idempotent
 * - `soundOff` / `soundOn` events (the Player's sound button): soundOff mutes all audio WITHOUT pausing; soundOn
 *   lifts only that mute, so audio comes back only if the player's own settings allow it and no pause or ad is on
 *   (the audio gate keeps pause, ad and platform mute as separate flags). Idempotent. Older SDKs without
 *   `events.on` get the same handlers through the legacy `GamePix.on.soundOff / soundOn` callbacks.
 * - the same handlers are also assigned as the legacy properties `GamePix.soundOff / soundOn / pause / resume` (the
 *   GamePix Player checks that they are declared). When the SDK calls both the event and the property for one
 *   change, in any order, the second call of the same signal in the same tick is ignored, and every handler is
 *   idempotent, so nothing is muted, paused or resumed twice. The assignments are written as
 *   `window.GamePix.soundOff = ...` so the minified bundle keeps the literal text (checked by CI).
 * - interstitials (`GamePix.ads.interstitial()`) only between boards (no pre-roll on GamePix); rewarded ads
 *   (`GamePix.ads.reward()`) only from an explicit click; the reward only when `success === true`
 * - every ad request settles exactly once: the SDK's answer, a throwing call, a second concurrent request, or
 *   nothing started within AD_TIMEOUT
 * - happyMoment('level_complete') when a board is solved, sadMoment('game_over') at a real dead end
 * - language from `GamePix.lang()`, read once in init() (before loaded()) and cached; the save stays in plain localStorage (synchronised by the SDK)
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
  events: { on(name: 'pause' | 'resume' | 'soundOff' | 'soundOn', fn: () => void): void };
  /** legacy SDK callbacks (assigned by the game, called by the SDK) */
  on?: { pause?: () => void; resume?: () => void; soundOff?: () => void; soundOn?: () => void };
  ads: { interstitial(): Promise<GPXAdResult>; reward(): Promise<GPXAdResult> };
  happyMoment?(name: string): void;
  sadMoment?(name: string): void;
  /** legacy properties the Player checks for (assigned by the game, called by the SDK / Player) */
  soundOff?: () => void;
  soundOn?: () => void;
  pause?: () => void;
  resume?: () => void;
}

type GPXSignal = 'pause' | 'resume' | 'soundOff' | 'soundOn';

declare global {
  interface Window {
    GamePix?: GPXSdk;
    GamePixConfig?: { lifecycle?: 'auto' | 'manual' };
  }
}

export class GamePixPlatform implements Platform {
  readonly name = 'gamepix';
  readonly initBeforeStart = true;
  /** the Player's sound is off (soundOff) */
  private soundOff = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};
  private isLoaded = false;
  private started = false;
  /** the game is paused (what the game was last told) */
  private paused = false;
  /** the Player paused the game (pause / resume events outside an ad) */
  private playerPaused = false;
  /** an ad of ours is playing (its pause event arrived while our request was in flight) */
  private adOn = false;
  private busy = false;
  /** the request in flight is told when the SDK pauses the game for its ad */
  private adStarted: (() => void) | null = null;
  private blocker: HTMLElement | null = null;
  /** signals already handled in this tick (the event and the legacy property for the same change) */
  private tick: Set<GPXSignal> | null = null;
  /** GamePix.lang(), read once in init() */
  private lang: string | null = null;

  constructor(private readonly get: () => GPXSdk | undefined = () => window.GamePix) {}

  private get s() {
    return this.get();
  }

  /** the portal's mute (soundOff from the Player); the game's audio gate adds pause, ad and the player's settings */
  get muted() {
    return this.soundOff;
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
    const on: Record<GPXSignal, () => void> = {
      pause: () => this.signal('pause', () => this.setPaused(true)),
      resume: () => this.signal('resume', () => this.setPaused(false)),
      soundOff: () => this.signal('soundOff', () => this.setSoundOff(true)),
      soundOn: () => this.signal('soundOn', () => this.setSoundOff(false)),
    };
    this.call(() => {
      s.events.on('pause', on.pause);
      s.events.on('resume', on.resume);
    });
    this.call(() => {
      if (typeof s.events?.on === 'function') {
        s.events.on('soundOff', on.soundOff);
        s.events.on('soundOn', on.soundOn);
      } else if (s.on && typeof s.on === 'object') {
        // legacy callbacks
        s.on.pause = on.pause;
        s.on.resume = on.resume;
        s.on.soundOff = on.soundOff;
        s.on.soundOn = on.soundOn;
      }
    });
    // legacy properties the Player checks for, the same handlers (written out in full so the minified bundle keeps
    // the literal `GamePix.soundOff=` text)
    this.call(() => {
      if (typeof window !== 'undefined' && window.GamePix && window.GamePix === s) {
        window.GamePix.soundOff = on.soundOff;
        window.GamePix.soundOn = on.soundOn;
        window.GamePix.pause = on.pause;
        window.GamePix.resume = on.resume;
      } else {
        s.soundOff = on.soundOff;
        s.soundOn = on.soundOn;
        s.pause = on.pause;
        s.resume = on.resume;
      }
    });
    // the Player's language, once, before loaded() ("Language used")
    this.call(() => {
      const v =
        typeof window !== 'undefined' && window.GamePix && window.GamePix === s
          ? typeof window.GamePix.lang === 'function'
            ? window.GamePix.lang()
            : null
          : typeof s.lang === 'function'
            ? s.lang()
            : null;
      if (typeof v === 'string' && v) this.lang = v;
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

  /**
   * one SDK signal: the event and the legacy property may both fire for the same change (either order); the second
   * call of the same signal within one tick is a repeat and is ignored
   */
  private signal(name: GPXSignal, f: () => void) {
    if (this.tick?.has(name)) return;
    if (!this.tick) {
      this.tick = new Set();
      void Promise.resolve().then(() => (this.tick = null));
    }
    this.tick.add(name);
    f();
  }

  /**
   * pause / resume events. While one of our ad requests is in flight, the first pause is that ad starting; any other
   * pause / resume is the Player's. Idempotent: repeated events change nothing. The game stays paused while either
   * the Player or an ad holds it.
   */
  setPaused(p: boolean) {
    if (p && this.adStarted && !this.adOn) {
      this.adOn = true;
      this.adStarted();
    } else if (!p && this.busy && this.adOn && !this.playerPaused) {
      // the ad's own resume: the ad is over for the game (the request settles on the SDK's answer)
      this.adOn = false;
    } else this.playerPaused = p;
    this.update();
  }

  /** tell the game when the overall pause state changes (never twice the same) */
  private update() {
    const p = this.playerPaused || this.adOn;
    if (this.paused === p) return;
    this.paused = p;
    this.block(p);
    this.onAdPause(p);
  }

  /**
   * The Player's sound button. soundOff mutes all audio but does not pause the game; soundOn only lifts this mute
   * (a pause, an ad or the player's own Music / Sounds settings still apply). Idempotent.
   */
  setSoundOff(off: boolean) {
    if (this.soundOff === off) return;
    this.soundOff = off;
    this.onMute(off);
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

  /** GamePix.lang(), read once in init() (null without the SDK) */
  locale() {
    return this.lang;
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
        // never leave the game paused by an ad that did not send resume (a pause of the Player's own stays)
        this.adOn = false;
        this.update();
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
