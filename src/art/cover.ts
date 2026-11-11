/**
 * Title / cover art in the game's look: the Jade Garden in full spring bloom behind a fan of glossy tiles, sparkles
 * and blossom petals, and the inked "Mahjong Jade Garden" logo of the main menu. Optionally keeps the top-left corner
 * free (CrazyGames puts its label there).
 */
import { blossomShape } from './decor';
import { drawGarden } from './garden';
import { TileSprites, tileMetrics } from './sprites';
import { CLASSIC } from './tileArt';

type C = CanvasRenderingContext2D;
const INK = '#163326';

function logo(ctx: C, cx: number, cy: number, s: number, tagline: string | null) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // MAHJONG, letter-spaced, gold with an ink edge
  ctx.font = `700 ${Math.round(s * 0.21)}px Lora, Georgia, serif`;
  const word = 'MAHJONG';
  const sp = s * 0.09;
  const widths = [...word].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (word.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  [...word].forEach((c, i) => {
    ctx.lineWidth = s * 0.035;
    ctx.strokeStyle = INK;
    ctx.strokeText(c, x, cy - s * 0.66);
    ctx.fillStyle = '#f2cf6a';
    ctx.fillText(c, x, cy - s * 0.66);
    x += widths[i] + sp;
  });
  // Jade Garden: ivory with a bold ink outline and a hard ink drop, like the tiles' pictures
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(s * 0.66)}px Lora, Georgia, serif`;
  ctx.fillStyle = INK;
  ctx.fillText('Jade Garden', cx, cy + s * 0.06);
  ctx.lineWidth = s * 0.06;
  ctx.strokeStyle = INK;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.16;
  ctx.strokeText('Jade Garden', cx, cy);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, cy - s * 0.5, 0, cy + s * 0.05);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#fff6dc');
  g.addColorStop(1, '#efd9a2');
  ctx.fillStyle = g;
  ctx.fillText('Jade Garden', cx, cy);
  // gloss on the upper half of the letters
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - s * 3, cy - s * 0.6, s * 6, s * 0.3);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('Jade Garden', cx, cy);
  ctx.restore();
  if (tagline) {
    ctx.font = `700 ${Math.round(s * 0.14)}px "Source Sans 3", Arial, sans-serif`;
    ctx.lineWidth = s * 0.04;
    ctx.strokeStyle = 'rgba(14, 46, 33, 0.85)';
    ctx.strokeText(tagline, cx, cy + s * 0.34);
    ctx.fillStyle = '#fff3d6';
    ctx.fillText(tagline, cx, cy + s * 0.34);
  }
  ctx.restore();
}

/** a fan of glossy tiles (the middle one raised, as if just picked), with a warm glow behind */
function fan(ctx: C, cx: number, cy: number, tw: number, n = 5) {
  const m = tileMetrics(tw);
  const sp = new TileSprites(m, Math.min(3, window.devicePixelRatio || 1) * 1.5, { set: 'garden', palette: CLASSIC, indices: false, windLetters: ['E', 'S', 'W', 'N'] });
  const glow = ctx.createRadialGradient(cx, cy, tw * 0.3, cx, cy, tw * 2.6);
  glow.addColorStop(0, 'rgba(255, 244, 196, 0.85)');
  glow.addColorStop(0.5, 'rgba(255, 220, 120, 0.28)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - tw * 3, cy - tw * 3, tw * 6, tw * 6);
  const faces = n === 5 ? [6, 0, 2, 1, 7] : [0, 2, 1];
  const mid = (faces.length - 1) / 2;
  faces.forEach((f, i) => {
    const k = i - mid;
    ctx.save();
    ctx.translate(cx + k * tw * 0.98, cy + Math.abs(k) * m.h * 0.12 - (k === 0 ? m.h * 0.1 : 0));
    ctx.rotate(k * 0.13);
    ctx.shadowColor = 'rgba(10, 40, 28, 0.4)';
    ctx.shadowBlur = tw * 0.25;
    ctx.shadowOffsetY = tw * 0.08;
    sp.draw(ctx, f, -m.w / 2, -m.h / 2);
    ctx.restore();
  });
}

/** star sparkles and blossom petals around a point */
function sparkle(ctx: C, cx: number, cy: number, r: number, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 16; k++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (0.75 + rnd() * 0.55);
    const x = cx + Math.cos(a) * d * 1.5;
    const y = cy + Math.sin(a) * d * 0.8;
    if (k % 2) blossomShape(ctx, x, y, r * (0.035 + rnd() * 0.03), k % 4 === 1 ? '#f6b6c6' : '#fde5ec', 1);
    else {
      const rr = r * (0.03 + rnd() * 0.035);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#fff6c4';
      ctx.shadowColor = 'rgba(255, 215, 100, 0.95)';
      ctx.shadowBlur = rr * 3;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const an = (j / 8) * Math.PI * 2;
        const rad = j % 2 ? rr * 0.35 : rr * 1.7;
        ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

/** darken the scene softly behind the logo and tiles so they read well */
function vignette(ctx: C, cx: number, cy: number, rx: number, ry: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(10, 46, 32, 0.55)');
  g.addColorStop(0.6, 'rgba(10, 46, 32, 0.3)');
  g.addColorStop(1, 'rgba(10, 46, 32, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export interface CoverOptions {
  /** keep the top-left corner free of logo and tiles (CrazyGames puts its label there) */
  clearTopLeft?: boolean;
  /** the garden and the tiles only: no title, no tagline (portals that want images without text or logo) */
  noLogo?: boolean;
}

export function renderCover(canvas: HTMLCanvasElement, W: number, H: number, tagline: string | null = 'Classic tile solitaire in a blooming garden', o: CoverOptions = {}) {
  void o;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawGarden(ctx, 0, 0, W, H, { season: 0, restored: 16 });
  if (o.noLogo) {
    // no text: the fan of tiles in the middle of the garden, a little larger
    vignette(ctx, W / 2, H * 0.52, W * 0.6, H * 0.55);
    const tw = Math.round(Math.min(W * 0.17, H * 0.22));
    sparkle(ctx, W / 2, H * 0.48, Math.min(W * 0.42, H * 0.55));
    fan(ctx, W / 2, H * 0.5, tw);
    return;
  }
  const tiny = H < 200;
  const wide = !tiny && W / H > 1.45;
  const tall = H / W >= 1.2;
  // every layout keeps the logo and the tiles out of the top-left quarter
  if (tiny) {
    // small thumbnails: three tiles over a compact logo
    vignette(ctx, W / 2, H * 0.55, W * 0.6, H * 0.7);
    fan(ctx, W / 2, H * 0.3, Math.round(H * 0.2), 3);
    logo(ctx, W / 2, H * 0.84, Math.min(W * 0.2, H * 0.27), null);
  } else if (wide) {
    vignette(ctx, W * 0.5, H * 0.56, W * 0.42, H * 0.55);
    const tw = Math.round(H * 0.15);
    sparkle(ctx, W * 0.5, H * 0.36, H * 0.3);
    fan(ctx, W * 0.5, H * 0.38, tw);
    logo(ctx, W * 0.5, H * 0.76, Math.min(H * 0.2, W * 0.12), tagline);
  } else if (tall) {
    vignette(ctx, W / 2, H * 0.52, W * 0.75, H * 0.42);
    const tw = Math.round(Math.min(W * 0.17, H * 0.12));
    sparkle(ctx, W / 2, H * 0.4, W * 0.42);
    fan(ctx, W / 2, H * 0.42, tw);
    logo(ctx, W / 2, H * 0.66, Math.min(W * 0.2, H * 0.14), tagline);
  } else {
    vignette(ctx, W / 2, H * 0.58, W * 0.62, H * 0.5);
    const tw = Math.round(Math.min(W * 0.16, H * 0.15));
    sparkle(ctx, W / 2, H * 0.42, W * 0.36);
    fan(ctx, W / 2, H * 0.44, tw);
    logo(ctx, W / 2, H * 0.78, Math.min(W * 0.18, H * 0.18), tagline);
  }
}
