import { TILE, MAP_W, MAP_H } from './constants';
import { map } from './map';

export function isSolid(px: number, py: number): boolean {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true;
  const t = map[ty][tx];
  return t === 3;
}

export function canMove(x: number, y: number, dx: number, dy: number, r: number): boolean {
  const nx = x + dx, ny = y + dy;
  return !isSolid(nx - r, ny - r) && !isSolid(nx + r, ny - r) &&
         !isSolid(nx - r, ny + r) && !isSolid(nx + r, ny + r);
}
