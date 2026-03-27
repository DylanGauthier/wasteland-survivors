import { TILE, MAP_W, MAP_H, FPS, MAX_ENEMIES } from './constants';
import { VIEW_W, VIEW_H } from './constants';
import { players, game, enemies, particles, drops } from './state';
import { isSolid } from './collision';
import { getDifficulty } from './difficulty';
import type { Vec, Enemy } from './types';

export function findSpawnPos(): Vec | null {
  const alivePlayers = players.filter(p => !p.dead);
  const midX = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.x, 0) / alivePlayers.length : players[0].x;
  const midY = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.y, 0) / alivePlayers.length : players[0].y;
  const camX = midX - VIEW_W / 2;
  const camY = midY - VIEW_H / 2;
  for (let attempt = 0; attempt < 20; attempt++) {
    const side = Math.floor(Math.random() * 4);
    let ex: number, ey: number;
    switch (side) {
      case 0: ex = camX + Math.random() * VIEW_W; ey = camY - 20; break;
      case 1: ex = camX + Math.random() * VIEW_W; ey = camY + VIEW_H + 20; break;
      case 2: ex = camX - 20; ey = camY + Math.random() * VIEW_H; break;
      default: ex = camX + VIEW_W + 20; ey = camY + Math.random() * VIEW_H; break;
    }
    const margin = TILE;
    ex = Math.max(margin, Math.min(MAP_W * TILE - margin, ex));
    ey = Math.max(margin, Math.min(MAP_H * TILE - margin, ey));
    if (!isSolid(ex, ey) && !isSolid(ex - 5, ey - 5) && !isSolid(ex + 5, ey + 5)) {
      return { x: ex, y: ey };
    }
  }
  return null;
}

export function makeEnemy(pos: Vec, type: Enemy['type'], diff: ReturnType<typeof getDifficulty>): Enemy {
  const stats: Record<string, { hp: number; speed: number }> = {
    scout:    { hp: 4,  speed: 0.55 },
    brute:    { hp: 10, speed: 0.35 },
    dasher:   { hp: 6,  speed: 0.3 },
    splitter: { hp: 8,  speed: 0.45 },
    tank:     { hp: 25, speed: 0.18 },
    swarm:    { hp: 2,  speed: 0.7 },
    exploder: { hp: 4,  speed: 0.6 },
    caster:   { hp: 6,  speed: 0.25 },
  };
  const s = stats[type] || stats.scout;
  const coopMult = players.filter(p => !p.dead).length > 1 ? 1.5 : 1;
  return {
    x: pos.x, y: pos.y,
    hp: Math.ceil(s.hp * diff.hpMult * coopMult),
    maxHp: Math.ceil(s.hp * diff.hpMult * coopMult),
    speed: s.speed * diff.speedMult,
    baseSpeed: s.speed * diff.speedMult,
    type,
    dir: 'down',
    shootTimer: 60 + Math.random() * 120,
    hitFlash: 0, animTimer: 0,
    slowTimer: 0, burnTimer: 0, burnDamage: 0,
    dashTimer: type === 'dasher' ? 90 + Math.floor(Math.random() * 60) : 0,
    dashDirX: 0, dashDirY: 0,
    emergeTimer: 30,
  };
}

export function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  const pos = findSpawnPos();
  if (!pos) return;
  const diff = getDifficulty();
  const minutes = game.time / (FPS * 60);

  const roll = Math.random();
  let type: Enemy['type'];

  if (minutes >= 3.5 && roll < 0.08) {
    for (let s = 0; s < 5; s++) {
      const sp = findSpawnPos();
      if (sp) enemies.push(makeEnemy(sp, 'swarm', diff));
    }
    return;
  } else if (minutes >= 2 && roll < 0.10) {
    type = 'caster';
  } else if (minutes >= 3 && roll < 0.15) {
    type = 'exploder';
  } else if (minutes >= 2 && roll < 0.18) {
    type = 'tank';
  } else if (minutes >= 1.5 && roll < 0.25) {
    type = 'splitter';
  } else if (minutes >= 1 && roll < 0.3) {
    type = 'dasher';
  } else if (roll < diff.bruteChance) {
    type = 'brute';
  } else {
    type = 'scout';
  }

  const enemy = makeEnemy(pos, type, diff);

  const eliteChance = Math.min(0.15, minutes * 0.01);
  if (minutes >= 3 && Math.random() < eliteChance) {
    const affixes: Enemy['elite'][] = ['fire_trail', 'teleport', 'reflect', 'haste', 'regen'];
    enemy.elite = affixes[Math.floor(Math.random() * affixes.length)];
    enemy.hp = Math.ceil(enemy.hp * 2.5);
    enemy.maxHp = enemy.hp;
    if (enemy.elite === 'haste') { enemy.speed *= 1.8; enemy.baseSpeed *= 1.8; }
    if (enemy.elite === 'teleport') enemy.teleportTimer = 120 + Math.floor(Math.random() * 60);
  }

  enemies.push(enemy);
}

