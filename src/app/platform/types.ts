/**
 * The platform layer: everything the game needs from a web-game portal (ads, pause/mute events, saves).
 * One implementation per portal, chosen at build time (`__PLATFORM__`, see vite.config.ts). To add a portal
 * (e.g. Samsung Instant Plays), add its name to PLATFORMS in vite.config.ts, implement `Platform` and register it
 * in src/app/sdk.ts.
 */

export type PlatformName = 'web' | 'gd';

/**
 * Where an interstitial may be requested. All are outside play and follow a user input:
 * - `preroll`: Play on the title screen
 * - `between`: Next / Menu on the board-complete screen
 */
export type AdSlot = 'preroll' | 'between';

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface Platform {
  readonly name: PlatformName;
  /** load / init the portal SDK; never throws, never blocks longer than about `timeoutMs` */
  init(timeoutMs?: number): Promise<void>;
  /** an ad SDK is loaded and can be asked for ads */
  readonly available: boolean;
  /** an ad started (true) / ended (false): pause the game and mute all audio / resume and restore audio */
  onAdPause: (paused: boolean) => void;
  /** portal storage, or null for localStorage */
  data(): KeyValueStore | null;
  gameplayStart(): void;
  gameplayStop(): void;
  /** interstitial. Resolves once the ad is done, skipped, failed or timed out. */
  interstitial(slot: AdSlot): Promise<void>;
  /** rewarded ad; resolves true only if the reward was earned */
  rewarded(): Promise<boolean>;
}

/** an ad that has not started after this long is treated as unavailable (ms) */
export const AD_TIMEOUT = 8000;

export function loadScript(src: string, timeoutMs: number, id?: string) {
  return new Promise<void>((res, rej) => {
    const el = document.createElement('script');
    if (id) el.id = id;
    el.src = src;
    el.async = true;
    const to = setTimeout(() => rej(new Error('timeout')), timeoutMs);
    el.onload = () => {
      clearTimeout(to);
      res();
    };
    el.onerror = () => {
      clearTimeout(to);
      rej(new Error('load failed'));
    };
    document.head.appendChild(el);
  });
}
