import { COL } from '../constants';
import { bx } from '../canvas';
import { game, player } from '../state';
import type { PlayerState } from '../types';

export function drawPlayer(sx: number, sy: number) {
  const flash = player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 0;
  if (flash) return;
  const px = Math.floor(sx), py = Math.floor(sy);

  bx.fillStyle = COL.playerVisor;
  bx.globalAlpha = 0.08 + Math.sin(game.time * 0.05) * 0.04;
  bx.fillRect(px - 8, py - 10, 16, 18);
  bx.globalAlpha = 1;

  if (player.dir === 'down' || player.dir === 'left' || player.dir === 'right') {
    bx.fillStyle = COL.playerCape;
    const capeWave = Math.sin(game.time * 0.08) * 1;
    bx.fillRect(px - 4, py - 2, 8, 10 + capeWave);
  }
  bx.fillStyle = COL.playerArmor;
  bx.fillRect(px - 4, py - 5, 8, 10);
  bx.fillStyle = '#2a2840';
  bx.fillRect(px - 3, py - 8, 6, 5);
  bx.fillStyle = COL.playerVisor;
  switch (player.dir) {
    case 'down':
      bx.fillRect(px - 2, py - 7, 4, 1);
      bx.fillRect(px, py - 6, 1, 2);
      break;
    case 'up':
      bx.fillRect(px - 2, py - 7, 4, 1);
      break;
    case 'left':
      bx.fillRect(px - 3, py - 7, 3, 1);
      bx.fillRect(px - 3, py - 6, 1, 2);
      break;
    case 'right':
      bx.fillRect(px, py - 7, 3, 1);
      bx.fillRect(px + 2, py - 6, 1, 2);
      break;
  }
  const legOffset = player.moving ? Math.sin(player.animTimer * 0.5) * 2 : 0;
  bx.fillStyle = '#22203a';
  bx.fillRect(px - 3, py + 5, 2, 3 + legOffset);
  bx.fillRect(px + 1, py + 5, 2, 3 - legOffset);
}

export function drawPlayerCoOp(ps: PlayerState, sx: number, sy: number) {
  const flash = ps.invincible > 0 && Math.floor(ps.invincible / 3) % 2 === 0;
  if (flash) return;
  const px = Math.floor(sx), py = Math.floor(sy);

  bx.fillStyle = ps.visorColor;
  bx.globalAlpha = 0.08 + Math.sin(game.time * 0.05) * 0.04;
  bx.fillRect(px - 8, py - 10, 16, 18);
  bx.globalAlpha = 1;

  if (ps.dir === 'down' || ps.dir === 'left' || ps.dir === 'right') {
    bx.fillStyle = ps.playerIndex === 0 ? COL.playerCape : '#1a3040';
    const capeWave = Math.sin(game.time * 0.08) * 1;
    bx.fillRect(px - 4, py - 2, 8, 10 + capeWave);
  }
  bx.fillStyle = ps.playerIndex === 0 ? COL.playerArmor : '#4a5a6a';
  bx.fillRect(px - 4, py - 5, 8, 10);
  bx.fillStyle = ps.playerIndex === 0 ? '#2a2840' : '#2a3840';
  bx.fillRect(px - 3, py - 8, 6, 5);
  bx.fillStyle = ps.visorColor;
  switch (ps.dir) {
    case 'down':
      bx.fillRect(px - 2, py - 7, 4, 1);
      bx.fillRect(px, py - 6, 1, 2);
      break;
    case 'up':
      bx.fillRect(px - 2, py - 7, 4, 1);
      break;
    case 'left':
      bx.fillRect(px - 3, py - 7, 3, 1);
      bx.fillRect(px - 3, py - 6, 1, 2);
      break;
    case 'right':
      bx.fillRect(px, py - 7, 3, 1);
      bx.fillRect(px + 2, py - 6, 1, 2);
      break;
  }
  if (ps.playerIndex === 1) {
    bx.fillStyle = ps.visorColor;
    bx.fillRect(px - 1, py - 11, 2, 1);
  }
  const legOffset = ps.moving ? Math.sin(ps.animTimer * 0.5) * 2 : 0;
  bx.fillStyle = ps.playerIndex === 0 ? '#22203a' : '#203040';
  bx.fillRect(px - 3, py + 5, 2, 3 + legOffset);
  bx.fillRect(px + 1, py + 5, 2, 3 - legOffset);
}
