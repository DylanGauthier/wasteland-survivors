import { MAX_UPGRADE_LEVEL, MAX_UPGRADES, VIEW_W, VIEW_H, FPS } from './constants';
import { game, players, player, weapon, setPlayerContext } from './state';
import { mouse, keys } from './input';
import { spawnParticles } from './spawning';
import { UPGRADES } from './data/upgrades';
import { COMBOS } from './data/combos';
import { AFFIXES } from './data/affixes';
import { SUPER_RARES } from './data/super-rares';
import { Sound } from './audio/SoundEngine';
import type { Upgrade, Affix, SuperRare, Skill, PlayerState } from './types';

export function isSkill(opt: any): opt is Skill { return 'cooldown' in opt; }
export function isSuperRare(opt: any): opt is SuperRare { return !('apply' in opt) && !('cooldown' in opt) && SUPER_RARES.some(s => s.id === opt.id); }
export function isAffix(opt: any): opt is Affix { return !('apply' in opt) && !('cooldown' in opt) && AFFIXES.some(a => a.id === opt.id); }

export function pickRandom<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

export function pickRandomUpgrades(n: number): Upgrade[] {
  const ps = players[game.selectingPlayer];
  const ownedIds = Array.from(ps.upgradeLevels.keys());
  const atCap = ownedIds.length >= MAX_UPGRADES;

  const owned: Upgrade[] = [];
  const comboPartners: Upgrade[] = [];
  const fresh: Upgrade[] = [];

  const comboPartnerIds = new Set<string>();
  for (const id of ownedIds) {
    for (const combo of COMBOS) {
      if (combo.upgrade1 === id && !ownedIds.includes(combo.upgrade2)) comboPartnerIds.add(combo.upgrade2);
      if (combo.upgrade2 === id && !ownedIds.includes(combo.upgrade1)) comboPartnerIds.add(combo.upgrade1);
    }
  }

  for (const u of UPGRADES) {
    const lv = ps.upgradeLevels.get(u.id) || 0;
    if (lv >= MAX_UPGRADE_LEVEL) continue;
    if (atCap && !ownedIds.includes(u.id)) continue;

    if (ownedIds.includes(u.id)) owned.push(u);
    else if (comboPartnerIds.has(u.id)) comboPartners.push(u);
    else fresh.push(u);
  }

  const result: Upgrade[] = [];
  const picked = new Set<string>();

  const weighted: Upgrade[] = [];
  for (const u of owned) { for (let c = 0; c < 4; c++) weighted.push(u); }
  for (const u of comboPartners) { for (let c = 0; c < 2; c++) weighted.push(u); }
  for (const u of fresh) { weighted.push(u); }

  while (result.length < n && weighted.length > 0) {
    const idx = Math.floor(Math.random() * weighted.length);
    const pick = weighted[idx];
    if (picked.has(pick.id)) {
      for (let w = weighted.length - 1; w >= 0; w--) {
        if (weighted[w].id === pick.id) weighted.splice(w, 1);
      }
      continue;
    }
    picked.add(pick.id);
    result.push(pick);
    for (let w = weighted.length - 1; w >= 0; w--) {
      if (weighted[w].id === pick.id) weighted.splice(w, 1);
    }
  }
  return result;
}

export function openSelection(type: 'levelup' | 'chest_common' | 'chest_rare', forPlayerIndex: number = 0) {
  game.selectionType = type;
  game.selectionDelay = 20;
  if (type === 'levelup') Sound.levelUp();
  else Sound.chestOpen();

  if (type === 'levelup') {
    for (const ps of players) {
      if (ps.dead || ps.pendingLevelUps <= 0) {
        ps.selectionDone = true;
        ps.selectionOptions = [];
        continue;
      }
      ps.pendingLevelUps--;
      ps.selectionDone = false;
      ps.selectionHover = -1;
      game.selectingPlayer = ps.playerIndex;
      setPlayerContext(ps);
      const upgrades = pickRandomUpgrades(3);
      if (upgrades.length === 0) {
        ps.pendingLevelUps = 0;
        ps.selectionDone = true;
        ps.selectionOptions = [];
        continue;
      }
      ps.selectionOptions = upgrades;
    }
    setPlayerContext(players[0]);
    game.state = 'levelup';
    return;
  }

  for (const ps of players) {
    if (ps.dead) {
      ps.selectionDone = true;
      ps.selectionOptions = [];
      continue;
    }
    ps.selectionDone = false;
    ps.selectionHover = -1;
    game.selectingPlayer = ps.playerIndex;
    setPlayerContext(ps);

    if (type === 'chest_rare') {
      const availableAffixes = AFFIXES.filter(a => !ps.activeAffixes.includes(a.id));
      const availableSuperRares = SUPER_RARES.filter(s => !ps.activeSuperRares.includes(s.id));
      const allRare = [...availableAffixes, ...availableSuperRares];
      if (allRare.length === 0) {
        const fallback = pickRandomUpgrades(3);
        if (fallback.length === 0) { ps.selectionDone = true; ps.selectionOptions = []; continue; }
        ps.selectionOptions = fallback;
      } else {
        ps.selectionOptions = pickRandom(allRare, 3);
      }
    } else {
      const upgrades = pickRandomUpgrades(3);
      if (upgrades.length === 0) { ps.selectionDone = true; ps.selectionOptions = []; continue; }
      ps.selectionOptions = upgrades;
    }
  }
  setPlayerContext(players[0]);
  game.state = type === 'chest_rare' ? 'chest_rare' : 'chest_common';
}

