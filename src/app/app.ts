/**
 * The game controller: screens (title, board, garden, dialogs), the rules of a session (timer, score, hints,
 * shuffles, stars), saving, audio and the portal hooks (ads only on user input outside play).
 */
import { Petals, drawBackground } from '../art/background';
import { ELEMENTS, ELEMENTS_PER_SEASON, SEASON_KEYS, drawGarden, type Season } from '../art/garden';
import { TileSprites, tileMetrics } from '../art/sprites';
import { CLASSIC, CONTRAST, type FaceOptions } from '../art/tileArt';
import { Game } from '../game/game';
import { mulberry32 } from '../game/rng';
import { FLOWERS } from '../game/tiles';
import { boardTiles, tileWidthIn } from '../layouts/build';
import { BOARDS_PER_SEASON, JOURNEY_LENGTH, dailyFor, dealLayout, journeySeed, layoutAt, layoutById, type BoardLayout, type Variant } from '../layouts/catalog';
import { BoardView, type Rect } from '../ui/boardView';
import { ICONS } from '../ui/icons';
import { audio } from './audio';
import { detectLang, getLang, setLang, t, windLetters, type StrKey } from './i18n';
import { loadSave, saveNow, saveSoon, type BoardInProgress, type SaveData } from './save';
import { sdk } from './sdk';

