/** test hooks the game exposes on window.__mjg (see debug() in src/app/app.ts) */
export interface MjgState {
  screen: string;
  modal: string | null;
  remaining: number | null;
  matches: number | null;
  time: number | null;
  score: number | null;
  journey: number;
  tutorial: number;
  variant: 'landscape' | 'portrait' | 'short' | null;
  tileWidth: number | null;
  hintsLeft: number | null;
  shufflesLeft: number | null;
  adPaused: boolean;
  undosLeft?: number;
  tutorialDone: boolean;
  combo: number;
  comboSecs: number;
  zoom: number;
  lang: string;
  audio: { silent: boolean; music: boolean; sfx: boolean; suspend: boolean };
}
export interface MjgRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
declare global {
  interface Window {
    __mjg: {
      state(): MjgState;
      pair(): [number, number][] | null;
      center(i: number): [number, number];
      fill(): { area: MjgRect; box: MjgRect; tileWidth: number } | null;
      solve(leave?: number): boolean;
      setJourney(n: number): void;
      skipTutorial(): void;
      blocked(): [number, number] | null;
      showTitle(): void;
      stuck(): void;
      demoProgress(n: number): void;
      showJourney(): void;
      setTime(secs: number): void;
    };
  }
}
