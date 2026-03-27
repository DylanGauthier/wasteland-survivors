import { VIEW_W, VIEW_H, MAX_UPGRADE_LEVEL, MAX_UPGRADES, FPS } from '../constants';
import { bx } from '../canvas';
import { game, players, player, weapon, playerNames, setPlayerContext } from '../state';
import { mouse } from '../input';
import { drawText, textWidth, drawIcon, formatTime } from '../font';
import { UPGRADES } from '../data/upgrades';
import { COMBOS } from '../data/combos';
import { SUPER_RARES } from '../data/super-rares';
import { Sound } from '../audio/SoundEngine';
import {
  isSkill, isSuperRare, isAffix, getCardLayout, getSortedSelectionMapForPlayer, getStatGain,
} from '../selection';
import { getCombosForUpgrade } from '../data/combos';
import type { Upgrade, Affix, Skill, PlayerState } from '../types';

function optIsSkill(opt: any): opt is Skill { return isSkill(opt); }

function drawPlayerSelectionHalf(ps: PlayerState, halfWidth: boolean, leftHalf: boolean) {
  const isRare = game.state === 'chest_rare';
  const isChest = game.state === 'chest_common' || isRare;

  const { cardW, cardH, gap, startX, startY } = getCardLayout(halfWidth, leftHalf);
  const areaW = halfWidth ? VIEW_W / 2 : VIEW_W;
  const offsetX = halfWidth && !leftHalf ? VIEW_W / 2 : 0;
  const centerX = offsetX + areaW / 2;

  if (ps.selectionDone) {
    const waitText = 'EN ATTENTE...';
    drawText(waitText, centerX - textWidth(waitText, 2) / 2, VIEW_H / 2 - 6, '#555566', 2);
    const jLabel = 'J' + (ps.playerIndex + 1);
    drawText(jLabel, centerX - textWidth(jLabel, 1) / 2, VIEW_H / 2 + 14, ps.visorColor, 1);
    return;
  }

  if (ps.selectionOptions.length === 0) return;

  const playerLabel = 'J' + (ps.playerIndex + 1);
  drawText(playerLabel, centerX - textWidth(playerLabel, 2) / 2, startY - 56, ps.visorColor, 2);

  const title = isRare ? 'BUTIN RARE' : isChest ? 'BUTIN BONUS' : 'AMELIORATION';
  const titleColor = isRare ? '#ff8844' : isChest ? '#ffcc44' : '#44eeff';
  const titleScale = halfWidth ? 2 : 3;
  drawText(title, centerX - textWidth(title, titleScale) / 2, startY - 40, titleColor, titleScale);

  if (game.state === 'levelup') {
    const ownedCount = ps.upgradeLevels.size;
    const slotsText = ownedCount + '/' + MAX_UPGRADES;
    drawText(slotsText, centerX - textWidth(slotsText, 1) / 2, startY - 18, ownedCount >= MAX_UPGRADES ? '#ff8844' : '#6688aa', 1);
  }

  const sorted = ps.selectionOptions.map((opt, idx) => ({ opt, origIdx: idx }));
  sorted.sort((a, b) => {
    const aOwned = 'apply' in a.opt && ps.upgradeLevels.has((a.opt as Upgrade).id) ? 1 : 0;
    const bOwned = 'apply' in b.opt && ps.upgradeLevels.has((b.opt as Upgrade).id) ? 1 : 0;
    return bOwned - aOwned;
  });

  const hoverVal = halfWidth ? ps.selectionHover : game.selectionHover;
  const t = game.time;

  for (let i = 0; i < sorted.length; i++) {
    const { opt } = sorted[i];
    const cx = startX + i * (cardW + gap);
    const hovered = hoverVal === i;

    const optIsSuperRare = isSuperRare(opt);
    const optIsAffix = isAffix(opt);
    const optIsUpgrade = !optIsSuperRare && !optIsAffix;
    const isOwned = optIsUpgrade && ps.upgradeLevels.has((opt as Upgrade).id);
    const isHighRarity = optIsSuperRare || optIsAffix;

    const rarityCol = optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : isOwned ? '#44eeff' : '#8899aa';

    const bob = Math.sin(t * 0.04 + i * 1.5) * 2;
    const cardY = startY + Math.floor(bob);

    bx.fillStyle = hovered ? '#1a1a33' : isOwned ? '#0d1525' : '#0d0d1a';
    bx.fillRect(cx, cardY, cardW, cardH);

    if (isOwned && !hovered) {
      bx.fillStyle = '#44eeff';
      bx.globalAlpha = Math.sin(t * 0.06 + i) * 0.06 + 0.08;
      bx.fillRect(cx, cardY, cardW, cardH);
      bx.globalAlpha = 1;
    }
    if (hovered) {
      bx.fillStyle = rarityCol;
      bx.globalAlpha = 0.15;
      bx.fillRect(cx, cardY, cardW, cardH);
      bx.globalAlpha = 1;
    }

    if (isHighRarity) {
      const shimmer = Math.sin(t * 0.1 + i * 2) * 0.3 + 0.7;
      bx.fillStyle = rarityCol;
      bx.globalAlpha = hovered ? 1 : shimmer;
      bx.fillRect(cx - 1, cardY - 1, cardW + 2, 1); bx.fillRect(cx - 1, cardY + cardH, cardW + 2, 1);
      bx.fillRect(cx - 1, cardY - 1, 1, cardH + 2); bx.fillRect(cx + cardW, cardY - 1, 1, cardH + 2);
      bx.globalAlpha = 1;
      bx.fillRect(cx, cardY, cardW, 2); bx.fillRect(cx, cardY + cardH - 2, cardW, 2);
      bx.fillRect(cx, cardY, 2, cardH); bx.fillRect(cx + cardW - 2, cardY, 2, cardH);
    } else if (isOwned) {
      const pulse = Math.sin(t * 0.08 + i) * 0.3 + 0.7;
      bx.fillStyle = '#44eeff';
      bx.globalAlpha = hovered ? 1 : pulse;
      const bw = hovered ? 2 : 1;
      bx.fillRect(cx, cardY, cardW, bw); bx.fillRect(cx, cardY + cardH - bw, cardW, bw);
      bx.fillRect(cx, cardY, bw, cardH); bx.fillRect(cx + cardW - bw, cardY, bw, cardH);
      bx.globalAlpha = 1;
    } else {
      bx.fillStyle = hovered ? '#ffffff' : '#445566';
      const bw = hovered ? 2 : 1;
      bx.fillRect(cx, cardY, cardW, bw); bx.fillRect(cx, cardY + cardH - bw, cardW, bw);
      bx.fillRect(cx, cardY, bw, cardH); bx.fillRect(cx + cardW - bw, cardY, bw, cardH);
    }

    if (isOwned) {
      const lv = ps.upgradeLevels.get((opt as Upgrade).id) || 0;
      const pbW = cardW - 8;
      bx.fillStyle = '#111133';
      bx.fillRect(cx + 4, cardY + 3, pbW, 3);
      bx.fillStyle = '#44eeff';
      bx.fillRect(cx + 4, cardY + 3, Math.floor(pbW * lv / MAX_UPGRADE_LEVEL), 3);
      bx.fillStyle = '#88ffff';
      bx.fillRect(cx + 4, cardY + 3, Math.floor(pbW * lv / MAX_UPGRADE_LEVEL), 1);
    }

    const tagText = optIsSuperRare ? 'SUPER RARE' : optIsAffix ? 'L\xC9GENDAIRE' : isOwned ? 'POSS\xC9D\xC9' : 'NOUVEAU';
    const tagCol = isOwned ? '#44eeff' : optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : '#88aa44';
    drawText(tagText, cx + (cardW - textWidth(tagText, 1)) / 2, cardY + (isOwned ? 8 : 4), tagCol, 1);

    if ('icon' in opt) {
      const icon = (opt as any).icon;
      const iconScale = 3;
      const iconW = 5 * iconScale;
      const iconX = cx + (cardW - iconW) / 2;
      const iconBob = !isOwned ? Math.sin(t * 0.06 + i * 2) * 2 : 0;
      bx.fillStyle = rarityCol;
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 5; col++)
          if (icon[row]?.[col])
            bx.fillRect(iconX + col * iconScale, cardY + 16 + row * iconScale + Math.floor(iconBob), iconScale, iconScale);
    }

    const name = (opt as any).name || '';
    drawText(name, cx + (cardW - textWidth(name, 2)) / 2, cardY + 36, hovered ? '#ffffff' : rarityCol, 2);

    const desc = (opt as any).desc || '';
    drawText(desc, cx + (cardW - textWidth(desc, 1)) / 2, cardY + 52, '#7788aa', 1);

    if (optIsUpgrade) {
      const upg = opt as Upgrade;
      const currentLv = ps.upgradeLevels.get(upg.id) || 0;
      const newLv = currentLv + 1;

      const gain = getStatGain(upg.id, newLv);
      const gainScale = textWidth(gain) > cardW - 8 ? 1 : 2;
      drawText(gain, cx + (cardW - textWidth(gain, gainScale)) / 2, cardY + 64, '#44ff88', gainScale);

      if (currentLv > 0) {
        const lvText = 'NV ' + currentLv + '>' + newLv;
        drawText(lvText, cx + (cardW - textWidth(lvText, 1)) / 2, cardY + 78, '#aaaacc', 1);
      }

      const combos = getCombosForUpgrade(upg.id);
      if (combos.length > 0) {
        const combo = combos[0];
        const partnerId = combo.upgrade1 === upg.id ? combo.upgrade2 : combo.upgrade1;
        const partner = UPGRADES.find(u => u.id === partnerId);
        const partnerLv = ps.upgradeLevels.get(partnerId) || 0;
        const done = newLv >= MAX_UPGRADE_LEVEL && partnerLv >= MAX_UPGRADE_LEVEL;
        if (partner) {
          const line1 = '+ ' + partner.name;
          const line2 = '= ' + combo.name;
          drawText(line1, cx + (cardW - textWidth(line1, 1)) / 2, cardY + 90, partnerLv > 0 ? '#667788' : '#444455', 1);
          drawText(line2, cx + (cardW - textWidth(line2, 1)) / 2, cardY + 100, done ? combo.color : '#555566', 1);
        }
      }
    } else if (optIsSkill(opt)) {
      const cd = Math.round((opt as Skill).cooldown / FPS);
      drawText('CLIC DROIT', cx + (cardW - textWidth('CLIC DROIT', 1)) / 2, cardY + 68, '#44ffcc', 1);
      drawText(cd + 'S RECHARGE', cx + (cardW - textWidth(cd + 'S RECHARGE', 1)) / 2, cardY + 80, '#88aaaa', 1);
    } else {
      const label = optIsSuperRare ? 'SUPER RARE' : 'UNIQUE';
      const labelColV = optIsSuperRare ? '#ff44ff' : '#ff8844';
      drawText(label, cx + (cardW - textWidth(label, 1)) / 2, cardY + 68, labelColV, 1);
    }

    const hint = '' + (i + 1);
    drawText(hint, cx + 4, cardY + cardH - 10, '#444455', 1);
  }
}

