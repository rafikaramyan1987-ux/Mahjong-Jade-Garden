import { FACE_COUNT } from '../game/tiles';
import { LAYER_SHIFT, TILE_ASPECT, TILE_DEPTH } from '../layouts/build';
import { drawFaceOnTile, drawTileBody, drawTileGlare, type FaceOptions, type TileMetrics } from './tileArt';

export function tileMetrics(w: number): TileMetrics {
  const h = Math.round(w * TILE_ASPECT);
  return { w, h, d: Math.max(2, Math.round(w * TILE_DEPTH)), r: Math.max(2, w * 0.12) };
}

/** shift of each layer up and to the left (px) */
export const layerShift = (w: number) => Math.max(2, Math.round(w * LAYER_SHIFT));

/** Cached tile body + face sprites at one size and pixel ratio. */
export class TileSprites {
  readonly pad: number;
  readonly body: HTMLCanvasElement;
  readonly faces: HTMLCanvasElement[] = [];
  readonly glare: HTMLCanvasElement;
  constructor(
    readonly m: TileMetrics,
    readonly dpr: number,
    readonly opts: FaceOptions,
  ) {
    this.pad = Math.ceil(m.d * 3);
    const bw = Math.ceil((m.w + m.d + this.pad * 2) * dpr);
    const bh = Math.ceil((m.h + m.d + this.pad * 2) * dpr);
    this.body = document.createElement('canvas');
    this.body.width = bw;
    this.body.height = bh;
    const bctx = this.body.getContext('2d')!;
    bctx.scale(dpr, dpr);
    drawTileBody(bctx, m, this.pad);
    this.glare = document.createElement('canvas');
    this.glare.width = Math.ceil(m.w * dpr);
    this.glare.height = Math.ceil(m.h * dpr);
    const gctx = this.glare.getContext('2d')!;
    gctx.scale(dpr, dpr);
    drawTileGlare(gctx, m.w, m.h, m.r);
    for (let f = 0; f < FACE_COUNT; f++) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(m.w * dpr);
      c.height = Math.ceil(m.h * dpr);
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      drawFaceOnTile(ctx, f, m.w, m.h, opts);
      this.faces.push(c);
    }
  }

  /** draw a complete tile with its face top-left at (x, y) in CSS px */
  draw(ctx: CanvasRenderingContext2D, face: number, x: number, y: number) {
    const { w, h, d } = this.m;
    ctx.drawImage(this.body, x - this.pad, y - this.pad, w + d + this.pad * 2, h + d + this.pad * 2);
    if (face >= 0) ctx.drawImage(this.faces[face], x, y, w, h);
    ctx.drawImage(this.glare, x, y, w, h);
  }
}
