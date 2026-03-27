import { VIEW_W, VIEW_H } from '../constants';
import { bx } from '../canvas';
import { titleState, PLAYER_COLORS, playerNames } from '../state';
import { mouse } from '../input';
import { drawText, textWidth } from '../font';
import { drawWallEye } from './map-effects';
import { drawButton } from './utils';

// Pre-generate title screen wall eyes
export const titleEyes: { cx: number; cy: number; radius: number }[] = [];
for (let attempt = 0; attempt < 200 && titleEyes.length < 18; attempt++) {
  const r = 6 + Math.random() * 12;
  const ex = 30 + Math.random() * (VIEW_W - 60);
  const ey = 20 + Math.random() * (VIEW_H - 40);
  let overlaps = false;
  for (const e of titleEyes) {
    const dx = ex - e.cx, dy = ey - e.cy;
    const minDist = (r + e.radius) * 2.5;
    if (dx * dx + dy * dy < minDist * minDist) { overlaps = true; break; }
  }
  if (!overlaps) titleEyes.push({ cx: ex, cy: ey, radius: r });
}

// Pre-generate brick pattern for title
export const titleBricks: { x: number; y: number; w: number; h: number }[] = [];
for (let row = 0; row < VIEW_H / 8; row++) {
  const offset = (row % 2) * 12;
  for (let col = -1; col < VIEW_W / 24 + 1; col++) {
    titleBricks.push({
      x: col * 24 + offset,
      y: row * 8,
      w: 22 + Math.floor(Math.random() * 3),
      h: 7,
    });
  }
}

