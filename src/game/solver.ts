import { isFree, type Geometry } from './layout';
import { matchKey } from './tiles';

export type Move = [number, number];

/** all matching pairs among free tiles */
export function openMatches(g: Geometry, faces: number[], present: boolean[]): Move[] {
  const byKey = new Map<number, number[]>();
  for (let i = 0; i < faces.length; i++) {
    if (!present[i] || !isFree(g, i, present)) continue;
    const k = matchKey(faces[i]);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(i);
  }
  const moves: Move[] = [];
  for (const list of byKey.values())
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) moves.push([list[a], list[b]]);
  return moves;
}

export interface SolveResult {
  /** true: solved, false: proven unsolvable, null: gave up (node budget) */
  solvable: boolean | null;
  moves: Move[];
  nodes: number;
}

/** for each slot, how many tiles lie (transitively) beneath it: removing high stacks first opens the board */
function underSets(g: Geometry): Set<number>[] {
  const memo = new Map<number, Set<number>>();
  const under = (i: number): Set<number> => {
    const m = memo.get(i);
    if (m) return m;
    const s = new Set<number>();
    for (const j of g.below[i]) {
      s.add(j);
      for (const k of under(j)) s.add(k);
    }
    memo.set(i, s);
    return s;
  };
  return g.slots.map((_, i) => under(i));
}

/**
 * Depth-first solver with a dead-position memo (Zobrist hashes) and randomized restarts.
 * Safe moves first: when every remaining tile of a kind is free, removing them cannot hurt. Otherwise moves that
 * open the board most (tall stacks, long rows) are tried first.
 */
export function solve(g: Geometry, faces: number[], presentIn: boolean[], budget = 60000, seed = 1): SolveResult {
  const n = faces.length;
  const present = presentIn.slice();
  let rs = seed >>> 0 || 1;
  const rnd = () => {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  };
  const zh = Array.from({ length: n }, () => Math.floor(rnd() * 2 ** 22));
  const zl = Array.from({ length: n }, () => Math.floor(rnd() * 2 ** 31));
  let hHi = 0;
  let hLo = 0;
  for (let i = 0; i < n; i++)
    if (present[i]) {
      hHi ^= zh[i];
      hLo ^= zl[i];
    }
  const toggle = (i: number) => {
    present[i] = !present[i];
    hHi ^= zh[i];
    hLo ^= zl[i];
  };
  const unders = underSets(g);
  const stack = unders.map((u) => u.size);
  // pairs of slots where one lies (transitively) on the other: if the last two tiles of a kind are such a pair,
  // the position is dead
  const keys = faces.map((f) => (f < 0 ? -1 : matchKey(f)));
  const deadlocked = (): boolean => {
    const left = new Map<number, number[]>();
    for (let i = 0; i < n; i++)
      if (present[i]) {
        const k = keys[i];
        const l = left.get(k);
        if (l) l.push(i);
        else left.set(k, [i]);
      }
    for (const l of left.values()) {
      if (l.length === 2 && (unders[l[0]].has(l[1]) || unders[l[1]].has(l[0]))) return true;
      if (l.length === 4) {
        // three of the kind stacked on each other with the fourth anywhere: two would have to come off together
        for (const a of l) {
          let c = 0;
          for (const b of l) if (b !== a && unders[a].has(b)) c++;
          if (c >= 2) {
            const others = l.filter((b) => b !== a && unders[a].has(b));
            if (unders[others[0]].has(others[1]) || unders[others[1]].has(others[0])) return true;
          }
        }
      }
    }
    return false;
  };
  const dead = new Set<number>();
  let nodes = 0;
  let limit = 0;
  const path: Move[] = [];
  let remaining = present.filter(Boolean).length;
  let noise = 0;

  const rowLen = (i: number) => {
    const [, y, z] = g.slots[i];
    let c = 0;
    for (let j = 0; j < n; j++) if (present[j] && g.slots[j][2] === z && Math.abs(g.slots[j][1] - y) < 2) c++;
    return c;
  };

  const rec = (): boolean | null => {
    if (remaining === 0) return true;
    if (++nodes > limit) return null;
    const key = hHi * 2147483648 + hLo;
    if (dead.has(key)) return false;
    if (deadlocked()) {
      dead.add(key);
      return false;
    }
    const moves = openMatches(g, faces, present);
    if (!moves.length) {
      dead.add(key);
      return false;
    }
    const keyCount = new Map<number, number>();
    for (let i = 0; i < n; i++) if (present[i]) keyCount.set(matchKey(faces[i]), (keyCount.get(matchKey(faces[i])) ?? 0) + 1);
    const freeCount = new Map<number, number>();
    const freeSet = new Set(moves.flat());
    for (const i of freeSet) freeCount.set(matchKey(faces[i]), (freeCount.get(matchKey(faces[i])) ?? 0) + 1);
    const safe = moves.find(([a]) => keyCount.get(matchKey(faces[a])) === freeCount.get(matchKey(faces[a])));
    let candidates: Move[];
    if (safe) candidates = [safe];
    else {
      const w = new Map<number, number>();
      for (const i of freeSet) w.set(i, stack[i] * 3 + rowLen(i) + noise * rnd() * 6);
      candidates = moves.slice().sort((m1, m2) => w.get(m2[0])! + w.get(m2[1])! - w.get(m1[0])! - w.get(m1[1])!);
    }
    for (const m of candidates) {
      toggle(m[0]);
      toggle(m[1]);
      remaining -= 2;
      path.push(m);
      const r = rec();
      if (r) return true;
      path.pop();
      toggle(m[0]);
      toggle(m[1]);
      remaining += 2;
      if (r === null) return null;
    }
    dead.add(key);
    return false;
  };
  // restarts with growing node limits and some randomness in the move order (search times are heavy-tailed)
  let slice = Math.max(500, Math.floor(budget / 16));
  for (let round = 0; nodes < budget; round++) {
    limit = Math.min(budget, nodes + slice);
    noise = round === 0 ? 0 : 1;
    const r = rec();
    if (r !== null) return { solvable: r, moves: r ? path.slice() : [], nodes };
    path.length = 0;
    slice = Math.floor(slice * 1.5);
  }
  return { solvable: null, moves: [], nodes };
}
