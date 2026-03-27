import { VIEW_W, VIEW_H, FPS, GAME_DURATION, MAX_UPGRADES, MAX_UPGRADE_LEVEL, COL, TILE } from '../constants';
import { bx } from '../canvas';
import { game, players, player, playerNames } from '../state';
import { drawText, textWidth, drawIcon, formatTime } from '../font';
import { UPGRADES } from '../data/upgrades';
import { SUPER_RARES } from '../data/super-rares';
import { Music } from '../audio/MusicEngine';

export function drawHUD() {
  const timeRatio = Math.min(1, game.time / GAME_DURATION);
  const barW = VIEW_W - 8;
  bx.fillStyle = '#111111';
  bx.fillRect(4, 4, barW, 6);
  const timeColor = timeRatio > 0.8 ? '#ff3333' : timeRatio > 0.5 ? '#ffaa33' : '#44cc44';
  bx.fillStyle = timeColor;
  bx.fillRect(4, 4, Math.floor(barW * timeRatio), 6);
  bx.fillStyle = '#ffffff';
  bx.fillRect(4, 4, Math.floor(barW * timeRatio), 1);
  const timeLeft = formatTime(GAME_DURATION - game.time);
  drawText(timeLeft, VIEW_W / 2 - textWidth(timeLeft, 1) / 2, 5, '#ffffff', 1);

  const p1 = players[0];
  const hpBarW = 80;
  const hpRatio = Math.max(0, p1.hp / p1.maxHp);
  bx.fillStyle = '#220000';
  bx.fillRect(4, 14, hpBarW, 8);
  const hpColor = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#ccaa22' : '#cc3333';
  bx.fillStyle = hpColor;
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 8);
  bx.fillStyle = '#ffffff';
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 1);
  drawText(playerNames[0] + ' ' + Math.max(0, p1.hp) + '/' + p1.maxHp, 6, 15, '#ffffff', 1);

  const p2 = players[1];
  const p2hpX = VIEW_W - hpBarW - 6;
  const p2hpY = 14;
  if (!p2.dead) {
    const p2hpR = Math.max(0, p2.hp / p2.maxHp);
    bx.fillStyle = '#220000';
    bx.fillRect(p2hpX, p2hpY, hpBarW, 8);
    const p2hpCol = p2hpR > 0.5 ? '#44cc44' : p2hpR > 0.25 ? '#ccaa22' : '#cc3333';
    bx.fillStyle = p2hpCol;
    bx.fillRect(p2hpX, p2hpY, Math.floor(hpBarW * p2hpR), 8);
    bx.fillStyle = '#ffffff';
    bx.fillRect(p2hpX, p2hpY, Math.floor(hpBarW * p2hpR), 1);
    drawText(playerNames[1] + ' ' + Math.max(0, p2.hp) + '/' + p2.maxHp, p2hpX + 2, p2hpY + 1, '#ffffff', 1);
  } else {
    drawText(playerNames[1] + ' MORT', p2hpX + 2, p2hpY + 1, '#ff4444', 1);
  }

  const xpBarY = VIEW_H - 10;
  const xpBarW = barW;
  const xpRatio = game.xp / game.xpToLevel;
  bx.fillStyle = '#113333';
  bx.fillRect(4, xpBarY, xpBarW, 7);
  bx.fillStyle = COL.xpOrb;
  bx.fillRect(4, xpBarY, Math.floor(xpBarW * xpRatio), 7);
  bx.fillStyle = COL.xpOrbGlow;
  bx.fillRect(4, xpBarY, Math.floor(xpBarW * xpRatio), 1);
  const lvText = 'NV ' + game.level;
  drawText(lvText, 4 + xpBarW / 2 - textWidth(lvText, 1) / 2, xpBarY + 1, '#ffffff', 1);

  for (const deadP of players) {
    if (!deadP.dead || deadP.reviveProgress <= 0) continue;
    const revBarY = xpBarY - 12;
    const revBarW = barW;
    bx.fillStyle = '#111122';
    bx.fillRect(4, revBarY, revBarW, 8);
    bx.fillStyle = deadP.visorColor;
    bx.fillRect(4, revBarY, Math.floor(revBarW * deadP.reviveProgress), 8);
    bx.fillStyle = '#ffffff';
    bx.fillRect(4, revBarY, Math.floor(revBarW * deadP.reviveProgress), 1);
    const revText = 'REVIVE ' + playerNames[deadP.playerIndex];
    drawText(revText, 4 + revBarW / 2 - textWidth(revText, 1) / 2, revBarY + 1, '#ffffff', 1);
  }

  const barY = VIEW_H - 24;
  const upgrades = Array.from(p1.upgradeLevels.entries());
  let ux = 4;
  for (let s = 0; s < MAX_UPGRADES; s++) {
    bx.fillStyle = '#111122';
    bx.fillRect(ux + s * 18, barY, 14, 12);
    bx.fillStyle = '#222233';
    bx.fillRect(ux + s * 18, barY, 14, 1);
    bx.fillRect(ux + s * 18, barY + 11, 14, 1);
    bx.fillRect(ux + s * 18, barY, 1, 12);
    bx.fillRect(ux + s * 18 + 13, barY, 1, 12);
  }
  for (let i = 0; i < upgrades.length; i++) {
    const [id, lv] = upgrades[i];
    const upg = UPGRADES.find(u => u.id === id);
    if (upg) {
      const upgColor = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
      drawIcon(upg.icon, ux + i * 18 + 2, barY + 2, upgColor);
      drawText('' + lv, ux + i * 18 + 8, barY + 2, '#ffffff', 1);
    }
  }

  if (!p2.dead) {
    const upgrades2 = Array.from(p2.upgradeLevels.entries());
    const ux2 = VIEW_W - 4 - MAX_UPGRADES * 18;
    for (let s = 0; s < MAX_UPGRADES; s++) {
      bx.fillStyle = '#111122';
      bx.fillRect(ux2 + s * 18, barY, 14, 12);
      bx.fillStyle = '#222233';
      bx.fillRect(ux2 + s * 18, barY, 14, 1);
      bx.fillRect(ux2 + s * 18, barY + 11, 14, 1);
      bx.fillRect(ux2 + s * 18, barY, 1, 12);
      bx.fillRect(ux2 + s * 18 + 13, barY, 1, 12);
    }
    for (let i = 0; i < upgrades2.length; i++) {
      const [id, lv] = upgrades2[i];
      const upg = UPGRADES.find(u => u.id === id);
      if (upg) {
        const upgColor = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
        drawIcon(upg.icon, ux2 + i * 18 + 2, barY + 2, upgColor);
        drawText('' + lv, ux2 + i * 18 + 8, barY + 2, '#ffffff', 1);
      }
    }
  }

  if (p1.activeSkill) {
    const skX = VIEW_W - 50;
    const skY = VIEW_H - 30;
    const sk = p1.activeSkill;
    const cdRatio = p1.skillCooldown / sk.cooldown;
    bx.fillStyle = '#111122';
    bx.fillRect(skX, skY, 46, 22);
    if (cdRatio > 0) {
      bx.fillStyle = '#333344';
      bx.fillRect(skX, skY, Math.floor(46 * (1 - cdRatio)), 22);
    } else {
      bx.fillStyle = sk.color;
      bx.globalAlpha = 0.15;
      bx.fillRect(skX, skY, 46, 22);
      bx.globalAlpha = 1;
    }
    bx.fillStyle = cdRatio > 0 ? '#555566' : sk.color;
    bx.fillRect(skX, skY, 46, 1);
    bx.fillRect(skX, skY + 21, 46, 1);
    bx.fillRect(skX, skY, 1, 22);
    bx.fillRect(skX + 45, skY, 1, 22);
    if (sk.icon) drawIcon(sk.icon, skX + 3, skY + 4, cdRatio > 0 ? '#555566' : sk.color);
    drawText(sk.name, skX + 10, skY + 3, cdRatio > 0 ? '#666677' : sk.color, 1);
    if (cdRatio > 0) {
      const cdSec = Math.ceil(p1.skillCooldown / FPS);
      drawText(cdSec + 'S', skX + 10, skY + 12, '#888899', 1);
    } else {
      drawText('PRET', skX + 10, skY + 12, '#44ff88', 1);
    }
  }

  if (p1.activeSuperRares.length > 0) {
    let srY = 56;
    for (const srId of p1.activeSuperRares) {
      const sr = SUPER_RARES.find(s => s.id === srId);
      if (sr) {
        drawIcon(sr.icon, VIEW_W - 12, srY, sr.color);
        srY += 8;
      }
    }
  }

  if (Music.isPlaying()) {
    const tn = Music.getTrackName();
    drawText(tn, VIEW_W - textWidth(tn, 1) - 4, VIEW_H - 24, '#333344', 1);
  }

  const alivePlayers = players.filter(p => !p.dead);
  const midPXh = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.x, 0) / alivePlayers.length : players[0].x;
  const midPYh = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.y, 0) / alivePlayers.length : players[0].y;
  const hudCamX = midPXh - VIEW_W / 2;
  const hudCamY = midPYh - VIEW_H / 2;
  for (const pp of players) {
    if (pp.dead) continue;
    const sx = pp.x - hudCamX, sy = pp.y - hudCamY;
    if (sx < -10 || sx > VIEW_W + 10 || sy < -10 || sy > VIEW_H + 10) {
      const cx = Math.max(20, Math.min(VIEW_W - 20, sx));
      const cy = Math.max(20, Math.min(VIEW_H - 20, sy));
      const pulse = Math.sin(game.time * 0.1) * 0.3 + 0.7;
      bx.fillStyle = pp.visorColor;
      bx.globalAlpha = pulse;
      const arrowSize = 6;
      bx.beginPath();
      if (sx < -10) {
        bx.moveTo(4, cy); bx.lineTo(4 + arrowSize, cy - arrowSize); bx.lineTo(4 + arrowSize, cy + arrowSize);
      } else if (sx > VIEW_W + 10) {
        bx.moveTo(VIEW_W - 4, cy); bx.lineTo(VIEW_W - 4 - arrowSize, cy - arrowSize); bx.lineTo(VIEW_W - 4 - arrowSize, cy + arrowSize);
      } else if (sy < -10) {
        bx.moveTo(cx, 4); bx.lineTo(cx - arrowSize, 4 + arrowSize); bx.lineTo(cx + arrowSize, 4 + arrowSize);
      } else {
        bx.moveTo(cx, VIEW_H - 4); bx.lineTo(cx - arrowSize, VIEW_H - 4 - arrowSize); bx.lineTo(cx + arrowSize, VIEW_H - 4 - arrowSize);
      }
      bx.fill();
      bx.globalAlpha = 1;
      const pName = playerNames[pp.playerIndex];
      drawText(pName, cx - textWidth(pName, 1) / 2, cy < VIEW_H / 2 ? cy + 10 : cy - 12, pp.visorColor, 1);
    }
  }
}
