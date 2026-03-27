// ═══════════════════════════════════════════════════════
// WASTELAND SURVIVORS — Abyssal survivor shooter
// Dark, oppressive, eldritch. You are The Wanderer.
// ═══════════════════════════════════════════════════════

import { Music } from './audio/MusicEngine';
import { Sound } from './audio/SoundEngine';
import {
  TILE, SCALE, VIEW_W, VIEW_H, MAP_W, MAP_H, FPS, GAME_DURATION,
  MAX_UPGRADE_LEVEL, MAX_UPGRADES, MAX_ENEMIES, COL,
} from './constants';
import { canvas, ctx, buf, bx, bloomBuf, bloomCtx } from './canvas';
import { noise, hash, lerp, aimDir, rotateVec, dist2 } from './math';
import { drawText, textWidth, drawIcon, formatTime } from './font';
import {
  game, players, player, weapon, setPlayerContext, createPlayer,
  playerNames, playerColors, PLAYER_COLORS, titleState,
  getWeaponName, getWeaponColor, resetGame, registerResetVeinsCallback,
  lasers, enemies, particles, drops, chests, chainArcs,
  dmgNumbers, spawnDmgNumber, ashRain, shockRings, fallingMeteors,
  bladeProjs, beamLines, dangerZones,
  audioStarted, setAudioStarted, spawnTimer, setSpawnTimer,
} from './state';
import { map, generateMap, veins, wallEyes, veinSpawns } from './map';
import { keys, mouse, initInput } from './input';
import { isSolid, canMove } from './collision';
import { getDifficulty } from './difficulty';
import {
  findSpawnPos, makeEnemy, spawnEnemy, spawnMiniBoss, spawnBoss, spawnSuperBoss,
  spawnDrops, spawnParticles,
} from './spawning';
import {
  applyAffixOnHit, damagePlayer, applyAffixOnKill, applyRicochet,
  applyComboOnHit, onEnemyKill,
} from './combat';
import {
  openSelection, pickRandomUpgrades, pickRandom,
  selectOptionForPlayer, selectOption, updateSelection,
  isSkill, isSuperRare, isAffix,
  getCardLayout, getSortedSelectionMapForPlayer, getStatGain,
} from './selection';
import { UPGRADES } from './data/upgrades';
import { COMBOS, getActiveCombos, getCombosForUpgrade } from './data/combos';
import { AFFIXES } from './data/affixes';
import { SUPER_RARES } from './data/super-rares';
import { SKILLS } from './data/skills';
import { drawButton } from './draw/utils';
import { drawTile } from './draw/tiles';
import { drawWallEye } from './draw/map-effects';
import { drawPlayer, drawPlayerCoOp } from './draw/player';
import { drawEnemy, drawMiniBoss, drawBoss, drawSuperBoss } from './draw/enemies';
import { drawDrop, drawChest } from './draw/entities';
import { drawTitle, titleEyes, titleBricks } from './draw/title';
import { drawHUD } from './draw/hud';
import { drawSelectionScreen, drawCodex, drawGameOver } from './draw/screens';
import { updateTitle, startGameFromTitle } from './update/title-update';
import { render } from './render';
import type { Vec, Enemy, Laser, PlayerState } from './types';

