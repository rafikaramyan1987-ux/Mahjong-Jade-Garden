/**
 * The "Garden" tile set (default): 38 bright, illustrated pictures, all our own artwork drawn with canvas paths.
 * Bold dark outlines and flat, saturated colours so every picture reads at small sizes; pictures that share a
 * colour differ clearly in shape (and the other way round). Drawn in the 100 x 134 face box.
 */

type C = CanvasRenderingContext2D;

const INK = '#2e1f17';
const LW = 3;

// ---------------------------------------------------------------- helpers

/** bounding box of the path being built, so each fill can get its own soft gradient */
let box: [number, number, number, number] | null = null;
function setBox(x0: number, y0: number, x1: number, y1: number) {
  box = [x0, y0, x1, y1];
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/**
 * fill + bold outline. A plain colour becomes a soft diagonal gradient over the shape (light from the top-left),
 * which gives every part a rounded, polished look.
 */
function fs(ctx: C, fill: string | CanvasGradient, lw = LW, stroke = INK) {
  if (typeof fill === 'string' && fill.startsWith('#') && fill.length === 7) {
    const [x0, y0, x1, y1] = box ?? [10, 14, 90, 124];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade(fill, 0.42));
    g.addColorStop(0.42, fill);
    g.addColorStop(1, shade(fill, -0.24));
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  box = null;
}
function circle(ctx: C, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  setBox(x - r, y - r, x + r, y + r);
}
function ell(ctx: C, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  const m = Math.max(rx, ry);
  setBox(x - m, y - m, x + m, y + m);
}
function rr(ctx: C, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  setBox(x, y, x + w, y + h);
}
function poly(ctx: C, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  let x0 = pts[0],
    y0 = pts[1],
    x1 = pts[0],
    y1 = pts[1];
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineTo(pts[i], pts[i + 1]);
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  ctx.closePath();
  setBox(x0, y0, x1, y1);
}
function line(ctx: C, pts: number[], color = INK, lw = LW) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function curve(ctx: C, pts: number[], color = INK, lw = LW) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}
function dot(ctx: C, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** a big shiny cartoon eye */
function eye(ctx: C, x: number, y: number, r: number) {
  dot(ctx, x, y, r, '#1b1410');
  dot(ctx, x - r * 0.32, y - r * 0.35, r * 0.38, '#ffffff');
  dot(ctx, x + r * 0.35, y + r * 0.3, r * 0.16, '#ffffff');
}
/** a soft white shine */
function shine(ctx: C, x: number, y: number, rx: number, ry: number, rot = -0.5) {
  ell(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}
function leafShape(ctx: C, x: number, y: number, len: number, a: number, fill: string, w = 0.36) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * w, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * w, 0, 0);
  fs(ctx, fill, 2);
  line(ctx, [len * 0.12, 0, len * 0.8, 0], 'rgba(58,42,34,0.45)', 1.2);
  ctx.restore();
}
function petalFlower(ctx: C, x: number, y: number, r: number, fill: string, center: string, notch: boolean, n = 5) {
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    ctx.moveTo(px + r * 0.48, py);
    ctx.arc(px, py, r * 0.48, 0, Math.PI * 2);
  }
  fs(ctx, fill, 2.2);
  if (notch)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 - Math.PI / 2;
      line(ctx, [x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, x + Math.cos(a) * r * 1.03, y + Math.sin(a) * r * 1.03], INK, 2);
    }
  circle(ctx, x, y, r * 0.3);
  fs(ctx, center, 1.6);
}

// ---------------------------------------------------------------- the 38 pictures

