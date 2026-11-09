/**
 * The Jade Garden: one garden scene in four seasons. Each cleared board restores one element; elements not yet
 * restored are shown as a faint ink-wash silhouette, so the player always sees what is coming.
 * Drawn in a 1600 x 1000 unit box.
 */
import type { StrKey } from '../app/i18n';
import { blossomShape, drawLantern } from './decor';

type C = CanvasRenderingContext2D;
export type Season = 0 | 1 | 2 | 3;
export const SEASON_KEYS: StrKey[] = ['season.spring', 'season.summer', 'season.autumn', 'season.winter'];
export const GW = 1600;
export const GH = 1000;

interface SeasonLook {
  sky: [string, string];
  ground: [string, string];
  foliage: string[];
  canopy: string[];
  snow: boolean;
  water: [string, string];
}

const LOOKS: SeasonLook[] = [
  { sky: ['#f7e6df', '#e4efe4'], ground: ['#9cc68a', '#5f9a62'], foliage: ['#5c9a54', '#7bb36a'], canopy: ['#f4b9c6', '#eea0b2', '#f9dbe1'], snow: false, water: ['#8fc7c3', '#4f948f'] },
  { sky: ['#e3f0f2', '#f4f1dc'], ground: ['#79b06a', '#3f7d4a'], foliage: ['#3d7f45', '#5a9a52'], canopy: ['#4f9150', '#6aaa5d', '#3d7a43'], snow: false, water: ['#79bcc4', '#3e8590'] },
  { sky: ['#f5e2c4', '#f0d5b5'], ground: ['#c2a35b', '#8a7a3e'], foliage: ['#9c7a2c', '#c08b34'], canopy: ['#d9622b', '#e8913a', '#c0392b'], snow: false, water: ['#93b7b2', '#5a8580'] },
  { sky: ['#e3e9f0', '#f4f6f8'], ground: ['#f2f5f8', '#cfd9e2'], foliage: ['#4b6b5a', '#5d7d6a'], canopy: ['#ffffff', '#e8eef4', '#dbe4ec'], snow: true, water: ['#a9c3d1', '#7898aa'] },
];

export interface GardenElement {
  key: StrKey;
  draw: (ctx: C, L: SeasonLook) => void;
  /** paint order (back to front) */
  z: number;
  /** a point to mark the element (for the "next" marker) */
  at: [number, number];
}

// ---------------------------------------------------------------- helpers

function ellipse(ctx: C, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx: C, pts: number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

/** curved Chinese roof between x0..x1 at eave height y, ridge at y - h */
function roof(ctx: C, cx: number, y: number, half: number, h: number, fill: string, snow: boolean) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx - half - h * 0.5, y - h * 0.35);
  ctx.quadraticCurveTo(cx - half * 0.6, y + h * 0.1, cx - half * 0.35, y - h * 0.55);
  ctx.lineTo(cx - half * 0.25, y - h);
  ctx.lineTo(cx + half * 0.25, y - h);
  ctx.lineTo(cx + half * 0.35, y - h * 0.55);
  ctx.quadraticCurveTo(cx + half * 0.6, y + h * 0.1, cx + half + h * 0.5, y - h * 0.35);
  ctx.quadraticCurveTo(cx + half * 0.5, y - h * 0.1, cx, y - h * 0.15);
  ctx.quadraticCurveTo(cx - half * 0.5, y - h * 0.1, cx - half - h * 0.5, y - h * 0.35);
  ctx.closePath();
  ctx.fill();
  if (snow) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - half * 0.3, y - h * 0.95);
    ctx.lineTo(cx + half * 0.3, y - h * 0.95);
    ctx.lineTo(cx + half * 0.75, y - h * 0.32);
    ctx.quadraticCurveTo(cx, y - h * 0.5, cx - half * 0.75, y - h * 0.32);
    ctx.closePath();
    ctx.fill();
  }
}

function canopy(ctx: C, cx: number, cy: number, r: number, colors: string[], seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    ellipse(ctx, cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.7, r * (0.28 + rnd() * 0.2), r * (0.22 + rnd() * 0.14), colors[k % colors.length]);
  }
}

function trunk(ctx: C, pts: number[], w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  ctx.stroke();
}

// ---------------------------------------------------------------- elements (in restore order)

