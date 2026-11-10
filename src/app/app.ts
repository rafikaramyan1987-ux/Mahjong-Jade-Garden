/**
 * The game controller: screens (main menu, board, journey, garden, dialogs), the rules of a session (clock, score,
 * combos, stars, helpers), the in-game tutorial, saving, audio and the portal hooks (ads only between boards or from
 * an explicit "Watch an ad" button).
 */
import { Petals, drawBackground } from '../art/background';
import { ELEMENTS, ELEMENTS_PER_SEASON, SEASON_KEYS, drawGarden, type Season } from '../art/garden';
import { TileSprites, tileMetrics } from '../art/sprites';
import { CLASSIC, CONTRAST, type FaceOptions } from '../art/tileArt';
import { Game } from '../game/game';
import { mulberry32 } from '../game/rng';
import { FLOWERS } from '../game/tiles';
import { boardTiles, tileWidthIn } from '../layouts/build';
import { BOARDS_PER_SEASON, JOURNEY_LENGTH, VARIANTS, dailyFor, dealLayout, familyAt, journeySeed, layoutAt, layoutById, variantSlots, type BoardLayout, type Variant } from '../layouts/catalog';
import { BoardView, type Rect } from '../ui/boardView';
import { ICONS } from '../ui/icons';
import { audio } from './audio';
import { LANGS, LANG_NAMES, browserLangs, getLang, isLang, pickLang, setLang, t, windLetters, type StrKey } from './i18n';
import { loadSave, resetProgress, saveNow, saveSoon, type BoardInProgress, type SaveData } from './save';
import { sdk } from './sdk';

export const HINTS_PER_BOARD = 3;
export const SHUFFLES_PER_BOARD = 2;
export const UNDOS_PER_BOARD = 5;
/** at most one interstitial per this many ms (pre-roll included) */
export const MIDGAME_GAP = 120_000;
/** between-board interstitials only once this many boards have been cleared */
export const ADS_AFTER_BOARDS = 3;
const NO_AD_MS = 2500;
/** Playgama (2.2.4): boards whose dead end was already rescued by a rewarded shuffle (offered once per board) */
const adRescued = new WeakSet<object>();
/** matches within this many ms of each other build a combo */
export const COMBO_WINDOW = 3000;
/** the combo multiplier stops growing here */
export const COMBO_MAX = 5;
/** every match made in a combo wins back this many seconds for the stars */
export const COMBO_SECS = 1;
/** tile width the "large tiles" setting zooms the board to (px) */
const LARGE_TILE = 84;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Medal = 'gold' | 'silver' | 'bronze';
/** daily challenge medal by time (relative to the number of tiles): gold <= 3 s per tile, silver <= 5 s */
export function medalFor(tiles: number, seconds: number): Medal {
  if (seconds <= tiles * 3) return 'gold';
  if (seconds <= tiles * 5) return 'silver';
  return 'bronze';
}

/** the combo after a match made `sinceLastMs` after the previous one (1 = a single match, 2+ = a combo) */
export function nextCombo(combo: number, sinceLastMs: number): number {
  return combo > 0 && sinceLastMs <= COMBO_WINDOW ? combo + 1 : 1;
}

/** points for a match: 10 x the combo multiplier (up to x5), +10 for a flower or season pair */
export function matchPoints(combo: number, bonusTile = false): number {
  return 10 * Math.min(COMBO_MAX, Math.max(1, combo)) + (bonusTile ? 10 : 0);
}

/** star times of a board (s): 3 stars within `three`, 2 within `two` (combos win back time) */
export function starTargets(tiles: number) {
  return { three: Math.max(30, Math.round(tiles * 4)), two: Math.max(50, Math.round(tiles * 7)) };
}

/** stars for a cleared board: by time, minus the seconds won back with combos */
export function starsFor(tiles: number, seconds: number, comboSecs = 0): number {
  const st = Math.max(0, seconds - comboSecs);
  const tg = starTargets(tiles);
  return st <= tg.three ? 3 : st <= tg.two ? 2 : 1;
}

interface Play extends BoardInProgress {
  gameObj: Game;
  combo: number;
  lastMatchAt: number;
  /** the clock starts with the first tap on the board */
  clockOn: boolean;
}

type Screen = 'title' | 'board' | 'garden' | 'journey';

interface Hud {
  root: HTMLElement;
  tiles: HTMLElement;
  bar: HTMLElement;
  score: HTMLElement;
  goal: HTMLElement;
  goalStars: HTMLElement;
  goalTime: HTMLElement;
  tools: HTMLElement;
  hint: HTMLButtonElement;
  undo: HTMLButtonElement;
  shuffle: HTMLButtonElement;
  fit: HTMLButtonElement;
}

interface Tutorial {
  step: number;
  line: HTMLElement;
  hand: HTMLElement;
  skip: HTMLButtonElement;
  timers: ReturnType<typeof setTimeout>[];
  blocked: number;
}

const HAND_SVG =
  '<svg viewBox="0 0 48 56" width="48" height="56" aria-hidden="true"><path d="M18 4.5c2.6 0 4.5 2 4.5 4.6V25l1.4-.4c.6-2 2.3-3.3 4.4-3.3 1.8 0 3.3.9 4.1 2.4.8-.6 1.9-1 3-1 2 0 3.7 1.2 4.4 3 .7-.3 1.4-.5 2.2-.5 2.6 0 4.6 2.1 4.6 4.6v10.7c0 7.6-6.1 13.6-13.6 13.6h-5.4c-4.2 0-8.1-2-10.6-5.4L6.2 33.5a4.3 4.3 0 0 1 6.5-5.6l.8.9V9.1c0-2.6 2-4.6 4.5-4.6z" fill="#fffaf0" stroke="#203a2e" stroke-width="2.6" stroke-linejoin="round"/><path d="M27.6 30v9M35 30v9M42 31v8" stroke="#203a2e" stroke-width="2" stroke-linecap="round" opacity=".45"/></svg>';