export function drawSelectionScreen() {
  bx.fillStyle = 'rgba(0,0,0,0.8)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const isSplitScreen = !players[0].dead && !players[1].dead
    && (players[0].selectionOptions.length > 0 || players[1].selectionOptions.length > 0
        || players[0].selectionDone || players[1].selectionDone);

  if (isSplitScreen) {
    bx.fillStyle = '#333344';
    bx.fillRect(VIEW_W / 2 - 1, 0, 2, VIEW_H);
    drawPlayerSelectionHalf(players[0], true, true);
    drawPlayerSelectionHalf(players[1], true, false);
  } else {
    const activePs = players.find(p => !p.selectionDone && p.selectionOptions.length > 0) || players[game.selectingPlayer];
    drawPlayerSelectionHalf(activePs, false, true);
  }
}

export function drawCodex() {
  updateCodex();

  bx.fillStyle = 'rgba(0,0,0,0.85)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawText('CODEX', (VIEW_W - textWidth('CODEX', 3)) / 2, 8, '#ffcc44', 3);
  drawText('CLIQUEZ SUR UN COMBO POUR ACTIVER', (VIEW_W - textWidth('CLIQUEZ SUR UN COMBO POUR ACTIVER', 1)) / 2, 30, '#555566', 1);

  const colW = Math.floor(VIEW_W / 2);
  const startY = 44;
  const lineH = 52;

  for (let ci = 0; ci < COMBOS.length; ci++) {
    const combo = COMBOS[ci];
    const col = ci % 2;
    const row = Math.floor(ci / 2);
    const cx = col * colW + 8;
    const cy = startY + row * lineH;

    const lv1 = players[game.selectingPlayer].upgradeLevels.get(combo.upgrade1) || 0;
    const lv2 = players[game.selectingPlayer].upgradeLevels.get(combo.upgrade2) || 0;
    const isActive = lv1 >= MAX_UPGRADE_LEVEL && lv2 >= MAX_UPGRADE_LEVEL;
    const inProgress = lv1 > 0 || lv2 > 0;

    const hovered = mouse.x >= cx && mouse.x < cx + colW - 16 && mouse.y >= cy && mouse.y < cy + lineH;

    if (hovered && !isActive) {
      bx.fillStyle = '#222233';
      bx.fillRect(cx - 4, cy - 2, colW - 12, lineH - 2);
    }
    if (isActive) {
      bx.fillStyle = combo.color;
      bx.globalAlpha = 0.08;
      bx.fillRect(cx - 4, cy - 2, colW - 12, lineH - 2);
      bx.globalAlpha = 1;
    }

    const upg1 = UPGRADES.find(u => u.id === combo.upgrade1)!;
    const upg2 = UPGRADES.find(u => u.id === combo.upgrade2)!;

    const nameCol = isActive ? combo.color : hovered ? '#ffffff' : inProgress ? '#778899' : '#444455';
    drawText(combo.name, cx, cy, nameCol, 2);

    const r1Col = lv1 >= MAX_UPGRADE_LEVEL ? '#44ff88' : lv1 > 0 ? '#778899' : hovered ? '#aabbcc' : '#444455';
    const r2Col = lv2 >= MAX_UPGRADE_LEVEL ? '#44ff88' : lv2 > 0 ? '#778899' : hovered ? '#aabbcc' : '#444455';
    drawText(upg1.name, cx, cy + 14, r1Col, 1);
    drawText('+', cx + textWidth(upg1.name, 1) + 2, cy + 14, '#555566', 1);
    drawText(upg2.name, cx + textWidth(upg1.name, 1) + 8, cy + 14, r2Col, 1);

    const dotY = cy + 24;
    for (let d = 0; d < MAX_UPGRADE_LEVEL; d++) {
      bx.fillStyle = d < lv1 ? '#44ff88' : '#222233';
      bx.fillRect(cx + d * 4, dotY, 3, 3);
    }
    bx.fillStyle = '#444455';
    bx.fillRect(cx + MAX_UPGRADE_LEVEL * 4 + 1, dotY, 2, 3);
    for (let d = 0; d < MAX_UPGRADE_LEVEL; d++) {
      bx.fillStyle = d < lv2 ? '#44ff88' : '#222233';
      bx.fillRect(cx + (MAX_UPGRADE_LEVEL * 4 + 4) + d * 4, dotY, 3, 3);
    }

    const descCol = isActive ? combo.color : hovered ? '#8899aa' : inProgress ? '#556677' : '#333344';
    drawText(combo.desc, cx, dotY + 6, descCol, 1);
  }
}

