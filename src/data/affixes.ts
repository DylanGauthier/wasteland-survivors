import type { Affix } from '../types';

export const AFFIXES: Affix[] = [
  {
    id: 'chain', name: 'CHAIN', desc: 'ARC \xC9LECTRIQUE', color: '#4488ff',
    icon: [[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1]],
  },
  {
    id: 'explosion', name: 'EXPLOSION', desc: 'EXPLOSION DE ZONE', color: '#ff6622',
    icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
  },
  {
    id: 'affix_lifesteal', name: 'VAMPIRIC', desc: 'SOIN PAR KILL', color: '#44ff44',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'freeze', name: 'FREEZE', desc: 'RALENTIT ENNEMIS', color: '#88ddff',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'burn', name: 'BURN', desc: 'D\xC9GATS CONTINUS', color: '#ff4400',
    icon: [[0,0,1,0,0],[0,1,1,0,0],[0,1,1,1,0],[1,1,1,1,0],[0,1,1,0,0]],
  },
  {
    id: 'ricochet', name: 'RICOCHET', desc: 'REBOND AU KILL', color: '#ddaa44',
    icon: [[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,1,0,0]],
  },
];
