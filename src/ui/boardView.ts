/**
 * Draws the board on its canvas and turns taps into tile indices. Handles fitting the board to the free area,
 * pinch / wheel zoom with panning, and the small animations (selection, hint glow, matched tiles lifting away).
 */
import { TileSprites, tileMetrics } from '../art/sprites';
import { roundRect, type FaceOptions, type TileMetrics } from '../art/tileArt';
import type { Game } from '../game/game';
import { tileWidthIn } from '../layouts/build';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Fading {
  i: number;
  face: number;
  x: number;
  y: number;
  t0: number;
}

const FADE_MS = 420;
const HINT_MS = 3200;
const SHAKE_MS = 320;

export class BoardView {
  readonly ctx: CanvasRenderingContext2D;
  game: Game | null = null;
  private area: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private dpr = 1;
  m: TileMetrics = tileMetrics(40);
  private sprites: TileSprites | null = null;
  private spriteKey = '';
  /** board origin (CSS px) before zoom */
  private ox = 0;
  private oy = 0;
  private ld = 4;
  private hx = 20;
  private hy = 26;
  zoom = 1;
  panX = 0;
  panY = 0;
  selected = -1;
  hint: [number, number] | null = null;
  private hintT0 = 0;
  /** tiles pulsing for the tutorial (no timeout) */
  spotlight: number[] = [];
  private fading: Fading[] = [];
  private shake: { i: number; t0: number } | null = null;
  private raf = 0;
  private dirty = true;
  highlightFree = true;
  faceOpts: FaceOptions;
  reducedMotion = false;
  onTap: (i: number) => void = () => {};
  onZoomChange: (zoomed: boolean) => void = () => {};

  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { d0: number; z0: number; cx: number; cy: number; px: number; py: number } | null = null;
  private drag: { x0: number; y0: number; px: number; py: number; moved: boolean } | null = null;
  private spriteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    faceOpts: FaceOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.faceOpts = faceOpts;
    this.bindInput();
  }

  setGame(g: Game | null) {
    this.game = g;
    this.selected = -1;
    this.hint = null;
    this.spotlight = [];
    this.fading = [];
    this.resetZoom();
    this.fit();
    this.invalidate();
  }

  setFaceOptions(o: FaceOptions) {
    this.faceOpts = o;
    this.spriteKey = '';
    this.invalidate();
  }

  resize(W: number, H: number, dpr: number, area: Rect) {
    this.dpr = dpr;
    this.area = area;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.fit();
    this.invalidate();
  }

  /** the tile size the board would get in an area (used to choose the portrait orientation) */
  static tileWidthFor(b: { minX: number; minY: number; maxX: number; maxY: number; maxZ: number }, area: Rect) {
    return Math.max(12, Math.min(tileWidthIn(b, area.w, area.h), 150));
  }

  private fit() {
    const g = this.game;
    if (!g) return;
    const b = g.g.bounds;
    const tw = Math.floor(BoardView.tileWidthFor(b, this.area));
    this.m = tileMetrics(tw);
    this.hx = this.m.w / 2;
    this.hy = this.m.h / 2;
    this.ld = Math.max(2, Math.round(tw * 0.12));
    const pw = (b.maxX - b.minX) * this.hx + this.m.d + b.maxZ * this.ld;
    const ph = (b.maxY - b.minY) * this.hy + this.m.d + b.maxZ * this.ld;
    this.ox = Math.round(this.area.x + (this.area.w - pw) / 2 + b.maxZ * this.ld - b.minX * this.hx);
    this.oy = Math.round(this.area.y + (this.area.h - ph) / 2 + b.maxZ * this.ld - b.minY * this.hy);
    this.ensureSprites();
  }

  private ensureSprites() {
    const scale = this.dpr * Math.min(this.zoom, 3);
    const key = `${this.m.w}|${scale.toFixed(2)}|${this.faceOpts.set}|${this.faceOpts.palette.red}|${this.faceOpts.indices}|${this.faceOpts.windLetters.join('')}`;
    if (key === this.spriteKey) return;
    this.spriteKey = key;
    this.sprites = new TileSprites(this.m, scale, this.faceOpts);
  }

  /** top-left of a tile's face in board space (before zoom) */
  tileXY(i: number): [number, number] {
    const [x, y, z] = this.game!.g.slots[i];
    return [this.ox + x * this.hx - z * this.ld, this.oy + y * this.hy - z * this.ld];
  }

  /** a tile's face center in screen CSS px (for tests, recordings and the tutorial pointer) */
  tileCenter(i: number): [number, number] {
    const [x, y] = this.tileXY(i);
    return this.toScreen(x + this.m.w / 2, y + this.m.h / 2);
  }

  /** a tile's face rectangle in screen CSS px */
  tileRect(i: number): Rect {
    const [x, y] = this.tileXY(i);
    const [sx, sy] = this.toScreen(x, y);
    return { x: sx, y: sy, w: this.m.w * this.zoom, h: this.m.h * this.zoom };
  }

  private toScreen(x: number, y: number): [number, number] {
    const cx = this.area.x + this.area.w / 2;
    const cy = this.area.y + this.area.h / 2;
    return [(x - cx) * this.zoom + cx + this.panX, (y - cy) * this.zoom + cy + this.panY];
  }
  private toBoard(x: number, y: number): [number, number] {
    const cx = this.area.x + this.area.w / 2;
    const cy = this.area.y + this.area.h / 2;
    return [(x - cx - this.panX) / this.zoom + cx, (y - cy - this.panY) / this.zoom + cy];
  }

  /** topmost present tile under a screen point, or -1 */
  pick(sx: number, sy: number): number {
    const g = this.game;
    if (!g) return -1;
    const [x, y] = this.toBoard(sx, sy);
    const order = g.g.order;
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k];
      if (!g.present[i]) continue;
      const [tx, ty] = this.tileXY(i);
      if (x >= tx && x <= tx + this.m.w + this.m.d * 0.5 && y >= ty && y <= ty + this.m.h + this.m.d * 0.5) return i;
    }
    return -1;
  }

  showHint(m: [number, number]) {
    this.hint = m;
    this.hintT0 = performance.now();
    this.invalidate();
  }

  /** matched tiles lift and fade */
  removeAnim(a: number, b: number) {
    const g = this.game!;
    const now = performance.now();
    for (const i of [a, b]) {
      const [x, y] = this.tileXY(i);
      this.fading.push({ i, face: g.faces[i], x, y, t0: now });
    }
    if (this.hint && (this.hint.includes(a) || this.hint.includes(b))) this.hint = null;
    this.invalidate();
  }

  shakeTile(i: number) {
    this.shake = { i, t0: performance.now() };
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
  }

  private frame() {
    this.raf = 0;
    const now = performance.now();
    this.fading = this.fading.filter((f) => now - f.t0 < FADE_MS);
    if (this.hint && now - this.hintT0 > HINT_MS) this.hint = null;
    if (this.shake && now - this.shake.t0 > SHAKE_MS) this.shake = null;
    const animating = this.fading.length > 0 || !!this.hint || !!this.shake || this.spotlight.length > 0;
    if (this.dirty || animating) this.draw(now);
    this.dirty = false;
    if (animating) this.raf = requestAnimationFrame(() => this.frame());
  }

  private draw(now: number) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const g = this.game;
    if (!g || !this.sprites) return;
    this.ensureSprites();
    const sp = this.sprites;
    const cx = this.area.x + this.area.w / 2;
    const cy = this.area.y + this.area.h / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(cx + this.panX, cy + this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);
    const { w, h, r } = this.m;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    for (const i of g.g.order) {
      if (!g.present[i]) continue;
      const [x0, y] = this.tileXY(i);
      let x = x0;
      if (this.shake && this.shake.i === i) {
        const t = (now - this.shake.t0) / SHAKE_MS;
        x += Math.sin(t * Math.PI * 6) * (1 - t) * w * 0.06;
      }
      sp.draw(ctx, g.faces[i], x, y);
      const free = g.isFree(i);
      if (this.highlightFree && !free) {
        ctx.fillStyle = 'rgba(40, 70, 55, 0.34)';
        roundRect(ctx, x, y, w, h, r);
        ctx.fill();
      }
      if (i === this.selected) {
        ctx.fillStyle = 'rgba(250, 205, 90, 0.32)';
        roundRect(ctx, x, y, w, h, r);
        ctx.fill();
        ctx.strokeStyle = '#d9a63a';
        ctx.lineWidth = Math.max(2.5, w * 0.06);
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
        ctx.stroke();
      }
      const glow = (this.hint && this.hint.includes(i)) || this.spotlight.includes(i);
      if (glow) {
        ctx.save();
        ctx.shadowColor = 'rgba(120, 255, 190, 0.9)';
        ctx.shadowBlur = w * 0.35 * (0.6 + 0.4 * pulse);
        ctx.strokeStyle = `rgba(90, 230, 160, ${0.65 + 0.35 * pulse})`;
        ctx.lineWidth = Math.max(3, w * 0.075);
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const f of this.fading) {
      const t = Math.min(1, (now - f.t0) / FADE_MS);
      const e = 1 - (1 - t) * (1 - t);
      ctx.save();
      ctx.globalAlpha = 1 - e;
      const s = 1 + e * 0.12;
      ctx.translate(f.x + w / 2, f.y + h / 2 - e * h * 0.25);
      ctx.scale(s, s);
      sp.draw(ctx, f.face, -w / 2, -h / 2);
      ctx.restore();
      // a soft burst of light
      ctx.save();
      ctx.globalAlpha = (1 - e) * 0.7;
      const gr = ctx.createRadialGradient(f.x + w / 2, f.y + h / 2, 0, f.x + w / 2, f.y + h / 2, w * (0.6 + e));
      gr.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
      gr.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(f.x - w, f.y - h, w * 3, h * 3);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ zoom & input

  resetZoom() {
    this.zoom = 1;
    this.panX = this.panY = 0;
    this.onZoomChange(false);
    this.scheduleSprites();
    this.invalidate();
  }

  private clampPan() {
    const maxX = (this.area.w * (this.zoom - 1)) / 2 + 20;
    const maxY = (this.area.h * (this.zoom - 1)) / 2 + 20;
    this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
  }

  private setZoom(z: number, sx: number, sy: number) {
    const nz = Math.max(1, Math.min(3, z));
    // keep the board point under (sx, sy) in place
    const [bx, by] = this.toBoard(sx, sy);
    this.zoom = nz;
    const cx = this.area.x + this.area.w / 2;
    const cy = this.area.y + this.area.h / 2;
    this.panX = sx - ((bx - cx) * nz + cx);
    this.panY = sy - ((by - cy) * nz + cy);
    if (nz === 1) this.panX = this.panY = 0;
    this.clampPan();
    this.onZoomChange(nz > 1.01);
    this.scheduleSprites();
    this.invalidate();
  }

  /** re-render the tile sprites sharp for the new zoom once the gesture settles */
  private scheduleSprites() {
    if (this.spriteTimer) clearTimeout(this.spriteTimer);
    this.spriteTimer = setTimeout(() => {
      this.ensureSprites();
      this.invalidate();
    }, 160);
  }

  private bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: this.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, px: this.panX, py: this.panY };
        this.drag = null;
      } else if (this.pointers.size === 1) {
        this.drag = { x0: e.clientX, y0: e.clientY, px: this.panX, py: this.panY, moved: false };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.gesture && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.panX = this.gesture.px + (mx - this.gesture.cx);
        this.panY = this.gesture.py + (my - this.gesture.cy);
        this.setZoom((this.gesture.z0 * d) / Math.max(10, this.gesture.d0), mx, my);
      } else if (this.drag) {
        const dx = e.clientX - this.drag.x0;
        const dy = e.clientY - this.drag.y0;
        if (Math.hypot(dx, dy) > 10) this.drag.moved = true;
        if (this.drag.moved && this.zoom > 1) {
          this.panX = this.drag.px + dx;
          this.panY = this.drag.py + dy;
          this.clampPan();
          this.invalidate();
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.gesture) {
        if (this.pointers.size < 2) this.gesture = null;
        this.drag = null;
        return;
      }
      const d = this.drag;
      this.drag = null;
      if (e.type === 'pointerup' && d && !d.moved) {
        const i = this.pick(e.clientX, e.clientY);
        this.onTap(i);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      },
      { passive: false },
    );
  }
}