const koi = (ctx: C) => {
  // ripples of the pond under the fish
  ell(ctx, 50, 70, 42, 38);
  fs(ctx, '#7fd3ff', 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  for (const r of [30, 22]) {
    ctx.beginPath();
    ctx.ellipse(50, 70, r * 1.1, r, 0, 0.3, 2.2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(50, 70);
  ctx.rotate(-0.6);
  // flowing tail with fin rays
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.bezierCurveTo(-40, -26, -54, -20, -50, -6);
  ctx.quadraticCurveTo(-44, 0, -50, 8);
  ctx.bezierCurveTo(-54, 22, -40, 26, -24, 0);
  setBox(-54, -26, -24, 26);
  fs(ctx, '#ff7a1a');
  for (const a of [-0.5, -0.2, 0.15, 0.45]) line(ctx, [-27, 0, -27 - Math.cos(a) * 20, Math.sin(a) * 20], 'rgba(160,40,0,0.55)', 1.4);
  // side fins
  ctx.beginPath();
  ctx.moveTo(4, 9);
  ctx.quadraticCurveTo(-2, 26, 14, 22);
  ctx.quadraticCurveTo(14, 14, 10, 9);
  setBox(-2, 9, 14, 26);
  fs(ctx, '#ff8f2e', 2.2);
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.quadraticCurveTo(-2, -26, 14, -22);
  ctx.quadraticCurveTo(14, -14, 10, -9);
  setBox(-2, -26, 14, -9);
  fs(ctx, '#ff8f2e', 2.2);
  // body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.bezierCurveTo(-14, -20, 22, -20, 38, -5);
    ctx.quadraticCurveTo(44, 0, 38, 5);
    ctx.bezierCurveTo(22, 20, -14, 20, -28, 0);
    setBox(-28, -20, 44, 20);
  };
  body();
  fs(ctx, '#ffffff', 0);
  ctx.save();
  body();
  ctx.clip();
  ell(ctx, 20, -6, 14, 10, 0.25);
  fs(ctx, '#ff3d1f', 0);
  ell(ctx, -4, 6, 11, 8, -0.4);
  fs(ctx, '#ff3d1f', 0);
  ell(ctx, -18, -6, 6, 5);
  fs(ctx, '#111111', 0);
  // scales
  ctx.strokeStyle = 'rgba(120,40,20,0.35)';
  ctx.lineWidth = 1.1;
  for (let x = -16; x < 30; x += 7)
    for (const y of [-6, 2]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, -1.2, 1.2);
      ctx.stroke();
    }
  ctx.restore();
  body();
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  ctx.stroke();
  eye(ctx, 32, -4, 3.2);
  curve(ctx, [40, 3, 46, 8, 50, 16], INK, 1.6);
  curve(ctx, [38, 5, 42, 12, 42, 20], INK, 1.4);
  ctx.restore();
};

const lotus = (ctx: C) => {
  // pad
  ell(ctx, 50, 98, 38, 14);
  fs(ctx, '#3fb34f');
  line(ctx, [50, 98, 26, 92], '#2a7d37', 1.6);
  line(ctx, [50, 98, 74, 92], '#2a7d37', 1.6);
  line(ctx, [50, 98, 50, 110], '#2a7d37', 1.6);
  // petals back to front
  const petal = (a: number, len: number, w: number, col: string) => {
    ctx.save();
    ctx.translate(50, 88);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(w, -len * 0.55, 0, 0);
    fs(ctx, col, 2.2);
    ctx.restore();
  };
  petal(-1.15, 34, 12, '#ff8fb5');
  petal(1.15, 34, 12, '#ff8fb5');
  petal(-0.6, 44, 14, '#ff6fa0');
  petal(0.6, 44, 14, '#ff6fa0');
  petal(0, 52, 15, '#ff4f8b');
  ell(ctx, 50, 54, 5, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
};

const lantern = (ctx: C) => {
  line(ctx, [50, 14, 50, 26]);
  rr(ctx, 38, 24, 24, 9, 3);
  fs(ctx, '#ffc93c');
  ell(ctx, 50, 64, 32, 31);
  const g = ctx.createRadialGradient(42, 54, 4, 50, 64, 34);
  g.addColorStop(0, '#ff6a4d');
  g.addColorStop(1, '#e11d2a');
  fs(ctx, g);
  for (const k of [-0.6, -0.25, 0.25, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(50, 64, Math.abs(k) * 32, 31, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    ctx.strokeStyle = 'rgba(120,10,10,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  shine(ctx, 38, 52, 6, 10, 0.3);
  rr(ctx, 38, 92, 24, 9, 3);
  fs(ctx, '#ffc93c');
  line(ctx, [50, 101, 50, 108], '#ffc93c', 3);
  poly(ctx, [45, 108, 55, 108, 58, 124, 42, 124]);
  fs(ctx, '#e11d2a', 2);
};

const teapot = (ctx: C) => {
  // handle
  curve(ctx, [76, 58, 94, 64, 76, 92], INK, 9);
  curve(ctx, [76, 58, 94, 64, 76, 92], '#1c8c84', 5);
  // spout
  poly(ctx, [24, 78, 8, 54, 14, 52, 30, 70]);
  fs(ctx, '#21a59b');
  // body
  ctx.beginPath();
  ctx.moveTo(22, 72);
  ctx.quadraticCurveTo(20, 104, 50, 106);
  ctx.quadraticCurveTo(80, 104, 78, 72);
  ctx.quadraticCurveTo(76, 50, 50, 50);
  ctx.quadraticCurveTo(24, 50, 22, 72);
  fs(ctx, '#21a59b');
  // band and flower
  line(ctx, [24, 80, 76, 80], '#ffffff', 3);
  petalFlower(ctx, 50, 92, 8, '#ffd23f', '#ff7a2f', false);
  // lid
  ell(ctx, 50, 50, 20, 6);
  fs(ctx, '#1c8c84');
  circle(ctx, 50, 42, 5);
  fs(ctx, '#ffd23f');
  shine(ctx, 34, 66, 4, 8, 0.4);
};

const teacup = (ctx: C) => {
  // steam
  curve(ctx, [42, 44, 36, 36, 42, 28, 48, 20, 42, 12], '#9ab7c9', 3);
  curve(ctx, [58, 44, 52, 36, 58, 28, 64, 20, 58, 14], '#9ab7c9', 3);
  // saucer
  ell(ctx, 50, 104, 40, 10);
  fs(ctx, '#d6ecff');
  // cup
  ctx.beginPath();
  ctx.moveTo(18, 58);
  ctx.lineTo(82, 58);
  ctx.quadraticCurveTo(80, 98, 50, 100);
  ctx.quadraticCurveTo(20, 98, 18, 58);
  fs(ctx, '#ffffff');
  ell(ctx, 50, 58, 32, 8);
  fs(ctx, '#d99a2b');
  // blue pattern
  line(ctx, [24, 72, 76, 72], '#2b6fd6', 3);
  for (const x of [32, 44, 56, 68]) dot(ctx, x, 84, 3, '#2b6fd6');
};

const bamboo = (ctx: C) => {
  const stalk = (x: number, y0: number, y1: number, w: number, col: string) => {
    for (let y = y0; y < y1; y += 24) {
      rr(ctx, x - w / 2, y, w, 22, 3);
      fs(ctx, col, 2);
      rr(ctx, x - w / 2 - 2, y + 21, w + 4, 4, 2);
      fs(ctx, '#2e7d32', 1.6);
    }
  };
  stalk(36, 30, 122, 13, '#6cc04a');
  stalk(62, 18, 118, 11, '#8ad35a');
  leafShape(ctx, 62, 40, 30, -0.5, '#3fa34d');
  leafShape(ctx, 62, 44, 26, -1.3, '#56b84f');
  leafShape(ctx, 36, 60, 28, Math.PI + 0.5, '#3fa34d');
  leafShape(ctx, 36, 64, 24, Math.PI + 1.2, '#56b84f');
};

const panda = (ctx: C) => {
  // bamboo stalk held in the arms
  ctx.save();
  ctx.translate(72, 74);
  ctx.rotate(0.35);
  rr(ctx, -5, -46, 10, 92, 4);
  fs(ctx, '#5fcf4a', 2.2);
  for (const y of [-22, 2, 26]) line(ctx, [-6, y, 6, y], '#2e7d32', 2.4);
  ctx.restore();
  leafShape(ctx, 62, 30, 22, -0.9, '#43b649');
  // body and legs
  ell(ctx, 50, 98, 30, 25);
  fs(ctx, '#ffffff');
  ell(ctx, 30, 114, 13, 9, -0.2);
  fs(ctx, '#2a2a2e');
  ell(ctx, 70, 114, 13, 9, 0.2);
  fs(ctx, '#2a2a2e');
  dot(ctx, 30, 115, 4, '#5b5b66');
  dot(ctx, 70, 115, 4, '#5b5b66');
  // arms hugging the bamboo
  ell(ctx, 30, 88, 10, 15, 0.5);
  fs(ctx, '#2a2a2e');
  ell(ctx, 68, 86, 10, 14, -0.7);
  fs(ctx, '#2a2a2e');
  // head
  circle(ctx, 27, 32, 11);
  fs(ctx, '#2a2a2e');
  circle(ctx, 73, 32, 11);
  fs(ctx, '#2a2a2e');
  ell(ctx, 50, 56, 32, 27);
  fs(ctx, '#ffffff');
  ell(ctx, 36, 55, 10, 12, 0.55);
  fs(ctx, '#2a2a2e', 0);
  ell(ctx, 64, 55, 10, 12, -0.55);
  fs(ctx, '#2a2a2e', 0);
  eye(ctx, 37, 55, 5);
  eye(ctx, 63, 55, 5);
  ell(ctx, 50, 68, 6, 4);
  fs(ctx, '#2a2a2e', 0);
  curve(ctx, [44, 74, 50, 79, 56, 74], INK, 2);
  dot(ctx, 29, 68, 5, '#ff9fb4');
  dot(ctx, 71, 68, 5, '#ff9fb4');
};

const crane = (ctx: C) => {
  // long legs
  line(ctx, [44, 92, 40, 124], INK, 2.4);
  line(ctx, [52, 92, 56, 124], INK, 2.4);
  line(ctx, [34, 124, 46, 124], INK, 2.4);
  line(ctx, [50, 124, 62, 124], INK, 2.4);
  // spread wings with feather tips
  const wing = (dir: number) => {
    ctx.save();
    ctx.translate(48, 76);
    ctx.scale(dir, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(14, -24, 30, -40, 46, -44);
    ctx.bezierCurveTo(42, -30, 40, -16, 30, -4);
    ctx.lineTo(36, 0);
    ctx.bezierCurveTo(26, 6, 12, 8, 0, 6);
    setBox(0, -44, 46, 8);
    fs(ctx, '#ffffff');
    // black flight feathers
    ctx.beginPath();
    ctx.moveTo(46, -44);
    ctx.bezierCurveTo(42, -30, 40, -16, 30, -4);
    ctx.lineTo(36, 0);
    ctx.bezierCurveTo(44, -14, 48, -30, 46, -44);
    fs(ctx, '#222428', 2);
    for (const t of [0.3, 0.5, 0.7]) line(ctx, [14 + t * 20, -10 - t * 24, 20 + t * 22, -4 - t * 18], 'rgba(60,70,90,0.35)', 1.4);
    ctx.restore();
  };
  wing(-1);
  wing(1);
  // body and tail plumes
  poly(ctx, [36, 88, 24, 104, 32, 102, 30, 110, 42, 96]);
  fs(ctx, '#222428', 2);
  ell(ctx, 48, 84, 16, 11);
  fs(ctx, '#ffffff');
  // neck: black lower part, white throat
  curve(ctx, [52, 78, 62, 64, 58, 44], INK, 9);
  curve(ctx, [52, 78, 62, 64, 58, 44], '#222428', 5.5);
  curve(ctx, [57, 56, 60, 50, 58, 44], '#ffffff', 5);
  circle(ctx, 57, 40, 7);
  fs(ctx, '#ffffff', 2.2);
  // red crown, eye and long beak
  ell(ctx, 56, 34, 5, 3.4);
  fs(ctx, '#ff2436', 1.4);
  eye(ctx, 59, 40, 2.2);
  poly(ctx, [62, 39, 82, 44, 62, 44]);
  fs(ctx, '#ffb23e', 1.6);
};

const rabbit = (ctx: C) => {
  // ears with pink insides and a little blossom
  ell(ctx, 37, 28, 9, 24, -0.2);
  fs(ctx, '#ffffff');
  ell(ctx, 37, 30, 4.4, 17, -0.2);
  fs(ctx, '#ff9fbf', 0);
  ell(ctx, 62, 28, 9, 24, 0.22);
  fs(ctx, '#ffffff');
  ell(ctx, 62, 30, 4.4, 17, 0.22);
  fs(ctx, '#ff9fbf', 0);
  petalFlower(ctx, 70, 16, 9, '#ff6fa3', '#ffe14d', false);
  // fluffy tail, body, feet
  circle(ctx, 80, 104, 9);
  fs(ctx, '#ffffff');
  ell(ctx, 50, 98, 28, 24);
  fs(ctx, '#ffffff');
  ell(ctx, 50, 104, 15, 14);
  fs(ctx, '#fff1f6', 0);
  ell(ctx, 34, 118, 11, 6);
  fs(ctx, '#ffffff');
  ell(ctx, 64, 118, 11, 6);
  fs(ctx, '#ffffff');
  // paws holding a little red bean bun
  circle(ctx, 50, 92, 9);
  fs(ctx, '#ffe2b0', 2.2);
  dot(ctx, 50, 92, 3, '#d1404a');
  ell(ctx, 40, 92, 6, 5);
  fs(ctx, '#ffffff', 2);
  ell(ctx, 60, 92, 6, 5);
  fs(ctx, '#ffffff', 2);
  // head
  ell(ctx, 49, 62, 24, 21);
  fs(ctx, '#ffffff');
  eye(ctx, 40, 60, 4.2);
  eye(ctx, 58, 60, 4.2);
  ell(ctx, 49, 68, 3.4, 2.6);
  fs(ctx, '#ff5d8f', 1.2);
  curve(ctx, [45, 72, 49, 75, 53, 72], INK, 1.6);
  dot(ctx, 33, 69, 4.4, '#ffb3cc');
  dot(ctx, 65, 69, 4.4, '#ffb3cc');
};

const turtle = (ctx: C) => {
  // legs, head, tail
  for (const [x, y] of [
    [26, 58],
    [74, 58],
    [26, 96],
    [74, 96],
  ]) {
    ell(ctx, x, y, 9, 7);
    fs(ctx, '#7cc35b');
  }
  circle(ctx, 50, 34, 11);
  fs(ctx, '#7cc35b');
  dot(ctx, 45, 32, 2.2, INK);
  dot(ctx, 55, 32, 2.2, INK);
  poly(ctx, [46, 112, 54, 112, 50, 120]);
  fs(ctx, '#7cc35b', 2);
  // shell
  ell(ctx, 50, 77, 28, 32);
  fs(ctx, '#a0712f');
  // hexagons
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(50, 77, 28, 32, 0, 0, Math.PI * 2);
  ctx.clip();
  const hex = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    fs(ctx, '#d8a24a', 2);
  };
  hex(50, 77, 11);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    hex(50 + Math.cos(a) * 21, 77 + Math.sin(a) * 23, 9);
  }
  ctx.restore();
  ell(ctx, 50, 77, 28, 32);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  ctx.stroke();
};

const dragon = (ctx: C) => {
  // a friendly jade dragon curling in an S
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(22, 116);
    ctx.bezierCurveTo(10, 96, 82, 96, 70, 74);
    ctx.bezierCurveTo(60, 56, 22, 66, 30, 44);
  };
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 24;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#2bb673';
  ctx.lineWidth = 18;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  // spikes
  for (const [x, y] of [
    [40, 104],
    [58, 100],
    [74, 86],
    [52, 66],
  ]) {
    poly(ctx, [x - 4, y - 2, x + 4, y - 2, x, y - 10]);
    fs(ctx, '#ff6b3d', 1.6);
  }
  // head
  ell(ctx, 38, 34, 21, 15, -0.2);
  fs(ctx, '#2bb673');
  poly(ctx, [24, 26, 18, 10, 30, 22]);
  fs(ctx, '#ffd34d', 2);
  poly(ctx, [34, 22, 34, 6, 42, 20]);
  fs(ctx, '#ffd34d', 2);
  dot(ctx, 42, 31, 3.4, '#ffffff');
  dot(ctx, 43, 31, 1.8, INK);
  curve(ctx, [54, 38, 70, 34, 80, 42], '#ff6b3d', 2.4);
  curve(ctx, [52, 42, 66, 48, 72, 58], '#ff6b3d', 2.4);
  dot(ctx, 52, 36, 1.8, INK);
};

const cherry = (ctx: C) => {
  petalFlower(ctx, 50, 68, 40, '#ffb7d0', '#ff4f8b', true);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    line(ctx, [50, 68, 50 + Math.cos(a) * 18, 68 + Math.sin(a) * 18], '#d6336c', 1.6);
    dot(ctx, 50 + Math.cos(a) * 18, 68 + Math.sin(a) * 18, 2.4, '#ffd23f');
  }
};

const plum = (ctx: C) => {
  curve(ctx, [14, 118, 30, 80, 52, 70, 74, 60, 86, 24], '#5a3a26', 7);
  curve(ctx, [46, 72, 36, 54, 26, 40], '#5a3a26', 5);
  petalFlower(ctx, 28, 38, 17, '#c2185b', '#ffd23f', false);
  petalFlower(ctx, 80, 30, 15, '#c2185b', '#ffd23f', false);
  petalFlower(ctx, 58, 70, 18, '#c2185b', '#ffd23f', false);
  dot(ctx, 30, 96, 5, '#e05591');
};

const peach = (ctx: C) => {
  leafShape(ctx, 50, 38, 30, -0.6, '#43a047');
  leafShape(ctx, 50, 38, 26, Math.PI + 0.7, '#66bb6a');
  ctx.beginPath();
  ctx.moveTo(50, 42);
  ctx.bezierCurveTo(20, 30, 10, 76, 30, 96);
  ctx.quadraticCurveTo(44, 110, 50, 112);
  ctx.quadraticCurveTo(56, 110, 70, 96);
  ctx.bezierCurveTo(90, 76, 80, 30, 50, 42);
  const g = ctx.createRadialGradient(40, 70, 4, 50, 78, 44);
  g.addColorStop(0, '#ffe08a');
  g.addColorStop(0.6, '#ffa36b');
  g.addColorStop(1, '#ff5d73');
  fs(ctx, g);
  curve(ctx, [50, 46, 60, 78, 50, 108], 'rgba(160,40,40,0.55)', 2.2);
  shine(ctx, 34, 64, 5, 10, 0.3);
};

const fan = (ctx: C) => {
  // round silk fan
  rr(ctx, 46, 92, 8, 30, 3);
  fs(ctx, '#8d5a2b');
  line(ctx, [50, 122, 50, 128], '#e8202a', 3);
  circle(ctx, 50, 60, 36);
  fs(ctx, '#bfe3ff');
  circle(ctx, 50, 60, 31);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  // painted branch on the silk
  curve(ctx, [24, 82, 44, 70, 52, 52, 60, 38, 74, 36], '#6d4c41', 3);
  petalFlower(ctx, 52, 52, 10, '#ff6f91', '#ffd23f', false);
  petalFlower(ctx, 72, 38, 8, '#ff6f91', '#ffd23f', false);
  petalFlower(ctx, 36, 74, 7, '#ff6f91', '#ffd23f', false);
};

const bridge = (ctx: C) => {
  // water
  rr(ctx, 6, 92, 88, 22, 8);
  fs(ctx, '#4fc3f7');
  curve(ctx, [14, 102, 22, 98, 30, 102], '#ffffff', 2);
  curve(ctx, [66, 106, 74, 102, 82, 106], '#ffffff', 2);
  // arch
  ctx.beginPath();
  ctx.moveTo(8, 96);
  ctx.quadraticCurveTo(50, 30, 92, 96);
  ctx.lineTo(80, 96);
  ctx.quadraticCurveTo(50, 52, 20, 96);
  ctx.closePath();
  fs(ctx, '#e53935');
  // railing
  curve(ctx, [12, 80, 50, 22, 88, 80], INK, 3);
  for (let k = 1; k < 8; k++) {
    const t = k / 8;
    const x = 12 + t * 76;
    const yt = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 22 + t * t * 80;
    const yb = (1 - t) * (1 - t) * 94 + 2 * (1 - t) * t * 36 + t * t * 94;
    line(ctx, [x, yt, x, yb], INK, 2.2);
  }
};

const pagoda = (ctx: C) => {
  const tier = (y: number, w: number) => {
    rr(ctx, 50 - w * 0.36, y, w * 0.72, 14, 2);
    fs(ctx, '#e53935');
    ctx.beginPath();
    ctx.moveTo(50 - w / 2 - 6, y + 2);
    ctx.quadraticCurveTo(50 - w / 2, y - 2, 50 - w * 0.3, y - 10);
    ctx.lineTo(50 + w * 0.3, y - 10);
    ctx.quadraticCurveTo(50 + w / 2, y - 2, 50 + w / 2 + 6, y + 2);
    ctx.closePath();
    fs(ctx, '#00897b');
  };
  rr(ctx, 20, 112, 60, 8, 2);
  fs(ctx, '#b0a17e');
  tier(96, 64);
  tier(74, 52);
  tier(52, 40);
  tier(32, 28);
  line(ctx, [50, 22, 50, 8], '#ffb300', 3);
  circle(ctx, 50, 12, 3.5);
  fs(ctx, '#ffd23f', 1.6);
};

const kite = (ctx: C) => {
  // tail
  curve(ctx, [50, 84, 40, 100, 52, 110, 64, 120, 54, 130], INK, 2);
  for (const [x, y, c] of [
    [44, 100, '#e53935'],
    [58, 116, '#1e88e5'],
  ] as [number, number, string][]) {
    poly(ctx, [x - 7, y - 4, x, y, x - 7, y + 4]);
    fs(ctx, c, 1.6);
    poly(ctx, [x + 7, y - 4, x, y, x + 7, y + 4]);
    fs(ctx, c, 1.6);
  }
  // diamond in four colours
  const cx = 50,
    cy = 50;
  const q: [number[], string][] = [
    [[cx, 12, cx, cy, 18, cy], '#ffd23f'],
    [[cx, 12, cx, cy, 82, cy], '#e53935'],
    [[cx, 86, cx, cy, 18, cy], '#1e88e5'],
    [[cx, 86, cx, cy, 82, cy], '#43a047'],
  ];
  for (const [pts, c] of q) {
    poly(ctx, pts);
    fs(ctx, c, 2);
  }
  poly(ctx, [cx, 12, 82, cy, cx, 86, 18, cy]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  ctx.stroke();
};

const butterfly = (ctx: C) => {
  const wing = (sx: number) => {
    ctx.save();
    ctx.translate(50, 66);
    ctx.scale(sx, 1);
    ell(ctx, 18, -16, 22, 18, -0.5);
    fs(ctx, '#7e57c2');
    ell(ctx, 16, 16, 15, 13, 0.5);
    fs(ctx, '#29b6f6');
    dot(ctx, 22, -18, 6, '#ffb300');
    dot(ctx, 16, 17, 4, '#ffffff');
    ctx.restore();
  };
  wing(1);
  wing(-1);
  ell(ctx, 50, 68, 4.5, 22);
  fs(ctx, '#3a2a22', 0);
  curve(ctx, [48, 48, 42, 36, 36, 32], INK, 2);
  curve(ctx, [52, 48, 58, 36, 64, 32], INK, 2);
  dot(ctx, 36, 32, 2.6, INK);
  dot(ctx, 64, 32, 2.6, INK);
};

const frog = (ctx: C) => {
  // body
  ell(ctx, 50, 92, 34, 24);
  fs(ctx, '#8bd346');
  ell(ctx, 50, 98, 20, 14);
  fs(ctx, '#d7f5a8', 0);
  // feet
  ell(ctx, 24, 112, 12, 6);
  fs(ctx, '#7cc33a');
  ell(ctx, 76, 112, 12, 6);
  fs(ctx, '#7cc33a');
  // head
  ell(ctx, 50, 66, 32, 20);
  fs(ctx, '#8bd346');
  // eyes
  for (const x of [32, 68]) {
    circle(ctx, x, 46, 11);
    fs(ctx, '#ffffff');
    dot(ctx, x + 1, 47, 5, INK);
    dot(ctx, x + 3, 44, 1.8, '#ffffff');
  }
  curve(ctx, [32, 72, 50, 84, 68, 72], INK, 2.4);
  dot(ctx, 28, 74, 4, '#ff9fbc');
  dot(ctx, 72, 74, 4, '#ff9fbc');
};

const goldfish = (ctx: C) => {
  // big flowing tail
  ctx.beginPath();
  ctx.moveTo(30, 66);
  ctx.bezierCurveTo(10, 40, 2, 52, 8, 62);
  ctx.bezierCurveTo(0, 74, 6, 96, 30, 72);
  fs(ctx, '#ffb74d');
  // round body
  ell(ctx, 54, 66, 30, 25);
  const g = ctx.createRadialGradient(60, 58, 4, 54, 66, 32);
  g.addColorStop(0, '#ffd166');
  g.addColorStop(1, '#ff7b00');
  fs(ctx, g);
  poly(ctx, [50, 42, 60, 30, 66, 44]);
  fs(ctx, '#ff9f1c', 2);
  circle(ctx, 72, 58, 7);
  fs(ctx, '#ffffff', 2);
  dot(ctx, 74, 58, 3.6, INK);
  curve(ctx, [82, 70, 78, 74, 82, 76], INK, 2);
  line(ctx, [44, 70, 54, 78], 'rgba(160,60,0,0.6)', 2);
  // bubbles
  circle(ctx, 86, 40, 4);
  fs(ctx, '#bfe3ff', 1.6);
  circle(ctx, 80, 26, 3);
  fs(ctx, '#bfe3ff', 1.6);
};

const mooncake = (ctx: C) => {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const x = 50 + Math.cos(a) * 36;
    const y = 68 + Math.sin(a) * 36;
    ctx.moveTo(x + 7, y);
    ctx.arc(x, y, 7, 0, Math.PI * 2);
  }
  fs(ctx, '#c98a3c', 2);
  circle(ctx, 50, 68, 36);
  fs(ctx, '#e0a85a');
  circle(ctx, 50, 68, 24);
  fs(ctx, '#d39445', 2);
  // pressed flower pattern
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(50, 68);
    ctx.rotate((k * Math.PI) / 2);
    ell(ctx, 0, -11, 5, 9);
    fs(ctx, '#e8b56a', 1.6);
    ctx.restore();
  }
  dot(ctx, 50, 68, 4, '#a86a22');
  shine(ctx, 34, 52, 6, 3, -0.6);
};

const dumpling = (ctx: C) => {
  // bamboo steamer
  rr(ctx, 12, 82, 76, 30, 8);
  fs(ctx, '#d9a95b');
  line(ctx, [14, 94, 86, 94], '#9c6b2e', 2);
  line(ctx, [14, 104, 86, 104], '#9c6b2e', 2);
  // two dumplings
  const dump = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x - 22 * s, y);
    ctx.quadraticCurveTo(x - 20 * s, y - 30 * s, x, y - 32 * s);
    ctx.quadraticCurveTo(x + 20 * s, y - 30 * s, x + 22 * s, y);
    ctx.closePath();
    fs(ctx, '#fff8ec');
    for (const dx of [-10, -4, 2, 8]) curve(ctx, [x + dx * s, y - 30 * s, x + (dx + 3) * s, y - 20 * s, x + (dx + 1) * s, y - 12 * s], '#d8c4a0', 1.6);
  };
  dump(34, 84, 1);
  dump(64, 84, 1.05);
  curve(ctx, [70, 40, 66, 32, 72, 24], '#b0c4d6', 2.6);
  curve(ctx, [36, 44, 32, 36, 38, 28], '#b0c4d6', 2.6);
};

