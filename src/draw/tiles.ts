import { TILE, COL } from '../constants';
import { bx } from '../canvas';

export function drawTile(x: number, y: number, tile: number, wx = 0, wy = 0) {
  const h = (wx * 7 + wy * 13) & 0xff;
  switch (tile) {
    case 0:
      bx.fillStyle = COL.sand1;
      bx.fillRect(x, y, TILE, TILE);
      if (h & 1) { bx.fillStyle = '#0e0c18'; bx.fillRect(x + (h & 7) + 2, y + 6, 1, 1); }
      break;
    case 1:
      bx.fillStyle = COL.sand2;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = '#18142a';
      if (h & 2) bx.fillRect(x + 4, y + 8, 3, 1);
      if (h & 8) bx.fillRect(x + 10, y + 4, 1, 3);
      break;
    case 2:
      bx.fillStyle = '#0f0d1a';
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = '#14121f';
      if (h & 1) bx.fillRect(x + 3, y + 5, 2, 2);
      if (h & 2) bx.fillRect(x + 9, y + 10, 3, 1);
      if (h & 4) bx.fillRect(x + 7, y + 3, 1, 2);
      break;
    case 3:
      bx.fillStyle = COL.darkRock;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = COL.shadow;
      bx.fillRect(x, y + 12, TILE, 4);
      bx.fillStyle = '#1a0830';
      bx.fillRect(x + 3, y + 3, 2, 2);
      bx.fillRect(x + 9, y + 7, 3, 2);
      break;
    case 4:
      bx.fillStyle = COL.sand1;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = '#2a2238';
      bx.fillRect(x + 6, y + 3, 4, 11);
      bx.fillRect(x + 4, y + 6, 2, 4);
      bx.fillRect(x + 10, y + 8, 2, 3);
      bx.fillStyle = '#3a2848';
      bx.fillRect(x + 7, y + 3, 2, 2);
      break;
  }
}
