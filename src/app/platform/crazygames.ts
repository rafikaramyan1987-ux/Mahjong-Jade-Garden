/**
 * CrazyGames SDK v3 wrapper (https://docs.crazygames.com/sdk/html5-v3/).
 * - the SDK script is loaded once at start; `SDK.init()` is awaited (with a timeout) before the save is read,
 *   so saves go to the Data Module (localStorage fallback when the SDK is missing or disabled)
 * - loadingStart / loadingStop while the game boots; gameplayStart / gameplayStop only around real play
 *   (the game stops it in menus, dialogs, result screens and during ads); happytime when a board is solved
 * - midgame ads only between boards (the game also applies "never before the 3rd board" and "at most one per
 *   ~2 minutes"); no pre-roll on CrazyGames
 * - rewarded ads for the optional extras; the reward is granted only on adFinished
 * - every ad request settles exactly once: adFinished, adError, a throwing requestAd, or nothing started within 8 s
 * - the platform mute setting (`game.settings.muteAudio`) is respected and followed live
 * - the game works without the SDK (local file, other hosts): no ads, extras say "no ad available"
 */
import { AD_TIMEOUT, loadScript, type AdSlot, type Platform } from './types';

export const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
export const CG_SCRIPT_ID = 'crazygames-sdk';

type AdCallbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };

export interface CGSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: AdCallbacks): void };
  data?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void };
  user?: { systemInfo?: { locale?: string } };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSdk };
  }
}

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  readonly initBeforeStart = true;
  private s: CGSdk | null = null;
  private playing = false;
  private loading = false;
  private busy = false;
  muted = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};

  async init(timeoutMs = 3000) {
    try {
      if (!window.CrazyGames && !document.getElementById(CG_SCRIPT_ID)) await loadScript(CG_SDK_URL, timeoutMs, CG_SCRIPT_ID);
      const s = window.CrazyGames?.SDK;
      if (!s) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([s.init(), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('sdk timeout')), timeoutMs)))]).finally(() => clearTimeout(timer));
      if (s.environment === 'disabled') return;
      this.s = s;
      this.muted = !!s.game.settings?.muteAudio;
      s.game.addSettingsChangeListener?.((st) => {
        if (st.muteAudio === undefined) return;
        this.muted = !!st.muteAudio;
        this.onMute(this.muted);
      });
    } catch {
      /* blocked / offline / not on CrazyGames: play on without the SDK */
      this.s = null;
    }
  }

  get available() {
    return !!this.s;
  }
  locale() {
    return this.s?.user?.systemInfo?.locale ?? null;
  }
  data() {
    const d = this.s?.data;
    return d ? { getItem: (k: string) => d.getItem(k), setItem: (k: string, v: string) => d.setItem(k, v) } : null;
  }
  loadingStart() {
    if (this.loading) return;
    this.loading = true;
    this.call(() => this.s?.game.loadingStart());
  }
  loadingStop() {
    if (!this.loading) return;
    this.loading = false;
    this.call(() => this.s?.game.loadingStop());
  }
  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    this.call(() => this.s?.game.gameplayStart());
  }
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this.call(() => this.s?.game.gameplayStop());
  }
  happytime() {
    this.call(() => this.s?.game.happytime());
  }
  /** an SDK hiccup must never break the game */
  private call(f: () => void) {
    try {
      f();
    } catch {
      /* ignore */
    }
  }

  /** CrazyGames: interstitials (midgame) only between boards, never a pre-roll */
  adSlot(slot: AdSlot) {
    return slot === 'between';
  }

  /**
   * Request an ad and settle exactly once: true on adFinished, false on adError, a throwing requestAd, a second
   * concurrent request, or when the ad has not started within AD_TIMEOUT. Settling always resumes the game.
   */
  private requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
    const s = this.s;
    if (!s || this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      let started = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        this.busy = false;
        clearTimeout(timer);
        if (started) this.onAdPause(false);
        res(ok);
      };
      const timer = setTimeout(() => finish(false), AD_TIMEOUT);
      try {
        s.ad.requestAd(type, {
          adStarted: () => {
            if (done || started) return;
            started = true;
            // the ad is playing: no timeout now, wait for it to finish
            clearTimeout(timer);
            this.onAdPause(true);
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  async interstitial(slot: AdSlot): Promise<void> {
    if (!this.adSlot(slot)) return;
    await this.requestAd('midgame');
  }

  async rewarded(): Promise<boolean> {
    return this.requestAd('rewarded');
  }
}
