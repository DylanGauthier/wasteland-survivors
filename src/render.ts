import { TILE, SCALE, VIEW_W, VIEW_H, MAP_W, MAP_H, COL } from './constants';
import { canvas, ctx, buf, bx, bloomBuf, bloomCtx } from './canvas';
import { dist2, aimDir } from './math';
import { drawText, textWidth } from './font';
import {
  game, players, player, weapon, playerNames,
  lasers, enemies, particles, drops, chests, chainArcs,
  dmgNumbers, ashRain, shockRings, fallingMeteors,
  bladeProjs, beamLines, dangerZones,
} from './state';
import { map } from './map';
import { veins, wallEyes } from './map';
import { mouse } from './input';
import { drawTile } from './draw/tiles';
import { drawWallEye } from './draw/map-effects';
import { drawPlayerCoOp } from './draw/player';
import { drawEnemy } from './draw/enemies';
import { drawDrop, drawChest } from './draw/entities';
import { drawTitle } from './draw/title';
import { drawHUD } from './draw/hud';
import { drawSelectionScreen, drawCodex, drawGameOver } from './draw/screens';
import { drawButton } from './draw/utils';
import { titleState } from './state';

export function render() {
  canvas.style.cursor = (game.state === 'title' || game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare') ? 'default' : 'none';

  if (game.state === 'title') {
    drawTitle();
    ctx.drawImage(buf, 0, 0, VIEW_W * SCALE, VIEW_H * SCALE);
    return;
  }

  let shakeX = 0, shakeY = 0;
  if (game.shakeTimer > 0) {
    shakeX = (Math.random() - 0.5) * game.shakeTimer;
    shakeY = (Math.random() - 0.5) * game.shakeTimer;
    game.shakeTimer--;
  }

  const aliveCamPlayers = players.filter(p => !p.dead);
  const camMidX = aliveCamPlayers.length > 0 ? aliveCamPlayers.reduce((s, p) => s + p.x, 0) / aliveCamPlayers.length : players[0].x;
  const camMidY = aliveCamPlayers.length > 0 ? aliveCamPlayers.reduce((s, p) => s + p.y, 0) / aliveCamPlayers.length : players[0].y;
  const camX = Math.floor(camMidX - VIEW_W / 2 + shakeX);
  const camY = Math.floor(camMidY - VIEW_H / 2 + shakeY);

  bx.fillStyle = COL.sky;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Fissures
  const fissurePulse = Math.sin(game.time * 0.02) * 0.3 + 0.6;
  for (const vein of veins) {
    if (vein.segments.length < 2) continue;
    let visible = false;
    for (const p of vein.segments) {
      const vsx = p.x - camX, vsy = p.y - camY;
      if (vsx > -40 && vsx < VIEW_W + 40 && vsy > -40 && vsy < VIEW_H + 40) { visible = true; break; }
    }
    if (!visible) continue;
    const totalSegs = vein.segments.length - 1;
    for (let i = 0; i < totalSegs; i++) {
      const t = i / Math.max(1, vein.targetLen);
      const x1 = vein.segments[i].x - camX, y1 = vein.segments[i].y - camY;
      const x2 = vein.segments[i + 1].x - camX, y2 = vein.segments[i + 1].y - camY;
      const width = Math.max(1, vein.width * (1 - t));
      bx.strokeStyle = '#000000';
      bx.globalAlpha = 0.7;
      bx.lineWidth = width + 1;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      bx.globalCompositeOperation = 'lighter';
      bx.strokeStyle = t < 0.4 ? '#ff3300' : '#ff5500';
      bx.globalAlpha = (0.25 + fissurePulse * 0.3) * (1 - t * 0.6);
      bx.lineWidth = width;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      bx.globalCompositeOperation = 'source-over';
    }
    bx.globalAlpha = 1; bx.lineWidth = 1;
  }

  // Tiles
  const startTX = Math.floor(camX / TILE);
  const startTY = Math.floor(camY / TILE);
  const endTX = startTX + Math.ceil(VIEW_W / TILE) + 1;
  const endTY = startTY + Math.ceil(VIEW_H / TILE) + 1;
  for (let ty = startTY; ty <= endTY; ty++)
    for (let tx = startTX; tx <= endTX; tx++) {
      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) continue;
      drawTile(tx * TILE - camX, ty * TILE - camY, map[ty][tx], tx, ty);
    }

  // Wall Eyes
  for (const we of wallEyes) {
    const sz = (we as any).size || 20;
    const esx = we.x - camX, esy = we.y - camY;
    if (esx < -sz * 2 || esx > VIEW_W + sz * 2 || esy < -sz * 2 || esy > VIEW_H + sz * 2) continue;
    const eyeTarget = players.reduce((best, p) => !p.dead && dist2(p, we) < dist2(best, we) ? p : best, players[0]);
    const targetSX = eyeTarget.x - camX;
    const targetSY = eyeTarget.y - camY;
    drawWallEye(Math.floor(esx), Math.floor(esy), Math.floor(sz * 0.5), targetSX, targetSY, game.time * 16);
  }

  // Chests
  for (const ch of chests) {
    const sx = ch.x - camX, sy = ch.y - camY;
    if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) drawChest(ch, sx, sy);
  }

  // Drops
  for (const dr of drops) {
    const sx = dr.x - camX, sy = dr.y - camY;
    if (sx > -10 && sx < VIEW_W + 10 && sy > -10 && sy < VIEW_H + 10) drawDrop(dr, sx, sy);
  }

  // Enemies
  for (const e of enemies) {
    const sx = e.x - camX, sy = e.y - camY;
    if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) drawEnemy(e, sx, sy);
  }

  // Danger zones
  for (const dz of dangerZones) {
    const dzx = dz.x - camX, dzy = dz.y - camY;
    if (dzx < -50 || dzx > VIEW_W + 50 || dzy < -50 || dzy > VIEW_H + 50) continue;
    if (dz.warnTime > 0) {
      const pulse = Math.sin(game.time * 0.15) * 0.15 + 0.25;
      const shrink = dz.warnTime / 90;
      bx.strokeStyle = '#ff2244';
      bx.globalAlpha = pulse + (1 - shrink) * 0.3;
      bx.lineWidth = 1;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), dz.radius * shrink + dz.radius * 0.3, 0, Math.PI * 2);
      bx.stroke();
      bx.fillStyle = '#ff0022';
      bx.globalAlpha = (1 - shrink) * 0.15;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), dz.radius, 0, Math.PI * 2);
      bx.fill();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
    } else {
      const explFrame = -dz.warnTime;
      const expandR = dz.radius + explFrame * 3;
      bx.globalCompositeOperation = 'lighter';
      bx.strokeStyle = '#ff4444';
      bx.globalAlpha = Math.max(0, 1 - explFrame / 15);
      bx.lineWidth = 3;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), expandR, 0, Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
      bx.globalCompositeOperation = 'source-over';
    }
  }

  // Poison trail / fire ground
  const hasMeteor = players.some(p => p.activeCombos.includes('meteor'));
  const hasPoison = players.some(p => p.activeSuperRares.includes('poison_trail'));
  const allPoisonTrails = players.flatMap(p => p.poisonTrails);
  for (const pt of allPoisonTrails) {
    const ptx = pt.x - camX, pty = pt.y - camY;
    if (ptx > -10 && ptx < VIEW_W + 10 && pty > -10 && pty < VIEW_H + 10) {
      const fade = Math.min(0.6, pt.life / 300);
      bx.globalAlpha = fade;
      if (hasMeteor && !hasPoison) {
        const flicker = Math.sin(game.time * 0.2 + pt.x * 0.1) > 0;
        bx.fillStyle = flicker ? '#ff4400' : '#ff8800';
        bx.fillRect(ptx - 5, pty - 5, 10, 10);
        bx.fillStyle = flicker ? '#ffaa00' : '#ff6600';
        bx.fillRect(ptx - 3, pty - 3, 6, 6);
        bx.fillStyle = '#ffcc44';
        bx.globalAlpha = fade * 0.5;
        bx.fillRect(ptx - 1, pty - 4, 2, 3);
      } else {
        bx.fillStyle = '#44ff44';
        bx.fillRect(ptx - 4, pty - 4, 8, 8);
        bx.fillStyle = '#22aa22';
        bx.fillRect(ptx - 2, pty - 2, 4, 4);
      }
      bx.globalAlpha = 1;
    }
  }

  // Ghost trail
  for (const pp of players) {
    if (pp.dead) continue;
    for (const g of pp.ghostTrail) {
      const gx = g.x - camX, gy = g.y - camY;
      const alpha = Math.max(0, 0.25 - g.age * 0.01);
      if (alpha > 0) {
        bx.globalAlpha = alpha;
        bx.fillStyle = pp.visorColor;
        bx.fillRect(Math.floor(gx) - 4, Math.floor(gy) - 5, 8, 10);
        bx.fillRect(Math.floor(gx) - 3, Math.floor(gy) - 8, 6, 5);
        bx.globalAlpha = 1;
      }
    }
  }

  // Death auras
  for (const pp of players) {
    if (!pp.dead) continue;
    const dx = pp.deathX - camX, dy = pp.deathY - camY;
    if (dx < -60 || dx > VIEW_W + 60 || dy < -60 || dy > VIEW_H + 60) continue;
    const REVIVE_RADIUS = 50;
    const pulse = Math.sin(game.time * 0.05) * 0.15 + 0.35;
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = pp.visorColor;
    bx.globalAlpha = pulse * 0.4;
    bx.lineWidth = 2;
    bx.beginPath();
    bx.arc(dx, dy, REVIVE_RADIUS, 0, Math.PI * 2);
    bx.stroke();
    bx.globalAlpha = pulse * 0.1;
    bx.fillStyle = pp.visorColor;
    bx.beginPath();
    bx.arc(dx, dy, REVIVE_RADIUS, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    drawText('X', dx - 5, dy - 6, pp.visorColor, 2);
    const deadName = playerNames[pp.playerIndex];
    drawText(deadName, dx - textWidth(deadName, 1) / 2, dy + 10, pp.visorColor, 1);
    if (pp.reviveProgress > 0) {
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 3;
      bx.globalAlpha = 0.8;
      bx.beginPath();
      bx.arc(dx, dy, REVIVE_RADIUS - 3, -Math.PI / 2, -Math.PI / 2 + pp.reviveProgress * Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
    }
  }

  // Draw players + names
  for (const pp of players) {
    if (pp.dead) continue;
    if (game.state !== 'gameover') {
      drawPlayerCoOp(pp, pp.x - camX, pp.y - camY);
      const pName = playerNames[pp.playerIndex];
      const nameX = pp.x - camX - textWidth(pName, 1) / 2;
      drawText(pName, nameX, pp.y - camY - 14, pp.visorColor, 1);
    }
  }

  // Per-player visuals
  for (const pp of players) {
    if (pp.dead) continue;
    if (pp.activeSuperRares.includes('shield_orb') && pp.shieldOrbActive) {
      const px = pp.x - camX, py = pp.y - camY;
      bx.strokeStyle = '#44aaff';
      bx.globalAlpha = 0.4 + Math.sin(game.time * 0.1) * 0.2;
      bx.beginPath();
      bx.arc(Math.floor(px), Math.floor(py), 12, 0, Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
    }
    if (pp.skillActive > 0 && pp.activeSkill?.id === 'shield_skill') {
      const px = pp.x - camX, py = pp.y - camY;
      bx.strokeStyle = '#4488ff';
      bx.globalAlpha = 0.6;
      bx.lineWidth = 2;
      bx.beginPath();
      bx.arc(Math.floor(px), Math.floor(py), 16, 0, Math.PI * 2);
      bx.stroke();
      bx.lineWidth = 1;
      bx.globalAlpha = 1;
    }
    if (pp.droneCount > 0) {
      for (let i = 0; i < pp.droneCount; i++) {
        const angle = pp.droneAngle + (i / pp.droneCount) * Math.PI * 2;
        const dx = pp.x + Math.cos(angle) * 40 - camX;
        const dy = pp.y + Math.sin(angle) * 40 - camY;
        bx.fillStyle = '#44ccff';
        bx.fillRect(Math.floor(dx) - 3, Math.floor(dy) - 3, 6, 6);
        bx.fillStyle = '#88ddff';
        bx.fillRect(Math.floor(dx) - 1, Math.floor(dy) - 1, 2, 2);
      }
    }
  }

  // Blade storm, death ray, beam lines, second life, warp field, bullet time, shock rings, falling meteors, black hole, orbital, shadow clone, lasers, chain arcs, particles, damage numbers, chest indicators, fog, HUD, pause, selection, game over, crosshair, codex, damage flash, ash rain, lightning, vignette, low HP, bloom, upscale
  // (These are all the remaining render sections from the original, kept inline for reliability)

  // BLADE STORM visual
  bx.globalCompositeOperation = 'lighter';
  for (const bp of bladeProjs) {
    const sx = bp.x - camX, sy = bp.y - camY;
    if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
    const len = 15 + weapon.size * 3;
    const tipX = sx + Math.cos(bp.angle) * len;
    const tipY = sy + Math.sin(bp.angle) * len;
    bx.strokeStyle = '#ff4488';
    bx.globalAlpha = Math.min(1, bp.life / 20);
    bx.lineWidth = 3;
    bx.beginPath(); bx.moveTo(sx, sy); bx.lineTo(tipX, tipY); bx.stroke();
    bx.strokeStyle = '#ffaacc';
    bx.lineWidth = 1;
    bx.beginPath(); bx.moveTo(sx, sy); bx.lineTo(tipX, tipY); bx.stroke();
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = 0.7;
    bx.fillRect(tipX - 2, tipY - 2, 4, 4);
  }
  bx.globalAlpha = 1; bx.lineWidth = 1;
  bx.globalCompositeOperation = 'source-over';

  // DEATH RAY visual
  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('death_ray')) continue;
    let rayTarget: typeof enemies[0] | null = null;
    let rtDist = 250 * 250;
    for (const e of enemies) { const d = dist2(pp, e); if (d < rtDist) { rtDist = d; rayTarget = e; } }
    if (rayTarget) {
      const px = pp.x - camX, py = pp.y - camY;
      const aim = aimDir(pp, rayTarget);
      const rayLen = 300 + weapon.pierce * 40;
      const ex = px + aim.x * rayLen, ey = py + aim.y * rayLen;
      bx.globalCompositeOperation = 'lighter';
      bx.strokeStyle = '#ff2244';
      bx.globalAlpha = 0.3 + Math.sin(game.time * 0.2) * 0.1;
      bx.lineWidth = 8 + Math.sin(game.time * 0.15) * 2;
      bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
      bx.strokeStyle = '#ff8888';
      bx.globalAlpha = 0.7;
      bx.lineWidth = 3;
      bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
      bx.strokeStyle = '#ffffff';
      bx.globalAlpha = 0.4;
      bx.lineWidth = 1;
      bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
      bx.globalAlpha = 1; bx.lineWidth = 1;
      bx.globalCompositeOperation = 'source-over';
    }
  }

  // BEAM LINES visual
  bx.globalCompositeOperation = 'lighter';
  for (const bl of beamLines) {
    const x1 = bl.x1 - camX, y1 = bl.y1 - camY;
    const x2 = bl.x2 - camX, y2 = bl.y2 - camY;
    const alpha = bl.life / 12;
    bx.strokeStyle = bl.color;
    bx.globalAlpha = alpha * 0.4;
    bx.lineWidth = bl.width * 3;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
    bx.globalAlpha = alpha * 0.9;
    bx.lineWidth = bl.width;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
    bx.strokeStyle = '#ffffff';
    bx.globalAlpha = alpha * 0.5;
    bx.lineWidth = 1;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
  }
  bx.globalAlpha = 1; bx.lineWidth = 1;
  bx.globalCompositeOperation = 'source-over';

  // SECOND LIFE, WARP FIELD, BULLET TIME, SHOCK RINGS, METEORS, BLACK HOLE, ORBITAL, SHADOW CLONE
  // (keeping these inline as they're deeply coupled to state)
  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('second_life') || pp.hp <= pp.maxHp) continue;
    const px = pp.x - camX, py = pp.y - camY;
    const shieldAlpha = 0.2 + Math.sin(game.time * 0.08) * 0.1;
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = '#ffcc44'; bx.globalAlpha = shieldAlpha; bx.lineWidth = 2;
    bx.beginPath(); bx.arc(Math.floor(px), Math.floor(py), 14, 0, Math.PI * 2); bx.stroke();
    bx.fillStyle = '#ffcc44'; bx.globalAlpha = shieldAlpha * 0.3;
    bx.beginPath(); bx.arc(Math.floor(px), Math.floor(py), 14, 0, Math.PI * 2); bx.fill();
    bx.globalAlpha = 1; bx.lineWidth = 1; bx.globalCompositeOperation = 'source-over';
  }

  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('warp_field')) continue;
    const px = pp.x - camX, py = pp.y - camY;
    const wfRange = 60 + (pp.upgradeLevels.get('pickup_radius') || 0) * 15;
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = '#cc88ff'; bx.globalAlpha = 0.15; bx.lineWidth = 1;
    for (let v = 0; v < 6; v++) {
      const angle = game.time * 0.03 + (v / 6) * Math.PI * 2;
      const r = wfRange * (0.5 + Math.sin(game.time * 0.05 + v) * 0.3);
      bx.beginPath(); bx.arc(Math.floor(px), Math.floor(py), r, angle, angle + 1.5); bx.stroke();
    }
    bx.globalAlpha = 1; bx.lineWidth = 1; bx.globalCompositeOperation = 'source-over';
  }

  if (players.some(p => p.bulletTimeActive > 0)) {
    bx.fillStyle = '#112244';
    bx.globalAlpha = 0.15 + Math.sin(game.time * 0.1) * 0.05;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    bx.globalAlpha = 1;
  }

  bx.globalCompositeOperation = 'lighter';
  for (const sr of shockRings) {
    const sx = sr.x - camX, sy = sr.y - camY;
    const alpha = Math.max(0, sr.life / 60);
    bx.strokeStyle = sr.color; bx.globalAlpha = alpha * 0.8; bx.lineWidth = 4;
    bx.beginPath(); bx.arc(Math.floor(sx), Math.floor(sy), sr.radius, 0, Math.PI * 2); bx.stroke();
    bx.globalAlpha = alpha * 0.4; bx.lineWidth = 8;
    bx.beginPath(); bx.arc(Math.floor(sx), Math.floor(sy), sr.radius - 5, 0, Math.PI * 2); bx.stroke();
  }
  bx.globalAlpha = 1; bx.lineWidth = 1; bx.globalCompositeOperation = 'source-over';

  // Falling meteors
  for (const fm of fallingMeteors) {
    const mx = fm.x - camX, my = fm.y - camY;
    if (mx < -100 || mx > VIEW_W + 100 || my < -200 || my > VIEW_H + 100) continue;
    const maxFall = Math.max(50, fm.fallTimer + 1);
    const t = fm.fallTimer / maxFall;
    const shadowSize = fm.radius * (1 - t * 0.6);
    bx.fillStyle = '#000000'; bx.globalAlpha = 0.4 * (1 - t);
    bx.beginPath(); bx.ellipse(Math.floor(mx), Math.floor(my) + 2, shadowSize, shadowSize * 0.4, 0, 0, Math.PI * 2); bx.fill();
    bx.globalAlpha = 1;
    bx.strokeStyle = '#ff2200'; bx.globalAlpha = (1 - t) * 0.5 + Math.sin(game.time * 0.25) * 0.2; bx.lineWidth = 1 + (1 - t) * 2;
    bx.beginPath(); bx.arc(Math.floor(mx), Math.floor(my), fm.radius * t + fm.radius * 0.2, 0, Math.PI * 2); bx.stroke();
    bx.fillStyle = '#ff2200'; bx.globalAlpha = (1 - t) * 0.08;
    bx.beginPath(); bx.arc(Math.floor(mx), Math.floor(my), fm.radius, 0, Math.PI * 2); bx.fill();
    const rockY = my - 180 * t;
    const rockSize = 5 + (1 - t) * 12;
    bx.globalCompositeOperation = 'lighter';
    const trailLen = 40 + (1 - t) * 30;
    bx.fillStyle = '#ff2200'; bx.globalAlpha = 0.3 * (1 - t * 0.5);
    bx.beginPath(); bx.ellipse(Math.floor(mx), Math.floor(rockY) - trailLen * 0.4, rockSize * 0.8, trailLen, 0, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = '#ff6600'; bx.globalAlpha = 0.5 * (1 - t * 0.3);
    bx.beginPath(); bx.arc(Math.floor(mx), Math.floor(rockY), rockSize * 1.5, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = '#ffaa22'; bx.globalAlpha = 0.7;
    bx.beginPath(); bx.arc(Math.floor(mx), Math.floor(rockY), rockSize, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = '#ffeeaa'; bx.globalAlpha = 0.9;
    bx.beginPath(); bx.arc(Math.floor(mx), Math.floor(rockY), rockSize * 0.5, 0, Math.PI * 2); bx.fill();
    if ((1 - t) > 0.3) {
      for (let sp = 0; sp < 3; sp++) {
        const sa = Math.random() * Math.PI * 2;
        const sr2 = rockSize + Math.random() * 8;
        bx.fillStyle = '#ffcc44'; bx.globalAlpha = 0.5 * Math.random();
        bx.fillRect(mx + Math.cos(sa) * sr2, rockY + Math.sin(sa) * sr2 - Math.random() * 10, 2, 2);
      }
    }
    bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1; bx.lineWidth = 1;
  }

  // Black hole
  for (const pp of players) {
    if (!pp.novaOrbActive) continue;
    const orb = pp.novaOrbActive as any;
    const ox = orb.x - camX, oy = orb.y - camY;
    const r = orb.currentRadius || 5;
    const isGrowing = orb.dx === 0 && orb.dy === 0;
    const isImploding = orb.life <= 10;
    if (isGrowing && !isImploding) {
      bx.fillStyle = '#000000'; bx.globalAlpha = 0.8;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), r, 0, Math.PI * 2); bx.fill(); bx.globalAlpha = 1;
    }
    bx.globalCompositeOperation = 'lighter';
    if (!isImploding) {
      const ringCount = isGrowing ? 3 : 1;
      for (let ring = 0; ring < ringCount; ring++) {
        const ringR = r + 5 + ring * 8;
        const ringSpeed = 0.08 - ring * 0.02;
        bx.strokeStyle = ring === 0 ? '#aa22ff' : ring === 1 ? '#ff44aa' : '#ff8844';
        bx.globalAlpha = isGrowing ? 0.3 + (r / 40) * 0.3 : 0.3;
        bx.lineWidth = isGrowing ? 2 + ring : 1;
        bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), ringR, game.time * ringSpeed, game.time * ringSpeed + Math.PI * 1.5); bx.stroke();
      }
      if (isGrowing) {
        const armCount = 8;
        for (let a = 0; a < armCount; a++) {
          const baseAngle = game.time * 0.06 + (a / armCount) * Math.PI * 2;
          const armR = r * 2 + 10;
          const sx2 = ox + Math.cos(baseAngle) * armR;
          const sy2 = oy + Math.sin(baseAngle) * armR;
          bx.fillStyle = a % 2 === 0 ? '#6622aa' : '#aa44ff';
          bx.globalAlpha = 0.4 * (r / 40);
          bx.fillRect(sx2 - 1, sy2 - 1, 2, 2);
        }
      }
      bx.strokeStyle = '#8822cc'; bx.globalAlpha = 0.4; bx.lineWidth = 3;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), r + 2, 0, Math.PI * 2); bx.stroke();
      bx.strokeStyle = '#cc44ff'; bx.globalAlpha = 0.6; bx.lineWidth = 1;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), r, 0, Math.PI * 2); bx.stroke();
    }
    if (!isGrowing && !isImploding) {
      bx.fillStyle = '#aa44ff'; bx.globalAlpha = 0.8;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), 6, 0, Math.PI * 2); bx.fill();
      bx.fillStyle = '#ffffff'; bx.globalAlpha = 0.4;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), 3, 0, Math.PI * 2); bx.fill();
    }
    if (isImploding) {
      const impFrame = 10 - orb.life;
      const flashR = r + impFrame * 8;
      bx.fillStyle = '#ffffff'; bx.globalAlpha = Math.max(0, 0.5 - impFrame * 0.05);
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), flashR, 0, Math.PI * 2); bx.fill();
      bx.strokeStyle = '#ff44ff'; bx.globalAlpha = Math.max(0, 0.8 - impFrame * 0.08); bx.lineWidth = 3;
      bx.beginPath(); bx.arc(Math.floor(ox), Math.floor(oy), flashR * 0.7, 0, Math.PI * 2); bx.stroke();
    }
    bx.globalAlpha = 1; bx.lineWidth = 1; bx.globalCompositeOperation = 'source-over';
  }

  // Orbital orbs
  for (const pp of players) {
    if (pp.dead) continue;
    const orbLv = pp.upgradeLevels.get('orbital') || 0;
    if (orbLv > 0) {
      for (let oi = 0; oi < orbLv; oi++) {
        const angle = pp.orbitalAngle + (oi / orbLv) * Math.PI * 2;
        const ox = pp.x + Math.cos(angle) * 30 - camX;
        const oy = pp.y + Math.sin(angle) * 30 - camY;
        bx.fillStyle = '#6666ff'; bx.globalAlpha = 0.3 + Math.sin(game.time * 0.1 + oi) * 0.15;
        bx.fillRect(Math.floor(ox) - 5, Math.floor(oy) - 5, 10, 10); bx.globalAlpha = 1;
        bx.fillStyle = '#aaaaff'; bx.fillRect(Math.floor(ox) - 3, Math.floor(oy) - 3, 6, 6);
        bx.fillStyle = '#ddddff'; bx.fillRect(Math.floor(ox) - 1, Math.floor(oy) - 1, 3, 3);
        const trailAngle = angle - 0.3;
        const tx = pp.x + Math.cos(trailAngle) * 30 - camX;
        const ty = pp.y + Math.sin(trailAngle) * 30 - camY;
        bx.fillStyle = '#6666ff'; bx.globalAlpha = 0.3;
        bx.fillRect(Math.floor(tx) - 2, Math.floor(ty) - 2, 4, 4); bx.globalAlpha = 1;
      }
    }
  }

  // Shadow clone
  for (const pp of players) {
    if (pp.shadowClone) {
      const scx = pp.shadowClone.x - camX, scy = pp.shadowClone.y - camY;
      bx.globalAlpha = 0.5;
      bx.fillStyle = '#8844cc'; bx.fillRect(Math.floor(scx) - 4, Math.floor(scy) - 5, 8, 10);
      bx.fillStyle = '#aa66ee'; bx.fillRect(Math.floor(scx) - 3, Math.floor(scy) - 8, 6, 5);
      bx.fillStyle = '#cc88ff'; bx.fillRect(Math.floor(scx) - 2, Math.floor(scy) - 7, 4, 1);
      bx.globalAlpha = 1;
    }
  }

  // Lasers
  bx.globalCompositeOperation = 'lighter';
  for (const l of lasers) {
    const sx = l.x - camX, sy = l.y - camY;
    const half = Math.floor(l.size / 2);
    bx.fillStyle = l.glowColor; bx.globalAlpha = 0.25;
    bx.fillRect(sx - half - 2, sy - half - 2, l.size + 4, l.size + 4);
    bx.globalAlpha = 0.9; bx.fillStyle = l.color;
    bx.fillRect(sx - half, sy - half, l.size, l.size);
    bx.globalAlpha = 0.3;
    for (let t = 1; t <= l.trailLength; t++) {
      const trailSz = Math.max(1, l.size - t);
      const trailHalf = Math.floor(trailSz / 2);
      bx.fillRect(sx - l.dx * t * 0.5 - trailHalf, sy - l.dy * t * 0.5 - trailHalf, trailSz, trailSz);
    }
  }
  bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';

  // Chain arcs
  for (const arc of chainArcs) {
    const x1 = arc.x1 - camX, y1 = arc.y1 - camY;
    const x2 = arc.x2 - camX, y2 = arc.y2 - camY;
    bx.globalAlpha = arc.life / 10; bx.fillStyle = '#4488ff';
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t1 = s / steps, t2 = (s + 1) / steps;
      const sx1 = x1 + (x2 - x1) * t1 + (Math.random() - 0.5) * 4;
      const sy1 = y1 + (y2 - y1) * t1 + (Math.random() - 0.5) * 4;
      const sx2 = x1 + (x2 - x1) * t2 + (Math.random() - 0.5) * 4;
      const sy2 = y1 + (y2 - y1) * t2 + (Math.random() - 0.5) * 4;
      bx.fillRect(sx1, sy1, Math.abs(sx2 - sx1) || 1, Math.abs(sy2 - sy1) || 1);
    }
    bx.globalAlpha = 1;
  }

  // Particles
  bx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const sx = p.x - camX, sy = p.y - camY;
    bx.globalAlpha = (p.life / p.maxLife) * 0.8; bx.fillStyle = p.color;
    bx.fillRect(sx, sy, p.size, p.size);
  }
  bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';

  // Damage numbers
  for (const dn of dmgNumbers) {
    const dnx = dn.x - camX, dny = dn.y - camY;
    if (dnx < -20 || dnx > VIEW_W + 20 || dny < -20 || dny > VIEW_H + 20) continue;
    const alpha = Math.min(1, dn.life / 10);
    bx.globalAlpha = alpha;
    const dmgText = '' + dn.value;
    const scale = dn.value >= 10 ? 2 : 1;
    drawText(dmgText, dnx - textWidth(dmgText, scale) / 2, dny, dn.color, scale);
    bx.globalAlpha = 1;
  }

  // Chest indicators
  for (const ch of chests) {
    if (ch.opened) continue;
    const csx = ch.x - camX, csy = ch.y - camY;
    if (csx > 10 && csx < VIEW_W - 10 && csy > 10 && csy < VIEW_H - 10) continue;
    const margin = 16;
    const ix = Math.max(margin, Math.min(VIEW_W - margin, csx));
    const iy = Math.max(margin, Math.min(VIEW_H - margin, csy));
    const pulse = Math.sin(game.time * 0.08) * 0.4 + 0.6;
    const fastPulse = Math.sin(game.time * 0.15) * 0.5 + 0.5;
    const isRare = ch.rarity === 'rare';
    const color = isRare ? '#ff44aa' : '#aa88ff';
    const glowColor = isRare ? '#ff88cc' : '#cc88ff';
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = glowColor; bx.globalAlpha = pulse * 0.3;
    bx.beginPath(); bx.arc(ix, iy, 12 + fastPulse * 4, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = color; bx.globalAlpha = pulse * 0.8 + 0.2;
    bx.fillRect(ix - 5, iy - 5, 10, 10);
    bx.fillStyle = '#ffffff'; bx.globalAlpha = fastPulse * 0.6;
    bx.fillRect(ix - 2, iy - 2, 4, 4);
    bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';
    const chDist = Math.floor(Math.sqrt((ch.x - player.x) ** 2 + (ch.y - player.y) ** 2) / TILE);
    const distText = '' + chDist + 'M';
    drawText(distText, ix - textWidth(distText, 1) / 2, iy + 10, color, 1);
  }

  // Fog of war
  const fogGradPre = bx.createRadialGradient(VIEW_W/2, VIEW_H/2, 90, VIEW_W/2, VIEW_H/2, VIEW_W * 0.52);
  fogGradPre.addColorStop(0, 'rgba(0,0,0,0)');
  fogGradPre.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  fogGradPre.addColorStop(1, 'rgba(0,0,0,0.65)');
  bx.fillStyle = fogGradPre;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // HUD
  drawHUD();

  // Pause overlay
  if (game.state === 'paused') {
    bx.fillStyle = 'rgba(0,0,0,0.7)'; bx.fillRect(0, 0, VIEW_W, VIEW_H);
    const pauseTitle = 'PAUSE';
    drawText(pauseTitle, VIEW_W / 2 - textWidth(pauseTitle, 4) / 2, VIEW_H / 2 - 40, '#ffffff', 4);
    const btnW = 200, btnX = VIEW_W / 2 - btnW / 2;
    const r1Y = VIEW_H / 2 + 5, r2Y = VIEW_H / 2 + 35, btnH = 25;
    const h1 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= r1Y && mouse.y <= r1Y + btnH;
    const h2 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= r2Y && mouse.y <= r2Y + btnH;
    if (h1) titleState.pauseCursor = 0;
    if (h2) titleState.pauseCursor = 1;
    drawButton('REPRENDRE', btnX, r1Y, btnW, btnH, h1 || titleState.pauseCursor === 0, '#44ff88');
    drawButton('MENU PRINCIPAL', btnX, r2Y, btnW, btnH, h2 || titleState.pauseCursor === 1, '#ff4444');
    const arrowY = titleState.pauseCursor === 0 ? r1Y : r2Y;
    drawText('>', btnX - 16, arrowY + 7, '#ffffff', 2);
  }

  // Selection overlay
  if (game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare') {
    drawSelectionScreen();
  }

  // Game Over
  if (game.state === 'gameover') { drawGameOver(); }

  // Crosshair
  const cx = Math.floor(mouse.x), cy = Math.floor(mouse.y);
  const cSize = 5;
  bx.globalCompositeOperation = 'lighter';
  bx.fillStyle = COL.playerVisor; bx.globalAlpha = 0.8;
  bx.fillRect(cx - cSize, cy, cSize - 1, 1);
  bx.fillRect(cx + 2, cy, cSize - 1, 1);
  bx.fillRect(cx, cy - cSize, 1, cSize - 1);
  bx.fillRect(cx, cy + 2, 1, cSize - 1);
  bx.fillRect(cx, cy, 1, 1);
  bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';

  // Codex
  if (game.codexOpen) drawCodex();

  // Damage flash
  const maxFlash = Math.max(...players.map(p => p.damageFlash));
  const flashPlayer = players.reduce((best, p) => p.damageFlash > best.damageFlash ? p : best, players[0]);
  if (maxFlash > 0) {
    const alpha = maxFlash / 15;
    bx.fillStyle = '#330000'; bx.globalAlpha = alpha * 0.5;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    const hd = Math.sqrt(flashPlayer.hitDirX * flashPlayer.hitDirX + flashPlayer.hitDirY * flashPlayer.hitDirY);
    if (hd > 0) {
      const nx = flashPlayer.hitDirX / hd, ny = flashPlayer.hitDirY / hd;
      bx.fillStyle = '#ff0000'; bx.globalAlpha = alpha * 0.6;
      const barThick = 6;
      if (Math.abs(nx) > Math.abs(ny)) {
        if (nx > 0) bx.fillRect(0, 0, barThick, VIEW_H);
        else bx.fillRect(VIEW_W - barThick, 0, barThick, VIEW_H);
      } else {
        if (ny > 0) bx.fillRect(0, 0, VIEW_W, barThick);
        else bx.fillRect(0, VIEW_H - barThick, VIEW_W, barThick);
      }
    }
    bx.globalAlpha = 1;
  }

  // Ash rain
  bx.fillStyle = '#332233';
  for (const ash of ashRain) {
    ash.y += ash.speed;
    ash.x += Math.sin(ash.y * 0.01) * 0.2;
    if (ash.y > VIEW_H) { ash.y = -2; ash.x = Math.random() * VIEW_W; }
    bx.globalAlpha = ash.alpha;
    bx.fillRect(Math.floor(ash.x), Math.floor(ash.y), ash.size, ash.size);
  }
  bx.globalAlpha = 1;

  // Lightning flash
  if (game.lightningFlash > 0) {
    if (game.lightningFlash > 8) { bx.fillStyle = '#ffffff'; bx.globalAlpha = 0.15; }
    else { bx.fillStyle = '#221133'; bx.globalAlpha = game.lightningFlash / 15; }
    bx.fillRect(0, 0, VIEW_W, VIEW_H); bx.globalAlpha = 1;
  }

  // Vignette
  const vigStr = 0.6;
  bx.fillStyle = '#000000';
  for (let v = 0; v < 20; v++) {
    bx.globalAlpha = vigStr * (1 - v / 20) * 0.3;
    bx.fillRect(0, v, VIEW_W, 1);
    bx.fillRect(0, VIEW_H - 1 - v, VIEW_W, 1);
  }
  for (let v = 0; v < 15; v++) {
    bx.globalAlpha = vigStr * (1 - v / 15) * 0.25;
    bx.fillRect(v, 0, 1, VIEW_H);
    bx.fillRect(VIEW_W - 1 - v, 0, 1, VIEW_H);
  }
  bx.globalAlpha = 1;

  // Low HP warning
  const anyLowHp = players.some(p => !p.dead && p.hp < p.maxHp * 0.3 && p.hp > 0);
  if (anyLowHp) {
    const pulse = Math.sin(game.time * 0.1) * 0.1 + 0.15;
    bx.fillStyle = '#330000'; bx.globalAlpha = pulse;
    bx.fillRect(0, 0, VIEW_W, VIEW_H); bx.globalAlpha = 1;
  }

  // Bloom
  bloomCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  bloomCtx.drawImage(buf, 0, 0);
  bloomCtx.globalCompositeOperation = 'multiply';
  bloomCtx.fillStyle = '#333333'; bloomCtx.fillRect(0, 0, VIEW_W, VIEW_H);
  bloomCtx.globalCompositeOperation = 'source-over';
  bloomCtx.filter = 'blur(4px)';
  bloomCtx.drawImage(bloomBuf, 0, 0);
  bloomCtx.filter = 'none';
  bx.globalCompositeOperation = 'lighter';
  bx.globalAlpha = 0.5;
  bx.drawImage(bloomBuf, 0, 0);
  bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';

  // Upscale
  if (game.freezeZoom > 0.005) {
    const z = game.freezeZoom;
    const zw = VIEW_W * z, zh = VIEW_H * z;
    ctx.drawImage(buf, 0, 0, VIEW_W, VIEW_H, -zw, -zh, canvas.width + zw * 2, canvas.height + zh * 2);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = game.freezeFrame / 15;
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(buf, 0, 0, VIEW_W, VIEW_H, 0, 0, canvas.width, canvas.height);
  }
}
