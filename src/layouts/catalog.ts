/**
 * The 64 journey layouts: 16 shapes x 4 seasons. Board n (0..63) uses shape n % 16 at difficulty n: tile count,
 * stack height and deal hardness grow along the journey (each season's set is larger and taller than the last).
 * Every layout has a landscape and a portrait variant; both are solver-verified by the audit (npm run audit).
 */
import { Game } from '../game/game';
import type { Slot } from '../game/layout';
import { hashSeed } from '../game/rng';
import { fitShape, type Mask, type Stack } from './build';

export interface BoardLayout {
  id: string;
  /** journey position 0..63 (also the difficulty rank) */
  index: number;
  /** shape family, also the i18n key suffix of its name (layout.<family>) */
  family: string;
  landscape: Slot[];
  portrait: Slot[];
  /** 0..1: how hard the deal is (fewer open matches at the start) */
  hardness: number;
}

const ell = (u: number, v: number, rx = 0.5, ry = 0.5) => ((u - 0.5) / rx) ** 2 + ((v - 0.5) / ry) ** 2;

/** the GamePix build (also when an audit sets globalThis.__PLATFORM__ = 'gamepix'); false in every other build */
const GAMEPIX = typeof __PLATFORM__ !== 'undefined' && __PLATFORM__ === 'gamepix';

/** GamePix build: a round lily pad with a notch toward the top (replaces the cross-shaped "lotus" board) */
export const lilyPad: Mask = (u, v) => ell(u, v, 0.53, 0.53) <= 1 && !(v < 0.5 && Math.abs(u - 0.5) < (0.5 - v) * 0.45);

interface Shape {
  family: string;
  mask: Mask;
  stack: Stack;
}

/** journey order inside a season: gentle shapes first, the classic turtle as the season finale */
export const SHAPES: Shape[] = [
  { family: 'stones', mask: () => true, stack: 'aligned' },
  { family: 'lantern', mask: (u, v) => ell(u, v, 0.53, 0.53) <= 1, stack: 'offset' },
  { family: 'pond', mask: (u, v) => ell(u, v, 0.55, 0.55) <= 1 && ell(u, v, 0.2, 0.2) > 1, stack: 'offset' },
  { family: 'bridge', mask: (u, v, a) => (a >= 1 ? v >= 0.62 - 0.62 * Math.sin(Math.PI * u) || v > 0.7 : u >= 0.62 - 0.62 * Math.sin(Math.PI * v) || u > 0.7), stack: 'offset' },
  {
    family: 'blossom',
    mask: (u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.hypot(dx, dy);
      return r <= 0.36 + 0.16 * Math.cos(5 * Math.atan2(dy, dx) + Math.PI / 2);
    },
    stack: 'offset',
  },
  { family: 'koi', mask: (u, v, a) => (a >= 1 ? ell(u, v, 0.27, 0.5) <= 1.05 || ell(u - 0.48, v, 0.27, 0.5) <= 1.05 || ell(u + 0.48, v, 0.27, 0.5) <= 1.05 : ell(u, v - 0.24, 0.5, 0.27) <= 1.05 || ell(u, v + 0.24, 0.5, 0.27) <= 1.05), stack: 'mixed' },
  { family: 'pagoda', mask: (u, v) => Math.abs(u - 0.5) <= 0.18 + 0.32 * (Math.floor(v * 4) / 3), stack: 'aligned' },
  // bamboo grove: stalks with staggered notches (small openings, never a full empty row or column)
  {
    family: 'bamboo',
    mask: (u, v, a) => {
      const [along, across] = a >= 1 ? [v, u] : [u, v];
      return !(Math.floor(across * 9) % 3 === 2 && Math.floor(along * 6) % 2 === 1);
    },
    stack: 'offset',
  },
  { family: 'gate', mask: (u, v) => ell(u, v, 0.55, 0.55) <= 1 && ell(u, v, 0.26, 0.26) > 1, stack: 'offset' },
  { family: 'fan', mask: (u, v) => Math.hypot(u - 0.5, (v - 1) * 0.9) <= 0.9 && Math.abs(Math.atan2(u - 0.5, 1 - v)) <= 1.0, stack: 'offset' },
  { family: 'pavilion', mask: (u, v) => (v < 0.45 ? Math.abs(u - 0.5) <= 0.12 + v * 0.95 : Math.abs(u - 0.5) <= 0.4), stack: 'mixed' },
  { family: 'cascade', mask: (u, v) => Math.abs(v - u) <= 0.42, stack: 'offset' },
  { family: 'maple', mask: (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) <= 0.58, stack: 'aligned' },
  // GamePix build: a lily pad (a round pad with its notch) instead of the cross-shaped board
  { family: 'lotus', mask: GAMEPIX ? lilyPad : (u, v) => Math.abs(u - 0.5) <= 0.2 || Math.abs(v - 0.5) <= 0.2 || ell(u, v, 0.3, 0.3) <= 1, stack: 'mixed' },
  { family: 'cranes', mask: (u, v, a) => (a >= 1 ? Math.abs(v - (0.15 + Math.abs(u - 0.5) * 1.4)) <= 0.36 : Math.abs(u - (0.15 + Math.abs(v - 0.5) * 1.4)) <= 0.36), stack: 'offset' },
  {
    family: 'turtle',
    // shell, head and tail (head toward the top on tall boards, to the left on wide ones)
    mask: (u, v, a) => {
      const [x, y] = a >= 1 ? [u, v] : [v, u];
      return ell(x, y, 0.5, 0.42) <= 1.02 || (Math.abs(y - 0.5) < 0.09 && (x < 0.08 || x > 0.92));
    },
    stack: 'aligned',
  },
];

