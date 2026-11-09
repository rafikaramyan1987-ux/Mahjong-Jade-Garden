import { describe, expect, it } from 'vitest';
import { MIDGAME_GAP, UNDOS_PER_BOARD, medalFor, starsFor } from '../../src/app/app';
import { STRINGS } from '../../src/app/i18n';
import { parseSave } from '../../src/app/save';
import { ELEMENTS_PER_SEASON } from '../../src/art/garden';
import { validateLayout } from '../../src/game/layout';
import { boardTiles, footprint, MIN_PORTRAIT_FILL, DESKTOP_LANDSCAPE_AREA, MAX_PORTRAIT_COLS, MIN_LANDSCAPE_TILE, MIN_PORTRAIT_TILE, PHONE_PORTRAIT_AREA, tileWidthIn } from '../../src/layouts/build';
import { BOARDS_PER_SEASON, JOURNEY_LENGTH, dailyFor, journeyLayouts, layoutAt } from '../../src/layouts/catalog';

describe('journey catalog', () => {
  const all = journeyLayouts();
  it('has 64 layouts, one garden element per board in each of 4 seasons', () => {
    expect(all).toHaveLength(64);
    expect(JOURNEY_LENGTH).toBe(64);
    expect(BOARDS_PER_SEASON).toBe(ELEMENTS_PER_SEASON);
    expect(new Set(all.map((l) => l.id)).size).toBe(64);
  });
  it('every variant is a valid board of at most one tile set; tiles >= 56 px on a 390 px phone and >= 64 px on 1280 x 720', () => {
    for (const l of all)
      for (const slots of [l.landscape, l.portrait]) {
        expect(validateLayout(slots), l.id).toEqual([]);
        expect(slots.length).toBeLessThanOrEqual(144);
      }
    expect(MIN_PORTRAIT_TILE).toBe(56);
    expect(MIN_LANDSCAPE_TILE).toBe(64);
    for (const l of all) {
      const bp = boardTiles(l.portrait);
      expect(tileWidthIn(bp, PHONE_PORTRAIT_AREA.w, PHONE_PORTRAIT_AREA.h), l.id).toBeGreaterThanOrEqual(MIN_PORTRAIT_TILE);
      expect((bp.maxX - bp.minX) / 2, l.id).toBeLessThanOrEqual(MAX_PORTRAIT_COLS);
      const fp = footprint(l.portrait);
      expect(fp.split, `${l.id} split`).toBe(false);
      expect(fp.fill, `${l.id} fill`).toBeGreaterThanOrEqual(MIN_PORTRAIT_FILL);
      expect(tileWidthIn(boardTiles(l.landscape), DESKTOP_LANDSCAPE_AREA.w, DESKTOP_LANDSCAPE_AREA.h), l.id).toBeGreaterThanOrEqual(MIN_LANDSCAPE_TILE);
    }
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
  it('daily medals by time; ad gap and undo allowance', () => {
    expect(medalFor(100, 250)).toBe('gold');
    expect(medalFor(100, 450)).toBe('silver');
    expect(medalFor(100, 900)).toBe('bronze');
    expect(MIDGAME_GAP).toBe(120000);
    expect(UNDOS_PER_BOARD).toBeGreaterThan(0);
  });
  it('old saves get the new fields (best times, daily medals and streaks)', () => {
    const s = parseSave(JSON.stringify({ v: 1, journey: 3, daily: { last: '2026-11-08', streak: 2, best: 10, done: ['2026-11-08'] } }));
    expect(s.bestTimes).toEqual([]);
    expect(s.daily.times).toEqual({});
    expect(s.daily.longest).toBe(0);
    expect(s.daily.streak).toBe(2);
  });
  it('a broken or foreign save falls back to defaults', () => {
    expect(parseSave('{oops').journey).toBe(0);
    expect(parseSave(JSON.stringify({ v: 2, journey: 9 })).journey).toBe(0);
    expect(parseSave(JSON.stringify({ v: 1, journey: 9 })).journey).toBe(9);
  });
});
