import type { Skill } from '../types';

export const SKILLS: Skill[] = [
  {
    id: 'dash', name: 'DASH', desc: 'RU\xC9E RAPIDE + D\xC9GATS', color: '#44ffcc',
    icon: [[0,0,0,1,0],[0,0,1,1,0],[1,1,1,1,1],[0,0,1,1,0],[0,0,0,1,0]],
    cooldown: 90,
  },
  {
    id: 'grenade', name: 'GRENADE', desc: 'GROSSE EXPLOSION', color: '#ff6622',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    cooldown: 240,
  },
  {
    id: 'shield_skill', name: 'BARRIER', desc: 'INVINCIBLE 3S', color: '#4488ff',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    cooldown: 360,
  },
  {
    id: 'shockwave', name: 'SHOCKWAV', desc: 'REPOUSS\xC9E MASSIVE', color: '#ffaa44',
    icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    cooldown: 180,
  },
];