function updateCodex() {
  if (mouse.clicked && game.codexOpen) {
    const colW = Math.floor(VIEW_W / 2);
    const startY = 44;
    const lineH = 52;
    for (let ci = 0; ci < COMBOS.length; ci++) {
      const col = ci % 2;
      const row = Math.floor(ci / 2);
      const cx = col * colW + 8;
      const cy = startY + row * lineH;
      if (mouse.x >= cx && mouse.x < cx + colW - 16 && mouse.y >= cy && mouse.y < cy + lineH) {
        const combo = COMBOS[ci];
        const lv1 = players[game.selectingPlayer].upgradeLevels.get(combo.upgrade1) || 0;
        const lv2 = players[game.selectingPlayer].upgradeLevels.get(combo.upgrade2) || 0;
        const isActive = lv1 >= MAX_UPGRADE_LEVEL && lv2 >= MAX_UPGRADE_LEVEL;

        if (isActive) {
          players[game.selectingPlayer].upgradeLevels.delete(combo.upgrade1);
          players[game.selectingPlayer].upgradeLevels.delete(combo.upgrade2);
          weapon.fireRate = 35; weapon.speed = 4; weapon.damage = 1;
          weapon.size = 3; weapon.pierce = 0; weapon.count = 1; weapon.spread = 0;
          player.speed = 1.5; player.maxHp = 100;
          player.pickupRadius = 16; player.magnetRadius = 24;
          for (const [id, lv] of players[game.selectingPlayer].upgradeLevels) {
            const u = UPGRADES.find(uu => uu.id === id);
            if (u) u.apply(lv);
          }
        } else {
          const upg1 = UPGRADES.find(u => u.id === combo.upgrade1)!;
          const upg2 = UPGRADES.find(u => u.id === combo.upgrade2)!;
          players[game.selectingPlayer].upgradeLevels.set(combo.upgrade1, MAX_UPGRADE_LEVEL);
          players[game.selectingPlayer].upgradeLevels.set(combo.upgrade2, MAX_UPGRADE_LEVEL);
          upg1.apply(MAX_UPGRADE_LEVEL);
          upg2.apply(MAX_UPGRADE_LEVEL);
        }
        Sound.chestOpen();
        break;
      }
    }
    mouse.clicked = false;
  }
}