export function selectOptionForPlayer(playerIdx: number, index: number) {
  const ps = players[playerIdx];
  if (ps.selectionDone) return;
  if (index < 0 || index >= ps.selectionOptions.length) return;
  Sound.select();
  const option = ps.selectionOptions[index];
  setPlayerContext(ps);

  if (isSkill(option)) {
    ps.activeSkill = option;
    ps.skillCooldown = 0;
    spawnParticles(ps.x, ps.y, 30, option.color, 4);
  } else if (isSuperRare(option)) {
    ps.activeSuperRares.push(option.id);
    spawnParticles(ps.x, ps.y, 35, option.color, 5);
    if (option.id === 'drone') ps.droneCount++;
    if (option.id === 'shadow_clone') ps.shadowClone = { x: ps.x, y: ps.y, trail: [] };
    if (option.id === 'thunder') ps.thunderTimer = 180;
    if (option.id === 'magnet_pulse') ps.magnetPulseTimer = 600;
  } else if (isAffix(option)) {
    ps.activeAffixes.push(option.id);
    spawnParticles(ps.x, ps.y, 30, option.color, 4);
  } else {
    const upgrade = option as Upgrade;
    const currentLv = ps.upgradeLevels.get(upgrade.id) || 0;
    const newLv = currentLv + 1;
    ps.upgradeLevels.set(upgrade.id, newLv);
    upgrade.apply(newLv);
    spawnParticles(ps.x, ps.y, 20, '#8899aa', 3);
  }

  ps.selectionOptions = [];
  ps.selectionDone = true;

  if (players.every(p => p.selectionDone)) {
    const anyPending = players.some(p => !p.dead && p.pendingLevelUps > 0);
    if (anyPending) {
      openSelection('levelup');
    } else {
      game.state = 'playing';
    }
  }
}

export function selectOption(index: number) {
  selectOptionForPlayer(game.selectingPlayer, index);
}

export function getCardLayout(halfWidth = false, leftHalf = true) {
  const cardW = halfWidth ? 90 : 120;
  const cardH = 120;
  const gap = halfWidth ? 6 : 12;
  const areaW = halfWidth ? VIEW_W / 2 : VIEW_W;
  const offsetX = halfWidth && !leftHalf ? VIEW_W / 2 : 0;
  const n = 3;
  const totalW = cardW * n + gap * (n - 1);
  const startX = offsetX + (areaW - totalW) / 2;
  const startY = (VIEW_H - cardH) / 2 + 15;
  return { cardW, cardH, gap, startX, startY };
}

export function getSortedSelectionMapForPlayer(ps: PlayerState): number[] {
  const indices = ps.selectionOptions.map((_, i) => i);
  indices.sort((a, b) => {
    const aOpt = ps.selectionOptions[a];
    const bOpt = ps.selectionOptions[b];
    const aOwned = 'apply' in aOpt && ps.upgradeLevels.has((aOpt as Upgrade).id) ? 1 : 0;
    const bOwned = 'apply' in bOpt && ps.upgradeLevels.has((bOpt as Upgrade).id) ? 1 : 0;
    return bOwned - aOwned;
  });
  return indices;
}

