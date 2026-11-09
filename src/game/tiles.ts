/**
 * The 42 tile faces of a classic Mahjong set (144 tiles):
 * dots 1-9, bamboo 1-9, characters 1-9 (4 copies each), winds E S W N, dragons red/green/white (4 copies each),
 * flowers 1-4 and seasons 1-4 (one copy each; any flower matches any flower, any season any season).
 */
export type Suit = 'dots' | 'bamboo' | 'chars' | 'wind' | 'dragon' | 'flower' | 'season';

export const FACE_COUNT = 42;
export const DOTS = 0;
export const BAMBOO = 9;
export const CHARS = 18;
export const WINDS = 27;
export const DRAGONS = 31;
export const FLOWERS = 34;
export const SEASONS = 38;

export function suitOf(face: number): Suit {
  if (face < BAMBOO) return 'dots';
  if (face < CHARS) return 'bamboo';
  if (face < WINDS) return 'chars';
  if (face < DRAGONS) return 'wind';
  if (face < FLOWERS) return 'dragon';
  if (face < SEASONS) return 'flower';
  return 'season';
}

/** 1-based rank within the suit (1-9 numbers, 1-4 winds E S W N, 1-3 dragons red green white, 1-4 flowers / seasons) */
export function rankOf(face: number): number {
  const starts = [DOTS, BAMBOO, CHARS, WINDS, DRAGONS, FLOWERS, SEASONS];
  for (let i = starts.length - 1; i >= 0; i--) if (face >= starts[i]) return face - starts[i] + 1;
  return 1;
}

/** Faces that match each other share a key: every flower matches every flower, every season every season. */
export function matchKey(face: number): number {
  if (face >= SEASONS) return SEASONS;
  if (face >= FLOWERS) return FLOWERS;
  return face;
}

export function faceMatches(a: number, b: number): boolean {
  return matchKey(a) === matchKey(b);
}

/**
 * The full set as 72 matching pairs: each of the 34 regular faces gives 2 pairs, flowers give 2 pairs and
 * seasons give 2 pairs (each pair two different flowers / seasons, as in a real set).
 */
export function fullPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  for (let f = 0; f < FLOWERS; f++) pairs.push([f, f], [f, f]);
  pairs.push([FLOWERS, FLOWERS + 1], [FLOWERS + 2, FLOWERS + 3]);
  pairs.push([SEASONS, SEASONS + 1], [SEASONS + 2, SEASONS + 3]);
  return pairs;
}
