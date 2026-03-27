import { COL } from '../constants';
import { bx } from '../canvas';
import type { Enemy, EliteAffix } from '../types';

export function drawEnemy(e: Enemy, sx: number, sy: number) {
  const px = Math.floor(sx), py = Math.floor(sy);

  if (e.emergeTimer > 0) {
    const progress = 1 - e.emergeTimer / 30;
    const fissureW = 6 + progress * 8;
    const fissureH = 2 + progress * 4;
    bx.fillStyle = '#000000';
    bx.fillRect(px - fissureW / 2, py - fissureH / 2, fissureW, fissureH);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#441166';
    bx.globalAlpha = progress * 0.5;
    bx.fillRect(px - fissureW / 2 + 1, py - fissureH / 2, fissureW - 2, fissureH);
    if (progress > 0.5) {
      bx.fillStyle = '#220044';
      bx.globalAlpha = (progress - 0.5) * 0.6;
      bx.fillRect(px - 1, py - fissureH - progress * 6, 2, progress * 6);
    }
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    return;
  }

  if (e.type === 'superboss') { drawSuperBoss(e, px, py); return; }
  if (e.type === 'boss') { drawBoss(e, px, py); return; }
  if (e.type === 'miniboss') { drawMiniBoss(e, px, py); return; }

  if (e.elite) {
    const eliteColors: Record<EliteAffix, string> = {
      fire_trail: '#ff4400', teleport: '#8844cc', reflect: '#4488ff', haste: '#44ff44', regen: '#44ffaa',
    };
    const ec = eliteColors[e.elite];
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = ec;
    bx.globalAlpha = 0.15 + Math.sin(e.animTimer * 0.08) * 0.1;
    const gs = e.type === 'tank' ? 14 : e.type === 'brute' ? 12 : 10;
    bx.fillRect(px - gs, py - gs, gs * 2, gs * 2);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
  }

  const frozen = e.slowTimer > 0;
  const flash = e.hitFlash > 0;

  if (e.type === 'dasher') {
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#3a1828';
    bx.fillRect(px - 6, py - 5, 12, 10);
    bx.fillRect(px - 3, py - 8, 6, 3);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2244';
    bx.fillRect(px - 3, py - 2, 2, 3);
    bx.fillRect(px + 1, py - 2, 2, 3);
    bx.globalCompositeOperation = 'source-over';
    if (e.dashTimer! <= 0 && e.dashTimer! > -15) {
      bx.globalCompositeOperation = 'lighter';
      bx.fillStyle = '#ff2244';
      bx.globalAlpha = 0.5;
      bx.fillRect(px - 10, py - 1, 4, 1);
      bx.fillRect(px + 6, py, 4, 1);
      bx.globalAlpha = 1;
      bx.globalCompositeOperation = 'source-over';
    }
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 4, sz * 2, 2);
      bx.fillStyle = '#cc2244'; bx.fillRect(px - sz, py - sz - 4, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  if (e.type === 'splitter') {
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#1e3038';
    bx.fillRect(px - 7, py - 6, 14, 12);
    bx.fillStyle = flash ? '#ffffff' : '#223840';
    bx.fillRect(px - 5, py - 4, 10, 8);
    bx.fillStyle = '#060810';
    bx.fillRect(px, py - 6, 1, 12);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#44ffaa';
    bx.fillRect(px - 4, py - 3, 2, 2);
    bx.fillRect(px + 2, py - 3, 2, 2);
    bx.globalCompositeOperation = 'source-over';
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 3, sz * 2, 2);
      bx.fillStyle = '#44aa88'; bx.fillRect(px - sz, py - sz - 3, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  if (e.type === 'tank') {
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#282238';
    bx.fillRect(px - 10, py - 10, 20, 20);
    bx.fillStyle = flash ? '#ffffff' : '#342848';
    bx.fillRect(px - 7, py - 7, 14, 14);
    bx.fillStyle = '#201830';
    bx.fillRect(px - 9, py - 10, 18, 3);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2244';
    bx.fillRect(px - 4, py - 3, 3, 3);
    bx.fillRect(px + 1, py - 3, 3, 3);
    bx.fillStyle = '#ff0022';
    bx.globalAlpha = 0.3;
    bx.fillRect(px - 3, py - 1, 6, 4);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    bx.fillStyle = COL.hpBg; bx.fillRect(px - 8, py - 11, 16, 2);
    bx.fillStyle = '#882244'; bx.fillRect(px - 8, py - 11, (Math.max(0, e.hp) / e.maxHp) * 16, 2);
    return;
  }

  if (e.type === 'swarm') {
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#221828';
    bx.fillRect(px - 3, py - 3, 6, 6);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff4488';
    bx.fillRect(px - 1, py - 1, 2, 2);
    bx.globalCompositeOperation = 'source-over';
    return;
  }

  if (e.type === 'caster') {
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#201030';
    bx.fillRect(px - 6, py - 7, 12, 14);
    bx.fillStyle = flash ? '#ffffff' : '#2a1840';
    bx.fillRect(px - 7, py - 10, 14, 5);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2266';
    const eyePulse = Math.sin(e.animTimer * 0.1) > 0 ? 1 : 0;
    bx.fillRect(px - 2, py - 5, 3 + eyePulse, 3);
    bx.fillStyle = '#440022';
    bx.globalAlpha = 0.3;
    bx.fillRect(px - 4, py + 7, 8, 3);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    const szC = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - szC, py - szC - 5, szC * 2, 2);
      bx.fillStyle = '#ff2266'; bx.fillRect(px - szC, py - szC - 5, (Math.max(0, e.hp) / e.maxHp) * szC * 2, 2);
    }
    return;
  }

  if (e.type === 'exploder') {
    const pulse = Math.sin(e.animTimer * 0.15) * 2;
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#301418';
    bx.fillRect(px - 6 - pulse, py - 6 - pulse, 12 + pulse * 2, 12 + pulse * 2);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 3, py - 3, 6, 6);
    if (e.animTimer % 8 < 4) {
      bx.fillStyle = '#ffaa44';
      bx.globalAlpha = 0.6;
      bx.fillRect(px - 6 - pulse, py - 6 - pulse, 12 + pulse * 2, 12 + pulse * 2);
      bx.globalAlpha = 1;
    }
    bx.globalCompositeOperation = 'source-over';
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 3, sz * 2, 2);
      bx.fillStyle = '#ff4400'; bx.fillRect(px - sz, py - sz - 3, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  // Default: scout / brute
  if (flash) bx.fillStyle = '#ffffff';
  else if (frozen) bx.fillStyle = '#445566';
  else bx.fillStyle = e.type === 'brute' ? '#331828' : '#2a1424';

  const sz = e.type === 'brute' ? 8 : 6;
  bx.fillRect(px - sz, py - sz, sz * 2, sz * 2);

  bx.globalCompositeOperation = 'lighter';
  bx.fillStyle = flash ? '#ffffff' : COL.enemyEye;
  if (e.type === 'brute') {
    bx.fillRect(px - 3, py - 3, 2, 2);
    bx.fillRect(px + 1, py - 3, 2, 2);
  } else {
    bx.fillRect(px - 1, py - 2, 3, 2);
  }
  bx.globalCompositeOperation = 'source-over';

  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 1, py - sz - 3, 2, 2);
  }

  if (e.hp < e.maxHp) {
    bx.fillStyle = COL.hpBg;
    bx.fillRect(px - sz, py - sz - 4, sz * 2, 2);
    bx.fillStyle = COL.hpBar;
    bx.fillRect(px - sz, py - sz - 4, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
  }
}

