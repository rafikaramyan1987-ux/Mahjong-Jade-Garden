/**
 * Layout builder: a shape (a mask over a cols x rows grid of whole tiles, in normalized coordinates) becomes a
 * stacked board. Upper layers are built from the layer below, either aligned (a tile stays on top of a tile whose
 * four neighbours are present) or offset (a tile sits on the middle of a 2 x 2 block, the classic pyramid look).
 * The same shape gives a wide variant for landscape screens and a tall one for portrait screens.
 */
import type { Slot } from '../game/layout';

/** shape mask: u, v in 0..1 across the grid (cell centers), aspect = cols / rows */
export type Mask = (u: number, v: number, aspect: number) => boolean;
export type Stack = 'aligned' | 'offset' | 'mixed';

const key = (x: number, y: number) => `${x},${y}`;

export function buildStack(mask: Mask, cols: number, rows: number, layers: number, stack: Stack): Slot[] {
  let cur: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (mask((c + 0.5) / cols, (r + 0.5) / rows, cols / rows)) cur.push([c * 2, r * 2]);
  const out: Slot[] = cur.map(([x, y]) => [x, y, 0] as const);
  for (let z = 1; z < layers && cur.length; z++) {
    const has = new Set(cur.map(([x, y]) => key(x, y)));
    const offset = stack === 'offset' || (stack === 'mixed' && z % 2 === 1);
    const next: [number, number][] = [];
    for (const [x, y] of cur) {
      if (offset) {
        if (has.has(key(x + 2, y)) && has.has(key(x, y + 2)) && has.has(key(x + 2, y + 2))) next.push([x + 1, y + 1]);
      } else if (has.has(key(x - 2, y)) && has.has(key(x + 2, y)) && has.has(key(x, y - 2)) && has.has(key(x, y + 2))) next.push([x, y]);
    }
    cur = next;
    for (const [x, y] of cur) out.push([x, y, z]);
  }
  return evenize(out);
}

/** drop the last tile of the highest layer if the count is odd (nothing rests on it, so the board stays valid) */
export function evenize(slots: Slot[]): Slot[] {
  if (slots.length % 2 === 0) return slots;
  const maxZ = Math.max(...slots.map((s) => s[2]));
  const top = slots.filter((s) => s[2] === maxZ);
  // the top tile closest to the board center
  const cx = slots.reduce((a, s) => a + s[0], 0) / slots.length;
  const cy = slots.reduce((a, s) => a + s[1], 0) / slots.length;
  top.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  const drop = top[top.length - 1];
  return slots.filter((s) => s !== drop);
}

/** board size in tile units (width, height) including the depth of the stack */
export function boardTiles(slots: Slot[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    maxZ = 0;
  for (const [x, y, z] of slots) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + 2);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + 2);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, minY, maxX, maxY, maxZ };
}

/**
 * Tile face width (px) a board gets in an area: face w, height 1.3 w, thickness 0.11 w, layer shift 0.12 w.
 * Shared by the board view and the layout audit.
 */
export function tileWidthIn(b: { minX: number; minY: number; maxX: number; maxY: number; maxZ: number }, w: number, h: number) {
  const bw = (b.maxX - b.minX) / 2;
  const bh = (b.maxY - b.minY) / 2;
  return Math.min(w / (bw + 0.11 + b.maxZ * 0.12 + 0.04), h / (bh * 1.3 + 0.11 + b.maxZ * 0.12 + 0.04));
}

/** board area of a 390 x 844 phone in portrait (between the top bar and the buttons) and of 1280 x 720 */
export const PHONE_PORTRAIT_AREA = { w: 378, h: 674 };
export const DESKTOP_LANDSCAPE_AREA = { w: 1120, h: 628 };
/** smallest tile face width allowed on a 390 px wide phone */
export const MIN_PORTRAIT_TILE = 34;

export interface FitOptions {
  target: number;
  layers: number;
  stack: Stack;
  portrait: boolean;
}

/**
 * Pick the grid size whose stacked board has a tile count closest to `target` (never more than 144), keeping
 * portrait boards tall and narrow (big tiles on phones) and landscape boards wide.
 */
export function fitShape(mask: Mask, o: FitOptions): Slot[] {
  let best: { slots: Slot[]; score: number } | null = null;
  const colsRange = o.portrait ? [5, 9] : [8, 16];
  const rowsRange = o.portrait ? [7, 12] : [5, 9];
  for (let cols = colsRange[0]; cols <= colsRange[1]; cols++)
    for (let rows = rowsRange[0]; rows <= rowsRange[1]; rows++) {
      const slots = buildStack(mask, cols, rows, o.layers, o.stack);
      const n = slots.length;
      if (n < 40 || n > 144) continue;
      const b = boardTiles(slots);
      const tw = o.portrait ? tileWidthIn(b, PHONE_PORTRAIT_AREA.w, PHONE_PORTRAIT_AREA.h) : tileWidthIn(b, DESKTOP_LANDSCAPE_AREA.w, DESKTOP_LANDSCAPE_AREA.h);
      if (o.portrait && tw < MIN_PORTRAIT_TILE + 2) continue;
      const layersUsed = b.maxZ + 1;
      // closest count, then the layer count asked for, then bigger tiles
      const score = Math.abs(n - o.target) * 10 + Math.abs(layersUsed - o.layers) * 25 - tw * 0.5;
      if (!best || score < best.score) best = { slots, score };
    }
  if (!best) throw new Error('no grid size fits this shape');
  return best.slots;
}