export function updateSelection() {
  if (game.selectionDelay > 0) {
    game.selectionDelay--;
    mouse.clicked = false;
    if (game.selectionDelay === 0) {
      for (const k in keys) keys[k] = false;
    }
    return;
  }

  const isSplitScreen = !players[0].dead && !players[1].dead
    && (players[0].selectionOptions.length > 0 || players[1].selectionOptions.length > 0);

  if (isSplitScreen) {
    const p1 = players[0];
    if (!p1.selectionDone && p1.selectionOptions.length > 0) {
      const layout1 = getCardLayout(true, true);
      const sorted1 = getSortedSelectionMapForPlayer(p1);
      const n1 = sorted1.length;
      let mouseVisual1 = -1;
      for (let vi = 0; vi < n1; vi++) {
        const cx = layout1.startX + vi * (layout1.cardW + layout1.gap);
        if (mouse.x >= cx && mouse.x < cx + layout1.cardW &&
            mouse.y >= layout1.startY - 4 && mouse.y < layout1.startY + layout1.cardH + 4) {
          mouseVisual1 = vi;
        }
      }
      if (mouseVisual1 >= 0) p1.selectionHover = mouseVisual1;
      if (p1.selectionHover < 0) p1.selectionHover = 0;
      if (keys['q'] || keys['a']) { p1.selectionHover = (p1.selectionHover - 1 + n1) % n1; keys['q'] = false; keys['a'] = false; }
      if (keys['d']) { p1.selectionHover = (p1.selectionHover + 1) % n1; keys['d'] = false; }
      if (mouse.clicked && mouseVisual1 >= 0) selectOptionForPlayer(0, sorted1[mouseVisual1]);
      if (keys[' ']) { selectOptionForPlayer(0, sorted1[p1.selectionHover]); keys[' '] = false; }
      if (keys['1'] || keys['&']) { if (sorted1[0] !== undefined) selectOptionForPlayer(0, sorted1[0]); keys['1'] = false; keys['&'] = false; }
      if (keys['2'] || keys['\u00e9']) { if (sorted1[1] !== undefined) selectOptionForPlayer(0, sorted1[1]); keys['2'] = false; keys['\u00e9'] = false; }
      if (keys['3'] || keys['"']) { if (sorted1[2] !== undefined) selectOptionForPlayer(0, sorted1[2]); keys['3'] = false; keys['"'] = false; }
    }

    const p2 = players[1];
    if (!p2.selectionDone && p2.selectionOptions.length > 0) {
      const sorted2 = getSortedSelectionMapForPlayer(p2);
      const n2 = sorted2.length;
      if (p2.selectionHover < 0) p2.selectionHover = 0;
      if (keys['arrowleft']) { p2.selectionHover = (p2.selectionHover - 1 + n2) % n2; keys['arrowleft'] = false; }
      if (keys['arrowright']) { p2.selectionHover = (p2.selectionHover + 1) % n2; keys['arrowright'] = false; }
      if (keys['enter']) { selectOptionForPlayer(1, sorted2[p2.selectionHover]); keys['enter'] = false; }
    }
  } else {
    const activePs = players.find(p => !p.selectionDone && p.selectionOptions.length > 0) || players[game.selectingPlayer];
    game.selectingPlayer = activePs.playerIndex;
    const layout = getCardLayout(false, true);
    const sortedMap = getSortedSelectionMapForPlayer(activePs);

    const nS = sortedMap.length;
    let mouseVisualS = -1;
    for (let vi = 0; vi < nS; vi++) {
      const cx = layout.startX + vi * (layout.cardW + layout.gap);
      if (mouse.x >= cx && mouse.x < cx + layout.cardW &&
          mouse.y >= layout.startY - 4 && mouse.y < layout.startY + layout.cardH + 4) {
        mouseVisualS = vi;
      }
    }
    if (mouseVisualS >= 0) game.selectionHover = mouseVisualS;
    if (game.selectionHover < 0) game.selectionHover = 0;

    if (keys['q'] || keys['a'] || keys['arrowleft']) { game.selectionHover = (game.selectionHover - 1 + nS) % nS; keys['q'] = false; keys['a'] = false; keys['arrowleft'] = false; }
    if (keys['d'] || keys['arrowright']) { game.selectionHover = (game.selectionHover + 1) % nS; keys['d'] = false; keys['arrowright'] = false; }
    if (mouse.clicked && mouseVisualS >= 0) selectOption(sortedMap[mouseVisualS]);
    if (keys[' '] || keys['enter']) { selectOption(sortedMap[game.selectionHover]); keys[' '] = false; keys['enter'] = false; }
    if (keys['1'] || keys['&']) { if (sortedMap[0] !== undefined) selectOption(sortedMap[0]); keys['1'] = false; keys['&'] = false; }
    if (keys['2'] || keys['\u00e9']) { if (sortedMap[1] !== undefined) selectOption(sortedMap[1]); keys['2'] = false; keys['\u00e9'] = false; }
    if (keys['3'] || keys['"']) { if (sortedMap[2] !== undefined) selectOption(sortedMap[2]); keys['3'] = false; keys['"'] = false; }
  }

  mouse.clicked = false;
}

// Stat gain description for each upgrade
export function getStatGain(id: string, newLv: number): string {
  switch (id) {
    case 'fire_rate': return '-1 RECHARGE';
    case 'damage': return '+1 D\xC9GATS';
    case 'move_speed': return '+0.15 VIT';
    case 'max_hp': return '+10 VIE MAX';
    case 'pickup_radius': return '+12 PORT\xC9E';
    case 'projectile': return '+1 PROJ';
    case 'pierce': return '+1 PERFO';
    case 'proj_size': return '+1 TAILLE';
    case 'proj_speed': return '+0.5 VIT';
    case 'life_steal': return '+2% CHANCE';
    case 'thorns': return '+2 D\xC9GATS';
    case 'orbital': return '+1 ORBE';
    case 'armor': return '-1 D\xC9GATS SUB';
    case 'dodge': return '+5% ESQUIVE';
    default: return 'NV ' + newLv;
  }
}
