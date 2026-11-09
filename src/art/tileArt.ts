/**
 * Original artwork for the 42 tile faces and the ivory tile body, drawn with canvas paths.
 * Face art is drawn in a 100 x 134 unit box (the face of an upright tile).
 * The Chinese characters come from a tiny subset of Noto Serif TC (SIL OFL, see CREDITS.md).
 */
import { BAMBOO, CHARS, DOTS, DRAGONS, FLOWERS, WINDS, rankOf, suitOf } from '../game/tiles';
import cjkUrl from '../assets/cjk-subset.woff2';
import { drawGardenFace } from './gardenTiles';

export const FACE_W = 100;
export const FACE_H = 134;
export const HAN_FONT = 'MJG Han';

let fontReady: Promise<void> | null = null;
/** Load the embedded CJK subset font (data URL, no network). Never rejects. */
export function loadTileFont(): Promise<void> {
  if (!fontReady)
    fontReady = (async () => {
      try {
        const f = new FontFace(HAN_FONT, `url(${cjkUrl})`, { weight: '700' });
        await f.load();
        document.fonts.add(f);
      } catch {
        /* the serif fallback still shows something readable */
      }
    })();
  return fontReady;
}

export interface Palette {
  red: string;
  green: string;
  blue: string;
  ink: string;
  gold: string;
  pink: string;
  brown: string;
}

export const CLASSIC: Palette = {
  red: '#b3232b',
  green: '#1c6b45',
  blue: '#1f3f8c',
  ink: '#1c2233',
  gold: '#b98a2a',
  pink: '#d9607a',
  brown: '#6b4630',
};

/** colorblind-friendly suits (Okabe-Ito based): no red/green pairs, plus corner indices on every tile */
export const CONTRAST: Palette = {
  red: '#c75400',
  green: '#0063a8',
  blue: '#1a1a1a',
  ink: '#111111',
  gold: '#a8740a',
  pink: '#c75400',
  brown: '#4a3528',
};

export interface FaceOptions {
  /** 'garden': illustrated pictures (default); 'classic': traditional Mahjong faces */
  set: 'garden' | 'classic';
  palette: Palette;
  /** small rank / wind letter in the top-left corner */
  indices: boolean;
  /** wind letters by language: E S W N or E S O N */
  windLetters: readonly string[];
}

type C = CanvasRenderingContext2D;

