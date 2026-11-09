/** Title / cover art: the logo beside a small pyramid of tiles on the felt, with the garden details. */
import { drawBackground } from './background';
import { blossomShape } from './decor';
import { drawGarden } from './garden';
import { TileSprites, tileMetrics } from './sprites';
import { CLASSIC } from './tileArt';

function logo(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, tagline: string | null) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ecca7c';
  ctx.font = `600 ${Math.round(s * 0.2)}px Lora, Georgia, serif`;
  const word = 'MAHJONG';
  // letter-spaced
  const sp = s * 0.085;
  const widths = [...word].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (word.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  [...word].forEach((c, i) => {
    ctx.fillText(c, x, cy - s * 0.62);
    x += widths[i] + sp;
  });
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetY = s * 0.03;
  const g = ctx.createLinearGradient(0, cy - s * 0.5, 0, cy + s * 0.1);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#ead9b0');
  ctx.fillStyle = g;
  ctx.font = `700 ${Math.round(s * 0.62)}px Lora, Georgia, serif`;
  ctx.fillText('Jade Garden', cx, cy);
  ctx.shadowColor = 'transparent';
  // ornament rule with a leaf
  ctx.strokeStyle = '#d2a64a';
  ctx.lineWidth = Math.max(1, s * 0.012);
  const rw = s * 0.75;
  const ry = cy + s * 0.22;
  for (const dir of [-1, 1]) {
    const gr = ctx.createLinearGradient(cx + dir * s * 0.12, 0, cx + dir * rw, 0);
    gr.addColorStop(0, '#d2a64a');
    gr.addColorStop(1, 'rgba(210,166,74,0)');
    ctx.strokeStyle = gr;
    ctx.beginPath();
    ctx.moveTo(cx + dir * s * 0.12, ry);
    ctx.lineTo(cx + dir * rw, ry);
    ctx.stroke();
  }
  ctx.fillStyle = '#d2a64a';
  ctx.beginPath();
  ctx.ellipse(cx, ry, s * 0.07, s * 0.03, -0.5, 0, Math.PI * 2);
  ctx.fill();
  blossomShape(ctx, cx - s * 0.08, ry, s * 0.035, '#e88fa2');
  blossomShape(ctx, cx + s * 0.08, ry, s * 0.035, '#f3c6cf');
  if (tagline) {
    ctx.fillStyle = '#d9ceb4';
    ctx.font = `400 ${Math.round(s * 0.135)}px "Source Sans 3", Arial, sans-serif`;
    ctx.fillText(tagline, cx, cy + s * 0.46);
  }
  ctx.restore();
}

/** three large tiles fanned out (dots, red dragon, plum flower) */
function fan(ctx: CanvasRenderingContext2D, cx: number, cy: number, tw: number) {
  const m = tileMetrics(tw);
  const sp = new TileSprites(m, Math.min(2, window.devicePixelRatio || 1), { palette: CLASSIC, indices: false, windLetters: ['E', 'S', 'W', 'N'] });
  [0, 31, 34].forEach((f, i) => {
    ctx.save();
    ctx.translate(cx + (i - 1) * tw * 1.12, cy + (i === 1 ? -m.h * 0.08 : 0));
    ctx.rotate((i - 1) * 0.16);
    sp.draw(ctx, f, -m.w / 2, -m.h / 2);
    ctx.restore();
  });
}

export function renderCover(canvas: HTMLCanvasElement, W: number, H: number, tagline: string | null = 'Classic tile solitaire in a quiet garden') {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawBackground(ctx, W, H);
  const wide = W / H > 1.25;
  if (wide) {
    // a glimpse of the garden through a round window on the right
    const r = H * 0.36;
    const gx = W * 0.71;
    const gy = H * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.clip();
    drawGarden(ctx, gx - r * 1.6, gy - r, r * 3.2, r * 2, { season: 0, restored: 16 });
    ctx.restore();
    ctx.strokeStyle = '#d2a64a';
    ctx.lineWidth = H * 0.008;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,166,74,0.4)';
    ctx.lineWidth = H * 0.003;
    ctx.beginPath();
    ctx.arc(gx, gy, r * 1.04, 0, Math.PI * 2);
    ctx.stroke();
    fan(ctx, W * 0.29, H * 0.36, Math.round(H * 0.085));
    logo(ctx, W * 0.29, H * 0.66, H * 0.19, tagline);
  } else {
    fan(ctx, W / 2, H * 0.3, Math.round(Math.min(W * 0.16, H * 0.1)));
    logo(ctx, W / 2, H * 0.64, Math.min(W * 0.32, H * 0.22), tagline);
  }
}