const stoneLantern: GardenElement = {
  key: 'el.stoneLantern',
  z: 90,
  at: [1250, 700],
  draw(ctx, L) {
    const x = 1250;
    const g = '#9a9a8c';
    const d = '#6f6f64';
    ellipse(ctx, x, 860, 70, 14, 'rgba(0,0,0,0.15)');
    poly(ctx, [x - 46, 860, x + 46, 860, x + 38, 840, x - 38, 840], d);
    poly(ctx, [x - 14, 840, x + 14, 840, x + 12, 760, x - 12, 760], g);
    poly(ctx, [x - 42, 765, x + 42, 765, x + 34, 748, x - 34, 748], d);
    // fire box with a warm light
    poly(ctx, [x - 28, 748, x + 28, 748, x + 28, 700, x - 28, 700], g);
    poly(ctx, [x - 14, 742, x + 14, 742, x + 14, 708, x - 14, 708], '#f6c35c');
    ctx.fillStyle = 'rgba(255, 200, 90, 0.25)';
    ctx.beginPath();
    ctx.arc(x, 725, 46, 0, Math.PI * 2);
    ctx.fill();
    // roof
    poly(ctx, [x - 62, 702, x + 62, 702, x + 26, 668, x - 26, 668], d);
    poly(ctx, [x - 8, 668, x + 8, 668, x + 6, 650, x - 6, 650], g);
    ellipse(ctx, x, 648, 9, 9, d);
    if (L.snow) {
      ellipse(ctx, x, 676, 46, 9, '#ffffff');
      ellipse(ctx, x, 750, 36, 5, '#ffffff');
    }
  },
};

const path: GardenElement = {
  key: 'el.path',
  z: 70,
  at: [820, 900],
  draw(ctx, L) {
    const stones: [number, number, number][] = [
      [760, 980, 46],
      [840, 935, 40],
      [790, 893, 36],
      [860, 858, 32],
      [820, 826, 28],
      [880, 800, 24],
    ];
    for (const [x, y, r] of stones) {
      ellipse(ctx, x + 4, y + 5, r, r * 0.42, 'rgba(0,0,0,0.12)');
      ellipse(ctx, x, y, r, r * 0.42, L.snow ? '#c9d2da' : '#b7b09c');
      ellipse(ctx, x - r * 0.2, y - r * 0.1, r * 0.6, r * 0.2, L.snow ? '#ffffff' : '#cfc8b4');
    }
  },
};

