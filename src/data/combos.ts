import type { Combo, PlayerState } from '../types';
import { MAX_UPGRADE_LEVEL } from '../constants';
import { player } from '../state';
import { UPGRADES } from './upgrades';

export const COMBOS: Combo[] = [
  // Offensive
  { id: 'carpet_bomb', name: 'CARPET BOMB', desc: 'BOMBARDEMENT SUR L\'\xC9CRAN', upgrade1: 'projectile', upgrade2: 'proj_size',
    color: '#ff6622', icon: [[1,0,1,0,1],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[1,0,1,0,1]] },
  { id: 'death_ray', name: 'DEATH RAY', desc: 'RAYON LASER CONTINU', upgrade1: 'damage', upgrade2: 'pierce',
    color: '#ff2244', icon: [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'sniper', name: 'SNIPER', desc: 'TIR INSTANTAN\xC9 MASSIF', upgrade1: 'proj_speed', upgrade2: 'damage',
    color: '#4488ff', icon: [[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1]] },
  { id: 'bullet_hell', name: 'BULLET HELL', desc: 'TIRS \xC0 T\xCATE CHERCHEUSE', upgrade1: 'projectile', upgrade2: 'fire_rate',
    color: '#ffff44', icon: [[1,0,0,0,1],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[1,0,0,0,1]] },
  { id: 'shockwave', name: 'SHOCKWAVE', desc: 'ONDE DE CHOC REPOUSSE TOUT', upgrade1: 'proj_size', upgrade2: 'pierce',
    color: '#44ffaa', icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]] },
  { id: 'meteor', name: 'METEOR', desc: 'ROCHERS TOMBENT DU CIEL', upgrade1: 'damage', upgrade2: 'proj_size',
    color: '#ff8800', icon: [[0,0,1,0,0],[0,1,1,1,0],[0,1,1,1,0],[1,1,1,1,1],[0,0,0,0,0]] },
  { id: 'nova_pulse', name: 'NOVA PULSE', desc: 'ORBE GRAVITATIONNEL EXPLOSE', upgrade1: 'orbital', upgrade2: 'damage',
    color: '#ff44aa', icon: [[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1]] },
  { id: 'blade_storm', name: 'BLADE STORM', desc: 'LAMES TOURBILLONNANTES', upgrade1: 'thorns', upgrade2: 'orbital',
    color: '#ff8888', icon: [[0,1,0,1,0],[1,0,0,0,1],[0,0,1,0,0],[1,0,0,0,1],[0,1,0,1,0]] },
  { id: 'railgun', name: 'RAILGUN', desc: 'RAYON INSTANTAN\xC9 TOTAL', upgrade1: 'proj_speed', upgrade2: 'pierce',
    color: '#88ffff', icon: [[1,0,0,0,0],[1,1,0,0,0],[1,1,1,1,1],[1,1,0,0,0],[1,0,0,0,0]] },
  // Utility
  { id: 'bullet_time', name: 'BULLET TIME', desc: 'RALENTI P\xC9RIODIQUE', upgrade1: 'move_speed', upgrade2: 'fire_rate',
    color: '#aaccff', icon: [[0,1,1,1,0],[1,0,0,1,0],[1,0,1,0,0],[1,0,0,0,0],[0,1,1,1,0]] },
  { id: 'second_life', name: 'SECOND LIFE', desc: 'BOUCLIER DOR\xC9 DE SURVIE', upgrade1: 'life_steal', upgrade2: 'max_hp',
    color: '#44ff88', icon: [[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,1,0,1,0]] },
  { id: 'warp_field', name: 'WARP FIELD', desc: 'AURA MAGN\xC9TIQUE + REPOUSSE', upgrade1: 'pickup_radius', upgrade2: 'move_speed',
    color: '#cc88ff', icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]] },
  // Defensive combos
  { id: 'iron_skin', name: 'IRON SKIN', desc: 'R\xC9GEN + 50% R\xC9DUCTION', upgrade1: 'armor', upgrade2: 'max_hp',
    color: '#aaaacc', icon: [[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0]] },
  { id: 'reflect', name: 'REFLECT', desc: 'D\xC9VIE LES PROJECTILES', upgrade1: 'armor', upgrade2: 'thorns',
    color: '#4488ff', icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]] },
  { id: 'phantom', name: 'PHANTOM', desc: 'ESQUIVE = INVISIBLE 2S', upgrade1: 'dodge', upgrade2: 'move_speed',
    color: '#8844cc', icon: [[0,0,1,0,0],[0,1,1,1,0],[0,1,0,1,0],[0,0,1,0,0],[0,0,0,0,0]] },
  { id: 'fortress', name: 'FORTRESS', desc: 'ESQUIVE = BOUCLIER 1S', upgrade1: 'dodge', upgrade2: 'armor',
    color: '#44aaff', icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[0,1,1,1,0]] },
];

export function getActiveCombos(ps: PlayerState = player): Combo[] {
  return COMBOS.filter(c => {
    const lv1 = ps.upgradeLevels.get(c.upgrade1) || 0;
    const lv2 = ps.upgradeLevels.get(c.upgrade2) || 0;
    return lv1 >= MAX_UPGRADE_LEVEL && lv2 >= MAX_UPGRADE_LEVEL;
  });
}

export function getCombosForUpgrade(upgradeId: string): Combo[] {
  return COMBOS.filter(c => c.upgrade1 === upgradeId || c.upgrade2 === upgradeId);
}