const riceBowl = (ctx: C) => {
  // chopsticks
  line(ctx, [62, 24, 88, 60], '#8d5a2b', 4);
  line(ctx, [52, 22, 86, 52], '#a86f3a', 4);
  // rice
  ctx.beginPath();
  ctx.moveTo(16, 66);
  ctx.quadraticCurveTo(22, 40, 50, 42);
  ctx.quadraticCurveTo(78, 40, 84, 66);
  ctx.closePath();
  fs(ctx, '#ffffff');
  for (const [x, y] of [
    [36, 56],
    [48, 50],
    [60, 56],
    [44, 60],
    [66, 60],
  ])
  {
    ell(ctx, x, y, 3, 1.6);
    fs(ctx, '#e6e0d2', 0);
  }
  // bowl
  ctx.beginPath();
  ctx.moveTo(10, 66);
  ctx.lineTo(90, 66);
  ctx.quadraticCurveTo(86, 104, 50, 106);
  ctx.quadraticCurveTo(14, 104, 10, 66);
  fs(ctx, '#2f6fde');
  line(ctx, [16, 76, 84, 76], '#ffffff', 3);
  for (const x of [28, 44, 60, 74]) dot(ctx, x, 90, 3.4, '#ffffff');
  rr(ctx, 36, 104, 28, 8, 3);
  fs(ctx, '#2659b8');
};

