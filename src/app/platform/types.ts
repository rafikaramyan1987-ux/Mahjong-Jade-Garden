/**
 * The platform layer: everything the game needs from a web-game portal (ads, pause/mute events, saves).
 * One implementation per portal, chosen at build time (`__PLATFORM__`, see vite.config.ts). To add a portal
 * (e.g. Samsung Instant Plays), add its name to PLATFORMS in vite.config.ts, implement `Platform` and register it
 * in src/app/sdk.ts. The game's own ad rules (never before the 3rd board, at most one per ~2 minutes) live in
 * app.ts and apply to every portal.
 */

export type PlatformName = 'web' | 'gd' | 'crazygames' | 'gamepix' | 'playgama' | 'gamemonetize' | 'y8';

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
  /** wait for init() before the game reads its save (the portal stores the save) */
  readonly initBeforeStart: boolean;
  /** the portal's mute setting (true = keep all audio off) and a listener for changes */
  readonly muted: boolean;
  onMute: (muted: boolean) => void;
  /** the portal's language for the player, e.g. "fr-FR" (null = unknown) */
  locale(): string | null;
  /** the game is loading its assets (shown on the portal) */
  loadingStart(): void;
  loadingStop(): void;
  /** a moment of joy (a board was solved) */
  happytime(): void;
  /** a sad moment (a real dead end); only portals that track it implement this */
  sadMoment?(name: string): void;
  /** Playgama only: the loading screen is gone and the player can play (Bridge `game_ready`) */
  gameReady?(): void;
  /** Playgama only: a board ended on its result screen (Bridge `level_completed` / `level_failed`) */
  levelEnd?(won: boolean): void;
  /** does this portal show interstitials in this slot at all */
  adSlot(slot: AdSlot): boolean;
  /** an ad SDK is loaded and can be asked for ads */
  readonly available: boolean;
  /** an ad started (true) / ended (false): pause the game and mute all audio / resume and restore audio */
  onAdPause: (paused: boolean) => void;
  /** portal storage, or null for localStorage */
  data(): KeyValueStore | null;
  /** the player is actually playing (not in a menu, a dialog, a result screen or an ad); calls are de-duplicated */
  gameplayStart(): void;
  gameplayStop(): void;
  /** interstitial. Resolves once the ad is done, skipped, failed or timed out. */
  interstitial(slot: AdSlot): Promise<void>;
  /** rewarded ad; resolves true only if the reward was earned */
  rewarded(): Promise<boolean>;
}

/** an ad that has not started after this long is treated as unavailable (ms) */
export const AD_TIMEOUT = 8000;
/** at most one interstitial per this many ms (the same ~2 minute gap as app.ts MIDGAME_GAP) */
export const AD_GAP = 120_000;
/** a started ad whose end is never reported is given up after this long, so the game can never stay paused (ms) */
export const AD_MAX = 120_000;

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
