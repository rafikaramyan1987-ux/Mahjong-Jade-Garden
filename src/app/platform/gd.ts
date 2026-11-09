/**
 * GameDistribution HTML5 SDK wrapper (https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation).
 * - `window.GD_OPTIONS = { gameId, onEvent }` and main.min.js loaded once while the game loads (never from a click)
 * - SDK_GAME_PAUSE: pause the game and mute all audio; SDK_GAME_START: resume and restore the audio settings
 * - interstitials (`gdsdk.showAd()`) only on user input outside play: Play (pre-roll) and Next / Menu between
 *   boards, never before the 3rd board (the caller decides; see app.ts)
 * - rewarded ads (`gdsdk.showAd('rewarded')`): the reward only after SDK_REWARDED_WATCH_COMPLETE
 * - every request settles exactly once: completion, rejection / AD_ERROR / AD_SDK_CANCELED, or nothing started in 8 s
 * - if the SDK fails to load, the game stays fully playable (no ads, the extras say "no ad available")
 */
import { AD_TIMEOUT, loadScript, type AdSlot, type Platform } from './types';

declare const __GD_GAME_ID__: string;

export const GD_GAME_ID: string = typeof __GD_GAME_ID__ === 'string' ? __GD_GAME_ID__ : '';
export const GD_SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';
export const GD_SCRIPT_ID = 'gamedistribution-jssdk';
/** a rewarded ad that closed without SDK_REWARDED_WATCH_COMPLETE gets this long for a late event (ms) */
export const REWARD_GRACE = 600;

export interface GDEvent {
  name: string;
  message?: string;
  status?: string;
}
export interface GDSdk {
  showAd(type?: 'interstitial' | 'rewarded'): Promise<unknown> | void;
}

declare global {
  interface Window {
    GD_OPTIONS?: { gameId: string; onEvent: (e: GDEvent) => void };
    gdsdk?: GDSdk;
  }
}

type AdType = 'interstitial' | 'rewarded';
interface Pending {
  type: AdType;
  started: boolean;
  finish: (ok: boolean) => void;
  closed: () => void;
}

export class GDPlatform implements Platform {
  readonly name = 'gd';
  private adPaused = false;
  private pending: Pending | null = null;
  readonly initBeforeStart = false;
  readonly muted = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};
  locale() {
    return null;
  }
  loadingStart() {}
  loadingStop() {}
  happytime() {}
  /** GD: pre-roll on Play and interstitials between boards */
  adSlot(_slot: AdSlot) {
    return true;
  }

  constructor(private readonly gameId = GD_GAME_ID) {}

  async init(timeoutMs = 3000) {
    window.GD_OPTIONS = { gameId: this.gameId, onEvent: (e) => this.onEvent(e) };
    if (document.getElementById(GD_SCRIPT_ID) || window.gdsdk) return;
    try {
      await loadScript(GD_SDK_URL, timeoutMs, GD_SCRIPT_ID);
    } catch {
      /* blocked / offline / slow: play on without ads (a late load still enables them) */
    }
  }

  get available() {
    return typeof window.gdsdk?.showAd === 'function';
  }
  data() {
    return null;
  }
  gameplayStart() {}
  gameplayStop() {}

  /** SDK events (also fired for ads the SDK shows by itself) */
  onEvent(e: GDEvent) {
    const p = this.pending;
    switch (e?.name) {
      case 'SDK_GAME_PAUSE':
        if (p) p.started = true;
        this.setAdPaused(true);
        break;
      case 'SDK_GAME_START':
        this.setAdPaused(false);
        if (p?.started) p.closed();
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        if (p?.type === 'rewarded') p.finish(true);
        break;
      case 'AD_ERROR':
      case 'AD_SDK_CANCELED':
        p?.finish(false);
        break;
    }
  }

  private setAdPaused(p: boolean) {
    if (this.adPaused === p) return;
    this.adPaused = p;
    this.onAdPause(p);
  }

  /**
   * Show an ad and settle exactly once: true on completion (rewarded: SDK_REWARDED_WATCH_COMPLETE), false on
   * rejection, AD_ERROR, AD_SDK_CANCELED, a rewarded ad closed early, or nothing started within AD_TIMEOUT.
   * Settling always resumes the game and its audio.
   */
  private requestAd(type: AdType): Promise<boolean> {
    const s = window.gdsdk;
    if (!s || this.pending) return Promise.resolve(false);
    return new Promise((res) => {
      let done = false;
      let grace: ReturnType<typeof setTimeout> | undefined;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(grace);
        if (this.pending === pending) this.pending = null;
        this.setAdPaused(false);
        res(ok);
      };
      const pending: Pending = {
        type,
        started: false,
        finish,
        // the ad closed: an interstitial is complete; a rewarded ad without the watch-complete event is not
        closed: () => {
          if (type === 'interstitial') finish(true);
          else if (!done && grace === undefined) grace = setTimeout(() => finish(false), REWARD_GRACE);
        },
      };
      this.pending = pending;
      const timer = setTimeout(() => {
        if (!pending.started) finish(false);
      }, AD_TIMEOUT);
      try {
        const r = type === 'rewarded' ? s.showAd('rewarded') : s.showAd();
        if (r && typeof (r as Promise<unknown>).then === 'function')
          (r as Promise<unknown>).then(
            () => pending.closed(),
            () => finish(false),
          );
      } catch {
        finish(false);
      }
    });
  }

  async interstitial(_slot: AdSlot): Promise<void> {
    if (!this.available) return;
    await this.requestAd('interstitial');
  }

  async rewarded(): Promise<boolean> {
    if (!this.available) return false;
    return this.requestAd('rewarded');
  }
}