class App {
  save: SaveData;
  private bg = document.getElementById('bg') as HTMLCanvasElement;
  private fx: HTMLCanvasElement;
  private boardCanvas = document.getElementById('board') as HTMLCanvasElement;
  private ui = document.getElementById('ui') as HTMLDivElement;
  private view: BoardView;
  private petals: Petals;
  private play: Play | null = null;
  private screen: Screen = 'title';
  private layer: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private hud: Hud | null = null;
  private tut: Tutorial | null = null;
  private adPaused = false;
  private prerollDone = false;
  /** time of the last interstitial (pre-roll or between boards), for the ~2 minute gap */
  private lastAdAt = -Infinity;
  private W = 0;
  private H = 0;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private fresh: boolean;
  /** the garden element restored by the last journey win, to bloom on the journey map */
  private pendingBloom: { season: Season; index: number } | null = null;
  private stuckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const q = new URLSearchParams(location.search);
    this.fresh = q.has('fresh');
    this.save = this.fresh ? loadSave({ getItem: () => null, setItem: () => {} }) : loadSave();
    const ql = q.get('lang');
    // Playgama: the language comes from Bridge (platform.language), else English; a language picked in Settings wins
    setLang(isLang(ql) ? ql : pickLang(this.save.lang, sdk.locale(), __PLATFORM__ === 'playgama' ? [] : browserLangs()));
    this.fx = document.createElement('canvas');
    this.fx.id = 'fx';
    this.bg.after(this.fx);
    this.petals = new Petals(this.fx);
    this.view = new BoardView(this.boardCanvas, this.faceOptions());
    this.view.highlightFree = this.save.highlightFree;
    this.view.reducedMotion = this.reducedMotion;
    this.view.preferTile = this.save.tileSize === 'large' ? LARGE_TILE : 0;
    this.view.onTap = (i) => this.onTileTap(i);
    this.view.onZoomChange = (z) => this.hud?.fit.classList.toggle('show', z);
    audio.setMusic(this.save.music);
    audio.setSound(this.save.sound);
    sdk.onAdPause = (p) => {
      this.adPaused = p;
      audio.setAdMuted(p);
      this.syncGameplay();
    };
    // the portal's mute setting (CrazyGames muteAudio, GamePix soundOff)
    audio.setPlatformMuted(sdk.muted);
    sdk.onMute = (m) => audio.setPlatformMuted(m);
    const unlock = () => audio.unlock();
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
    addEventListener('keydown', (e) => this.onKey(e));
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persist(true);
      this.syncGameplay();
    });
    addEventListener('pagehide', () => this.persist(true));
    setInterval(() => this.tick(), 1000);
  }

  faceOptions(): FaceOptions {
    return { set: this.save.tileSet, palette: this.save.contrast ? CONTRAST : CLASSIC, indices: this.save.contrast, windLetters: windLetters() };
  }

  persist(now = false) {
    if (this.play && !this.play.gameObj.won) {
      const p = this.play;
      this.save.current = {
        mode: p.mode,
        layoutId: p.layoutId,
        board: p.board,
        day: p.day,
        seed: p.seed,
        variant: p.variant,
        game: p.gameObj.snapshot(),
        time: p.time,
        score: p.score,
        hints: p.hints,
        shufflesLeft: p.shufflesLeft,
        hintsLeft: p.hintsLeft,
        undosLeft: p.undosLeft,
        streak: p.streak,
        rescueUsed: p.rescueUsed,
        comboSecs: p.comboSecs,
        bestCombo: p.bestCombo,
      };
    }
    // ?fresh (tests, recordings): progress lives in memory only
    if (this.fresh) return;
    if (now) saveNow(this.save);
    else saveSoon(this.save);
  }

  // ------------------------------------------------------------ layout

  resize() {
    const W = Math.max(1, innerWidth);
    const H = Math.max(1, innerHeight);
    this.W = W;
    this.H = H;
    const portrait = H > W * 1.05;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', !portrait);
    document.body.classList.toggle('short', !portrait && H < 520);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.bg.width = Math.round(W * dpr);
    this.bg.height = Math.round(H * dpr);
    this.bg.style.width = W + 'px';
    this.bg.style.height = H + 'px';
    const bctx = this.bg.getContext('2d')!;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(bctx, W, H);
    this.petals.resize(W, H, dpr);
    if (this.reducedMotion) this.petals.still();
    else this.petals.start();
    this.view.resize(W, H, dpr, this.boardArea());
    if (this.tut) this.placeTutorial();
    if (this.screen === 'garden') this.renderGardenCanvas();
    if (this.screen === 'title') this.renderTitleGarden();
  }

  private boardArea(): Rect {
    const W = this.W;
    const H = this.H;
    if (!this.hud) return { x: 0, y: 0, w: W, h: H };
    const top = this.hud.root.getBoundingClientRect().bottom;
    const portrait = document.body.classList.contains('portrait');
    const tools = this.hud.tools.getBoundingClientRect();
    // small margins: the board uses almost the whole screen
    const mx = 8;
    const my = 6;
    if (portrait) return { x: mx, y: top + my, w: W - mx * 2, h: tools.top - top - my * 2 };
    return { x: mx, y: top + my, w: tools.left - mx * 2, h: H - top - my * 2 };
  }

  // ------------------------------------------------------------ screens

  private clearLayer() {
    this.closeModal();
    this.endTutorial(false);
    this.clearStuckTimer();
    this.layer?.remove();
    this.layer = null;
    this.hud = null;
    document.querySelectorAll('.float').forEach((e) => e.remove());
  }

  /** a new screen fades in over the old one (no hard cuts) */
  private enter(layer: HTMLElement) {
    if (!this.reducedMotion) layer.classList.add('enter');
  }

  /** the main menu, over the garden art */
  showTitle() {
    this.leaveBoard();
    this.clearLayer();
    this.screen = 'title';
    this.view.setGame(null);
    const s = el('div', 'screen title-screen');
    s.dataset.testid = 'title-screen';
    const art = el('canvas', 'garden-bg');
    const shade = el('div', 'title-shade');
    const wrap = el('div', 'title-wrap');
    const logo = el('div', 'logo');
    const tiles = el('canvas', 'tiles');
    logo.append(tiles, el('div', 'mj', t('title.mahjong')), el('div', 'jg', t('title.jadeGarden')));
    const menu = el('div', 'menu');
    const cur = this.save.current;
    const boardN = this.save.journey + 1;
    const cont = !!cur && cur.mode === 'journey';
    const play = this.button(
      `${ICONS.play}<span class="lbl">${cont ? t('menu.continue') : t('menu.play')}<span class="sub">${t('menu.board', { n: boardN })} · ${t(`layout.${familyAt(this.save.journey)}` as StrKey)}</span></span>`,
      'btn primary big',
      () => void this.onPlay(),
    );
    play.dataset.testid = 'play';
    const done = Math.min(this.save.journey, JOURNEY_LENGTH);
    const journeyBtn = this.button(`${ICONS.map}<span class="lbl">${t('menu.journey')}<span class="sub">${t('journey.count', { n: done, total: JOURNEY_LENGTH })}</span></span>`, 'btn', () => this.showJourney());
    journeyBtn.dataset.testid = 'journey';
    const daily = this.button(`${ICONS.calendar}<span class="lbl">${t('menu.daily')}<span class="sub" data-testid="daily-note">${this.dailyNote()}</span></span>`, 'btn', () => this.startDaily());
    daily.dataset.testid = 'daily';
    const settings = this.button(`${ICONS.gear}<span class="lbl">${t('menu.settings')}</span>`, 'btn', () => this.openSettings());
    settings.dataset.testid = 'settings';
    menu.append(play, journeyBtn, daily, settings);
    wrap.append(logo, menu);
    s.append(art, shade, wrap);
    this.ui.append(s);
    this.layer = s;
    this.enter(s);
    this.drawTitleTiles(tiles);
    this.resize();
  }

  /** the menu backdrop: the current season's garden in full bloom (drawn once per season and screen size) */
  private titleArt: { key: string; c: HTMLCanvasElement } | null = null;
  private renderTitleGarden() {
    const c = this.layer?.querySelector('canvas.garden-bg') as HTMLCanvasElement | null;
    if (!c) return;
    const season = Math.min(3, Math.floor(this.save.journey / ELEMENTS_PER_SEASON)) as Season;
    const key = `${season}|${this.W}|${this.H}|${window.devicePixelRatio}`;
    if (this.titleArt?.key !== key) {
      const art = document.createElement('canvas');
      this.paintGarden(art, this.W, this.H, { season, restored: ELEMENTS_PER_SEASON });
      this.titleArt = { key, c: art };
    }
    const a = this.titleArt.c;
    c.width = a.width;
    c.height = a.height;
    c.style.width = this.W + 'px';
    c.style.height = this.H + 'px';
    c.getContext('2d')!.drawImage(a, 0, 0);
  }

  /** draw the garden into a canvas at the screen's pixel density */
  private paintGarden(c: HTMLCanvasElement, W: number, H: number, v: Parameters<typeof drawGarden>[5]) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGarden(ctx, 0, 0, W, H, v);
  }

  private drawTitleTiles(c: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const short = innerHeight < 520;
    const tw = Math.round(Math.min(short ? 40 : 60, Math.max(38, Math.min(innerWidth, innerHeight) * 0.09)));
    const m = tileMetrics(tw);
    const sp = new TileSprites(m, dpr, this.faceOptions());
    const W = tw * 4.2;
    const H = m.h * 1.35;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const faces = this.save.tileSet === 'garden' ? [0, 2, 1] : [0, 31, FLOWERS];
    faces.forEach((f, i) => {
      ctx.save();
      ctx.translate(W / 2 + (i - 1) * tw * 1.12, H * 0.56 + (i === 1 ? -m.h * 0.08 : 0));
      ctx.rotate((i - 1) * 0.16);
      sp.draw(ctx, f, -m.w / 2, -m.h / 2);
      ctx.restore();
    });
  }

  private button(html: string, cls: string, fn: () => void) {
    const b = el('button', cls, html);
    b.type = 'button';
    b.addEventListener('click', () => {
      audio.play('button');
      fn();
    });
    return b;
  }

  // ------------------------------------------------------------ boards

  /** the line under Daily Challenge: done today + streak, a gentle reminder to keep a streak, or what it is */
  private dailyNote() {
    const d = this.save.daily;
    const today = todayKey();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (d.done.includes(today)) return `${t('daily.done')} ✓${d.streak > 1 ? ' · ' + t('daily.streak', { n: d.streak }) : ''}`;
    if (d.streak > 0 && d.last === todayKey(y)) return t('daily.keep', { n: d.streak });
    return t('daily.new');
  }

  private async onPlay() {
    // pre-roll interstitial (GameDistribution only): only from this click, once per session
    if (!this.prerollDone) {
      this.prerollDone = true;
      if (sdk.adSlot('preroll')) {
        this.lastAdAt = Date.now();
        await sdk.interstitial('preroll');
      }
    }
    const cur = this.save.current;
    if (cur && cur.mode === 'journey') this.resumeBoard(cur);
    else this.startJourney();
  }

  /** the layout variant (wide, tall or short) that gives the biggest tiles in the current board area */
  private chooseVariant(l: BoardLayout): Variant {
    const area = this.boardArea();
    let best: Variant = 'landscape';
    let bw = 0;
    for (const v of VARIANTS) {
      const w = tileWidthIn(boardTiles(variantSlots(l, v)), area.w, area.h);
      if (w > bw + 0.5) {
        bw = w;
        best = v;
      }
    }
    return best;
  }

  startJourney(): void {
    const n = this.save.journey;
    // the journey board in progress is kept; a replay in progress is dropped
    if (this.save.current?.mode === 'replay') this.save.current = null;
    if (this.save.current?.mode === 'journey') return this.resumeBoard(this.save.current);
    const layout = layoutAt(n);
    const q = new URLSearchParams(location.search);
    const seed = q.has('seed') ? Number(q.get('seed')) : journeySeed(n);
    this.startBoard('journey', layout, seed, undefined, n + 1);
  }

  startDaily() {
    const day = todayKey();
    const cur = this.save.current;
    if (cur && cur.mode === 'daily' && cur.day === day) return this.resumeBoard(cur);
    const { layout, seed } = dailyFor(day);
    this.startBoard('daily', layout, seed, day);
  }

  /** replay a finished journey board (the same deal); best stars / time / score update only if better */
  startReplay(n: number) {
    this.startBoard('replay', layoutAt(n), journeySeed(n), undefined, n + 1);
  }

  private startBoard(mode: 'journey' | 'daily' | 'replay', layout: BoardLayout, seed: number, day?: string, board?: number) {
    this.enterBoardScreen();
    this.resize();
    const variant = this.chooseVariant(layout);
    const game = dealLayout(layout, variant, seed);
    this.play = {
      mode,
      layoutId: layout.id,
      board,
      day,
      seed,
      variant,
      game: game.snapshot(),
      gameObj: game,
      time: 0,
      score: 0,
      hints: 0,
      hintsLeft: HINTS_PER_BOARD,
      shufflesLeft: SHUFFLES_PER_BOARD,
      undosLeft: UNDOS_PER_BOARD,
      streak: 0,
      rescueUsed: false,
      comboSecs: 0,
      bestCombo: 0,
      combo: 0,
      lastMatchAt: 0,
      clockOn: false,
    };
    this.save.stats.played++;
    this.attachBoard();
  }

  private resumeBoard(cur: BoardInProgress): void {
    this.enterBoardScreen();
    let game: Game;
    try {
      game = Game.restore(cur.game);
    } catch {
      this.save.current = null;
      return this.startJourney();
    }
    this.play = { ...cur, gameObj: game, combo: 0, lastMatchAt: 0, clockOn: false };
    this.attachBoard();
  }

  private attachBoard() {
    const p = this.play!;
    this.view.setGame(p.gameObj);
    this.resize();
    this.view.setGame(p.gameObj);
    if (!this.reducedMotion) this.boardCanvas.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' });
    this.updateHud();
    this.persist();
    this.syncGameplay();
    if (!this.save.tutorialDone && p.mode === 'journey' && p.board === 1 && p.gameObj.history.length === 0) this.startTutorial();
    else if (p.gameObj.stuck) this.scheduleStuck(300);
  }

  private enterBoardScreen() {
    this.clearLayer();
    this.screen = 'board';
    const root = el('div', 'board-layer');
    const hud = el('div', 'hud');
    const pauseBtn = this.button(ICONS.pause, 'icon-btn', () => this.openPause());
    pauseBtn.setAttribute('aria-label', t('btn.pause'));
    pauseBtn.dataset.testid = 'menu';
    // goal: tiles left with a progress bar, the score, and the star target
    const mid = el('div', 'hud-mid');
    const stat = (key: StrKey, id: string) => {
      const s = el('div', 'stat');
      s.dataset.stat = id;
      s.append(el('div', 'k', t(key)));
      const v = el('div', 'v', '0');
      s.append(v);
      return [s, v] as const;
    };
    const [tilesS, tilesV] = stat('hud.tilesLeft', 'tiles');
    const [scoreS, scoreV] = stat('hud.score', 'score');
    const statsRow = el('div', 'stats');
    statsRow.append(tilesS, scoreS);
    const bar = el('div', 'progress', '<i></i>');
    mid.append(statsRow, bar);
    const goal = el('div', 'goal');
    goal.dataset.testid = 'goal';
    const goalStars = el('div', 'goal-stars', [0, 1, 2].map(() => `<i>${ICONS.star}</i>`).join(''));
    const goalTime = el('div', 'goal-time', '');
    goal.append(goalStars, goalTime);
    hud.append(pauseBtn, mid, goal);
    const tools = el('div', 'tools');
    const tool = (icon: string, label: StrKey, fn: () => void, id: string) => {
      const b = this.button(`${icon}<span class="tl">${t(label)}</span><span class="badge"></span>`, 'tool', fn);
      b.dataset.testid = id;
      tools.append(b);
      return b;
    };
    const hint = tool(ICONS.hint, 'btn.hint', () => this.onHint(), 'hint');
    const undo = tool(ICONS.undo, 'btn.undo', () => this.onUndo(), 'undo');
    const shuffle = tool(ICONS.shuffle, 'btn.shuffle', () => this.onShuffle(), 'shuffle');
    const fit = this.button(ICONS.fit, 'icon-btn fit-btn', () => this.view.resetZoom());
    fit.setAttribute('aria-label', t('btn.resetZoom'));
    root.append(hud, tools, fit);
    this.ui.append(root);
    this.layer = root;
    this.enter(root);
    this.hud = { root: hud, tiles: tilesV, bar: bar.firstElementChild as HTMLElement, score: scoreV, goal, goalStars, goalTime, tools, hint, undo, shuffle, fit };
    // the fit button sits just under the bar on the left (placed now: no layout jump later)
    fit.style.top = hud.getBoundingClientRect().bottom + 8 + 'px';
  }

  private leaveBoard() {
    if (this.play) this.persist(true);
    this.play = null;
    // menus are not gameplay
    sdk.gameplayStop();
  }

  private updateHud() {
    const p = this.play;
    const h = this.hud;
    if (!p || !h) return;
    const g = p.gameObj;
    h.tiles.textContent = String(g.remaining);
    h.score.textContent = String(p.score);
    h.bar.style.width = `${((g.total - g.remaining) / Math.max(1, g.total)) * 100}%`;
    this.updateGoal();
    // a count while some are left; a TV and "+1" (rewarded ad) once they run out
    const badge = (b: HTMLButtonElement, left: number) => {
      const e = b.querySelector('.badge') as HTMLElement;
      // Playgama without rewarded ads (Bridge isRewardedSupported false): no "+1" offer, the count just stays at 0
      e.innerHTML = left > 0 ? String(left) : __PLATFORM__ === 'playgama' && !sdk.available ? '0' : `${sdk.name === 'web' ? '' : ICONS.tv}+1`;
      e.classList.toggle('plus', left <= 0);
      b.dataset.out = String(left <= 0);
    };
    badge(h.hint, p.hintsLeft);
    badge(h.shuffle, p.shufflesLeft);
    badge(h.undo, p.undosLeft ?? UNDOS_PER_BOARD);
    h.undo.disabled = g.history.length === 0;
  }

  /** the star target: the stars still in reach and the time left for them */
  private updateGoal() {
    const p = this.play;
    const h = this.hud;
    if (!p || !h) return;
    const tg = starTargets(p.gameObj.total);
    const st = Math.max(0, p.time - (p.comboSecs ?? 0));
    const stars = st <= tg.three ? 3 : st <= tg.two ? 2 : 1;
    h.goalStars.querySelectorAll('i').forEach((e, k) => e.classList.toggle('on', k < stars));
    h.goalTime.textContent = stars === 3 ? fmtTime(tg.three - st) : stars === 2 ? fmtTime(tg.two - st) : t('hud.finish');
    h.goal.dataset.stars = String(stars);
    h.goal.title = t('hud.goalHint', { time: fmtTime(tg.three) });
    h.goal.classList.toggle('low', stars > 1 && (stars === 3 ? tg.three : tg.two) - st <= 10);
  }

  private tick() {
    const p = this.play;
    if (!p || this.screen !== 'board' || this.modal || this.adPaused || document.hidden || p.gameObj.won || !p.clockOn) return;
    if (this.tut && this.tut.step < 3) return;
    p.time++;
    this.updateGoal();
    if (p.time % 10 === 0) this.persist();
  }

  private onTileTap(i: number) {
    const p = this.play;
    if (!p || this.modal) return;
    const g = p.gameObj;
    if (i < 0) {
      if (this.view.selected >= 0) {
        this.view.selected = -1;
        this.view.invalidate();
      }
      return;
    }
    p.clockOn = true;
    if (!g.isFree(i)) {
      // a soft shake and a gentle sound, never a harsh error
      audio.play('mismatch');
      this.view.shakeTile(i);
      if (this.tut && this.tut.step === 2 && i === this.tut.blocked) this.tutorialStep(3);
      return;
    }
    const sel = this.view.selected;
    if (sel < 0 || sel === i) {
      this.view.selected = sel === i ? -1 : i;
      audio.play('select');
      this.view.invalidate();
      if (this.tut?.step === 1) this.tutorialHand();
      return;
    }
    if (g.canMatch(sel, i)) {
      this.doMatch(sel, i);
    } else {
      // a different picture: that tile is selected instead, with a soft shake of the first one
      this.view.shakeTile(sel);
      this.view.selected = i;
      audio.play('select');
      this.view.invalidate();
      if (this.tut?.step === 1) this.tutorialHand();
    }
  }

  private doMatch(a: number, b: number) {
    const p = this.play!;
    const g = p.gameObj;
    const bonus = g.faces[a] >= FLOWERS;
    g.match(a, b);
    this.view.selected = -1;
    const now = performance.now();
    p.combo = nextCombo(p.combo, now - p.lastMatchAt);
    p.lastMatchAt = now;
    p.bestCombo = Math.max(p.bestCombo ?? 0, p.combo);
    const pts = matchPoints(p.combo, bonus);
    p.score += pts;
    if (p.combo >= 2) p.comboSecs = (p.comboSecs ?? 0) + COMBO_SECS;
    const at = this.view.removeAnim(a, b, p.combo);
    audio.play('match', p.combo - 1);
    if (p.combo >= 2) audio.play('combo', p.combo);
    this.floatLabel(at, pts, p.combo);
    this.save.stats.tilesMatched += 2;
    if (this.tut) {
      if (this.tut.step === 1 || this.tut.step === 2) this.tutorialStep(this.tut.step + 1);
      else if (this.tut.step === 3) this.endTutorial(true);
    }
    this.updateHud();
    this.persist();
    if (g.won) setTimeout(() => this.onWin(), 620);
    else if (g.stuck) this.scheduleStuck(650);
  }

  /** "+20" and, in a combo, "Combo x2" rising from where the tiles met */
  private floatLabel([x, y]: [number, number], pts: number, combo: number) {
    const f = el('div', `float${combo >= 2 ? ' combo' : ''}`);
    f.dataset.testid = combo >= 2 ? 'combo' : 'points';
    if (combo >= 2) f.append(el('b', '', t('hud.combo', { n: Math.min(combo, COMBO_MAX) })));
    f.append(el('span', '', `+${pts}${combo >= 2 ? ` · +${COMBO_SECS}s` : ''}`));
    f.style.left = Math.round(Math.max(70, Math.min(this.W - 70, x))) + 'px';
    f.style.top = Math.round(Math.max(90, y)) + 'px';
    this.ui.append(f);
    setTimeout(() => f.remove(), 1100);
  }

  private onHint() {
    const p = this.play;
    if (!p || this.modal) return;
    if (p.hintsLeft <= 0) return this.offerExtra('hint');
    const m = p.gameObj.hint();
    if (!m) return this.openStuck();
    p.hintsLeft--;
    p.hints++;
    audio.play('hint');
    this.view.selected = -1;
    this.view.showHint(m);
    this.updateHud();
    this.persist();
  }

  private onUndo() {
    const p = this.play;
    if (!p || this.modal || !p.gameObj.history.length) return;
    if ((p.undosLeft ?? UNDOS_PER_BOARD) <= 0) return this.offerExtra('undo');
    const h = p.gameObj.undo();
    if (!h) return;
    p.undosLeft = Math.max(0, (p.undosLeft ?? UNDOS_PER_BOARD) - 1);
    audio.play('undo');
    this.view.selected = -1;
    this.view.hint = null;
    if (h.kind === 'match') p.score = Math.max(0, p.score - 10);
    p.combo = 0;
    this.view.invalidate();
    this.updateHud();
    this.persist();
  }

  private onShuffle() {
    const p = this.play;
    if (!p || this.modal) return;
    if (p.shufflesLeft <= 0) return this.offerExtra('shuffle');
    this.doShuffle(true);
  }

  /** shuffle the remaining tiles into a solvable position; `useOne` takes one of the board's shuffles */
  private doShuffle(useOne: boolean) {
    const p = this.play!;
    if (!p.gameObj.shuffle(mulberry32((Date.now() ^ p.seed) >>> 0))) {
      this.toast(t('stuck.cannot'));
      return;
    }
    if (useOne) p.shufflesLeft = Math.max(0, p.shufflesLeft - 1);
    audio.play('shuffle');
    this.view.selected = -1;
    this.view.hint = null;
    this.view.invalidate();
    if (!this.reducedMotion) this.boardCanvas.animate([{ filter: 'brightness(1.25)', transform: 'scale(0.985)' }, { filter: 'none', transform: 'none' }], { duration: 420, easing: 'ease-out' });
    this.updateHud();
    this.persist();
  }

  private toast(text: string, ms = 3200) {
    const tt = el('div', 'toast', text);
    this.ui.append(tt);
    setTimeout(() => tt.remove(), ms);
  }

  // ------------------------------------------------------------ keyboard

  /**
   * Optional shortcuts by physical key (KeyboardEvent.code, so QWERTY and AZERTY behave the same): H hint, U undo,
   * S shuffle, P pause / resume. Escape is never used, nor Ctrl / Cmd / Alt combinations.
   */
  private onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'SELECT' || target.tagName === 'INPUT');
    // the game page never scrolls (the portal page around it must not move either)
    if (!typing && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.code) && target?.tagName !== 'BUTTON') e.preventDefault();
    if (e.repeat || typing || this.screen !== 'board' || !this.play || this.adPaused) return;
    if (e.code === 'KeyP') {
      if (this.modal?.querySelector('[data-testid=pause]')) this.closeModal();
      else if (!this.modal) this.openPause();
      return;
    }
    if (this.modal) return;
    if (e.code === 'KeyH') this.onHint();
    else if (e.code === 'KeyU') this.onUndo();
    else if (e.code === 'KeyS') this.onShuffle();
  }

  // ------------------------------------------------------------ ads

  /**
   * A button that asks for a rewarded ad. Settles once; the reward only when the ad really completed; otherwise it
   * shows "No ad available right now, try later" for 2.5 s and re-enables.
   */
  private adButton(label: string, onReward: () => void, cls = 'btn primary') {
    const b = this.button(label, cls, async () => {
      if (b.disabled) return;
      b.disabled = true;
      const ok = await sdk.rewarded();
      if (ok) {
        onReward();
        return;
      }
      b.innerHTML = t('ad.none');
      b.dataset.state = 'noad';
      setTimeout(() => {
        b.innerHTML = label;
        b.disabled = false;
        delete b.dataset.state;
      }, NO_AD_MS);
    });
    b.dataset.testid = 'reward';
    return b;
  }

  /** label of a rewarded button: a TV icon + "Watch an ad: +1 hint" (portal builds) or "+1 hint" (web build: free) */
  private rewardLabel(icon: string, key: StrKey) {
    return sdk.name === 'web' ? `${icon}<span>${t('ad.free', { what: t(key) })}</span>` : `${ICONS.tv}<span>${t('ad.watchFor', { what: t(key) })}</span>`;
  }

  private offerExtra(kind: 'hint' | 'shuffle' | 'undo') {
    // Playgama: the rewarded buttons are hidden where Bridge has no rewarded ads
    if (__PLATFORM__ === 'playgama' && !sdk.available) return;
    const panel = this.openModal();
    panel.dataset.testid = `offer-${kind}`;
    const title: Record<typeof kind, StrKey> = { hint: 'ad.outHint', shuffle: 'ad.outShuffle', undo: 'ad.outUndo' };
    panel.append(el('h2', '', t(title[kind])));
    if (sdk.name !== 'web') panel.append(el('p', '', t('ad.offer')));
    const grant = () => {
      const p = this.play;
      this.closeModal();
      if (!p) return;
      if (kind === 'hint') {
        p.hintsLeft++;
        this.onHint();
      } else if (kind === 'shuffle') {
        p.shufflesLeft++;
        this.doShuffle(true);
      } else {
        p.undosLeft = (p.undosLeft ?? 0) + 1;
        this.onUndo();
      }
    };
    const icon = { hint: ICONS.hint, shuffle: ICONS.shuffle, undo: ICONS.undo }[kind];
    const what: Record<typeof kind, StrKey> = { hint: 'ad.oneHint', shuffle: 'ad.oneShuffle', undo: 'ad.oneUndo' };
    panel.append(this.adButton(this.rewardLabel(icon, what[kind]), grant));
    const no = this.button(t('btn.noThanks'), 'btn ghost', () => this.closeModal());
    no.dataset.testid = 'no-thanks';
    panel.append(no);
  }

  // ------------------------------------------------------------ dialogs

  /**
   * Tell the portal whether the player is actually playing: on a board, with no dialog, result screen or ad on top,
   * the tab visible. Called whenever any of these change; the platform de-duplicates.
   */
  private syncGameplay() {
    const p = this.play;
    const active = this.screen === 'board' && !!p && !p.gameObj.won && !this.modal && !this.adPaused && !document.hidden;
    if (active) sdk.gameplayStart();
    else sdk.gameplayStop();
  }

  private openModal(cls = ''): HTMLElement {
    this.closeModal();
    const back = el('div', 'backdrop');
    const panel = el('div', `panel ${cls}`);
    panel.setAttribute('role', 'dialog');
    back.append(panel);
    this.ui.append(back);
    this.modal = back;
    this.syncGameplay();
    if (this.tut) this.tut.line.parentElement!.style.visibility = 'hidden';
    return panel;
  }

  private closeModal() {
    this.modal?.remove();
    this.modal = null;
    this.syncGameplay();
    if (this.tut) this.tut.line.parentElement!.style.visibility = '';
  }

  private openPause() {
    if (!this.play) return;
    const panel = this.openModal();
    panel.dataset.testid = 'pause';
    panel.append(el('h2', '', t('pause.title')));
    panel.append(el('p', 'sub-title', this.boardLabel(this.play)));
    const resume = this.button(`${ICONS.play}<span>${t('btn.resume')}</span>`, 'btn primary', () => this.closeModal());
    resume.dataset.testid = 'resume';
    const settings = this.button(`${ICONS.gear}<span>${t('menu.settings')}</span>`, 'btn', () => this.openSettings(() => this.openPause()));
    settings.dataset.testid = 'pause-settings';
    const menu = this.button(`${ICONS.home}<span>${t('btn.mainMenu')}</span>`, 'btn', () => this.showTitle());
    menu.dataset.testid = 'to-menu';
    const restart = this.button(`${ICONS.reset}<span>${t('btn.restart')}</span>`, 'btn ghost', () => {
      const p = this.play;
      if (!p) return;
      // same deal from the start
      while (p.gameObj.history.length) p.gameObj.undo();
      Object.assign(p, { time: 0, score: 0, hints: 0, hintsLeft: HINTS_PER_BOARD, shufflesLeft: SHUFFLES_PER_BOARD, undosLeft: UNDOS_PER_BOARD, rescueUsed: false, comboSecs: 0, bestCombo: 0, combo: 0, clockOn: false });
      this.closeModal();
      this.view.setGame(p.gameObj);
      this.updateHud();
      this.persist();
    });
    restart.dataset.testid = 'restart';
    panel.append(resume, settings, menu, restart);
  }

  /** "Board 5 · Plum Blossom" or "Daily Challenge · Plum Blossom" */
  private boardLabel(p: BoardInProgress) {
    const l = layoutById(p.layoutId);
    const name = l ? t(`layout.${l.family}` as StrKey) : '';
    if (p.mode === 'daily') return `${t('daily.title')} · ${name}`;
    return `${t('menu.board', { n: p.board ?? (l ? l.index + 1 : 1) })} · ${name}`;
  }

  private clearStuckTimer() {
    if (this.stuckTimer) clearTimeout(this.stuckTimer);
    this.stuckTimer = null;
  }

  /** no moves left: offer Shuffle automatically (after the match animation) */
  private scheduleStuck(ms: number) {
    this.clearStuckTimer();
    this.stuckTimer = setTimeout(() => {
      this.stuckTimer = null;
      if (this.play?.gameObj.stuck && !this.modal && !this.play.gameObj.won) this.openStuck();
    }, ms);
  }

  /**
   * No moves left: never a dead end. The first time on a board Shuffle is free; then a shuffle of the board's own
   * allowance, then a rewarded shuffle. Undo is always offered too.
   */
  private openStuck() {
    const p = this.play;
    if (!p) return;
    if (this.tut) this.endTutorial(true);
    const panel = this.openModal('compact');
    panel.dataset.testid = 'stuck';
    panel.append(el('h2', '', t('stuck.title')), el('p', '', t('stuck.text')));
    if (!p.rescueUsed) {
      const b = this.button(`${ICONS.shuffle}<span>${t('stuck.freeShuffle')}</span>`, 'btn primary', () => {
        this.closeModal();
        p.rescueUsed = true;
        this.doShuffle(false);
      });
      b.dataset.testid = 'stuck-shuffle';
      panel.append(b);
    } else if (p.shufflesLeft > 0) {
      const b = this.button(`${ICONS.shuffle}<span>${t('stuck.shuffleLeft', { n: p.shufflesLeft })}</span>`, 'btn primary', () => {
        this.closeModal();
        this.doShuffle(true);
      });
      b.dataset.testid = 'stuck-shuffle';
      panel.append(b);
    } else if (__PLATFORM__ !== 'playgama' || (sdk.available && !adRescued.has(p))) {
      // a real dead end (no pairs, no shuffle left): GamePix tracks it as a sad moment
      if (__PLATFORM__ === 'gamepix') sdk.sadMoment?.('game_over');
      const b = this.adButton(this.rewardLabel(ICONS.shuffle, 'ad.oneShuffle'), () => {
        this.closeModal();
        if (__PLATFORM__ === 'playgama') adRescued.add(p);
        this.doShuffle(false);
      });
      b.dataset.testid = 'reward-continue';
      panel.append(b);
    }
    if (p.gameObj.history.length)
      panel.append(
        this.button(`${ICONS.undo}<span>${t('btn.undo')}</span>`, 'btn', () => {
          this.closeModal();
          this.onUndo();
        }),
      );
    panel.append(this.button(t('btn.mainMenu'), 'btn ghost', () => this.showTitle()));
  }

  /** Settings: music, sounds, language, tile size, tile set, free-tile shading, reset progress */
  openSettings(back?: () => void) {
    const panel = this.openModal('settings');
    panel.dataset.testid = 'settings-panel';
    const close = () => (back ? back() : this.closeModal());
    const x = this.button(ICONS.close, 'close-x', close);
    x.setAttribute('aria-label', t('btn.close'));
    panel.append(x, el('h2', '', t('settings.title')));
    const row = (icon: string, key: StrKey, control: HTMLElement) => {
      const r = el('div', 'setting');
      const lab = el('span', 'lab', `${icon}<span>${t(key)}</span>`);
      r.append(lab, control);
      panel.append(r);
    };
    const toggle = (icon: string, key: StrKey, get: () => boolean, set: (v: boolean) => void, id: string) => {
      const b = el('button', 'toggle');
      b.type = 'button';
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-label', t(key));
      b.setAttribute('aria-checked', String(get()));
      b.dataset.testid = id;
      b.addEventListener('click', () => {
        set(!get());
        b.setAttribute('aria-checked', String(get()));
        audio.play('button');
        saveNow(this.save);
      });
      row(icon, key, b);
    };
    const seg = <T extends string>(icon: string, key: StrKey, opts: [T, StrKey][], get: () => T, set: (v: T) => void, id: string) => {
      const s = el('div', 'seg');
      for (const [v, k] of opts) {
        const b = el('button', '', t(k));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(get() === v));
        b.dataset.testid = `${id}-${v}`;
        b.addEventListener('click', () => {
          if (get() === v) return;
          set(v);
          saveNow(this.save);
          audio.play('button');
          for (const o of s.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
        });
        s.append(b);
      }
      row(icon, key, s);
    };
    toggle(ICONS.music, 'settings.music', () => this.save.music, (v) => audio.setMusic((this.save.music = v)), 'set-music');
    toggle(ICONS.sound, 'settings.sound', () => this.save.sound, (v) => audio.setSound((this.save.sound = v)), 'set-sound');
    // language
    const sel = el('select', 'lang-select');
    sel.dataset.testid = 'lang';
    sel.setAttribute('aria-label', t('settings.language'));
    for (const l of LANGS) {
      const o = el('option', '', LANG_NAMES[l]);
      o.value = l;
      o.selected = getLang() === l;
      sel.append(o);
    }
    sel.addEventListener('change', () => {
      const l = sel.value;
      if (!isLang(l) || l === getLang()) return;
      setLang(l);
      this.save.lang = l;
      saveNow(this.save);
      this.view.setFaceOptions(this.faceOptions());
      this.relabel(back);
    });
    row(ICONS.globe, 'settings.language', sel);
    seg(
      ICONS.tiles,
      'settings.tileSize',
      [
        ['normal', 'settings.sizeNormal'],
        ['large', 'settings.sizeLarge'],
      ],
      () => this.save.tileSize,
      (v) => {
        this.save.tileSize = v;
        this.view.preferTile = v === 'large' ? LARGE_TILE : 0;
        this.view.resetZoom();
        this.view.applyPreferredZoom();
      },
      'size',
    );
    seg(
      ICONS.leaf,
      'settings.tiles',
      [
        ['garden', 'settings.tilesGarden'],
        ['classic', 'settings.tilesClassic'],
      ],
      () => this.save.tileSet,
      (v) => {
        this.save.tileSet = v;
        this.view.setFaceOptions(this.faceOptions());
        const c = document.querySelector('.logo canvas') as HTMLCanvasElement | null;
        if (c) this.drawTitleTiles(c);
      },
      'tiles',
    );
    toggle(
      ICONS.star,
      'settings.highlight',
      () => this.save.highlightFree,
      (v) => {
        this.save.highlightFree = this.view.highlightFree = v;
        this.view.invalidate();
      },
      'set-highlight',
    );
    toggle(
      ICONS.chart,
      'settings.contrast',
      () => this.save.contrast,
      (v) => {
        this.save.contrast = v;
        this.view.setFaceOptions(this.faceOptions());
      },
      'set-contrast',
    );
    const reset = this.button(`${ICONS.reset}<span>${t('settings.reset')}</span>`, 'btn ghost danger', () => this.confirmReset(back));
    reset.dataset.testid = 'reset';
    const done = this.button(t('btn.close'), 'btn', close);
    done.dataset.testid = 'settings-close';
    panel.append(reset, done);
  }

  /** "Reset progress?" with an explicit confirmation */
  private confirmReset(back?: () => void) {
    const panel = this.openModal('compact');
    panel.dataset.testid = 'confirm-reset';
    panel.append(el('h2', '', t('reset.title')), el('p', '', t('reset.text')));
    const yes = this.button(`${ICONS.reset}<span>${t('reset.yes')}</span>`, 'btn danger-fill', () => {
      this.play = null;
      this.save = resetProgress(this.save);
      saveNow(this.save);
      this.pendingBloom = null;
      this.showTitle();
      this.toast(t('reset.done'), 2200);
    });
    yes.dataset.testid = 'reset-yes';
    const no = this.button(t('reset.no'), 'btn', () => this.openSettings(back));
    no.dataset.testid = 'reset-no';
    panel.append(yes, no);
  }

  /** re-create the current screen in the new language */
  private relabel(back?: () => void) {
    if (this.screen === 'title') this.showTitle();
    else if (this.screen === 'garden') this.showGarden(this.gardenSeason);
    else if (this.screen === 'journey') this.showJourney();
    else if (this.play) {
      const p = this.play;
      const step = this.tut?.step ?? 0;
      this.enterBoardScreen();
      this.play = p;
      this.view.setGame(p.gameObj);
      this.resize();
      this.updateHud();
      if (step) this.startTutorial(step);
    }
    this.openSettings(this.screen === 'board' ? (back ?? undefined) : undefined);
  }

  openStats() {
    const panel = this.openModal();
    panel.dataset.testid = 'stats-panel';
    const x = this.button(ICONS.close, 'close-x', () => this.closeModal());
    x.setAttribute('aria-label', t('btn.close'));
    panel.append(x, el('h2', '', t('stats.title')));
    const s = this.save.stats;
    const rows: [StrKey, string][] = [
      ['stats.journey', `${Math.min(this.save.journey, JOURNEY_LENGTH)} / ${JOURNEY_LENGTH}`],
      ['stats.stars', `${this.save.stars.reduce((a, b) => a + (b || 0), 0)} / ${JOURNEY_LENGTH * 3}`],
      ['stats.played', String(s.played)],
      ['stats.won', String(s.won)],
      ['stats.rate', s.played ? Math.round((s.won / s.played) * 100) + '%' : '–'],
      ['stats.bestTime', s.bestTime ? fmtTime(s.bestTime) : '–'],
      ['stats.avgTime', s.won ? fmtTime(s.totalTime / s.won) : '–'],
      ['stats.bestScore', s.bestScore ? String(s.bestScore) : '–'],
      ['stats.tiles', String(s.tilesMatched)],
      ['stats.bestDaily', this.save.daily.bestTime ? fmtTime(this.save.daily.bestTime) : '–'],
      ['stats.streak', t('daily.streak', { n: this.save.daily.streak })],
      ['stats.longest', t('daily.streak', { n: Math.max(this.save.daily.longest || 0, this.save.daily.streak) })],
    ];
    for (const [k, v] of rows) {
      const r = el('div', 'kv');
      r.append(el('span', '', t(k)), el('b', '', v));
      panel.append(r);
    }
    panel.append(this.button(t('btn.close'), 'btn', () => this.closeModal()));
  }

  // ------------------------------------------------------------ win

  private onWin() {
    const p = this.play;
    if (!p || !p.gameObj.won || this.modal) return;
    this.endTutorial(true);
    audio.play('win');
    sdk.happytime();
    // Playgama: Bridge's level_completed
    if (__PLATFORM__ === 'playgama') sdk.levelEnd?.(true);
    const tiles = p.gameObj.total;
    const comboSecs = p.comboSecs ?? 0;
    const stars = starsFor(tiles, p.time, comboSecs);
    const tg = starTargets(tiles);
    const timeBonus = Math.max(0, Math.round((tg.three - Math.max(0, p.time - comboSecs)) * 2));
    p.score += timeBonus;
    const s = this.save.stats;
    s.won++;
    s.totalTime += p.time;
    s.bestTime = s.bestTime ? Math.min(s.bestTime, p.time) : p.time;
    s.bestScore = Math.max(s.bestScore, p.score);
    let restored = -1;
    let season: Season = 0;
    let newBest = false;
    let best = p.score;
    let medal: Medal | null = null;
    let dayBest = 0;
    if (p.mode === 'journey' || p.mode === 'replay') {
      const n = (p.board ?? this.save.journey + 1) - 1;
      // best stars, time and score per board: replays only improve them
      const prevTime = this.save.bestTimes[n] || 0;
      const prevScore = this.save.bestScores[n] || 0;
      newBest = prevScore > 0 && p.score > prevScore;
      this.save.stars[n] = Math.max(this.save.stars[n] || 0, stars);
      this.save.bestTimes[n] = prevTime ? Math.min(prevTime, p.time) : p.time;
      this.save.bestScores[n] = best = Math.max(prevScore, p.score);
      if (p.mode === 'journey') {
        restored = n % ELEMENTS_PER_SEASON;
        season = (Math.floor(n / ELEMENTS_PER_SEASON) % 4) as Season;
        if (n < JOURNEY_LENGTH) this.pendingBloom = { season, index: restored };
        this.save.journey = Math.max(this.save.journey, n + 1);
      }
    } else if (p.day) {
      const d = this.save.daily;
      medal = medalFor(tiles, p.time);
      const prev = d.times[p.day] || 0;
      newBest = !!prev && p.time < prev;
      d.times[p.day] = prev ? Math.min(prev, p.time) : p.time;
      dayBest = d.times[p.day];
      d.bestTime = d.bestTime ? Math.min(d.bestTime, p.time) : p.time;
      // keep the last 60 days of times
      const keys = Object.keys(d.times).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete d.times[k];
      if (!d.done.includes(p.day)) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        d.streak = d.last === todayKey(y) ? d.streak + 1 : 1;
        d.longest = Math.max(d.longest || 0, d.streak);
        d.last = p.day;
        d.done = [...d.done.slice(-60), p.day];
      }
      d.best = Math.max(d.best, p.score);
      best = d.best;
    }
    this.save.current = null;
    saveNow(this.save);

    const outer = this.openModal('win');
    outer.dataset.testid = 'win';
    outer.dataset.stars = String(stars);
    outer.append(el('h2', '', p.mode === 'daily' ? t('win.dailyDone') : t('win.title')));
    outer.append(el('div', 'sub-title', this.boardLabel(p)));
    const panel = el('div', 'win-main');
    const actions = el('div', 'win-actions');
    outer.append(panel, actions);
    // stars pop in one by one, each with its own chime
    const st = el('div', 'stars');
    for (let k = 0; k < 3; k++) {
      const sp = el('span', k < stars ? 'on' : '', ICONS.star);
      sp.style.animationDelay = `${0.3 + k * 0.28}s`;
      st.append(sp);
      if (k < stars) setTimeout(() => outer.isConnected && audio.play('star', k), 300 + k * 280);
    }
    panel.append(st);
    // the score counts up
    const scoreBox = el('div', 'big-score');
    const scoreV = el('b', '', '0');
    scoreV.dataset.testid = 'win-score';
    scoreBox.append(el('span', '', t('win.score')), scoreV);
    panel.append(scoreBox);
    const target = p.score;
    const t0 = performance.now() + 250;
    const count = (now: number) => {
      if (!scoreV.isConnected) return;
      const k = this.reducedMotion ? 1 : Math.max(0, Math.min(1, (now - t0) / 900));
      scoreV.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    if (newBest) {
      const nb = el('div', 'new-best', t('win.newBest'));
      nb.dataset.testid = 'new-best';
      panel.append(nb);
    }
    if (medal) {
      const m = el('div', `medal ${medal}`);
      m.dataset.testid = `medal-${medal}`;
      m.append(el('span', 'disc', ICONS.star), el('b', '', t(`medal.${medal}` as StrKey)));
      panel.append(m);
      panel.append(el('div', 'medal-rule', t('medal.rule', { g: fmtTime(tiles * 3), s: fmtTime(tiles * 5) })));
    }
    if (restored >= 0) {
      const c = el('canvas', 'garden-thumb');
      panel.append(c, el('div', 'restored', t('win.restored', { name: t(ELEMENTS[restored].key) })));
      requestAnimationFrame(() => this.animateThumb(c, season, restored));
      audio.play('restore');
    }
    const rowsWin: [StrKey, string][] = [
      ['win.time', fmtTime(p.time)],
      ['win.bestCombo', p.bestCombo && p.bestCombo >= 2 ? t('hud.combo', { n: Math.min(p.bestCombo, COMBO_MAX) }) : '–'],
      ['win.best', String(best)],
    ];
    if (medal) {
      rowsWin.push(['win.personalBest', fmtTime(dayBest)]);
      rowsWin.push(['stats.streak', t('daily.streak', { n: this.save.daily.streak })]);
    }
    const table = el('div', 'kv-table');
    for (const [k, v] of rowsWin) {
      const r = el('div', 'kv');
      r.append(el('span', '', t(k)), el('b', '', v));
      table.append(r);
    }
    panel.append(table);
    if (stars < 3) panel.append(el('div', 'star-hint', t('win.starHint', { time: fmtTime(tg.three) })));
    const next = this.button(`${ICONS.play}<span>${p.mode === 'daily' ? t('btn.journey') : t('btn.next')}</span>`, 'btn primary', () =>
      void this.between(() => (p.mode === 'daily' ? this.showJourney() : this.startJourney())),
    );
    next.dataset.testid = 'next';
    const row = el('div', 'row');
    const menu = this.button(`${ICONS.home}<span>${t('btn.menu')}</span>`, 'btn small', () => void this.between(() => this.showTitle()));
    menu.dataset.testid = 'win-menu';
    const journey = this.button(`${ICONS.map}<span>${t('btn.journey')}</span>`, 'btn small', () => void this.between(() => this.showJourney()));
    journey.dataset.testid = 'win-journey';
    row.append(journey, menu);
    actions.append(next, row);
    this.play = null;
  }

  /**
   * Next / Menu / Journey between boards: an interstitial (portal builds) only once the player has cleared at
   * least 3 boards, and at most one per ~2 minutes. Never during a board.
   */
  private async between(go: () => void) {
    if (sdk.adSlot('between') && this.save.stats.won >= ADS_AFTER_BOARDS && Date.now() - this.lastAdAt >= MIDGAME_GAP) {
      this.lastAdAt = Date.now();
      await sdk.interstitial('between');
    }
    go();
  }

  private animateThumb(c: HTMLCanvasElement, season: Season, index: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    const W = Math.max(10, r.width);
    const H = Math.max(10, r.height);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d')!;
    const t0 = performance.now();
    const draw = (now: number) => {
      if (!c.isConnected) return;
      const k = this.reducedMotion ? 1 : Math.min(1, (now - t0 - 400) / 1400);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGarden(ctx, 0, 0, W, H, { season, restored: index + 1, reveal: { index, t: Math.max(0, k) } });
      if (k < 1) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------ journey (map + board select)

  /**
   * The journey: per season, the garden as it is now (it blooms as boards are finished; the newest element grows in
   * when the player comes here after a win) and its 16 boards with stars and best times. Later seasons' art is only
   * drawn when it scrolls into view.
   */
  showJourney() {
    this.leaveBoard();
    this.clearLayer();
    this.screen = 'journey';
    this.view.setGame(null);
    const s = el('div', 'screen journey-screen');
    s.dataset.testid = 'journey-screen';
    const head = el('div', 'garden-head');
    const back = this.button(ICONS.back, 'icon-btn', () => this.showTitle());
    back.setAttribute('aria-label', t('btn.back'));
    back.dataset.testid = 'back';
    const done = Math.min(this.save.journey, JOURNEY_LENGTH);
    const stats = this.button(ICONS.chart, 'icon-btn', () => this.openStats());
    stats.setAttribute('aria-label', t('menu.stats'));
    stats.dataset.testid = 'stats';
    const titleBox = el('div', 'head-title');
    titleBox.append(el('h2', '', t('journey.title')), el('div', 'journey-count', t('journey.count', { n: done, total: JOURNEY_LENGTH })));
    head.append(back, titleBox, stats);
    const list = el('div', 'journey-list');
    let focus: HTMLElement | null = null;
    const bloom = this.pendingBloom;
    this.pendingBloom = null;
    const lazy: [HTMLCanvasElement, () => void][] = [];
    for (let season = 0; season < 4; season++) {
      const a = season * BOARDS_PER_SEASON;
      const restored = Math.max(0, Math.min(ELEMENTS_PER_SEASON, this.save.journey - a));
      const reached = this.save.journey >= a;
      const sec = el('section', `season${reached ? '' : ' locked'}`);
      sec.dataset.testid = `season-${season + 1}`;
      // the garden banner of the season
      const banner = el('button', 'season-banner');
      banner.type = 'button';
      banner.setAttribute('aria-label', `${t(SEASON_KEYS[season])} · ${t('garden.progress', { n: restored, total: ELEMENTS_PER_SEASON })}`);
      const c = el('canvas');
      const cap = el('div', 'banner-cap');
      cap.append(el('b', '', `${reached ? '' : ICONS.lock}${t(SEASON_KEYS[season])}`), el('span', '', t('garden.progress', { n: restored, total: ELEMENTS_PER_SEASON })));
      const bar = el('div', 'bar', `<i style="width:${(restored / ELEMENTS_PER_SEASON) * 100}%"></i>`);
      cap.append(bar);
      banner.append(c, cap);
      if (reached) banner.addEventListener('click', () => (audio.play('button'), this.showGarden(season as Season)));
      else banner.disabled = true;
      const blooming = bloom && bloom.season === season ? bloom.index : -1;
      if (blooming >= 0) {
        banner.dataset.testid = 'bloom';
        banner.classList.add('blooming');
      }
      lazy.push([c, () => this.paintBanner(c, season as Season, restored, blooming)]);
      sec.append(banner);
      const grid = el('div', 'journey-grid');
      for (let n = a; n < a + BOARDS_PER_SEASON; n++) {
        const state = n < this.save.journey ? 'done' : n === this.save.journey ? 'next' : 'locked';
        const b = el('button', `jcell ${state}`);
        b.type = 'button';
        b.dataset.testid = `board-${n + 1}`;
        const name = t(`layout.${familyAt(n)}` as StrKey);
        let html = `<span class="num">${n + 1}</span><span class="name">${name}</span>`;
        if (state === 'done') {
          const stn = this.save.stars[n] || 0;
          html += `<span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${k < stn ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>`;
          html += `<span class="best">${this.save.bestTimes[n] ? fmtTime(this.save.bestTimes[n]) : ''}</span>`;
        } else if (state === 'next') html += `<span class="tag">${ICONS.play}${t('journey.next')}</span>`;
        else html += `<span class="tag">${ICONS.lock}</span>`;
        b.innerHTML = html;
        b.setAttribute('aria-label', `${t('menu.board', { n: n + 1 })} · ${name}${state === 'locked' ? ' · ' + t('journey.locked') : ''}`);
        if (state === 'locked') b.disabled = true;
        else
          b.addEventListener('click', () => {
            audio.play('button');
            if (state === 'done') this.startReplay(n);
            else void this.onPlay();
          });
        if (state === 'next' && !bloom) focus = b;
        grid.append(b);
      }
      sec.append(grid);
      if (blooming >= 0) focus = banner;
      list.append(sec);
    }
    s.append(head, list);
    this.ui.append(s);
    this.layer = s;
    this.enter(s);
    this.resize();
    // season art is drawn when it comes into view (later seasons only if the player scrolls there)
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        lazy.find(([c]) => c === e.target)?.[1]();
      }
    }, { root: list, rootMargin: '200px' }) : null;
    for (const [c, paint] of lazy) {
      if (io) io.observe(c);
      else paint();
    }
    // bring the newest garden (or the next board) into view
    requestAnimationFrame(() => focus?.scrollIntoView({ block: 'center' }));
  }

  /** a season banner; `blooming` >= 0: that element grows in (sparkles and a chime) */
  private paintBanner(c: HTMLCanvasElement, season: Season, restored: number, blooming: number) {
    const r = c.getBoundingClientRect();
    const W = Math.max(10, r.width);
    const H = Math.max(10, r.height);
    if (blooming < 0 || this.reducedMotion) {
      this.paintGarden(c, W, H, { season, restored, next: restored < ELEMENTS_PER_SEASON && restored > 0 ? restored : -1 });
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    const ctx = c.getContext('2d')!;
    const t0 = performance.now() + 350;
    setTimeout(() => c.isConnected && audio.play('restore'), 250);
    const draw = (now: number) => {
      if (!c.isConnected) return;
      const k = Math.max(0, Math.min(1, (now - t0) / 1600));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGarden(ctx, 0, 0, W, H, { season, restored: blooming + 1, reveal: { index: blooming, t: k } });
      if (k < 1) requestAnimationFrame(draw);
      else c.parentElement?.classList.add('bloomed');
    };
    requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------ garden (full view of one season)

  private gardenSeason: Season = 0;
  private gardenCanvas: HTMLCanvasElement | null = null;

  showGarden(season?: Season) {
    this.leaveBoard();
    this.clearLayer();
    this.screen = 'garden';
    this.view.setGame(null);
    const n = this.save.journey;
    const current = Math.min(3, Math.floor(n / ELEMENTS_PER_SEASON)) as Season;
    this.gardenSeason = season ?? current;
    const s = el('div', 'screen garden-screen');
    s.dataset.testid = 'garden-screen';
    const c = el('canvas');
    this.gardenCanvas = c;
    const head = el('div', 'garden-head');
    const back = this.button(ICONS.back, 'icon-btn', () => this.showJourney());
    back.setAttribute('aria-label', t('btn.back'));
    back.dataset.testid = 'back';
    head.append(back, el('h2', '', t('garden.title')));
    const seasons = el('div', 'seasons');
    SEASON_KEYS.forEach((k, i) => {
      const unlocked = n >= i * ELEMENTS_PER_SEASON;
      const b = this.button(`${unlocked ? '' : ICONS.lock}${t(k)}`, '', () => this.showGarden(i as Season));
      b.setAttribute('aria-pressed', String(i === this.gardenSeason));
      b.disabled = !unlocked;
      seasons.append(b);
    });
    head.append(seasons);
    const foot = el('div', 'garden-foot');
    const restored = Math.max(0, Math.min(ELEMENTS_PER_SEASON, n - this.gardenSeason * ELEMENTS_PER_SEASON));
    foot.append(el('div', 'big', `${t(SEASON_KEYS[this.gardenSeason])} · ${t('garden.progress', { n: restored, total: ELEMENTS_PER_SEASON })}`));
    foot.append(el('div', 'bar', `<i style="width:${(restored / ELEMENTS_PER_SEASON) * 100}%"></i>`));
    foot.append(el('div', 'small', restored >= ELEMENTS_PER_SEASON ? t('garden.complete') : t('garden.next', { name: t(ELEMENTS[restored].key) })));
    s.append(c, head, foot);
    this.ui.append(s);
    this.layer = s;
    this.enter(s);
    this.resize();
  }

  private renderGardenCanvas() {
    const c = this.gardenCanvas;
    if (!c || !c.isConnected) return;
    const n = this.save.journey;
    const restored = Math.max(0, Math.min(ELEMENTS_PER_SEASON, n - this.gardenSeason * ELEMENTS_PER_SEASON));
    this.paintGarden(c, this.W, this.H, { season: this.gardenSeason, restored, next: restored < ELEMENTS_PER_SEASON ? restored : -1 });
  }

  // ------------------------------------------------------------ tutorial (inside board 1)

  /**
   * Board 1 teaches by doing, one short line per step:
   * 1. a hand shows two identical free tiles; the player matches them
   * 2. one blocked tile is marked once, with the reason it cannot be taken
   * 3. the helpers (Hint, Undo, Shuffle) are pointed out, then it goes away by itself
   * "Skip" ends it at any time; once finished or skipped it never comes back.
   */
  private startTutorial(step = 1) {
    this.endTutorial(false);
    const wrap = el('div', 'tut-wrap');
    const line = el('div', 'tut');
    line.dataset.testid = 'tutorial';
    const hand = el('div', 'hand', HAND_SVG);
    hand.dataset.testid = 'hand';
    const skip = this.button(t('tut.skip'), 'tut-skip', () => this.endTutorial(true));
    skip.dataset.testid = 'tut-skip';
    wrap.append(line, hand);
    this.ui.append(wrap);
    this.tut = { step: 0, line, hand, skip, timers: [], blocked: -1 };
    this.tutorialStep(step);
  }

  private tutorialStep(n: number): void {
    const tu = this.tut;
    const p = this.play;
    if (!tu || !p) return;
    tu.timers.forEach(clearTimeout);
    tu.timers = [];
    tu.step = n;
    this.view.spotlight = [];
    this.view.blockedMark = -1;
    tu.line.innerHTML = '';
    tu.line.dataset.step = String(n);
    const text = (key: StrKey) => tu.line.append(el('span', 'tl', t(key)));
    const withSkip = () => tu.line.append(tu.skip);
    if (n === 1) {
      const m = p.gameObj.hint();
      if (!m) return this.endTutorial(true);
      this.view.spotlight = [...m];
      text('tut.pick');
      withSkip();
    } else if (n === 2) {
      tu.blocked = this.pickBlocked();
      if (tu.blocked < 0) return this.tutorialStep(3);
      this.view.blockedMark = tu.blocked;
      text('tut.blocked');
      const ok = this.button(t('btn.ok'), 'tut-ok', () => this.tutorialStep(3));
      ok.dataset.testid = 'tut-next';
      tu.line.append(ok);
      withSkip();
    } else if (n === 3) {
      text('tut.helpers');
      withSkip();
      if (this.hud && !this.reducedMotion) this.hud.tools.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 900, iterations: 2 });
      tu.timers.push(setTimeout(() => this.endTutorial(true), 4500));
    } else return this.endTutorial(true);
    this.view.invalidate();
    this.placeTutorial();
    this.tutorialHand();
  }

  /** a blocked tile to show: fully visible (nothing on top, only its sides closed), near the middle of the board */
  private pickBlocked(): number {
    const g = this.play!.gameObj;
    const b = g.g.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    let best = -1;
    let bd = Infinity;
    let fallback = -1;
    g.present.forEach((on, i) => {
      if (!on || g.isFree(i)) return;
      if (fallback < 0) fallback = i;
      if (g.g.above[i].some((j) => g.present[j])) return;
      const [x, y] = g.g.slots[i];
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best >= 0 ? best : fallback;
  }

  /** move the hand: over the two tiles of the pair (step 1), on the blocked tile (2), on the helpers (3) */
  private tutorialHand() {
    const tu = this.tut;
    if (!tu) return;
    tu.timers.forEach(clearTimeout);
    tu.timers = [];
    const hand = tu.hand;
    const at = (x: number, y: number) => {
      hand.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    const tap = (delay: number) => tu.timers.push(setTimeout(() => (hand.classList.remove('tap'), void hand.offsetWidth, hand.classList.add('tap')), delay));
    if (tu.step === 1) {
      const spots = this.view.spotlight.filter((i) => i !== this.view.selected && this.play?.gameObj.present[i]);
      if (!spots.length) return;
      const loop = () => {
        let d = 0;
        for (const i of spots) {
          tu.timers.push(setTimeout(() => at(...this.view.tileCenter(i)), d));
          tap(d + 650);
          d += 1300;
        }
        tu.timers.push(setTimeout(loop, d + 300));
      };
      loop();
    } else if (tu.step === 2 && tu.blocked >= 0) {
      at(...this.view.tileCenter(tu.blocked));
      const loop = () => {
        tap(500);
        tu.timers.push(setTimeout(loop, 1600));
      };
      loop();
      // the OK button would otherwise wait forever: move on after a while
      tu.timers.push(setTimeout(() => this.tut?.step === 2 && this.tutorialStep(3), 9000));
    } else if (tu.step === 3 && this.hud) {
      const r = this.hud.hint.getBoundingClientRect();
      at(r.x + r.width / 2, r.y + r.height / 2);
      tap(500);
      tu.timers.push(setTimeout(() => this.endTutorial(true), 4500));
    }
  }

  /** end the tutorial; `done`: finished or skipped (never shown again) */
  private endTutorial(done: boolean) {
    const tu = this.tut;
    if (!tu) return;
    tu.timers.forEach(clearTimeout);
    tu.line.parentElement?.remove();
    this.tut = null;
    this.view.spotlight = [];
    this.view.blockedMark = -1;
    this.view.invalidate();
    if (done) {
      this.save.tutorialDone = true;
      saveNow(this.save);
    }
  }

  private placeTutorial() {
    const tu = this.tut;
    if (!tu || !this.hud) return;
    const card = tu.line;
    const area = this.boardArea();
    const spots = [...this.view.spotlight, ...(this.view.blockedMark >= 0 ? [this.view.blockedMark] : [])].map((i) => this.view.tileRect(i));
    const top = this.hud.root.getBoundingClientRect().bottom + 10;
    // room for the card's rise-in animation (18 px) at the bottom
    const bottomLimit = document.body.classList.contains('portrait') ? this.hud.tools.getBoundingClientRect().top - 24 : this.H - 24;
    const h = card.getBoundingClientRect().height;
    const atBottom = bottomLimit - h;
    const overlaps = (y: number) => spots.some((r) => r.y < y + h && r.y + r.h > y);
    const y = !overlaps(atBottom) ? atBottom : !overlaps(top) ? top : atBottom;
    card.style.top = Math.max(top, y) + 'px';
    const cx = document.body.classList.contains('landscape') ? area.x + area.w / 2 : this.W / 2;
    card.style.left = cx + 'px';
  }

  // ------------------------------------------------------------ test hooks

  debug() {
    return {
      state: () => ({
        screen: this.screen,
        modal: this.modal?.querySelector('[data-testid]')?.getAttribute('data-testid') ?? (this.modal ? 'modal' : null),
        remaining: this.play?.gameObj.remaining ?? null,
        matches: this.play?.gameObj.openMatches().length ?? null,
        time: this.play?.time ?? null,
        score: this.play?.score ?? null,
        journey: this.save.journey,
        tutorial: this.tut?.step ?? 0,
        tutorialDone: this.save.tutorialDone,
        variant: this.play?.variant ?? null,
        hintsLeft: this.play?.hintsLeft ?? null,
        shufflesLeft: this.play?.shufflesLeft ?? null,
        undosLeft: this.play?.undosLeft ?? null,
        combo: this.play?.combo ?? 0,
        comboSecs: this.play?.comboSecs ?? 0,
        adPaused: this.adPaused,
        tileWidth: this.play ? this.view.m.w : null,
        zoom: this.view.zoom,
        lang: getLang(),
        audio: audio.gate(),
      }),
      /** a good open pair (no hint consumed) and the screen centers of its tiles */
      pair: () => {
        const g = this.play?.gameObj;
        const m = g?.hint(3000);
        return m ? m.map((i) => this.view.tileCenter(i)) : null;
      },
      /** the blocked tile the tutorial marks (screen center), or null */
      blocked: () => (this.tut && this.tut.blocked >= 0 ? this.view.tileCenter(this.tut.blocked) : null),
      center: (i: number) => this.view.tileCenter(i),
      /** the board area and the box the tiles cover (screen px) */
      fill: () => {
        const g = this.play?.gameObj;
        if (!g) return null;
        let x0 = Infinity,
          y0 = Infinity,
          x1 = -Infinity,
          y1 = -Infinity;
        g.present.forEach((p, i) => {
          if (!p) return;
          const r = this.view.tileRect(i);
          x0 = Math.min(x0, r.x);
          y0 = Math.min(y0, r.y);
          x1 = Math.max(x1, r.x + r.w);
          y1 = Math.max(y1, r.y + r.h);
        });
        return { area: this.boardArea(), box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, tileWidth: this.view.m.w };
      },
      /** open the "no more pairs" dialog (tests) */
      stuck: () => this.openStuck(),
      /** skip the tutorial (tests) */
      skipTutorial: () => {
        this.save.tutorialDone = true;
        this.endTutorial(true);
      },
      /** finish the board instantly (used by e2e tests and the art scripts) */
      solve: (leave = 0) => {
        const p = this.play;
        if (!p) return false;
        p.clockOn = true;
        while (p.gameObj.remaining > leave) {
          const m = p.gameObj.hint(20000);
          if (!m) return false;
          this.doMatch(m[0], m[1]);
        }
        return true;
      },
      setJourney: (n: number) => {
        this.save.journey = n;
      },
      /** demo progress for screenshots: n boards finished with varied stars and times */
      demoProgress: (n: number) => {
        this.save.journey = n;
        this.save.tutorialDone = true;
        for (let k = 0; k < n; k++) {
          this.save.stars[k] = 1 + ((k * 7 + 3) % 3 === 0 ? 0 : (k * 5) % 3 === 0 ? 1 : 2);
          this.save.bestTimes[k] = 40 + ((k * 37) % 9) * 14 + k * 6;
          this.save.bestScores[k] = 200 + k * 40;
        }
        this.save.daily = { ...this.save.daily, streak: 4, longest: 6, last: todayKey(new Date(Date.now() - 86400000)) };
        this.save.stats.won = n;
        this.save.stats.played = n + 3;
      },
      showJourney: () => this.showJourney(),
      showTitle: () => this.showTitle(),
      /** set the board clock (screenshots of a realistic result) */
      setTime: (secs: number) => {
        if (this.play) this.play.time = secs;
      },
    };
  }

  async start() {
    this.resize();
    const q = new URLSearchParams(location.search);
    // a brand-new player goes straight into board 1 (the tutorial is inside it); everyone else sees the main menu
    const fresh = !this.save.tutorialDone && this.save.journey === 0 && !this.save.current && !q.has('menu');
    // loading is over before any gameplay starts
    sdk.loadingStop();
    if (fresh) this.startJourney();
    else this.showTitle();
    document.body.dataset.ready = '1';
  }
}

let app: App | null = null;
export async function startApp() {
  // the portal SDK loads in the background; the game never waits for it
  // portals that keep the save (CrazyGames Data Module) are initialised first (never longer than ~3 s)
  if (sdk.initBeforeStart) await sdk.init();
  else void sdk.init();
  sdk.loadingStart();
  app = new App();
  (window as unknown as { __mjg: unknown }).__mjg = app.debug();
  await app.start();
  return app;
}
