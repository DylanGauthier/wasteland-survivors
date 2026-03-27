import { COL } from '../constants';
import { bx } from '../canvas';
import { game } from '../state';
import type { Drop, Chest } from '../types';

export function drawDrop(dr: Drop, sx: number, sy: number) {
  const bob = Math.sin(dr.bobTimer) * 3;
  const px = Math.floor(sx), py = Math.floor(sy + bob);
  const fade = dr.life > 0 && dr.life < 60 ? dr.life / 60 : 1;
  bx.globalAlpha = fade;

  if (dr.type === 'xp') {
    bx.fillStyle = COL.xpOrbGlow;
    bx.fillRect(px - 1, py - 3, 3, 7);
    bx.fillRect(px - 3, py - 1, 7, 3);
    bx.fillStyle = COL.xpOrb;
    bx.fillRect(px - 1, py - 1, 3, 3);
  } else {
    bx.fillStyle = COL.heartDrop;
    bx.fillRect(px - 3, py - 2, 3, 3);
    bx.fillRect(px + 1, py - 2, 3, 3);
    bx.fillRect(px - 3, py + 1, 7, 3);
    bx.fillRect(px - 2, py + 4, 5, 2);
    bx.fillRect(px - 1, py + 6, 3, 1);
    bx.fillStyle = '#ff88aa';
    bx.fillRect(px - 2, py - 1, 2, 2);
  }
  bx.globalAlpha = 1;
}

export function drawChest(ch: Chest, sx: number, sy: number) {
  const px = Math.floor(sx), py = Math.floor(sy);
  const isRare = ch.rarity === 'rare';

  if (ch.opened) {
    bx.fillStyle = '#996622';
    bx.fillRect(px - 10, py - 2, 20, 12);
    bx.fillStyle = isRare ? COL.chestRare : COL.chestBody;
    bx.fillRect(px - 11, py - 8, 22, 7);
    bx.fillStyle = isRare ? COL.chestRareGlow : COL.chestLock;
    bx.globalAlpha = ch.openTimer / 60;
    bx.fillRect(px - 5, py + 1, 10, 6);
    bx.globalAlpha = 1;
  } else {
    const bob = Math.sin(game.time * 0.05) * 2;
    const cy = py + bob;

    const glowPulse = Math.sin(game.time * 0.06) * 0.3 + 0.5;
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = isRare ? '#ff44aa' : '#8866cc';
    bx.globalAlpha = glowPulse * 0.25;
    bx.beginPath();
    bx.arc(px, cy, 18 + glowPulse * 6, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';

    bx.fillStyle = isRare ? COL.chestRare : COL.chestBody;
    bx.fillRect(px - 12, cy - 6, 24, 14);
    bx.fillStyle = isRare ? '#cc6622' : '#aa7722';
    bx.fillRect(px - 13, cy - 10, 26, 6);
    const lockPulse = Math.sin(game.time * 0.1) * 0.5 + 0.5;
    bx.fillStyle = isRare ? COL.chestRareGlow : COL.chestLock;
    bx.fillRect(px - 3, cy - 4, 6, 6);
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = lockPulse * 0.6;
    bx.fillRect(px - 1, cy - 2, 2, 2);
    bx.globalAlpha = 1;

    const sparklePhase = game.time * 0.15;
    const sparkles = [
      { ox: 9, oy: -9 }, { ox: -10, oy: -8 }, { ox: 7, oy: 4 }, { ox: -8, oy: 3 },
    ];
    for (let si = 0; si < sparkles.length; si++) {
      const sp = sparkles[si];
      const sAlpha = Math.sin(sparklePhase + si * 1.7) * 0.5 + 0.5;
      if (sAlpha > 0.3) {
        bx.fillStyle = isRare ? '#ffcc44' : '#ffffff';
        bx.globalAlpha = sAlpha;
        bx.fillRect(px + sp.ox, cy + sp.oy, 2, 2);
      }
    }
    bx.globalAlpha = 1;
  }
}