const umbrella = (ctx: C) => {
  // handle
  line(ctx, [50, 56, 50, 108], INK, 4);
  curve(ctx, [50, 108, 50, 118, 42, 116], INK, 4);
  // canopy segments
  const segs = 6;
  for (let k = 0; k < segs; k++) {
    const a0 = Math.PI + (k / segs) * Math.PI;
    const a1 = Math.PI + ((k + 1) / segs) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(50, 60);
    ctx.lineTo(50 + Math.cos(a0) * 42, 60 + Math.sin(a0) * 40);
    ctx.lineTo(50 + Math.cos(a1) * 42, 60 + Math.sin(a1) * 40);
    ctx.closePath();
    fs(ctx, k % 2 ? '#ffb300' : '#ff7043', 2);
  }
  // scalloped rim
  for (let k = 0; k < segs; k++) {
    const a = Math.PI + ((k + 0.5) / segs) * Math.PI;
    dot(ctx, 50 + Math.cos(a) * 40, 60 + Math.sin(a) * 38, 3, '#e53935');
  }
  circle(ctx, 50, 20, 4);
  fs(ctx, '#e53935', 1.6);
};

const drum = (ctx: C) => {
  // sticks
  line(ctx, [20, 26, 44, 56], '#8d5a2b', 5);
  line(ctx, [80, 26, 56, 56], '#8d5a2b', 5);
  dot(ctx, 20, 26, 6, '#e53935');
  dot(ctx, 80, 26, 6, '#e53935');
  // body
  ctx.beginPath();
  ctx.moveTo(14, 64);
  ctx.quadraticCurveTo(10, 90, 18, 112);
  ctx.lineTo(82, 112);
  ctx.quadraticCurveTo(90, 90, 86, 64);
  ctx.closePath();
  fs(ctx, '#1565c0');
  ell(ctx, 50, 112, 32, 8);
  fs(ctx, '#0d47a1');
  ell(ctx, 50, 64, 36, 11);
  fs(ctx, '#ffe7b3');
  for (const x of [22, 36, 50, 64, 78]) dot(ctx, x, 78, 2.6, '#ffd23f');
  for (const x of [24, 38, 50, 62, 76]) dot(ctx, x, 100, 2.6, '#ffd23f');
};

