import { COL } from './constants';
import { player, weapon, players, game, enemies, lasers, chainArcs, chests, particles } from './state';
import { dist2, aimDir } from './math';
import { spawnParticles, spawnDrops, makeEnemy } from './spawning';
import { getDifficulty } from './difficulty';
import { Sound } from './audio/SoundEngine';
import type { Enemy, Laser, PlayerState } from './types';

// ── Affix effects ──
export function applyAffixOnHit(x: number, y: number, damage: number, hitEnemy: Enemy, ps: PlayerState = player) {
  // Chain lightning
  if (ps.activeAffixes.includes('chain')) {
    let lastPos = { x, y };
    let chainsLeft = 2;
    const hit = new Set<Enemy>([hitEnemy]);
    for (let c = 0; c < chainsLeft; c++) {
      let closest: Enemy | null = null;
      let closestDist = 50 * 50;
      for (const e of enemies) {
        if (hit.has(e) || e.hp <= 0) continue;
        const d = dist2(lastPos, e);
        if (d < closestDist) { closestDist = d; closest = e; }
      }
      if (!closest) break;
      const chainDmg = Math.max(1, Math.floor(damage * 0.5));
      closest.hp -= chainDmg;
      closest.hitFlash = 8;
      hit.add(closest);
      chainArcs.push({ x1: lastPos.x, y1: lastPos.y, x2: closest.x, y2: closest.y, life: 10 });
      if (closest.hp <= 0) {
        const idx = enemies.indexOf(closest);
        if (idx >= 0) onEnemyKill(closest, idx);
      }
      lastPos = { x: closest.x, y: closest.y };
    }
  }

  // Explosion
  if (ps.activeAffixes.includes('explosion')) {
    const aoeRadius = 25;
    spawnParticles(x, y, 15, '#ff6622', 3);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e === hitEnemy) continue;
      if (dist2({ x, y }, e) < aoeRadius * aoeRadius) {
        const aoeDmg = Math.max(1, Math.floor(damage * 0.5));
        e.hp -= aoeDmg;
        e.hitFlash = 8;
        if (e.hp <= 0) onEnemyKill(e, i);
      }
    }
  }

  // Freeze
  if (ps.activeAffixes.includes('freeze') && hitEnemy.hp > 0) {
    hitEnemy.slowTimer = 120;
  }

  // Burn
  if (ps.activeAffixes.includes('burn') && hitEnemy.hp > 0) {
    hitEnemy.burnTimer = 180;
    hitEnemy.burnDamage = Math.max(1, Math.floor(damage * 0.3));
  }
}

// Central damage handler
export function damagePlayer(baseDmg: number, fromX: number, fromY: number, ps: PlayerState = player): boolean {
  if (ps.invincible > 0) return false;
  if (ps.dead) return false;

  const armorLv = ps.upgradeLevels.get('armor') || 0;
  const dodgeLv = ps.upgradeLevels.get('dodge') || 0;

  if (dodgeLv > 0 && Math.random() < dodgeLv * 0.05) {
    spawnParticles(ps.x, ps.y, 5, '#8844cc', 2);
    if (ps.activeCombos.includes('phantom')) {
      ps.invincible = 120;
      spawnParticles(ps.x, ps.y, 10, '#8844cc', 3);
    }
    if (ps.activeCombos.includes('fortress')) {
      ps.invincible = Math.max(ps.invincible, 60);
      spawnParticles(ps.x, ps.y, 10, '#44aaff', 3);
    }
    return false;
  }

  let dmg = Math.max(1, baseDmg - armorLv);

  if (ps.activeCombos.includes('iron_skin')) {
    dmg = Math.max(1, Math.ceil(dmg * 0.5));
    ps.hp = Math.min(ps.hp + 1, ps.maxHp);
  }

  ps.hp -= dmg;
  ps.invincible = 60;
  ps.damageFlash = 12;
  game.shakeTimer = 8;
  ps.hitDirX = fromX - ps.x;
  ps.hitDirY = fromY - ps.y;
  Sound.hit();
  spawnParticles(ps.x, ps.y, 10, ps.visorColor, 2);
  return true;
}

export function applyAffixOnKill(_x: number, _y: number, ps: PlayerState = player) {
  if (ps.activeAffixes.includes('affix_lifesteal') && Math.random() < 0.15) {
    ps.hp = Math.min(ps.hp + 1, ps.maxHp);
  }
}

export function applyRicochet(hitX: number, hitY: number, damage: number, hitEnemy: Enemy, ps: PlayerState = player) {
  if (!ps.activeAffixes.includes('ricochet')) return;
  let closest: Enemy | null = null;
  let closestDist = 80 * 80;
  for (const e of enemies) {
    if (e === hitEnemy || e.hp <= 0) continue;
    const d = dist2({ x: hitX, y: hitY }, e);
    if (d < closestDist) { closestDist = d; closest = e; }
  }
  if (!closest) return;
  const aim = aimDir({ x: hitX, y: hitY }, closest);
  lasers.push({
    x: hitX, y: hitY,
    dx: aim.x * weapon.speed * 0.8, dy: aim.y * weapon.speed * 0.8,
    life: 30, fromPlayer: true,
    damage: Math.max(1, Math.floor(damage * 0.6)),
    size: Math.max(2, weapon.size - 1),
    pierce: 0, pierceHit: new Set(),
    color: '#ddaa44', glowColor: '#ffcc66', trailLength: 2,
    isSplit: true,
  });
}

