/**
 * Draws the board on its canvas and turns taps into tile indices. Handles fitting the board to the free area,
 * pinch / wheel zoom with panning, and the small animations (selection, hint glow, matched tiles lifting away).
 */
import { TileSprites, layerShift, tileMetrics } from '../art/sprites';
import { roundRect, type FaceOptions, type TileMetrics } from '../art/tileArt';
import type { Game } from '../game/game';
import { tileWidthIn } from '../layouts/build';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** a matched tile: it lifts, flies to meet its partner, and both burst into sparkles and petals */
interface Flyer {
  face: number;
  /** start (top-left of the face) and the meeting point (center), board space */
  x: number;
  y: number;
  mx: number;
  my: number;
  /** -1 / +1: which side it comes from (for the little tilt) */
  side: number;
  t0: number;
}

/** lift, then fly together; the burst starts at FLY_MS */
const LIFT_MS = 110;
const FLY_MS = 330;
const VANISH_MS = 120;
const FADE_MS = FLY_MS + VANISH_MS;
const SPARK_MS = 760;
const PETAL_MS = 1100;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  t0: number;
  color: string;
  /** 'star' sparkles or 'petal' (pink / white blossom petals that tumble and drift down) */
  kind: 'star' | 'petal';
  rot: number;
  spin: number;
}
const PETAL_COLORS = ['#f8b8c9', '#fde3ea', '#f39bb3', '#ffffff'];
const SPARK_COLORS = ['#fff7c2', '#ffd54f', '#ffffff', '#b9f6ca'];
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
  private fading: Flyer[] = [];
  /** a blocked tile marked by the tutorial (soft amber ring and a lock), or -1 */
  blockedMark = -1;
  /** large tiles: the board starts zoomed in to about this tile width (px), 0 = fit the screen */
  preferTile = 0;
  private sparks: Spark[] = [];
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
    this.blockedMark = -1;
    this.fading = [];
    this.sparks = [];
    this.resetZoom();
    this.fit();
    this.applyPreferredZoom();
    this.invalidate();
  }

  /** large tiles: zoom in around the board center until tiles are about `preferTile` wide (at most 1.6x) */
  applyPreferredZoom() {
    if (!this.game || !this.preferTile || this.m.w >= this.preferTile) return;
    const z = Math.min(1.6, this.preferTile / this.m.w);
    this.setZoom(z, this.area.x + this.area.w / 2, this.area.y + this.area.h / 2);
  }

  /** a point in board space (before zoom) on the screen */
  boardToScreen(x: number, y: number): [number, number] {
    return this.toScreen(x, y);
  }

  get animating() {
    return this.fading.length > 0 || this.sparks.length > 0;
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
    const zoomed = this.zoom > 1.01;
    this.fit();
    if (!zoomed) this.applyPreferredZoom();
    else this.clampPan();
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
    this.ld = layerShift(tw);
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

  /**
   * Matched tiles lift, fly together and burst into sparkles and blossom petals at their meeting point.
   * Returns the meeting point on the screen (for the score / combo label).
   */
  removeAnim(a: number, b: number, strength = 1): [number, number] {
    const g = this.game!;
    const now = performance.now();
    const [ax, ay] = this.tileXY(a);
    const [bx, by] = this.tileXY(b);
    const mx = (ax + bx) / 2 + this.m.w / 2;
    const my = (ay + by) / 2 + this.m.h / 2 - this.m.h * 0.12;
    this.fading.push({ face: g.faces[a], x: ax, y: ay, mx, my, side: ax <= bx ? -1 : 1, t0: now });
    this.fading.push({ face: g.faces[b], x: bx, y: by, mx, my, side: ax <= bx ? 1 : -1, t0: now });
    if (!this.reducedMotion) {
      const t0 = now + FLY_MS;
      const w = this.m.w;
      // sparkles: more on combos
      const n = Math.round(14 + 6 * Math.min(4, strength - 1));
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + Math.random() * 0.4;
        const sp = w * (1.1 + Math.random() * 1.1);
        this.sparks.push({ x: mx, y: my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - w * 0.35, r: w * (0.05 + Math.random() * 0.05), t0, color: SPARK_COLORS[k % 4], kind: 'star', rot: 0, spin: 3 });
      }
      // blossom petals drift up and tumble down
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        const sp = w * (0.7 + Math.random() * 0.9);
        this.sparks.push({ x: mx, y: my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: w * (0.07 + Math.random() * 0.04), t0, color: PETAL_COLORS[k % 4], kind: 'petal', rot: Math.random() * 6, spin: (Math.random() - 0.5) * 9 });
      }
    }
    if (this.hint && (this.hint.includes(a) || this.hint.includes(b))) this.hint = null;
    this.invalidate();
    return this.toScreen(mx, my);
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
    this.sparks = this.sparks.filter((p) => now - p.t0 < (p.kind === 'petal' ? PETAL_MS : SPARK_MS));
    if (this.hint && now - this.hintT0 > HINT_MS) this.hint = null;
    if (this.shake && now - this.shake.t0 > SHAKE_MS) this.shake = null;
    const animating = this.fading.length > 0 || this.sparks.length > 0 || !!this.hint || !!this.shake || this.spotlight.length > 0 || this.blockedMark >= 0;
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
      const [x0, y0] = this.tileXY(i);
      let x = x0;
      let y = y0;
      const sel = i === this.selected;
      if (sel) {
        // the selected tile lifts a little, with a soft shadow under it
        y -= this.m.h * 0.05;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 40, 28, 0.28)';
        roundRect(ctx, x0 + w * 0.04, y0 + h * 0.06, w, h, r);
        ctx.fill();
        ctx.restore();
      }
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
      if (sel) {
        ctx.fillStyle = 'rgba(250, 205, 90, 0.32)';
        roundRect(ctx, x, y, w, h, r);
        ctx.fill();
        ctx.strokeStyle = '#d9a63a';
        ctx.lineWidth = Math.max(2.5, w * 0.06);
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
        ctx.stroke();
      }
      if (i === this.blockedMark) {
        // tutorial: a blocked tile, soft amber ring and a small lock
        ctx.save();
        ctx.strokeStyle = `rgba(240, 150, 60, ${0.7 + 0.3 * pulse})`;
        ctx.lineWidth = Math.max(3, w * 0.07);
        ctx.setLineDash([w * 0.12, w * 0.08]);
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
        ctx.stroke();
        ctx.setLineDash([]);
        const lr = w * 0.17;
        const lx = x + w - lr * 0.6;
        const ly = y + lr * 0.6;
        ctx.fillStyle = '#f39a3c';
        ctx.strokeStyle = '#5a3412';
        ctx.lineWidth = Math.max(1.5, w * 0.025);
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, w * 0.03);
        ctx.beginPath();
        ctx.arc(lx, ly - lr * 0.15, lr * 0.32, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(lx - lr * 0.42, ly - lr * 0.12, lr * 0.84, lr * 0.6);
        ctx.restore();
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
      const el = now - f.t0;
      // lift (scale up, rise), fly to the meeting point (ease in), then vanish into the burst
      const lift = Math.min(1, el / LIFT_MS);
      const fly = Math.max(0, Math.min(1, (el - LIFT_MS) / (FLY_MS - LIFT_MS)));
      const fe = fly * fly * (3 - 2 * fly);
      const vanish = Math.max(0, Math.min(1, (el - FLY_MS) / VANISH_MS));
      const sx = f.x + w / 2;
      const sy = f.y + h / 2 - lift * h * 0.12;
      const cx2 = sx + (f.mx - sx) * fe;
      const cy2 = sy + (f.my - sy) * fe - Math.sin(fe * Math.PI) * h * 0.18;
      const s = (1 + lift * 0.12) * (1 - vanish * 0.6);
      ctx.save();
      ctx.globalAlpha = 1 - vanish;
      ctx.translate(cx2, cy2);
      ctx.rotate(f.side * 0.12 * Math.sin(fe * Math.PI));
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(255, 230, 140, 0.9)';
      ctx.shadowBlur = w * 0.25 * lift;
      sp.draw(ctx, f.face, -w / 2, -h / 2);
      ctx.restore();
      if (vanish > 0) {
        // a warm flash where the two tiles meet
        ctx.save();
        ctx.globalAlpha = (1 - vanish) * 0.9;
        const gr = ctx.createRadialGradient(f.mx, f.my, w * 0.1, f.mx, f.my, w * (0.6 + vanish * 1.1));
        gr.addColorStop(0, 'rgba(255, 250, 220, 1)');
        gr.addColorStop(0.45, 'rgba(255, 214, 90, 0.55)');
        gr.addColorStop(1, 'rgba(255, 214, 90, 0)');
        ctx.fillStyle = gr;
        ctx.fillRect(f.mx - w * 2, f.my - w * 2, w * 4, w * 4);
        ctx.restore();
      }
    }
    for (const p of this.sparks) {
      if (now < p.t0) continue;
      const petal = p.kind === 'petal';
      const t = (now - p.t0) / (petal ? PETAL_MS : SPARK_MS);
      const drag = petal ? 1 - Math.exp(-3 * t) : t;
      const px = p.x + p.vx * (petal ? drag * 0.45 : t) + (petal ? Math.sin(t * 9 + p.rot) * w * 0.12 : 0);
      const py = p.y + p.vy * (petal ? drag * 0.45 : t) + w * (petal ? 0.9 : 0.8) * t * t;
      ctx.save();
      ctx.globalAlpha = petal ? Math.min(1, (1 - t) * 1.6) : 1 - t;
      ctx.translate(px, py);
      ctx.rotate(p.rot + t * p.spin);
      ctx.fillStyle = p.color;
      if (petal) {
        // a blossom petal: an oval with a notch, slowly turning (flattened as it spins)
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(t * 7 + p.rot)));
        ctx.beginPath();
        ctx.moveTo(0, -p.r * 1.2);
        ctx.bezierCurveTo(p.r * 1.1, -p.r * 0.9, p.r * 1.0, p.r * 0.8, 0, p.r * 1.2);
        ctx.bezierCurveTo(-p.r * 1.0, p.r * 0.8, -p.r * 1.1, -p.r * 0.9, 0, -p.r * 1.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 90, 120, 0.45)';
        ctx.lineWidth = Math.max(1, p.r * 0.18);
        ctx.stroke();
      } else {
        const rr = p.r * (1 - t * 0.6);
        ctx.shadowColor = 'rgba(255, 220, 120, 0.9)';
        ctx.shadowBlur = rr * 3;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const rad = k % 2 ? rr * 0.38 : rr * 1.6;
          ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
      }
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