const bell = (ctx: C) => {
  line(ctx, [50, 14, 50, 30], '#e53935', 4);
  circle(ctx, 50, 32, 6);
  fs(ctx, '#d4a017');
  ctx.beginPath();
  ctx.moveTo(26, 98);
  ctx.quadraticCurveTo(28, 40, 50, 36);
  ctx.quadraticCurveTo(72, 40, 74, 98);
  ctx.quadraticCurveTo(82, 102, 84, 108);
  ctx.lineTo(16, 108);
  ctx.quadraticCurveTo(18, 102, 26, 98);
  ctx.closePath();
  const g = ctx.createLinearGradient(26, 0, 74, 0);
  g.addColorStop(0, '#ffcf40');
  g.addColorStop(0.5, '#ffe58a');
  g.addColorStop(1, '#d99a00');
  fs(ctx, g);
  line(ctx, [30, 70, 70, 70], '#a46f00', 2);
  line(ctx, [28, 84, 72, 84], '#a46f00', 2);
  circle(ctx, 50, 114, 6);
  fs(ctx, '#a46f00');
};

const bird = (ctx: C) => {
  // branch
  curve(ctx, [8, 104, 50, 96, 92, 106], '#6d4c41', 5);
  leafShape(ctx, 80, 104, 16, 0.4, '#66bb6a');
  // tail
  poly(ctx, [24, 74, 6, 66, 10, 82]);
  fs(ctx, '#1e6fd9');
  // body
  ell(ctx, 48, 74, 28, 23);
  fs(ctx, '#3d8bfd');
  ell(ctx, 56, 84, 16, 12);
  fs(ctx, '#ffd9a8', 0);
  // wing
  ell(ctx, 40, 74, 13, 9, 0.3);
  fs(ctx, '#1e6fd9', 2);
  // eye, beak, legs
  dot(ctx, 62, 64, 3.2, INK);
  dot(ctx, 63, 63, 1.1, '#ffffff');
  poly(ctx, [74, 66, 86, 70, 74, 74]);
  fs(ctx, '#ff9800', 1.8);
  line(ctx, [44, 96, 44, 102], INK, 2);
  line(ctx, [54, 96, 54, 101], INK, 2);
};

