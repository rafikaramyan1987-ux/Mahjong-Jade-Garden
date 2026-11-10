import type { GameSnapshot } from '../game/game';
import { isLang, type Lang } from './i18n';
import { sdk } from './sdk';

export type { Lang };

export interface BoardInProgress {
  /** journey: the next board; replay: a finished journey board played again; daily: the date's challenge */
  mode: 'journey' | 'daily' | 'replay';
  layoutId: string;
  /** journey board number (1-based) */
  board?: number;
  /** daily: the date key (YYYY-MM-DD) */
  day?: string;
  seed: number;
  variant: 'landscape' | 'portrait' | 'short';
  game: GameSnapshot;
  time: number;
  score: number;
  hints: number;
  shufflesLeft: number;
  hintsLeft: number;
  undosLeft?: number;
  streak: number;
  /** the free Shuffle offered at a dead end (once per board) was used */
  rescueUsed?: boolean;
  /** seconds won back by combos (they count toward the stars) */
  comboSecs?: number;
  /** longest combo on this board */
  bestCombo?: number;
}

export interface SaveData {
  v: 1;
  lang: Lang | null;
  music: boolean;
  sound: boolean;
  highlightFree: boolean;
  contrast: boolean;
  showTimer: boolean;
  tutorialDone: boolean;
  /** one-time tips already shown */
  tips: string[];
  /** tile set: illustrated Garden (default) or Classic */
  tileSet: 'garden' | 'classic';
  /** tile size: normal (the board fits the screen) or large (the board starts zoomed in; drag to move it) */
  tileSize: 'normal' | 'large';
  /** best score per journey board index */
  bestScores: number[];
  /** boards solved in the journey (each restores one garden element) */
  journey: number;
  /** stars per journey board index */
  stars: number[];
  /** best time (s) per journey board index (0 = not finished) */
  bestTimes: number[];
  /**
   * daily challenge: last finished day, current and longest streak (days in a row), finished days, the personal
   * best time per day and over all days
   */
  daily: { last: string; streak: number; longest: number; best: number; done: string[]; times: Record<string, number>; bestTime: number };
  stats: { played: number; won: number; bestTime: number; totalTime: number; bestScore: number; tilesMatched: number };
  current: BoardInProgress | null;
}

export const SAVE_KEY = 'mahjongjadegarden.save.v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    lang: null,
    music: true,
    sound: true,
    highlightFree: true,
    contrast: false,
    showTimer: true,
    tutorialDone: false,
    tips: [],
    tileSet: 'garden',
    tileSize: 'normal',
    bestScores: [],
    journey: 0,
    stars: [],
    bestTimes: [],
    daily: { last: '', streak: 0, longest: 0, best: 0, done: [], times: {}, bestTime: 0 },
    stats: { played: 0, won: 0, bestTime: 0, totalTime: 0, bestScore: 0, tilesMatched: 0 },
    current: null,
  };
}

export function parseSave(raw: string | null | undefined): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (!d || typeof d !== 'object' || d.v !== 1) return base;
    return {
      ...base,
      ...d,
      journey: Math.max(0, Math.floor(Number(d.journey) || 0)),
      stars: Array.isArray(d.stars) ? d.stars : [],
      bestTimes: Array.isArray(d.bestTimes) ? d.bestTimes : [],
      tips: Array.isArray(d.tips) ? d.tips : [],
      tileSet: d.tileSet === 'classic' ? 'classic' : 'garden',
      tileSize: d.tileSize === 'large' ? 'large' : 'normal',
      bestScores: Array.isArray(d.bestScores) ? d.bestScores : [],
      lang: isLang(d.lang) ? d.lang : null,
      daily: { ...base.daily, ...(d.daily ?? {}), times: d.daily?.times && typeof d.daily.times === 'object' ? d.daily.times : {} },
      stats: { ...base.stats, ...(d.stats ?? {}) },
      current: d.current && typeof d.current === 'object' && d.current.game ? d.current : null,
    };
  } catch {
    return base;
  }
}

/** "Reset progress": a fresh journey, daily record and statistics; the player's settings stay */
export function resetProgress(d: SaveData): SaveData {
  const fresh = defaultSave();
  return { ...fresh, lang: d.lang, music: d.music, sound: d.sound, highlightFree: d.highlightFree, contrast: d.contrast, tileSet: d.tileSet, tileSize: d.tileSize, tutorialDone: d.tutorialDone };
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const memory = new Map<string, string>();
const memStore: Storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };

/** portal storage, else localStorage, else an in-memory store (private mode / blocked storage) */
export function storage(): Storage {
  const data = sdk.data();
  if (data) return data;
  // Playgama: progress goes only through Bridge Storage; without Bridge the game plays on with an in-memory save
  if (__PLATFORM__ === 'playgama') return memStore;
  try {
    const ls = window.localStorage;
    ls.setItem('__mjg', '1');
    ls.removeItem('__mjg');
    return ls;
  } catch {
    return memStore;
  }
}

export function loadSave(st: Storage = storage()): SaveData {
  try {
    return parseSave(st.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function saveNow(data: SaveData, st: Storage = storage()) {
  try {
    st.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    try {
      memStore.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* keep playing */
    }
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;
export function saveSoon(data: SaveData) {
  if (pending !== null) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    saveNow(data);
  }, 400);
}
