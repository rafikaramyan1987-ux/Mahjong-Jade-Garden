import { FACE_COUNT } from '../game/tiles';
import { TileSprites, tileMetrics } from './sprites';
import { CLASSIC, CONTRAST } from './tileArt';

/** The full tile set on felt (art sheet / documentation), 9 tiles per row. */
export function renderTileSheet(canvas: HTMLCanvasElement, W: number, H: number, contrast = false, title = 'Mahjong Jade Garden — tile set') {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#1f5c45');
  g.addColorStop(1, '#0b2a1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f3e7c4';
  ctx.font = `600 ${Math.round(W / 40)}px Lora, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, W / 28);
  const rows: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, 31, 32, 33],
    [34, 35, 36, 37, 38, 39, 40, 41],
  ];
  const tw = Math.floor(Math.min((W * 0.86) / 9 / 1.12, (H * 0.8) / 5 / 1.42));
  const m = tileMetrics(tw);
  const sp = new TileSprites(m, dpr, { palette: contrast ? CONTRAST : CLASSIC, indices: contrast, windLetters: ['E', 'S', 'W', 'N'] });
  const gapX = tw * 0.12;
  const gapY = tw * 0.12;
  const top = W / 28 + tw * 0.5;
  rows.forEach((row, r) => {
    const total = row.length * (m.w + m.d + gapX) - gapX;
    let x = (W - total) / 2;
    for (const f of row) {
      sp.draw(ctx, f, x, top + r * (m.h + m.d + gapY));
      x += m.w + m.d + gapX;
    }
  });
  void FACE_COUNT;
}
