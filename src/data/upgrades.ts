import type { Upgrade } from '../types';
import { player, weapon } from '../state';

export const UPGRADES: Upgrade[] = [
  {
    id: 'fire_rate', name: 'FIRE RATE', desc: 'TIR RAPIDE',
    icon: [[0,1,0,0,0],[1,1,1,0,0],[0,1,0,0,0],[0,0,1,1,0],[0,0,0,1,1]],
    apply: (lv) => { weapon.fireRate = Math.max(6, 35 - lv * 4); },
  },
  {
    id: 'damage', name: 'DAMAGE', desc: 'PLUS DE D\xC9GATS',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    apply: (lv) => { weapon.damage = 1 + lv; },
  },
  {
    id: 'move_speed', name: 'SPEED', desc: 'PLUS RAPIDE',
    icon: [[0,0,0,1,0],[0,0,1,1,0],[1,1,1,1,1],[0,0,1,1,0],[0,0,0,1,0]],
    apply: (lv) => { player.speed = 1.5 + lv * 0.15; },
  },
  {
    id: 'max_hp', name: 'VITALITY', desc: 'PLUS DE VIE',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    apply: (lv) => { player.maxHp = 100 + lv * 10; player.hp = Math.min(player.hp + 10, player.maxHp); },
  },
  {
    id: 'pickup_radius', name: 'MAGNET', desc: 'PLUS D\'AIMANT',
    icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
    apply: (lv) => { player.pickupRadius = 16 + lv * 10; player.magnetRadius = 30 + lv * 30; },
  },
  {
    id: 'projectile', name: 'MULTISHOT', desc: 'PLUS DE BALLES',
    icon: [[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1]],
    apply: (lv) => { weapon.count = 1 + lv; weapon.spread = Math.min(0.3, 0.06 * lv); },
  },
  {
    id: 'pierce', name: 'PIERCE', desc: 'TRANSPERCE',
    icon: [[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
    apply: (lv) => { weapon.pierce = lv; },
  },
  {
    id: 'proj_size', name: 'CALIBER', desc: 'PLUS GROS TIRS',
    icon: [[0,0,0,0,0],[0,1,1,1,0],[0,1,1,1,0],[0,1,1,1,0],[0,0,0,0,0]],
    apply: (lv) => { weapon.size = 3 + lv; },
  },
  {
    id: 'proj_speed', name: 'VELOCITY', desc: 'BALLES RAPIDES',
    icon: [[0,0,0,0,1],[0,0,0,1,1],[1,1,1,1,1],[0,0,0,1,1],[0,0,0,0,1]],
    apply: (lv) => { weapon.speed = 4 + lv * 0.5; },
  },
  {
    id: 'life_steal', name: 'LEECH', desc: 'VOL DE VIE',
    icon: [[0,1,0,1,0],[1,0,1,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    apply: () => { /* checked in onEnemyKill */ },
  },
  {
    id: 'thorns', name: 'THORNS', desc: 'D\xC9GATS CONTACT',
    icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
    apply: () => { /* checked in contact damage */ },
  },
  {
    id: 'orbital', name: 'ORBITAL', desc: 'TIRS ROTATIFS',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    apply: () => { /* handled in update */ },
  },
  {
    id: 'armor', name: 'ARMOR', desc: 'R\xC9DUCTION D\xC9GATS',
    icon: [[0,1,1,1,0],[1,1,1,1,1],[1,1,0,1,1],[1,1,1,1,1],[0,1,1,1,0]],
    apply: () => { /* checked on damage */ },
  },
  {
    id: 'dodge', name: 'DODGE', desc: 'CHANCE D\'ESQUIVE',
    icon: [[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]],
    apply: () => { /* checked on damage */ },
  },
];
