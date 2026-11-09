import { drawFelt } from './background';
import { GARDEN_TILES } from './gardenTiles';
import { TileSprites, tileMetrics } from './sprites';
import { CLASSIC, CONTRAST } from './tileArt';

export type SheetKind = 'garden' | 'classic' | 'contrast';

/** The full tile set on the felt (art sheet / documentation). Garden pictures are labelled with their names. */
export function renderTileSheet(canvas: HTMLCanvasElement, W: number, H: number, kind: SheetKind = 'garden') {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawFelt(ctx, W, H);
  const garden = kind === 'garden';
  const title = garden ? 'Mahjong Jade Garden — Garden tile set (38 pictures)' : kind === 'classic' ? 'Mahjong Jade Garden — Classic tile set' : 'Classic tile set — colorblind-friendly suits';
  ctx.fillStyle = '#fff6dc';
  ctx.font = `600 ${Math.round(W / 42)}px Lora, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, W / 30);
  const rows: number[][] = garden
    ? [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20, 21, 22, 23],
        [24, 25, 26, 27, 28, 29, 30],
        [31, 32, 33, 34, 35, 36, 37],
      ]
    : [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [9, 10, 11, 12, 13, 14, 15, 16, 17],
        [18, 19, 20, 21, 22, 23, 24, 25, 26],
        [27, 28, 29, 30, 31, 32, 33],
        [34, 35, 36, 37],
      ];
  const perRow = Math.max(...rows.map((r) => r.length));
  const label = garden ? 0.3 : 0;
  const tw = Math.floor(Math.min((W * 0.9) / perRow / 1.14, (H * 0.84) / rows.length / (1.42 + label)));
  const m = tileMetrics(tw);
  const sp = new TileSprites(m, dpr, { set: garden ? 'garden' : 'classic', palette: kind === 'contrast' ? CONTRAST : CLASSIC, indices: kind === 'contrast', windLetters: ['E', 'S', 'W', 'N'] });
  const gapX = tw * 0.14;
  const rowH = m.h + m.d + tw * (0.12 + label);
  const top = W / 30 + tw * 0.4;
  ctx.font = `600 ${Math.max(11, Math.round(tw * 0.17))}px "Source Sans 3", Arial, sans-serif`;
  rows.forEach((row, r) => {
    const total = row.length * (m.w + m.d + gapX) - gapX;
    let x = (W - total) / 2;
    for (const f of row) {
      const y = top + r * rowH;
      sp.draw(ctx, f, x, y);
      if (garden) {
        ctx.fillStyle = '#fff6dc';
        ctx.fillText(GARDEN_TILES[f].name, x + m.w / 2, y + m.h + m.d + tw * 0.22);
      }
      x += m.w + m.d + gapX;
    }
  });
}