export function drawMiniBoss(e: Enemy, px: number, py: number) {
  const frozen = e.slowTimer > 0;
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : COL.minibossBody;
  bx.fillRect(px - 8, py - 8, 16, 16);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#553377';
  bx.fillRect(px - 6, py - 6, 12, 12);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : COL.minibossEye;
  bx.fillRect(px - 4, py - 3, 3, 3);
  bx.fillRect(px + 1, py - 3, 3, 3);
  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 11, 3, 2);
  }
  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 12, py - 14, 24, 3);
  bx.fillStyle = '#aa66ff';
  bx.fillRect(px - 12, py - 14, (Math.max(0, e.hp) / e.maxHp) * 24, 3);
  bx.fillStyle = '#cc88ff';
  bx.fillRect(px - 12, py - 14, (Math.max(0, e.hp) / e.maxHp) * 24, 1);
}

export function drawBoss(e: Enemy, px: number, py: number) {
  const pulse = Math.sin(e.animTimer * 0.05) * 2;
  const frozen = e.slowTimer > 0;
  bx.fillStyle = 'rgba(0,0,0,0.3)';
  bx.fillRect(px - 12, py + 10, 24, 4);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : COL.bossBody;
  bx.fillRect(px - 10 - pulse, py - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#aa6622';
  bx.fillRect(px - 7, py - 7, 14, 14);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : COL.bossEye;
  bx.fillRect(px - 5, py - 4, 3, 3);
  bx.fillRect(px + 2, py - 4, 3, 3);
  bx.fillRect(px - 1, py + 1, 3, 3);
  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 15, 3, 3);
  }
  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 16, py - 18, 32, 3);
  bx.fillStyle = '#ff8800';
  bx.fillRect(px - 16, py - 18, (Math.max(0, e.hp) / e.maxHp) * 32, 3);
  bx.fillStyle = '#ffaa44';
  bx.fillRect(px - 16, py - 18, (Math.max(0, e.hp) / e.maxHp) * 32, 1);
}

export function drawSuperBoss(e: Enemy, px: number, py: number) {
  const pulse = Math.sin(e.animTimer * 0.03) * 3;
  const frozen = e.slowTimer > 0;
  bx.fillStyle = 'rgba(0,0,0,0.4)';
  bx.fillRect(px - 16, py + 14, 32, 5);
  bx.fillStyle = '#ff44ff';
  bx.globalAlpha = 0.15 + Math.sin(e.animTimer * 0.08) * 0.1;
  bx.fillRect(px - 18 - pulse, py - 18 - pulse, 36 + pulse * 2, 36 + pulse * 2);
  bx.globalAlpha = 1;
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : '#881188';
  bx.fillRect(px - 14 - pulse, py - 14 - pulse, 28 + pulse * 2, 28 + pulse * 2);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#aa44aa';
  bx.fillRect(px - 10, py - 10, 20, 20);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#ff44ff';
  bx.fillRect(px - 7, py - 6, 4, 4);
  bx.fillRect(px + 3, py - 6, 4, 4);
  bx.fillRect(px - 2, py + 2, 4, 4);
  bx.fillStyle = '#ffaa44';
  bx.fillRect(px - 8, py - 16, 3, 4);
  bx.fillRect(px - 1, py - 18, 3, 4);
  bx.fillRect(px + 6, py - 16, 3, 4);
  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 21, 4, 3);
  }
  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 22, py - 24, 44, 4);
  bx.fillStyle = '#ff44ff';
  bx.fillRect(px - 22, py - 24, (Math.max(0, e.hp) / e.maxHp) * 44, 4);
  bx.fillStyle = '#ff88ff';
  bx.fillRect(px - 22, py - 24, (Math.max(0, e.hp) / e.maxHp) * 44, 1);
}
