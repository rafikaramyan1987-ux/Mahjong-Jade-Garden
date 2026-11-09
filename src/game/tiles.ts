/**
 * The 38 tile faces of the set (144 tiles):
 * dots 1-9, bamboo 1-9, characters 1-9, winds E S W N, dragons red/green/white (4 copies each) and four flower
 * pictures (2 copies each). Only tiles with exactly the same picture match.
 */
export type Suit = 'dots' | 'bamboo' | 'chars' | 'wind' | 'dragon' | 'flower';

export const FACE_COUNT = 38;
export const DOTS = 0;
export const BAMBOO = 9;
export const CHARS = 18;
export const WINDS = 27;
export const DRAGONS = 31;
export const FLOWERS = 34;

export function suitOf(face: number): Suit {
  if (face < BAMBOO) return 'dots';
  if (face < CHARS) return 'bamboo';
  if (face < WINDS) return 'chars';
  if (face < DRAGONS) return 'wind';
  if (face < FLOWERS) return 'dragon';
  return 'flower';
}

/** 1-based rank within the suit (1-9 numbers, 1-4 winds E S W N, 1-3 dragons red green white, 1-4 flowers) */
export function rankOf(face: number): number {
  const starts = [DOTS, BAMBOO, CHARS, WINDS, DRAGONS, FLOWERS];
  for (let i = starts.length - 1; i >= 0; i--) if (face >= starts[i]) return face - starts[i] + 1;
  return 1;
}

/** Only identical pictures match. */
export function matchKey(face: number): number {
  return face;
}

export function faceMatches(a: number, b: number): boolean {
  return a === b;
}

/** copies of a face in one full set */
export function copiesOf(face: number): number {
  return face >= FLOWERS ? 2 : 4;
}

/** The full set as 72 pairs of identical tiles: 34 faces x 2 pairs + 4 flower faces x 1 pair. */
export function fullPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  for (let f = 0; f < FACE_COUNT; f++) for (let k = 0; k < copiesOf(f) / 2; k++) pairs.push([f, f]);
  return pairs;
}
