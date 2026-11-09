/**
 * GamePix build: boot progress. No imports, so main.ts can report progress before the game code is loaded
 * (and other builds, where it is unused, are not affected at all).
 */
/** boot progress already reported (shared by the boot code in main.ts and the platform) */
let progress = 0;

/** report boot progress to the Player (integer 0..100, only increasing) and move the loading bar */
export function gpxLoading(p: number) {
  const v = Math.max(0, Math.min(100, Math.round(p)));
  if (v <= progress) return;
  progress = v;
  try {
    (window as { GamePix?: { lifecycle?: { loading?(p: number): void } } }).GamePix?.lifecycle?.loading?.(v);
  } catch {
    /* ignore */
  }
  const bar = typeof document !== 'undefined' ? (document.querySelector('#gpx-loading i') as HTMLElement | null) : null;
  if (bar) bar.style.width = v + '%';
}

