import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/game';
import { geometry, transposeSlots, validateLayout } from '../../src/game/layout';
import { mulberry32 } from '../../src/game/rng';
import { solve } from '../../src/game/solver';
import { faceMatches, fullPairs } from '../../src/game/tiles';
import { JADE_TURTLE_LANDSCAPE, JADE_TURTLE_PORTRAIT } from '../../src/layouts/classic';

const LAYOUTS = [
  { id: 'turtle', slots: JADE_TURTLE_LANDSCAPE },
  { id: 'tall-turtle', slots: JADE_TURTLE_PORTRAIT },
];

describe('tile set', () => {
  it('has 144 tiles in 72 matching pairs', () => {
    const pairs = fullPairs();
    expect(pairs).toHaveLength(72);
    for (const [a, b] of pairs) expect(faceMatches(a, b)).toBe(true);
  });
});

describe('layouts', () => {
  for (const l of LAYOUTS)
    it(`${l.id} is valid`, () => {
      expect(validateLayout(l.slots)).toEqual([]);
      expect(validateLayout(transposeSlots(l.slots))).toEqual([]);
    });
});

describe('deals', () => {
  it('free-tile rule: a covered tile or a tile with both sides blocked is not free', () => {
    const g = geometry([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
      [2, 0, 1],
    ]);
    const all = [true, true, true, true];
    const game = new Game(g.slots, [0, 0, 1, 1], all);
    expect(game.isFree(0)).toBe(true);
    expect(game.isFree(1)).toBe(false); // covered and blocked
    expect(game.isFree(3)).toBe(true);
  });

  for (const l of LAYOUTS)
    for (const transpose of [false, true])
      it(`${l.id}${transpose ? ' (portrait)' : ''}: 40 seeded deals are all solvable`, () => {
        const slots = transpose ? transposeSlots(l.slots) : l.slots;
        let proved = 0;
        for (let seed = 1; seed <= 40; seed++) {
          const game = Game.deal(slots, seed * 1013);
          expect(game.remaining).toBe(slots.length);
          // the independent solver never finds a deal unsolvable
          const r = solve(game.g, game.faces, game.present, 100000);
          expect(r.solvable).not.toBe(false);
          if (r.solvable) proved++;
          // the construction certificate replays as legal moves to an empty board
          const replay = new Game(slots, game.faces);
          for (const [a, b] of game.solution) expect(replay.match(a, b)).toBe(true);
          expect(replay.won).toBe(true);
        }
        expect(proved).toBeGreaterThanOrEqual(38);
      });

  it('shuffle keeps the same tiles and makes the board solvable; undo restores it', () => {
    const game = Game.deal(LAYOUTS[0].slots, 7);
    for (let k = 0; k < 10; k++) {
      const m = game.hint();
      if (m) game.match(m[0], m[1]);
    }
    const before = game.faces.slice();
    const kinds = (f: number[]) => f.filter((_, i) => game.present[i]).sort((a, b) => a - b);
    expect(game.shuffle(mulberry32(3))).toBe(true);
    expect(kinds(game.faces)).toEqual(kinds(before));
    expect(game.solvable(200000)).toBe(true);
    game.undo();
    expect(game.faces).toEqual(before);
  });
});
