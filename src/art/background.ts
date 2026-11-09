/**
 * The table: deep jade felt with a fine weave, and quiet garden details at the edges (bamboo, a plum branch,
 * red lanterns, distant ink hills). Plus a few falling petals on a separate layer.
 */
import { blossomShape, drawLantern } from './decor';

function noisePattern(ctx: CanvasRenderingContext2D) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const x = c.getContext('2d')!;
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    const on = v > 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 255 : 0;
    img.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 14);
  }
  x.putImageData(img, 0, 0);
  // faint diagonal weave
  x.strokeStyle = 'rgba(255,255,255,0.025)';
  for (let k = -160; k < 320; k += 4) {
    x.beginPath();
    x.moveTo(k, 0);
    x.lineTo(k + 160, 160);
    x.stroke();
  }
  return ctx.createPattern(c, 'repeat')!;
}

export function drawFelt(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.1, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, '#4aa67e');
  g.addColorStop(0.55, '#358a65');
  g.addColorStop(1, '#22664a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = noisePattern(ctx);
  ctx.fillRect(0, 0, W, H);
}

function bambooStalk(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, color: string, lean: number) {
  const segs = Math.max(3, Math.round((y1 - y0) / (w * 5.5)));
  const sl = (y1 - y0) / segs;
  for (let i = 0; i < segs; i++) {
    const ya = y0 + i * sl;
    const xa = x + lean * (ya - y0);
    const xb = x + lean * (ya + sl - y0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(xa - w / 2, ya + 2);
    ctx.lineTo(xa + w / 2, ya + 2);
    ctx.lineTo(xb + w / 2, ya + sl - 2);
    ctx.lineTo(xb - w / 2, ya + sl - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(xb - w * 0.62, ya + sl - 3, w * 1.24, 3);
  }
}

function bambooLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, a: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -len * 0.16, len, 0);
  ctx.quadraticCurveTo(len * 0.45, len * 0.13, 0, 0);
  ctx.fill();
  ctx.restore();
}

/** bamboo silhouettes at the left edge */
function bambooGrove(ctx: CanvasRenderingContext2D, H: number, s: number) {
  const dark = 'rgba(20, 80, 55, 0.4)';
  const mid = 'rgba(120, 200, 150, 0.28)';
  const stalks: [number, number, string, number][] = [
    [s * 0.035, s * 0.028, dark, 0.02],
    [s * 0.09, s * 0.02, mid, -0.03],
    [s * 0.135, s * 0.016, dark, 0.04],
  ];
  for (const [x, w, col, lean] of stalks) bambooStalk(ctx, x, -10, H + 10, w, col, lean);
  const leaves: [number, number, number, number, string][] = [];
  for (let k = 0; k < 9; k++) {
    const y = H * (0.18 + k * 0.09);
    const x = s * (0.04 + (k % 3) * 0.05);
    leaves.push([x, y, s * (0.11 + (k % 2) * 0.03), 0.2 + (k % 4) * 0.35, k % 2 ? dark : mid]);
  }
  for (const [x, y, l, a, c] of leaves) {
    bambooLeaf(ctx, x, y, l, a, c);
    bambooLeaf(ctx, x, y + l * 0.1, l * 0.85, a + 0.45, c);
  }
}

/** plum branch from the top-right corner */
function plumBranch(ctx: CanvasRenderingContext2D, W: number, s: number) {
  ctx.save();
  ctx.translate(W, 0);
  ctx.strokeStyle = 'rgba(52, 30, 20, 0.85)';
  ctx.lineCap = 'round';
  const br = (pts: number[], w: number) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0] * s, pts[1] * s);
    for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i] * s, pts[i + 1] * s, pts[i + 2] * s, pts[i + 3] * s);
    ctx.stroke();
  };
  br([0.02, -0.01, -0.06, 0.05, -0.14, 0.07, -0.22, 0.09, -0.3, 0.07], s * 0.014);
  br([-0.12, 0.065, -0.16, 0.12, -0.21, 0.15], s * 0.008);
  br([-0.22, 0.09, -0.26, 0.13, -0.33, 0.14], s * 0.006);
  br([-0.05, 0.04, -0.06, 0.1, -0.1, 0.14], s * 0.007);
  const blooms: [number, number, number, string][] = [
    [-0.3, 0.07, 0.022, '#f3c6cf'],
    [-0.21, 0.15, 0.02, '#e88fa2'],
    [-0.33, 0.14, 0.017, '#f7dfe3'],
    [-0.1, 0.14, 0.02, '#f3c6cf'],
    [-0.17, 0.07, 0.016, '#e88fa2'],
    [-0.255, 0.115, 0.012, '#f7dfe3'],
    [-0.06, 0.09, 0.013, '#e88fa2'],
  ];
  for (const [x, y, r, c] of blooms) blossomShape(ctx, x * s, y * s, r * s, c, 0.92);
  ctx.restore();
}