const ginkgo = (ctx: C) => {
  line(ctx, [50, 80, 46, 122], '#8d6e3f', 4);
  ctx.beginPath();
  ctx.moveTo(50, 84);
  ctx.lineTo(12, 40);
  ctx.quadraticCurveTo(26, 18, 46, 22);
  ctx.lineTo(50, 36);
  ctx.lineTo(54, 22);
  ctx.quadraticCurveTo(74, 18, 88, 40);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 20, 0, 84);
  g.addColorStop(0, '#ffe14d');
  g.addColorStop(1, '#f5b400');
  fs(ctx, g);
  for (const a of [-0.9, -0.5, -0.15, 0.15, 0.5, 0.9]) line(ctx, [50, 82, 50 + Math.sin(a) * 40, 82 - Math.cos(a) * 46], 'rgba(150,100,0,0.5)', 1.4);
};

const pine = (ctx: C) => {
  rr(ctx, 44, 94, 12, 24, 3);
  fs(ctx, '#8d5a2b');
  const layer = (y: number, w: number, c: string) => {
    poly(ctx, [50, y - 30, 50 - w, y, 50 + w, y]);
    fs(ctx, c);
  };
  layer(100, 38, '#1b7a45');
  layer(76, 30, '#219150');
  layer(52, 22, '#2aa85e');
  dot(ctx, 50, 20, 4, '#ffd23f');
  // snow-free sparkle of needles
  for (const [x, y] of [
    [36, 92],
    [62, 70],
    [44, 48],
  ])
    shine(ctx, x, y, 5, 2, -0.3);
};

const mountain = (ctx: C) => {
  // sky-free: two peaks with snow and a green foot
  poly(ctx, [6, 108, 38, 40, 70, 108]);
  fs(ctx, '#5c6bc0');
  poly(ctx, [38, 108, 66, 28, 94, 108]);
  fs(ctx, '#3f51b5');
  poly(ctx, [66, 28, 56, 50, 62, 46, 66, 52, 71, 46, 76, 50]);
  fs(ctx, '#ffffff', 2);
  poly(ctx, [38, 40, 30, 56, 36, 52, 40, 58, 44, 52, 47, 56]);
  fs(ctx, '#ffffff', 2);
  ctx.beginPath();
  ctx.moveTo(4, 108);
  ctx.quadraticCurveTo(30, 92, 50, 102);
  ctx.quadraticCurveTo(72, 90, 96, 104);
  ctx.lineTo(96, 116);
  ctx.lineTo(4, 116);
  ctx.closePath();
  fs(ctx, '#4caf50');
};

const sun = (ctx: C) => {
  ctx.save();
  ctx.translate(50, 66);
  for (let k = 0; k < 12; k++) {
    ctx.rotate(Math.PI / 6);
    poly(ctx, [-6, -30, 6, -30, 0, -46]);
    fs(ctx, k % 2 ? '#ffb300' : '#ff7043', 2);
  }
  ctx.restore();
  circle(ctx, 50, 66, 28);
  const g = ctx.createRadialGradient(44, 58, 4, 50, 66, 30);
  g.addColorStop(0, '#fff176');
  g.addColorStop(1, '#ffb300');
  fs(ctx, g);
  shine(ctx, 40, 54, 7, 4, -0.6);
};

const moon = (ctx: C) => {
  circle(ctx, 50, 66, 40);
  fs(ctx, '#283593');
  // crescent
  ctx.save();
  ctx.beginPath();
  ctx.arc(46, 66, 26, 0, Math.PI * 2);
  ctx.arc(58, 58, 22, 0, Math.PI * 2, true);
  ctx.fillStyle = '#ffe066';
  ctx.fill('evenodd');
  ctx.restore();
  const star = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr2 = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  };
  star(70, 50, 7);
  star(66, 82, 4.5);
  star(78, 68, 3.5);
};

