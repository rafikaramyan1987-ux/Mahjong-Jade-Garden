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

/**
 * Stack a shape. `every` = how often the stack shrinks: 1 builds a pyramid (each layer smaller), 2 or 3 build
 * towers (layers repeat before shrinking), which gives deep boards with few columns, as on a phone.
 */
export function buildStack(mask: Mask, cols: number, rows: number, layers: number, stack: Stack, every = 1): Slot[] {
  let cur: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (mask((c + 0.5) / cols, (r + 0.5) / rows, cols / rows)) cur.push([c * 2, r * 2]);
  const out: Slot[] = cur.map(([x, y]) => [x, y, 0] as const);
  let shrinks = 0;
  for (let z = 1; z < layers && cur.length; z++) {
    if (z % every !== 0) {
      // tower layer: the same tiles again, right on top
      for (const [x, y] of cur) out.push([x, y, z]);
      continue;
    }
    const has = new Set(cur.map(([x, y]) => key(x, y)));
    const offset = stack === 'offset' || (stack === 'mixed' && shrinks % 2 === 0);
    shrinks++;
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

/** tile proportions (multiples of the face width): height, thickness of the coloured side, shift per layer */
export const TILE_ASPECT = 1.3;
export const TILE_DEPTH = 0.15;
export const LAYER_SHIFT = 0.1;

/** Tile face width (px) a board gets in an area. Shared by the board view, the layout builder and the audit. */
export function tileWidthIn(b: { minX: number; minY: number; maxX: number; maxY: number; maxZ: number }, w: number, h: number) {
  const bw = (b.maxX - b.minX) / 2;
  const bh = (b.maxY - b.minY) / 2;
  return Math.min(w / (bw + TILE_DEPTH + b.maxZ * LAYER_SHIFT + 0.02), h / (bh * TILE_ASPECT + TILE_DEPTH + b.maxZ * LAYER_SHIFT + 0.02));
}

/** board area (px) of a 390 x 844 phone in portrait (between the top bar and the buttons) and of 1280 x 720 */
export const PHONE_PORTRAIT_AREA = { w: 374, h: 676 };
export const DESKTOP_LANDSCAPE_AREA = { w: 1166, h: 636 };
/** board area (px) of a phone held sideways (844 x 390): compact bar on top, helper buttons on the right */
export const PHONE_LANDSCAPE_AREA = { w: 724, h: 318 };
/** smallest tile on phones held sideways, except on the hardest boards (where it may go down to SHORT_FLOOR_TILE) */
export const MIN_SHORT_TILE = 56;
export const SHORT_FLOOR_TILE = 44;
/** smallest tile face width on every board: 56 px on a 390 x 844 phone, 64 px on 1280 x 720 */
export const MIN_PORTRAIT_TILE = 56;
export const MIN_LANDSCAPE_TILE = 64;
/** portrait boards are at most this many tiles across (depth comes from layers, not columns) */
export const MAX_PORTRAIT_COLS = 6;

/**
 * How "full" a board looks from above: the share of its bounding box covered by tiles (any layer), and whether a
 * whole row or column inside it is empty (a visible split). Used to keep portrait boards balanced.
 */
export function footprint(slots: Slot[]) {
  const b = boardTiles(slots);
  const W = b.maxX - b.minX;
  const H = b.maxY - b.minY;
  const cov = new Uint8Array(W * H);
  for (const [x, y] of slots)
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) cov[(y - b.minY + dy) * W + (x - b.minX + dx)] = 1;
  let n = 0;
  for (const c of cov) n += c;
  let emptyRows = 0;
  let emptyCols = 0;
  for (let y = 1; y < H - 1; y++) {
    let any = 0;
    for (let x = 0; x < W; x++) any |= cov[y * W + x];
    if (!any) emptyRows++;
  }
  for (let x = 1; x < W - 1; x++) {
    let any = 0;
    for (let y = 0; y < H; y++) any |= cov[y * W + x];
    if (!any) emptyCols++;
  }
  return { fill: n / (W * H), split: emptyRows + emptyCols > 0 };
}

/** portrait boards must look full: at least this share of the bounding box covered, and no split */
export const MIN_PORTRAIT_FILL = 0.7;

export interface FitOptions {
  target: number;
  layers: number;
  stack: Stack;
  portrait: boolean;
  /** fit for a phone held sideways (few rows, more layers) instead of a desktop screen */
  short?: boolean;
  /** override the minimum tile width */
  minTile?: number;
}

/**
 * Pick grid size, stack height and tower style so that the board has a tile count close to `target` and about
 * `layers` layers, while keeping tiles big: portrait boards at most 6 tiles across with tiles >= 56 px on a
 * 390 x 844 phone; landscape boards with tiles >= 64 px on 1280 x 720.
 */
export function fitShape(mask: Mask, o: FitOptions): Slot[] {
  let best: { slots: Slot[]; score: number } | null = null;
  const colsRange = o.portrait ? [3, MAX_PORTRAIT_COLS] : [4, 16];
  const rowsRange = o.portrait ? [4, 9] : [3, 8];
  const area = o.portrait ? PHONE_PORTRAIT_AREA : o.short ? PHONE_LANDSCAPE_AREA : DESKTOP_LANDSCAPE_AREA;
  const minTile = o.minTile ?? (o.portrait ? MIN_PORTRAIT_TILE : o.short ? MIN_SHORT_TILE : MIN_LANDSCAPE_TILE);
  for (let cols = colsRange[0]; cols <= colsRange[1]; cols++)
    for (let rows = rowsRange[0]; rows <= rowsRange[1]; rows++)
      for (const every of [1, 2, 3])
        for (let layers = Math.max(1, o.layers - 1); layers <= o.layers + (o.short ? 6 : 3); layers++) {
          const slots = buildStack(mask, cols, rows, layers, o.stack, every);
          const n = slots.length;
          if (n < 16 || n > 144) continue;
          const b = boardTiles(slots);
          if (o.portrait && (b.maxX - b.minX) / 2 > MAX_PORTRAIT_COLS) continue;
          const tw = tileWidthIn(b, area.w, area.h);
          if (tw < minTile + 0.5) continue;
          const fp = footprint(slots);
          if (o.portrait && (fp.split || fp.fill < MIN_PORTRAIT_FILL)) continue;
          const used = b.maxZ + 1;
          // how much of the free area the board covers in its tighter direction (1 = fills width and height)
          const bwPx = ((b.maxX - b.minX) / 2 + TILE_DEPTH + b.maxZ * LAYER_SHIFT) * tw;
          const bhPx = (((b.maxY - b.minY) / 2) * TILE_ASPECT + TILE_DEPTH + b.maxZ * LAYER_SHIFT) * tw;
          const fill = Math.min(bwPx / area.w, bhPx / area.h);
          // closest count, then the layer count asked for, then a board that fills the screen, then pyramids
          const score = Math.abs(n - o.target) * 6 + Math.abs(used - o.layers) * 14 + (1 - fill) * 90 + (1 - fp.fill) * 40 + (fp.split ? 60 : 0) + (every - 1) * 3;
          if (!best || score < best.score) best = { slots, score };
        }
  if (!best) throw new Error('no grid size fits this shape');
  return best.slots;
}
