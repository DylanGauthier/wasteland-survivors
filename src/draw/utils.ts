import { bx } from '../canvas';
import { drawText, textWidth } from '../font';

export function drawButton(label: string, x: number, y: number, w: number, h: number, hovered: boolean, color: string) {
  bx.fillStyle = hovered ? '#1a1a33' : '#0a0a18';
  bx.fillRect(x, y, w, h);

  const borderCol = hovered ? '#ffffff' : color;
  const bw = hovered ? 2 : 1;
  bx.fillStyle = borderCol;
  bx.fillRect(x, y, w, bw); bx.fillRect(x, y + h - bw, w, bw);
  bx.fillRect(x, y, bw, h); bx.fillRect(x + w - bw, y, bw, h);

  if (hovered) {
    bx.fillStyle = color;
    bx.globalAlpha = 0.1;
    bx.fillRect(x, y, w, h);
    bx.globalAlpha = 1;
  }

  const tx = x + (w - textWidth(label, 2)) / 2;
  const ty = y + (h - 12) / 2;
  drawText(label, tx, ty, hovered ? '#ffffff' : color, 2);
}
