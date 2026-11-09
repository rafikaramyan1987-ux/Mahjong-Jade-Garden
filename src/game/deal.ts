import { isFree, type Geometry } from './layout';
import { shuffleInPlace, type Rng } from './rng';
import { matchKey } from './tiles';

export interface Deal {
  /** face per slot (-1 = slot not used) */
  faces: number[];
  /** one valid solution (pairs of slots, in play order) — proof that the deal is solvable */
  solution: [number, number][];
}

/**
 * Solvable deal by reverse construction: on the empty-faced board, repeatedly pick two tiles that are free at the
 * same time and remove them; that removal order is a solution, and the matching pairs are dealt onto it.
 * `present` marks the slots to fill; `pairs` must hold exactly present/2 pairs. Returns null only if every attempt
 * hits a dead end (cannot happen for sane layouts; the caller retries with a new seed).
 */
export function dealPairs(g: Geometry, present: boolean[], pairs: [number, number][], rng: Rng, attempts = 400): Deal | null {
  const count = present.filter(Boolean).length;
  if (count !== pairs.length * 2) throw new Error(`deal: ${count} tiles but ${pairs.length} pairs`);
  for (let a = 0; a < attempts; a++) {
    const p = present.slice();
    const order: [number, number][] = [];
    let ok = true;
    for (let k = 0; k < pairs.length; k++) {
      const free: number[] = [];
      for (let i = 0; i < p.length; i++) if (p[i] && isFree(g, i, p)) free.push(i);
      if (free.length < 2) {
        ok = false;
        break;
      }
      // Prefer tiles on high layers and tiles that block others, so the deal does not leave a hard core for last.
      const pick = () => {
        const w = free.map((i) => 1 + g.slots[i][2] * 0.6 + g.below[i].length * 0.15);
        let r = rng() * w.reduce((s, x) => s + x, 0);
        for (let q = 0; q < free.length; q++) {
          r -= w[q];
          if (r <= 0) return free.splice(q, 1)[0];
        }
        return free.pop()!;
      };
      const i = pick();
      const j = pick();
      p[i] = false;
      p[j] = false;
      order.push([i, j]);
    }
    if (!ok) continue;
    const faces = new Array<number>(g.slots.length).fill(-1);
    const shuffled = shuffleInPlace(pairs.slice(), rng);
    order.forEach(([i, j], k) => {
      const [fa, fb] = rng() < 0.5 ? shuffled[k] : [shuffled[k][1], shuffled[k][0]];
      faces[i] = fa;
      faces[j] = fb;
    });
    return { faces, solution: order };
  }
  return null;
}

/** Group the faces still on the board into matching pairs (used by Shuffle: same tiles, new solvable positions). */
export function pairsOf(faces: number[], present: boolean[]): [number, number][] {
  const byKey = new Map<number, number[]>();
  faces.forEach((f, i) => {
    if (!present[i] || f < 0) return;
    const k = matchKey(f);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(f);
  });
  const pairs: [number, number][] = [];
  for (const list of byKey.values()) {
    if (list.length % 2) throw new Error('unpaired tile on the board');
    for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  }
  return pairs;
}