export function drawTitle() {
  const t = Date.now();

  bx.fillStyle = '#080610';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (const brick of titleBricks) {
    const h = ((brick.x * 7 + brick.y * 13) & 0xff) / 255;
    const r = Math.floor(8 + h * 6);
    const g = Math.floor(6 + h * 4);
    const b = Math.floor(14 + h * 8);
    bx.fillStyle = `rgb(${r},${g},${b})`;
    bx.fillRect(brick.x, brick.y, brick.w, brick.h);
  }

  for (const eye of titleEyes) {
    drawWallEye(eye.cx, eye.cy, eye.radius, mouse.x, mouse.y, t);
  }

  for (const p of titleState.ashParticles) {
    const alpha = Math.min(1, p.life / 100);
    bx.fillStyle = '#555544';
    bx.globalAlpha = alpha * 0.6;
    bx.fillRect(Math.floor(p.x), Math.floor(p.y), 1 + (p.life > 200 ? 1 : 0), 1);
  }
  bx.globalAlpha = 1;

  const vGrad = bx.createRadialGradient(VIEW_W / 2, 120, 100, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65);
  vGrad.addColorStop(0, 'rgba(2,1,4,0)');
  vGrad.addColorStop(0.6, 'rgba(2,1,4,0.7)');
  vGrad.addColorStop(1, 'rgba(2,1,4,0.92)');
  bx.fillStyle = vGrad;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const titlePulse = Math.sin(t * 0.002) * 0.15 + 0.85;
  const title = 'WASTELAND SURVIVORS';
  const titleX = VIEW_W / 2 - textWidth(title, 4) / 2;
  bx.fillStyle = '#aa66ff';
  bx.globalAlpha = titlePulse * 0.08;
  bx.fillRect(titleX - 10, 60, textWidth(title, 4) + 20, 30);
  bx.globalAlpha = 1;
  drawText(title, titleX, 65, '#aa66ff', 4);

  const sub = 'SURVIVEZ AUX ABYSSES';
  drawText(sub, VIEW_W / 2 - textWidth(sub, 1) / 2, 100, '#555577', 1);

  bx.fillStyle = '#221833';
  bx.fillRect(VIEW_W / 2 - 100, 115, 200, 1);

  if (titleState.mode === 0) {
    const btnW = 160, btnH = 30;
    const btnX = VIEW_W / 2 - btnW / 2;
    const btn1Y = 140, btn2Y = 180;
    const h1 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= btn1Y && mouse.y <= btn1Y + btnH;
    const h2 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= btn2Y && mouse.y <= btn2Y + btnH;
    if (h1) titleState.cursor = 0;
    if (h2) titleState.cursor = 1;
    drawButton('1 JOUEUR', btnX, btn1Y, btnW, btnH, h1 || titleState.cursor === 0, '#aa66ff');
    drawButton('2 JOUEURS', btnX, btn2Y, btnW, btnH, h2 || titleState.cursor === 1, '#44ddff');
    const arrowY = titleState.cursor === 0 ? btn1Y : btn2Y;
    drawText('>', btnX - 16, arrowY + 9, '#ffffff', 2);
    const hint = 'OU APPUYEZ 1 / 2';
    drawText(hint, VIEW_W / 2 - textWidth(hint, 1) / 2, 225, '#333355', 1);
  } else if (titleState.mode === 1) {
    const pNum = titleState.editingPlayer + 1;
    const label = titleState.playerCount === 2 ? 'JOUEUR ' + pNum : 'VOTRE NOM';
    drawText(label, VIEW_W / 2 - textWidth(label, 2) / 2, 140, '#8888aa', 2);
    const boxW = 200, boxH = 28, boxX = VIEW_W / 2 - boxW / 2, boxY = 170;
    bx.fillStyle = '#111122';
    bx.fillRect(boxX, boxY, boxW, boxH);
    bx.fillStyle = '#666688';
    bx.fillRect(boxX, boxY, boxW, 1); bx.fillRect(boxX, boxY + boxH, boxW, 1);
    bx.fillRect(boxX, boxY, 1, boxH); bx.fillRect(boxX + boxW, boxY, 1, boxH);
    const cur = Math.floor(t / 500) % 2 === 0 ? '_' : '';
    const nameDisp = titleState.nameInput + cur;
    drawText(nameDisp, boxX + (boxW - textWidth(nameDisp, 2)) / 2, boxY + 8, '#ffffff', 2);
  } else if (titleState.mode === 2) {
    const pName = playerNames[titleState.editingPlayer];
    const label = 'COULEUR DE ' + pName;
    drawText(label, VIEW_W / 2 - textWidth(label, 2) / 2, 135, '#8888aa', 2);
    const colSize = 20, colGap = 6;
    const totalColW = PLAYER_COLORS.length * (colSize + colGap) - colGap;
    const colStartX = VIEW_W / 2 - totalColW / 2;
    const colY = 165;
    for (let ci = 0; ci < PLAYER_COLORS.length; ci++) {
      const cx = colStartX + ci * (colSize + colGap);
      const isSelected = titleState.cursor === ci;
      const isOther = titleState.editingPlayer === 1 && titleState.selectedColors[0] === ci;
      const isHovered = mouse.x >= cx && mouse.x <= cx + colSize && mouse.y >= colY && mouse.y <= colY + colSize;
      bx.fillStyle = isOther ? '#222233' : PLAYER_COLORS[ci].color;
      bx.fillRect(cx, colY, colSize, colSize);
      if (isSelected) {
        bx.fillStyle = '#ffffff';
        bx.fillRect(cx - 2, colY - 2, colSize + 4, 2);
        bx.fillRect(cx - 2, colY + colSize, colSize + 4, 2);
        bx.fillRect(cx - 2, colY - 2, 2, colSize + 4);
        bx.fillRect(cx + colSize, colY - 2, 2, colSize + 4);
      } else if (isHovered && !isOther) {
        bx.fillStyle = '#888888';
        bx.fillRect(cx - 1, colY - 1, colSize + 2, 1);
        bx.fillRect(cx - 1, colY + colSize, colSize + 2, 1);
        bx.fillRect(cx - 1, colY - 1, 1, colSize + 2);
        bx.fillRect(cx + colSize, colY - 1, 1, colSize + 2);
      }
      if (isOther) drawText('X', cx + colSize / 2 - 5, colY + colSize / 2 - 6, '#666666', 1);
    }
    const cName = PLAYER_COLORS[titleState.cursor].name;
    drawText(cName, VIEW_W / 2 - textWidth(cName, 2) / 2, colY + colSize + 10, PLAYER_COLORS[titleState.cursor].color, 2);
  }

  const ver = 'V0.3';
  drawText(ver, VIEW_W - textWidth(ver, 1) - 4, VIEW_H - 10, '#222233', 1);
}