export function applyComboOnHit(_l: Laser, _hitEnemy: Enemy) {
  // Kept as empty hook for future use
}

export function onEnemyKill(e: Enemy, index: number) {
  const isMiniboss = e.type === 'miniboss';
  const isBoss = e.type === 'boss';
  const isSuperBoss = e.type === 'superboss';

  const deathColor = isSuperBoss ? '#ff44ff' : isBoss ? COL.bossBody : isMiniboss ? COL.minibossBody : COL.enemyBody;
  const deathGlow = isSuperBoss ? '#ffaaff' : isBoss ? COL.bossEye : isMiniboss ? COL.minibossEye : COL.enemyEye;
  spawnParticles(e.x, e.y, isSuperBoss ? 50 : 20, deathColor, isSuperBoss ? 6 : 3);
  spawnParticles(e.x, e.y, isSuperBoss ? 30 : 10, deathGlow, isSuperBoss ? 5 : 2);
  spawnDrops(e.x, e.y, e.type);
  game.kills++;
  const killer = players.filter(p => !p.dead).reduce((best, p) => dist2(p, e) < dist2(best, e) ? p : best, players[0]);
  killer.kills++;
  if (isSuperBoss || isBoss) {
    Sound.bossKill();
    game.freezeFrame = isSuperBoss ? 12 : 6;
    game.freezeZoom = isSuperBoss ? 0.05 : 0.02;
  }
  else if (e.type === 'exploder') Sound.explosion();
  else Sound.kill();

  // Splitter: spawn 2 smaller scouts on death
  if (e.type === 'splitter') {
    const diff = getDifficulty();
    for (let si = 0; si < 2; si++) {
      const angle = Math.random() * Math.PI * 2;
      const child = makeEnemy({ x: e.x + Math.cos(angle) * 10, y: e.y + Math.sin(angle) * 10 }, 'swarm', diff);
      enemies.push(child);
    }
    spawnParticles(e.x, e.y, 10, '#44cc44', 3);
  }

  // Exploder: AoE explosion on death
  if (e.type === 'exploder') {
    const explR = 35;
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * Math.PI * 2;
      particles.push({
        x: e.x, y: e.y,
        dx: Math.cos(angle) * 4, dy: Math.sin(angle) * 4,
        life: 20, maxLife: 20,
        color: a % 3 === 0 ? '#ff2200' : a % 3 === 1 ? '#ff8800' : '#ffcc00', size: 4,
      });
    }
    spawnParticles(e.x, e.y, 20, '#ff4400', 5);
    for (const ne of enemies) {
      if (ne === e || ne.hp <= 0) continue;
      if (dist2({ x: e.x, y: e.y }, ne) < explR * explR) { ne.hp -= 5; ne.hitFlash = 8; }
    }
    for (const pp of players) {
      if (!pp.dead && pp.invincible <= 0 && dist2({ x: e.x, y: e.y }, pp) < explR * explR) {
        pp.hp -= 10; pp.invincible = 30; pp.damageFlash = 8; game.shakeTimer = 6;
      }
    }
  }

  // Life steal and affix effects for all alive players
  for (const pp of players) {
    if (pp.dead) continue;
    const lsLv = pp.upgradeLevels.get('life_steal') || 0;
    if (lsLv > 0 && Math.random() < lsLv * 0.01) {
      if (pp.activeCombos.includes('second_life')) {
        const shieldCap = 20 + (pp.upgradeLevels.get('max_hp') || 0) * 5 + pp.weapon.size * 2;
        pp.hp = Math.min(pp.hp + 1, pp.maxHp + shieldCap);
      } else {
        pp.hp = Math.min(pp.hp + 1, pp.maxHp);
      }
      spawnParticles(pp.x, pp.y, 2, '#44ff44', 1);
    }
    applyAffixOnKill(e.x, e.y, pp);

    // Nova on kill
    if (pp.activeSuperRares.includes('nova_on_kill') && Math.random() < pp.novaOnKillChance) {
      spawnParticles(e.x, e.y, 25, '#ff4488', 4);
      const novaR = 35;
      for (const ne of enemies) {
        if (ne === e || ne.hp <= 0) continue;
        if (dist2({ x: e.x, y: e.y }, ne) < novaR * novaR) {
          ne.hp -= pp.weapon.damage * 2; ne.hitFlash = 8;
        }
      }
    }
  }

  // Chest drops
  if (isSuperBoss) {
    chests.push({ x: e.x, y: e.y, rarity: 'rare', opened: false, openTimer: 0 });
    spawnParticles(e.x, e.y, 60, '#ff44ff', 7);
  } else if (isBoss) {
    chests.push({ x: e.x, y: e.y, rarity: 'rare', opened: false, openTimer: 0 });
    spawnParticles(e.x, e.y, 40, COL.bossEye, 5);
  } else if (isMiniboss) {
    chests.push({ x: e.x, y: e.y, rarity: 'common', opened: false, openTimer: 0 });
    spawnParticles(e.x, e.y, 25, COL.minibossEye, 4);
  }

  enemies.splice(index, 1);
}
