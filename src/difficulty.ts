import { FPS } from './constants';
import { game } from './state';

export function getDifficulty() {
  const minutes = game.time / (FPS * 60);
  const t = Math.min(1, minutes / 10);
  const curve = t * t;
  const lateCurve = t * t * t;
  const postBoss = Math.max(0, minutes - 10);
  const rage = postBoss * 0.3;
  return {
    spawnInterval: Math.max(2, Math.floor(90 - lateCurve * 85 - rage * 2)),
    spawnBatch: Math.min(25, 1 + Math.floor(lateCurve * 12) + Math.floor(rage * 3)),
    bruteChance: Math.min(0.8, 0.05 + curve * 0.5 + rage * 0.1),
    hpMult: 1 + curve * 4 + rage * 2,
    speedMult: 1 + curve * 0.8 + rage * 0.15,
    contactDmg: Math.ceil(3 + curve * 15 + rage * 5),
  };
}
