import { describe, expect, it } from 'vitest';
import { COMBO_WINDOW, MIDGAME_GAP, UNDOS_PER_BOARD, matchPoints, medalFor, nextCombo, starTargets, starsFor } from '../../src/app/app';
import { STRINGS } from '../../src/app/i18n';
import { parseSave } from '../../src/app/save';
import { ELEMENTS_PER_SEASON } from '../../src/art/garden';
import { validateLayout } from '../../src/game/layout';
import { boardTiles, footprint, MIN_PORTRAIT_FILL, DESKTOP_LANDSCAPE_AREA, MAX_PORTRAIT_COLS, MIN_LANDSCAPE_TILE, MIN_PORTRAIT_TILE, PHONE_PORTRAIT_AREA, tileWidthIn } from '../../src/layouts/build';
import { BOARDS_PER_SEASON, JOURNEY_LENGTH, dailyFor, journeyLayouts, layoutAt } from '../../src/layouts/catalog';
import { PHONE_LANDSCAPE_AREA, MIN_SHORT_TILE, SHORT_FLOOR_TILE } from '../../src/layouts/build';
import { resetProgress } from '../../src/app/save';

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
      for (const slots of [l.landscape, l.portrait, l.short]) {
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
  it('phones held sideways get their own variant: tiles >= 56 px up to board 40, never under 44 px', () => {
    for (const l of all) {
      const tw = Math.max(...[l.landscape, l.portrait, l.short].map((v) => tileWidthIn(boardTiles(v), PHONE_LANDSCAPE_AREA.w, PHONE_LANDSCAPE_AREA.h)));
      expect(tw, l.id).toBeGreaterThanOrEqual(l.index < 40 ? MIN_SHORT_TILE : SHORT_FLOOR_TILE);
      // about as many tiles as the other variants: equally hard on every screen
      expect(Math.abs(l.short.length - l.landscape.length), l.id).toBeLessThanOrEqual(Math.max(14, l.landscape.length * 0.25));
    }
  });
  it('the first three boards are small and quick (at most 24 tiles)', () => {
    for (const l of all.slice(0, 3)) for (const v of [l.landscape, l.portrait, l.short]) expect(v.length, l.id).toBeLessThanOrEqual(24);
    expect(all[3].landscape.length).toBeGreaterThan(24);
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
  it('every layout has a name in every language', () => {
    for (const l of all) for (const [lang, d] of Object.entries(STRINGS)) expect(d[`layout.${l.family}` as keyof typeof d], `${lang} ${l.family}`).toBeTruthy();
  });
});

describe('scoring and saves', () => {
  it('stars by time; combos win back time', () => {
    const tg = starTargets(144);
    expect(starsFor(144, tg.three)).toBe(3);
    expect(starsFor(144, tg.three + 5)).toBe(2);
    expect(starsFor(144, tg.three + 5, 5)).toBe(3);
    expect(starsFor(144, tg.two + 1)).toBe(1);
    // the first boards: 3 stars well within a minute and a half
    expect(starTargets(18).three).toBeLessThanOrEqual(90);
  });
  it('combos: matches within 3 s build a multiplier (x2 .. x5) that gives bonus points', () => {
    expect(COMBO_WINDOW).toBe(3000);
    expect(nextCombo(0, 100)).toBe(1);
    expect(nextCombo(1, 2900)).toBe(2);
    expect(nextCombo(4, 3001)).toBe(1);
    expect(matchPoints(1)).toBe(10);
    expect(matchPoints(3)).toBe(30);
    expect(matchPoints(9)).toBe(50);
    expect(matchPoints(1, true)).toBe(20);
  });
  it('reset progress keeps the settings', () => {
    const s = parseSave(JSON.stringify({ v: 1, journey: 12, lang: 'de', music: false, tileSize: 'large', stars: [3, 2] }));
    const r = resetProgress(s);
    expect(r.journey).toBe(0);
    expect(r.stars).toEqual([]);
    expect(r.lang).toBe('de');
    expect(r.music).toBe(false);
    expect(r.tileSize).toBe('large');
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