export const HINTS_PER_BOARD = 3;
export const SHUFFLES_PER_BOARD = 2;
export const UNDOS_PER_BOARD = 5;
/** at most one interstitial per this many ms (pre-roll included) */
export const MIDGAME_GAP = 120_000;
/** between-board interstitials only once this many boards have been cleared */
export const ADS_AFTER_BOARDS = 3;
const NO_AD_MS = 2500;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const fmtTime = (s: number) => {
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

/** stars for a cleared board: by hints used and time (relative to the number of tiles) */
export function starsFor(tiles: number, seconds: number, hints: number): number {
  let s = 1;
  if (hints <= 2 && seconds <= tiles * 7) s++;
  if (hints === 0 && seconds <= tiles * 4.5) s++;
  return s;
}

interface Play extends BoardInProgress {
  gameObj: Game;
  combo: number;
  lastMatchAt: number;
}

class App {
  save: SaveData;
  private bg = document.getElementById('bg') as HTMLCanvasElement;
  private fx: HTMLCanvasElement;
  private boardCanvas = document.getElementById('board') as HTMLCanvasElement;
  private ui = document.getElementById('ui') as HTMLDivElement;
  private view: BoardView;
  private petals: Petals;
  private play: Play | null = null;
  private screen: 'title' | 'board' | 'garden' | 'journey' = 'title';
  private layer: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private hud: { root: HTMLElement; stats: Record<string, HTMLElement>; tools: HTMLElement; hint: HTMLButtonElement; undo: HTMLButtonElement; shuffle: HTMLButtonElement; fit: HTMLButtonElement } | null = null;
  private tutStep = 0;
  private tutEl: HTMLElement | null = null;
  private adPaused = false;
  private prerollDone = false;
  /** time of the last interstitial (pre-roll or between boards), for the ~2 minute gap */
  private lastAdAt = -Infinity;
  private W = 0;
  private H = 0;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private fresh: boolean;

  constructor() {
    const q = new URLSearchParams(location.search);
    this.fresh = q.has('fresh');
    this.save = this.fresh ? loadSave({ getItem: () => null, setItem: () => {} }) : loadSave();
    const ql = q.get('lang');
    setLang(ql === 'fr' || ql === 'en' ? ql : (this.save.lang ?? detectLang()));
    this.fx = document.createElement('canvas');
    this.fx.id = 'fx';
    this.bg.after(this.fx);
    this.petals = new Petals(this.fx);
    this.view = new BoardView(this.boardCanvas, this.faceOptions());
    this.view.highlightFree = this.save.highlightFree;
    this.view.reducedMotion = this.reducedMotion;
    this.view.onTap = (i) => this.onTileTap(i);
    this.view.onZoomChange = (z) => this.hud?.fit.classList.toggle('show', z);
    audio.setMusic(this.save.music);
    audio.setSound(this.save.sound);
    sdk.onAdPause = (p) => {
      this.adPaused = p;
      audio.setAdMuted(p);
    };
    const unlock = () => audio.unlock();
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persist(true);
    });
    addEventListener('pagehide', () => this.persist(true));
    setInterval(() => this.tick(), 1000);
  }

  faceOptions(): FaceOptions {
    return { set: this.save.tileSet, palette: this.save.contrast ? CONTRAST : CLASSIC, indices: this.save.contrast, windLetters: windLetters() };
  }

  persist(now = false) {
    if (this.fresh) return;
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
      };
    }
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
    if (this.tutEl) this.placeTutorial();
    if (this.screen === 'garden') this.renderGardenCanvas();
  }

  private boardArea(): Rect {
    const W = this.W;
    const H = this.H;
    if (!this.hud) return { x: 0, y: 0, w: W, h: H };
    const top = this.hud.root.getBoundingClientRect().bottom;
    const portrait = document.body.classList.contains('portrait');
    const tools = this.hud.tools.getBoundingClientRect();
    // small margins: the board uses almost the whole screen (8 px at the sides, 6 px under / above the bars)
    const mx = 8;
    const my = 6;
    if (portrait) return { x: mx, y: top + my, w: W - mx * 2, h: tools.top - top - my * 2 };
    return { x: mx, y: top + my, w: tools.left - mx * 2, h: H - top - my * 2 };
  }

  // ------------------------------------------------------------ screens

  private clearLayer() {
    this.closeModal();
    this.closeTutorial();
    this.layer?.remove();
    this.layer = null;
    this.hud = null;
  }

  showTitle() {
    this.leaveBoard();
    this.clearLayer();
    this.screen = 'title';
    this.view.setGame(null);
    const s = el('div', 'screen');
    const wrap = el('div', 'title-wrap');
    const logo = el('div', 'logo');
    const tiles = el('canvas', 'tiles');
    logo.append(tiles);
    logo.append(el('div', 'mj', t('title.mahjong')), el('div', 'jg', t('title.jadeGarden')));
    const rule = el('div', 'rule', '<i></i>' + ICONS.leaf.replace('width="24" height="24"', 'width="18" height="18"') + '<i></i>');
    logo.append(rule, el('div', 'tag', t('title.tagline')));
    wrap.append(logo);
    const menu = el('div', 'menu');
    const cur = this.save.current;
    const boardN = this.save.journey + 1;
    const play = this.button(
      `${ICONS.play}<span>${cur && cur.mode === 'journey' ? t('menu.continue') : t('menu.play')}<br><span class="sub">${t('menu.board', { n: boardN })} · ${t(`layout.${layoutAt(this.save.journey).family}` as StrKey)}</span></span>`,
      'btn primary',
      () => void this.onPlay(),
    );
    play.dataset.testid = 'play';
    const daily = this.button(`${ICONS.calendar}<span>${t('menu.daily')}<br><span class="sub" data-testid="daily-note">${this.dailyNote()}</span></span>`, 'btn', () => this.startDaily());
    daily.dataset.testid = 'daily';
    const journeyBtn = this.button(`${ICONS.star}<span>${t('menu.journey')}</span>`, 'btn small', () => this.showJourney());
    journeyBtn.dataset.testid = 'journey';
    const garden = this.button(`${ICONS.leaf}<span>${t('menu.garden')}</span>`, 'btn small', () => this.showGarden());
    garden.dataset.testid = 'garden';
    const row1 = el('div', 'row');
    row1.append(journeyBtn, garden);
    const row = el('div', 'row');
    const stats = this.button(`${ICONS.chart}<span>${t('menu.stats')}</span>`, 'btn small', () => this.openStats());
    const settings = this.button(`${ICONS.gear}<span>${t('menu.settings')}</span>`, 'btn small', () => this.openSettings());
    stats.dataset.testid = 'stats';
    settings.dataset.testid = 'settings';
    row.append(stats, settings);
    menu.append(play, daily, row1, row);
    wrap.append(menu);
    s.append(wrap);
    this.ui.append(s);
    this.layer = s;
    this.drawTitleTiles(tiles);
    this.resize();
  }

  private drawTitleTiles(c: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const tw = Math.round(Math.min(64, Math.max(44, innerWidth * 0.06)));
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
    // pre-roll interstitial: only from this click, once per session
    if (!this.prerollDone) {
      this.prerollDone = true;
      this.lastAdAt = Date.now();
      await sdk.interstitial('preroll');
    }
    const cur = this.save.current;
    if (cur && cur.mode === 'journey') this.resumeBoard(cur);
    else this.startJourney();
  }

  /** the layout variant (wide or tall) that gives the biggest tiles in the current board area */
  private chooseVariant(l: BoardLayout): Variant {
    const area = this.boardArea();
    const wl = tileWidthIn(boardTiles(l.landscape), area.w, area.h);
    const wp = tileWidthIn(boardTiles(l.portrait), area.w, area.h);
    return wp > wl ? 'portrait' : 'landscape';
  }

  startJourney() {
    const n = this.save.journey;
    // the journey board in progress is kept; a replay in progress is dropped
    if (this.save.current?.mode === 'replay') this.save.current = null;
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

  /** replay a finished journey board (the same deal); best stars / time update only if better */
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
      combo: 0,
      lastMatchAt: 0,
    };
    this.save.stats.played++;
    this.attachBoard();
  }

  private resumeBoard(cur: BoardInProgress) {
    this.enterBoardScreen();
    let game: Game;
    try {
      game = Game.restore(cur.game);
    } catch {
      this.save.current = null;
      return this.startJourney();
    }
    this.play = { ...cur, gameObj: game, combo: 0, lastMatchAt: 0 };
    this.attachBoard();
  }

  private attachBoard() {
    const p = this.play!;
    this.view.setGame(p.gameObj);
    this.resize();
    this.view.setGame(p.gameObj);
    this.updateHud();
    this.persist();
    sdk.gameplayStart();
    if (!this.save.tutorialDone && p.mode === 'journey') this.startTutorial();
    else if (p.gameObj.stuck) this.openStuck();
  }

  private enterBoardScreen() {
    this.clearLayer();
    this.screen = 'board';
    const root = el('div');
    const hud = el('div', 'hud');
    const menuBtn = this.button(ICONS.menu, 'icon-btn', () => this.openPause());
    menuBtn.setAttribute('aria-label', t('btn.menu'));
    menuBtn.dataset.testid = 'menu';
    const statsEl = el('div', 'stats');
    const stats: Record<string, HTMLElement> = {};
    for (const [k, key] of [
      ['matches', 'hud.matches'],
      ['time', 'hud.time'],
      ['score', 'hud.score'],
      ['tiles', 'hud.tiles'],
    ] as [string, StrKey][]) {
      const s = el('div', 'stat');
      s.dataset.stat = k;
      s.append(el('div', 'k', t(key)));
      const v = el('div', 'v', '0');
      s.append(v);
      stats[k] = v;
      statsEl.append(s);
    }
    const gear = this.button(ICONS.gear, 'icon-btn', () => this.openSettings());
    gear.setAttribute('aria-label', t('btn.settings'));
    gear.dataset.testid = 'hud-settings';
    hud.append(menuBtn, statsEl, gear);
    const tools = el('div', 'tools');
    const tool = (icon: string, label: StrKey, fn: () => void, id: string) => {
      const b = this.button(`${icon}<span>${t(label)}</span><span class="badge"></span>`, 'tool', fn);
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
    this.hud = { root: hud, stats, tools, hint, undo, shuffle, fit };
    // the fit button sits just under the HUD on the left
    requestAnimationFrame(() => {
      const r = hud.getBoundingClientRect();
      fit.style.left = '10px';
      fit.style.top = r.bottom + 8 + 'px';
    });
  }

  private leaveBoard() {
    if (this.play) {
      this.persist(true);
      sdk.gameplayStop();
    }
    this.play = null;
  }

  private updateHud() {
    const p = this.play;
    const h = this.hud;
    if (!p || !h) return;
    const g = p.gameObj;
    h.stats.matches.textContent = String(g.openMatches().length);
    h.stats.time.textContent = fmtTime(p.time);
    h.stats.score.textContent = String(p.score);
    h.stats.tiles.textContent = String(g.remaining);
    h.stats.time.parentElement!.classList.toggle('hidden', !this.save.showTimer);
    // a count while some are left; "+1" (rewarded ad) once they run out
    const badge = (b: HTMLButtonElement, left: number) => {
      const el2 = b.querySelector('.badge') as HTMLElement;
      el2.textContent = left > 0 ? String(left) : '+1';
      el2.classList.toggle('plus', left <= 0);
      b.dataset.out = String(left <= 0);
    };
    badge(h.hint, p.hintsLeft);
    badge(h.shuffle, p.shufflesLeft);
    badge(h.undo, p.undosLeft ?? UNDOS_PER_BOARD);
    h.undo.disabled = g.history.length === 0;
  }

  private tick() {
    const p = this.play;
    if (!p || this.screen !== 'board' || this.modal || this.adPaused || document.hidden || p.gameObj.won) return;
    if (this.tutEl) return;
    p.time++;
    if (this.hud) this.hud.stats.time.textContent = fmtTime(p.time);
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
    if (!g.isFree(i)) {
      audio.play('mismatch');
      this.view.shakeTile(i);
      return;
    }
    const sel = this.view.selected;
    if (sel < 0 || sel === i) {
      this.view.selected = sel === i ? -1 : i;
      audio.play('select');
      this.view.invalidate();
      return;
    }
    if (g.canMatch(sel, i)) {
      this.doMatch(sel, i);
    } else {
      // a different tile: select it instead (gentle, no penalty)
      this.view.selected = i;
      audio.play('select');
      this.view.invalidate();
    }
  }

  private doMatch(a: number, b: number) {
    const p = this.play!;
    const g = p.gameObj;
    const bonus = g.faces[a] >= FLOWERS;
    g.match(a, b);
    this.view.selected = -1;
    this.view.removeAnim(a, b);
    const now = performance.now();
    p.combo = now - p.lastMatchAt < 5000 ? Math.min(5, p.combo + 1) : 0;
    audio.play('match', p.combo);
    p.lastMatchAt = now;
    p.score += 10 + p.combo * 2 + (bonus ? 10 : 0);
    this.save.stats.tilesMatched += 2;
    if (this.tutStep === 1 && this.view.spotlight.includes(a)) this.tutorialNext();
    this.updateHud();
    this.persist();
    if (g.won) setTimeout(() => this.onWin(), 550);
    else if (g.stuck) setTimeout(() => this.play?.gameObj.stuck && !this.modal && this.openStuck(), 600);
  }

  private onHint() {
    const p = this.play;
    if (!p) return;
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
    if (!p || !p.gameObj.history.length) return;
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
    if (!p) return;
    if (p.shufflesLeft <= 0) return this.offerExtra('shuffle');
    this.doShuffle();
  }

  private doShuffle() {
    const p = this.play!;
    if (!p.gameObj.shuffle(mulberry32((Date.now() ^ p.seed) >>> 0))) {
      this.toast(t('stuck.cannot'));
      return;
    }
    p.shufflesLeft = Math.max(0, p.shufflesLeft - 1);
    audio.play('shuffle');
    this.view.selected = -1;
    this.view.hint = null;
    this.view.invalidate();
    this.updateHud();
    this.persist();
  }

  private toast(text: string, ms = 3200) {
    const tt = el('div', 'toast', text);
    this.ui.append(tt);
    setTimeout(() => tt.remove(), ms);
  }

  // ------------------------------------------------------------ ads

  /**
   * A button that asks for a rewarded ad. Settles once; when there is no reward it shows "No ad available right
   * now, try later" for 2.5 s and re-enables.
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

  /** label of a rewarded button: "Watch an ad: +1 Hint" (portal builds) or "+1 Hint" (web build: free) */
  private rewardLabel(icon: string, what: string) {
    return sdk.name === 'web' ? `${icon}<span>${t('ad.plus', { what })}</span>` : `${ICONS.play}<span>${t('ad.watchPlus', { what })}</span>`;
  }

  private offerExtra(kind: 'hint' | 'shuffle' | 'undo') {
    const panel = this.openModal();
    panel.dataset.testid = `offer-${kind}`;
    const title: Record<typeof kind, StrKey> = { hint: 'ad.extraHint', shuffle: 'ad.extraShuffle', undo: 'ad.extraUndo' };
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
        this.doShuffle();
      } else {
        p.undosLeft = (p.undosLeft ?? 0) + 1;
        this.onUndo();
      }
    };
    const icon = { hint: ICONS.hint, shuffle: ICONS.shuffle, undo: ICONS.undo }[kind];
    const what = t(kind === 'hint' ? 'btn.hint' : kind === 'shuffle' ? 'btn.shuffle' : 'btn.undo');
    panel.append(this.adButton(this.rewardLabel(icon, what), grant));
    panel.append(this.button(t('btn.close'), 'btn ghost', () => this.closeModal()));
  }

  // ------------------------------------------------------------ dialogs

  private openModal(): HTMLElement {
    this.closeModal();
    const back = el('div', 'backdrop');
    const panel = el('div', 'panel');
    panel.setAttribute('role', 'dialog');
    back.append(panel);
    this.ui.append(back);
    this.modal = back;
    if (this.tutEl) this.tutEl.style.visibility = 'hidden';
    return panel;
  }

  private closeModal() {
    this.modal?.remove();
    this.modal = null;
    if (this.tutEl) this.tutEl.style.visibility = '';
  }

  private openPause() {
    const panel = this.openModal();
    panel.append(el('h2', '', t('pause.title')));
    if (this.play) panel.append(el('p', '', this.boardLabel(this.play)));
    const resume = this.button(`${ICONS.play}<span>${t('btn.resume')}</span>`, 'btn primary', () => this.closeModal());
    resume.dataset.testid = 'resume';
    panel.append(resume);
    panel.append(
      this.button(t('btn.restart'), 'btn', () => {
        const p = this.play;
        if (!p) return;
        // same deal from the start
        while (p.gameObj.history.length) p.gameObj.undo();
        p.time = 0;
        p.score = 0;
        p.hints = 0;
        p.hintsLeft = HINTS_PER_BOARD;
        p.shufflesLeft = SHUFFLES_PER_BOARD;
        p.undosLeft = UNDOS_PER_BOARD;
        this.closeModal();
        this.view.setGame(p.gameObj);
        this.updateHud();
        this.persist();
      }),
    );
    panel.append(this.button(t('menu.settings'), 'btn', () => this.openSettings()));
    const menu = this.button(t('btn.menu'), 'btn', () => this.showTitle());
    menu.dataset.testid = 'to-menu';
    panel.append(menu);
  }

  /** "Board 5 · Plum Blossom" or "Daily Challenge · Plum Blossom" */
  private boardLabel(p: BoardInProgress) {
    const l = layoutById(p.layoutId);
    const name = l ? t(`layout.${l.family}` as StrKey) : '';
    if (p.mode === 'daily') return `${t('daily.title')} · ${name}`;
    return `${t('menu.board', { n: p.board ?? (l ? l.index + 1 : 1) })} · ${name}`;
  }

  private openStuck() {
    const p = this.play;
    if (!p) return;
    const panel = this.openModal();
    panel.dataset.testid = 'stuck';
    panel.append(el('h2', '', t('stuck.title')), el('p', '', t('stuck.text')));
    if (!this.save.tips.includes('stuck')) {
      // the first dead end: a gentle tip, once
      const tip = el('div', 'tip');
      tip.dataset.testid = 'stuck-tip';
      tip.append(el('b', '', t('stuck.tipTitle')), el('span', '', t('stuck.tip')));
      panel.append(tip);
      this.save.tips = [...this.save.tips, 'stuck'];
      saveSoon(this.save);
    }
    if (p.shufflesLeft > 0)
      panel.append(
        this.button(`${ICONS.shuffle}<span>${t('btn.shuffle')} (${p.shufflesLeft})</span>`, 'btn primary', () => {
          this.closeModal();
          this.doShuffle();
        }),
      );
    else {
      panel.append(el('p', '', t('stuck.noShuffle')));
      // rewarded "Continue": the remaining tiles are shuffled into a solvable position (no shuffle used)
      const label = sdk.name === 'web' ? `${ICONS.shuffle}<span>${t('btn.continueFree')}</span>` : `${ICONS.play}<span>${t('ad.continue')}</span>`;
      const b = this.adButton(label, () => {
        this.closeModal();
        p.shufflesLeft++;
        this.doShuffle();
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
    panel.append(this.button(t('btn.menu'), 'btn ghost', () => this.showTitle()));
  }

  openSettings() {
    const panel = this.openModal();
    panel.dataset.testid = 'settings-panel';
    const x = this.button(ICONS.close, 'close-x', () => this.closeModal());
    x.setAttribute('aria-label', t('btn.close'));
    panel.append(x, el('h2', '', t('settings.title')));
    const toggle = (key: StrKey, get: () => boolean, set: (v: boolean) => void, id: string) => {
      const row = el('div', 'setting');
      row.append(el('span', '', t(key)));
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
      row.append(b);
      panel.append(row);
    };
    // tile set: illustrated Garden (default) or Classic Mahjong faces
    const setRow = el('div', 'setting');
    setRow.append(el('span', '', t('settings.tiles')));
    const setSeg = el('div', 'seg');
    for (const [k, key] of [
      ['garden', 'settings.tilesGarden'],
      ['classic', 'settings.tilesClassic'],
    ] as const) {
      const b = el('button', '', t(key));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(this.save.tileSet === k));
      b.dataset.testid = `tiles-${k}`;
      b.addEventListener('click', () => {
        if (this.save.tileSet === k) return;
        this.save.tileSet = k;
        saveNow(this.save);
        audio.play('button');
        this.view.setFaceOptions(this.faceOptions());
        for (const o of setSeg.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
        if (this.screen === 'title') {
          const c = document.querySelector('.logo canvas') as HTMLCanvasElement | null;
          if (c) this.drawTitleTiles(c);
        }
      });
      setSeg.append(b);
    }
    setRow.append(setSeg);
    panel.append(setRow);
    toggle('settings.music', () => this.save.music, (v) => audio.setMusic((this.save.music = v)), 'set-music');
    toggle('settings.sound', () => this.save.sound, (v) => audio.setSound((this.save.sound = v)), 'set-sound');
    toggle(
      'settings.highlight',
      () => this.save.highlightFree,
      (v) => {
        this.save.highlightFree = this.view.highlightFree = v;
        this.view.invalidate();
      },
      'set-highlight',
    );
    toggle(
      'settings.contrast',
      () => this.save.contrast,
      (v) => {
        this.save.contrast = v;
        this.view.setFaceOptions(this.faceOptions());
      },
      'set-contrast',
    );
    toggle(
      'settings.timer',
      () => this.save.showTimer,
      (v) => {
        this.save.showTimer = v;
        this.updateHud();
      },
      'set-timer',
    );
    const lang = el('div', 'setting');
    lang.append(el('span', '', t('settings.language')));
    const seg = el('div', 'seg');
    for (const [l, name] of [
      ['en', 'English'],
      ['fr', 'Français'],
    ] as const) {
      const b = el('button', '', name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(getLang() === l));
      b.dataset.testid = `lang-${l}`;
      b.addEventListener('click', () => {
        if (getLang() === l) return;
        setLang(l);
        this.save.lang = l;
        saveNow(this.save);
        this.view.setFaceOptions(this.faceOptions());
        this.relabel();
      });
      seg.append(b);
    }
    lang.append(seg);
    panel.append(lang);
    panel.append(
      this.button(t('settings.tutorial'), 'btn small', () => {
        this.save.tutorialDone = false;
        saveNow(this.save);
        this.closeModal();
        if (this.screen === 'board' && this.play) this.startTutorial();
      }),
    );
    panel.append(this.button(t('btn.close'), 'btn', () => this.closeModal()));
  }

  /** re-create the current screen in the new language */
  private relabel() {
    if (this.screen === 'title') {
      this.showTitle();
      this.openSettings();
    } else if (this.screen === 'garden') {
      this.showGarden(this.gardenSeason);
      this.openSettings();
    } else if (this.screen === 'journey') {
      this.showJourney();
      this.openSettings();
    } else if (this.play) {
      const p = this.play;
      const tut = this.tutStep;
      this.enterBoardScreen();
      this.play = p;
      this.view.setGame(p.gameObj);
      this.resize();
      this.updateHud();
      if (tut) this.startTutorial(tut);
      this.openSettings();
    }
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
      ['stats.played', String(s.played)],
      ['stats.won', String(s.won)],
      ['stats.rate', s.played ? Math.round((s.won / s.played) * 100) + '%' : '–'],
      ['stats.bestTime', s.bestTime ? fmtTime(s.bestTime) : '–'],
      ['stats.avgTime', s.won ? fmtTime(s.totalTime / s.won) : '–'],
      ['stats.bestScore', s.bestScore ? String(s.bestScore) : '–'],
      ['stats.tiles', String(s.tilesMatched)],
      ['stats.stars', `${this.save.stars.reduce((a, b) => a + (b || 0), 0)} / ${JOURNEY_LENGTH * 3}`],
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
    audio.play('win');
    sdk.gameplayStop();
    const tiles = p.gameObj.total;
    const stars = starsFor(tiles, p.time, p.hints);
    const timeBonus = Math.max(0, Math.round(tiles * 4 - p.time));
    p.score += timeBonus;
    const s = this.save.stats;
    s.won++;
    s.totalTime += p.time;
    s.bestTime = s.bestTime ? Math.min(s.bestTime, p.time) : p.time;
    s.bestScore = Math.max(s.bestScore, p.score);
    let restored = -1;
    let season: Season = 0;
    let newBest = false;
    let medal: Medal | null = null;
    let dayBest = 0;
    if (p.mode === 'journey' || p.mode === 'replay') {
      const n = (p.board ?? this.save.journey + 1) - 1;
      // best stars and time per board: replays only improve them
      const prevTime = this.save.bestTimes[n] || 0;
      newBest = p.mode === 'replay' && (stars > (this.save.stars[n] || 0) || !prevTime || p.time < prevTime);
      this.save.stars[n] = Math.max(this.save.stars[n] || 0, stars);
      this.save.bestTimes[n] = prevTime ? Math.min(prevTime, p.time) : p.time;
      if (p.mode === 'journey') {
        restored = n % ELEMENTS_PER_SEASON;
        season = (Math.floor(n / ELEMENTS_PER_SEASON) % 4) as Season;
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
        d.best = Math.max(d.best, p.score);
      }
    }
    this.save.current = null;
    saveNow(this.save);

    const panel = this.openModal();
    panel.dataset.testid = 'win';
    panel.append(el('h2', '', p.mode === 'daily' ? t('win.dailyDone') : t('win.title')));
    panel.append(el('div', 'sub-title', this.boardLabel(p)));
    if (medal) {
      const m = el('div', `medal ${medal}`);
      m.dataset.testid = `medal-${medal}`;
      m.append(el('span', 'disc', ICONS.star), el('b', '', t(`medal.${medal}` as StrKey)));
      panel.append(m);
      panel.append(el('div', 'medal-rule', t('medal.rule', { g: fmtTime(tiles * 3), s: fmtTime(tiles * 5) })));
    }
    if (newBest) {
      const nb = el('div', 'new-best', t('win.newBest'));
      nb.dataset.testid = 'new-best';
      panel.append(nb);
    }
    const st = el('div', 'stars');
    for (let k = 0; k < 3; k++) {
      const sp = el('span', k < stars ? 'on' : '', ICONS.star);
      sp.style.animationDelay = `${0.15 + k * 0.18}s`;
      st.append(sp);
    }
    panel.append(st);
    if (restored >= 0) {
      const c = el('canvas', 'garden-thumb');
      panel.append(c, el('div', 'restored', t('win.restored', { name: t(ELEMENTS[restored].key) })));
      requestAnimationFrame(() => this.animateThumb(c, season, restored));
      audio.play('restore');
    }
    const rowsWin: [StrKey, string][] = [
      ['win.time', fmtTime(p.time)],
      ['win.score', String(p.score)],
      ['win.hints', String(p.hints)],
    ];
    if (p.mode === 'replay' && p.board) rowsWin.push(['win.bestTime', fmtTime(this.save.bestTimes[p.board - 1])]);
    if (medal) {
      rowsWin.push(['win.personalBest', fmtTime(dayBest)]);
      rowsWin.push(['stats.streak', t('daily.streak', { n: this.save.daily.streak })]);
    }
    for (const [k, v] of rowsWin) {
      const r = el('div', 'kv');
      r.append(el('span', '', t(k)), el('b', '', v));
      panel.append(r);
    }
    const next = this.button(p.mode === 'daily' ? t('btn.gotoGarden') : t('btn.next'), 'btn primary', () =>
      void this.between(() => (p.mode === 'daily' ? this.showGarden() : this.startJourney())),
    );
    next.dataset.testid = 'next';
    const row = el('div', 'row');
    const menu = this.button(t('btn.menu'), 'btn small', () => void this.between(() => this.showTitle()));
    menu.dataset.testid = 'win-menu';
    const journey = this.button(`${ICONS.star}<span>${t('btn.journey')}</span>`, 'btn small', () => void this.between(() => this.showJourney()));
    journey.dataset.testid = 'win-journey';
    row.append(menu, journey);
    panel.append(next, row);
    this.play = null;
  }

  /**
   * Next / Menu / Journey between boards: an interstitial (portal builds) only once the player has cleared at
   * least 3 boards, and at most one per ~2 minutes
   */
  private async between(go: () => void) {
    if (this.save.stats.won >= ADS_AFTER_BOARDS && Date.now() - this.lastAdAt >= MIDGAME_GAP) {
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

  // ------------------------------------------------------------ journey (board select)

  /** all boards in order, by season: stars and best time on finished boards, the next one highlighted, later locked */
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
    head.append(back, el('h2', '', t('journey.title')), el('div', 'journey-count', t('journey.done', { n: done, total: JOURNEY_LENGTH })));
    const list = el('div', 'journey-list');
    let nextEl: HTMLElement | null = null;
    for (let season = 0; season < 4; season++) {
      const a = season * BOARDS_PER_SEASON;
      list.append(el('h3', 'journey-season', t('journey.season', { season: t(SEASON_KEYS[season]), a: a + 1, b: a + BOARDS_PER_SEASON })));
      const grid = el('div', 'journey-grid');
      for (let n = a; n < a + BOARDS_PER_SEASON; n++) {
        const state = n < this.save.journey ? 'done' : n === this.save.journey ? 'next' : 'locked';
        const b = el('button', `jcell ${state}`);
        b.type = 'button';
        b.dataset.testid = `board-${n + 1}`;
        const name = t(`layout.${layoutAt(n).family}` as StrKey);
        let html = `<span class="num">${n + 1}</span><span class="name">${name}</span>`;
        if (state === 'done') {
          const st = this.save.stars[n] || 0;
          html += `<span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${k < st ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>`;
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
        if (state === 'next') nextEl = b;
        grid.append(b);
      }
      list.append(grid);
    }
    s.append(head, list);
    this.ui.append(s);
    this.layer = s;
    this.resize();
    // bring the next board into view
    requestAnimationFrame(() => nextEl?.scrollIntoView({ block: 'center' }));
  }

  // ------------------------------------------------------------ garden

  private gardenSeason: Season = 0;
  private gardenCanvas: HTMLCanvasElement | null = null;

  showGarden(season?: Season) {
    this.leaveBoard();
    this.clearLayer();
    this.screen = 'garden';
    this.view.setGame(null);
    const n = this.save.journey;
    const current = (Math.min(3, Math.floor(n / ELEMENTS_PER_SEASON)) as Season);
    this.gardenSeason = season ?? current;
    const s = el('div', 'screen garden-screen');
    s.dataset.testid = 'garden-screen';
    const c = el('canvas');
    this.gardenCanvas = c;
    const head = el('div', 'garden-head');
    const back = this.button(ICONS.back, 'icon-btn', () => this.showTitle());
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
    const bar = el('div', 'bar', `<i style="width:${(restored / ELEMENTS_PER_SEASON) * 100}%"></i>`);
    foot.append(bar);
    foot.append(
      el(
        'div',
        'small',
        restored >= ELEMENTS_PER_SEASON ? t('garden.complete') : `${t('garden.text')} ${t('garden.next', { name: t(ELEMENTS[restored].key) })}`,
      ),
    );
    s.append(c, head, foot);
    this.ui.append(s);
    this.layer = s;
    this.resize();
  }

  private renderGardenCanvas() {
    const c = this.gardenCanvas;
    if (!c || !c.isConnected) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.W;
    const H = this.H;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = this.save.journey;
    const restored = Math.max(0, Math.min(ELEMENTS_PER_SEASON, n - this.gardenSeason * ELEMENTS_PER_SEASON));
    drawGarden(ctx, 0, 0, W, H, { season: this.gardenSeason, restored, next: restored < ELEMENTS_PER_SEASON ? restored : -1 });
  }

  // ------------------------------------------------------------ tutorial

  private startTutorial(step = 1) {
    this.tutStep = step;
    this.renderTutorial();
  }

  private tutorialNext() {
    if (this.tutStep >= 3) {
      this.save.tutorialDone = true;
      saveNow(this.save);
      this.closeTutorial();
      return;
    }
    this.tutStep++;
    this.renderTutorial();
  }

  private closeTutorial() {
    this.tutEl?.remove();
    this.tutEl = null;
    this.tutStep = 0;
    this.view.spotlight = [];
    this.view.invalidate();
  }

  private renderTutorial() {
    this.tutEl?.remove();
    const p = this.play;
    if (!p) return;
    const n = this.tutStep;
    const card = el('div', 'tut');
    card.dataset.testid = 'tutorial';
    card.append(el('h3', '', t(`tut.${n}.title` as StrKey)), el('p', '', t(`tut.${n}.text` as StrKey)));
    const foot = el('div', 'foot');
    foot.append(el('span', 'step', t('tut.step', { n })));
    const nx = this.button(n === 3 ? t('tut.done') : t('tut.next'), 'btn primary', () => this.tutorialNext());
    nx.dataset.testid = 'tut-next';
    foot.append(nx);
    card.append(foot);
    this.ui.append(card);
    this.tutEl = card;
    if (n === 1) {
      const m = p.gameObj.hint();
      this.view.spotlight = m ? [...m] : [];
    } else if (n === 2) {
      // spotlight one free and leave the shading to show blocked tiles
      this.view.spotlight = [];
    } else this.view.spotlight = [];
    this.view.invalidate();
    this.placeTutorial();
    if (n === 3 && this.hud) {
      this.hud.tools.animate([{ transform: this.hud.tools.style.transform || 'none', filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], { duration: 900, iterations: 2 });
    }
  }

  private placeTutorial() {
    const card = this.tutEl;
    if (!card || !this.hud) return;
    const area = this.boardArea();
    const spots = this.view.spotlight.map((i) => this.view.tileRect(i));
    const top = this.hud.root.getBoundingClientRect().bottom + 8;
    const bottomLimit = document.body.classList.contains('portrait') ? this.hud.tools.getBoundingClientRect().top - 8 : this.H - 8;
    const h = card.getBoundingClientRect().height;
    // prefer the bottom; move to the top if it would cover the highlighted tiles
    const atBottom = bottomLimit - h;
    const overlaps = (y: number) => spots.some((r) => r.y < y + h && r.y + r.h > y);
    const y = !overlaps(atBottom) ? atBottom : top;
    card.style.top = Math.max(top, y) + 'px';
    if (document.body.classList.contains('landscape')) {
      const tools = this.hud.tools.getBoundingClientRect();
      card.style.left = area.x + (tools.left - area.x) / 2 + 'px';
    } else card.style.left = '50%';
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
        tutorial: this.tutStep,
        variant: this.play?.variant ?? null,
        hintsLeft: this.play?.hintsLeft ?? null,
        shufflesLeft: this.play?.shufflesLeft ?? null,
        undosLeft: this.play?.undosLeft ?? null,
        adPaused: this.adPaused,
        tileWidth: this.play ? this.view.m.w : null,
      }),
      /** a good open pair (no hint consumed) and the screen centers of its tiles */
      pair: () => {
        const g = this.play?.gameObj;
        const m = g?.hint(3000);
        return m ? m.map((i) => this.view.tileCenter(i)) : null;
      },
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
        this.closeTutorial();
      },
      /** finish the board instantly (used by e2e tests and the art scripts) */
      solve: (leave = 0) => {
        const p = this.play;
        if (!p) return false;
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
        for (let k = 0; k < n; k++) {
          this.save.stars[k] = 1 + ((k * 7 + 3) % 3 === 0 ? 0 : (k * 5) % 3 === 0 ? 1 : 2);
          this.save.bestTimes[k] = 70 + ((k * 37) % 9) * 14 + k * 6;
        }
        this.save.daily = { ...this.save.daily, streak: 4, longest: 6, last: todayKey(new Date(Date.now() - 86400000)) };
        this.save.stats.won = n;
        this.save.stats.played = n + 3;
      },
      showJourney: () => this.showJourney(),
      /** set the board clock (screenshots of a realistic result) */
      setTime: (secs: number) => {
        if (this.play) this.play.time = secs;
      },
    };
  }

  async start() {
    this.resize();
    this.showTitle();
    document.body.dataset.ready = '1';
  }
}

let app: App | null = null;
export async function startApp() {
  // the portal SDK loads in the background; the game never waits for it
  void sdk.init();
  app = new App();
  (window as unknown as { __mjg: unknown }).__mjg = app.debug();
  await app.start();
  return app;
}