export function spawnMiniBoss() {
  const pos = findSpawnPos();
  if (!pos) return;
  const diff = getDifficulty();
  const coopMult = players.filter(p => !p.dead).length > 1 ? 1.5 : 1;
  const hp = Math.ceil(15 * diff.hpMult * coopMult);
  enemies.push({
    x: pos.x, y: pos.y,
    hp, maxHp: hp,
    speed: 0.5 * diff.speedMult,
    baseSpeed: 0.5 * diff.speedMult,
    type: 'miniboss',
    dir: 'down',
    shootTimer: 30,
    hitFlash: 0, animTimer: 0,
    slowTimer: 0, burnTimer: 0, burnDamage: 0,
    emergeTimer: 0,
  });
  game.miniBossCount++;
}

export function spawnBoss() {
  const pos = findSpawnPos();
  if (!pos) return;
  const diff = getDifficulty();
  const coopMult = players.filter(p => !p.dead).length > 1 ? 1.5 : 1;
  const hp = Math.ceil(40 * diff.hpMult * coopMult);
  enemies.push({
    x: pos.x, y: pos.y,
    hp, maxHp: hp,
    speed: 0.4 * diff.speedMult,
    baseSpeed: 0.4 * diff.speedMult,
    type: 'boss',
    dir: 'down',
    shootTimer: 40,
    hitFlash: 0, animTimer: 0,
    bossPhase: 0, bossAttackTimer: 120,
    slowTimer: 0, burnTimer: 0, burnDamage: 0,
    emergeTimer: 0,
  });
  game.bossCount++;
}

export function spawnSuperBoss() {
  const pos = findSpawnPos();
  if (!pos) return;
  const diff = getDifficulty();
  const coopMult = players.filter(p => !p.dead).length > 1 ? 1.5 : 1;
  const hp = Math.ceil(120 * diff.hpMult * coopMult);
  enemies.push({
    x: pos.x, y: pos.y,
    hp, maxHp: hp,
    speed: 0.3 * diff.speedMult,
    baseSpeed: 0.3 * diff.speedMult,
    type: 'superboss',
    dir: 'down',
    shootTimer: 40,
    hitFlash: 0, animTimer: 0,
    bossPhase: 0, bossAttackTimer: 90,
    slowTimer: 0, burnTimer: 0, burnDamage: 0,
    emergeTimer: 0,
  });
  game.superBossSpawned = true;
}

export function spawnDrops(x: number, y: number, enemyType: Enemy['type']) {
  if (drops.length > 400) return;
  const xpCount = enemyType === 'superboss' ? 30 : enemyType === 'boss' ? 20 : enemyType === 'miniboss' ? 10 : enemyType === 'brute' ? 4 : 2;
  const xpValue = enemyType === 'superboss' ? 10 : enemyType === 'boss' ? 6 : enemyType === 'miniboss' ? 4 : enemyType === 'brute' ? 2 : 1;
  for (let i = 0; i < xpCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 12;
    drops.push({
      x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
      type: 'xp', value: xpValue, life: -1, age: 0,
      bobTimer: Math.random() * Math.PI * 2,
    });
  }
  const heartChance = enemyType === 'superboss' ? 1.0 : enemyType === 'boss' ? 0.5 : enemyType === 'miniboss' ? 0.2 : enemyType === 'brute' ? 0.05 : 0.02;
  if (Math.random() < heartChance) {
    drops.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      type: 'heart', value: 8, life: -1, age: 0,
      bobTimer: Math.random() * Math.PI * 2,
    });
  }
}

export function spawnParticles(x: number, y: number, count: number, color: string, speed = 2) {
  const maxParticles = 500;
  if (particles.length > maxParticles) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    particles.push({
      x, y, dx: Math.cos(a) * s, dy: Math.sin(a) * s,
      life: 15 + Math.random() * 20, maxLife: 35,
      color, size: 1 + Math.random() * 2,
    });
  }
}