function han(ctx: C, ch: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.font = `700 ${size}px "${HAN_FONT}", "Noto Serif TC", "Songti TC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(ch, x, y);
  ctx.restore();
}

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, v + (amt > 0 ? (255 - v) * amt : v * amt))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------- dots (circles)

function coin(ctx: C, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, lighten(color, 0.25));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf5e6';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf5e6';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bigCoin(ctx: C, p: Palette) {
  const x = 50;
  const y = 67;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = p.green;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf5e6';
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.fill();
  // scalloped ring
  ctx.fillStyle = p.red;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 26, Math.sin(a) * 26, 6.2, 3.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.blue;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf5e6';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 5, 2.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.red;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDots(ctx: C, n: number, p: Palette) {
  const B = p.blue,
    G = p.green,
    R = p.red;
  const L: [number, number, string][] = [];
  const r = n <= 2 ? 21 : n <= 5 ? 18 : n <= 6 ? 16 : n === 7 ? 13.5 : 14;
  switch (n) {
    case 1:
      bigCoin(ctx, p);
      return;
    case 2:
      L.push([50, 38, G], [50, 96, B]);
      break;
    case 3:
      L.push([24, 30, B], [50, 67, R], [76, 104, G]);
      break;
    case 4:
      L.push([28, 38, B], [72, 38, G], [28, 96, G], [72, 96, B]);
      break;
    case 5:
      L.push([26, 32, B], [74, 32, G], [50, 67, R], [26, 102, G], [74, 102, B]);
      break;
    case 6:
      L.push([30, 26, G], [70, 26, G], [30, 70, R], [70, 70, R], [30, 108, R], [70, 108, R]);
      break;
    case 7:
      L.push([22, 20, G], [50, 33, G], [78, 46, G], [32, 78, R], [68, 78, R], [32, 112, R], [68, 112, R]);
      break;
    case 8:
      for (let i = 0; i < 4; i++) L.push([29, 20 + i * 31, B], [71, 20 + i * 31, B]);
      break;
    case 9:
      for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) L.push([19 + c * 31, 25 + row * 42, [B, R, G][row]]);
      break;
  }
  for (const [x, y, col] of L) coin(ctx, x, y, r, col);
}

// ---------------------------------------------------------------- bamboo

function stick(ctx: C, x: number, y: number, len: number, color: string, angle = 0, w = 12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const h = len / 2;
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, lighten(color, -0.15));
  grad.addColorStop(0.45, lighten(color, 0.32));
  grad.addColorStop(1, lighten(color, -0.25));
  ctx.fillStyle = grad;
  // two segments that narrow toward the middle node
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h);
  ctx.lineTo(w / 2, -h);
  ctx.quadraticCurveTo(w * 0.32, -h / 2, w * 0.38, 0);
  ctx.quadraticCurveTo(w * 0.32, h / 2, w / 2, h);
  ctx.lineTo(-w / 2, h);
  ctx.quadraticCurveTo(-w * 0.32, h / 2, -w * 0.38, 0);
  ctx.quadraticCurveTo(-w * 0.32, -h / 2, -w / 2, -h);
  ctx.closePath();
  ctx.fill();
  // nodes
  ctx.fillStyle = lighten(color, -0.35);
  for (const ny of [-h, 0, h]) {
    ctx.beginPath();
    ctx.ellipse(0, ny, w * 0.62, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.12, -h + 3);
  ctx.lineTo(-w * 0.12, -3);
  ctx.moveTo(-w * 0.12, 3);
  ctx.lineTo(-w * 0.12, h - 3);
  ctx.stroke();
  ctx.restore();
}

function leaf(ctx: C, x: number, y: number, len: number, angle: number, color: string, width = 0.22) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * width, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * width, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

function blossom(ctx: C, x: number, y: number, r: number, color: string, center = '#e9b949') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = lighten(color, 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = center;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function bambooOne(ctx: C, p: Palette) {
  // a young bamboo shoot with leaves and a plum blossom at its tip (our own motif for the 1 of bamboo)
  stick(ctx, 50, 50, 34, p.green, 0, 12);
  stick(ctx, 50, 88, 34, p.green, 0, 12);
  leaf(ctx, 50, 52, 36, -0.55, p.green);
  leaf(ctx, 50, 54, 32, Math.PI + 0.6, lighten(p.green, -0.1));
  leaf(ctx, 50, 88, 30, -0.25, lighten(p.green, 0.12));
  leaf(ctx, 50, 92, 28, Math.PI + 0.3, p.green);
  ctx.strokeStyle = p.brown;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(50, 33);
  ctx.quadraticCurveTo(54, 22, 62, 18);
  ctx.stroke();
  blossom(ctx, 63, 19, 12, p.red);
  blossom(ctx, 38, 24, 7, p.red);
}

function drawBamboo(ctx: C, n: number, p: Palette) {
  const G = p.green,
    R = p.red,
    B = p.blue;
  const S: [number, number, number, string, number?][] = [];
  switch (n) {
    case 1:
      bambooOne(ctx, p);
      return;
    case 2:
      S.push([50, 37, 50, G], [50, 97, 50, B]);
      break;
    case 3:
      S.push([50, 37, 50, B], [30, 97, 50, G], [70, 97, 50, G]);
      break;
    case 4:
      S.push([30, 37, 50, B], [70, 37, 50, G], [30, 97, 50, G], [70, 97, 50, B]);
      break;
    case 5:
      S.push([22, 37, 50, G], [78, 37, 50, B], [50, 67, 50, R], [22, 97, 50, B], [78, 97, 50, G]);
      break;
    case 6:
      for (let c = 0; c < 3; c++) S.push([20 + c * 30, 37, 50, G], [20 + c * 30, 97, 50, B]);
      break;
    case 7:
      S.push([50, 21, 32, R]);
      for (let c = 0; c < 3; c++) S.push([20 + c * 30, 66, 34, G], [20 + c * 30, 109, 34, B]);
      break;
    case 8:
      // two rows of four with the inner sticks leaning into a V and an inverted V
      S.push([18, 38, 44, G], [82, 38, 44, G], [39, 38, 46, G, 0.32], [61, 38, 46, G, -0.32]);
      S.push([18, 96, 44, B], [82, 96, 44, B], [39, 96, 46, B, -0.32], [61, 96, 46, B, 0.32]);
      break;
    case 9:
      for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) S.push([20 + c * 30, 24 + row * 43, 37, c === 1 ? R : [G, B, G][row]]);
      break;
  }
  for (const [x, y, l, col, a] of S) stick(ctx, x, y, l, col, a ?? 0, n === 8 ? 10 : 12);
}

// ---------------------------------------------------------------- characters, winds, dragons

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND_CHARS = ['東', '南', '西', '北'];

function drawChars(ctx: C, n: number, p: Palette) {
  han(ctx, NUMERALS[n - 1], 50, 36, 56, p.ink);
  han(ctx, '萬', 50, 96, 58, p.red);
}

function drawWind(ctx: C, n: number, p: Palette) {
  han(ctx, WIND_CHARS[n - 1], 50, 70, 76, p.ink);
}

function drawDragon(ctx: C, n: number, p: Palette) {
  if (n === 1) han(ctx, '中', 50, 70, 84, p.red);
  else if (n === 2) han(ctx, '發', 50, 70, 80, p.green);
  else {
    // white dragon: an empty double frame
    ctx.save();
    ctx.strokeStyle = p.blue;
    ctx.lineJoin = 'miter';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 22, 64, 90);
    ctx.lineWidth = 1.8;
    ctx.strokeRect(27, 31, 46, 72);
    ctx.fillStyle = p.blue;
    for (const [x, y] of [
      [18, 22],
      [82, 22],
      [18, 112],
      [82, 112],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- flowers

function branch(ctx: C, pts: number[], color: string, w = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  ctx.stroke();
  ctx.restore();
}

function plum(ctx: C, p: Palette) {
  branch(ctx, [18, 104, 30, 70, 50, 62, 70, 54, 82, 26], p.brown, 3.6);
  branch(ctx, [44, 64, 36, 50, 30, 36], p.brown, 2.2);
  blossom(ctx, 30, 34, 11, p.red);
  blossom(ctx, 82, 26, 10, p.red);
  blossom(ctx, 60, 58, 12, p.red);
  blossom(ctx, 28, 82, 9, p.red);
  ctx.fillStyle = p.red;
  for (const [x, y] of [
    [72, 44],
    [44, 50],
    [22, 96],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function orchid(ctx: C, p: Palette) {
  ctx.save();
  ctx.strokeStyle = p.green;
  ctx.lineCap = 'round';
  const blades: number[][] = [
    [50, 104, 30, 70, 14, 30],
    [50, 104, 60, 60, 86, 34],
    [50, 104, 40, 76, 44, 22],
    [50, 104, 72, 86, 90, 78],
  ];
  blades.forEach((b, i) => {
    ctx.lineWidth = 3.4 - i * 0.4;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.quadraticCurveTo(b[2], b[3], b[4], b[5]);
    ctx.stroke();
  });
  ctx.restore();
  const petal = (x: number, y: number, a: number, len: number, col: string) => leaf(ctx, x, y, len, a, col, 0.38);
  const purple = p === CONTRAST ? p.green : '#7a3f8c';
  for (const [x, y] of [
    [58, 44],
    [30, 56],
  ]) {
    for (let k = 0; k < 5; k++) petal(x, y, -Math.PI / 2 + (k - 2) * 0.75, 14, purple);
    ctx.fillStyle = p.gold;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function chrysanthemum(ctx: C, p: Palette) {
  const gold = p === CONTRAST ? p.red : '#d08a1c';
  leaf(ctx, 50, 96, 30, -0.6, p.green, 0.3);
  leaf(ctx, 50, 98, 28, Math.PI + 0.5, p.green, 0.3);
  branch(ctx, [50, 112, 50, 90, 50, 60], p.green, 2.6);
  ctx.save();
  ctx.translate(50, 50);
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 14 : 20;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.12;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = ring ? lighten(gold, 0.25) : gold;
      ctx.beginPath();
      ctx.ellipse(ring ? 9 : 17, 0, ring ? 8 : 12, ring ? 2.4 : 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = lighten(gold, -0.3);
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function summer(ctx: C, p: Palette) {
  const pink = p === CONTRAST ? p.red : p.pink;
  // lotus pad
  ctx.fillStyle = p.green;
  ctx.beginPath();
  ctx.ellipse(50, 100, 36, 11, 0, 0.15, Math.PI * 2 - 0.15);
  ctx.lineTo(50, 100);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(50, 100);
    const a = (k / 6) * Math.PI * 2 + 0.4;
    ctx.lineTo(50 + Math.cos(a) * 32, 100 + Math.sin(a) * 9.5);
    ctx.stroke();
  }
  branch(ctx, [50, 96, 52, 80, 50, 70], p.green, 2.6);
  // flower
  const petals: [number, number][] = [
    [-0.9, 30],
    [0.9, 30],
    [-0.45, 36],
    [0.45, 36],
    [0, 40],
  ];
  for (const [a, len] of petals) {
    ctx.save();
    ctx.translate(50, 72);
    ctx.rotate(a - Math.PI / 2);
    const gr = ctx.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, lighten(pink, 0.6));
    gr.addColorStop(1, pink);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.55, -len * 0.33, len, 0);
    ctx.quadraticCurveTo(len * 0.55, len * 0.33, 0, 0);
    ctx.fill();
    ctx.restore();
  }
}

function drawBonus(ctx: C, face: number, p: Palette) {
  const n = rankOf(face);
  ctx.save();
  ctx.translate(50, 67);
  ctx.scale(1.12, 1.12);
  ctx.translate(-50, -62);
  [plum, orchid, chrysanthemum, summer][n - 1](ctx, p);
  ctx.restore();
}

// ---------------------------------------------------------------- public API

/** draw one face (art only) into the unit box FACE_W x FACE_H at the current transform */
export function drawFaceArt(ctx: C, face: number, o: FaceOptions) {
  if (o.set === 'garden') return drawGardenFace(ctx, face);
  const p = o.palette;
  const suit = suitOf(face);
  const n = rankOf(face);
  ctx.save();
  if (o.indices && suit !== 'flower') {
    // shrink the art a little toward the bottom-right to make room for the index
    ctx.translate(58, 72);
    ctx.scale(0.84, 0.84);
    ctx.translate(-50, -67);
  }
  switch (suit) {
    case 'dots':
      drawDots(ctx, face - DOTS + 1, p);
      break;
    case 'bamboo':
      drawBamboo(ctx, face - BAMBOO + 1, p);
      break;
    case 'chars':
      drawChars(ctx, face - CHARS + 1, p);
      break;
    case 'wind':
      drawWind(ctx, face - WINDS + 1, p);
      break;
    case 'dragon':
      drawDragon(ctx, face - DRAGONS + 1, p);
      break;
    default:
      drawBonus(ctx, face, p);
  }
  ctx.restore();
  if (o.indices && face < FLOWERS) {
    let label = String(n);
    if (suit === 'wind') label = o.windLetters[n - 1];
    if (suit === 'dragon') label = ['R', 'G', 'W'][n - 1];
    ctx.save();
    ctx.font = '700 25px "Source Sans 3", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = suit === 'dots' ? p.blue : suit === 'bamboo' ? p.green : suit === 'chars' ? p.red : p.ink;
    ctx.fillText(label, 6, 4);
    ctx.restore();
  } else if (suit === 'wind') {
    // wind letter always shown small (helps players who do not read the characters)
    ctx.save();
    ctx.font = '700 20px "Source Sans 3", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = p.red;
    ctx.fillText(o.windLetters[n - 1], 7, 5);
    ctx.restore();
  }
}

export interface TileMetrics {
  /** face size in px */
  w: number;
  h: number;
  /** tile thickness in px (side band to the right and below) */
  d: number;
  /** corner radius */
  r: number;
}

export function roundRect(ctx: C, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The tile body at (0,0): soft drop shadow, a jade-green back layer and an ivory layer showing as the thickness
 * to the right and below, then the ivory face. Drawn into a sprite with `pad` px of room for the shadow.
 */
export function drawTileBody(ctx: C, m: TileMetrics, pad: number) {
  const { w, h, d, r } = m;
  ctx.save();
  ctx.translate(pad, pad);
  // soft shadow on the felt / the layer below
  ctx.save();
  ctx.shadowColor = 'rgba(8, 50, 30, 0.32)';
  ctx.shadowBlur = d * 2.2;
  ctx.shadowOffsetX = d * 0.7;
  ctx.shadowOffsetY = d * 1.0;
  ctx.fillStyle = '#1d6e4c';
  roundRect(ctx, d, d, w, h, r);
  ctx.fill();
  ctx.restore();
  // thick jade back: the coloured side that makes every layer easy to see
  const back = ctx.createLinearGradient(d, d, w + d, h + d);
  back.addColorStop(0, '#3ccf8e');
  back.addColorStop(0.5, '#1fae6c');
  back.addColorStop(1, '#0f8550');
  ctx.fillStyle = back;
  roundRect(ctx, d, d, w, h, r);
  ctx.fill();
  // a light rim along the jade edge
  ctx.strokeStyle = 'rgba(190, 255, 220, 0.55)';
  ctx.lineWidth = Math.max(1, d * 0.14);
  roundRect(ctx, d * 0.98, d * 0.98, w, h, r);
  ctx.stroke();
  // ivory slab between face and jade back
  const slab = ctx.createLinearGradient(0, 0, w, h);
  slab.addColorStop(0, '#fbf3df');
  slab.addColorStop(1, '#e6d6b2');
  ctx.fillStyle = slab;
  roundRect(ctx, d * 0.42, d * 0.42, w, h, r);
  ctx.fill();
  // glossy ivory face
  const face = ctx.createLinearGradient(0, 0, w * 0.55, h);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(0.6, '#fffbf1');
  face.addColorStop(1, '#f7eedb');
  ctx.fillStyle = face;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 92, 45, 0.35)';
  ctx.lineWidth = Math.max(1, w * 0.014);
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();
  // bright bevel on the top and left edges
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(1.2, w * 0.035);
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h * 0.85);
  ctx.lineTo(w * 0.04, r);
  ctx.quadraticCurveTo(w * 0.04, w * 0.04, r, w * 0.04);
  ctx.lineTo(w * 0.85, w * 0.04);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/**
 * Glare drawn over the face AND its picture: a soft light reflection from the top-left, so the whole tile looks
 * polished and glossy.
 */
export function drawTileGlare(ctx: C, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w * 0.75, h * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.36, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.quadraticCurveTo(w * 0.55, h * 0.28, 0, h * 0.62);
  ctx.closePath();
  ctx.fill();
  // a small specular spot
  const s = ctx.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, w * 0.22);
  s.addColorStop(0, 'rgba(255,255,255,0.7)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** face art placed onto a tile face of size w x h (inset a little from the edge) */
export function drawFaceOnTile(ctx: C, face: number, w: number, h: number, o: FaceOptions) {
  if (o.set === 'garden') return drawGlossyPicture(ctx, face, w, h);
  ctx.save();
  const ix = w * 0.06;
  const iy = h * 0.05;
  ctx.translate(ix, iy);
  ctx.scale((w - ix * 2) / FACE_W, (h - iy * 2) / FACE_H);
  drawFaceArt(ctx, face, o);
  ctx.restore();
}

/**
 * A Garden picture finished like premium game art: drawn large (about 80% of the face), colours boosted, a thick
 * dark outer outline, a soft shadow under it, soft shading and a glossy highlight across the picture.
 */
export function drawGlossyPicture(ctx: C, face: number, w: number, h: number) {
  const scale = Math.abs(ctx.getTransform().a) || 1;
  const pw = Math.ceil(w * scale);
  const ph = Math.ceil(h * scale);
  const pic = document.createElement('canvas');
  pic.width = pw;
  pic.height = ph;
  const p = pic.getContext('2d')!;
  // the picture fills about 80% of the face
  const ix = w * 0.04;
  const iy = h * 0.035;
  p.scale(scale, scale);
  p.translate(ix, iy);
  p.scale((w - ix * 2) / FACE_W, (h - iy * 2) / FACE_H);
  drawGardenFace(p, face);
  p.setTransform(1, 0, 0, 1, 0, 0);
  // soft light from the top-left, a little shade at the bottom-right (only on the picture's own pixels)
  p.globalCompositeOperation = 'source-atop';
  const sh = p.createLinearGradient(0, 0, pw, ph);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(40,10,0,0.22)');
  p.fillStyle = sh;
  p.fillRect(0, 0, pw, ph);
  // glossy highlight band over the upper part of the picture
  const gl = p.createLinearGradient(0, ph * 0.08, 0, ph * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.6)');
  gl.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  p.fillStyle = gl;
  p.beginPath();
  p.ellipse(pw * 0.44, ph * 0.22, pw * 0.5, ph * 0.27, -0.25, 0, Math.PI * 2);
  p.fill();
  // small specular sparkles
  for (const [sx, sy, sr] of [
    [0.3, 0.2, 0.06],
    [0.66, 0.44, 0.035],
  ]) {
    const sp = p.createRadialGradient(pw * sx, ph * sy, 0, pw * sx, ph * sy, pw * sr);
    sp.addColorStop(0, 'rgba(255,255,255,0.85)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    p.fillStyle = sp;
    p.fillRect(0, 0, pw, ph);
  }
  p.globalCompositeOperation = 'source-over';

  ctx.save();
  // soft drop shadow under the picture
  ctx.shadowColor = 'rgba(60, 30, 10, 0.28)';
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetX = w * 0.012;
  ctx.shadowOffsetY = w * 0.025;
  // thick outer outline: the silhouette stamped around in dark ink
  const o = Math.max(0.8, w * 0.012);
  const ink = document.createElement('canvas');
  ink.width = pw;
  ink.height = ph;
  const ic = ink.getContext('2d')!;
  ic.drawImage(pic, 0, 0);
  ic.globalCompositeOperation = 'source-in';
  ic.fillStyle = '#2e1f17';
  ic.fillRect(0, 0, pw, ph);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.drawImage(ink, Math.cos(a) * o, Math.sin(a) * o, w, h);
    if (k === 0) ctx.shadowColor = 'transparent';
  }
  ctx.restore();
  ctx.save();
  // vivid colours
  ctx.filter = 'saturate(1.38) contrast(1.08)';
  ctx.drawImage(pic, 0, 0, w, h);
  ctx.restore();
}