// ── UPDATE ──
function update() {
  if (game.state === 'title') {
    updateTitle();
    return;
  }

  if (game.codexOpen) return;

  if (game.state === 'paused') {
    if (keys['arrowdown'] || keys['s']) { titleState.pauseCursor = 1; keys['arrowdown'] = false; keys['s'] = false; }
    if (keys['arrowup'] || keys['z']) { titleState.pauseCursor = 0; keys['arrowup'] = false; keys['z'] = false; }
    if (keys['enter'] || keys[' ']) {
      keys['enter'] = false; keys[' '] = false;
      if (titleState.pauseCursor === 0) game.state = 'playing';
      else resetGame();
    }
    if (mouse.clicked) {
      const btnW = 200, btnX = VIEW_W / 2 - btnW / 2;
      if (mouse.x >= btnX && mouse.x <= btnX + btnW) {
        if (mouse.y >= VIEW_H / 2 + 5 && mouse.y <= VIEW_H / 2 + 30) { game.state = 'playing'; }
        if (mouse.y >= VIEW_H / 2 + 35 && mouse.y <= VIEW_H / 2 + 60) { resetGame(); }
      }
      mouse.clicked = false;
    }
    return;
  }

  if (game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare') {
    updateSelection();
    return;
  }

  if (game.state === 'gameover') {
    game.deathScreenTimer++;
    if (game.deathScreenTimer > 60 && (mouse.clicked || keys['backspace'])) {
      resetGame();
    }
    mouse.clicked = false;
    return;
  }

  if (game.freezeFrame > 0) { game.freezeFrame--; game.freezeZoom *= 0.95; return; }

  if (game.lightningFlash > 0) game.lightningFlash--;

  game.time++;

  // ══ PER-PLAYER UPDATE LOOP ══
  for (const ps of players) {
    if (ps.dead) continue;
    setPlayerContext(ps);

    let dx = 0, dy = 0;
    if (ps.playerIndex === 0) {
      if (keys['z']) dy -= 1;
      if (keys['s']) dy += 1;
      if (keys['q']) dx -= 1;
      if (keys['d']) dx += 1;
      if (mouse.down && dx === 0 && dy === 0) {
        const alivePlayers = players.filter(p => !p.dead);
        const midX = alivePlayers.reduce((s, p) => s + p.x, 0) / alivePlayers.length;
        const midY = alivePlayers.reduce((s, p) => s + p.y, 0) / alivePlayers.length;
        const camXM = midX - VIEW_W / 2;
        const camYM = midY - VIEW_H / 2;
        const worldMX = mouse.x + camXM;
        const worldMY = mouse.y + camYM;
        const mdx = worldMX - ps.x, mdy = worldMY - ps.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist > 8) { dx = mdx / mdist; dy = mdy / mdist; }
      }
    } else {
      if (keys['arrowup']) dy -= 1;
      if (keys['arrowdown']) dy += 1;
      if (keys['arrowleft']) dx -= 1;
      if (keys['arrowright']) dx += 1;
    }

    ps.moving = dx !== 0 || dy !== 0;
    if (ps.moving) {
      if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) { dx /= len; dy /= len; }
      }
      const mx = dx * ps.speed, my = dy * ps.speed;
      if (canMove(ps.x, ps.y, mx, 0, 5)) ps.x += mx;
      if (canMove(ps.x, ps.y, 0, my, 5)) ps.y += my;
      if (Math.abs(dx) > Math.abs(dy)) ps.dir = dx > 0 ? 'right' : 'left';
      else ps.dir = dy > 0 ? 'down' : 'up';
    }

    ps.animTimer++;
    if (ps.moving && game.time % 4 === 0) {
      ps.ghostTrail.push({ x: ps.x, y: ps.y, dir: ps.dir, age: 0 });
      if (ps.ghostTrail.length > 8) ps.ghostTrail.shift();
    }
    for (const g of ps.ghostTrail) g.age++;
    if (ps.animTimer > 8) { ps.animTimer = 0; ps.animFrame = (ps.animFrame + 1) % 4; }
    if (ps.invincible > 0) ps.invincible--;
    if (ps.damageFlash > 0) ps.damageFlash--;

    // Auto-shooting toward nearest enemy
    if (ps.shootCooldown > 0) ps.shootCooldown--;
    let autoTarget: Enemy | null = null;
    let autoTargetDist = 250 * 250;
    for (const e of enemies) {
      const d = dist2(ps, e);
      if (d < autoTargetDist) { autoTargetDist = d; autoTarget = e; }
    }
    if (autoTarget && ps.shootCooldown <= 0) {
      const baseAim = aimDir(ps, autoTarget);

      const hasDR = ps.activeCombos.includes('death_ray');
      const hasCB = ps.activeCombos.includes('carpet_bomb');
      const hasMeteor = ps.activeCombos.includes('meteor');
      const hasSniper = ps.activeCombos.includes('sniper');
      const hasRailgun = ps.activeCombos.includes('railgun');
      const hasBH = ps.activeCombos.includes('bullet_hell');

      const pColor = hasDR ? '#ff2244' : hasMeteor ? '#ff6600' : hasCB ? '#ff8822' :
                     hasSniper ? '#4488ff' : hasRailgun ? '#88ffff' : hasBH ? '#ffff44' : getWeaponColor();
      const pGlow = hasDR ? '#ff4466' : hasMeteor ? '#ffaa44' : hasCB ? '#ffaa44' :
                    hasSniper ? '#88bbff' : hasRailgun ? '#aaffff' : hasBH ? '#ffffaa' : pColor;
      const sizeBonus = hasCB ? 3 : hasMeteor ? 2 : 0;
      const trailBonus = hasDR ? 6 : hasSniper ? 5 : hasRailgun ? 4 : 0;
      const speedMult = hasRailgun ? 2.5 : hasSniper ? 1.8 : 1;
      const lifeBonus = hasSniper ? 40 : hasRailgun ? 20 : 0;

      for (let i = 0; i < weapon.count; i++) {
        let aim = baseAim;
        if (weapon.count > 1) {
          const spreadAngle = (i - (weapon.count - 1) / 2) * weapon.spread;
          aim = rotateVec(baseAim, spreadAngle);
        }
        lasers.push({
          x: ps.x, y: ps.y,
          dx: aim.x * weapon.speed * speedMult, dy: aim.y * weapon.speed * speedMult,
          life: 60 + lifeBonus, fromPlayer: true,
          damage: weapon.damage, size: weapon.size + sizeBonus,
          pierce: weapon.pierce, pierceHit: new Set(),
          color: pColor, glowColor: pGlow,
          trailLength: Math.min(8, 1 + Math.floor(weapon.damage / 2) + trailBonus),
        });
      }
      const flashSize = (hasDR || hasCB || hasMeteor) ? 6 : 3;
      spawnParticles(ps.x + baseAim.x * 6, ps.y + baseAim.y * 6, flashSize, pColor, 2);
      ps.shootCooldown = weapon.fireRate;
      Sound.shoot();
    }

    // Orbital
    const orbitalLv = ps.upgradeLevels.get('orbital') || 0;
    if (orbitalLv > 0) {
      ps.orbitalAngle += 0.05;
      if (game.time % 20 === 0) {
        for (let i = 0; i < orbitalLv; i++) {
          const angle = ps.orbitalAngle + (i / orbitalLv) * Math.PI * 2;
          const ox = ps.x + Math.cos(angle) * 30;
          const oy = ps.y + Math.sin(angle) * 30;
          lasers.push({
            x: ox, y: oy,
            dx: Math.cos(angle + Math.PI / 2) * 2,
            dy: Math.sin(angle + Math.PI / 2) * 2,
            life: 15, fromPlayer: true,
            damage: Math.max(1, Math.floor(weapon.damage * 0.5)),
            size: 2, pierce: 0, pierceHit: new Set(),
            color: '#aaaaff', glowColor: '#ccccff', trailLength: 1,
          });
        }
      }
    }

    // Check combos
    ps.activeCombos = getActiveCombos(ps).map(c => c.id);

    // Combo: BULLET TIME
    if (ps.activeCombos.includes('bullet_time') && game.time % (15 * FPS) === 0) {
      for (const e of enemies) { e.slowTimer = Math.max(e.slowTimer, 180); }
      spawnParticles(ps.x, ps.y, 20, '#aaccff', 3);
    }

    // Combo: WARP FIELD
    if (ps.activeCombos.includes('warp_field')) {
      for (const dr of drops) {
        const ddx = ps.x - dr.x, ddy = ps.y - dr.y;
        const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (ddist > 2) { dr.x += (ddx / ddist) * 3; dr.y += (ddy / ddist) * 3; }
      }
    }

    // ══ COMBO ABILITIES ══
    const uMulti = weapon.count;
    const uCaliber = weapon.size;
    const uFireRate = ps.upgradeLevels.get('fire_rate') || 0;
    const uVelocity = weapon.speed;
    const uDmg = weapon.damage;
    const uPierce = weapon.pierce;
    const uLeech = ps.upgradeLevels.get('life_steal') || 0;
    const uThorns = ps.upgradeLevels.get('thorns') || 0;
    const uOrbital = ps.upgradeLevels.get('orbital') || 0;
    const uSpeed = ps.speed;
    const uVitality = ps.upgradeLevels.get('max_hp') || 0;
    const uMagnet = ps.upgradeLevels.get('pickup_radius') || 0;

    function comboHeal(amount: number) {
      if (uLeech > 0 && Math.random() < uLeech * 0.03) {
        ps.hp = Math.min(ps.hp + amount, ps.maxHp + (ps.activeCombos.includes('second_life') ? 30 + uVitality * 5 : 0));
        spawnParticles(ps.x, ps.y, 2, '#44ff44', 1);
      }
    }

    // BLADE STORM
    if (ps.activeCombos.includes('blade_storm')) {
      const bladeFreq = Math.max(20, 90 - uFireRate * 8);
      if (game.time % bladeFreq === 0) {
        const swordCount = 4 + uMulti + uOrbital;
        const bladeSpeed = 3 + uVelocity * 0.3 + uSpeed * 0.3;
        for (let s = 0; s < swordCount; s++) {
          const spreadAngle = (s / swordCount) * Math.PI * 2 + game.time * 0.01 + uSpeed * 0.1;
          bladeProjs.push({
            x: ps.x, y: ps.y,
            dx: Math.cos(spreadAngle) * bladeSpeed, dy: Math.sin(spreadAngle) * bladeSpeed,
            life: 60 + uPierce * 12 + uVelocity * 3, angle: spreadAngle,
          });
        }
        spawnParticles(ps.x, ps.y, 12, '#ff4488', 3);
      }
    }

  // NOVA PULSE — BLACK HOLE
  if (ps.activeCombos.includes('nova_pulse')) {
    const novaFreq = Math.max(4 * FPS, 10 * FPS - uFireRate * 25);
    if (!ps.novaOrbActive && game.time % novaFreq === 0 && enemies.length > 0) {
      let bestX = ps.x, bestY = ps.y, bestCount = 0;
      for (const e of enemies) {
        if (dist2(ps, e) > 200 * 200) continue;
        let count = 0;
        for (const e2 of enemies) { if (dist2(e, e2) < 60 * 60) count++; }
        if (count > bestCount) { bestCount = count; bestX = e.x; bestY = e.y; }
      }
      const aim = aimDir(ps, { x: bestX, y: bestY });
      const targetDist = Math.sqrt(dist2(ps, { x: bestX, y: bestY }));
      const travelTime = Math.min(60, Math.floor(targetDist / 2));
      ps.novaOrbActive = {
        x: ps.x, y: ps.y,
        dx: aim.x * (targetDist / Math.max(1, travelTime)),
        dy: aim.y * (targetDist / Math.max(1, travelTime)),
        life: travelTime + 4 * FPS + 10,
        maxLife: travelTime + 4 * FPS + 10,
      };
      (ps.novaOrbActive as any).travelTime = travelTime;
      (ps.novaOrbActive as any).growStart = travelTime;
      (ps.novaOrbActive as any).currentRadius = 5;
    }
    if (ps.novaOrbActive) {
      const orb = ps.novaOrbActive as any;
      orb.life--;
      const travelLeft = orb.life - (orb.maxLife - orb.travelTime);

      if (travelLeft > 0) {
        orb.x += orb.dx; orb.y += orb.dy;
      } else {
        orb.dx = 0; orb.dy = 0;
        const growTime = 4 * FPS;
        const growProgress = 1 - (orb.life - 10) / growTime;
        const maxRadius = 30 + uCaliber * 8 + uMagnet * 5;
        orb.currentRadius = 5 + growProgress * maxRadius;

        const pullR = orb.currentRadius * 2.5;
        const pullForce = 1 + growProgress * 4 + uMagnet * 0.5;
        for (const e of enemies) {
          const edx = orb.x - e.x, edy = orb.y - e.y;
          const ed = Math.sqrt(edx * edx + edy * edy);
          if (ed < pullR && ed > 2) {
            const f = pullForce * (1 - ed / pullR);
            e.x += (edx / ed) * f;
            e.y += (edy / ed) * f;
            if (uThorns > 0 && game.time % 10 === 0) { e.hp -= uThorns; e.hitFlash = 3; }
          }
        }
        for (const dr of drops) {
          const ddx = orb.x - dr.x, ddy = orb.y - dr.y;
          const dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd < pullR && dd > 2) { dr.x += (ddx / dd) * 2; dr.y += (ddy / dd) * 2; }
        }
        if (growProgress > 0.5) game.shakeTimer = Math.max(game.shakeTimer, 2);
      }

      if (orb.life <= 10) {
        if (orb.life === 10) {
          const explR = orb.currentRadius * 2;
          Sound.explosion();
          game.shakeTimer = 20;
          game.lightningFlash = 8;
          for (let a = 0; a < 32; a++) {
            const angle = (a / 32) * Math.PI * 2;
            const dist = explR * 0.8;
            particles.push({
              x: orb.x + Math.cos(angle) * dist, y: orb.y + Math.sin(angle) * dist,
              dx: -Math.cos(angle) * 4, dy: -Math.sin(angle) * 4,
              life: 10, maxLife: 10,
              color: a % 2 === 0 ? '#aa22ff' : '#ff44ff', size: 4,
            });
          }
          for (let a = 0; a < 24; a++) {
            const angle = (a / 24) * Math.PI * 2;
            particles.push({
              x: orb.x, y: orb.y,
              dx: Math.cos(angle) * 6, dy: Math.sin(angle) * 6,
              life: 25, maxLife: 25,
              color: a % 3 === 0 ? '#ff44ff' : a % 3 === 1 ? '#ffffff' : '#aa22ff',
              size: 5 + uCaliber * 0.3,
            });
          }
          spawnParticles(orb.x, orb.y, 30, '#ffffff', 5);
          for (const e of enemies) {
            if (dist2(orb, e) < explR * explR) {
              e.hp -= uDmg * 6 + uThorns * 3;
              e.hitFlash = 15;
              comboHeal(2);
            }
          }
        }
      }
      if (orb.life <= 0) ps.novaOrbActive = null;
    }
  }

  // SHOCKWAVE
  if (ps.activeCombos.includes('shockwave')) {
    const swFreq = Math.max(2 * FPS, 8 * FPS - uFireRate * 30);
    ps.shockwaveTimer--;
    if (ps.shockwaveTimer <= 0) {
      ps.shockwaveTimer = swFreq;
      game.shakeTimer = 12 + uDmg;
      Sound.shockwave();
      const swSpeed = 5 + uVelocity * 0.5 + uSpeed;
      const swRange = 350 + uCaliber * 30 + uMagnet * 20;
      const ringCount = 1 + Math.floor(uMulti / 3) + Math.floor(uOrbital / 2);
      for (let r = 0; r < ringCount; r++) {
        shockRings.push({ x: ps.x, y: ps.y, radius: 10 + r * 8, maxRadius: swRange, speed: swSpeed - r * 0.5, life: 60, color: r === 0 ? '#44ffaa' : '#ffffff' });
      }
      spawnParticles(ps.x, ps.y, 15, '#44ffaa', 4);
      if (uVitality > 0) ps.invincible = Math.max(ps.invincible, 15);
    }
  }
  for (let i = shockRings.length - 1; i >= 0; i--) {
    const sr = shockRings[i];
    const prevR = sr.radius;
    sr.radius += sr.speed;
    sr.life--;
    if (sr.life <= 0 || sr.radius > sr.maxRadius) { shockRings.splice(i, 1); continue; }
    for (const e of enemies) {
      const d = Math.sqrt(dist2(sr, e));
      if (d >= prevR && d < sr.radius + 10) {
        const dx2 = e.x - sr.x, dy2 = e.y - sr.y;
        if (d > 0) {
          const pushForce = 8 + uDmg * 1 + uThorns;
          const newX = e.x + (dx2 / d) * pushForce;
          const newY = e.y + (dy2 / d) * pushForce;
          e.x = Math.max(TILE, Math.min(MAP_W * TILE - TILE, newX));
          e.y = Math.max(TILE, Math.min(MAP_H * TILE - TILE, newY));
          e.hp -= uDmg * 2 + uThorns;
          comboHeal(1);
          e.hitFlash = 8;
        }
      }
    }
  }

  // METEOR
  if (ps.activeCombos.includes('meteor')) {
    ps.meteorTimer--;
    const meteorFreq = Math.max(1.5 * FPS, 6 * FPS - uFireRate * 30);
    if (ps.meteorTimer <= 0) {
      ps.meteorTimer = meteorFreq;
      const meteorCount = 1 + Math.floor(uMulti / 2) + Math.floor(uOrbital / 3);
      const meteorRadius = 35 + uCaliber * 5 + uMagnet * 3;
      const meteorDmg = uDmg * 8 + uThorns * 3;
      for (let mi = 0; mi < meteorCount; mi++) {
        let bestX = ps.x + (Math.random() - 0.5) * 80;
        let bestY = ps.y + (Math.random() - 0.5) * 80;
        const candidates = enemies.filter(e => dist2(ps, e) < (200 + uVelocity * 20) * (200 + uVelocity * 20));
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          bestX = target.x; bestY = target.y;
        }
        const fallSpeed = Math.max(50, 90 - uVelocity * 3);
        fallingMeteors.push({ x: bestX, y: bestY, fallTimer: fallSpeed, radius: meteorRadius, damage: meteorDmg });
      }
    }
  }
  for (let i = fallingMeteors.length - 1; i >= 0; i--) {
    const fm = fallingMeteors[i];
    fm.fallTimer--;
    if (fm.fallTimer <= 0) {
      game.shakeTimer = 15;
      Sound.explosion();
      for (let a = 0; a < 32; a++) {
        const angle = (a / 32) * Math.PI * 2;
        particles.push({ x: fm.x, y: fm.y, dx: Math.cos(angle) * 6, dy: Math.sin(angle) * 6,
          life: 30, maxLife: 30, color: a % 3 === 0 ? '#ff2200' : a % 3 === 1 ? '#ff8800' : '#ffcc00', size: 5 });
      }
      spawnParticles(fm.x, fm.y, 40, '#ff4400', 7);
      spawnParticles(fm.x, fm.y, 20, '#ffffff', 4);
      for (const e of enemies) {
        if (dist2(fm, e) < fm.radius * fm.radius) { e.hp -= fm.damage; e.hitFlash = 12; }
      }
      for (let fi = 0; fi < 6; fi++) {
        if (ps.poisonTrails.length < 80) {
          ps.poisonTrails.push({ x: fm.x + (Math.random() - 0.5) * fm.radius, y: fm.y + (Math.random() - 0.5) * fm.radius, life: 240 });
        }
      }
      fallingMeteors.splice(i, 1);
    }
  }

  // CARPET BOMB
  if (ps.activeCombos.includes('carpet_bomb')) {
    const cbFreq = Math.max(2 * FPS, 8 * FPS - uFireRate * 30);
    ps.carpetBombTimer--;
    if (ps.carpetBombTimer <= 0) {
      ps.carpetBombTimer = cbFreq;
      const bombCount = 5 + uMulti + Math.floor(uOrbital / 2);
      const bombRadius = 25 + uCaliber * 4 + uMagnet * 2;
      const bombDmg = uDmg * 4 + uThorns * 2;
      const horizontal = Math.random() > 0.5;
      const camXb = ps.x - VIEW_W / 2;
      const camYb = ps.y - VIEW_H / 2;
      const spread = 60 + uCaliber * 5;
      for (let b = 0; b < bombCount; b++) {
        const delay = b * Math.max(3, 6 - uVelocity * 0.3);
        const bxp = horizontal
          ? camXb + (b / bombCount) * VIEW_W + (Math.random() - 0.5) * 30
          : ps.x + (Math.random() - 0.5) * spread;
        const byp = horizontal
          ? ps.y + (Math.random() - 0.5) * spread
          : camYb + (b / bombCount) * VIEW_H + (Math.random() - 0.5) * 30;
        const fallSpd = Math.max(30, 50 - uVelocity * 2);
        fallingMeteors.push({ x: bxp, y: byp, fallTimer: fallSpd + delay, radius: bombRadius, damage: bombDmg });
      }
    }
  }

  // DEATH RAY
  if (ps.activeCombos.includes('death_ray') && autoTarget) {
    const tickRate = Math.max(2, 5 - uFireRate);
    if (game.time % tickRate === 0) {
      const aim = aimDir(ps, autoTarget);
      const rayLen = 250 + uPierce * 40 + uVelocity * 20;
      const rayWidth = 10 + uCaliber * 2;
      const rayDmg = uDmg * 2 + uThorns;
      for (let d = 10; d < rayLen; d += 8) {
        const rx = ps.x + aim.x * d, ry = ps.y + aim.y * d;
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (dist2({ x: rx, y: ry }, e) < rayWidth * rayWidth) {
            e.hp -= rayDmg; e.hitFlash = 3; comboHeal(1);
          }
        }
      }
    }
  }

  // SNIPER
  if (ps.activeCombos.includes('sniper')) {
    const snFreq = Math.max(1 * FPS, 4 * FPS - uFireRate * 20);
    ps.sniperTimer--;
    if (ps.sniperTimer <= 0 && autoTarget) {
      ps.sniperTimer = snFreq;
      const shotCount = 1 + Math.floor(uMulti / 3);
      const snipeDmg = uDmg * 10 + uThorns * 3;
      const lineLen = 500 + uVelocity * 30 + uPierce * 50;
      for (let si = 0; si < shotCount; si++) {
        const target = si === 0 ? autoTarget : enemies[Math.floor(Math.random() * enemies.length)];
        if (!target) continue;
        const aim = aimDir(ps, target);
        beamLines.push({
          x1: ps.x, y1: ps.y, x2: ps.x + aim.x * lineLen, y2: ps.y + aim.y * lineLen,
          life: 12, color: '#4488ff', width: 2 + uCaliber * 0.5,
        });
        for (let d = 10; d < lineLen; d += 8) {
          const sx = ps.x + aim.x * d, sy = ps.y + aim.y * d;
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (dist2({ x: sx, y: sy }, e) < (10 + uCaliber) * (10 + uCaliber)) {
              e.hp -= snipeDmg; e.hitFlash = 10; comboHeal(2);
              spawnParticles(e.x, e.y, 4, '#4488ff', 3);
            }
          }
        }
      }
      game.shakeTimer = 3 + shotCount;
    }
  }

  // RAILGUN
  if (ps.activeCombos.includes('railgun')) {
    const rgFreq = Math.max(1 * FPS, 3 * FPS - uFireRate * 15);
    ps.railgunTimer--;
    if (ps.railgunTimer <= 0 && autoTarget) {
      ps.railgunTimer = rgFreq;
      const lineCount = 1 + Math.floor(uMulti / 4);
      const lineLen = 600 + uVelocity * 30 + uPierce * 40;
      const rgDmg = uDmg * 5 + uThorns * 2;
      for (let ri = 0; ri < lineCount; ri++) {
        const target = ri === 0 ? autoTarget : enemies[Math.floor(Math.random() * enemies.length)];
        if (!target) continue;
        const aim = aimDir(ps, target);
        beamLines.push({
          x1: ps.x, y1: ps.y, x2: ps.x + aim.x * lineLen, y2: ps.y + aim.y * lineLen,
          life: 8, color: '#88ffff', width: 2 + uCaliber * 0.4,
        });
        for (let d = 10; d < lineLen; d += 6) {
          const rx = ps.x + aim.x * d, ry = ps.y + aim.y * d;
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (dist2({ x: rx, y: ry }, e) < (8 + uCaliber) * (8 + uCaliber)) {
              e.hp -= rgDmg; e.hitFlash = 8; comboHeal(1);
            }
          }
        }
      }
      game.shakeTimer = 2 + lineCount;
    }
  }

  // BULLET TIME
  if (ps.activeCombos.includes('bullet_time')) {
    const btFreq = Math.max(8 * FPS, 15 * FPS - uFireRate * 30);
    ps.bulletTimeTimer--;
    if (ps.bulletTimeTimer <= 0) {
      ps.bulletTimeTimer = btFreq;
      ps.bulletTimeActive = Math.floor(3 * FPS + uPierce * 15 + uVelocity * 5);
      spawnParticles(ps.x, ps.y, 15, '#aaccff', 3);
      if (uSpeed > 1.5) ps.invincible = Math.max(ps.invincible, 10);
    }
    if (ps.bulletTimeActive > 0) {
      ps.bulletTimeActive--;
      for (const e of enemies) { e.slowTimer = Math.max(e.slowTimer, 5); }
      if (uThorns > 0 && game.time % 30 === 0) {
        for (const e of enemies) {
          if (dist2(ps, e) < (80 + uCaliber * 10) * (80 + uCaliber * 10)) {
            e.hp -= uThorns; e.hitFlash = 3;
          }
        }
      }
      if (uVitality > 0 && game.time % 60 === 0) {
        ps.hp = Math.min(ps.hp + 1, ps.maxHp);
      }
      if (uMagnet > 0) {
        for (const dr of drops) {
          const ddx = ps.x - dr.x, ddy = ps.y - dr.y;
          const dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > 2) { dr.x += (ddx / dd) * 2; dr.y += (ddy / dd) * 2; }
        }
      }
    }
  }

  // WARP FIELD
  if (ps.activeCombos.includes('warp_field')) {
    const wfRange = 50 + uMagnet * 20 + uSpeed * 10 + uCaliber * 5;
    const pullStr = 2.5 + uVelocity * 0.3 + uMagnet * 0.5;
    for (const dr of drops) {
      const ddx = ps.x - dr.x, ddy = ps.y - dr.y;
      const dd = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dd > 2 && dd < wfRange * 3) {
        dr.x += (ddx / dd) * pullStr;
        dr.y += (ddy / dd) * pullStr;
      }
    }
    if (game.time % 10 === 0) {
      for (const e of enemies) {
        const dx2 = e.x - ps.x, dy2 = e.y - ps.y;
        const d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d < wfRange && d > 0) {
          const pushStr = 1.5 + uDmg * 0.3;
          e.x += (dx2 / d) * pushStr;
          e.y += (dy2 / d) * pushStr;
          if (uThorns > 0) { e.hp -= uThorns; e.hitFlash = 2; comboHeal(1); }
        }
      }
    }
  }

  // Right-click skill
  if (ps.skillCooldown > 0) ps.skillCooldown--;
  const useSkill = ps.playerIndex === 0 ? mouse.rightClicked : keys['enter'];
  if (useSkill && ps.activeSkill && ps.skillCooldown <= 0 && ps.skillActive <= 0) {
    const skill = ps.activeSkill;
    ps.skillCooldown = skill.cooldown;
    let worldMX = ps.x, worldMY = ps.y;
    if (ps.playerIndex === 0) {
      const alivePl = players.filter(p => !p.dead);
      const mX = alivePl.reduce((s, p) => s + p.x, 0) / alivePl.length;
      const mY = alivePl.reduce((s, p) => s + p.y, 0) / alivePl.length;
      worldMX = mouse.x + (mX - VIEW_W / 2);
      worldMY = mouse.y + (mY - VIEW_H / 2);
    } else {
      const dirVec = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      const dv = dirVec[ps.dir];
      worldMX = ps.x + dv.x * 100;
      worldMY = ps.y + dv.y * 100;
    }
    switch (skill.id) {
      case 'dash': {
        Sound.dash();
        const aim = aimDir(ps, { x: worldMX, y: worldMY });
        ps.dashDx = aim.x * 7; ps.dashDy = aim.y * 7;
        ps.skillActive = 20; ps.invincible = 25;
        spawnParticles(ps.x, ps.y, 20, '#44ffcc', 4);
        for (const e of enemies) {
          if (dist2(ps, e) < 40 * 40) { e.hp -= weapon.damage * 3; e.hitFlash = 10; }
        }
        break;
      }
      case 'grenade': {
        Sound.explosion();
        const aim = aimDir(ps, { x: worldMX, y: worldMY });
        const gx = ps.x + aim.x * 120, gy = ps.y + aim.y * 120;
        spawnParticles(gx, gy, 40, '#ff6622', 6);
        spawnParticles(gx, gy, 25, '#ffaa44', 4);
        spawnParticles(gx, gy, 15, '#ffffff', 3);
        game.shakeTimer = 8;
        for (const e of enemies) {
          if (dist2({ x: gx, y: gy }, e) < 80 * 80) { e.hp -= weapon.damage * 5; e.hitFlash = 12; }
        }
        break;
      }
      case 'shield_skill': {
        ps.skillActive = 180; ps.invincible = 185;
        spawnParticles(ps.x, ps.y, 20, '#4488ff', 3);
        break;
      }
      case 'shockwave': {
        Sound.shockwave();
        for (let ring = 0; ring < 3; ring++) {
          for (let a = 0; a < 24; a++) {
            const angle = (a / 24) * Math.PI * 2;
            particles.push({
              x: ps.x, y: ps.y,
              dx: Math.cos(angle) * (3 + ring * 2), dy: Math.sin(angle) * (3 + ring * 2),
              life: 20 + ring * 5, maxLife: 25 + ring * 5,
              color: ring === 0 ? '#ffffff' : ring === 1 ? '#ffcc44' : '#ff8822',
              size: 3 - ring * 0.5,
            });
          }
        }
        spawnParticles(ps.x, ps.y, 40, '#ffee88', 6);
        spawnParticles(ps.x, ps.y, 20, '#ffffff', 3);
        game.shakeTimer = 12;
        for (const e of enemies) {
          const ddx = e.x - ps.x, ddy = e.y - ps.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < 120 && d > 0) {
            const force = 40 * (1 - d / 120);
            e.x += (ddx / d) * force; e.y += (ddy / d) * force;
            e.hp -= weapon.damage * 2; e.hitFlash = 12;
          }
        }
        break;
      }
    }
  }
  if (ps.playerIndex === 0) mouse.rightClicked = false;
  if (ps.playerIndex === 1 && keys['enter']) keys['enter'] = false;

  // Dash movement
  if (ps.skillActive > 0 && ps.activeSkill?.id === 'dash') {
    ps.x += ps.dashDx; ps.y += ps.dashDy;
    spawnParticles(ps.x, ps.y, 2, '#44ffcc', 1);
    ps.skillActive--;
  } else if (ps.skillActive > 0 && ps.activeSkill?.id === 'shield_skill') {
    ps.skillActive--;
  }

  // Drone
  if (ps.droneCount > 0) {
    ps.droneAngle += 0.03;
    if (game.time % 15 === 0) {
      for (let i = 0; i < ps.droneCount; i++) {
        const angle = ps.droneAngle + (i / ps.droneCount) * Math.PI * 2;
        const dxx = ps.x + Math.cos(angle) * 40;
        const dyy = ps.y + Math.sin(angle) * 40;
        let closest: Enemy | null = null;
        let closestDist = 120 * 120;
        for (const e of enemies) {
          const d = dist2({ x: dxx, y: dyy }, e);
          if (d < closestDist) { closestDist = d; closest = e; }
        }
        if (closest) {
          const aim = aimDir({ x: dxx, y: dyy }, closest);
          lasers.push({
            x: dxx, y: dyy, dx: aim.x * 4, dy: aim.y * 4,
            life: 30, fromPlayer: true,
            damage: Math.max(1, Math.floor(weapon.damage * 0.4)),
            size: 2, pierce: 0, pierceHit: new Set(),
            color: '#44ccff', glowColor: '#88ddff', trailLength: 1,
          });
        }
      }
    }
  }

  // Shadow Clone
  if (ps.shadowClone) {
    const sc = ps.shadowClone;
    sc.trail.push({ x: ps.x, y: ps.y });
    const delayFrames = 120;
    if (sc.trail.length > delayFrames) {
      const pos = sc.trail.shift()!;
      sc.x = pos.x; sc.y = pos.y;
    }
    const cloneFireRate = Math.max(8, weapon.fireRate + 4);
    if (game.time % cloneFireRate === 0) {
      let closest: Enemy | null = null;
      let closestDist = 150 * 150;
      for (const e of enemies) {
        const d = dist2(sc, e);
        if (d < closestDist) { closestDist = d; closest = e; }
      }
      if (closest) {
        const baseAim2 = aimDir(sc, closest);
        const cloneCount = Math.max(1, weapon.count - 1);
        const cloneDmg = Math.max(1, Math.floor(weapon.damage * 0.6));
        const clonePierce = Math.max(0, weapon.pierce - 1);
        for (let ci = 0; ci < cloneCount; ci++) {
          let aim = baseAim2;
          if (cloneCount > 1) {
            const spreadAngle = (ci - (cloneCount - 1) / 2) * weapon.spread;
            aim = rotateVec(baseAim2, spreadAngle);
          }
          lasers.push({
            x: sc.x, y: sc.y,
            dx: aim.x * weapon.speed * 0.8, dy: aim.y * weapon.speed * 0.8,
            life: 40, fromPlayer: true,
            damage: cloneDmg, size: Math.max(2, weapon.size - 1),
            pierce: clonePierce, pierceHit: new Set(),
            color: '#8844cc', glowColor: '#aa66ee', trailLength: 2,
          });
        }
      }
    }
  }

  // Thunder
  if (ps.activeSuperRares.includes('thunder')) {
    ps.thunderTimer--;
    if (ps.thunderTimer <= 0) {
      ps.thunderTimer = 180;
      if (enemies.length > 0) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        target.hp -= weapon.damage * 4; target.hitFlash = 15;
        chainArcs.push({ x1: target.x, y1: target.y - 200, x2: target.x + (Math.random()-0.5)*30, y2: target.y, life: 15 });
        chainArcs.push({ x1: target.x + (Math.random()-0.5)*15, y1: target.y - 150, x2: target.x, y2: target.y, life: 12 });
        spawnParticles(target.x, target.y, 20, '#ffff88', 5);
        spawnParticles(target.x, target.y, 10, '#ffffff', 3);
        game.lightningFlash = 6;
        Sound.thunder();
      }
    }
  }

  // Poison Trail
  if (ps.activeSuperRares.includes('poison_trail') && ps.moving && game.time % 6 === 0 && ps.poisonTrails.length < 80) {
    ps.poisonTrails.push({ x: ps.x, y: ps.y, life: 300 });
  }
  for (let i = ps.poisonTrails.length - 1; i >= 0; i--) {
    const pt = ps.poisonTrails[i];
    pt.life--;
    if (pt.life <= 0) { ps.poisonTrails.splice(i, 1); continue; }
    if (game.time % 30 === 0) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (dist2(pt, e) < 12 * 12) {
          e.hp -= Math.max(1, Math.floor(weapon.damage * 0.3));
          e.hitFlash = 4;
          if (e.hp <= 0) onEnemyKill(e, j);
        }
      }
    }
  }

  // Shield Orb
  if (ps.activeSuperRares.includes('shield_orb') && !ps.shieldOrbActive) {
    ps.shieldOrbTimer--;
    if (ps.shieldOrbTimer <= 0) {
      ps.shieldOrbActive = true;
      spawnParticles(ps.x, ps.y, 10, '#44aaff', 2);
    }
  }

  // Magnet Pulse
  if (ps.activeSuperRares.includes('magnet_pulse')) {
    ps.magnetPulseTimer--;
    if (ps.magnetPulseTimer <= 0) {
      ps.magnetPulseTimer = 600;
      spawnParticles(ps.x, ps.y, 20, '#ff88ff', 4);
      for (const dr of drops) { (dr as any)._magnetPull = 60; }
      shockRings.push({ x: ps.x, y: ps.y, radius: 300, maxRadius: 10, speed: -8, life: 30, color: '#ff88ff' });
    }
  }

  } // ── END PER-PLAYER LOOP ──

  // Update blade projectiles (shared)
  for (let i = bladeProjs.length - 1; i >= 0; i--) {
    const bp = bladeProjs[i];
    bp.x += bp.dx; bp.y += bp.dy;
    bp.angle += 0.3;
    bp.life--;
    if (bp.life <= 0) { bladeProjs.splice(i, 1); continue; }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (dist2(bp, e) < 18 * 18) { e.hp -= 6; e.hitFlash = 6; }
    }
  }

  // Growing veins
  const minutesNow = game.time / (FPS * 60);
  if (minutesNow >= 10 && veins.length < 8 && game.time % (30 * FPS) === 0 && veinSpawns.length > 0) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const idx = Math.floor(Math.random() * veinSpawns.length);
      const sp = veinSpawns[idx];
      let tooClose = false;
      for (const v of veins) {
        const d = (v.segments[0].x - sp.x) ** 2 + (v.segments[0].y - sp.y) ** 2;
        if (d < 80 * 80) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const maxW = 2 + Math.min(3, minutesNow * 0.3);
      veins.push({
        segments: [{ x: sp.x, y: sp.y }],
        targetLen: 4 + Math.floor(Math.random() * 4),
        growTimer: 0,
        growRate: 60 + Math.floor(Math.random() * 60),
        angle: sp.angle,
        startTime: game.time,
        width: 1,
        maxWidth: maxW,
      });
      veinSpawns.splice(idx, 1);
      break;
    }
  }
  for (const v of veins) {
    const age = (game.time - v.startTime) / FPS;
    v.width = Math.min(v.maxWidth, 1 + age * 0.1);
    if (v.segments.length - 1 < v.targetLen) {
      v.growTimer--;
      if (v.growTimer <= 0) {
        v.growTimer = v.growRate;
        const last = v.segments[v.segments.length - 1];
        const zigzag = (Math.random() - 0.5) * 1.5;
        const stepLen = 8 + Math.random() * 12;
        v.segments.push({
          x: last.x + Math.cos(v.angle + zigzag) * stepLen,
          y: last.y + Math.sin(v.angle + zigzag) * stepLen,
        });
      }
    }
  }

  // Update beam lines
  for (let i = beamLines.length - 1; i >= 0; i--) {
    beamLines[i].life--;
    if (beamLines[i].life <= 0) beamLines.splice(i, 1);
  }

  // Update lasers
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.fromPlayer && players.some(p => !p.dead && p.activeCombos.includes('bullet_hell'))) {
      let closest: Enemy | null = null;
      let closestD = 100 * 100;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = dist2(l, e);
        if (d < closestD) { closestD = d; closest = e; }
      }
      if (closest) {
        const aim = aimDir(l, closest);
        const spd = Math.sqrt(l.dx * l.dx + l.dy * l.dy);
        l.dx += aim.x * 0.3;
        l.dy += aim.y * 0.3;
        const newSpd = Math.sqrt(l.dx * l.dx + l.dy * l.dy);
        if (newSpd > 0) { l.dx = (l.dx / newSpd) * spd; l.dy = (l.dy / newSpd) * spd; }
      }
    }
    l.x += l.dx; l.y += l.dy;
    l.life--;
    if (l.life <= 0 || isSolid(l.x, l.y)) {
      if (isSolid(l.x, l.y)) spawnParticles(l.x, l.y, 5, '#ffaa44', 1.5);
      lasers.splice(i, 1);
      continue;
    }
    if (l.fromPlayer) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (l.pierceHit.has(e)) continue;
        const ddx = l.x - e.x, ddy = l.y - e.y;
        const hitR = e.type === 'superboss' ? 22 : e.type === 'boss' ? 18 : e.type === 'miniboss' ? 14 : e.type === 'tank' ? 14 : 10;
        if (ddx * ddx + ddy * ddy < hitR * hitR) {
          if (e.elite === 'reflect' && Math.random() < 0.3) {
            l.dx = -l.dx; l.dy = -l.dy;
            l.fromPlayer = false;
            l.life = 60;
            spawnParticles(l.x, l.y, 6, '#8888ff', 2);
            break;
          }

          e.hp -= l.damage;
          e.hitFlash = 8;
          spawnParticles(l.x, l.y, 8, l.color, 2);
          spawnDmgNumber(e.x, e.y - 6, Math.floor(l.damage));
          const dmgOwner = players.filter(p => !p.dead).reduce((best, p) => dist2(p, e) < dist2(best, e) ? p : best, players[0]);
          dmgOwner.totalDamage += l.damage;

          applyAffixOnHit(l.x, l.y, l.damage, e, players[0]);
          applyComboOnHit(l, e);
          applyRicochet(l.x, l.y, l.damage, e, players[0]);

          if (l.pierce > 0) {
            l.pierceHit.add(e);
            l.pierce--;
          } else {
            lasers.splice(i, 1);
          }
          if (e.hp <= 0) {
            onEnemyKill(e, j);
          }
          break;
        }
      }
    }
    if (!l.fromPlayer) {
      let intercepted = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        if (j === i) continue;
        const other = lasers[j];
        if (!other.fromPlayer) continue;
        const dx2 = l.x - other.x, dy2 = l.y - other.y;
        if (dx2 * dx2 + dy2 * dy2 < 10 * 10) {
          spawnParticles(l.x, l.y, 4, '#8888ff', 2);
          lasers.splice(Math.max(i, j), 1);
          lasers.splice(Math.min(i, j), 1);
          intercepted = true;
          i -= 2;
          break;
        }
      }
      if (intercepted) continue;

      if (players.some(p => !p.dead && p.activeCombos.includes('reflect'))) {
        l.dx = -l.dx; l.dy = -l.dy;
        l.fromPlayer = true;
        l.life = 40;
        l.color = '#4488ff'; l.glowColor = '#88aaff';
        spawnParticles(l.x, l.y, 5, '#4488ff', 2);
        continue;
      }
      let hitAny = false;
      for (const pp of players) {
        if (pp.dead || pp.invincible > 0) continue;
        const ddx = l.x - pp.x, ddy = l.y - pp.y;
        if (ddx * ddx + ddy * ddy < 8 * 8) {
          damagePlayer(l.damage, l.x, l.y, pp);
          lasers.splice(i, 1);
          hitAny = true;
          break;
        }
      }
      if (hitAny) continue;
    }
  }

  // Enemy → player collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (const pp of players) {
      if (pp.dead || pp.invincible > 0) continue;
      const ddx = pp.x - e.x, ddy = pp.y - e.y;
      const hitR = e.type === 'superboss' ? 24 : e.type === 'boss' ? 20 : e.type === 'miniboss' ? 16 : e.type === 'tank' ? 16 : 12;
      if (ddx * ddx + ddy * ddy < hitR * hitR) {
        if (pp.shieldOrbActive && pp.activeSuperRares.includes('shield_orb')) {
          pp.shieldOrbActive = false;
          pp.shieldOrbTimer = 900;
          pp.invincible = 30;
          spawnParticles(pp.x, pp.y, 20, '#44aaff', 4);
          continue;
        }
        const diff = getDifficulty();
        const dmg = e.type === 'superboss' ? 30 : e.type === 'boss' ? 20 : e.type === 'miniboss' ? 15 : diff.contactDmg;
        const wasHit = damagePlayer(dmg, e.x, e.y, pp);
        if (!wasHit) continue;
        const pThornsLv = pp.upgradeLevels.get('thorns') || 0;
        const bladeStorm = pp.activeCombos.includes('blade_storm');
        if (pThornsLv > 0) {
          const thornsDmg = pThornsLv * 2 * (bladeStorm ? 3 : 1);
          e.hp -= thornsDmg;
          e.hitFlash = 8;
          spawnParticles(e.x, e.y, bladeStorm ? 15 : 5, bladeStorm ? '#ff8888' : '#ffaa88', bladeStorm ? 3 : 2);
          if (e.hp <= 0) { onEnemyKill(e, i); break; }
        }
      }
    }
  }

  // Update enemies
  for (const e of enemies) {
    if (e.emergeTimer > 0) { e.emergeTimer--; e.animTimer++; continue; }

    if (e.slowTimer > 0) { e.slowTimer--; e.speed = e.baseSpeed * 0.5; }
    else { e.speed = e.baseSpeed; }

    if (e.burnTimer > 0) {
      e.burnTimer--;
      if (e.burnTimer % 60 === 0 && e.burnDamage > 0) {
        e.hp -= e.burnDamage;
        spawnParticles(e.x, e.y, 3, '#ff4400', 1);
        if (e.hp <= 0) {
          const idx = enemies.indexOf(e);
          if (idx >= 0) onEnemyKill(e, idx);
          continue;
        }
      }
    }

    let nearestP = players[0];
    let nearestPDist = Infinity;
    for (const pp of players) {
      if (pp.dead) continue;
      const pd = dist2(e, pp);
      if (pd < nearestPDist) { nearestPDist = pd; nearestP = pp; }
    }
    const ddx = nearestP.x - e.x, ddy = nearestP.y - e.y;
    const edist = Math.sqrt(ddx * ddx + ddy * ddy);

    if (e.type === 'superboss' || e.type === 'boss') {
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        if (canMove(e.x, e.y, nx, 0, 8)) e.x += nx;
        if (canMove(e.x, e.y, 0, ny, 8)) e.y += ny;
      }
    } else if (e.type === 'miniboss') {
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        if (canMove(e.x, e.y, nx, 0, 6)) e.x += nx;
        if (canMove(e.x, e.y, 0, ny, 6)) e.y += ny;
      }
    } else if (e.type === 'dasher') {
      if (e.dashTimer! > 0) {
        e.dashTimer!--;
        if (edist > 4) {
          const nx = ddx / edist * e.speed * 0.5, ny = ddy / edist * e.speed * 0.5;
          e.x += nx; e.y += ny;
        }
      } else if (e.dashTimer! <= 0 && e.dashTimer! > -15) {
        if (e.dashTimer === 0 && edist > 4) {
          e.dashDirX = ddx / edist; e.dashDirY = ddy / edist;
          spawnParticles(e.x, e.y, 5, '#ff4444', 2);
        }
        e.dashTimer!--;
        const dashSpeed = 4;
        e.x += e.dashDirX! * dashSpeed;
        e.y += e.dashDirY! * dashSpeed;
        spawnParticles(e.x, e.y, 1, '#ff6644', 1);
      } else {
        e.dashTimer = 60 + Math.floor(Math.random() * 40);
      }
    } else if (e.type === 'caster') {
      const idealDist = 100;
      if (edist < idealDist - 20 && edist > 0) {
        const nx = -ddx / edist * e.speed * 1.2, ny = -ddy / edist * e.speed * 1.2;
        e.x += nx; e.y += ny;
      } else if (edist > idealDist + 40 && edist > 0) {
        const nx = ddx / edist * e.speed * 0.5, ny = ddy / edist * e.speed * 0.5;
        e.x += nx; e.y += ny;
      }
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        e.shootTimer = 90 + Math.floor(Math.random() * 30);
        if (edist > 0) {
          const aim = aimDir(e, nearestP);
          lasers.push({
            x: e.x, y: e.y,
            dx: aim.x * 2, dy: aim.y * 2,
            life: 90, fromPlayer: false,
            damage: Math.ceil(getDifficulty().contactDmg * 0.5),
            size: 6, pierce: 0, pierceHit: new Set(),
            color: '#ff2266', glowColor: '#ff4488', trailLength: 4,
          });
          spawnParticles(e.x, e.y, 3, '#ff2266', 1);
        }
      }
    } else if (e.type === 'tank') {
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        e.x += nx; e.y += ny;
      }
    } else if (e.type === 'exploder') {
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        e.x += nx; e.y += ny;
      }
      if (edist < 30) { spawnParticles(e.x, e.y, 1, '#ff2200', 1); }
    } else {
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        if (canMove(e.x, e.y, nx, 0, 5)) e.x += nx;
        if (canMove(e.x, e.y, 0, ny, 5)) e.y += ny;
      }
    }
    if (Math.abs(ddx) > Math.abs(ddy)) e.dir = ddx > 0 ? 'right' : 'left';
    else e.dir = ddy > 0 ? 'down' : 'up';
    if (e.hitFlash > 0) e.hitFlash--;
    e.animTimer++;

    if (e.elite) {
      if (e.elite === 'fire_trail' && e.animTimer % 10 === 0 && players[0].poisonTrails.length < 80) {
        players[0].poisonTrails.push({ x: e.x, y: e.y, life: 180 });
      }
      if (e.elite === 'teleport') {
        e.teleportTimer!--;
        if (e.teleportTimer! <= 0) {
          e.teleportTimer = 90 + Math.floor(Math.random() * 60);
          const angle = Math.random() * Math.PI * 2;
          const tpDist = 40 + Math.random() * 60;
          spawnParticles(e.x, e.y, 8, '#8844cc', 2);
          e.x = nearestP.x + Math.cos(angle) * tpDist;
          e.y = nearestP.y + Math.sin(angle) * tpDist;
          spawnParticles(e.x, e.y, 8, '#8844cc', 2);
        }
      }
      if (e.elite === 'regen' && e.animTimer % 60 === 0 && e.hp < e.maxHp) {
        e.hp = Math.min(e.hp + Math.ceil(e.maxHp * 0.05), e.maxHp);
      }
    }
  }

  // Continuous spawning
  const diff = getDifficulty();
  setSpawnTimer(spawnTimer - 1);
  if (spawnTimer <= 0) {
    for (let b = 0; b < diff.spawnBatch; b++) { spawnEnemy(); }
    setSpawnTimer(diff.spawnInterval);
  }

  game.miniBossTimer--;
  if (game.miniBossTimer <= 0) { spawnMiniBoss(); game.miniBossTimer = 30 * FPS; }

  game.bossTimer--;
  if (game.bossTimer <= 0) { spawnBoss(); game.bossTimer = 60 * FPS; }

  // Danger zones
  const dzMinutes = game.time / (FPS * 60);
  if (dzMinutes >= 2) {
    const dzInterval = Math.max(60, 300 - Math.floor(dzMinutes * 20));
    if (game.time % dzInterval === 0) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 100;
      const diff2 = getDifficulty();
      const dzTarget = players.filter(p => !p.dead);
      const dzP = dzTarget[Math.floor(Math.random() * dzTarget.length)] || players[0];
      dangerZones.push({
        x: dzP.x + Math.cos(angle) * dist,
        y: dzP.y + Math.sin(angle) * dist,
        radius: 25 + Math.random() * 20,
        warnTime: 90,
        damage: Math.ceil(diff2.contactDmg * 0.8),
        life: 105,
      });
    }
  }

  for (let i = dangerZones.length - 1; i >= 0; i--) {
    const dz = dangerZones[i];
    dz.life--;
    dz.warnTime--;
    if (dz.warnTime === 0) {
      const isBigMeteor = dz.damage > 10;
      if (isBigMeteor) {
        for (let a = 0; a < 32; a++) {
          const angle = (a / 32) * Math.PI * 2;
          particles.push({
            x: dz.x, y: dz.y,
            dx: Math.cos(angle) * 6, dy: Math.sin(angle) * 6,
            life: 30, maxLife: 30,
            color: a % 3 === 0 ? '#ff2200' : a % 3 === 1 ? '#ff8800' : '#ffcc00', size: 5,
          });
        }
        spawnParticles(dz.x, dz.y, 40, '#ff4400', 7);
        spawnParticles(dz.x, dz.y, 20, '#ffffff', 4);
        game.shakeTimer = 15;
        Sound.explosion();
        for (let fi = 0; fi < 6; fi++) {
          if (players[0].poisonTrails.length < 80) {
            players[0].poisonTrails.push({
              x: dz.x + (Math.random() - 0.5) * dz.radius,
              y: dz.y + (Math.random() - 0.5) * dz.radius,
              life: 240,
            });
          }
        }
      } else {
        spawnParticles(dz.x, dz.y, 25, '#ff2244', 5);
        spawnParticles(dz.x, dz.y, 15, '#ffaa22', 3);
        game.shakeTimer = 4;
      }
      for (const pp of players) {
        if (!pp.dead && pp.invincible <= 0 && dist2(pp, dz) < dz.radius * dz.radius) {
          pp.hp -= dz.damage;
          pp.invincible = 30;
          pp.damageFlash = 10;
          Sound.hit();
        }
      }
      for (const e of enemies) {
        if (dist2(e, dz) < dz.radius * dz.radius) {
          e.hp -= Math.ceil(dz.damage * 0.5);
          e.hitFlash = 8;
        }
      }
    }
    if (dz.life <= 0) dangerZones.splice(i, 1);
  }

  // Super boss
  if (!game.superBossSpawned) {
    game.superBossTimer--;
    if (game.superBossTimer <= 0) { spawnSuperBoss(); }
  }

  // MEGA BOSS at 10 minutes
  const minutesForBoss = game.time / (FPS * 60);
  if (!game.megaBossSpawned && minutesForBoss >= 10) {
    game.megaBossSpawned = true;
    const pos = findSpawnPos();
    if (pos) {
      const diff3 = getDifficulty();
      const hp = Math.ceil(300 * diff3.hpMult);
      enemies.push({
        x: pos.x, y: pos.y, hp, maxHp: hp,
        speed: 0.35 * diff3.speedMult, baseSpeed: 0.35 * diff3.speedMult,
        type: 'superboss', dir: 'down',
        shootTimer: 40, hitFlash: 0, animTimer: 0,
        bossPhase: 0, bossAttackTimer: 60,
        slowTimer: 0, burnTimer: 0, burnDamage: 0,
        dashTimer: 0, dashDirX: 0, dashDirY: 0, emergeTimer: 60,
      });
      game.shakeTimer = 20;
      game.lightningFlash = 12;
      Sound.thunder();
      const megaTarget = players.find(p => !p.dead) || players[0];
      spawnParticles(megaTarget.x, megaTarget.y, 30, '#ff44ff', 5);
    }
  }

  // Despawn out-of-map enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const tx = Math.floor(e.x / TILE);
    const ty = Math.floor(e.y / TILE);
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) {
      enemies.splice(i, 1);
    }
  }

  // Update drops
  for (let i = drops.length - 1; i >= 0; i--) {
    const dr = drops[i];
    dr.age++;
    if (dr.life > 0) dr.life--;
    dr.bobTimer += 0.08;
    if (dr.life === 0) { drops.splice(i, 1); continue; }
    if (dr.type === 'xp' && dr.age > 30 * FPS) {
      const anyClose = players.some(p => !p.dead && dist2(p, dr) < 200 * 200);
      if (!anyClose) { drops.splice(i, 1); continue; }
    }

    let nearDr: PlayerState | null = null;
    let nearDrDist = Infinity;
    for (const pp of players) {
      if (pp.dead) continue;
      const d = Math.sqrt(dist2(pp, dr));
      if (d < nearDrDist) { nearDrDist = d; nearDr = pp; }
    }
    if (!nearDr) continue;

    const ddx = nearDr.x - dr.x, ddy = nearDr.y - dr.y;
    const ddist = nearDrDist;

    if ((dr as any)._magnetPull > 0) {
      (dr as any)._magnetPull--;
      const pullForce = 6;
      if (ddist > 5) {
        dr.x += (ddx / ddist) * pullForce;
        dr.y += (ddy / ddist) * pullForce;
      }
    }
    const hasMagnet = (nearDr.upgradeLevels.get('pickup_radius') || 0) > 0;
    if (hasMagnet && ddist < nearDr.magnetRadius) {
      const pull = dr.type === 'xp' ? 4 : 2.5;
      if (ddist > 2) {
        dr.x += (ddx / ddist) * pull;
        dr.y += (ddy / ddist) * pull;
      }
    }

    if (ddist < nearDr.pickupRadius) {
      if (dr.type === 'xp') {
        game.xp += dr.value;
        spawnParticles(dr.x, dr.y, 5, COL.xpOrb, 1);
        while (game.xp >= game.xpToLevel) {
          game.xp -= game.xpToLevel;
          game.level++;
          game.xpToLevel = Math.floor(game.xpToLevel * 1.15);
          for (const pp of players) { if (!pp.dead) pp.pendingLevelUps++; }
        }
        if (game.state === 'playing') {
          const anyPending = players.some(pp => !pp.dead && pp.pendingLevelUps > 0);
          if (anyPending) { openSelection('levelup'); }
        }
      } else if (dr.type === 'heart') {
        if (nearDr.hp < nearDr.maxHp) {
          nearDr.hp = Math.min(nearDr.hp + dr.value, nearDr.maxHp);
          spawnParticles(dr.x, dr.y, 8, COL.heartDrop, 1.5);
        } else {
          continue;
        }
      }
      drops.splice(i, 1);
    }
  }

  // Update chests
  for (let i = chests.length - 1; i >= 0; i--) {
    const ch = chests[i];
    if (ch.opened) {
      ch.openTimer--;
      if (ch.openTimer <= 0) chests.splice(i, 1);
      continue;
    }
    let chestOpener = -1;
    for (const pp of players) {
      if (pp.dead) continue;
      const cddx = pp.x - ch.x, cddy = pp.y - ch.y;
      if (cddx * cddx + cddy * cddy < 14 * 14) { chestOpener = pp.playerIndex; break; }
    }
    if (chestOpener >= 0) {
      ch.opened = true;
      ch.openTimer = 60;
      spawnParticles(ch.x, ch.y, 25, ch.rarity === 'rare' ? COL.chestRare : COL.chestLock, 3);
      openSelection(ch.rarity === 'rare' ? 'chest_rare' : 'chest_common', chestOpener);
      for (let j = 0; j < 8; j++) {
        const angle = Math.random() * Math.PI * 2;
        const d = Math.random() * 16;
        drops.push({
          x: ch.x + Math.cos(angle) * d, y: ch.y + Math.sin(angle) * d,
          type: 'xp', value: 3, life: -1, age: 0, bobTimer: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  // Update chain arcs
  for (let i = chainArcs.length - 1; i >= 0; i--) {
    chainArcs[i].life--;
    if (chainArcs[i].life <= 0) chainArcs.splice(i, 1);
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx; p.y += p.dy;
    p.dx *= 0.95; p.dy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Update damage numbers
  for (let i = dmgNumbers.length - 1; i >= 0; i--) {
    dmgNumbers[i].y -= 0.4;
    dmgNumbers[i].life--;
    if (dmgNumbers[i].life <= 0) dmgNumbers.splice(i, 1);
  }

  // 15 minute death wall
  if (game.time >= GAME_DURATION) {
    for (const pp of players) pp.hp = 0;
  }

  // Per-player HP clamp, second wind, death
  for (const pp of players) {
    if (pp.dead) continue;
    if (!pp.activeCombos.includes('second_life')) {
      pp.hp = Math.min(pp.hp, pp.maxHp);
    } else {
      const slShield = 20 + (pp.upgradeLevels.get('max_hp') || 0) * 5 + pp.weapon.size * 2;
      pp.hp = Math.min(pp.hp, pp.maxHp + slShield);
    }
    if (pp.hp <= 0 && pp.activeSuperRares.includes('second_wind') && !pp.secondWindUsed) {
      pp.secondWindUsed = true;
      pp.hp = Math.floor(pp.maxHp * 0.3);
      pp.invincible = 120;
      spawnParticles(pp.x, pp.y, 40, '#ffffff', 5);
      spawnParticles(pp.x, pp.y, 30, '#44ff44', 4);
      pp.damageFlash = 0;
    }
    if (pp.hp <= 0) {
      pp.dead = true;
      pp.deathX = pp.x;
      pp.deathY = pp.y;
      pp.reviveProgress = 0;
      for (let ring = 0; ring < 3; ring++) {
        for (let a = 0; a < 16; a++) {
          const angle = (a / 16) * Math.PI * 2;
          particles.push({
            x: pp.x, y: pp.y,
            dx: Math.cos(angle) * (2 + ring * 2), dy: Math.sin(angle) * (2 + ring * 2),
            life: 20 + ring * 5, maxLife: 25 + ring * 5,
            color: ring % 2 === 0 ? pp.visorColor : '#ffffff', size: 3,
          });
        }
      }
      spawnParticles(pp.x, pp.y, 30, pp.visorColor, 5);
      game.shakeTimer = 12;
    }
  }

  // Revive system
  const REVIVE_RADIUS = 50;
  const REVIVE_SPEED = 0.004;
  const REVIVE_DECAY = 0.002;
  for (const deadP of players) {
    if (!deadP.dead) continue;
    const aliveP = players.find(p => !p.dead);
    if (!aliveP) break;
    const dx2 = aliveP.x - deadP.deathX, dy2 = aliveP.y - deadP.deathY;
    const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (dist < REVIVE_RADIUS) {
      deadP.reviveProgress = Math.min(1, deadP.reviveProgress + REVIVE_SPEED);
      if (game.time % 8 === 0) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: deadP.deathX + Math.cos(angle) * 20, y: deadP.deathY + Math.sin(angle) * 20,
          dx: -Math.cos(angle) * 0.5, dy: -Math.sin(angle) * 0.5,
          life: 20, maxLife: 20, color: deadP.visorColor, size: 2,
        });
      }
      if (deadP.reviveProgress >= 1) {
        deadP.dead = false;
        deadP.hp = Math.floor(deadP.maxHp * 0.5);
        deadP.x = deadP.deathX;
        deadP.y = deadP.deathY;
        deadP.invincible = 120;
        deadP.reviveProgress = 0;
        spawnParticles(deadP.deathX, deadP.deathY, 30, deadP.visorColor, 4);
        spawnParticles(deadP.deathX, deadP.deathY, 20, '#ffffff', 3);
        game.shakeTimer = 8;
      }
    } else {
      deadP.reviveProgress = Math.max(0, deadP.reviveProgress - REVIVE_DECAY);
    }
  }

  // Game over
  const allDead = players.every(p => p.dead);
  if (allDead) {
    game.state = 'gameover';
    game.deathScreenTimer = 0;
    game.won = game.time >= GAME_DURATION;
    if (game.won) Sound.victory(); else Sound.gameOver();
    Music.stop();

    const midPX = (players[0].x + players[1].x) / 2;
    const midPY = (players[0].y + players[1].y) / 2;
    const camXGO = midPX - VIEW_W / 2;
    const camYGO = midPY - VIEW_H / 2;
    for (const e of enemies) {
      const sx = e.x - camXGO, sy = e.y - camYGO;
      if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) {
        e.hp = 0;
        spawnParticles(e.x, e.y, 5, '#ff4488', 3);
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) enemies.splice(i, 1);
    }
    game.shakeTimer = 20;
  }

  mouse.clicked = false;
}

// ── RENDER ──
// render is imported at the top of the file

// ── Init & loop ──
registerResetVeinsCallback(() => { veins.length = 0; });
initInput();
generateMap();

let frameCount = 0;
function loop() {
  frameCount++;
  if (frameCount % 2 === 0) update();
  render();
  requestAnimationFrame(loop);
}
loop();