const cloud = (ctx: C) => {
  ctx.beginPath();
  ctx.arc(30, 76, 16, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(42, 56, 18, Math.PI, Math.PI * 1.8);
  ctx.arc(64, 54, 20, Math.PI * 1.2, Math.PI * 2);
  ctx.arc(76, 76, 14, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  fs(ctx, '#9fd8ff');
  // Chinese cloud curls
  curve(ctx, [36, 76, 34, 66, 44, 66, 52, 68, 48, 74], '#ffffff', 3);
  curve(ctx, [58, 64, 60, 56, 68, 60], '#ffffff', 3);
  // a little rain
  for (const [x, y] of [
    [34, 104],
    [52, 110],
    [68, 102],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.quadraticCurveTo(x + 5, y, x, y + 3);
    ctx.quadraticCurveTo(x - 5, y, x, y - 8);
    fs(ctx, '#42a5f5', 1.6);
  }
};

const maple = (ctx: C) => {
  line(ctx, [50, 92, 50, 122], '#8d3b1f', 4);
  const pts = [50, 18, 58, 44, 76, 32, 70, 56, 92, 58, 72, 74, 80, 92, 54, 82, 50, 96, 46, 82, 20, 92, 28, 74, 8, 58, 30, 56, 24, 32, 42, 44];
  poly(ctx, pts);
  const g = ctx.createLinearGradient(0, 18, 0, 96);
  g.addColorStop(0, '#ff7043');
  g.addColorStop(1, '#d32f2f');
  fs(ctx, g);
  line(ctx, [50, 90, 50, 30], 'rgba(120,20,10,0.5)', 1.6);
  line(ctx, [50, 74, 76, 50], 'rgba(120,20,10,0.5)', 1.6);
  line(ctx, [50, 74, 24, 50], 'rgba(120,20,10,0.5)', 1.6);
};

const watermelon = (ctx: C) => {
  ctx.beginPath();
  ctx.moveTo(8, 46);
  ctx.lineTo(92, 46);
  ctx.quadraticCurveTo(90, 108, 50, 110);
  ctx.quadraticCurveTo(10, 108, 8, 46);
  fs(ctx, '#2e7d32');
  ctx.beginPath();
  ctx.moveTo(14, 46);
  ctx.lineTo(86, 46);
  ctx.quadraticCurveTo(84, 100, 50, 102);
  ctx.quadraticCurveTo(16, 100, 14, 46);
  fs(ctx, '#f0fff0', 0);
  ctx.beginPath();
  ctx.moveTo(18, 46);
  ctx.lineTo(82, 46);
  ctx.quadraticCurveTo(80, 96, 50, 97);
  ctx.quadraticCurveTo(20, 96, 18, 46);
  fs(ctx, '#ff4d5e', 0);
  line(ctx, [8, 46, 92, 46], INK, LW);
  for (const [x, y] of [
    [32, 58],
    [50, 62],
    [68, 58],
    [40, 76],
    [60, 76],
    [50, 88],
  ])
  {
    ell(ctx, x, y, 2.6, 4, 0.2);
    fs(ctx, '#2b2b2b', 0);
  }
};

const paperBoat = (ctx: C) => {
  rr(ctx, 6, 92, 88, 22, 8);
  fs(ctx, '#29b6f6');
  curve(ctx, [14, 104, 22, 100, 30, 104], '#ffffff', 2);
  curve(ctx, [64, 108, 72, 104, 80, 108], '#ffffff', 2);
  poly(ctx, [12, 72, 88, 72, 74, 96, 26, 96]);
  fs(ctx, '#ffffff');
  poly(ctx, [50, 22, 50, 72, 22, 72]);
  fs(ctx, '#ffca28');
  poly(ctx, [50, 22, 50, 72, 78, 72]);
  fs(ctx, '#ffe082');
};

const redPanda = (ctx: C) => {
  // big ringed tail curling up on the right
  const rings = ['#e8642c', '#7a2e12'];
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const x = 66 + Math.sin(t * 2.2) * 20;
    const y = 112 - t * 52;
    ell(ctx, x, y, 11 - t * 2, 9, 0.6 - t);
    fs(ctx, rings[k % 2], 2);
  }
  // body and dark legs
  ell(ctx, 46, 98, 24, 21);
  fs(ctx, '#e15b26');
  ell(ctx, 30, 116, 9, 7);
  fs(ctx, '#4a1d10');
  ell(ctx, 56, 117, 9, 7);
  fs(ctx, '#4a1d10');
  ell(ctx, 46, 102, 12, 12);
  fs(ctx, '#4a1d10', 0);
  // ears
  poly(ctx, [22, 48, 26, 24, 42, 40]);
  fs(ctx, '#e8642c');
  poly(ctx, [27, 44, 28, 31, 36, 40]);
  fs(ctx, '#fff3e0', 0);
  poly(ctx, [74, 48, 70, 24, 54, 40]);
  fs(ctx, '#e8642c');
  poly(ctx, [69, 44, 68, 31, 60, 40]);
  fs(ctx, '#fff3e0', 0);
  // head with cream mask
  ell(ctx, 48, 60, 28, 23);
  fs(ctx, '#ee6f2f');
  ell(ctx, 34, 66, 9, 8);
  fs(ctx, '#fff6e6', 0);
  ell(ctx, 62, 66, 9, 8);
  fs(ctx, '#fff6e6', 0);
  ell(ctx, 48, 70, 9, 7);
  fs(ctx, '#fff6e6', 0);
  dot(ctx, 38, 48, 4, '#fff6e6');
  dot(ctx, 58, 48, 4, '#fff6e6');
  // tear marks, eyes, nose
  curve(ctx, [38, 58, 40, 64, 42, 72], '#9a3412', 3);
  curve(ctx, [58, 58, 56, 64, 54, 72], '#9a3412', 3);
  eye(ctx, 39, 57, 4);
  eye(ctx, 57, 57, 4);
  ell(ctx, 48, 68, 4, 3);
  fs(ctx, '#2a120a', 0);
  curve(ctx, [44, 73, 48, 76, 52, 73], INK, 1.6);
  ell(ctx, 48, 60, 28, 23);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  ctx.stroke();
};

/** face index -> picture (38 faces). Names are for the tile-set sheet and tests. */
export const GARDEN_TILES: { name: string; draw: (ctx: C) => void }[] = [
  { name: 'koi', draw: koi },
  { name: 'lotus', draw: lotus },
  { name: 'lantern', draw: lantern },
  { name: 'teapot', draw: teapot },
  { name: 'teacup', draw: teacup },
  { name: 'bamboo', draw: bamboo },
  { name: 'panda', draw: panda },
  { name: 'crane', draw: crane },
  { name: 'rabbit', draw: rabbit },
  { name: 'turtle', draw: turtle },
  { name: 'dragon', draw: dragon },
  { name: 'cherry blossom', draw: cherry },
  { name: 'plum flower', draw: plum },
  { name: 'peach', draw: peach },
  { name: 'fan', draw: fan },
  { name: 'bridge', draw: bridge },
  { name: 'pagoda', draw: pagoda },
  { name: 'kite', draw: kite },
  { name: 'butterfly', draw: butterfly },
  { name: 'frog', draw: frog },
  { name: 'goldfish', draw: goldfish },
  { name: 'mooncake', draw: mooncake },
  { name: 'dumplings', draw: dumpling },
  { name: 'rice bowl', draw: riceBowl },
  { name: 'umbrella', draw: umbrella },
  { name: 'drum', draw: drum },
  { name: 'bell', draw: bell },
  { name: 'bluebird', draw: bird },
  { name: 'ginkgo leaf', draw: ginkgo },
  { name: 'pine', draw: pine },
  { name: 'mountain', draw: mountain },
  { name: 'sun', draw: sun },
  { name: 'moon', draw: moon },
  { name: 'cloud', draw: cloud },
  { name: 'maple leaf', draw: maple },
  { name: 'watermelon', draw: watermelon },
  { name: 'paper boat', draw: paperBoat },
  { name: 'red panda', draw: redPanda },
];

// ---------------------------------------------------------------- GamePix build: neutral garden pictures
// GamePix does not allow religious symbols. These pictures replace the ones that can be read that way (lotus on
// its pad, the pagoda with its spire, the temple-style bell, the crescent moon with stars, the cross-like
// four-petal stamp on the mooncake). They are only used in the GamePix build (see the block below).

const tulip = (ctx: C) => {
  curve(ctx, [50, 120, 48, 96, 50, 70], INK, 8);
  curve(ctx, [50, 120, 48, 96, 50, 70], '#43a047', 4);
  leafShape(ctx, 50, 116, 40, -1.05, '#43a047', 0.32);
  leafShape(ctx, 49, 112, 36, Math.PI + 1.0, '#66bb6a', 0.32);
  // the cup: three pointed petals on top
  ctx.beginPath();
  ctx.moveTo(26, 30);
  ctx.quadraticCurveTo(22, 72, 50, 80);
  ctx.quadraticCurveTo(78, 72, 74, 30);
  ctx.lineTo(62, 44);
  ctx.lineTo(50, 24);
  ctx.lineTo(38, 44);
  ctx.closePath();
  setBox(22, 24, 78, 80);
  fs(ctx, '#ff3d5a');
  curve(ctx, [38, 44, 40, 68, 50, 78], 'rgba(150,20,40,0.55)', 2);
  curve(ctx, [62, 44, 60, 68, 50, 78], 'rgba(150,20,40,0.55)', 2);
  shine(ctx, 34, 50, 4, 10, 0.15);
};

const bonsai = (ctx: C) => {
  // pot
  rr(ctx, 18, 98, 64, 8, 3);
  fs(ctx, '#1e88e5');
  poly(ctx, [24, 106, 76, 106, 70, 122, 30, 122]);
  fs(ctx, '#1565c0');
  // twisted trunk
  curve(ctx, [50, 100, 34, 84, 46, 70, 58, 58, 52, 42], INK, 11);
  curve(ctx, [50, 100, 34, 84, 46, 70, 58, 58, 52, 42], '#8d5a2b', 7);
  curve(ctx, [48, 72, 62, 70, 72, 60], INK, 7);
  curve(ctx, [48, 72, 62, 70, 72, 60], '#8d5a2b', 3.5);
  // foliage pads
  ell(ctx, 28, 62, 20, 11);
  fs(ctx, '#43a047');
  ell(ctx, 74, 54, 20, 11);
  fs(ctx, '#2e7d32');
  ell(ctx, 50, 32, 24, 13);
  fs(ctx, '#66bb6a');
  shine(ctx, 42, 28, 7, 3, -0.2);
};

const wateringCan = (ctx: C) => {
  ctx.save();
  // the spout and its drops stay inside the face
  ctx.translate(-9, 0);
  // handle over the top
  ctx.beginPath();
  ctx.arc(46, 60, 20, Math.PI, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = 5;
  ctx.stroke();
  // spout with its rose
  poly(ctx, [66, 80, 88, 50, 94, 56, 70, 96]);
  fs(ctx, '#ff8a3d');
  ell(ctx, 92, 50, 6, 9, 0.75);
  fs(ctx, '#ffb74d', 2.4);
  // body
  rr(ctx, 18, 60, 52, 52, 8);
  fs(ctx, '#ff8a3d');
  line(ctx, [20, 74, 68, 74], 'rgba(150,60,10,0.45)', 2);
  shine(ctx, 30, 84, 4, 12, 0);
  // drops
  dot(ctx, 96, 70, 3.4, '#29b6f6');
  dot(ctx, 90, 82, 3, '#29b6f6');
  dot(ctx, 100, 86, 2.6, '#29b6f6');
  ctx.restore();
};

const snail = (ctx: C) => {
  // body
  ctx.beginPath();
  ctx.moveTo(12, 108);
  ctx.quadraticCurveTo(14, 96, 40, 96);
  ctx.lineTo(70, 96);
  ctx.quadraticCurveTo(76, 70, 82, 64);
  ctx.quadraticCurveTo(96, 62, 92, 84);
  ctx.quadraticCurveTo(90, 108, 70, 110);
  ctx.lineTo(16, 112);
  ctx.closePath();
  setBox(12, 62, 96, 112);
  fs(ctx, '#c5e15a');
  // eye stalks
  line(ctx, [82, 68, 76, 46], INK, 3);
  line(ctx, [88, 68, 94, 46], INK, 3);
  dot(ctx, 76, 44, 5, INK);
  dot(ctx, 94, 44, 5, INK);
  dot(ctx, 75, 42, 1.8, '#ffffff');
  dot(ctx, 93, 42, 1.8, '#ffffff');
  curve(ctx, [80, 84, 86, 90, 90, 84], INK, 2);
  // shell with a spiral
  circle(ctx, 44, 72, 30);
  fs(ctx, '#ab47bc');
  ctx.beginPath();
  for (let k = 0; k <= 60; k++) {
    const a = k * 0.21;
    const r = 25 - k * 0.38;
    const x = 44 + Math.cos(a) * r;
    const y = 72 + Math.sin(a) * r;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = '#6a1b9a';
  ctx.lineWidth = 3;
  ctx.stroke();
  shine(ctx, 32, 56, 7, 4, -0.6);
};

/** the mooncake with a neutral stamp (a ring of dots instead of the four-petal cross-like flower) */
const mooncakeRing = (ctx: C) => {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const x = 50 + Math.cos(a) * 36;
    const y = 68 + Math.sin(a) * 36;
    ctx.moveTo(x + 7, y);
    ctx.arc(x, y, 7, 0, Math.PI * 2);
  }
  fs(ctx, '#c98a3c', 2);
  circle(ctx, 50, 68, 36);
  fs(ctx, '#e0a85a');
  circle(ctx, 50, 68, 24);
  fs(ctx, '#d39445', 2);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    circle(ctx, 50 + Math.cos(a) * 15, 68 + Math.sin(a) * 15, 3.2);
    fs(ctx, '#e8b56a', 1.4);
  }
  circle(ctx, 50, 68, 7);
  fs(ctx, '#e8b56a', 1.6);
  shine(ctx, 34, 52, 6, 3, -0.6);
};

// GamePix and Playgama builds: neutral pictures instead of religious-looking ones
if (__PLATFORM__ === 'gamepix' || __PLATFORM__ === 'playgama') {
  GARDEN_TILES[1] = { name: 'tulip', draw: tulip };
  GARDEN_TILES[16] = { name: 'bonsai', draw: bonsai };
  GARDEN_TILES[21] = { name: 'mooncake', draw: mooncakeRing };
  GARDEN_TILES[26] = { name: 'watering can', draw: wateringCan };
  GARDEN_TILES[32] = { name: 'snail', draw: snail };
}

/** draw a Garden picture into the 100 x 134 face box (slightly enlarged: pictures fill the tile) */
export function drawGardenFace(ctx: C, face: number) {
  const t = GARDEN_TILES[face];
  if (!t) return;
  ctx.save();
  ctx.translate(50, 67);
  ctx.scale(1.11, 1.11);
  ctx.translate(-50, -67);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  t.draw(ctx);
  ctx.restore();
}
