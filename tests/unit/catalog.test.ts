import { describe, expect, it } from 'vitest';
import { starsFor } from '../../src/app/app';
import { STRINGS } from '../../src/app/i18n';
import { parseSave } from '../../src/app/save';
import { ELEMENTS_PER_SEASON } from '../../src/art/garden';
import { validateLayout } from '../../src/game/layout';
import { boardTiles, MIN_PORTRAIT_TILE, PHONE_PORTRAIT_AREA, tileWidthIn } from '../../src/layouts/build';
import { BOARDS_PER_SEASON, JOURNEY_LENGTH, dailyFor, journeyLayouts, layoutAt } from '../../src/layouts/catalog';

describe('journey catalog', () => {
  const all = journeyLayouts();
  it('has 64 layouts, one garden element per board in each of 4 seasons', () => {
    expect(all).toHaveLength(64);
    expect(JOURNEY_LENGTH).toBe(64);
    expect(BOARDS_PER_SEASON).toBe(ELEMENTS_PER_SEASON);
    expect(new Set(all.map((l) => l.id)).size).toBe(64);
  });
  it('every variant is a valid board of at most one tile set; portrait tiles >= 34 px on a 390 px phone', () => {
    for (const l of all)
      for (const slots of [l.landscape, l.portrait]) {
        expect(validateLayout(slots), l.id).toEqual([]);
        expect(slots.length).toBeLessThanOrEqual(144);
      }
    for (const l of all) expect(tileWidthIn(boardTiles(l.portrait), PHONE_PORTRAIT_AREA.w, PHONE_PORTRAIT_AREA.h), l.id).toBeGreaterThanOrEqual(MIN_PORTRAIT_TILE);
  });
  it('gets bigger and harder along the journey', () => {
    const avg = (s: number) => all.slice(s * 16, s * 16 + 16).reduce((a, l) => a + l.landscape.length, 0) / 16;
    for (let s = 1; s < 4; s++) expect(avg(s)).toBeGreaterThan(avg(s - 1));
    for (let i = 1; i < all.length; i++) expect(all[i].hardness).toBeGreaterThanOrEqual(all[i - 1].hardness);
  });
  it('the journey goes on after board 64; daily boards are deterministic', () => {
    expect(layoutAt(64).index).toBeGreaterThanOrEqual(32);
    expect(dailyFor('2026-11-09')).toEqual(dailyFor('2026-11-09'));
  });
  it('every layout has a name in both languages', () => {
    for (const l of all) {
      expect(STRINGS.EN[`layout.${l.family}` as keyof typeof STRINGS.EN], l.family).toBeTruthy();
      expect(STRINGS.FR[`layout.${l.family}` as keyof typeof STRINGS.FR], l.family).toBeTruthy();
    }
  });
});

describe('scoring and saves', () => {
  it('stars by time and hints', () => {
    expect(starsFor(144, 400, 0)).toBe(3);
    expect(starsFor(144, 900, 1)).toBe(2);
    expect(starsFor(144, 2000, 5)).toBe(1);
  });
  it('a broken or foreign save falls back to defaults', () => {
    expect(parseSave('{oops').journey).toBe(0);
    expect(parseSave(JSON.stringify({ v: 2, journey: 9 })).journey).toBe(0);
    expect(parseSave(JSON.stringify({ v: 1, journey: 9 })).journey).toBe(9);
  });
});