/** distant hills in pale ink wash at the bottom-right */
function inkHills(ctx: CanvasRenderingContext2D, W: number, H: number, s: number) {
  ctx.save();
  for (const [ox, h, a] of [
    [0.55, 0.16, 0.06],
    [0.35, 0.11, 0.08],
  ]) {
    ctx.fillStyle = `rgba(160, 220, 190, ${a})`;
    ctx.beginPath();
    ctx.moveTo(W - s * ox, H);
    ctx.bezierCurveTo(W - s * (ox - 0.08), H - s * h, W - s * (ox - 0.16), H - s * h * 0.6, W - s * (ox - 0.24), H - s * h * 1.1);
    ctx.bezierCurveTo(W - s * (ox - 0.3), H - s * h * 1.4, W - s * (ox - 0.38), H - s * h * 0.4, W + 10, H - s * h * 0.5);
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface BackgroundOptions {
  lanterns?: boolean;
}

/** full background (felt + edge details); `s` scales the details to the screen */
export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, o: BackgroundOptions = {}) {
  drawFelt(ctx, W, H);
  const s = Math.min(Math.max(W, H) * 0.62, Math.min(W, H) * 1.35);
  inkHills(ctx, W, H, s);
  bambooGrove(ctx, H, s);
  plumBranch(ctx, W, s);
  if (o.lanterns !== false) {
    const lx = W * 0.5 < s * 0.5 ? s * 0.2 : s * 0.24;
    drawLantern(ctx, lx, 0, s * 0.045, s * 0.07, 0.9);
    drawLantern(ctx, lx + s * 0.075, 0, s * 0.035, s * 0.035, 0.75);
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,40,25,0.16)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- falling petals

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  va: number;
  phase: number;
  color: string;
}

export class Petals {
  private list: Petal[] = [];
  private raf = 0;
  private last = 0;
  private W = 0;
  private H = 0;
  running = false;
  constructor(private readonly canvas: HTMLCanvasElement) {}

  resize(W: number, H: number, dpr: number) {
    this.W = W;
    this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(16, 6 + (W * H) / 120000));
    while (this.list.length < n) this.list.push(this.spawn(true));
    this.list.length = n;
  }

  private spawn(anywhere: boolean): Petal {
    const s = Math.min(this.W, this.H) || 600;
    return {
      x: Math.random() * this.W * 1.1,
      y: anywhere ? Math.random() * this.H : -20,
      vx: -(8 + Math.random() * 14),
      vy: 14 + Math.random() * 18,
      r: s * (0.007 + Math.random() * 0.006),
      a: Math.random() * 6,
      va: (Math.random() - 0.5) * 1.6,
      phase: Math.random() * 6,
      color: ['#f6d3da', '#f0b3c0', '#fbe9ec', '#e796a8'][Math.floor(Math.random() * 4)],
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      // ~30 fps is plenty for slow petals
      if (t - this.last >= 30) {
        this.last = t;
        this.step(dt);
        this.draw();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** a still frame (reduced motion) */
  still() {
    this.stop();
    this.draw();
  }

  private step(dt: number) {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.phase += dt * 1.3;
      p.x += (p.vx + Math.sin(p.phase) * 16) * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (p.y > this.H + 20 || p.x < -30) this.list[i] = this.spawn(false);
    }
  }

  private draw() {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.W, this.H);
    for (const p of this.list) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.phase)));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r * 1.1, -p.r * 0.2, 0, p.r);
      ctx.quadraticCurveTo(-p.r * 1.1, -p.r * 0.2, 0, -p.r);
      ctx.fill();
      ctx.restore();
    }
  }
}
