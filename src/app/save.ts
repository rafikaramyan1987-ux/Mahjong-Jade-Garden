import type { GameSnapshot } from '../game/game';
import { sdk } from './sdk';

export type Lang = 'en' | 'fr';

export interface BoardInProgress {
  mode: 'journey' | 'daily';
  layoutId: string;
  /** daily: the date key (YYYY-MM-DD) */
  day?: string;
  seed: number;
  transposed: boolean;
  game: GameSnapshot;
  time: number;
  score: number;
  hints: number;
  shufflesLeft: number;
  hintsLeft: number;
  streak: number;
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
  /** boards solved in the journey (each restores one garden element) */
  journey: number;
  /** stars per journey board index */
  stars: number[];
  daily: { last: string; streak: number; best: number; done: string[] };
  stats: { played: number; won: number; bestTime: number; totalTime: number; bestScore: number; tilesMatched: number };
  current: BoardInProgress | null;
}

const KEY = 'mahjongjadegarden.save.v1';

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
    journey: 0,
    stars: [],
    daily: { last: '', streak: 0, best: 0, done: [] },
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
      daily: { ...base.daily, ...(d.daily ?? {}) },
      stats: { ...base.stats, ...(d.stats ?? {}) },
      current: d.current && typeof d.current === 'object' && d.current.game ? d.current : null,
    };
  } catch {
    return base;
  }
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
    return parseSave(st.getItem(KEY));
  } catch {
    return defaultSave();
  }
}

export function saveNow(data: SaveData, st: Storage = storage()) {
  try {
    st.setItem(KEY, JSON.stringify(data));
  } catch {
    try {
      memStore.setItem(KEY, JSON.stringify(data));
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
