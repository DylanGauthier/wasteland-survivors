export const TILE = 16;
export const SCALE = 2;
export const VIEW_W = 640;
export const VIEW_H = 480;
export const MAP_W = 80;
export const MAP_H = 80;
export const FPS = 60;
export const GAME_DURATION = 15 * 60 * FPS; // 15 minutes

export const MAX_UPGRADE_LEVEL = 6;
export const MAX_UPGRADES = 6;
export const MAX_ENEMIES = 300;

// ── Colors — Dark Abyss Theme ──
export const COL = {
  // Ground: void black, dark purple cracks, obsidian
  sand1: '#0a0a12', sand2: '#0d0b18', sand3: '#12101e',
  rock1: '#1a1428', rock2: '#120e20', darkRock: '#08060e',
  shadow: '#050308', sky: '#020104',
  // Player: pale glow in the dark
  laser: '#cc44ff', laserGlow: '#ee66ff',
  playerArmor: '#4a4a6a', playerVisor: '#aa66ff', playerCape: '#2a2040',
  // Enemies: red/crimson from the void
  enemyBody: '#661122', enemyEye: '#ff2244',
  hpBar: '#cc2244', hpBg: '#220011',
  // Drops
  xpOrb: '#aa44ff', xpOrbGlow: '#cc88ff',
  heartDrop: '#ff2266',
  // Bosses
  bossBody: '#442244', bossEye: '#ff44aa',
  minibossBody: '#332244', minibossEye: '#bb44ff',
  // Chests
  chestBody: '#443366', chestLock: '#aa88ff',
  chestRare: '#ff44aa', chestRareGlow: '#ff88cc',
};
