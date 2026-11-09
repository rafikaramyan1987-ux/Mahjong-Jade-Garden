import type { Slot } from '../game/layout';

/** helper: a rectangle of tiles in full-tile columns / rows on layer z (half-unit coordinates) */
export function rect(c0: number, r0: number, c1: number, r1: number, z: number, dx = 0, dy = 0): Slot[] {
  const out: Slot[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c * 2 + dx, r * 2 + dy, z]);
  return out;
}

/** rows of a layer given as [firstColumn, lastColumn] per row */
export function rows(spec: [number, number][], z: number, r0 = 0, dx = 0, dy = 0): Slot[] {
  return spec.flatMap(([c0, c1], i) => rect(c0, r0 + i, c1, r0 + i, z, dx, dy));
}

/**
 * Jade Turtle: the traditional five-layer turtle shape, 144 tiles.
 * Base 87 (with the head on the left and the two tail tiles on the right), then 36, 16, 4 and the crown tile.
 */
const turtleSlots: Slot[] = [
  ...rows(
    [
      [1, 12],
      [3, 10],
      [2, 11],
      [1, 12],
      [1, 12],
      [2, 11],
      [3, 10],
      [1, 12],
    ],
    0,
  ),
  [0, 7, 0],
  [26, 7, 0],
  [28, 7, 0],
  ...rect(4, 1, 9, 6, 1),
  ...rect(5, 2, 8, 5, 2),
  ...rect(6, 3, 7, 4, 3),
  [13, 7, 4],
];

export const JADE_TURTLE_LANDSCAPE: Slot[] = turtleSlots;

/**
 * Tall Jade Turtle for portrait screens, also 144 tiles: an 8-wide, 11-row shell (two 7-wide rows on half
 * steps) with the head on top, then 36, 16, 4 and the crown tile.
 */
const tallBase: Slot[] = [];
[8, 7, 8, 8, 8, 8, 8, 8, 8, 7, 8].forEach((w, r) => {
  for (let c = 0; c < w; c++) tallBase.push([c * 2 + (w === 7 ? 1 : 0), (r + 1) * 2, 0]);
});
export const JADE_TURTLE_PORTRAIT: Slot[] = [
  ...tallBase,
  [7, 0, 0],
  ...rect(1, 4, 6, 9, 1),
  ...rect(2, 5, 5, 8, 2),
  ...rect(3, 6, 4, 7, 3),
  [7, 13, 4],
];