export function drawGameOver() {
  bx.fillStyle = 'rgba(0,0,0,0.85)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const cx = VIEW_W / 2;
  const title = game.won ? 'VOUS AVEZ SURVECU' : 'PARTIE TERMINEE';
  const titleColor = game.won ? '#44ff44' : '#ff4444';
  drawText(title, cx - textWidth(title, 3) / 2, 40, titleColor, 3);
  drawText(formatTime(game.time), cx - textWidth(formatTime(game.time), 2) / 2, 65, '#ffcc44', 2);

  const lvText2 = 'NIVEAU ' + game.level;
  drawText(lvText2, cx - textWidth(lvText2, 1) / 2, 82, '#aa44ff', 1);

  const twoPlayers = !players[1].dead || players[1].kills > 0 || players[1].totalDamage > 0;

  for (let pi = 0; pi < (twoPlayers ? 2 : 1); pi++) {
    const pp = players[pi];
    const px = twoPlayers ? (pi === 0 ? 20 : VIEW_W / 2 + 10) : 20;
    const py = 100;

    drawText(playerNames[pi], px, py, pp.visorColor, 2);

    const stats = [
      ['VICTIMES', '' + pp.kills],
      ['DEGATS', '' + Math.floor(pp.totalDamage)],
      ['UPGRADES', '' + pp.upgradeLevels.size],
      ['COMBOS', '' + pp.activeCombos.length],
      ['AFFIXES', '' + pp.activeAffixes.length],
    ];

    for (let si = 0; si < stats.length; si++) {
      const [label, value] = stats[si];
      drawText(label, px, py + 20 + si * 12, '#777788', 1);
      drawText(value, px + textWidth(label, 1) + 6, py + 20 + si * 12, '#ffffff', 1);
    }

    let uy = py + 20 + stats.length * 12 + 6;
    for (const [id, lv] of pp.upgradeLevels) {
      const upg = UPGRADES.find(u => u.id === id);
      if (upg) {
        const col = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
        drawText(upg.name + ' NV' + lv, px, uy, col, 1);
        uy += 8;
        if (uy > VIEW_H - 30) break;
      }
    }
  }

  if (twoPlayers) {
    bx.fillStyle = '#333344';
    bx.fillRect(VIEW_W / 2, 100, 1, VIEW_H - 130);
  }

  if (game.deathScreenTimer > 60) {
    const blink = Math.floor(game.deathScreenTimer / 20) % 2 === 0;
    if (blink) {
      const retryText = 'ECHAP POUR RECOMMENCER';
      drawText(retryText, cx - textWidth(retryText, 1) / 2, VIEW_H - 20, '#888888', 1);
    }
  }
}