export const BOARDS_PER_SEASON = SHAPES.length;
export const JOURNEY_LENGTH = BOARDS_PER_SEASON * 4;

/**
 * Tile count and stack height for journey position n. Tiles stay big on every board (>= 56 px wide on a 390 px
 * phone, >= 64 px on 1280 x 720); boards get harder through more tiles, more layers and more overlap, and
 * through deals with fewer open pairs (see `hardness`).
 */
export function sizeFor(n: number) {
  const season = Math.min(3, Math.floor(n / BOARDS_PER_SEASON));
  const k = (n % BOARDS_PER_SEASON) / (BOARDS_PER_SEASON - 1);
  const ranges: [number, number][] = [
    [30, 56],
    [56, 88],
    [84, 116],
    [112, 144],
  ];
  const [lo, hi] = ranges[season];
  const target = Math.round(lo + (hi - lo) * k);
  const layers = 2 + season + (k > 0.5 ? 1 : 0); // 2 .. 6
  return { target: Math.min(144, target - (target % 2)), layers };
}

function make(n: number): BoardLayout {
  const shape = SHAPES[n % SHAPES.length];
  const hardness = Math.min(1, n / (JOURNEY_LENGTH - 1));
  const season = Math.floor(n / BOARDS_PER_SEASON);
  const { target, layers } = sizeFor(n);
  return {
    id: `${shape.family}-${season + 1}`,
    index: n,
    family: shape.family,
    landscape: fitShape(shape.mask, { target, layers, stack: shape.stack, portrait: false }),
    portrait: fitShape(shape.mask, { target, layers, stack: shape.stack, portrait: true }),
    hardness,
  };
}

const cache = new Map<number, BoardLayout>();
/** journey layout n (0..63), built on first use and cached */
function built(n: number): BoardLayout {
  let l = cache.get(n);
  if (!l) {
    l = make(n);
    cache.set(n, l);
  }
  return l;
}

/** all 64 layouts in journey order */
export function journeyLayouts(): BoardLayout[] {
  return Array.from({ length: JOURNEY_LENGTH }, (_, n) => built(n));
}

export function layoutAt(n: number): BoardLayout {
  // after the 64th board the journey goes on through the second half of the set
  return built(n < JOURNEY_LENGTH ? n : 32 + ((n - JOURNEY_LENGTH) % 32));
}

export function layoutById(id: string): BoardLayout | undefined {
  const m = /^(.+)-(\d)$/.exec(id);
  if (!m) return undefined;
  const f = SHAPES.findIndex((sh) => sh.family === m[1]);
  const n = (Number(m[2]) - 1) * BOARDS_PER_SEASON + f;
  return f >= 0 && n >= 0 && n < JOURNEY_LENGTH ? built(n) : undefined;
}

export type Variant = 'landscape' | 'portrait';

/** the deal of a layout: deterministic from the seed, harder layouts get harder deals */
export function dealLayout(l: BoardLayout, variant: Variant, seed: number): Game {
  return Game.deal(variant === 'portrait' ? l.portrait : l.landscape, seed, l.hardness);
}

/** seed of journey board n (the same deal for every player) */
export function journeySeed(n: number): number {
  return hashSeed(`journey-${n}-${layoutAt(n).id}`);
}

/** the daily challenge of a date key (YYYY-MM-DD): a mid-journey layout and a date seed */
export function dailyFor(day: string): { layout: BoardLayout; seed: number } {
  return { layout: built(16 + (hashSeed(`daily-layout-${day}`) % 40)), seed: hashSeed(`daily-${day}`) };
}