const pond: GardenElement = {
  key: 'el.pond',
  z: 50,
  at: [600, 780],
  draw(ctx, L) {
    // stone rim
    ellipse(ctx, 600, 790, 330, 96, L.snow ? '#b9c4ce' : '#8c8775');
    const w = ctx.createLinearGradient(0, 700, 0, 880);
    w.addColorStop(0, L.water[0]);
    w.addColorStop(1, L.water[1]);
    ctx.fillStyle = w;
    ctx.beginPath();
    ctx.ellipse(600, 790, 312, 84, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (const [x, y, r] of [
      [470, 770, 40],
      [700, 812, 60],
      [560, 830, 30],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (L.snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(520, 780, 140, 34, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const bridge: GardenElement = {
  key: 'el.bridge',
  z: 60,
  at: [600, 690],
  draw(ctx, L) {
    const red = '#b8352b';
    ctx.lineCap = 'round';
    // arch deck
    ctx.strokeStyle = '#7d2a20';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(430, 800);
    ctx.quadraticCurveTo(600, 610, 770, 800);
    ctx.stroke();
    // reflection
    ctx.strokeStyle = 'rgba(184, 53, 43, 0.25)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(470, 805);
    ctx.quadraticCurveTo(600, 900, 730, 805);
    ctx.stroke();
    // railing
    ctx.strokeStyle = red;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(440, 768);
    ctx.quadraticCurveTo(600, 590, 760, 768);
    ctx.stroke();
    ctx.lineWidth = 5;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const x = 440 + t * 320;
      const yTop = (1 - t) * (1 - t) * 768 + 2 * (1 - t) * t * 590 + t * t * 768;
      const yDeck = (1 - t) * (1 - t) * 795 + 2 * (1 - t) * t * 612 + t * t * 795;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yDeck);
      ctx.stroke();
    }
    if (L.snow) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(445, 762);
      ctx.quadraticCurveTo(600, 584, 755, 762);
      ctx.stroke();
    }
  },
};

const blossomTree: GardenElement = {
  key: 'el.blossomTree',
  z: 85,
  at: [230, 420],
  draw(ctx, L) {
    trunk(ctx, [250, 900, 230, 760, 260, 620, 280, 520, 220, 420], 34, '#4d3528');
    trunk(ctx, [258, 640, 330, 560, 400, 470], 16, '#4d3528');
    trunk(ctx, [245, 560, 160, 500, 110, 420], 14, '#4d3528');
    canopy(ctx, 250, 420, 150, L.canopy, 11);
    canopy(ctx, 390, 455, 90, L.canopy, 23);
    canopy(ctx, 120, 430, 80, L.canopy, 37);
    if (L === LOOKS[0]) for (let k = 0; k < 14; k++) blossomShape(ctx, 120 + ((k * 97) % 300), 330 + ((k * 61) % 190), 9, k % 2 ? '#f6d0d8' : '#e48aa0');
    if (L.snow) trunk(ctx, [245, 560, 160, 500, 110, 420], 5, '#ffffff');
  },
};

const koi: GardenElement = {
  key: 'el.koi',
  z: 55,
  at: [500, 800],
  draw(ctx) {
    const fish = (x: number, y: number, a: number, body: string, spot: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.scale(1, 0.55);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-40, -11);
      ctx.lineTo(-36, 0);
      ctx.lineTo(-40, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.ellipse(6, -2, 9, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    fish(470, 800, 0.3, '#f2f0ea', '#e2502c');
    fish(540, 770, -2.6, '#ee7b2c', '#fff2e0');
    fish(410, 780, 3.4, '#f6c23c', '#ffffff');
  },
};

const pagoda: GardenElement = {
  key: 'el.pagoda',
  z: 20,
  at: [1330, 330],
  draw(ctx, L) {
    const x = 1330;
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const y = 600 - i * 66;
      const half = 92 - i * 12;
      poly(ctx, [x - half * 0.62, y, x + half * 0.62, y, x + half * 0.62, y - 46, x - half * 0.62, y - 46], '#c4553a');
      ctx.fillStyle = '#e9d2a6';
      ctx.fillRect(x - half * 0.4, y - 34, half * 0.8, 14);
      roof(ctx, x, y - 40, half, 34, '#3a4b46', L.snow);
    }
    // finial
    ctx.fillStyle = '#c9a042';
    ctx.fillRect(x - 3, 220, 6, 52);
    for (let k = 0; k < 4; k++) ellipse(ctx, x, 232 + k * 10, 8, 3, '#c9a042');
    poly(ctx, [x - 70, 610, x + 70, 610, x + 80, 640, x - 80, 640], '#8f8a7a');
  },
};

const bamboo: GardenElement = {
  key: 'el.bamboo',
  z: 30,
  at: [1500, 420],
  draw(ctx, L) {
    const col = L.foliage;
    for (let k = 0; k < 7; k++) {
      const x = 1440 + k * 30;
      ctx.fillStyle = k % 2 ? col[0] : col[1];
      for (let y = 150 + (k % 3) * 30; y < 760; y += 64) {
        ctx.fillRect(x - 7, y, 14, 60);
        ctx.fillRect(x - 9, y + 60, 18, 4);
      }
      for (let j = 0; j < 4; j++) {
        const ly = 200 + ((k * 53 + j * 131) % 420);
        ctx.save();
        ctx.translate(x, ly);
        ctx.rotate((k + j) % 2 ? 0.5 : 2.6);
        ctx.fillStyle = L.snow && j === 0 ? '#ffffff' : col[(k + j) % 2];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(30, -10, 64, 0);
        ctx.quadraticCurveTo(30, 8, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  },
};

const moonGate: GardenElement = {
  key: 'el.moonGate',
  z: 25,
  at: [520, 480],
  draw(ctx, L) {
    const wall = L.snow ? '#eef1f3' : '#efe6d2';
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.rect(330, 400, 400, 230);
    ctx.arc(530, 520, 92, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#9b8a6a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(530, 520, 92, 0, Math.PI * 2);
    ctx.stroke();
    // view through the gate: a hint of green
    ctx.save();
    ctx.beginPath();
    ctx.arc(530, 520, 88, 0, Math.PI * 2);
    ctx.clip();
    ellipse(ctx, 530, 600, 120, 70, L.foliage[1]);
    ctx.restore();
    // tiled wall cap
    poly(ctx, [318, 400, 742, 400, 730, 376, 330, 376], '#3a4b46');
    if (L.snow) poly(ctx, [330, 378, 730, 378, 724, 366, 336, 366], '#ffffff');
  },
};

const pavilion: GardenElement = {
  key: 'el.pavilion',
  z: 35,
  at: [1030, 470],
  draw(ctx, L) {
    const x = 1030;
    poly(ctx, [x - 120, 660, x + 120, 660, x + 108, 636, x - 108, 636], '#8f8a7a');
    ctx.fillStyle = '#b8352b';
    for (const dx of [-90, -30, 30, 90]) ctx.fillRect(x + dx - 7, 520, 14, 118);
    ctx.fillStyle = '#e9d2a6';
    ctx.fillRect(x - 96, 600, 192, 8);
    roof(ctx, x, 528, 120, 70, '#2f4540', L.snow);
    ctx.fillStyle = '#c9a042';
    ellipse(ctx, x, 456, 9, 9, '#c9a042');
  },
};

const lotus: GardenElement = {
  key: 'el.lotus',
  z: 56,
  at: [760, 790],
  draw(ctx, L) {
    const pads: [number, number, number][] = [
      [760, 800, 30],
      [820, 770, 22],
      [700, 830, 24],
      [370, 815, 22],
    ];
    for (const [x, y, r] of pads) {
      ctx.fillStyle = L.snow ? '#a7b9a8' : L === LOOKS[2] ? '#8a8a3c' : '#3f8a4a';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.38, 0, 0.3, Math.PI * 2 - 0.1);
      ctx.lineTo(x, y);
      ctx.fill();
    }
    if (L === LOOKS[3]) return;
    for (const [x, y] of [
      [770, 790],
      [705, 822],
    ]) {
      for (const a of [-0.6, 0.6, -0.25, 0.25, 0]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a - Math.PI / 2);
        ctx.fillStyle = a === 0 ? '#f7c9d4' : '#ec9bb0';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(12, -8, 24, 0);
        ctx.quadraticCurveTo(12, 8, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  },
};

const waterfall: GardenElement = {
  key: 'el.waterfall',
  z: 45,
  at: [860, 640],
  draw(ctx, L) {
    const rock = L.snow ? '#8b98a3' : '#6e6d63';
    const lite = L.snow ? '#ffffff' : '#8f8d80';
    poly(ctx, [760, 760, 790, 620, 850, 580, 920, 600, 960, 700, 940, 770], rock);
    poly(ctx, [800, 640, 850, 590, 900, 606, 870, 640], lite);
    poly(ctx, [920, 760, 950, 690, 1000, 680, 1030, 740, 1010, 775], rock);
    // falling water
    const w = ctx.createLinearGradient(0, 610, 0, 770);
    w.addColorStop(0, 'rgba(235, 248, 250, 0.95)');
    w.addColorStop(1, 'rgba(200, 230, 235, 0.6)');
    ctx.fillStyle = w;
    ctx.beginPath();
    ctx.moveTo(850, 610);
    ctx.quadraticCurveTo(880, 680, 860, 770);
    ctx.lineTo(890, 770);
    ctx.quadraticCurveTo(905, 680, 880, 606);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 875, 772, 40, 9, 'rgba(255,255,255,0.6)');
  },
};

const maple: GardenElement = {
  key: 'el.maple',
  z: 28,
  at: [1170, 330],
  draw(ctx, L) {
    trunk(ctx, [1170, 650, 1160, 520, 1180, 420, 1190, 380, 1230, 330], 20, '#5a3b2b');
    trunk(ctx, [1175, 470, 1120, 420, 1100, 360], 10, '#5a3b2b');
    const cols = L === LOOKS[0] ? ['#7fb35a', '#a3c96a', '#d9775a'] : L === LOOKS[1] ? ['#4c8a3f', '#6aa54f', '#3d7536'] : L === LOOKS[2] ? ['#c0392b', '#e0622d', '#f0a03a'] : ['#ffffff', '#e6edf3', '#cfdbe5'];
    canopy(ctx, 1170, 350, 110, cols, 77);
    canopy(ctx, 1100, 380, 60, cols, 91);
  },
};

const lanterns: GardenElement = {
  key: 'el.lanterns',
  z: 95,
  at: [700, 300],
  draw(ctx) {
    // a cord from the blossom tree to the pavilion, with lanterns
    ctx.strokeStyle = 'rgba(40, 25, 15, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(380, 330);
    ctx.quadraticCurveTo(700, 430, 1010, 330);
    ctx.stroke();
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      const x = (1 - t) * (1 - t) * 380 + 2 * (1 - t) * t * 700 + t * t * 1010;
      const y = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 430 + t * t * 330;
      drawLantern(ctx, x, y, 20, 14, 1);
    }
  },
};

const pine: GardenElement = {
  key: 'el.pine',
  z: 15,
  at: [110, 220],
  draw(ctx, L) {
    trunk(ctx, [90, 700, 70, 520, 110, 400, 150, 300, 100, 180], 26, '#4a3a2c');
    trunk(ctx, [110, 400, 190, 360, 260, 330], 12, '#4a3a2c');
    trunk(ctx, [130, 300, 60, 260, 20, 250], 10, '#4a3a2c');
    const pad = (x: number, y: number, r: number) => {
      ellipse(ctx, x, y, r, r * 0.38, L.snow ? '#3f5e4d' : '#2f5a40');
      ellipse(ctx, x - r * 0.1, y - r * 0.12, r * 0.85, r * 0.22, L.snow ? '#ffffff' : '#3f7352');
    };
    pad(100, 185, 80);
    pad(260, 330, 70);
    pad(30, 252, 52);
    pad(170, 280, 56);
  },
};

const cranes: GardenElement = {
  key: 'el.cranes',
  z: 5,
  at: [900, 180],
  draw(ctx) {
    const crane = (x: number, y: number, s: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 2;
      // wings
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-30, -40, -70, -36);
      ctx.quadraticCurveTo(-40, -14, -10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(30, -46, 64, -50);
      ctx.quadraticCurveTo(40, -16, 10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.moveTo(-70, -36);
      ctx.quadraticCurveTo(-58, -30, -52, -26);
      ctx.lineTo(-60, -38);
      ctx.fill();
      // body, neck, head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(52, -6);
      ctx.stroke();
      ellipse(ctx, 54, -6, 5, 4, '#2b2b2b');
      ellipse(ctx, 55, -9, 2.5, 2, '#d6332a');
      ctx.beginPath();
      ctx.moveTo(-20, 4);
      ctx.lineTo(-56, 12);
      ctx.stroke();
      ctx.restore();
    };
    crane(860, 190, 1);
    crane(1010, 140, 0.75);
  },
};

/** elements in restore order (board 1 restores the first, ...) */
export const ELEMENTS: GardenElement[] = [stoneLantern, path, pond, bridge, blossomTree, koi, pagoda, bamboo, moonGate, pavilion, lotus, waterfall, maple, lanterns, pine, cranes];
export const ELEMENTS_PER_SEASON = ELEMENTS.length;

// ---------------------------------------------------------------- scene

function sky(ctx: C, L: SeasonLook) {
  const g = ctx.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, L.sky[0]);
  g.addColorStop(1, L.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GW, GH);
  // pale sun / moon
  ellipse(ctx, 1420, 140, 54, 54, L.snow ? 'rgba(255,255,255,0.8)' : 'rgba(255, 236, 200, 0.75)');
  // distant ink mountains
  ctx.fillStyle = 'rgba(80, 110, 100, 0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.bezierCurveTo(160, 360, 280, 420, 400, 380);
  ctx.bezierCurveTo(520, 330, 620, 450, 760, 400);
  ctx.bezierCurveTo(900, 340, 1040, 260, 1180, 380);
  ctx.bezierCurveTo(1320, 470, 1460, 360, 1600, 420);
  ctx.lineTo(1600, 640);
  ctx.lineTo(0, 640);
  ctx.fill();
  ctx.fillStyle = 'rgba(80, 110, 100, 0.12)';
  ctx.beginPath();
  ctx.moveTo(0, 600);
  ctx.bezierCurveTo(300, 480, 520, 560, 800, 520);
  ctx.bezierCurveTo(1100, 470, 1300, 560, 1600, 520);
  ctx.lineTo(1600, 660);
  ctx.lineTo(0, 660);
  ctx.fill();
}

function ground(ctx: C, L: SeasonLook) {
  const g = ctx.createLinearGradient(0, 600, 0, GH);
  g.addColorStop(0, L.ground[0]);
  g.addColorStop(1, L.ground[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 650);
  ctx.bezierCurveTo(400, 600, 900, 640, 1600, 610);
  ctx.lineTo(1600, GH);
  ctx.lineTo(0, GH);
  ctx.closePath();
  ctx.fill();
  // mist
  const m = ctx.createLinearGradient(0, 560, 0, 700);
  m.addColorStop(0, 'rgba(255,255,255,0)');
  m.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  m.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 560, GW, 140);
}

function seasonParticles(ctx: C, season: Season) {
  let s = 5 + season;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 40; k++) {
    const x = rnd() * GW;
    const y = rnd() * GH * 0.9;
    if (season === 0) blossomShape(ctx, x, y, 5, k % 2 ? '#f6d0d8' : '#eaa3b5', 0.8);
    else if (season === 1) ellipse(ctx, x, y * 0.6 + 380, 3, 3, 'rgba(255, 245, 170, 0.75)');
    else if (season === 2) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rnd() * 6);
      ellipse(ctx, 0, 0, 8, 4, k % 2 ? '#d9622b' : '#e8a13a');
      ctx.restore();
    } else ellipse(ctx, x, y, 2.5 + rnd() * 2, 2.5 + rnd() * 2, 'rgba(255,255,255,0.9)');
  }
}

export interface GardenView {
  season: Season;
  /** number of elements restored in this season (0..16) */
  restored: number;
  /** element index to mark as "next" (or -1) */
  next?: number;
  /** 0..1 fade-in of the most recently restored element (celebration) */
  reveal?: { index: number; t: number };
}

let scratch: HTMLCanvasElement | null = null;

/** draw the garden scene fitted into a W x H box at (x, y) */
export function drawGarden(ctx: C, x: number, y: number, W: number, H: number, v: GardenView) {
  const L = LOOKS[v.season];
  const k = Math.max(W / GW, H / GH);
  // cover the box, keep the center
  const ox = x + (W - GW * k) / 2;
  const oy = y + (H - GH * k) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, W, H);
  ctx.clip();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  sky(ctx, L);
  ground(ctx, L);
  // silhouettes are soft washes: render them at most at 1x of the scene box
  const res = Math.min(1, ctx.getTransform().a);
  const sw = Math.ceil(GW * res);
  const sh = Math.ceil(GH * res);
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== sw || scratch.height !== sh) {
    scratch.width = sw;
    scratch.height = sh;
  }
  const sc = scratch.getContext('2d')!;
  const order = ELEMENTS.map((e, i) => ({ e, i })).sort((a, b) => a.e.z - b.e.z);
  for (const { e, i } of order) {
    const restored = i < v.restored;
    const revealT = v.reveal && v.reveal.index === i ? v.reveal.t : 1;
    if (restored && revealT >= 1) {
      ctx.save();
      e.draw(ctx, L);
      ctx.restore();
      continue;
    }
    // ink-wash silhouette (and, during a reveal, the colored element fading in on top)
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, sw, sh);
    sc.setTransform(sw / GW, 0, 0, sh / GH, 0, 0);
    e.draw(sc, L);
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = 'rgba(40, 52, 48, 1)';
    sc.fillRect(0, 0, sw, sh);
    ctx.save();
    ctx.globalAlpha = restored ? 0.2 * (1 - revealT) : 0.17;
    ctx.drawImage(scratch, 0, 0, GW, GH);
    ctx.restore();
    if (restored) {
      ctx.save();
      ctx.globalAlpha = revealT;
      e.draw(ctx, L);
      ctx.restore();
    }
  }
  seasonParticles(ctx, v.season);
  if (v.next !== undefined && v.next >= 0 && v.next < ELEMENTS.length) {
    const [mx, my] = ELEMENTS[v.next].at;
    ctx.strokeStyle = 'rgba(201, 160, 66, 0.95)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mx, my, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
