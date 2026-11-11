/**
 * GameMonetize.com HTML5 SDK wrapper (https://github.com/GameMonetize/GameMonetize.com-SDK).
 * - `window.SDK_OPTIONS = { gameId, onEvent }`, then https://api.gamemonetize.com/sdk.js injected once while the game
 *   boots (never from a click), as the README's loader does it: a `<script id="gamemonetize-sdk">` inserted before the
 *   first script of the page, only if no element with that id exists yet
 * - SDK_GAME_PAUSE: pause the game and mute all audio; SDK_GAME_START: resume and restore audio through the player's
 *   own Music / Sounds settings (app.ts onAdPause → audio.setAdMuted); SDK_READY: interstitials may be shown
 * - interstitials (`sdk.showBanner()`) only at the same breaks as the GD build, each one after a player click and
 *   outside play: Play on the title (pre-roll, once per session) and Next / Journey / Menu on a cleared board's result
 *   screen (from the 3rd cleared board on, see app.ts). At most one per ~2 minutes; never during a board, never on
 *   a timer
 * - every request settles exactly once: SDK_GAME_START, a throwing showBanner(), nothing started within AD_TIMEOUT
 *   (8 s), or AD_MAX in all
 * - rewarded: the SDK has no rewarded API (no completion event), so `available` is false and every "watch an ad"
 *   button is hidden in this build; showBanner() is never used as a fake rewarded ad
 * - saves use localStorage; if the SDK fails to load (ad blocker, offline) the game plays on without ads
 */
import { AD_GAP, AD_MAX, AD_TIMEOUT, type AdSlot, type Platform } from './types';

/** GameMonetize game ID of Mahjong Jade Garden (only in the GameMonetize build: the other builds drop this module) */
export const GM_GAME_ID = 'ux7a998kv63s60z7m9q5dbm2241i0e09';
export const GM_SDK_URL = 'https://api.gamemonetize.com/sdk.js';
export const GM_SCRIPT_ID = 'gamemonetize-sdk';

export interface GMEvent {
  name: string;
  message?: string;
  status?: string;
}
export interface GMSdk {
  showBanner(): unknown;
}

declare global {
  interface Window {
    SDK_OPTIONS?: { gameId: string; onEvent: (e: GMEvent) => void };
    sdk?: GMSdk;
  }
}

interface Pending {
  started: boolean;
  finish: () => void;
}

export class GameMonetizePlatform implements Platform {
  readonly name = 'gamemonetize';
  readonly initBeforeStart = false;
  readonly muted = false;
  /** no rewarded ads on GameMonetize: the game hides every rewarded button */
  readonly available = false;
  private sdkReady = false;
  private playing = false;
  private adPaused = false;
  private lastAdAt = -Infinity;
  private pending: Pending | null = null;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};

  constructor(private readonly gameId = GM_GAME_ID) {}

  /** the README loader: SDK_OPTIONS first, then sdk.js once. Waits for the script at most `timeoutMs`; never throws. */
  async init(timeoutMs = 3000) {
    window.SDK_OPTIONS = { gameId: this.gameId, onEvent: (e) => this.onEvent(e) };
    if (document.getElementById(GM_SCRIPT_ID)) return;
    await new Promise<void>((res) => {
      const done = () => {
        clearTimeout(to);
        res();
      };
      const to = setTimeout(done, timeoutMs);
      try {
        const first = document.getElementsByTagName('script')[0];
        const el = document.createElement('script');
        el.id = GM_SCRIPT_ID;
        el.src = GM_SDK_URL;
        el.onload = done;
        el.onerror = done; // blocked / offline: play on without ads
        if (first?.parentNode) first.parentNode.insertBefore(el, first);
        else document.head.appendChild(el);
      } catch {
        done();
      }
    });
  }

  /** SDK_READY seen and `sdk.showBanner` present */
  get adsReady() {
    return this.sdkReady && typeof window.sdk?.showBanner === 'function';
  }
  locale() {
    return null;
  }
  loadingStart() {}
  loadingStop() {}
  happytime() {}
  data() {
    return null;
  }
  gameplayStart() {
    this.playing = true;
  }
  gameplayStop() {
    this.playing = false;
  }
  /** the same breaks as the GD build: pre-roll on Play and between boards */
  adSlot(_slot: AdSlot) {
    return true;
  }

  /** SDK events (also fired for ads the SDK shows by itself) */
  onEvent(e: GMEvent) {
    const p = this.pending;
    switch (e?.name) {
      case 'SDK_READY':
        this.sdkReady = true;
        break;
      case 'SDK_GAME_PAUSE':
        if (p) p.started = true;
        this.setAdPaused(true);
        break;
      case 'SDK_GAME_START':
        this.setAdPaused(false);
        // the ad is over (or there was none to show): the request settles
        p?.finish();
        break;
      case 'SDK_ERROR':
      case 'AD_ERROR':
        p?.finish();
        break;
    }
  }

  private setAdPaused(p: boolean) {
    if (this.adPaused === p) return;
    this.adPaused = p;
    this.onAdPause(p);
  }

  /** showBanner() and settle exactly once: SDK_GAME_START, an error, a throw, nothing started in AD_TIMEOUT, or AD_MAX */
  private requestAd(): Promise<void> {
    const s = window.sdk;
    if (!s || this.pending) return Promise.resolve();
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(notStarted);
        clearTimeout(cap);
        if (this.pending === pending) this.pending = null;
        this.setAdPaused(false);
        res();
      };
      const pending: Pending = { started: false, finish };
      this.pending = pending;
      const notStarted = setTimeout(() => {
        if (!pending.started) finish();
      }, AD_TIMEOUT);
      const cap = setTimeout(finish, AD_MAX);
      try {
        s.showBanner();
      } catch {
        finish();
      }
    });
  }

  /** an interstitial at a break the game chose (after a click, outside play); at most one per AD_GAP */
  async interstitial(_slot: AdSlot): Promise<void> {
    if (!this.adsReady || this.playing || this.pending) return;
    if (Date.now() - this.lastAdAt < AD_GAP) return;
    this.lastAdAt = Date.now();
    await this.requestAd();
  }

  /** no rewarded API in the GameMonetize SDK: never shows an ad, never grants a reward */
  async rewarded(): Promise<boolean> {
    return false;
  }
}
