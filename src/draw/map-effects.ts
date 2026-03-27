import { bx } from '../canvas';

export function drawWallEye(cx: number, cy: number, radius: number, targetX: number, targetY: number, t: number) {
  const r = Math.floor(radius);
  const blinkPhase = Math.sin(t * 0.002 + cx * 0.1 + cy * 0.07);
  const blinkScale = blinkPhase > 0.92 ? 0.1 : blinkPhase > 0.88 ? 0.5 : 1;

  const aspect = 2.2;
  const taper = 0.6;

  for (let dy = -(r + 2); dy <= r + 2; dy++) {
    if (Math.abs(dy) > (r + 2) * blinkScale) continue;
    const t2 = Math.abs(dy) / (r + 2);
    const rowW = Math.floor((r + 2) * aspect * Math.pow(1 - t2 * t2, taper));
    bx.fillStyle = '#1a0e28';
    bx.fillRect(cx - rowW, cy + dy, rowW * 2, 1);
  }

  for (let dy = -r; dy <= r; dy++) {
    if (Math.abs(dy) > r * blinkScale) continue;
    const t2 = Math.abs(dy) / r;
    const rowW = Math.floor(r * aspect * Math.pow(1 - t2 * t2, taper));
    bx.fillStyle = '#050308';
    bx.fillRect(cx - rowW, cy + dy, rowW * 2, 1);
  }

  if (blinkScale < 0.3) return;

  const dx = targetX - cx, dy2 = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy2 * dy2);
  const maxOff = r * 0.3;
  const offX = dist > 0 ? (dx / dist) * Math.min(maxOff, dist * 0.08) : 0;
  const offY = dist > 0 ? (dy2 / dist) * Math.min(maxOff, dist * 0.08) : 0;

  const irisR = Math.floor(r * 0.45);
  const ix = Math.floor(cx + offX), iy = Math.floor(cy + offY);
  for (let iyd = -irisR; iyd <= irisR; iyd++) {
    const iw = Math.floor(Math.sqrt(irisR * irisR - iyd * iyd));
    bx.fillStyle = '#220033';
    bx.fillRect(ix - iw, iy + iyd, iw * 2, 1);
  }

  const pupilR = Math.max(2, Math.floor(r * 0.22));
  bx.fillStyle = '#ff2244';
  for (let pyd = -pupilR; pyd <= pupilR; pyd++) {
    const pw = Math.floor(Math.sqrt(pupilR * pupilR - pyd * pyd));
    bx.fillRect(ix - pw, iy + pyd, pw * 2, 1);
  }

  bx.fillStyle = '#ff4466';
  bx.globalAlpha = 0.3;
  for (let gyd = -pupilR - 2; gyd <= pupilR + 2; gyd++) {
    const gw = Math.floor(Math.sqrt((pupilR + 2) * (pupilR + 2) - gyd * gyd));
    bx.fillRect(ix - gw, iy + gyd, gw * 2, 1);
  }
  bx.globalAlpha = 1;

  bx.fillStyle = '#ff8888';
  bx.fillRect(ix - Math.floor(pupilR * 0.4), iy - Math.floor(pupilR * 0.4), 2, 2);
}
