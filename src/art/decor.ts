/** Small decorative shapes shared by the table, the title, the cover and the garden. */

type C = CanvasRenderingContext2D;

export function blossomShape(ctx: C, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a434';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A red paper lantern hanging from y0 on a cord of length `cord`, body radius r. Soft glow behind it.
 */
export function drawLantern(ctx: C, x: number, y0: number, r: number, cord: number, alpha = 1, lit = true) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const cy = y0 + cord + r * 1.05;
  ctx.strokeStyle = 'rgba(30, 20, 10, 0.8)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, cy - r);
  ctx.stroke();
  if (lit) {
    const glow = ctx.createRadialGradient(x, cy, r * 0.2, x, cy, r * 2.6);
    glow.addColorStop(0, 'rgba(255, 170, 90, 0.35)');
    glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, cy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  const body = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.2, r * 0.1, x, cy, r * 1.1);
  body.addColorStop(0, lit ? '#f05a3c' : '#b8332a');
  body.addColorStop(0.7, '#b8231f');
  body.addColorStop(1, '#7c1414');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, cy, r * 1.0, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  // ribs
  ctx.strokeStyle = 'rgba(90, 10, 10, 0.45)';
  ctx.lineWidth = Math.max(0.6, r * 0.035);
  for (const k of [-0.6, -0.25, 0.25, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(x, cy, Math.abs(k) * r, r * 0.88, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    ctx.stroke();
  }
  // caps
  ctx.fillStyle = '#c9a042';
  ctx.fillRect(x - r * 0.45, cy - r * 0.98, r * 0.9, r * 0.2);
  ctx.fillRect(x - r * 0.45, cy + r * 0.78, r * 0.9, r * 0.2);
  // tassel
  ctx.strokeStyle = '#c9a042';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, cy + r * 0.98);
  ctx.lineTo(x, cy + r * 1.3);
  ctx.stroke();
  ctx.fillStyle = '#b8231f';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, cy + r * 1.3);
  ctx.lineTo(x + r * 0.12, cy + r * 1.3);
  ctx.lineTo(x + r * 0.2, cy + r * 1.9);
  ctx.lineTo(x - r * 0.2, cy + r * 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
