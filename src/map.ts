import { TILE, MAP_W, MAP_H } from './constants';
import { noise } from './math';
import type { Vec, GrowingVein } from './types';

export const map: number[][] = [];
export const veins: GrowingVein[] = [];
export const wallEyes: (Vec & { size: number })[] = [];
export const veinSpawns: { x: number; y: number; angle: number }[] = [];

export function generateMap() {
  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const n = noise(x * 0.08, y * 0.08);
      if (n > 0.7) map[y][x] = 3;
      else if (n > 0.55) map[y][x] = 2;
      else if (n > 0.35) map[y][x] = 1;
      else map[y][x] = 0;
      if (map[y][x] <= 1 && Math.random() < 0.02) map[y][x] = 4;
    }
  }
  for (let y = MAP_H / 2 - 3; y < MAP_H / 2 + 3; y++)
    for (let x = MAP_W / 2 - 3; x < MAP_W / 2 + 3; x++)
      map[y][x] = 0;

  veins.length = 0;
  wallEyes.length = 0;
  const visited = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));

  for (let sy = 0; sy < MAP_H; sy++) {
    for (let sx = 0; sx < MAP_W; sx++) {
      if (map[sy][sx] !== 3 || visited[sy][sx]) continue;
      const cluster: Vec[] = [];
      const stack: Vec[] = [{ x: sx, y: sy }];
      while (stack.length > 0) {
        const p = stack.pop()!;
        if (p.x < 0 || p.x >= MAP_W || p.y < 0 || p.y >= MAP_H) continue;
        if (visited[p.y][p.x] || map[p.y][p.x] !== 3) continue;
        visited[p.y][p.x] = true;
        cluster.push(p);
        stack.push({ x: p.x+1, y: p.y }, { x: p.x-1, y: p.y }, { x: p.x, y: p.y+1 }, { x: p.x, y: p.y-1 });
      }

      if (cluster.length < 8) continue;

      let cx = 0, cy = 0;
      for (const p of cluster) { cx += p.x; cy += p.y; }
      cx = Math.floor(cx / cluster.length) * TILE + TILE / 2;
      cy = Math.floor(cy / cluster.length) * TILE + TILE / 2;

      let minCX = MAP_W, maxCX = 0, minCY = MAP_H, maxCY = 0;
      for (const p of cluster) { minCX = Math.min(minCX, p.x); maxCX = Math.max(maxCX, p.x); minCY = Math.min(minCY, p.y); maxCY = Math.max(maxCY, p.y); }
      const clusterW = (maxCX - minCX + 1) * TILE;
      const clusterH = (maxCY - minCY + 1) * TILE;
      const eyeSize = Math.min(clusterW * 0.4, clusterH * 0.4, 50);
      wallEyes.push({ x: cx, y: cy, size: eyeSize });

      const edges: Vec[] = [];
      for (const p of cluster) {
        const adj = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [adx, ady] of adj) {
          const nx = p.x + adx, ny = p.y + ady;
          if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H || map[ny][nx] !== 3) {
            edges.push({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });
            break;
          }
        }
      }

      const fissureCount = Math.min(4, 1 + Math.floor(cluster.length / 5));
      for (let f = 0; f < fissureCount; f++) {
        if (edges.length === 0) break;
        const start = edges[Math.floor(Math.random() * edges.length)];
        const angle = Math.atan2(start.y - cy, start.x - cx) + (Math.random() - 0.5) * 0.5;
        veinSpawns.push({ x: start.x, y: start.y, angle });
      }
    }
  }
}
