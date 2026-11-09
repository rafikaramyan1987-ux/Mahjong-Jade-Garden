/**
 * Layouts and their geometry. A slot is `[x, y, z]` in half-tile units: a tile covers x..x+2 horizontally and
 * y..y+2 vertically on layer z. Rules (classic Mahjong Solitaire): a tile is free when no tile on the layer above
 * overlaps it and its left or its right side is open on its own layer.
 */
export type Slot = readonly [number, number, number];

export interface Layout {
  id: string;
  /** i18n key of the layout name */
  name: string;
  slots: Slot[];
}

export interface Geometry {
  slots: Slot[];
  /** for each slot: slots on the layer directly above that overlap it */
  above: number[][];
  /** for each slot: touching slots on the same layer on the left / right */
  left: number[][];
  right: number[][];
  /** slots below that each slot rests on (inverse of `above`) */
  below: number[][];
  /** paint order (bottom layer first; within a layer from top-left to bottom-right) */
  order: number[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number; maxZ: number };
}

export function geometry(slots: Slot[]): Geometry {
  const n = slots.length;
  const above: number[][] = Array.from({ length: n }, () => []);
  const below: number[][] = Array.from({ length: n }, () => []);
  const left: number[][] = Array.from({ length: n }, () => []);
  const right: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const [xi, yi, zi] = slots[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const [xj, yj, zj] = slots[j];
      const ox = Math.abs(xi - xj) < 2;
      const oy = Math.abs(yi - yj) < 2;
      if (zj === zi + 1 && ox && oy) {
        above[i].push(j);
        below[j].push(i);
      }
      if (zj === zi && oy) {
        if (xj === xi - 2) left[i].push(j);
        if (xj === xi + 2) right[i].push(j);
      }
    }
  }
  const order = slots.map((_, i) => i).sort((a, b) => {
    const [xa, ya, za] = slots[a];
    const [xb, yb, zb] = slots[b];
    return za - zb || xa + ya - (xb + yb) || ya - yb;
  });
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = 0;
  for (const [x, y, z] of slots) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 2);
    maxY = Math.max(maxY, y + 2);
    maxZ = Math.max(maxZ, z);
  }
  return { slots, above, below, left, right, order, bounds: { minX, minY, maxX, maxY, maxZ } };
}

export function isFree(g: Geometry, i: number, present: ArrayLike<boolean | number>): boolean {
  for (const j of g.above[i]) if (present[j]) return false;
  let leftOpen = true;
  for (const j of g.left[i])
    if (present[j]) {
      leftOpen = false;
      break;
    }
  if (leftOpen) return true;
  for (const j of g.right[i]) if (present[j]) return false;
  return true;
}

/** Swap the axes (for tall portrait screens): rows become columns; the rules then apply to the new orientation. */
export function transposeSlots(slots: Slot[]): Slot[] {
  return slots.map(([x, y, z]) => [y, x, z] as const);
}

/** Problems that make a layout invalid (overlapping tiles, floating tiles, odd count). Empty = valid. */
export function validateLayout(slots: Slot[]): string[] {
  const errs: string[] = [];
  if (slots.length % 2) errs.push(`odd tile count ${slots.length}`);
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const [a, b] = [slots[i], slots[j]];
      if (a[2] === b[2] && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2) errs.push(`overlap ${a} / ${b}`);
    }
  const g = geometry(slots);
  slots.forEach((s, i) => {
    if (s[2] > 0 && g.below[i].length === 0) errs.push(`floating tile ${s}`);
  });
  return errs;
}
