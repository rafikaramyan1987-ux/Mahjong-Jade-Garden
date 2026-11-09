import { dealPairs, pairsOf } from './deal';
import { geometry, isFree, type Geometry, type Slot } from './layout';
import { mulberry32, type Rng } from './rng';
import { openMatches, solve, type Move } from './solver';
import { faceMatches, fullPairs } from './tiles';

export type HistoryEntry = { kind: 'match'; a: number; b: number } | { kind: 'shuffle'; faces: number[] };

export interface GameSnapshot {
  slots: Slot[];
  faces: number[];
  present: boolean[];
  history: HistoryEntry[];
}

/** A board in play: the rules, matching, undo and shuffle. No rendering, no timing. */
export class Game {
  readonly g: Geometry;
  faces: number[];
  present: boolean[];
  history: HistoryEntry[] = [];
  /** the deal's construction order (a certificate that the fresh deal is solvable); empty for restored games */
  solution: Move[] = [];

  constructor(slots: Slot[], faces: number[], present?: boolean[]) {
    this.g = geometry(slots);
    this.faces = faces.slice();
    this.present = present ? present.slice() : faces.map((f) => f >= 0);
  }

  /** A fresh solvable deal of the full set (or as many pairs as the layout has room for). */
  static deal(slots: Slot[], seed: number): Game {
    const g = geometry(slots);
    const rng = mulberry32(seed);
    const want = Math.floor(slots.length / 2);
    const pool = fullPairs();
    // smaller layouts take a random subset of the set's pairs; larger ones repeat the set
    const pairs: [number, number][] = [];
    while (pairs.length < want) {
      const p = pool.slice();
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
      }
      pairs.push(...p.slice(0, want - pairs.length));
    }
    for (let s = 0; s < 20; s++) {
      const d = dealPairs(g, slots.map(() => true), pairs, s === 0 ? rng : mulberry32(seed + s * 7919));
      if (d) {
        const game = new Game(slots, d.faces);
        game.solution = d.solution;
        return game;
      }
    }
    throw new Error('layout cannot be dealt');
  }

  static restore(s: GameSnapshot): Game {
    const game = new Game(s.slots, s.faces, s.present);
    game.history = s.history.slice();
    return game;
  }

  snapshot(): GameSnapshot {
    return { slots: this.g.slots, faces: this.faces.slice(), present: this.present.slice(), history: this.history.slice() };
  }

  get remaining() {
    return this.present.reduce((n, p) => n + (p ? 1 : 0), 0);
  }
  get total() {
    return this.faces.filter((f) => f >= 0).length;
  }
  get won() {
    return this.remaining === 0;
  }

  isFree(i: number) {
    return this.present[i] && isFree(this.g, i, this.present);
  }

  canMatch(a: number, b: number) {
    return a !== b && this.isFree(a) && this.isFree(b) && faceMatches(this.faces[a], this.faces[b]);
  }

  match(a: number, b: number): boolean {
    if (!this.canMatch(a, b)) return false;
    this.present[a] = this.present[b] = false;
    this.history.push({ kind: 'match', a, b });
    return true;
  }

  openMatches(): Move[] {
    return openMatches(this.g, this.faces, this.present);
  }

  get stuck() {
    return !this.won && this.openMatches().length === 0;
  }

  /** undo the last match (or shuffle); returns the entry undone */
  undo(): HistoryEntry | null {
    const h = this.history.pop();
    if (!h) return null;
    if (h.kind === 'match') this.present[h.a] = this.present[h.b] = true;
    else this.faces = h.faces.slice();
    return h;
  }

  /** Re-deal the tiles still on the board onto the same positions so that the board is solvable again. */
  shuffle(rng: Rng): boolean {
    const pairs = pairsOf(this.faces, this.present);
    if (!pairs.length) return false;
    for (let s = 0; s < 10; s++) {
      const d = dealPairs(this.g, this.present, pairs, rng);
      if (!d) continue;
      // avoid a shuffle that looks like nothing happened
      const before = this.faces.slice();
      this.history.push({ kind: 'shuffle', faces: before });
      this.present.forEach((p, i) => {
        if (p) this.faces[i] = d.faces[i];
      });
      return true;
    }
    return false;
  }

  /** A good next match: one after which the board is still solvable (solver-checked), else any open match. */
  hint(budget = 6000): Move | null {
    const moves = this.openMatches();
    if (!moves.length) return null;
    let unknown: Move | null = null;
    for (const m of moves) {
      const p = this.present.slice();
      p[m[0]] = p[m[1]] = false;
      const r = solve(this.g, this.faces, p, budget);
      if (r.solvable) return m;
      if (r.solvable === null && !unknown) unknown = m;
    }
    return unknown ?? moves[0];
  }

  /** is the current position solvable (null: undecided within budget) */
  solvable(budget = 60000): boolean | null {
    return solve(this.g, this.faces, this.present, budget).solvable;
  }
}
