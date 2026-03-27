// ═══════════════════════════════════════════════════════
// WASTELAND SURVIVORS — Abyssal survivor shooter
// Dark, oppressive, eldritch. You are The Wanderer.
// ═══════════════════════════════════════════════════════

import { Music } from './audio/MusicEngine';
import { Sound } from './audio/SoundEngine';

const TILE = 16;
const SCALE = 2;
const VIEW_W = 640;
const VIEW_H = 480;
const MAP_W = 80;
const MAP_H = 80;
const FPS = 60;
const GAME_DURATION = 15 * 60 * FPS; // 15 minutes

// ── Canvas setup ──
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = VIEW_W * SCALE;
canvas.height = VIEW_H * SCALE;
ctx.imageSmoothingEnabled = false;
// Cursor hidden during gameplay, shown on title/selection
canvas.style.cursor = 'none';

const buf = document.createElement('canvas');
buf.width = VIEW_W;
buf.height = VIEW_H;
const bx = buf.getContext('2d')!;

// Bloom layer — captures bright stuff, blurs it, composites back
const bloomBuf = document.createElement('canvas');
bloomBuf.width = VIEW_W;
bloomBuf.height = VIEW_H;
const bloomCtx = bloomBuf.getContext('2d')!;

// ── Colors — Dark Abyss Theme ──
const COL = {
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

// ── Map generation ──
const map: number[][] = [];
function generateMap() {
  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const n = noise(x * 0.08, y * 0.08);
      if (n > 0.7) map[y][x] = 3;
      else if (n > 0.55) map[y][x] = 2;
      else if (n > 0.35) map[y][x] = 1;
      else map[y][x] = 0;
      if (map[y][x] <= 1 && Math.random() < 0.02) map[y][x] = 4;
    }
  }
  for (let y = MAP_H / 2 - 3; y < MAP_H / 2 + 3; y++)
    for (let x = MAP_W / 2 - 3; x < MAP_W / 2 + 3; x++)
      map[y][x] = 0;

  // Find wall clusters via flood fill, then place eyes + fissures
  veins.length = 0;
  wallEyes.length = 0;
  const visited = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));

  for (let sy = 0; sy < MAP_H; sy++) {
    for (let sx = 0; sx < MAP_W; sx++) {
      if (map[sy][sx] !== 3 || visited[sy][sx]) continue;
      // Flood fill to find cluster
      const cluster: Vec[] = [];
      const stack: Vec[] = [{ x: sx, y: sy }];
      while (stack.length > 0) {
        const p = stack.pop()!;
        if (p.x < 0 || p.x >= MAP_W || p.y < 0 || p.y >= MAP_H) continue;
        if (visited[p.y][p.x] || map[p.y][p.x] !== 3) continue;
        visited[p.y][p.x] = true;
        cluster.push(p);
        stack.push({ x: p.x+1, y: p.y }, { x: p.x-1, y: p.y }, { x: p.x, y: p.y+1 }, { x: p.x, y: p.y-1 });
      }

      if (cluster.length < 8) continue; // need decent size for an eye

      // Find center of cluster
      let cx = 0, cy = 0;
      for (const p of cluster) { cx += p.x; cy += p.y; }
      cx = Math.floor(cx / cluster.length) * TILE + TILE / 2;
      cy = Math.floor(cy / cluster.length) * TILE + TILE / 2;

      // Place BIG eye at center
      // Compute cluster bounding box to limit eye size
      let minCX = MAP_W, maxCX = 0, minCY = MAP_H, maxCY = 0;
      for (const p of cluster) { minCX = Math.min(minCX, p.x); maxCX = Math.max(maxCX, p.x); minCY = Math.min(minCY, p.y); maxCY = Math.max(maxCY, p.y); }
      const clusterW = (maxCX - minCX + 1) * TILE;
      const clusterH = (maxCY - minCY + 1) * TILE;
      const eyeSize = Math.min(clusterW * 0.4, clusterH * 0.4, 50);
      wallEyes.push({ x: cx, y: cy, size: eyeSize });

      // Find edge tiles of cluster (adjacent to non-wall)
      const edges: Vec[] = [];
      for (const p of cluster) {
        const adj = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [adx, ady] of adj) {
          const nx = p.x + adx, ny = p.y + ady;
          if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H || map[ny][nx] !== 3) {
            edges.push({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });
            break;
          }
        }
      }

      // Store potential vein spawn points (will grow during gameplay)
      const fissureCount = Math.min(4, 1 + Math.floor(cluster.length / 5));
      for (let f = 0; f < fissureCount; f++) {
        if (edges.length === 0) break;
        const start = edges[Math.floor(Math.random() * edges.length)];
        const angle = Math.atan2(start.y - cy, start.x - cx) + (Math.random() - 0.5) * 0.5;
        veinSpawns.push({ x: start.x, y: start.y, angle });
      }
    }
  }
}

// Growing veins — spawn from wall clusters and grow over time
interface GrowingVein {
  segments: Vec[];
  targetLen: number;     // max segments
  growTimer: number;     // frames until next segment grows
  growRate: number;      // frames between growths
  angle: number;         // general direction
  startTime: number;     // game time when vein started
  width: number;         // current max width (grows too)
  maxWidth: number;
}
const veins: GrowingVein[] = [];
// Wall eyes
const wallEyes: (Vec & { size: number })[] = [];
// Vein spawn points (edges of wall clusters, computed at map gen)
const veinSpawns: { x: number; y: number; angle: number }[] = [];

function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// ── Types ──
interface Vec { x: number; y: number; }
type Dir = 'up' | 'down' | 'left' | 'right';
type GameState = 'title' | 'playing' | 'paused' | 'levelup' | 'chest_common' | 'chest_rare' | 'gameover';

// ── Upgrade system ──
const MAX_UPGRADE_LEVEL = 6;

interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: number[][]; // 5x5 pixel art
  apply: (level: number) => void;
}

const UPGRADES: Upgrade[] = [
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

// ── Combo system (2 maxed upgrades = passive bonus) ──
interface Combo {
  id: string;
  name: string;
  desc: string;
  upgrade1: string; // upgrade id
  upgrade2: string; // upgrade id
  color: string;
  icon: number[][];
}

const COMBOS: Combo[] = [
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

// Get active combos for current player context
function getActiveCombos(ps: PlayerState = player): Combo[] {
  return COMBOS.filter(c => {
    const lv1 = ps.upgradeLevels.get(c.upgrade1) || 0;
    const lv2 = ps.upgradeLevels.get(c.upgrade2) || 0;
    return lv1 >= MAX_UPGRADE_LEVEL && lv2 >= MAX_UPGRADE_LEVEL;
  });
}

// Get combos an upgrade contributes to
function getCombosForUpgrade(upgradeId: string): Combo[] {
  return COMBOS.filter(c => c.upgrade1 === upgradeId || c.upgrade2 === upgradeId);
}

// ── Affix system ──
interface Affix {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
}

const AFFIXES: Affix[] = [
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

// ── Super Rare affixes (boss-only, game changers) ──
interface SuperRare {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
}

const SUPER_RARES: SuperRare[] = [
  {
    id: 'drone', name: 'DRONE', desc: 'TOURELLE ORBITALE', color: '#44ccff',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  },
  {
    id: 'shadow_clone', name: 'SHADOW', desc: 'CLONE \xC9CHO', color: '#8844cc',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,0,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'nova_on_kill', name: 'NOVA', desc: 'EXPLOSION AU KILL', color: '#ff4488',
    icon: [[1,0,1,0,1],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[1,0,1,0,1]],
  },
  {
    id: 'thunder', name: 'THUNDER', desc: 'FOUDRE AL\xC9ATOIRE', color: '#ffff44',
    icon: [[0,0,1,1,0],[0,1,1,0,0],[1,1,1,1,0],[0,0,1,1,0],[0,1,1,0,0]],
  },
  {
    id: 'poison_trail', name: 'TOXIN', desc: 'TRAIN\xC9E DE POISON', color: '#44ff44',
    icon: [[0,0,0,0,0],[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'second_wind', name: '2ND WIND', desc: 'R\xC9SURRECTION UNIQUE', color: '#ffffff',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,1,0,1,0]],
  },
  {
    id: 'shield_orb', name: 'SHIELD', desc: 'BLOQUE 1 COUP/15S', color: '#44aaff',
    icon: [[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'magnet_pulse', name: 'MAGNET', desc: 'ASPIRE XP/10S', color: '#ff88ff',
    icon: [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[0,1,0,1,0],[0,0,1,0,0]],
  },
];

// ── Right-click skills (choose one per run) ──
interface Skill {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
  cooldown: number; // frames
}

const SKILLS: Skill[] = [
  {
    id: 'dash', name: 'DASH', desc: 'RUÉE RAPIDE + D\xC9GATS', color: '#44ffcc',
    icon: [[0,0,0,1,0],[0,0,1,1,0],[1,1,1,1,1],[0,0,1,1,0],[0,0,0,1,0]],
    cooldown: 90, // 1.5s
  },
  {
    id: 'grenade', name: 'GRENADE', desc: 'GROSSE EXPLOSION', color: '#ff6622',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    cooldown: 240, // 4s
  },
  {
    id: 'shield_skill', name: 'BARRIER', desc: 'INVINCIBLE 3S', color: '#4488ff',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    cooldown: 360, // 6s
  },
  {
    id: 'shockwave', name: 'SHOCKWAV', desc: 'REPOUSS\xC9E MASSIVE', color: '#ffaa44',
    icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    cooldown: 180, // 3s
  },
];

// ── PlayerState (per-player state for co-op) ──
interface PlayerState {
  // Physical
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number; dir: Dir;
  shootCooldown: number; invincible: number;
  animFrame: number; animTimer: number; moving: boolean;
  // Weapon
  weapon: { fireRate: number; speed: number; damage: number; size: number; pierce: number; count: number; spread: number; };
  // Build
  upgradeLevels: Map<string, number>;
  activeCombos: string[];
  activeAffixes: string[];
  activeSuperRares: string[];
  activeSkill: Skill | null;
  skillCooldown: number;
  skillActive: number;
  dashDx: number; dashDy: number;
  // Per-player combo timers
  bladeStormAngle: number;
  novaOrbActive: { x: number; y: number; dx: number; dy: number; life: number; maxLife: number } | null;
  shockwaveTimer: number;
  meteorTimer: number;
  carpetBombTimer: number;
  sniperTimer: number;
  railgunTimer: number;
  bulletTimeTimer: number;
  bulletTimeActive: number;
  // Per-player visual FX
  ghostTrail: { x: number; y: number; dir: Dir; age: number }[];
  damageFlash: number;
  hitDirX: number; hitDirY: number;
  orbitalAngle: number;
  droneAngle: number; droneCount: number;
  shadowClone: { x: number; y: number; trail: Vec[] } | null;
  thunderTimer: number;
  poisonTrails: { x: number; y: number; life: number }[];
  secondWindUsed: boolean;
  shieldOrbTimer: number; shieldOrbActive: boolean;
  magnetPulseTimer: number;
  novaOnKillChance: number;
  // Per-player pending level ups (how many upgrades this player still needs to pick)
  pendingLevelUps: number;
  kills: number;
  totalDamage: number;
  // Revive system (co-op)
  reviveProgress: number; // 0 to 1, fills when ally is near
  deathX: number; deathY: number; // position where player died
  // Per-player selection state (for split-screen simultaneous picking)
  selectionOptions: (Upgrade | Affix)[];
  selectionHover: number;
  selectionDone: boolean; // true = this player has picked, waiting for other
  // Pickup
  pickupRadius: number;
  magnetRadius: number;
  // Player identity
  playerIndex: number; // 0 or 1
  visorColor: string;
  dead: boolean;
}

function createPlayer(index: number): PlayerState {
  return {
    x: MAP_W / 2 * TILE + 8 + (index === 1 ? 20 : 0),
    y: MAP_H / 2 * TILE + 8 + (index === 1 ? 8 : 0),
    hp: 100, maxHp: 100, speed: 1.5,
    dir: 'down' as Dir,
    shootCooldown: 0, invincible: 0,
    animFrame: 0, animTimer: 0, moving: false,
    weapon: { fireRate: 35, speed: 4, damage: 1, size: 3, pierce: 0, count: 1, spread: 0 },
    upgradeLevels: new Map(),
    activeCombos: [], activeAffixes: [], activeSuperRares: [],
    activeSkill: null, skillCooldown: 0, skillActive: 0,
    dashDx: 0, dashDy: 0,
    bladeStormAngle: 0,
    novaOrbActive: null,
    shockwaveTimer: 0, meteorTimer: 0, carpetBombTimer: 0,
    sniperTimer: 0, railgunTimer: 0,
    bulletTimeTimer: 0, bulletTimeActive: 0,
    ghostTrail: [],
    damageFlash: 0, hitDirX: 0, hitDirY: 0,
    orbitalAngle: 0,
    droneAngle: 0, droneCount: 0,
    shadowClone: null,
    thunderTimer: 0,
    poisonTrails: [],
    secondWindUsed: false,
    shieldOrbTimer: 0, shieldOrbActive: true,
    magnetPulseTimer: 0,
    novaOnKillChance: 0.15,
    pendingLevelUps: 0,
    kills: 0, totalDamage: 0,
    reviveProgress: 0, deathX: 0, deathY: 0,
    selectionOptions: [],
    selectionHover: -1,
    selectionDone: false,
    pickupRadius: 16, magnetRadius: 20,
    playerIndex: index,
    visorColor: index === 0 ? '#aa66ff' : '#44ddff',
    dead: false,
  };
}

// ── Player names & colors ──
const playerNames = ['JOUEUR 1', 'JOUEUR 2'];
const PLAYER_COLORS = [
  { name: 'VIOLET', color: '#aa66ff' },
  { name: 'ROUGE', color: '#ff4466' },
  { name: 'ROSE', color: '#ff88aa' },
  { name: 'BLANC', color: '#ffffff' },
  { name: 'CYAN', color: '#44ddff' },
  { name: 'VERT', color: '#44ff88' },
  { name: 'ORANGE', color: '#ffaa22' },
  { name: 'ECARLATE', color: '#ff2222' },
  { name: 'INDIGO', color: '#8844ff' },
  { name: 'OR', color: '#ffff44' },
];
const playerColors = ['#aa66ff', '#44ddff'];

// ── Title screen state ──
const titleState = {
  mode: 0 as 0 | 1 | 2, // 0 = selecting mode, 1 = name input, 2 = color select
  playerCount: 1,
  editingPlayer: 0,
  nameInput: '',
  selectedColors: [0, 4], // indices into PLAYER_COLORS
  cursor: 0, // keyboard cursor position
  pauseCursor: 0, // 0 = resume, 1 = quit (for pause menu)
  ashParticles: [] as { x: number; y: number; dx: number; dy: number; life: number; maxLife: number }[],
};

// ── Players array (co-op) ──
const players: PlayerState[] = [createPlayer(0), createPlayer(1)];
// Backward-compat aliases — point to "current" player context
let player = players[0];
let weapon = players[0].weapon;

// Switch alias context to a specific player
function setPlayerContext(ps: PlayerState) {
  player = ps;
  weapon = ps.weapon;
}

function getWeaponName(): string {
  if (weapon.damage >= 8) return 'ANNIHILATOR';
  if (weapon.count >= 5) return 'STORM GUN';
  if (weapon.pierce >= 3) return 'RAILGUN';
  if (weapon.damage >= 4) return 'PLASMA CANNON';
  if (weapon.count >= 3) return 'SCATTER GUN';
  if (weapon.speed >= 6) return 'PULSE RIFLE';
  if (weapon.damage >= 2) return 'HEAVY BLASTER';
  if (weapon.count >= 2) return 'DUAL BLASTER';
  return 'BLASTER';
}

function getWeaponColor(): string {
  if (weapon.damage >= 8) return '#ffffff';
  if (weapon.count >= 5) return '#ffff44';
  if (weapon.pierce >= 3) return '#44ffaa';
  if (weapon.damage >= 4) return '#44aaff';
  if (weapon.count >= 3) return '#ffaa00';
  if (weapon.speed >= 6) return '#ff6600';
  if (weapon.damage >= 2) return '#ff4422';
  return '#ff3333';
}

// ── Game state (shared between players) ──
const game = {
  time: 0,
  state: 'title' as GameState,
  kills: 0,
  // Shared XP/Level (both players benefit)
  xp: 0,
  xpToLevel: 10,
  level: 1,
  gameOver: false,
  deathScreenTimer: 0,
  won: false,
  shakeTimer: 0,
  // Boss/miniboss timers
  miniBossTimer: 30 * FPS,  // first miniboss at 30s
  bossTimer: 60 * FPS,      // first boss at 60s
  miniBossCount: 0,
  bossCount: 0,
  superBossSpawned: false,
  superBossTimer: Math.floor(5 * 60 * FPS), // at 5:00
  megaBossSpawned: false,
  // Selection screen
  selectionOptions: [] as (Upgrade | Affix)[],
  selectionType: '' as 'levelup' | 'chest_common' | 'chest_rare',
  selectionHover: -1,
  selectionDelay: 0,  // frames before clicks are accepted
  selectingPlayer: 0, // which player is currently selecting (0 or 1)
  // Combos
  codexOpen: false,
  // Visual FX (shared)
  freezeFrame: 0,       // frames of freeze on boss kill
  freezeZoom: 0,        // zoom amount during freeze
  lightningTimer: 0,    // countdown to next lightning flash
  lightningFlash: 0,
};

interface Laser {
  x: number; y: number;
  dx: number; dy: number;
  life: number;
  fromPlayer: boolean;
  damage: number;
  size: number;
  pierce: number;
  pierceHit: Set<Enemy>;
  color: string;
  glowColor: string;
  trailLength: number;
  isSplit?: boolean;
}

interface Enemy {
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number;
  baseSpeed: number;
  type: 'scout' | 'brute' | 'dasher' | 'splitter' | 'tank' | 'swarm' | 'exploder' | 'caster' | 'miniboss' | 'boss' | 'superboss';
  dir: Dir;
  shootTimer: number;
  hitFlash: number;
  animTimer: number;
  bossPhase?: number;
  bossAttackTimer?: number;
  dashTimer?: number;
  dashDirX?: number;
  dashDirY?: number;
  elite?: EliteAffix;
  teleportTimer?: number;
  emergeTimer: number;   // frames of emergence animation (starts at 30, counts down)
  slowTimer: number;
  burnTimer: number;
  burnDamage: number;
}

interface Particle {
  x: number; y: number;
  dx: number; dy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

interface Drop {
  x: number; y: number;
  type: 'xp' | 'heart';
  value: number;
  life: number;   // -1 = permanent
  age: number;     // frames since spawn
  bobTimer: number;
}

interface Chest {
  x: number; y: number;
  rarity: 'common' | 'rare';
  opened: boolean;
  openTimer: number;
}

// Chain lightning visual effect
interface ChainArc {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;
}

const lasers: Laser[] = [];
const enemies: Enemy[] = [];
const particles: Particle[] = [];
const drops: Drop[] = [];
const chests: Chest[] = [];
const chainArcs: ChainArc[] = [];

// Floating damage numbers
interface DmgNumber { x: number; y: number; value: number; life: number; color: string; }
const dmgNumbers: DmgNumber[] = [];
function spawnDmgNumber(x: number, y: number, value: number, color = '#ffffff') {
  // Merge with nearby recent number if same position
  for (const d of dmgNumbers) {
    if (d.life > 15 && Math.abs(d.x - x) < 10 && Math.abs(d.y - y) < 10) {
      d.value += value;
      d.life = 25;
      return;
    }
  }
  dmgNumbers.push({ x: x + (Math.random() - 0.5) * 6, y, value, life: 25, color });
}

// Ash rain (screen-space, permanent ambient)
interface AshParticle { x: number; y: number; speed: number; size: number; alpha: number; }
const ashRain: AshParticle[] = [];
for (let i = 0; i < 120; i++) {
  ashRain.push({ x: Math.random() * 640, y: Math.random() * 480, speed: 0.15 + Math.random() * 0.5, size: 1 + Math.random() * 1.5, alpha: 0.12 + Math.random() * 0.2 });
}

// Danger zones (AoE warnings)
// Expanding shockwave rings (visual)
interface ShockRing {
  x: number; y: number;
  radius: number;     // current radius
  maxRadius: number;
  speed: number;       // expansion speed
  life: number;
  color: string;
}
const shockRings: ShockRing[] = [];

// Meteor falling entities
interface FallingMeteor {
  x: number; y: number;     // target position
  fallTimer: number;         // frames until impact
  radius: number;
  damage: number;
}
const fallingMeteors: FallingMeteor[] = [];

// Blade projectiles (ejected swords)
interface BladeProj {
  x: number; y: number;
  dx: number; dy: number;
  life: number;
  angle: number;
}
const bladeProjs: BladeProj[] = [];

// Visual beam lines (railgun, sniper)
interface BeamLine {
  x1: number; y1: number; x2: number; y2: number;
  life: number; color: string; width: number;
}
const beamLines: BeamLine[] = [];

interface DangerZone {
  x: number; y: number;
  radius: number;
  warnTime: number;  // frames before it detonates
  damage: number;
  life: number;      // total life (warnTime + explosion frames)
}
const dangerZones: DangerZone[] = [];

// Elite enemy affixes
type EliteAffix = 'fire_trail' | 'teleport' | 'reflect' | 'haste' | 'regen';


// ── Input ──
const keys: Record<string, boolean> = {};
const mouse = { x: 0, y: 0, down: false, clicked: false, rightClicked: false };

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  // Title screen input handling
  if (game.state === 'title') {
    if (titleState.mode === 1) {
      // Name typing — intercept keys before they go to the keys{} map
      if (e.key === 'Backspace') {
        e.preventDefault();
        titleState.nameInput = titleState.nameInput.slice(0, -1);
      } else if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // handled in updateTitle
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        // handled in updateTitle
      } else if (e.key.length === 1 && titleState.nameInput.length < 10) {
        const ch = e.key.toUpperCase();
        if (/[A-Z0-9 ]/.test(ch)) titleState.nameInput += ch;
      }
      return;
    }
    // All other title state input handled in updateTitle via keys object
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (game.state === 'playing') { game.state = 'paused'; }
    else if (game.state === 'paused') { game.state = 'playing'; }
  }
  if (e.key === 'Tab') { e.preventDefault(); game.codexOpen = !game.codexOpen; }
  if (e.key.toLowerCase() === 'm') { Music.nextTrack(); }
  // Backspace no longer resets — use pause menu instead
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) / SCALE;
  mouse.y = (e.clientY - rect.top) / SCALE;
});
let audioStarted = false;
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  if (e.button === 2) { mouse.rightClicked = true; }
  if (!audioStarted) { audioStarted = true; Sound.init(); Music.setTrack(5); Music.start(); } // ABYSS track on title
});
canvas.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── Collision ──
function isSolid(px: number, py: number): boolean {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true;
  const t = map[ty][tx];
  return t === 3; // only dark rock walls block
}

function canMove(x: number, y: number, dx: number, dy: number, r: number): boolean {
  const nx = x + dx, ny = y + dy;
  return !isSolid(nx - r, ny - r) && !isSolid(nx + r, ny - r) &&
         !isSolid(nx - r, ny + r) && !isSolid(nx + r, ny + r);
}

// ── Difficulty scaling (time-based) ──
function getDifficulty() {
  const minutes = game.time / (FPS * 60);
  const t = Math.min(1, minutes / 10); // 0→1 smooth over 10 minutes
  const curve = t * t; // quadratic ramp
  const lateCurve = t * t * t; // steeper for spawn rates
  // After 10min: everything spikes hard
  const postBoss = Math.max(0, minutes - 10);
  const rage = postBoss * 0.3; // linear ramp after 10min, gets crazy fast
  return {
    spawnInterval: Math.max(2, Math.floor(90 - lateCurve * 85 - rage * 2)),
    spawnBatch: Math.min(25, 1 + Math.floor(lateCurve * 12) + Math.floor(rage * 3)),
    bruteChance: Math.min(0.8, 0.05 + curve * 0.5 + rage * 0.1),
    hpMult: 1 + curve * 4 + rage * 2,           // x1 → x5 at 10min → ramps hard
    speedMult: 1 + curve * 0.8 + rage * 0.15,   // x1 → x1.8 at 10min → faster
    contactDmg: Math.ceil(3 + curve * 15 + rage * 5), // 3 → 18 at 10min → deadly
  };
}

// ── Spawn helpers ──
let spawnTimer = 60;

function findSpawnPos(): Vec | null {
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

function makeEnemy(pos: Vec, type: Enemy['type'], diff: ReturnType<typeof getDifficulty>): Enemy {
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

const MAX_ENEMIES = 300;

function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return; // cap enemy count, difficulty scales stats instead
  const pos = findSpawnPos();
  if (!pos) return;
  const diff = getDifficulty();
  const minutes = game.time / (FPS * 60);

  // Pick type based on time progression
  const roll = Math.random();
  let type: Enemy['type'];

  if (minutes >= 3.5 && roll < 0.08) {
    // Swarm pack (spawn 5 at once)
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

  // Elite chance — increases over time, makes enemy stronger with a special affix
  const eliteChance = Math.min(0.15, minutes * 0.01);
  if (minutes >= 3 && Math.random() < eliteChance && type !== 'swarm') {
    const affixes: EliteAffix[] = ['fire_trail', 'teleport', 'reflect', 'haste', 'regen'];
    enemy.elite = affixes[Math.floor(Math.random() * affixes.length)];
    enemy.hp = Math.ceil(enemy.hp * 2.5);
    enemy.maxHp = enemy.hp;
    if (enemy.elite === 'haste') { enemy.speed *= 1.8; enemy.baseSpeed *= 1.8; }
    if (enemy.elite === 'teleport') enemy.teleportTimer = 120 + Math.floor(Math.random() * 60);
  }

  enemies.push(enemy);
}

function spawnMiniBoss() {
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
  });
  game.miniBossCount++;
}

function spawnBoss() {
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
  });
  game.bossCount++;
}

function spawnSuperBoss() {
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
  });
  game.superBossSpawned = true;
}

// ── Drops ──
function spawnDrops(x: number, y: number, enemyType: Enemy['type']) {
  if (drops.length > 400) return; // perf cap
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

// ── Particles ──
function spawnParticles(x: number, y: number, count: number, color: string, speed = 2) {
  const maxParticles = 500;
  if (particles.length > maxParticles) return; // skip if too many
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

// ── Direction helpers ──
function aimDir(from: Vec, to: Vec): Vec {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d > 0 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 };
}

function rotateVec(v: Vec, angle: number): Vec {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// ── Selection screen ──
const MAX_UPGRADES = 6; // max distinct upgrade types

function openSelection(type: 'levelup' | 'chest_common' | 'chest_rare', forPlayerIndex: number = 0) {
  game.selectionType = type;
  game.selectionDelay = 20;
  if (type === 'levelup') Sound.levelUp();
  else Sound.chestOpen();

  // For level ups, open for BOTH alive players simultaneously
  if (type === 'levelup') {
    for (const ps of players) {
      if (ps.dead || ps.pendingLevelUps <= 0) {
        ps.selectionDone = true;
        ps.selectionOptions = [];
        continue;
      }
      ps.pendingLevelUps--; // consume one pending level up
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
    // Restore context
    setPlayerContext(players[0]);
    game.state = 'levelup';
    return;
  }

  // Chests = both alive players get their own selection (split screen)
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

function pickRandomUpgrades(n: number): Upgrade[] {
  const ps = players[game.selectingPlayer];
  const ownedIds = Array.from(ps.upgradeLevels.keys());
  const atCap = ownedIds.length >= MAX_UPGRADES;

  // Split pool into 3 categories
  const owned: Upgrade[] = [];     // already have, not maxed
  const comboPartners: Upgrade[] = []; // not owned, but combo partner of something owned
  const fresh: Upgrade[] = [];     // everything else

  // Find combo partner IDs
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

  // Structured pick: 1 owned (guaranteed) + 1 combo partner (if available) + fill with fresh/random
  const result: Upgrade[] = [];
  const picked = new Set<string>();

  // Weighted pool: owned 4x, combo partners 2x, fresh 1x
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

function pickRandom<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

function isSkill(opt: any): opt is Skill { return 'cooldown' in opt; }
function isSuperRare(opt: any): opt is SuperRare { return !('apply' in opt) && !('cooldown' in opt) && SUPER_RARES.some(s => s.id === opt.id); }
function isAffix(opt: any): opt is Affix { return !('apply' in opt) && !('cooldown' in opt) && AFFIXES.some(a => a.id === opt.id); }

function selectOptionForPlayer(playerIdx: number, index: number) {
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

  // Check if both players are done
  if (players.every(p => p.selectionDone)) {
    // Check if any player has more pending level ups
    const anyPending = players.some(p => !p.dead && p.pendingLevelUps > 0);
    if (anyPending) {
      openSelection('levelup');
    } else {
      game.state = 'playing';
    }
  }
}

// Legacy wrapper (for chest/skill selections — single player)
function selectOption(index: number) {
  selectOptionForPlayer(game.selectingPlayer, index);
}

// ── Affix effects ──
function applyAffixOnHit(x: number, y: number, damage: number, hitEnemy: Enemy, ps: PlayerState = player) {
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

// Central damage handler — applies armor, dodge, iron skin, phantom, fortress
function damagePlayer(baseDmg: number, fromX: number, fromY: number, ps: PlayerState = player): boolean {
  if (ps.invincible > 0) return false;
  if (ps.dead) return false;

  const armorLv = ps.upgradeLevels.get('armor') || 0;
  const dodgeLv = ps.upgradeLevels.get('dodge') || 0;

  // Dodge check (5% per level, max 30%)
  if (dodgeLv > 0 && Math.random() < dodgeLv * 0.05) {
    // Dodged!
    spawnParticles(ps.x, ps.y, 5, '#8844cc', 2);
    // PHANTOM combo — invisible 2s after dodge
    if (ps.activeCombos.includes('phantom')) {
      ps.invincible = 120; // 2s invincible
      spawnParticles(ps.x, ps.y, 10, '#8844cc', 3);
    }
    // FORTRESS combo — 1s full shield after dodge
    if (ps.activeCombos.includes('fortress')) {
      ps.invincible = Math.max(ps.invincible, 60);
      spawnParticles(ps.x, ps.y, 10, '#44aaff', 3);
    }
    return false; // no damage
  }

  // Armor reduction (flat -1 per level)
  let dmg = Math.max(1, baseDmg - armorLv);

  // IRON SKIN combo — 50% damage reduction + regen tick
  if (ps.activeCombos.includes('iron_skin')) {
    dmg = Math.max(1, Math.ceil(dmg * 0.5));
    // Small heal on hit
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

function applyAffixOnKill(_x: number, _y: number, ps: PlayerState = player) {
  // Affix life steal
  if (ps.activeAffixes.includes('affix_lifesteal') && Math.random() < 0.15) {
    ps.hp = Math.min(ps.hp + 1, ps.maxHp);
  }
}

function applyRicochet(hitX: number, hitY: number, damage: number, hitEnemy: Enemy, ps: PlayerState = player) {
  if (!ps.activeAffixes.includes('ricochet')) return;
  // Find nearest enemy to bounce toward
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
    isSplit: true, // reuse flag to prevent infinite bounces
  });
}

// ── Combo effects on hit (no recursive onEnemyKill — let update() clean up dead enemies) ──
// All combos are now periodic abilities — no on-hit effects
function applyComboOnHit(_l: Laser, _hitEnemy: Enemy) {
  // Kept as empty hook for future use
}

// ── UPDATE ──
function update() {
  // Title screen
  if (game.state === 'title') {
    updateTitle();
    return;
  }

  // Codex pauses the game
  if (game.codexOpen) return;

  // Pause screen
  if (game.state === 'paused') {
    if (keys['arrowdown'] || keys['s']) { titleState.pauseCursor = 1; keys['arrowdown'] = false; keys['s'] = false; }
    if (keys['arrowup'] || keys['z']) { titleState.pauseCursor = 0; keys['arrowup'] = false; keys['z'] = false; }
    if (keys['enter'] || keys[' ']) {
      keys['enter'] = false; keys[' '] = false;
      if (titleState.pauseCursor === 0) game.state = 'playing';
      else resetGame();
    }
    // Mouse clicks on buttons
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

  // Handle selection screens
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

  // Freeze frame (boss kill pause)
  if (game.freezeFrame > 0) { game.freezeFrame--; game.freezeZoom *= 0.95; return; }

  // Lightning flash decay (triggered by thunder super rare only)
  // No ambient lightning — only from thunder affix
  if (game.lightningFlash > 0) game.lightningFlash--;

  game.time++;

  // ══ PER-PLAYER UPDATE LOOP ══
  for (const ps of players) {
    if (ps.dead) continue;
    setPlayerContext(ps);

    // Player movement
    let dx = 0, dy = 0;
    if (ps.playerIndex === 0) {
      // P1: ZQSD + mouse click-to-move
      if (keys['z']) dy -= 1;
      if (keys['s']) dy += 1;
      if (keys['q']) dx -= 1;
      if (keys['d']) dx += 1;
      // Click-to-move: hold left click = move toward cursor
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
      // P2: arrow keys
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
    // Ghost trail — record position every 4 frames when moving
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
    let autoTargetDist = 250 * 250; // max auto-aim range
    for (const e of enemies) {
      const d = dist2(ps, e);
      if (d < autoTargetDist) { autoTargetDist = d; autoTarget = e; }
    }
    if (autoTarget && ps.shootCooldown <= 0) {
      const baseAim = aimDir(ps, autoTarget);

      // Combo-aware projectile visuals
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

    // ── Check combos for this player ──
    ps.activeCombos = getActiveCombos(ps).map(c => c.id);

    // Combo: BULLET TIME — slow enemies every 15s
    if (ps.activeCombos.includes('bullet_time') && game.time % (15 * FPS) === 0) {
      for (const e of enemies) {
        e.slowTimer = Math.max(e.slowTimer, 180);
      }
      spawnParticles(ps.x, ps.y, 20, '#aaccff', 3);
    }

    // Combo: WARP FIELD — permanent magnet for all drops
    if (ps.activeCombos.includes('warp_field')) {
      for (const dr of drops) {
        const ddx = ps.x - dr.x, ddy = ps.y - dr.y;
        const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (ddist > 2) {
          dr.x += (ddx / ddist) * 3;
          dr.y += (ddy / ddist) * 3;
        }
      }
    }

    // ══ COMBO ABILITIES (periodic, massive, screen-filling) ══
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

    // Combo heal helper (leech heals on combo kills)
    function comboHeal(amount: number) {
      if (uLeech > 0 && Math.random() < uLeech * 0.03) {
        ps.hp = Math.min(ps.hp + amount, ps.maxHp + (ps.activeCombos.includes('second_life') ? 30 + uVitality * 5 : 0));
        spawnParticles(ps.x, ps.y, 2, '#44ff44', 1);
      }
    }

    // BLADE STORM — ALL stats scale
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
  // NOVA PULSE — BLACK HOLE: travels to target, stops, grows for 4s, implodes
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

  // SHOCKWAVE — ALL stats scale
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
  // Update shock rings — expand, damage & push enemies as they pass
  for (let i = shockRings.length - 1; i >= 0; i--) {
    const sr = shockRings[i];
    const prevR = sr.radius;
    sr.radius += sr.speed;
    sr.life--;
    if (sr.life <= 0 || sr.radius > sr.maxRadius) { shockRings.splice(i, 1); continue; }
    // Push enemies that the ring passes over
    for (const e of enemies) {
      const d = Math.sqrt(dist2(sr, e));
      if (d >= prevR && d < sr.radius + 10) {
        const dx = e.x - sr.x, dy = e.y - sr.y;
        if (d > 0) {
          const pushForce = 8 + uDmg * 1 + uThorns;
          const newX = e.x + (dx / d) * pushForce;
          const newY = e.y + (dy / d) * pushForce;
          // Clamp to map bounds
          e.x = Math.max(TILE, Math.min(MAP_W * TILE - TILE, newX));
          e.y = Math.max(TILE, Math.min(MAP_H * TILE - TILE, newY));
          e.hp -= uDmg * 2 + uThorns;
          comboHeal(1);
          e.hitFlash = 8;
        }
      }
    }
  }

  // METEOR — ALL stats scale
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
  // Update falling meteors
  for (let i = fallingMeteors.length - 1; i >= 0; i--) {
    const fm = fallingMeteors[i];
    fm.fallTimer--;
    if (fm.fallTimer <= 0) {
      // IMPACT!
      game.shakeTimer = 15;
      Sound.explosion();
      for (let a = 0; a < 32; a++) {
        const angle = (a / 32) * Math.PI * 2;
        particles.push({ x: fm.x, y: fm.y, dx: Math.cos(angle) * 6, dy: Math.sin(angle) * 6,
          life: 30, maxLife: 30, color: a % 3 === 0 ? '#ff2200' : a % 3 === 1 ? '#ff8800' : '#ffcc00', size: 5 });
      }
      spawnParticles(fm.x, fm.y, 40, '#ff4400', 7);
      spawnParticles(fm.x, fm.y, 20, '#ffffff', 4);
      // Damage
      for (const e of enemies) {
        if (dist2(fm, e) < fm.radius * fm.radius) { e.hp -= fm.damage; e.hitFlash = 12; }
      }
      // Combo meteors don't hurt the player
      if (false) {
        for (const pp of players) {
          if (!pp.dead && pp.invincible <= 0 && dist2(pp, fm) < fm.radius * fm.radius) {
            pp.hp -= Math.ceil(fm.damage * 0.3);
            pp.invincible = 30; pp.damageFlash = 10;
          }
        }
      }
      // Fire ground
      for (let fi = 0; fi < 6; fi++) {
        if (ps.poisonTrails.length < 80) {
          ps.poisonTrails.push({ x: fm.x + (Math.random() - 0.5) * fm.radius, y: fm.y + (Math.random() - 0.5) * fm.radius, life: 240 });
        }
      }
      fallingMeteors.splice(i, 1);
    }
  }

  // CARPET BOMB — ALL stats scale
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
      const spread = 60 + uCaliber * 5; // wider spread with caliber
      for (let b = 0; b < bombCount; b++) {
        const delay = b * Math.max(3, 6 - uVelocity * 0.3); // faster sweep with velocity
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

  // DEATH RAY — ALL stats scale (continuous beam)
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

  // SNIPER — ALL stats scale
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

  // RAILGUN — ALL stats scale
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

  // BULLET TIME — ALL stats scale
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

  // WARP FIELD — ALL stats scale
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
        const dx = e.x - ps.x, dy = e.y - ps.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < wfRange && d > 0) {
          const pushStr = 1.5 + uDmg * 0.3;
          e.x += (dx / d) * pushStr;
          e.y += (dy / d) * pushStr;
          if (uThorns > 0) { e.hp -= uThorns; e.hitFlash = 2; comboHeal(1); }
        }
      }
    }
  }

  // ── Right-click skill (per player) ──
  if (ps.skillCooldown > 0) ps.skillCooldown--;
  const useSkill = ps.playerIndex === 0 ? mouse.rightClicked : keys['enter'];
  if (useSkill && ps.activeSkill && ps.skillCooldown <= 0 && ps.skillActive <= 0) {
    const skill = ps.activeSkill;
    ps.skillCooldown = skill.cooldown;
    // For P1 use mouse target, for P2 use facing direction
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

  // ── Drone (super rare, per player) ──
  if (ps.droneCount > 0) {
    ps.droneAngle += 0.03;
    if (game.time % 15 === 0) {
      for (let i = 0; i < ps.droneCount; i++) {
        const angle = ps.droneAngle + (i / ps.droneCount) * Math.PI * 2;
        const dx = ps.x + Math.cos(angle) * 40;
        const dy = ps.y + Math.sin(angle) * 40;
        let closest: Enemy | null = null;
        let closestDist = 120 * 120;
        for (const e of enemies) {
          const d = dist2({ x: dx, y: dy }, e);
          if (d < closestDist) { closestDist = d; closest = e; }
        }
        if (closest) {
          const aim = aimDir({ x: dx, y: dy }, closest);
          lasers.push({
            x: dx, y: dy, dx: aim.x * 4, dy: aim.y * 4,
            life: 30, fromPlayer: true,
            damage: Math.max(1, Math.floor(weapon.damage * 0.4)),
            size: 2, pierce: 0, pierceHit: new Set(),
            color: '#44ccff', glowColor: '#88ddff', trailLength: 1,
          });
        }
      }
    }
  }

  // ── Shadow Clone (per player) ──
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
        const baseAim = aimDir(sc, closest);
        const cloneCount = Math.max(1, weapon.count - 1);
        const cloneDmg = Math.max(1, Math.floor(weapon.damage * 0.6));
        const clonePierce = Math.max(0, weapon.pierce - 1);
        for (let ci = 0; ci < cloneCount; ci++) {
          let aim = baseAim;
          if (cloneCount > 1) {
            const spreadAngle = (ci - (cloneCount - 1) / 2) * weapon.spread;
            aim = rotateVec(baseAim, spreadAngle);
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

  // ── Thunder (per player) ──
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

  // ── Poison Trail (per player) ──
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

  // ── Shield Orb (per player) ──
  if (ps.activeSuperRares.includes('shield_orb') && !ps.shieldOrbActive) {
    ps.shieldOrbTimer--;
    if (ps.shieldOrbTimer <= 0) {
      ps.shieldOrbActive = true;
      spawnParticles(ps.x, ps.y, 10, '#44aaff', 2);
    }
  }

  // ── Magnet Pulse (per player) ──
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

  // ── Update blade projectiles (shared) ──
  for (let i = bladeProjs.length - 1; i >= 0; i--) {
    const bp = bladeProjs[i];
    bp.x += bp.dx; bp.y += bp.dy;
    bp.angle += 0.3;
    bp.life--;
    if (bp.life <= 0) { bladeProjs.splice(i, 1); continue; }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (dist2(bp, e) < 18 * 18) {
        e.hp -= 6; e.hitFlash = 6;
      }
    }
  }

  // ── Growing veins ──
  const minutesNow = game.time / (FPS * 60);
  // Spawn new veins over time (1 every ~30s, starting at 1 min, max 8 total)
  if (minutesNow >= 10 && veins.length < 8 && game.time % (30 * FPS) === 0 && veinSpawns.length > 0) {
    // Pick a random spawn point, check it doesn't overlap existing veins
    for (let attempt = 0; attempt < 10; attempt++) {
      const idx = Math.floor(Math.random() * veinSpawns.length);
      const sp = veinSpawns[idx];
      // Check distance from existing veins
      let tooClose = false;
      for (const v of veins) {
        const d = (v.segments[0].x - sp.x) ** 2 + (v.segments[0].y - sp.y) ** 2;
        if (d < 80 * 80) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const maxW = 2 + Math.min(3, minutesNow * 0.3);
      veins.push({
        segments: [{ x: sp.x, y: sp.y }],
        targetLen: 4 + Math.floor(Math.random() * 4), // 4-8 segments max
        growTimer: 0,
        growRate: 60 + Math.floor(Math.random() * 60), // grow a segment every 1-2s
        angle: sp.angle,
        startTime: game.time,
        width: 1,
        maxWidth: maxW,
      });
      veinSpawns.splice(idx, 1); // remove used spawn
      break;
    }
  }
  // Grow existing veins
  for (const v of veins) {
    // Width grows over time
    const age = (game.time - v.startTime) / FPS;
    v.width = Math.min(v.maxWidth, 1 + age * 0.1);
    // Grow new segments
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
    // BULLET HELL — homing: player projectiles curve toward nearest enemy
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
        // Normalize to maintain speed
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
          // Elite reflect — bounce projectile back at player
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
          // Track total damage for nearest player
          const dmgOwner = players.filter(p => !p.dead).reduce((best, p) => dist2(p, e) < dist2(best, e) ? p : best, players[0]);
          dmgOwner.totalDamage += l.damage;

          // Affix effects (use P1 context for shared lasers)
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
      // Player projectiles destroy enemy projectiles
      let intercepted = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        if (j === i) continue;
        const other = lasers[j];
        if (!other.fromPlayer) continue;
        const dx = l.x - other.x, dy = l.y - other.y;
        if (dx * dx + dy * dy < 10 * 10) {
          spawnParticles(l.x, l.y, 4, '#8888ff', 2);
          lasers.splice(Math.max(i, j), 1);
          lasers.splice(Math.min(i, j), 1);
          intercepted = true;
          i -= 2;
          break;
        }
      }
      if (intercepted) continue;

      // REFLECT combo — deflect enemy projectiles back
      if (players.some(p => !p.dead && p.activeCombos.includes('reflect'))) {
        l.dx = -l.dx; l.dy = -l.dy;
        l.fromPlayer = true;
        l.life = 40;
        l.color = '#4488ff'; l.glowColor = '#88aaff';
        spawnParticles(l.x, l.y, 5, '#4488ff', 2);
        continue;
      }
      // Enemy projectile → player collision (check both players)
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

  // Enemy → player collision (check both players)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (const pp of players) {
      if (pp.dead || pp.invincible > 0) continue;
      const ddx = pp.x - e.x, ddy = pp.y - e.y;
      const hitR = e.type === 'superboss' ? 24 : e.type === 'boss' ? 20 : e.type === 'miniboss' ? 16 : e.type === 'tank' ? 16 : 12;
      if (ddx * ddx + ddy * ddy < hitR * hitR) {
        // Shield orb blocks hit
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
        // Thorns
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
    // Emergence animation — skip movement while emerging
    if (e.emergeTimer > 0) { e.emergeTimer--; e.animTimer++; continue; }

    // Slow effect
    if (e.slowTimer > 0) {
      e.slowTimer--;
      e.speed = e.baseSpeed * 0.5;
    } else {
      e.speed = e.baseSpeed;
    }

    // Burn effect
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

    // Find nearest alive player for enemy targeting
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
      updateBoss(e, ddx, ddy, edist);
    } else if (e.type === 'miniboss') {
      updateMiniBoss(e, ddx, ddy, edist);
    } else if (e.type === 'dasher') {
      // Dasher: slow walk, then sudden burst dash toward player
      if (e.dashTimer! > 0) {
        e.dashTimer!--;
        // Slow approach
        if (edist > 4) {
          const nx = ddx / edist * e.speed * 0.5, ny = ddy / edist * e.speed * 0.5;
          e.x += nx; e.y += ny;
        }
      } else if (e.dashTimer! <= 0 && e.dashTimer! > -15) {
        // Dashing! (15 frames of fast movement)
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
        // Reset dash timer
        e.dashTimer = 60 + Math.floor(Math.random() * 40);
      }
    } else if (e.type === 'caster') {
      // Caster: stays at distance (80-120px), retreats if close, shoots projectiles
      const idealDist = 100;
      if (edist < idealDist - 20 && edist > 0) {
        // Too close — retreat
        const nx = -ddx / edist * e.speed * 1.2, ny = -ddy / edist * e.speed * 1.2;
        e.x += nx; e.y += ny;
      } else if (edist > idealDist + 40 && edist > 0) {
        // Too far — approach slowly
        const nx = ddx / edist * e.speed * 0.5, ny = ddy / edist * e.speed * 0.5;
        e.x += nx; e.y += ny;
      }
      // Shoot at player
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
      // Tank: very slow, ignores collisions with other enemies, always walks
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        e.x += nx; e.y += ny; // ignores canMove for enemies, still blocked by walls
      }
    } else if (e.type === 'exploder') {
      // Exploder: rushes fast, explodes on contact (handled in collision)
      if (edist > 4) {
        const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
        e.x += nx; e.y += ny;
      }
      // Pulsing red when close
      if (edist < 30) {
        spawnParticles(e.x, e.y, 1, '#ff2200', 1);
      }
    } else {
      // Scout, brute, swarm, splitter — rush toward player
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

    // Elite affix behaviors
    if (e.elite) {
      if (e.elite === 'fire_trail' && e.animTimer % 10 === 0 && players[0].poisonTrails.length < 80) {
        players[0].poisonTrails.push({ x: e.x, y: e.y, life: 180 });
      }
      if (e.elite === 'teleport') {
        e.teleportTimer!--;
        if (e.teleportTimer! <= 0) {
          e.teleportTimer = 90 + Math.floor(Math.random() * 60);
          // Teleport toward player
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

  // Mini-boss behavior — fast melee rusher
  function updateMiniBoss(e: Enemy, ddx: number, ddy: number, edist: number) {
    if (edist > 4) {
      const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
      if (canMove(e.x, e.y, nx, 0, 6)) e.x += nx;
      if (canMove(e.x, e.y, 0, ny, 6)) e.y += ny;
    }
  }

  // Boss behavior — big tanky melee rusher
  function updateBoss(e: Enemy, ddx: number, ddy: number, edist: number) {
    if (edist > 4) {
      const nx = ddx / edist * e.speed, ny = ddy / edist * e.speed;
      if (canMove(e.x, e.y, nx, 0, 8)) e.x += nx;
      if (canMove(e.x, e.y, 0, ny, 8)) e.y += ny;
    }
  }

  // Continuous spawning (batch)
  const diff = getDifficulty();
  spawnTimer--;
  if (spawnTimer <= 0) {
    for (let b = 0; b < diff.spawnBatch; b++) {
      spawnEnemy();
    }
    spawnTimer = diff.spawnInterval;
  }

  // Mini-boss timer (~30s)
  game.miniBossTimer--;
  if (game.miniBossTimer <= 0) {
    spawnMiniBoss();
    game.miniBossTimer = 30 * FPS;
  }

  // Boss timer (~60s)
  game.bossTimer--;
  if (game.bossTimer <= 0) {
    spawnBoss();
    game.bossTimer = 60 * FPS;
  }

  // ── Danger zones ──
  const dzMinutes = game.time / (FPS * 60);
  if (dzMinutes >= 2) {
    const dzInterval = Math.max(60, 300 - Math.floor(dzMinutes * 20));
    if (game.time % dzInterval === 0) {
      // Spawn near player but not directly on them
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 100;
      const diff = getDifficulty();
      // Target a random alive player
      const dzTarget = players.filter(p => !p.dead);
      const dzP = dzTarget[Math.floor(Math.random() * dzTarget.length)] || players[0];
      dangerZones.push({
        x: dzP.x + Math.cos(angle) * dist,
        y: dzP.y + Math.sin(angle) * dist,
        radius: 25 + Math.random() * 20,
        warnTime: 90, // 1.5s warning
        damage: Math.ceil(diff.contactDmg * 0.8),
        life: 105, // warn + 15 frames explosion visual
      });
    }
  }

  // Update danger zones
  for (let i = dangerZones.length - 1; i >= 0; i--) {
    const dz = dangerZones[i];
    dz.life--;
    dz.warnTime--;
    // Detonate!
    if (dz.warnTime === 0) {
      const isBigMeteor = dz.damage > 10; // combo meteors are high damage
      if (isBigMeteor) {
        // MASSIVE explosion for combo meteor
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
        // Fire ground at impact
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
      // Damage all players
      for (const pp of players) {
        if (!pp.dead && pp.invincible <= 0 && dist2(pp, dz) < dz.radius * dz.radius) {
          pp.hp -= dz.damage;
          pp.invincible = 30;
          pp.damageFlash = 10;
          Sound.hit();
        }
      }
      // Damage enemies too
      for (const e of enemies) {
        if (dist2(e, dz) < dz.radius * dz.radius) {
          e.hp -= Math.ceil(dz.damage * 0.5);
          e.hitFlash = 8;
        }
      }
    }
    if (dz.life <= 0) dangerZones.splice(i, 1);
  }

  // Super boss (once at 2:30)
  if (!game.superBossSpawned) {
    game.superBossTimer--;
    if (game.superBossTimer <= 0) {
      spawnSuperBoss();
    }
  }

  // MEGA BOSS at 10 minutes — the difficulty spike
  const minutesForBoss = game.time / (FPS * 60);
  if (!game.megaBossSpawned && minutesForBoss >= 10) {
    game.megaBossSpawned = true;
    // Spawn a mega boss — 3x super boss HP
    const pos = findSpawnPos();
    if (pos) {
      const diff = getDifficulty();
      const hp = Math.ceil(300 * diff.hpMult);
      enemies.push({
        x: pos.x, y: pos.y, hp, maxHp: hp,
        speed: 0.35 * diff.speedMult, baseSpeed: 0.35 * diff.speedMult,
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

  // Despawn out-of-map enemies (keep far ones alive for horde feel)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const tx = Math.floor(e.x / TILE);
    const ty = Math.floor(e.y / TILE);
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) {
      enemies.splice(i, 1);
    }
  }

  // Update drops (check pickup by nearest alive player)
  for (let i = drops.length - 1; i >= 0; i--) {
    const dr = drops[i];
    dr.age++;
    if (dr.life > 0) dr.life--;
    dr.bobTimer += 0.08;
    if (dr.life === 0) { drops.splice(i, 1); continue; }
    // XP orbs despawn after 30s if far from all players
    if (dr.type === 'xp' && dr.age > 30 * FPS) {
      const anyClose = players.some(p => !p.dead && dist2(p, dr) < 200 * 200);
      if (!anyClose) { drops.splice(i, 1); continue; }
    }

    // Find nearest alive player for magnet/pickup
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

    // Magnet pulse pull
    if ((dr as any)._magnetPull > 0) {
      (dr as any)._magnetPull--;
      const pullForce = 6;
      if (ddist > 5) {
        dr.x += (ddx / ddist) * pullForce;
        dr.y += (ddy / ddist) * pullForce;
      }
    }
    // Normal magnet pull
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
          // Both alive players get a pending level up
          for (const pp of players) { if (!pp.dead) pp.pendingLevelUps++; }
        }
        // Open selection for all players with pending level ups
        if (game.state === 'playing') {
          const anyPending = players.some(pp => !pp.dead && pp.pendingLevelUps > 0);
          if (anyPending) {
            openSelection('levelup');
          }
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
    // Check all players for chest proximity
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
      // Drop bonus XP
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

  // 5 minute death wall
  if (game.time >= GAME_DURATION) {
    for (const pp of players) pp.hp = 0;
  }

  // Per-player HP clamp, second wind, death
  for (const pp of players) {
    if (pp.dead) continue;
    // Clamp HP
    if (!pp.activeCombos.includes('second_life')) {
      pp.hp = Math.min(pp.hp, pp.maxHp);
    } else {
      const slShield = 20 + (pp.upgradeLevels.get('max_hp') || 0) * 5 + pp.weapon.size * 2;
      pp.hp = Math.min(pp.hp, pp.maxHp + slShield);
    }
    // Second wind check
    if (pp.hp <= 0 && pp.activeSuperRares.includes('second_wind') && !pp.secondWindUsed) {
      pp.secondWindUsed = true;
      pp.hp = Math.floor(pp.maxHp * 0.3);
      pp.invincible = 120;
      spawnParticles(pp.x, pp.y, 40, '#ffffff', 5);
      spawnParticles(pp.x, pp.y, 30, '#44ff44', 4);
      pp.damageFlash = 0;
    }
    // Mark player dead
    if (pp.hp <= 0) {
      pp.dead = true;
      pp.deathX = pp.x;
      pp.deathY = pp.y;
      pp.reviveProgress = 0;
      // Death explosion
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

  // Revive system — alive player can revive dead player by standing near their death position
  const REVIVE_RADIUS = 50;
  const REVIVE_SPEED = 0.004; // ~4s to full revive (250 frames)
  const REVIVE_DECAY = 0.002; // decays slower than it fills
  for (const deadP of players) {
    if (!deadP.dead) continue;
    const aliveP = players.find(p => !p.dead);
    if (!aliveP) break;
    const dx = aliveP.x - deadP.deathX, dy = aliveP.y - deadP.deathY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < REVIVE_RADIUS) {
      deadP.reviveProgress = Math.min(1, deadP.reviveProgress + REVIVE_SPEED);
      // Particles while reviving
      if (game.time % 8 === 0) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: deadP.deathX + Math.cos(angle) * 20, y: deadP.deathY + Math.sin(angle) * 20,
          dx: -Math.cos(angle) * 0.5, dy: -Math.sin(angle) * 0.5,
          life: 20, maxLife: 20, color: deadP.visorColor, size: 2,
        });
      }
      if (deadP.reviveProgress >= 1) {
        // Revived!
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

  // Game over only when ALL players dead
  const allDead = players.every(p => p.dead);
  if (allDead) {
    game.state = 'gameover';
    game.deathScreenTimer = 0;
    game.won = game.time >= GAME_DURATION;
    if (game.won) Sound.victory(); else Sound.gameOver();
    Music.stop();

    // Massive death nova — kill all visible enemies (use midpoint)
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

function getCardLayout(halfWidth = false, leftHalf = true) {
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

function getSortedSelectionMapForPlayer(ps: PlayerState): number[] {
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

function updateSelection() {
  if (game.selectionDelay > 0) {
    game.selectionDelay--;
    mouse.clicked = false;
    // Clear all keys to prevent held movement keys from auto-selecting
    if (game.selectionDelay === 0) {
      for (const k in keys) keys[k] = false;
    }
    return;
  }

  const isSplitScreen = !players[0].dead && !players[1].dead
    && (players[0].selectionOptions.length > 0 || players[1].selectionOptions.length > 0);

  if (isSplitScreen) {
    // P1 controls (ZQSD/1-2-3/mouse) — left half
    const p1 = players[0];
    if (!p1.selectionDone && p1.selectionOptions.length > 0) {
      const layout1 = getCardLayout(true, true);
      const sorted1 = getSortedSelectionMapForPlayer(p1);
      // Mouse hover → visual position
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
      // Keyboard: Q/D to navigate with wrap
      if (keys['q'] || keys['a']) { p1.selectionHover = (p1.selectionHover - 1 + n1) % n1; keys['q'] = false; keys['a'] = false; }
      if (keys['d']) { p1.selectionHover = (p1.selectionHover + 1) % n1; keys['d'] = false; }
      // Select: mouse click, space, or 1/2/3
      if (mouse.clicked && mouseVisual1 >= 0) selectOptionForPlayer(0, sorted1[mouseVisual1]);
      if (keys[' ']) { selectOptionForPlayer(0, sorted1[p1.selectionHover]); keys[' '] = false; }
      if (keys['1'] || keys['&']) { if (sorted1[0] !== undefined) selectOptionForPlayer(0, sorted1[0]); keys['1'] = false; keys['&'] = false; }
      if (keys['2'] || keys['é']) { if (sorted1[1] !== undefined) selectOptionForPlayer(0, sorted1[1]); keys['2'] = false; keys['é'] = false; }
      if (keys['3'] || keys['"']) { if (sorted1[2] !== undefined) selectOptionForPlayer(0, sorted1[2]); keys['3'] = false; keys['"'] = false; }
    }

    // P2 controls (arrow keys + enter) — right half
    // selectionHover = VISUAL position (0, 1, 2), not original index
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
    // Single player selection — full screen
    const activePs = players.find(p => !p.selectionDone && p.selectionOptions.length > 0) || players[game.selectingPlayer];
    game.selectingPlayer = activePs.playerIndex;
    const layout = getCardLayout(false, true);
    const sortedMap = getSortedSelectionMapForPlayer(activePs);

    // Mouse hover → visual position
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

    // Keyboard nav with wrap
    if (keys['q'] || keys['a'] || keys['arrowleft']) { game.selectionHover = (game.selectionHover - 1 + nS) % nS; keys['q'] = false; keys['a'] = false; keys['arrowleft'] = false; }
    if (keys['d'] || keys['arrowright']) { game.selectionHover = (game.selectionHover + 1) % nS; keys['d'] = false; keys['arrowright'] = false; }
    // Select
    if (mouse.clicked && mouseVisualS >= 0) selectOption(sortedMap[mouseVisualS]);
    if (keys[' '] || keys['enter']) { selectOption(sortedMap[game.selectionHover]); keys[' '] = false; keys['enter'] = false; }
    if (keys['1'] || keys['&']) { if (sortedMap[0] !== undefined) selectOption(sortedMap[0]); keys['1'] = false; keys['&'] = false; }
    if (keys['2'] || keys['é']) { if (sortedMap[1] !== undefined) selectOption(sortedMap[1]); keys['2'] = false; keys['é'] = false; }
    if (keys['3'] || keys['"']) { if (sortedMap[2] !== undefined) selectOption(sortedMap[2]); keys['3'] = false; keys['"'] = false; }
  }

  mouse.clicked = false;
}

function onEnemyKill(e: Enemy, index: number) {
  const isMiniboss = e.type === 'miniboss';
  const isBoss = e.type === 'boss';
  const isSuperBoss = e.type === 'superboss';

  const deathColor = isSuperBoss ? '#ff44ff' : isBoss ? COL.bossBody : isMiniboss ? COL.minibossBody : COL.enemyBody;
  const deathGlow = isSuperBoss ? '#ffaaff' : isBoss ? COL.bossEye : isMiniboss ? COL.minibossEye : COL.enemyEye;
  spawnParticles(e.x, e.y, isSuperBoss ? 50 : 20, deathColor, isSuperBoss ? 6 : 3);
  spawnParticles(e.x, e.y, isSuperBoss ? 30 : 10, deathGlow, isSuperBoss ? 5 : 2);
  spawnDrops(e.x, e.y, e.type);
  game.kills++;
  // Attribute kill to nearest alive player
  const killer = players.filter(p => !p.dead).reduce((best, p) => dist2(p, e) < dist2(best, e) ? p : best, players[0]);
  killer.kills++;
  if (isSuperBoss || isBoss) {
    Sound.bossKill();
    game.freezeFrame = isSuperBoss ? 12 : 6; // freeze frames
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
    // Damage all players if close
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

function startGameFromTitle() {
  // Apply selected colors
  for (let i = 0; i < 2; i++) {
    playerColors[i] = PLAYER_COLORS[titleState.selectedColors[i]].color;
    players[i].visorColor = playerColors[i];
  }
  // Apply names
  // 1P mode: kill P2 immediately
  if (titleState.playerCount === 1) {
    players[1].dead = true;
  }
  game.state = 'playing';
  game.time = 0;
  if (!audioStarted) { audioStarted = true; Sound.init(); }
  Music.setTrack(0); Music.start(); // Start game music from track 0
}

function updateTitle() {
  // Ash particles
  if (titleState.ashParticles.length < 40 && Math.random() < 0.1) {
    titleState.ashParticles.push({
      x: Math.random() * VIEW_W, y: -5,
      dx: (Math.random() - 0.5) * 0.3, dy: 0.2 + Math.random() * 0.3,
      life: 300 + Math.random() * 200, maxLife: 500,
    });
  }
  for (let i = titleState.ashParticles.length - 1; i >= 0; i--) {
    const p = titleState.ashParticles[i];
    p.x += p.dx; p.y += p.dy; p.life--;
    if (p.life <= 0 || p.y > VIEW_H + 5) titleState.ashParticles.splice(i, 1);
  }

  // Escape = go back
  if (keys['escape']) {
    keys['escape'] = false;
    if (titleState.mode === 2) { titleState.mode = 1; } // color → name
    else if (titleState.mode === 1) {
      if (titleState.editingPlayer === 1) { titleState.editingPlayer = 0; titleState.mode = 2; titleState.cursor = titleState.selectedColors[0]; } // J2 name → J1 color
      else { titleState.mode = 0; titleState.cursor = 0; } // J1 name → mode select
    }
  }

  if (titleState.mode === 0) {
    // Mode select
    if (keys['arrowdown'] || keys['s']) { titleState.cursor = 1; keys['arrowdown'] = false; keys['s'] = false; }
    if (keys['arrowup'] || keys['z']) { titleState.cursor = 0; keys['arrowup'] = false; keys['z'] = false; }
    if (keys['enter'] || keys[' ']) {
      titleState.playerCount = titleState.cursor === 0 ? 1 : 2;
      titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0];
      keys['enter'] = false; keys[' '] = false;
    }
    if (keys['1'] || keys['&']) { titleState.playerCount = 1; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; keys['1'] = false; keys['&'] = false; }
    if (keys['2'] || keys['é']) { titleState.playerCount = 2; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; keys['2'] = false; keys['é'] = false; }

    if (mouse.clicked) {
      const btnW = 160, btnX = VIEW_W / 2 - 80, btnH = 30;
      if (mouse.x >= btnX && mouse.x <= btnX + btnW) {
        if (mouse.y >= 140 && mouse.y <= 170) { titleState.playerCount = 1; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; }
        if (mouse.y >= 180 && mouse.y <= 210) { titleState.playerCount = 2; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; }
      }
      mouse.clicked = false;
    }
  } else if (titleState.mode === 1) {
    // Name input — Enter goes to color select
    // (typing handled in keydown handler)
    if (keys['enter']) {
      keys['enter'] = false;
      playerNames[titleState.editingPlayer] = titleState.nameInput || ('JOUEUR ' + (titleState.editingPlayer + 1));
      titleState.mode = 2;
      titleState.cursor = titleState.selectedColors[titleState.editingPlayer];
    }
  } else if (titleState.mode === 2) {
    // Color select
    if (keys['arrowleft'] || keys['q']) {
      titleState.cursor = (titleState.cursor - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length;
      if (titleState.editingPlayer === 1 && titleState.cursor === titleState.selectedColors[0])
        titleState.cursor = (titleState.cursor - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length;
      keys['arrowleft'] = false; keys['q'] = false;
    }
    if (keys['arrowright'] || keys['d']) {
      titleState.cursor = (titleState.cursor + 1) % PLAYER_COLORS.length;
      if (titleState.editingPlayer === 1 && titleState.cursor === titleState.selectedColors[0])
        titleState.cursor = (titleState.cursor + 1) % PLAYER_COLORS.length;
      keys['arrowright'] = false; keys['d'] = false;
    }
    if (keys['enter'] || keys[' ']) {
      keys['enter'] = false; keys[' '] = false;
      titleState.selectedColors[titleState.editingPlayer] = titleState.cursor;
      if (titleState.editingPlayer === 0 && titleState.playerCount === 2) {
        titleState.editingPlayer = 1;
        titleState.mode = 1;
        titleState.nameInput = playerNames[1];
      } else {
        startGameFromTitle();
      }
    }

    // Mouse click on colors
    if (mouse.clicked) {
      const colSize = 20, colGap = 6;
      const totalColW = PLAYER_COLORS.length * (colSize + colGap) - colGap;
      const colStartX = VIEW_W / 2 - totalColW / 2;
      const colY = 165;
      for (let ci = 0; ci < PLAYER_COLORS.length; ci++) {
        const cx = colStartX + ci * (colSize + colGap);
        if (mouse.x >= cx && mouse.x <= cx + colSize && mouse.y >= colY && mouse.y <= colY + colSize) {
          const isOther = titleState.editingPlayer === 1 && ci === titleState.selectedColors[0];
          if (!isOther) {
            titleState.cursor = ci;
            titleState.selectedColors[titleState.editingPlayer] = ci;
            // Confirm on click
            if (titleState.editingPlayer === 0 && titleState.playerCount === 2) {
              titleState.editingPlayer = 1;
              titleState.mode = 1;
              titleState.nameInput = playerNames[1];
            } else {
              startGameFromTitle();
            }
          }
        }
      }
      mouse.clicked = false;
    }
  }
}

// Pre-generate title screen wall eyes — no overlap
const titleEyes: { cx: number; cy: number; radius: number }[] = [];
for (let attempt = 0; attempt < 200 && titleEyes.length < 18; attempt++) {
  const r = 6 + Math.random() * 12;
  const ex = 30 + Math.random() * (VIEW_W - 60);
  const ey = 20 + Math.random() * (VIEW_H - 40);
  // Check overlap with existing eyes (min distance = sum of radii * 2.5)
  let overlaps = false;
  for (const e of titleEyes) {
    const dx = ex - e.cx, dy = ey - e.cy;
    const minDist = (r + e.radius) * 2.5;
    if (dx * dx + dy * dy < minDist * minDist) { overlaps = true; break; }
  }
  if (!overlaps) titleEyes.push({ cx: ex, cy: ey, radius: r });
}

// Pre-generate brick pattern for title
const titleBricks: { x: number; y: number; w: number; h: number }[] = [];
for (let row = 0; row < VIEW_H / 8; row++) {
  const offset = (row % 2) * 12;
  for (let col = -1; col < VIEW_W / 24 + 1; col++) {
    titleBricks.push({
      x: col * 24 + offset,
      y: row * 8,
      w: 22 + Math.floor(Math.random() * 3),
      h: 7,
    });
  }
}

// Draw a wall eye like on the map — uses fillRect for pixel-perfect look
function drawWallEye(cx: number, cy: number, radius: number, targetX: number, targetY: number, t: number) {
  const r = Math.floor(radius);
  const blinkPhase = Math.sin(t * 0.002 + cx * 0.1 + cy * 0.07);
  const blinkScale = blinkPhase > 0.92 ? 0.1 : blinkPhase > 0.88 ? 0.5 : 1;

  // Almond/pointed eye shape — wider in middle, tapers to points
  const aspect = 2.2; // width/height ratio
  const taper = 0.6; // how pointy the ends are (lower = pointier)

  // Eye border
  for (let dy = -(r + 2); dy <= r + 2; dy++) {
    if (Math.abs(dy) > (r + 2) * blinkScale) continue;
    const t2 = Math.abs(dy) / (r + 2);
    const rowW = Math.floor((r + 2) * aspect * Math.pow(1 - t2 * t2, taper));
    bx.fillStyle = '#1a0e28';
    bx.fillRect(cx - rowW, cy + dy, rowW * 2, 1);
  }

  // Eye socket
  for (let dy = -r; dy <= r; dy++) {
    if (Math.abs(dy) > r * blinkScale) continue;
    const t2 = Math.abs(dy) / r;
    const rowW = Math.floor(r * aspect * Math.pow(1 - t2 * t2, taper));
    bx.fillStyle = '#050308';
    bx.fillRect(cx - rowW, cy + dy, rowW * 2, 1);
  }

  if (blinkScale < 0.3) return;

  // Pupil direction
  const dx = targetX - cx, dy2 = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy2 * dy2);
  const maxOff = r * 0.3;
  const offX = dist > 0 ? (dx / dist) * Math.min(maxOff, dist * 0.08) : 0;
  const offY = dist > 0 ? (dy2 / dist) * Math.min(maxOff, dist * 0.08) : 0;

  // Iris
  const irisR = Math.floor(r * 0.45);
  const ix = Math.floor(cx + offX), iy = Math.floor(cy + offY);
  for (let iyd = -irisR; iyd <= irisR; iyd++) {
    const iw = Math.floor(Math.sqrt(irisR * irisR - iyd * iyd));
    bx.fillStyle = '#220033';
    bx.fillRect(ix - iw, iy + iyd, iw * 2, 1);
  }

  // Pupil (bright red)
  const pupilR = Math.max(2, Math.floor(r * 0.22));
  bx.fillStyle = '#ff2244';
  for (let pyd = -pupilR; pyd <= pupilR; pyd++) {
    const pw = Math.floor(Math.sqrt(pupilR * pupilR - pyd * pyd));
    bx.fillRect(ix - pw, iy + pyd, pw * 2, 1);
  }

  // Glow
  bx.fillStyle = '#ff4466';
  bx.globalAlpha = 0.3;
  for (let gyd = -pupilR - 2; gyd <= pupilR + 2; gyd++) {
    const gw = Math.floor(Math.sqrt((pupilR + 2) * (pupilR + 2) - gyd * gyd));
    bx.fillRect(ix - gw, iy + gyd, gw * 2, 1);
  }
  bx.globalAlpha = 1;

  // Highlight dot
  bx.fillStyle = '#ff8888';
  bx.fillRect(ix - Math.floor(pupilR * 0.4), iy - Math.floor(pupilR * 0.4), 2, 2);
}

function drawButton(label: string, x: number, y: number, w: number, h: number, hovered: boolean, color: string) {
  // Background
  bx.fillStyle = hovered ? '#1a1a33' : '#0a0a18';
  bx.fillRect(x, y, w, h);

  // Border
  const borderCol = hovered ? '#ffffff' : color;
  const bw = hovered ? 2 : 1;
  bx.fillStyle = borderCol;
  bx.fillRect(x, y, w, bw); bx.fillRect(x, y + h - bw, w, bw);
  bx.fillRect(x, y, bw, h); bx.fillRect(x + w - bw, y, bw, h);

  // Glow on hover
  if (hovered) {
    bx.fillStyle = color;
    bx.globalAlpha = 0.1;
    bx.fillRect(x, y, w, h);
    bx.globalAlpha = 1;
  }

  // Text centered
  const tx = x + (w - textWidth(label, 2)) / 2;
  const ty = y + (h - 12) / 2;
  drawText(label, tx, ty, hovered ? '#ffffff' : color, 2);
}

function drawTitle() {
  const t = Date.now();

  // Dark brick wall background
  bx.fillStyle = '#080610';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Brick pattern
  for (const brick of titleBricks) {
    // Use hash for slight color variation
    const h = ((brick.x * 7 + brick.y * 13) & 0xff) / 255;
    const r = Math.floor(8 + h * 6);
    const g = Math.floor(6 + h * 4);
    const b = Math.floor(14 + h * 8);
    bx.fillStyle = `rgb(${r},${g},${b})`;
    bx.fillRect(brick.x, brick.y, brick.w, brick.h);
  }
  // Mortar lines (gaps between bricks are the dark background showing through)

  // Eyes embedded in the wall
  for (const eye of titleEyes) {
    drawWallEye(eye.cx, eye.cy, eye.radius, mouse.x, mouse.y, t);
  }

  // Ash particles
  for (const p of titleState.ashParticles) {
    const alpha = Math.min(1, p.life / 100);
    bx.fillStyle = '#555544';
    bx.globalAlpha = alpha * 0.6;
    bx.fillRect(Math.floor(p.x), Math.floor(p.y), 1 + (p.life > 200 ? 1 : 0), 1);
  }
  bx.globalAlpha = 1;

  // Dark vignette — strong, to focus on center
  const vGrad = bx.createRadialGradient(VIEW_W / 2, 120, 100, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65);
  vGrad.addColorStop(0, 'rgba(2,1,4,0)');
  vGrad.addColorStop(0.6, 'rgba(2,1,4,0.7)');
  vGrad.addColorStop(1, 'rgba(2,1,4,0.92)');
  bx.fillStyle = vGrad;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Title with pulse
  const titlePulse = Math.sin(t * 0.002) * 0.15 + 0.85;
  const title = 'WASTELAND SURVIVORS';
  const titleX = VIEW_W / 2 - textWidth(title, 4) / 2;
  // Glow behind title
  bx.fillStyle = '#aa66ff';
  bx.globalAlpha = titlePulse * 0.08;
  bx.fillRect(titleX - 10, 60, textWidth(title, 4) + 20, 30);
  bx.globalAlpha = 1;
  drawText(title, titleX, 65, '#aa66ff', 4);

  // Subtitle
  const sub = 'SURVIVEZ AUX ABYSSES';
  drawText(sub, VIEW_W / 2 - textWidth(sub, 1) / 2, 100, '#555577', 1);

  // Separator line
  bx.fillStyle = '#221833';
  bx.fillRect(VIEW_W / 2 - 100, 115, 200, 1);

  if (titleState.mode === 0) {
    // Mode selection with proper buttons
    const btnW = 160;
    const btnH = 30;
    const btnX = VIEW_W / 2 - btnW / 2;
    const btn1Y = 140;
    const btn2Y = 180;

    const h1 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= btn1Y && mouse.y <= btn1Y + btnH;
    const h2 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= btn2Y && mouse.y <= btn2Y + btnH;

    // Keyboard cursor syncs with mouse hover
    if (h1) titleState.cursor = 0;
    if (h2) titleState.cursor = 1;

    drawButton('1 JOUEUR', btnX, btn1Y, btnW, btnH, h1 || titleState.cursor === 0, '#aa66ff');
    drawButton('2 JOUEURS', btnX, btn2Y, btnW, btnH, h2 || titleState.cursor === 1, '#44ddff');

    // ">" indicator
    const arrowY = titleState.cursor === 0 ? btn1Y : btn2Y;
    drawText('>', btnX - 16, arrowY + 9, '#ffffff', 2);

    const hint = 'OU APPUYEZ 1 / 2';
    drawText(hint, VIEW_W / 2 - textWidth(hint, 1) / 2, 225, '#333355', 1);

  } else if (titleState.mode === 1) {
    // Name input screen
    const pNum = titleState.editingPlayer + 1;
    const label = titleState.playerCount === 2 ? 'JOUEUR ' + pNum : 'VOTRE NOM';
    drawText(label, VIEW_W / 2 - textWidth(label, 2) / 2, 140, '#8888aa', 2);

    const boxW = 200, boxH = 28, boxX = VIEW_W / 2 - boxW / 2, boxY = 170;
    bx.fillStyle = '#111122';
    bx.fillRect(boxX, boxY, boxW, boxH);
    bx.fillStyle = '#666688';
    bx.fillRect(boxX, boxY, boxW, 1); bx.fillRect(boxX, boxY + boxH, boxW, 1);
    bx.fillRect(boxX, boxY, 1, boxH); bx.fillRect(boxX + boxW, boxY, 1, boxH);

    const cur = Math.floor(t / 500) % 2 === 0 ? '_' : '';
    const nameDisp = titleState.nameInput + cur;
    drawText(nameDisp, boxX + (boxW - textWidth(nameDisp, 2)) / 2, boxY + 8, '#ffffff', 2);

  } else if (titleState.mode === 2) {
    // Color selection screen
    const pName = playerNames[titleState.editingPlayer];
    const label = 'COULEUR DE ' + pName;
    drawText(label, VIEW_W / 2 - textWidth(label, 2) / 2, 135, '#8888aa', 2);

    const colSize = 20, colGap = 6;
    const totalColW = PLAYER_COLORS.length * (colSize + colGap) - colGap;
    const colStartX = VIEW_W / 2 - totalColW / 2;
    const colY = 165;

    for (let ci = 0; ci < PLAYER_COLORS.length; ci++) {
      const cx = colStartX + ci * (colSize + colGap);
      const isSelected = titleState.cursor === ci;
      const isOther = titleState.editingPlayer === 1 && titleState.selectedColors[0] === ci;
      const isHovered = mouse.x >= cx && mouse.x <= cx + colSize && mouse.y >= colY && mouse.y <= colY + colSize;

      bx.fillStyle = isOther ? '#222233' : PLAYER_COLORS[ci].color;
      bx.fillRect(cx, colY, colSize, colSize);

      if (isSelected) {
        bx.fillStyle = '#ffffff';
        bx.fillRect(cx - 2, colY - 2, colSize + 4, 2);
        bx.fillRect(cx - 2, colY + colSize, colSize + 4, 2);
        bx.fillRect(cx - 2, colY - 2, 2, colSize + 4);
        bx.fillRect(cx + colSize, colY - 2, 2, colSize + 4);
      } else if (isHovered && !isOther) {
        bx.fillStyle = '#888888';
        bx.fillRect(cx - 1, colY - 1, colSize + 2, 1);
        bx.fillRect(cx - 1, colY + colSize, colSize + 2, 1);
        bx.fillRect(cx - 1, colY - 1, 1, colSize + 2);
        bx.fillRect(cx + colSize, colY - 1, 1, colSize + 2);
      }

      if (isOther) drawText('X', cx + colSize / 2 - 5, colY + colSize / 2 - 6, '#666666', 1);
    }

    const cName = PLAYER_COLORS[titleState.cursor].name;
    drawText(cName, VIEW_W / 2 - textWidth(cName, 2) / 2, colY + colSize + 10, PLAYER_COLORS[titleState.cursor].color, 2);
  }

  // Version
  const ver = 'V0.3';
  drawText(ver, VIEW_W - textWidth(ver, 1) - 4, VIEW_H - 10, '#222233', 1);
}

function resetGame() {
  Music.setTrack(5); // ABYSS for title screen
  Music.start();
  game.time = 0;
  game.state = 'title';
  titleState.mode = 0;
  titleState.editingPlayer = 0;
  titleState.nameInput = '';
  game.kills = 0;
  game.deathScreenTimer = 0;
  game.won = false;
  game.miniBossTimer = 30 * FPS;
  game.bossTimer = 60 * FPS;
  game.miniBossCount = 0;
  game.bossCount = 0;
  game.superBossSpawned = false;
  game.megaBossSpawned = false;
  game.superBossTimer = Math.floor(2.5 * 60 * FPS);
  game.codexOpen = false;
  game.xp = 0;
  game.xpToLevel = 10;
  game.level = 1;
  game.selectionOptions = [];
  game.selectingPlayer = 0;
  game.freezeFrame = 0;
  game.freezeZoom = 0;
  game.lightningTimer = 300 + Math.floor(Math.random() * 300);
  game.lightningFlash = 0;
  game.shakeTimer = 0;

  // Reset both players
  for (let i = 0; i < 2; i++) {
    players[i] = createPlayer(i);
  }
  player = players[0];
  weapon = players[0].weapon;
  enemies.length = 0;
  lasers.length = 0;
  particles.length = 0;
  drops.length = 0;
  chests.length = 0;
  chainArcs.length = 0;
  dangerZones.length = 0;
  shockRings.length = 0;
  fallingMeteors.length = 0;
  bladeProjs.length = 0;
  dmgNumbers.length = 0;
  beamLines.length = 0;
  veins.length = 0; // veins will regrow during new game
  spawnTimer = 60;
}

// ── RENDER ──
function drawTile(x: number, y: number, tile: number, wx = 0, wy = 0) {
  const h = (wx * 7 + wy * 13) & 0xff; // hash based on WORLD coords, stable
  switch (tile) {
    case 0: // Void floor — clean
      bx.fillStyle = COL.sand1;
      bx.fillRect(x, y, TILE, TILE);
      // Subtle texture dots
      if (h & 1) { bx.fillStyle = '#0e0c18'; bx.fillRect(x + (h & 7) + 2, y + 6, 1, 1); }
      break;
    case 1: // Dark stone — slightly lighter with texture
      bx.fillStyle = COL.sand2;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = '#18142a';
      if (h & 2) bx.fillRect(x + 4, y + 8, 3, 1);
      if (h & 8) bx.fillRect(x + 10, y + 4, 1, 3);
      break;
    case 2: // Rough ground — slightly lighter than void, clearly walkable
      bx.fillStyle = '#0f0d1a';
      bx.fillRect(x, y, TILE, TILE);
      // Scattered pebbles/texture
      bx.fillStyle = '#14121f';
      if (h & 1) bx.fillRect(x + 3, y + 5, 2, 2);
      if (h & 2) bx.fillRect(x + 9, y + 10, 3, 1);
      if (h & 4) bx.fillRect(x + 7, y + 3, 1, 2);
      break;
    case 3: // Void wall — impenetrable darkness
      bx.fillStyle = COL.darkRock;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = COL.shadow;
      bx.fillRect(x, y + 12, TILE, 4);
      // Faint eldritch glow in the cracks
      bx.fillStyle = '#1a0830';
      bx.fillRect(x + 3, y + 3, 2, 2);
      bx.fillRect(x + 9, y + 7, 3, 2);
      break;
    case 4: // Bone spire (was cactus) — pale bone jutting from void
      bx.fillStyle = COL.sand1;
      bx.fillRect(x, y, TILE, TILE);
      bx.fillStyle = '#2a2238';
      bx.fillRect(x + 6, y + 3, 4, 11);
      bx.fillRect(x + 4, y + 6, 2, 4);
      bx.fillRect(x + 10, y + 8, 2, 3);
      bx.fillStyle = '#3a2848';
      bx.fillRect(x + 7, y + 3, 2, 2); // tip glow
      break;
  }
}

function drawPlayer(sx: number, sy: number) {
  const flash = player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 0;
  if (flash) return;
  const px = Math.floor(sx), py = Math.floor(sy);

  // Subtle aura glow
  bx.fillStyle = COL.playerVisor;
  bx.globalAlpha = 0.08 + Math.sin(game.time * 0.05) * 0.04;
  bx.fillRect(px - 8, py - 10, 16, 18);
  bx.globalAlpha = 1;

  // Cape/cloak — dark flowing
  if (player.dir === 'down' || player.dir === 'left' || player.dir === 'right') {
    bx.fillStyle = COL.playerCape;
    const capeWave = Math.sin(game.time * 0.08) * 1;
    bx.fillRect(px - 4, py - 2, 8, 10 + capeWave);
  }
  // Body armor
  bx.fillStyle = COL.playerArmor;
  bx.fillRect(px - 4, py - 5, 8, 10);
  // Head
  bx.fillStyle = '#2a2840';
  bx.fillRect(px - 3, py - 8, 6, 5);
  // Glowing visor — the only bright thing
  bx.fillStyle = COL.playerVisor;
  switch (player.dir) {
    case 'down':
      bx.fillRect(px - 2, py - 7, 4, 1);
      bx.fillRect(px, py - 6, 1, 2);
      break;
    case 'up':
      bx.fillRect(px - 2, py - 7, 4, 1);
      break;
    case 'left':
      bx.fillRect(px - 3, py - 7, 3, 1);
      bx.fillRect(px - 3, py - 6, 1, 2);
      break;
    case 'right':
      bx.fillRect(px, py - 7, 3, 1);
      bx.fillRect(px + 2, py - 6, 1, 2);
      break;
  }
  // Legs
  const legOffset = player.moving ? Math.sin(player.animTimer * 0.5) * 2 : 0;
  bx.fillStyle = '#22203a';
  bx.fillRect(px - 3, py + 5, 2, 3 + legOffset);
  bx.fillRect(px + 1, py + 5, 2, 3 - legOffset);
}

function drawPlayerCoOp(ps: PlayerState, sx: number, sy: number) {
  const flash = ps.invincible > 0 && Math.floor(ps.invincible / 3) % 2 === 0;
  if (flash) return;
  const px = Math.floor(sx), py = Math.floor(sy);

  // Subtle aura glow
  bx.fillStyle = ps.visorColor;
  bx.globalAlpha = 0.08 + Math.sin(game.time * 0.05) * 0.04;
  bx.fillRect(px - 8, py - 10, 16, 18);
  bx.globalAlpha = 1;

  // Cape/cloak
  if (ps.dir === 'down' || ps.dir === 'left' || ps.dir === 'right') {
    bx.fillStyle = ps.playerIndex === 0 ? COL.playerCape : '#1a3040';
    const capeWave = Math.sin(game.time * 0.08) * 1;
    bx.fillRect(px - 4, py - 2, 8, 10 + capeWave);
  }
  // Body armor
  bx.fillStyle = ps.playerIndex === 0 ? COL.playerArmor : '#4a5a6a';
  bx.fillRect(px - 4, py - 5, 8, 10);
  // Head
  bx.fillStyle = ps.playerIndex === 0 ? '#2a2840' : '#2a3840';
  bx.fillRect(px - 3, py - 8, 6, 5);
  // Glowing visor
  bx.fillStyle = ps.visorColor;
  switch (ps.dir) {
    case 'down':
      bx.fillRect(px - 2, py - 7, 4, 1);
      bx.fillRect(px, py - 6, 1, 2);
      break;
    case 'up':
      bx.fillRect(px - 2, py - 7, 4, 1);
      break;
    case 'left':
      bx.fillRect(px - 3, py - 7, 3, 1);
      bx.fillRect(px - 3, py - 6, 1, 2);
      break;
    case 'right':
      bx.fillRect(px, py - 7, 3, 1);
      bx.fillRect(px + 2, py - 6, 1, 2);
      break;
  }
  // P2 indicator
  if (ps.playerIndex === 1) {
    bx.fillStyle = ps.visorColor;
    bx.fillRect(px - 1, py - 11, 2, 1);
  }
  // Legs
  const legOffset = ps.moving ? Math.sin(ps.animTimer * 0.5) * 2 : 0;
  bx.fillStyle = ps.playerIndex === 0 ? '#22203a' : '#203040';
  bx.fillRect(px - 3, py + 5, 2, 3 + legOffset);
  bx.fillRect(px + 1, py + 5, 2, 3 - legOffset);
}

function drawEnemy(e: Enemy, sx: number, sy: number) {
  const px = Math.floor(sx), py = Math.floor(sy);

  // Emergence animation — dark fissure opening
  if (e.emergeTimer > 0) {
    const progress = 1 - e.emergeTimer / 30; // 0→1
    const fissureW = 6 + progress * 8;
    const fissureH = 2 + progress * 4;
    // Dark crack
    bx.fillStyle = '#000000';
    bx.fillRect(px - fissureW / 2, py - fissureH / 2, fissureW, fissureH);
    // Purple glow from inside
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#441166';
    bx.globalAlpha = progress * 0.5;
    bx.fillRect(px - fissureW / 2 + 1, py - fissureH / 2, fissureW - 2, fissureH);
    // Rising tendrils
    if (progress > 0.5) {
      bx.fillStyle = '#220044';
      bx.globalAlpha = (progress - 0.5) * 0.6;
      bx.fillRect(px - 1, py - fissureH - progress * 6, 2, progress * 6);
    }
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    return;
  }

  if (e.type === 'superboss') { drawSuperBoss(e, px, py); return; }
  if (e.type === 'boss') { drawBoss(e, px, py); return; }
  if (e.type === 'miniboss') { drawMiniBoss(e, px, py); return; }

  // Elite glow aura
  if (e.elite) {
    const eliteColors: Record<EliteAffix, string> = {
      fire_trail: '#ff4400', teleport: '#8844cc', reflect: '#4488ff', haste: '#44ff44', regen: '#44ffaa',
    };
    const ec = eliteColors[e.elite];
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = ec;
    bx.globalAlpha = 0.15 + Math.sin(e.animTimer * 0.08) * 0.1;
    const gs = e.type === 'tank' ? 14 : e.type === 'brute' ? 12 : 10;
    bx.fillRect(px - gs, py - gs, gs * 2, gs * 2);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
  }

  const frozen = e.slowTimer > 0;
  const flash = e.hitFlash > 0;

  // Type-specific rendering — dark abyss creatures
  if (e.type === 'dasher') {
    // Dasher: shadowy wraith, glowing red eyes, speed lines
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#3a1828';
    bx.fillRect(px - 6, py - 5, 12, 10);
    bx.fillRect(px - 3, py - 8, 6, 3);
    // Glowing crimson eyes
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2244';
    bx.fillRect(px - 3, py - 2, 2, 3);
    bx.fillRect(px + 1, py - 2, 2, 3);
    bx.globalCompositeOperation = 'source-over';
    if (e.dashTimer! <= 0 && e.dashTimer! > -15) {
      bx.globalCompositeOperation = 'lighter';
      bx.fillStyle = '#ff2244';
      bx.globalAlpha = 0.5;
      bx.fillRect(px - 10, py - 1, 4, 1);
      bx.fillRect(px + 6, py, 4, 1);
      bx.globalAlpha = 1;
      bx.globalCompositeOperation = 'source-over';
    }
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 4, sz * 2, 2);
      bx.fillStyle = '#cc2244'; bx.fillRect(px - sz, py - sz - 4, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  if (e.type === 'splitter') {
    // Splitter: unstable dark mass with twin souls
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#1e3038';
    bx.fillRect(px - 7, py - 6, 14, 12);
    bx.fillStyle = flash ? '#ffffff' : '#223840';
    bx.fillRect(px - 5, py - 4, 10, 8);
    bx.fillStyle = '#060810';
    bx.fillRect(px, py - 6, 1, 12);
    // Twin glowing eyes
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#44ffaa';
    bx.fillRect(px - 4, py - 3, 2, 2);
    bx.fillRect(px + 2, py - 3, 2, 2);
    bx.globalCompositeOperation = 'source-over';
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 3, sz * 2, 2);
      bx.fillStyle = '#44aa88'; bx.fillRect(px - sz, py - sz - 3, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  if (e.type === 'tank') {
    // Tank: massive dark golem, armored, glowing red core
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#282238';
    bx.fillRect(px - 10, py - 10, 20, 20);
    bx.fillStyle = flash ? '#ffffff' : '#342848';
    bx.fillRect(px - 7, py - 7, 14, 14);
    bx.fillStyle = '#201830';
    bx.fillRect(px - 9, py - 10, 18, 3);
    // Glowing core
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2244';
    bx.fillRect(px - 4, py - 3, 3, 3);
    bx.fillRect(px + 1, py - 3, 3, 3);
    bx.fillStyle = '#ff0022';
    bx.globalAlpha = 0.3;
    bx.fillRect(px - 3, py - 1, 6, 4);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    bx.fillStyle = COL.hpBg; bx.fillRect(px - 8, py - 11, 16, 2);
    bx.fillStyle = '#882244'; bx.fillRect(px - 8, py - 11, (Math.max(0, e.hp) / e.maxHp) * 16, 2);
    return;
  }

  if (e.type === 'swarm') {
    // Swarm: tiny void insects with single glowing eye
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#221828';
    bx.fillRect(px - 3, py - 3, 6, 6);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff4488';
    bx.fillRect(px - 1, py - 1, 2, 2);
    bx.globalCompositeOperation = 'source-over';
    return;
  }

  if (e.type === 'caster') {
    // Caster: floating dark mage with glowing rune eye
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#201030';
    bx.fillRect(px - 6, py - 7, 12, 14);
    bx.fillStyle = flash ? '#ffffff' : '#2a1840';
    bx.fillRect(px - 7, py - 10, 14, 5);
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff2266';
    const eyePulse = Math.sin(e.animTimer * 0.1) > 0 ? 1 : 0;
    bx.fillRect(px - 2, py - 5, 3 + eyePulse, 3);
    bx.fillStyle = '#440022';
    bx.globalAlpha = 0.3;
    bx.fillRect(px - 4, py + 7, 8, 3);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    const szC = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - szC, py - szC - 5, szC * 2, 2);
      bx.fillStyle = '#ff2266'; bx.fillRect(px - szC, py - szC - 5, (Math.max(0, e.hp) / e.maxHp) * szC * 2, 2);
    }
    return;
  }

  if (e.type === 'exploder') {
    // Exploder: volatile void orb, pulsing with unstable energy
    const pulse = Math.sin(e.animTimer * 0.15) * 2;
    bx.fillStyle = flash ? '#ffffff' : frozen ? '#445566' : '#301418';
    bx.fillRect(px - 6 - pulse, py - 6 - pulse, 12 + pulse * 2, 12 + pulse * 2);
    // Glowing unstable core
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 3, py - 3, 6, 6);
    if (e.animTimer % 8 < 4) {
      bx.fillStyle = '#ffaa44';
      bx.globalAlpha = 0.6;
      bx.fillRect(px - 6 - pulse, py - 6 - pulse, 12 + pulse * 2, 12 + pulse * 2);
      bx.globalAlpha = 1;
    }
    bx.globalCompositeOperation = 'source-over';
    const sz = 5;
    if (e.hp < e.maxHp) {
      bx.fillStyle = COL.hpBg; bx.fillRect(px - sz, py - sz - 3, sz * 2, 2);
      bx.fillStyle = '#ff4400'; bx.fillRect(px - sz, py - sz - 3, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
    }
    return;
  }

  // Default: scout / brute — visible dark creatures with bright glowing eyes
  if (flash) bx.fillStyle = '#ffffff';
  else if (frozen) bx.fillStyle = '#445566';
  else bx.fillStyle = e.type === 'brute' ? '#331828' : '#2a1424';

  const sz = e.type === 'brute' ? 8 : 6;
  bx.fillRect(px - sz, py - sz, sz * 2, sz * 2);

  // Glowing eyes
  bx.globalCompositeOperation = 'lighter';
  bx.fillStyle = flash ? '#ffffff' : COL.enemyEye;
  if (e.type === 'brute') {
    bx.fillRect(px - 3, py - 3, 2, 2);
    bx.fillRect(px + 1, py - 3, 2, 2);
  } else {
    bx.fillRect(px - 1, py - 2, 3, 2);
  }
  bx.globalCompositeOperation = 'source-over';

  // Burn indicator
  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 1, py - sz - 3, 2, 2);
  }

  if (e.hp < e.maxHp) {
    bx.fillStyle = COL.hpBg;
    bx.fillRect(px - sz, py - sz - 4, sz * 2, 2);
    bx.fillStyle = COL.hpBar;
    bx.fillRect(px - sz, py - sz - 4, (Math.max(0, e.hp) / e.maxHp) * sz * 2, 2);
  }
}

function drawMiniBoss(e: Enemy, px: number, py: number) {
  const frozen = e.slowTimer > 0;
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : COL.minibossBody;
  bx.fillRect(px - 8, py - 8, 16, 16);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#553377';
  bx.fillRect(px - 6, py - 6, 12, 12);

  // Eyes (2 glowing)
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : COL.minibossEye;
  bx.fillRect(px - 4, py - 3, 3, 3);
  bx.fillRect(px + 1, py - 3, 3, 3);

  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 11, 3, 2);
  }

  // HP bar
  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 12, py - 14, 24, 3);
  bx.fillStyle = '#aa66ff';
  bx.fillRect(px - 12, py - 14, (Math.max(0, e.hp) / e.maxHp) * 24, 3);
  bx.fillStyle = '#cc88ff';
  bx.fillRect(px - 12, py - 14, (Math.max(0, e.hp) / e.maxHp) * 24, 1);
}

function drawBoss(e: Enemy, px: number, py: number) {
  const pulse = Math.sin(e.animTimer * 0.05) * 2;
  const frozen = e.slowTimer > 0;

  bx.fillStyle = 'rgba(0,0,0,0.3)';
  bx.fillRect(px - 12, py + 10, 24, 4);

  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : COL.bossBody;
  bx.fillRect(px - 10 - pulse, py - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#aa6622';
  bx.fillRect(px - 7, py - 7, 14, 14);

  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : COL.bossEye;
  bx.fillRect(px - 5, py - 4, 3, 3);
  bx.fillRect(px + 2, py - 4, 3, 3);
  bx.fillRect(px - 1, py + 1, 3, 3);

  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 15, 3, 3);
  }

  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 16, py - 18, 32, 3);
  bx.fillStyle = '#ff8800';
  bx.fillRect(px - 16, py - 18, (Math.max(0, e.hp) / e.maxHp) * 32, 3);
  bx.fillStyle = '#ffaa44';
  bx.fillRect(px - 16, py - 18, (Math.max(0, e.hp) / e.maxHp) * 32, 1);
}

function drawSuperBoss(e: Enemy, px: number, py: number) {
  const pulse = Math.sin(e.animTimer * 0.03) * 3;
  const frozen = e.slowTimer > 0;

  // Shadow
  bx.fillStyle = 'rgba(0,0,0,0.4)';
  bx.fillRect(px - 16, py + 14, 32, 5);

  // Glow aura
  bx.fillStyle = '#ff44ff';
  bx.globalAlpha = 0.15 + Math.sin(e.animTimer * 0.08) * 0.1;
  bx.fillRect(px - 18 - pulse, py - 18 - pulse, 36 + pulse * 2, 36 + pulse * 2);
  bx.globalAlpha = 1;

  // Body
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : frozen ? '#6688aa' : '#881188';
  bx.fillRect(px - 14 - pulse, py - 14 - pulse, 28 + pulse * 2, 28 + pulse * 2);
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#aa44aa';
  bx.fillRect(px - 10, py - 10, 20, 20);

  // Eyes (3, menacing)
  bx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#ff44ff';
  bx.fillRect(px - 7, py - 6, 4, 4);
  bx.fillRect(px + 3, py - 6, 4, 4);
  bx.fillRect(px - 2, py + 2, 4, 4);

  // Crown spikes
  bx.fillStyle = '#ffaa44';
  bx.fillRect(px - 8, py - 16, 3, 4);
  bx.fillRect(px - 1, py - 18, 3, 4);
  bx.fillRect(px + 6, py - 16, 3, 4);

  if (e.burnTimer > 0 && e.animTimer % 10 < 5) {
    bx.fillStyle = '#ff4400';
    bx.fillRect(px - 2, py - 21, 4, 3);
  }

  // HP bar (wider)
  bx.fillStyle = COL.hpBg;
  bx.fillRect(px - 22, py - 24, 44, 4);
  bx.fillStyle = '#ff44ff';
  bx.fillRect(px - 22, py - 24, (Math.max(0, e.hp) / e.maxHp) * 44, 4);
  bx.fillStyle = '#ff88ff';
  bx.fillRect(px - 22, py - 24, (Math.max(0, e.hp) / e.maxHp) * 44, 1);
}

function drawDrop(dr: Drop, sx: number, sy: number) {
  const bob = Math.sin(dr.bobTimer) * 3;
  const px = Math.floor(sx), py = Math.floor(sy + bob);
  const fade = dr.life > 0 && dr.life < 60 ? dr.life / 60 : 1;
  bx.globalAlpha = fade;

  if (dr.type === 'xp') {
    // Bigger XP orb (diamond shape ~6px)
    bx.fillStyle = COL.xpOrbGlow;
    bx.fillRect(px - 1, py - 3, 3, 7);
    bx.fillRect(px - 3, py - 1, 7, 3);
    bx.fillStyle = COL.xpOrb;
    bx.fillRect(px - 1, py - 1, 3, 3);
  } else {
    // Bigger heart (~8px)
    bx.fillStyle = COL.heartDrop;
    bx.fillRect(px - 3, py - 2, 3, 3);
    bx.fillRect(px + 1, py - 2, 3, 3);
    bx.fillRect(px - 3, py + 1, 7, 3);
    bx.fillRect(px - 2, py + 4, 5, 2);
    bx.fillRect(px - 1, py + 6, 3, 1);
    bx.fillStyle = '#ff88aa';
    bx.fillRect(px - 2, py - 1, 2, 2);
  }
  bx.globalAlpha = 1;
}

function drawChest(ch: Chest, sx: number, sy: number) {
  const px = Math.floor(sx), py = Math.floor(sy);
  const isRare = ch.rarity === 'rare';

  if (ch.opened) {
    bx.fillStyle = '#996622';
    bx.fillRect(px - 10, py - 2, 20, 12);
    bx.fillStyle = isRare ? COL.chestRare : COL.chestBody;
    bx.fillRect(px - 11, py - 8, 22, 7);
    bx.fillStyle = isRare ? COL.chestRareGlow : COL.chestLock;
    bx.globalAlpha = ch.openTimer / 60;
    bx.fillRect(px - 5, py + 1, 10, 6);
    bx.globalAlpha = 1;
  } else {
    const bob = Math.sin(game.time * 0.05) * 2;
    const cy = py + bob;

    // Glow aura behind chest
    const glowPulse = Math.sin(game.time * 0.06) * 0.3 + 0.5;
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = isRare ? '#ff44aa' : '#8866cc';
    bx.globalAlpha = glowPulse * 0.25;
    bx.beginPath();
    bx.arc(px, cy, 18 + glowPulse * 6, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';

    // Body (bigger)
    bx.fillStyle = isRare ? COL.chestRare : COL.chestBody;
    bx.fillRect(px - 12, cy - 6, 24, 14);
    // Lid
    bx.fillStyle = isRare ? '#cc6622' : '#aa7722';
    bx.fillRect(px - 13, cy - 10, 26, 6);
    // Lock (shiny)
    const lockPulse = Math.sin(game.time * 0.1) * 0.5 + 0.5;
    bx.fillStyle = isRare ? COL.chestRareGlow : COL.chestLock;
    bx.fillRect(px - 3, cy - 4, 6, 6);
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = lockPulse * 0.6;
    bx.fillRect(px - 1, cy - 2, 2, 2);
    bx.globalAlpha = 1;

    // Multiple sparkles
    const sparklePhase = game.time * 0.15;
    const sparkles = [
      { ox: 9, oy: -9 }, { ox: -10, oy: -8 }, { ox: 7, oy: 4 }, { ox: -8, oy: 3 },
    ];
    for (let si = 0; si < sparkles.length; si++) {
      const sp = sparkles[si];
      const sAlpha = Math.sin(sparklePhase + si * 1.7) * 0.5 + 0.5;
      if (sAlpha > 0.3) {
        bx.fillStyle = isRare ? '#ffcc44' : '#ffffff';
        bx.globalAlpha = sAlpha;
        bx.fillRect(px + sp.ox, cy + sp.oy, 2, 2);
      }
    }
    bx.globalAlpha = 1;
  }
}

// ── Pixel font (4x6 glyphs, crisp at any scale) ──
// Each glyph is 4 columns wide, 6 rows tall, encoded as 6 nibbles
const PX: Record<string, number[]> = {
  'A':[0x6,0x9,0x9,0xf,0x9,0x9],'B':[0xe,0x9,0xe,0x9,0x9,0xe],'C':[0x6,0x9,0x8,0x8,0x9,0x6],
  'D':[0xe,0x9,0x9,0x9,0x9,0xe],'E':[0xf,0x8,0xe,0x8,0x8,0xf],'F':[0xf,0x8,0xe,0x8,0x8,0x8],
  'G':[0x6,0x9,0x8,0xb,0x9,0x6],'H':[0x9,0x9,0xf,0x9,0x9,0x9],'I':[0xe,0x4,0x4,0x4,0x4,0xe],
  'J':[0x7,0x2,0x2,0x2,0xa,0x4],'K':[0x9,0xa,0xc,0xa,0x9,0x9],'L':[0x8,0x8,0x8,0x8,0x8,0xf],
  'M':[0x9,0xf,0xf,0x9,0x9,0x9],'N':[0x9,0xd,0xf,0xb,0x9,0x9],'O':[0x6,0x9,0x9,0x9,0x9,0x6],
  'P':[0xe,0x9,0x9,0xe,0x8,0x8],'Q':[0x6,0x9,0x9,0x9,0xb,0x7],'R':[0xe,0x9,0x9,0xe,0xa,0x9],
  'S':[0x7,0x8,0x6,0x1,0x1,0xe],'T':[0xf,0x4,0x4,0x4,0x4,0x4],'U':[0x9,0x9,0x9,0x9,0x9,0x6],
  'V':[0x9,0x9,0x9,0x9,0x6,0x6],'W':[0x9,0x9,0x9,0xf,0xf,0x9],'X':[0x9,0x9,0x6,0x6,0x9,0x9],
  'Y':[0x9,0x9,0x6,0x4,0x4,0x4],'Z':[0xf,0x1,0x2,0x4,0x8,0xf],
  '0':[0x6,0x9,0xb,0xd,0x9,0x6],'1':[0x4,0xc,0x4,0x4,0x4,0xe],'2':[0x6,0x9,0x1,0x6,0x8,0xf],
  '3':[0xe,0x1,0x6,0x1,0x1,0xe],'4':[0x9,0x9,0xf,0x1,0x1,0x1],'5':[0xf,0x8,0xe,0x1,0x1,0xe],
  '6':[0x6,0x8,0xe,0x9,0x9,0x6],'7':[0xf,0x1,0x2,0x4,0x4,0x4],'8':[0x6,0x9,0x6,0x9,0x9,0x6],
  '9':[0x6,0x9,0x7,0x1,0x1,0x6],
  ':':[0x0,0x4,0x0,0x0,0x4,0x0],' ':[0x0,0x0,0x0,0x0,0x0,0x0],'-':[0x0,0x0,0xf,0x0,0x0,0x0],
  '+':[0x0,0x4,0xe,0x4,0x0,0x0],'/':[0x1,0x1,0x2,0x4,0x8,0x8],'.':[0x0,0x0,0x0,0x0,0x0,0x4],
  '>':[0x4,0x2,0x1,0x2,0x4,0x0],'[':[0x6,0x4,0x4,0x4,0x4,0x6],']':[0x6,0x2,0x2,0x2,0x2,0x6],
  '!':[0x4,0x4,0x4,0x4,0x0,0x4],'%':[0x9,0x1,0x2,0x4,0x8,0x9],
  '\'':[0x4,0x4,0x0,0x0,0x0,0x0],
  '\xC9':[0x2,0xf,0x8,0xe,0x8,0xf], // É
  '\xC8':[0x4,0xf,0x8,0xe,0x8,0xf], // È
  '\xCA':[0x6,0xf,0x8,0xe,0x8,0xf], // Ê
  '\xC0':[0x4,0x6,0x9,0xf,0x9,0x9], // À
  '\xD9':[0x4,0x9,0x9,0x9,0x9,0x6], // Ù
  '\xC7':[0x6,0x9,0x8,0x8,0x9,0x7], // Ç
};

// scale=1 → 1px per pixel (tiny HUD), scale=2 → 2px (normal), scale=3 → 3px (big titles)
function drawText(text: string, x: number, y: number, color: string, scale = 2) {
  bx.fillStyle = color;
  let cx = Math.round(x);
  const py = Math.round(y);
  for (const ch of text.toUpperCase()) {
    const glyph = PX[ch];
    if (glyph) {
      for (let row = 0; row < 6; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 4; col++) {
          if (bits & (1 << (3 - col))) {
            bx.fillRect(cx + col * scale, py + row * scale, scale, scale);
          }
        }
      }
    }
    cx += 5 * scale;
  }
}

function textWidth(text: string, scale = 2): number {
  return text.length * 5 * scale;
}

function drawIcon(icon: number[][], x: number, y: number, color: string) {
  bx.fillStyle = color;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (icon[row] && icon[row][col]) {
        bx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}

function formatTime(frames: number): string {
  const totalSec = Math.floor(frames / FPS);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
}

function render() {
  // Cursor: show on title/selection, hide during gameplay
  canvas.style.cursor = (game.state === 'title' || game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare') ? 'default' : 'none';

  // Title screen
  if (game.state === 'title') {
    drawTitle();
    // Blit to main canvas
    ctx.drawImage(buf, 0, 0, VIEW_W * SCALE, VIEW_H * SCALE);
    return;
  }

  // Camera shake
  let shakeX = 0, shakeY = 0;
  if (game.shakeTimer > 0) {
    shakeX = (Math.random() - 0.5) * game.shakeTimer;
    shakeY = (Math.random() - 0.5) * game.shakeTimer;
    game.shakeTimer--;
  }
  // damageFlash decremented in per-player loop

  // Camera follows midpoint of alive players
  const aliveCamPlayers = players.filter(p => !p.dead);
  const camMidX = aliveCamPlayers.length > 0 ? aliveCamPlayers.reduce((s, p) => s + p.x, 0) / aliveCamPlayers.length : players[0].x;
  const camMidY = aliveCamPlayers.length > 0 ? aliveCamPlayers.reduce((s, p) => s + p.y, 0) / aliveCamPlayers.length : players[0].y;
  const camX = Math.floor(camMidX - VIEW_W / 2 + shakeX);
  const camY = Math.floor(camMidY - VIEW_H / 2 + shakeY);

  bx.fillStyle = COL.sky;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ══ FISSURES — growing cracks, drawn BEFORE tiles ══
  const fissurePulse = Math.sin(game.time * 0.02) * 0.3 + 0.6;
  for (const vein of veins) {
    if (vein.segments.length < 2) continue;
    let visible = false;
    for (const p of vein.segments) {
      const vsx = p.x - camX, vsy = p.y - camY;
      if (vsx > -40 && vsx < VIEW_W + 40 && vsy > -40 && vsy < VIEW_H + 40) { visible = true; break; }
    }
    if (!visible) continue;
    const totalSegs = vein.segments.length - 1;
    for (let i = 0; i < totalSegs; i++) {
      const t = i / Math.max(1, vein.targetLen); // based on target, not current
      const x1 = vein.segments[i].x - camX, y1 = vein.segments[i].y - camY;
      const x2 = vein.segments[i + 1].x - camX, y2 = vein.segments[i + 1].y - camY;
      const width = Math.max(1, vein.width * (1 - t));
      // Dark crack
      bx.strokeStyle = '#000000';
      bx.globalAlpha = 0.7;
      bx.lineWidth = width + 1;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      // Fire glow
      bx.globalCompositeOperation = 'lighter';
      bx.strokeStyle = t < 0.4 ? '#ff3300' : '#ff5500';
      bx.globalAlpha = (0.25 + fissurePulse * 0.3) * (1 - t * 0.6);
      bx.lineWidth = width;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      bx.globalCompositeOperation = 'source-over';
    }
    bx.globalAlpha = 1; bx.lineWidth = 1;
  }

  // Tiles
  const startTX = Math.floor(camX / TILE);
  const startTY = Math.floor(camY / TILE);
  const endTX = startTX + Math.ceil(VIEW_W / TILE) + 1;
  const endTY = startTY + Math.ceil(VIEW_H / TILE) + 1;
  for (let ty = startTY; ty <= endTY; ty++)
    for (let tx = startTX; tx <= endTX; tx++) {
      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) continue;
      drawTile(tx * TILE - camX, ty * TILE - camY, map[ty][tx], tx, ty);
    }

  // (fissures drawn before tiles — see above)

  // ══ WALL EYES — reuse drawWallEye from title screen ══
  for (const we of wallEyes) {
    const sz = (we as any).size || 20;
    const esx = we.x - camX, esy = we.y - camY;
    if (esx < -sz * 2 || esx > VIEW_W + sz * 2 || esy < -sz * 2 || esy > VIEW_H + sz * 2) continue;
    // Target = nearest player
    const eyeTarget = players.reduce((best, p) => !p.dead && dist2(p, we) < dist2(best, we) ? p : best, players[0]);
    const targetSX = eyeTarget.x - camX;
    const targetSY = eyeTarget.y - camY;
    drawWallEye(Math.floor(esx), Math.floor(esy), Math.floor(sz * 0.5), targetSX, targetSY, game.time * 16);
  }

  // Chests
  for (const ch of chests) {
    const sx = ch.x - camX, sy = ch.y - camY;
    if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) drawChest(ch, sx, sy);
  }

  // Drops
  for (const dr of drops) {
    const sx = dr.x - camX, sy = dr.y - camY;
    if (sx > -10 && sx < VIEW_W + 10 && sy > -10 && sy < VIEW_H + 10) drawDrop(dr, sx, sy);
  }

  // Enemies
  for (const e of enemies) {
    const sx = e.x - camX, sy = e.y - camY;
    if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) drawEnemy(e, sx, sy);
  }

  // Danger zones
  for (const dz of dangerZones) {
    const dzx = dz.x - camX, dzy = dz.y - camY;
    if (dzx < -50 || dzx > VIEW_W + 50 || dzy < -50 || dzy > VIEW_H + 50) continue;
    if (dz.warnTime > 0) {
      // Warning phase — pulsing red circle
      const pulse = Math.sin(game.time * 0.15) * 0.15 + 0.25;
      const shrink = dz.warnTime / 90; // 1→0 as it approaches detonation
      bx.strokeStyle = '#ff2244';
      bx.globalAlpha = pulse + (1 - shrink) * 0.3;
      bx.lineWidth = 1;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), dz.radius * shrink + dz.radius * 0.3, 0, Math.PI * 2);
      bx.stroke();
      // Inner fill
      bx.fillStyle = '#ff0022';
      bx.globalAlpha = (1 - shrink) * 0.15;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), dz.radius, 0, Math.PI * 2);
      bx.fill();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
    } else {
      // Explosion phase — bright expanding ring
      const explFrame = -dz.warnTime;
      const expandR = dz.radius + explFrame * 3;
      bx.globalCompositeOperation = 'lighter';
      bx.strokeStyle = '#ff4444';
      bx.globalAlpha = Math.max(0, 1 - explFrame / 15);
      bx.lineWidth = 3;
      bx.beginPath();
      bx.arc(Math.floor(dzx), Math.floor(dzy), expandR, 0, Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
      bx.globalCompositeOperation = 'source-over';
    }
  }

  // Poison trail / fire ground (from all players)
  const hasMeteor = players.some(p => p.activeCombos.includes('meteor'));
  const hasPoison = players.some(p => p.activeSuperRares.includes('poison_trail'));
  const allPoisonTrails = players.flatMap(p => p.poisonTrails);
  for (const pt of allPoisonTrails) {
    const ptx = pt.x - camX, pty = pt.y - camY;
    if (ptx > -10 && ptx < VIEW_W + 10 && pty > -10 && pty < VIEW_H + 10) {
      const fade = Math.min(0.6, pt.life / 300);
      bx.globalAlpha = fade;
      if (hasMeteor && !hasPoison) {
        // Fire ground — flickering orange/red
        const flicker = Math.sin(game.time * 0.2 + pt.x * 0.1) > 0;
        bx.fillStyle = flicker ? '#ff4400' : '#ff8800';
        bx.fillRect(ptx - 5, pty - 5, 10, 10);
        bx.fillStyle = flicker ? '#ffaa00' : '#ff6600';
        bx.fillRect(ptx - 3, pty - 3, 6, 6);
        bx.fillStyle = '#ffcc44';
        bx.globalAlpha = fade * 0.5;
        bx.fillRect(ptx - 1, pty - 4, 2, 3); // flame tip
      } else {
        // Poison — green
        bx.fillStyle = '#44ff44';
        bx.fillRect(ptx - 4, pty - 4, 8, 8);
        bx.fillStyle = '#22aa22';
        bx.fillRect(ptx - 2, pty - 2, 4, 4);
      }
      bx.globalAlpha = 1;
    }
  }

  // Ghost trail (afterimages) — both players
  for (const pp of players) {
    if (pp.dead) continue;
    for (const g of pp.ghostTrail) {
      const gx = g.x - camX, gy = g.y - camY;
      const alpha = Math.max(0, 0.25 - g.age * 0.01);
      if (alpha > 0) {
        bx.globalAlpha = alpha;
        bx.fillStyle = pp.visorColor;
        bx.fillRect(Math.floor(gx) - 4, Math.floor(gy) - 5, 8, 10);
        bx.fillRect(Math.floor(gx) - 3, Math.floor(gy) - 8, 6, 5);
        bx.globalAlpha = 1;
      }
    }
  }

  // Draw death auras for dead players (revive zones)
  for (const pp of players) {
    if (!pp.dead) continue;
    const dx = pp.deathX - camX, dy = pp.deathY - camY;
    if (dx < -60 || dx > VIEW_W + 60 || dy < -60 || dy > VIEW_H + 60) continue;
    const REVIVE_RADIUS = 50;
    const pulse = Math.sin(game.time * 0.05) * 0.15 + 0.35;
    // Outer aura circle
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = pp.visorColor;
    bx.globalAlpha = pulse * 0.4;
    bx.lineWidth = 2;
    bx.beginPath();
    bx.arc(dx, dy, REVIVE_RADIUS, 0, Math.PI * 2);
    bx.stroke();
    // Inner glow
    bx.globalAlpha = pulse * 0.1;
    bx.fillStyle = pp.visorColor;
    bx.beginPath();
    bx.arc(dx, dy, REVIVE_RADIUS, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    // Skull/death marker
    drawText('X', dx - 5, dy - 6, pp.visorColor, 2);
    // Player name
    const deadName = playerNames[pp.playerIndex];
    drawText(deadName, dx - textWidth(deadName, 1) / 2, dy + 10, pp.visorColor, 1);
    // Progress arc (fill portion of the circle based on reviveProgress)
    if (pp.reviveProgress > 0) {
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 3;
      bx.globalAlpha = 0.8;
      bx.beginPath();
      bx.arc(dx, dy, REVIVE_RADIUS - 3, -Math.PI / 2, -Math.PI / 2 + pp.reviveProgress * Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
      bx.lineWidth = 1;
    }
  }

  // Draw both players + names above
  for (const pp of players) {
    if (pp.dead) continue;
    if (game.state !== 'gameover') {
      drawPlayerCoOp(pp, pp.x - camX, pp.y - camY);
      const pName = playerNames[pp.playerIndex];
      const nameX = pp.x - camX - textWidth(pName, 1) / 2;
      drawText(pName, nameX, pp.y - camY - 14, pp.visorColor, 1);
    }
  }

  // Per-player visuals (shield orb, skill, drones)
  for (const pp of players) {
    if (pp.dead) continue;
    // Shield orb visual
    if (pp.activeSuperRares.includes('shield_orb') && pp.shieldOrbActive) {
      const px = pp.x - camX, py = pp.y - camY;
      bx.strokeStyle = '#44aaff';
      bx.globalAlpha = 0.4 + Math.sin(game.time * 0.1) * 0.2;
      bx.beginPath();
      bx.arc(Math.floor(px), Math.floor(py), 12, 0, Math.PI * 2);
      bx.stroke();
      bx.globalAlpha = 1;
    }
    // Skill active visual (barrier)
    if (pp.skillActive > 0 && pp.activeSkill?.id === 'shield_skill') {
      const px = pp.x - camX, py = pp.y - camY;
      bx.strokeStyle = '#4488ff';
      bx.globalAlpha = 0.6;
      bx.lineWidth = 2;
      bx.beginPath();
      bx.arc(Math.floor(px), Math.floor(py), 16, 0, Math.PI * 2);
      bx.stroke();
      bx.lineWidth = 1;
      bx.globalAlpha = 1;
    }
    // Drones
    if (pp.droneCount > 0) {
      for (let i = 0; i < pp.droneCount; i++) {
        const angle = pp.droneAngle + (i / pp.droneCount) * Math.PI * 2;
        const dx = pp.x + Math.cos(angle) * 40 - camX;
        const dy = pp.y + Math.sin(angle) * 40 - camY;
        bx.fillStyle = '#44ccff';
        bx.fillRect(Math.floor(dx) - 3, Math.floor(dy) - 3, 6, 6);
        bx.fillStyle = '#88ddff';
        bx.fillRect(Math.floor(dx) - 1, Math.floor(dy) - 1, 2, 2);
      }
    }
  }

  // ══ BLADE STORM visual — ejected sword projectiles ══
  bx.globalCompositeOperation = 'lighter';
  for (const bp of bladeProjs) {
    const sx = bp.x - camX, sy = bp.y - camY;
    if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
    // Sword body — length scales with caliber
    const len = 15 + weapon.size * 3;
    const tipX = sx + Math.cos(bp.angle) * len;
    const tipY = sy + Math.sin(bp.angle) * len;
    bx.strokeStyle = '#ff4488';
    bx.globalAlpha = Math.min(1, bp.life / 20);
    bx.lineWidth = 3;
    bx.beginPath();
    bx.moveTo(sx, sy);
    bx.lineTo(tipX, tipY);
    bx.stroke();
    bx.strokeStyle = '#ffaacc';
    bx.lineWidth = 1;
    bx.beginPath();
    bx.moveTo(sx, sy);
    bx.lineTo(tipX, tipY);
    bx.stroke();
    // Tip spark
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = 0.7;
    bx.fillRect(tipX - 2, tipY - 2, 4, 4);
  }
  bx.globalAlpha = 1;
  bx.lineWidth = 1;
  bx.globalCompositeOperation = 'source-over';

  // ══ DEATH RAY visual — per player ══
  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('death_ray')) continue;
    let rayTarget: Enemy | null = null;
    let rtDist = 250 * 250;
    for (const e of enemies) { const d = dist2(pp, e); if (d < rtDist) { rtDist = d; rayTarget = e; } }
  if (rayTarget) {
    const px = pp.x - camX, py = pp.y - camY;
    const aim = aimDir(pp, rayTarget);
    const rayLen = 300 + weapon.pierce * 40;
    const ex = px + aim.x * rayLen, ey = py + aim.y * rayLen;
    bx.globalCompositeOperation = 'lighter';
    // Outer glow
    bx.strokeStyle = '#ff2244';
    bx.globalAlpha = 0.3 + Math.sin(game.time * 0.2) * 0.1;
    bx.lineWidth = 8 + Math.sin(game.time * 0.15) * 2;
    bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
    // Inner core
    bx.strokeStyle = '#ff8888';
    bx.globalAlpha = 0.7;
    bx.lineWidth = 3;
    bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
    // Center white
    bx.strokeStyle = '#ffffff';
    bx.globalAlpha = 0.4;
    bx.lineWidth = 1;
    bx.beginPath(); bx.moveTo(px, py); bx.lineTo(ex, ey); bx.stroke();
    bx.globalAlpha = 1; bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
  }
  } // end death ray per-player loop

  // ══ BEAM LINES visual (sniper, railgun) ══
  bx.globalCompositeOperation = 'lighter';
  for (const bl of beamLines) {
    const x1 = bl.x1 - camX, y1 = bl.y1 - camY;
    const x2 = bl.x2 - camX, y2 = bl.y2 - camY;
    const alpha = bl.life / 12;
    // Outer glow
    bx.strokeStyle = bl.color;
    bx.globalAlpha = alpha * 0.4;
    bx.lineWidth = bl.width * 3;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
    // Core
    bx.globalAlpha = alpha * 0.9;
    bx.lineWidth = bl.width;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
    // White center
    bx.strokeStyle = '#ffffff';
    bx.globalAlpha = alpha * 0.5;
    bx.lineWidth = 1;
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
  }
  bx.globalAlpha = 1; bx.lineWidth = 1;
  bx.globalCompositeOperation = 'source-over';

  // ══ SECOND LIFE visual — golden overheal shield (both players) ══
  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('second_life') || pp.hp <= pp.maxHp) continue;
    const px = pp.x - camX, py = pp.y - camY;
    const shieldAlpha = 0.2 + Math.sin(game.time * 0.08) * 0.1;
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = '#ffcc44';
    bx.globalAlpha = shieldAlpha;
    bx.lineWidth = 2;
    bx.beginPath();
    bx.arc(Math.floor(px), Math.floor(py), 14, 0, Math.PI * 2);
    bx.stroke();
    bx.fillStyle = '#ffcc44';
    bx.globalAlpha = shieldAlpha * 0.3;
    bx.beginPath();
    bx.arc(Math.floor(px), Math.floor(py), 14, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1; bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
  } // end second life per-player

  // ══ WARP FIELD visual — swirling vortex (both players) ══
  for (const pp of players) {
    if (pp.dead || !pp.activeCombos.includes('warp_field')) continue;
    const px = pp.x - camX, py = pp.y - camY;
    const wfRange = 60 + (pp.upgradeLevels.get('pickup_radius') || 0) * 15;
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = '#cc88ff';
    bx.globalAlpha = 0.15;
    bx.lineWidth = 1;
    for (let v = 0; v < 6; v++) {
      const angle = game.time * 0.03 + (v / 6) * Math.PI * 2;
      const r = wfRange * (0.5 + Math.sin(game.time * 0.05 + v) * 0.3);
      bx.beginPath();
      bx.arc(Math.floor(px), Math.floor(py), r, angle, angle + 1.5);
      bx.stroke();
    }
    bx.globalAlpha = 1; bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
  } // end warp field per-player

  // ══ BULLET TIME visual — blue overlay when active ══
  if (players.some(p => p.bulletTimeActive > 0)) {
    bx.fillStyle = '#112244';
    bx.globalAlpha = 0.15 + Math.sin(game.time * 0.1) * 0.05;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    bx.globalAlpha = 1;
  }

  // ══ SHOCK RINGS visual — expanding wave from player ══
  bx.globalCompositeOperation = 'lighter';
  for (const sr of shockRings) {
    const sx = sr.x - camX, sy = sr.y - camY;
    const alpha = Math.max(0, sr.life / 60);
    bx.strokeStyle = sr.color;
    bx.globalAlpha = alpha * 0.8;
    bx.lineWidth = 4;
    bx.beginPath();
    bx.arc(Math.floor(sx), Math.floor(sy), sr.radius, 0, Math.PI * 2);
    bx.stroke();
    // Inner brighter ring
    bx.globalAlpha = alpha * 0.4;
    bx.lineWidth = 8;
    bx.beginPath();
    bx.arc(Math.floor(sx), Math.floor(sy), sr.radius - 5, 0, Math.PI * 2);
    bx.stroke();
  }
  bx.globalAlpha = 1;
  bx.lineWidth = 1;
  bx.globalCompositeOperation = 'source-over';

  // ══ FALLING METEORS visual — proper fireball from sky ══
  for (const fm of fallingMeteors) {
    const mx = fm.x - camX, my = fm.y - camY;
    if (mx < -100 || mx > VIEW_W + 100 || my < -200 || my > VIEW_H + 100) continue;
    const maxFall = Math.max(50, fm.fallTimer + 1);
    const t = fm.fallTimer / maxFall; // 1→0 as it approaches

    // Ground shadow (grows + darkens as meteor approaches)
    const shadowSize = fm.radius * (1 - t * 0.6);
    bx.fillStyle = '#000000';
    bx.globalAlpha = 0.4 * (1 - t);
    bx.beginPath();
    bx.ellipse(Math.floor(mx), Math.floor(my) + 2, shadowSize, shadowSize * 0.4, 0, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;

    // Warning ring — pulsing, shrinking
    bx.strokeStyle = '#ff2200';
    bx.globalAlpha = (1 - t) * 0.5 + Math.sin(game.time * 0.25) * 0.2;
    bx.lineWidth = 1 + (1 - t) * 2;
    bx.beginPath();
    bx.arc(Math.floor(mx), Math.floor(my), fm.radius * t + fm.radius * 0.2, 0, Math.PI * 2);
    bx.stroke();
    // Inner fill
    bx.fillStyle = '#ff2200';
    bx.globalAlpha = (1 - t) * 0.08;
    bx.beginPath();
    bx.arc(Math.floor(mx), Math.floor(my), fm.radius, 0, Math.PI * 2);
    bx.fill();

    // ── The fireball itself ──
    const rockY = my - 180 * t; // falls from 180px above
    const rockSize = 5 + (1 - t) * 12; // grows as it approaches

    bx.globalCompositeOperation = 'lighter';

    // Outer fire trail (long, wide, fading)
    const trailLen = 40 + (1 - t) * 30;
    bx.fillStyle = '#ff2200';
    bx.globalAlpha = 0.3 * (1 - t * 0.5);
    bx.beginPath();
    bx.ellipse(Math.floor(mx), Math.floor(rockY) - trailLen * 0.4, rockSize * 0.8, trailLen, 0, 0, Math.PI * 2);
    bx.fill();

    // Mid fire glow
    bx.fillStyle = '#ff6600';
    bx.globalAlpha = 0.5 * (1 - t * 0.3);
    bx.beginPath();
    bx.arc(Math.floor(mx), Math.floor(rockY), rockSize * 1.5, 0, Math.PI * 2);
    bx.fill();

    // Inner fire
    bx.fillStyle = '#ffaa22';
    bx.globalAlpha = 0.7;
    bx.beginPath();
    bx.arc(Math.floor(mx), Math.floor(rockY), rockSize, 0, Math.PI * 2);
    bx.fill();

    // White hot core
    bx.fillStyle = '#ffeeaa';
    bx.globalAlpha = 0.9;
    bx.beginPath();
    bx.arc(Math.floor(mx), Math.floor(rockY), rockSize * 0.5, 0, Math.PI * 2);
    bx.fill();

    // Sparks flying off
    if ((1 - t) > 0.3) {
      for (let sp = 0; sp < 3; sp++) {
        const sa = Math.random() * Math.PI * 2;
        const sr = rockSize + Math.random() * 8;
        bx.fillStyle = '#ffcc44';
        bx.globalAlpha = 0.5 * Math.random();
        bx.fillRect(mx + Math.cos(sa) * sr, rockY + Math.sin(sa) * sr - Math.random() * 10, 2, 2);
      }
    }

    bx.globalCompositeOperation = 'source-over';
    bx.globalAlpha = 1;
    bx.lineWidth = 1;
  }

  // ══ BLACK HOLE visual — grows then implodes (both players) ══
  for (const pp of players) {
  if (pp.novaOrbActive) {
    const orb = pp.novaOrbActive as any;
    const ox = orb.x - camX, oy = orb.y - camY;
    const r = orb.currentRadius || 5;
    const isGrowing = orb.dx === 0 && orb.dy === 0;
    const isImploding = orb.life <= 10;

    // Dark void center — actual darkness (not additive)
    if (isGrowing && !isImploding) {
      bx.fillStyle = '#000000';
      bx.globalAlpha = 0.8;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), r, 0, Math.PI * 2);
      bx.fill();
      bx.globalAlpha = 1;
    }

    bx.globalCompositeOperation = 'lighter';

    if (!isImploding) {
      // Accretion disk — spinning rings around the black hole
      const ringCount = isGrowing ? 3 : 1;
      for (let ring = 0; ring < ringCount; ring++) {
        const ringR = r + 5 + ring * 8;
        const ringSpeed = 0.08 - ring * 0.02;
        bx.strokeStyle = ring === 0 ? '#aa22ff' : ring === 1 ? '#ff44aa' : '#ff8844';
        bx.globalAlpha = isGrowing ? 0.3 + (r / 40) * 0.3 : 0.3;
        bx.lineWidth = isGrowing ? 2 + ring : 1;
        bx.beginPath();
        bx.arc(Math.floor(ox), Math.floor(oy), ringR, game.time * ringSpeed, game.time * ringSpeed + Math.PI * 1.5);
        bx.stroke();
      }

      // Spiral arms being sucked in
      if (isGrowing) {
        const armCount = 8;
        for (let a = 0; a < armCount; a++) {
          const baseAngle = game.time * 0.06 + (a / armCount) * Math.PI * 2;
          const armR = r * 2 + 10;
          const sx = ox + Math.cos(baseAngle) * armR;
          const sy = oy + Math.sin(baseAngle) * armR;
          bx.fillStyle = a % 2 === 0 ? '#6622aa' : '#aa44ff';
          bx.globalAlpha = 0.4 * (r / 40);
          bx.fillRect(sx - 1, sy - 1, 2, 2);
        }
      }

      // Purple glow edge
      bx.strokeStyle = '#8822cc';
      bx.globalAlpha = 0.4;
      bx.lineWidth = 3;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), r + 2, 0, Math.PI * 2);
      bx.stroke();

      // Bright event horizon
      bx.strokeStyle = '#cc44ff';
      bx.globalAlpha = 0.6;
      bx.lineWidth = 1;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), r, 0, Math.PI * 2);
      bx.stroke();
    }

    // Traveling phase — small glowing orb
    if (!isGrowing && !isImploding) {
      bx.fillStyle = '#aa44ff';
      bx.globalAlpha = 0.8;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), 6, 0, Math.PI * 2);
      bx.fill();
      bx.fillStyle = '#ffffff';
      bx.globalAlpha = 0.4;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), 3, 0, Math.PI * 2);
      bx.fill();
    }

    // Implosion flash
    if (isImploding) {
      const impFrame = 10 - orb.life;
      const flashR = r + impFrame * 8;
      bx.fillStyle = '#ffffff';
      bx.globalAlpha = Math.max(0, 0.5 - impFrame * 0.05);
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), flashR, 0, Math.PI * 2);
      bx.fill();
      bx.strokeStyle = '#ff44ff';
      bx.globalAlpha = Math.max(0, 0.8 - impFrame * 0.08);
      bx.lineWidth = 3;
      bx.beginPath();
      bx.arc(Math.floor(ox), Math.floor(oy), flashR * 0.7, 0, Math.PI * 2);
      bx.stroke();
    }

    bx.globalAlpha = 1;
    bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
  }
  } // end black hole per-player

  // Orbital orbs (both players)
  for (const pp of players) {
    if (pp.dead) continue;
    const orbLv = pp.upgradeLevels.get('orbital') || 0;
    if (orbLv > 0) {
    for (let oi = 0; oi < orbLv; oi++) {
      const angle = pp.orbitalAngle + (oi / orbLv) * Math.PI * 2;
      const ox = pp.x + Math.cos(angle) * 30 - camX;
      const oy = pp.y + Math.sin(angle) * 30 - camY;
      // Glow
      bx.fillStyle = '#6666ff';
      bx.globalAlpha = 0.3 + Math.sin(game.time * 0.1 + oi) * 0.15;
      bx.fillRect(Math.floor(ox) - 5, Math.floor(oy) - 5, 10, 10);
      bx.globalAlpha = 1;
      // Core
      bx.fillStyle = '#aaaaff';
      bx.fillRect(Math.floor(ox) - 3, Math.floor(oy) - 3, 6, 6);
      bx.fillStyle = '#ddddff';
      bx.fillRect(Math.floor(ox) - 1, Math.floor(oy) - 1, 3, 3);
      // Trail
      const trailAngle = angle - 0.3;
      const tx = pp.x + Math.cos(trailAngle) * 30 - camX;
      const ty = pp.y + Math.sin(trailAngle) * 30 - camY;
      bx.fillStyle = '#6666ff';
      bx.globalAlpha = 0.3;
      bx.fillRect(Math.floor(tx) - 2, Math.floor(ty) - 2, 4, 4);
      bx.globalAlpha = 1;
    }
  }
  } // end orbital per-player

  // Shadow clone (both players)
  for (const pp of players) {
  if (pp.shadowClone) {
    const scx = pp.shadowClone.x - camX, scy = pp.shadowClone.y - camY;
    bx.globalAlpha = 0.5;
    bx.fillStyle = '#8844cc';
    bx.fillRect(Math.floor(scx) - 4, Math.floor(scy) - 5, 8, 10);
    bx.fillStyle = '#aa66ee';
    bx.fillRect(Math.floor(scx) - 3, Math.floor(scy) - 8, 6, 5);
    bx.fillStyle = '#cc88ff';
    bx.fillRect(Math.floor(scx) - 2, Math.floor(scy) - 7, 4, 1);
    bx.globalAlpha = 1;
  }
  } // end shadow clone per-player

  // Lasers with additive glow
  bx.globalCompositeOperation = 'lighter';
  for (const l of lasers) {
    const sx = l.x - camX, sy = l.y - camY;
    const half = Math.floor(l.size / 2);
    // Outer glow
    bx.fillStyle = l.glowColor;
    bx.globalAlpha = 0.25;
    bx.fillRect(sx - half - 2, sy - half - 2, l.size + 4, l.size + 4);
    // Core
    bx.globalAlpha = 0.9;
    bx.fillStyle = l.color;
    bx.fillRect(sx - half, sy - half, l.size, l.size);
    // Trail
    bx.globalAlpha = 0.3;
    for (let t = 1; t <= l.trailLength; t++) {
      const trailSz = Math.max(1, l.size - t);
      const trailHalf = Math.floor(trailSz / 2);
      bx.fillRect(sx - l.dx * t * 0.5 - trailHalf, sy - l.dy * t * 0.5 - trailHalf, trailSz, trailSz);
    }
  }
  bx.globalAlpha = 1;
  bx.globalCompositeOperation = 'source-over';

  // Chain lightning arcs
  for (const arc of chainArcs) {
    const x1 = arc.x1 - camX, y1 = arc.y1 - camY;
    const x2 = arc.x2 - camX, y2 = arc.y2 - camY;
    bx.globalAlpha = arc.life / 10;
    bx.fillStyle = '#4488ff';
    // Draw zigzag line
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t1 = s / steps, t2 = (s + 1) / steps;
      const sx1 = x1 + (x2 - x1) * t1 + (Math.random() - 0.5) * 4;
      const sy1 = y1 + (y2 - y1) * t1 + (Math.random() - 0.5) * 4;
      const sx2 = x1 + (x2 - x1) * t2 + (Math.random() - 0.5) * 4;
      const sy2 = y1 + (y2 - y1) * t2 + (Math.random() - 0.5) * 4;
      bx.fillRect(sx1, sy1, Math.abs(sx2 - sx1) || 1, Math.abs(sy2 - sy1) || 1);
    }
    bx.globalAlpha = 1;
  }

  // Particles with glow
  bx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const sx = p.x - camX, sy = p.y - camY;
    bx.globalAlpha = (p.life / p.maxLife) * 0.8;
    bx.fillStyle = p.color;
    bx.fillRect(sx, sy, p.size, p.size);
  }
  bx.globalAlpha = 1;
  bx.globalCompositeOperation = 'source-over';

  // ── Floating damage numbers ──
  for (const dn of dmgNumbers) {
    const dnx = dn.x - camX, dny = dn.y - camY;
    if (dnx < -20 || dnx > VIEW_W + 20 || dny < -20 || dny > VIEW_H + 20) continue;
    const alpha = Math.min(1, dn.life / 10);
    bx.globalAlpha = alpha;
    const dmgText = '' + dn.value;
    const scale = dn.value >= 10 ? 2 : 1;
    drawText(dmgText, dnx - textWidth(dmgText, scale) / 2, dny, dn.color, scale);
    bx.globalAlpha = 1;
  }

  // ── Chest indicators (arrows pointing to off-screen chests) ──
  for (const ch of chests) {
    if (ch.opened) continue;
    const csx = ch.x - camX, csy = ch.y - camY;
    // Only show indicator if chest is off-screen or far
    if (csx > 10 && csx < VIEW_W - 10 && csy > 10 && csy < VIEW_H - 10) continue;
    // Clamp to screen edge
    const margin = 16;
    const ix = Math.max(margin, Math.min(VIEW_W - margin, csx));
    const iy = Math.max(margin, Math.min(VIEW_H - margin, csy));
    // Big pulsing indicator with glow
    const pulse = Math.sin(game.time * 0.08) * 0.4 + 0.6;
    const fastPulse = Math.sin(game.time * 0.15) * 0.5 + 0.5;
    const isRare = ch.rarity === 'rare';
    const color = isRare ? '#ff44aa' : '#aa88ff';
    const glowColor = isRare ? '#ff88cc' : '#cc88ff';

    // Outer glow
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = glowColor;
    bx.globalAlpha = pulse * 0.3;
    bx.beginPath();
    bx.arc(ix, iy, 12 + fastPulse * 4, 0, Math.PI * 2);
    bx.fill();

    // Inner diamond
    bx.fillStyle = color;
    bx.globalAlpha = pulse * 0.8 + 0.2;
    bx.fillRect(ix - 5, iy - 5, 10, 10);
    // Bright center
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = fastPulse * 0.6;
    bx.fillRect(ix - 2, iy - 2, 4, 4);

    // Distance text
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    const dist = Math.floor(Math.sqrt((ch.x - player.x) ** 2 + (ch.y - player.y) ** 2) / TILE);
    const distText = '' + dist + 'M';
    drawText(distText, ix - textWidth(distText, 1) / 2, iy + 10, color, 1);
  }

  // ══ FOG OF WAR — radial darkness, light from player (before HUD) ══
  const fogGradPre = bx.createRadialGradient(VIEW_W/2, VIEW_H/2, 90, VIEW_W/2, VIEW_H/2, VIEW_W * 0.52);
  fogGradPre.addColorStop(0, 'rgba(0,0,0,0)');
  fogGradPre.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  fogGradPre.addColorStop(1, 'rgba(0,0,0,0.65)');
  bx.fillStyle = fogGradPre;
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ── HUD ──
  drawHUD();

  // ── Pause overlay ──
  if (game.state === 'paused') {
    bx.fillStyle = 'rgba(0,0,0,0.7)';
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    const pauseTitle = 'PAUSE';
    drawText(pauseTitle, VIEW_W / 2 - textWidth(pauseTitle, 4) / 2, VIEW_H / 2 - 40, '#ffffff', 4);

    const btnW = 200, btnX = VIEW_W / 2 - btnW / 2;
    const r1Y = VIEW_H / 2 + 5, r2Y = VIEW_H / 2 + 35, btnH = 25;

    // Hover detection
    const h1 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= r1Y && mouse.y <= r1Y + btnH;
    const h2 = mouse.x >= btnX && mouse.x <= btnX + btnW && mouse.y >= r2Y && mouse.y <= r2Y + btnH;
    if (h1) titleState.pauseCursor = 0;
    if (h2) titleState.pauseCursor = 1;

    drawButton('REPRENDRE', btnX, r1Y, btnW, btnH, h1 || titleState.pauseCursor === 0, '#44ff88');
    drawButton('MENU PRINCIPAL', btnX, r2Y, btnW, btnH, h2 || titleState.pauseCursor === 1, '#ff4444');

    const arrowY = titleState.pauseCursor === 0 ? r1Y : r2Y;
    drawText('>', btnX - 16, arrowY + 7, '#ffffff', 2);
  }

  // ── Selection overlay ──
  if (game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare') {
    drawSelectionScreen();
  }

  // ── Game Over ──
  if (game.state === 'gameover') {
    drawGameOver();
  }

  // Crosshair cursor
  const cx = Math.floor(mouse.x), cy = Math.floor(mouse.y);
  const cSize = 5;
  bx.globalCompositeOperation = 'lighter';
  bx.fillStyle = COL.playerVisor;
  bx.globalAlpha = 0.8;
  // Cross lines
  bx.fillRect(cx - cSize, cy, cSize - 1, 1);   // left
  bx.fillRect(cx + 2, cy, cSize - 1, 1);        // right
  bx.fillRect(cx, cy - cSize, 1, cSize - 1);    // top
  bx.fillRect(cx, cy + 2, 1, cSize - 1);        // bottom
  // Center dot
  bx.fillRect(cx, cy, 1, 1);
  bx.globalAlpha = 1;
  bx.globalCompositeOperation = 'source-over';

  // Codex overlay (TAB)
  if (game.codexOpen) drawCodex();

  // Damage flash — directional red indicator (use strongest flash from any player)
  const maxFlash = Math.max(...players.map(p => p.damageFlash));
  const flashPlayer = players.reduce((best, p) => p.damageFlash > best.damageFlash ? p : best, players[0]);
  if (maxFlash > 0) {
    const alpha = maxFlash / 15;
    // Light overall tint
    bx.fillStyle = '#330000';
    bx.globalAlpha = alpha * 0.5;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Directional indicator — thick red bar on the side the hit came from
    const hd = Math.sqrt(flashPlayer.hitDirX * flashPlayer.hitDirX + flashPlayer.hitDirY * flashPlayer.hitDirY);
    if (hd > 0) {
      const nx = flashPlayer.hitDirX / hd, ny = flashPlayer.hitDirY / hd;
      bx.fillStyle = '#ff0000';
      bx.globalAlpha = alpha * 0.6;
      const barThick = 6;
      if (Math.abs(nx) > Math.abs(ny)) {
        // Hit from left or right
        if (nx > 0) bx.fillRect(0, 0, barThick, VIEW_H); // hit from left
        else bx.fillRect(VIEW_W - barThick, 0, barThick, VIEW_H); // hit from right
      } else {
        // Hit from top or bottom
        if (ny > 0) bx.fillRect(0, 0, VIEW_W, barThick); // hit from top
        else bx.fillRect(0, VIEW_H - barThick, VIEW_W, barThick); // hit from bottom
      }
    }
    bx.globalAlpha = 1;
  }

  // (fog of war moved before HUD)

  // ══ ASH RAIN — permanent ambient falling particles ══
  bx.fillStyle = '#332233';
  for (const ash of ashRain) {
    ash.y += ash.speed;
    ash.x += Math.sin(ash.y * 0.01) * 0.2; // gentle sway
    if (ash.y > VIEW_H) { ash.y = -2; ash.x = Math.random() * VIEW_W; }
    bx.globalAlpha = ash.alpha;
    bx.fillRect(Math.floor(ash.x), Math.floor(ash.y), ash.size, ash.size);
  }
  bx.globalAlpha = 1;

  // ══ LIGHTNING FLASH ══
  if (game.lightningFlash > 0) {
    // First 2 frames = bright white, then fade to purple
    if (game.lightningFlash > 8) {
      bx.fillStyle = '#ffffff';
      bx.globalAlpha = 0.15;
    } else {
      bx.fillStyle = '#221133';
      bx.globalAlpha = game.lightningFlash / 15;
    }
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    bx.globalAlpha = 1;
  }

  // Vignette — dark edges for depth (always on)
  const vigStr = 0.6;
  // Top/bottom gradients
  bx.fillStyle = '#000000';
  for (let v = 0; v < 20; v++) {
    bx.globalAlpha = vigStr * (1 - v / 20) * 0.3;
    bx.fillRect(0, v, VIEW_W, 1);
    bx.fillRect(0, VIEW_H - 1 - v, VIEW_W, 1);
  }
  // Left/right gradients
  for (let v = 0; v < 15; v++) {
    bx.globalAlpha = vigStr * (1 - v / 15) * 0.25;
    bx.fillRect(v, 0, 1, VIEW_H);
    bx.fillRect(VIEW_W - 1 - v, 0, 1, VIEW_H);
  }
  bx.globalAlpha = 1;

  // Low HP warning — pulsing dark red vignette (any alive player)
  const anyLowHp = players.some(p => !p.dead && p.hp < p.maxHp * 0.3 && p.hp > 0);
  if (anyLowHp) {
    const pulse = Math.sin(game.time * 0.1) * 0.1 + 0.15;
    bx.fillStyle = '#330000';
    bx.globalAlpha = pulse;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    bx.globalAlpha = 1;
  }

  // ══ BLOOM POST-PROCESS ══
  // Copy main buffer to bloom, apply blur, composite back with additive blend
  bloomCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  bloomCtx.drawImage(buf, 0, 0);
  // Darken bloom (only keep bright stuff)
  bloomCtx.globalCompositeOperation = 'multiply';
  bloomCtx.fillStyle = '#333333';
  bloomCtx.fillRect(0, 0, VIEW_W, VIEW_H);
  bloomCtx.globalCompositeOperation = 'source-over';
  // Blur
  bloomCtx.filter = 'blur(4px)';
  bloomCtx.drawImage(bloomBuf, 0, 0);
  bloomCtx.filter = 'none';
  // Composite bloom onto main buffer
  bx.globalCompositeOperation = 'lighter';
  bx.globalAlpha = 0.5;
  bx.drawImage(bloomBuf, 0, 0);
  bx.globalAlpha = 1;
  bx.globalCompositeOperation = 'source-over';

  // Upscale (with freeze zoom effect)
  if (game.freezeZoom > 0.005) {
    const z = game.freezeZoom;
    const zw = VIEW_W * z, zh = VIEW_H * z;
    ctx.drawImage(buf, 0, 0, VIEW_W, VIEW_H, -zw, -zh, canvas.width + zw * 2, canvas.height + zh * 2);
    // White flash on freeze
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = game.freezeFrame / 15;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(buf, 0, 0, VIEW_W, VIEW_H, 0, 0, canvas.width, canvas.height);
  }
}

function drawHUD() {
  // Global countdown bar (top of screen)
  const timeRatio = Math.min(1, game.time / GAME_DURATION);
  const barW = VIEW_W - 8;
  bx.fillStyle = '#111111';
  bx.fillRect(4, 4, barW, 6);
  const timeColor = timeRatio > 0.8 ? '#ff3333' : timeRatio > 0.5 ? '#ffaa33' : '#44cc44';
  bx.fillStyle = timeColor;
  bx.fillRect(4, 4, Math.floor(barW * timeRatio), 6);
  bx.fillStyle = '#ffffff';
  bx.fillRect(4, 4, Math.floor(barW * timeRatio), 1);
  // Time text centered on bar (scale 1 to fit)
  const timeLeft = formatTime(GAME_DURATION - game.time);
  drawText(timeLeft, VIEW_W / 2 - textWidth(timeLeft, 1) / 2, 5, '#ffffff', 1);

  // ── P1 HP bar (left side) ──
  const p1 = players[0];
  const hpBarW = 80;
  const hpRatio = Math.max(0, p1.hp / p1.maxHp);
  bx.fillStyle = '#220000';
  bx.fillRect(4, 14, hpBarW, 8);
  const hpColor = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#ccaa22' : '#cc3333';
  bx.fillStyle = hpColor;
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 8);
  bx.fillStyle = '#ffffff';
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 1);
  drawText(playerNames[0] + ' ' + Math.max(0, p1.hp) + '/' + p1.maxHp, 6, 15, '#ffffff', 1);

  // ── P2 HP bar (top-right, symmetric to P1) ──
  const p2 = players[1];
  const p2hpX = VIEW_W - hpBarW - 6;
  const p2hpY = 14;
  if (!p2.dead) {
    const p2hpR = Math.max(0, p2.hp / p2.maxHp);
    bx.fillStyle = '#220000';
    bx.fillRect(p2hpX, p2hpY, hpBarW, 8);
    const p2hpCol = p2hpR > 0.5 ? '#44cc44' : p2hpR > 0.25 ? '#ccaa22' : '#cc3333';
    bx.fillStyle = p2hpCol;
    bx.fillRect(p2hpX, p2hpY, Math.floor(hpBarW * p2hpR), 8);
    bx.fillStyle = '#ffffff';
    bx.fillRect(p2hpX, p2hpY, Math.floor(hpBarW * p2hpR), 1);
    drawText(playerNames[1] + ' ' + Math.max(0, p2.hp) + '/' + p2.maxHp, p2hpX + 2, p2hpY + 1, '#ffffff', 1);
  } else {
    drawText(playerNames[1] + ' MORT', p2hpX + 2, p2hpY + 1, '#ff4444', 1);
  }

  // (kills + damage shown on game over screen only)

  // Shared XP bar (full width, under timer)
  const xpBarY = VIEW_H - 10;
  const xpBarW = barW;
  const xpRatio = game.xp / game.xpToLevel;
  bx.fillStyle = '#113333';
  bx.fillRect(4, xpBarY, xpBarW, 7);
  bx.fillStyle = COL.xpOrb;
  bx.fillRect(4, xpBarY, Math.floor(xpBarW * xpRatio), 7);
  bx.fillStyle = COL.xpOrbGlow;
  bx.fillRect(4, xpBarY, Math.floor(xpBarW * xpRatio), 1);
  const lvText = 'NV ' + game.level;
  drawText(lvText, 4 + xpBarW / 2 - textWidth(lvText, 1) / 2, xpBarY + 1, '#ffffff', 1);

  // Revive progress bar (shown when a player is being revived)
  for (const deadP of players) {
    if (!deadP.dead || deadP.reviveProgress <= 0) continue;
    const revBarY = xpBarY - 12;
    const revBarW = barW;
    bx.fillStyle = '#111122';
    bx.fillRect(4, revBarY, revBarW, 8);
    bx.fillStyle = deadP.visorColor;
    bx.fillRect(4, revBarY, Math.floor(revBarW * deadP.reviveProgress), 8);
    bx.fillStyle = '#ffffff';
    bx.fillRect(4, revBarY, Math.floor(revBarW * deadP.reviveProgress), 1);
    const revText = 'REVIVE ' + playerNames[deadP.playerIndex];
    drawText(revText, 4 + revBarW / 2 - textWidth(revText, 1) / 2, revBarY + 1, '#ffffff', 1);
  }

  // (weapon name + affix icons removed — HUD simplified)

  // Upgrade slots (P1 — bottom left, above XP bar)
  const barY = VIEW_H - 24;
  const upgrades = Array.from(p1.upgradeLevels.entries());
  let ux = 4;
  for (let s = 0; s < MAX_UPGRADES; s++) {
    bx.fillStyle = '#111122';
    bx.fillRect(ux + s * 18, barY, 14, 12);
    bx.fillStyle = '#222233';
    bx.fillRect(ux + s * 18, barY, 14, 1);
    bx.fillRect(ux + s * 18, barY + 11, 14, 1);
    bx.fillRect(ux + s * 18, barY, 1, 12);
    bx.fillRect(ux + s * 18 + 13, barY, 1, 12);
  }
  for (let i = 0; i < upgrades.length; i++) {
    const [id, lv] = upgrades[i];
    const upg = UPGRADES.find(u => u.id === id);
    if (upg) {
      const upgColor = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
      drawIcon(upg.icon, ux + i * 18 + 2, barY + 2, upgColor);
      drawText('' + lv, ux + i * 18 + 8, barY + 2, '#ffffff', 1);
    }
  }

  // Upgrade slots (P2 — bottom right, above XP bar)
  if (!p2.dead) {
    const upgrades2 = Array.from(p2.upgradeLevels.entries());
    const ux2 = VIEW_W - 4 - MAX_UPGRADES * 18;
    for (let s = 0; s < MAX_UPGRADES; s++) {
      bx.fillStyle = '#111122';
      bx.fillRect(ux2 + s * 18, barY, 14, 12);
      bx.fillStyle = '#222233';
      bx.fillRect(ux2 + s * 18, barY, 14, 1);
      bx.fillRect(ux2 + s * 18, barY + 11, 14, 1);
      bx.fillRect(ux2 + s * 18, barY, 1, 12);
      bx.fillRect(ux2 + s * 18 + 13, barY, 1, 12);
    }
    for (let i = 0; i < upgrades2.length; i++) {
      const [id, lv] = upgrades2[i];
      const upg = UPGRADES.find(u => u.id === id);
      if (upg) {
        const upgColor = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
        drawIcon(upg.icon, ux2 + i * 18 + 2, barY + 2, upgColor);
        drawText('' + lv, ux2 + i * 18 + 8, barY + 2, '#ffffff', 1);
      }
    }
  }

  // Skill cooldown (P1 — bottom right)
  if (p1.activeSkill) {
    const skX = VIEW_W - 50;
    const skY = VIEW_H - 30;
    const sk = p1.activeSkill;
    const cdRatio = p1.skillCooldown / sk.cooldown;
    // Background
    bx.fillStyle = '#111122';
    bx.fillRect(skX, skY, 46, 22);
    // Cooldown overlay
    if (cdRatio > 0) {
      bx.fillStyle = '#333344';
      bx.fillRect(skX, skY, Math.floor(46 * (1 - cdRatio)), 22);
    } else {
      bx.fillStyle = sk.color;
      bx.globalAlpha = 0.15;
      bx.fillRect(skX, skY, 46, 22);
      bx.globalAlpha = 1;
    }
    // Border
    bx.fillStyle = cdRatio > 0 ? '#555566' : sk.color;
    bx.fillRect(skX, skY, 46, 1);
    bx.fillRect(skX, skY + 21, 46, 1);
    bx.fillRect(skX, skY, 1, 22);
    bx.fillRect(skX + 45, skY, 1, 22);
    // Icon
    if (sk.icon) drawIcon(sk.icon, skX + 3, skY + 4, cdRatio > 0 ? '#555566' : sk.color);
    // Name
    drawText(sk.name, skX + 10, skY + 3, cdRatio > 0 ? '#666677' : sk.color, 1);
    // Cooldown text
    if (cdRatio > 0) {
      const cdSec = Math.ceil(p1.skillCooldown / FPS);
      drawText(cdSec + 'S', skX + 10, skY + 12, '#888899', 1);
    } else {
      drawText('PRET', skX + 10, skY + 12, '#44ff88', 1);
    }
  }

  // Super rare icons (P1 right side under minimap)
  if (p1.activeSuperRares.length > 0) {
    let srY = 56;
    for (const srId of p1.activeSuperRares) {
      const sr = SUPER_RARES.find(s => s.id === srId);
      if (sr) {
        drawIcon(sr.icon, VIEW_W - 12, srY, sr.color);
        srY += 8;
      }
    }
  }

  // Track name (tiny, under minimap area)
  if (Music.isPlaying()) {
    const tn = Music.getTrackName();
    drawText(tn, VIEW_W - textWidth(tn, 1) - 4, VIEW_H - 24, '#333344', 1);
  }

  // Off-screen player indicators (co-op)
  const alivePlayers = players.filter(p => !p.dead);
  const midPXh = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.x, 0) / alivePlayers.length : players[0].x;
  const midPYh = alivePlayers.length > 0 ? alivePlayers.reduce((s, p) => s + p.y, 0) / alivePlayers.length : players[0].y;
  const hudCamX = midPXh - VIEW_W / 2;
  const hudCamY = midPYh - VIEW_H / 2;
  for (const pp of players) {
    if (pp.dead) continue;
    const sx = pp.x - hudCamX, sy = pp.y - hudCamY;
    if (sx < -10 || sx > VIEW_W + 10 || sy < -10 || sy > VIEW_H + 10) {
      // Player is off-screen — draw arrow at edge
      const cx = Math.max(20, Math.min(VIEW_W - 20, sx));
      const cy = Math.max(20, Math.min(VIEW_H - 20, sy));
      const pulse = Math.sin(game.time * 0.1) * 0.3 + 0.7;
      bx.fillStyle = pp.visorColor;
      bx.globalAlpha = pulse;
      // Arrow pointing toward player
      const arrowSize = 6;
      bx.beginPath();
      if (sx < -10) { // left
        bx.moveTo(4, cy); bx.lineTo(4 + arrowSize, cy - arrowSize); bx.lineTo(4 + arrowSize, cy + arrowSize);
      } else if (sx > VIEW_W + 10) { // right
        bx.moveTo(VIEW_W - 4, cy); bx.lineTo(VIEW_W - 4 - arrowSize, cy - arrowSize); bx.lineTo(VIEW_W - 4 - arrowSize, cy + arrowSize);
      } else if (sy < -10) { // top
        bx.moveTo(cx, 4); bx.lineTo(cx - arrowSize, 4 + arrowSize); bx.lineTo(cx + arrowSize, 4 + arrowSize);
      } else { // bottom
        bx.moveTo(cx, VIEW_H - 4); bx.lineTo(cx - arrowSize, VIEW_H - 4 - arrowSize); bx.lineTo(cx + arrowSize, VIEW_H - 4 - arrowSize);
      }
      bx.fill();
      bx.globalAlpha = 1;
      // Player name
      const pName = playerNames[pp.playerIndex];
      drawText(pName, cx - textWidth(pName, 1) / 2, cy < VIEW_H / 2 ? cy + 10 : cy - 12, pp.visorColor, 1);
    }
  }
}

// Stat gain description for each upgrade
function getStatGain(id: string, newLv: number): string {
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

function drawPlayerSelectionHalf(ps: PlayerState, halfWidth: boolean, leftHalf: boolean) {
  const isRare = game.state === 'chest_rare';
  const isChest = game.state === 'chest_common' || isRare;

  const { cardW, cardH, gap, startX, startY } = getCardLayout(halfWidth, leftHalf);
  const areaW = halfWidth ? VIEW_W / 2 : VIEW_W;
  const offsetX = halfWidth && !leftHalf ? VIEW_W / 2 : 0;
  const centerX = offsetX + areaW / 2;

  // Player done = show waiting message
  if (ps.selectionDone) {
    const waitText = 'EN ATTENTE...';
    drawText(waitText, centerX - textWidth(waitText, 2) / 2, VIEW_H / 2 - 6, '#555566', 2);
    const jLabel = 'J' + (ps.playerIndex + 1);
    drawText(jLabel, centerX - textWidth(jLabel, 1) / 2, VIEW_H / 2 + 14, ps.visorColor, 1);
    return;
  }

  if (ps.selectionOptions.length === 0) return;

  // Player indicator
  const playerLabel = 'J' + (ps.playerIndex + 1);
  drawText(playerLabel, centerX - textWidth(playerLabel, 2) / 2, startY - 56, ps.visorColor, 2);

  // Title
  const title = isRare ? 'BUTIN RARE' : isChest ? 'BUTIN BONUS' : 'AMELIORATION';
  const titleColor = isRare ? '#ff8844' : isChest ? '#ffcc44' : '#44eeff';
  const titleScale = halfWidth ? 2 : 3;
  drawText(title, centerX - textWidth(title, titleScale) / 2, startY - 40, titleColor, titleScale);

  // Slots
  if (game.state === 'levelup') {
    const ownedCount = ps.upgradeLevels.size;
    const slotsText = ownedCount + '/' + MAX_UPGRADES;
    drawText(slotsText, centerX - textWidth(slotsText, 1) / 2, startY - 18, ownedCount >= MAX_UPGRADES ? '#ff8844' : '#6688aa', 1);
  }

  // Sort owned first
  const sorted = ps.selectionOptions.map((opt, idx) => ({ opt, origIdx: idx }));
  sorted.sort((a, b) => {
    const aOwned = 'apply' in a.opt && ps.upgradeLevels.has((a.opt as Upgrade).id) ? 1 : 0;
    const bOwned = 'apply' in b.opt && ps.upgradeLevels.has((b.opt as Upgrade).id) ? 1 : 0;
    return bOwned - aOwned;
  });

  const hoverVal = halfWidth ? ps.selectionHover : game.selectionHover;

  const t = game.time; // animation time

  for (let i = 0; i < sorted.length; i++) {
    const { opt, origIdx } = sorted[i];
    const cx = startX + i * (cardW + gap);
    const hovered = hoverVal === i; // compare to visual position

    const optIsSuperRare = isSuperRare(opt);
    const optIsAffix = isAffix(opt);
    const optIsUpgrade = !optIsSuperRare && !optIsAffix;
    const isOwned = optIsUpgrade && ps.upgradeLevels.has((opt as Upgrade).id);
    const isHighRarity = optIsSuperRare || optIsAffix;

    // Rarity color — owned items get cyan highlight
    const rarityCol = optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : isOwned ? '#44eeff' : '#8899aa';

    // Card float animation
    const bob = Math.sin(t * 0.04 + i * 1.5) * 2;
    const cardY = startY + Math.floor(bob);

    // Card background
    bx.fillStyle = hovered ? '#1a1a33' : isOwned ? '#0d1525' : '#0d0d1a';
    bx.fillRect(cx, cardY, cardW, cardH);

    // Owned cards: cyan pulse glow
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

    // Border
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

    // Level progress bar for owned upgrades
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

    // Tag
    const tagText = optIsSuperRare ? 'SUPER RARE' : optIsAffix ? 'L\xC9GENDAIRE' : isOwned ? 'POSS\xC9D\xC9' : 'NOUVEAU';
    const tagCol = isOwned ? '#44eeff' : optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : '#88aa44';
    drawText(tagText, cx + (cardW - textWidth(tagText, 1)) / 2, cardY + (isOwned ? 8 : 4), tagCol, 1);

    // Icon (floating bob for new items)
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

    // Name
    const name = (opt as any).name || '';
    drawText(name, cx + (cardW - textWidth(name, 2)) / 2, cardY + 36, hovered ? '#ffffff' : rarityCol, 2);

    // Description
    const desc = (opt as any).desc || '';
    drawText(desc, cx + (cardW - textWidth(desc, 1)) / 2, cardY + 52, '#7788aa', 1);

    if (optIsUpgrade) {
      const upg = opt as Upgrade;
      const currentLv = ps.upgradeLevels.get(upg.id) || 0;
      const newLv = currentLv + 1;

      // Stat gain
      const gain = getStatGain(upg.id, newLv);
      const gainScale = textWidth(gain) > cardW - 8 ? 1 : 2;
      drawText(gain, cx + (cardW - textWidth(gain, gainScale)) / 2, cardY + 64, '#44ff88', gainScale);

      // Level or NEW badge
      if (currentLv > 0) {
        const lvText = 'NV ' + currentLv + '>' + newLv;
        drawText(lvText, cx + (cardW - textWidth(lvText, 1)) / 2, cardY + 78, '#aaaacc', 1);
      } else {
        // NEW label uses the tag at top (already says "NEW"), no extra badge needed
      }

      // Combo hint
      const combos = getCombosForUpgrade(upg.id);
      if (combos.length > 0) {
        const combo = combos[0];
        const partnerId = combo.upgrade1 === upg.id ? combo.upgrade2 : combo.upgrade1;
        const partner = UPGRADES.find(u => u.id === partnerId);
        const partnerLv = ps.upgradeLevels.get(partnerId) || 0;
        const done = newLv >= MAX_UPGRADE_LEVEL && partnerLv >= MAX_UPGRADE_LEVEL;
        // Format: "+ PARTNER = COMBO"
        if (partner) {
          const line1 = '+ ' + partner.name;
          const line2 = '= ' + combo.name;
          drawText(line1, cx + (cardW - textWidth(line1, 1)) / 2, cardY + 90, partnerLv > 0 ? '#667788' : '#444455', 1);
          drawText(line2, cx + (cardW - textWidth(line2, 1)) / 2, cardY + 100, done ? combo.color : '#555566', 1);
        }
      }
    } else if (optIsSkill) {
      const cd = Math.round((opt as Skill).cooldown / FPS);
      drawText('CLIC DROIT', cx + (cardW - textWidth('CLIC DROIT', 1)) / 2, cardY + 68, '#44ffcc', 1);
      drawText(cd + 'S RECHARGE', cx + (cardW - textWidth(cd + 'S RECHARGE', 1)) / 2, cardY + 80, '#88aaaa', 1);
    } else {
      const label = optIsSuperRare ? 'SUPER RARE' : 'UNIQUE';
      const labelColV = optIsSuperRare ? '#ff44ff' : '#ff8844';
      drawText(label, cx + (cardW - textWidth(label, 1)) / 2, cardY + 68, labelColV, 1);
    }

    // Key hint (bottom-left, small)
    const hint = '' + (i + 1);
    drawText(hint, cx + 4, cardY + cardH - 10, '#444455', 1);
  }
}

function drawSelectionScreen() {
  bx.fillStyle = 'rgba(0,0,0,0.8)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const isSplitScreen = !players[0].dead && !players[1].dead
    && (players[0].selectionOptions.length > 0 || players[1].selectionOptions.length > 0
        || players[0].selectionDone || players[1].selectionDone);

  if (isSplitScreen) {
    // Divider line
    bx.fillStyle = '#333344';
    bx.fillRect(VIEW_W / 2 - 1, 0, 2, VIEW_H);

    drawPlayerSelectionHalf(players[0], true, true);
    drawPlayerSelectionHalf(players[1], true, false);
  } else {
    // Full screen for chest/skill or single player alive
    const activePs = players.find(p => !p.selectionDone && p.selectionOptions.length > 0) || players[game.selectingPlayer];
    drawPlayerSelectionHalf(activePs, false, true);
  }
}

function updateCodex() {
  // Handle clicks on combos to activate them (god mode)
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
          // REMOVE combo — reset both upgrades to 0
          players[game.selectingPlayer].upgradeLevels.delete(combo.upgrade1);
          players[game.selectingPlayer].upgradeLevels.delete(combo.upgrade2);
          // Reset weapon stats affected
          weapon.fireRate = 35; weapon.speed = 4; weapon.damage = 1;
          weapon.size = 3; weapon.pierce = 0; weapon.count = 1; weapon.spread = 0;
          player.speed = 1.5; player.maxHp = 100;
          player.pickupRadius = 16; player.magnetRadius = 24;
          // Re-apply all remaining upgrades
          for (const [id, lv] of players[game.selectingPlayer].upgradeLevels) {
            const u = UPGRADES.find(uu => uu.id === id);
            if (u) u.apply(lv);
          }
        } else {
          // ACTIVATE combo — max both upgrades
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

function drawCodex() {
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

    // Hover detection
    const hovered = mouse.x >= cx && mouse.x < cx + colW - 16 && mouse.y >= cy && mouse.y < cy + lineH;

    // Hover highlight
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

    // Combo name
    const nameCol = isActive ? combo.color : hovered ? '#ffffff' : inProgress ? '#778899' : '#444455';
    drawText(combo.name, cx, cy, nameCol, 2);

    // Recipe
    const r1Col = lv1 >= MAX_UPGRADE_LEVEL ? '#44ff88' : lv1 > 0 ? '#778899' : hovered ? '#aabbcc' : '#444455';
    const r2Col = lv2 >= MAX_UPGRADE_LEVEL ? '#44ff88' : lv2 > 0 ? '#778899' : hovered ? '#aabbcc' : '#444455';
    drawText(upg1.name, cx, cy + 14, r1Col, 1);
    drawText('+', cx + textWidth(upg1.name, 1) + 2, cy + 14, '#555566', 1);
    drawText(upg2.name, cx + textWidth(upg1.name, 1) + 8, cy + 14, r2Col, 1);

    // Progress dots
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

    // Description
    const descCol = isActive ? combo.color : hovered ? '#8899aa' : inProgress ? '#556677' : '#333344';
    drawText(combo.desc, cx, dotY + 6, descCol, 1);
  }
}

function drawGameOver() {
  bx.fillStyle = 'rgba(0,0,0,0.85)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const cx = VIEW_W / 2;
  const title = game.won ? 'VOUS AVEZ SURVECU' : 'PARTIE TERMINEE';
  const titleColor = game.won ? '#44ff44' : '#ff4444';
  drawText(title, cx - textWidth(title, 3) / 2, 40, titleColor, 3);
  drawText(formatTime(game.time), cx - textWidth(formatTime(game.time), 2) / 2, 65, '#ffcc44', 2);

  const lvText2 = 'NIVEAU ' + game.level;
  drawText(lvText2, cx - textWidth(lvText2, 1) / 2, 82, COL.xpOrb, 1);

  // Per-player stats
  const twoPlayers = !players[1].dead || players[1].kills > 0 || players[1].totalDamage > 0;
  const colW = twoPlayers ? VIEW_W / 2 - 20 : VIEW_W - 40;

  for (let pi = 0; pi < (twoPlayers ? 2 : 1); pi++) {
    const pp = players[pi];
    const px = twoPlayers ? (pi === 0 ? 20 : VIEW_W / 2 + 10) : 20;
    const py = 100;

    // Player name header
    drawText(playerNames[pi], px, py, pp.visorColor, 2);

    // Stats
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

    // List upgrades
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

  // Divider line (2 players)
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

// ── Init & loop ──
generateMap();

let frameCount = 0;
function loop() {
  frameCount++;
  if (frameCount % 2 === 0) update(); // update every other frame = 50% speed
  render();
  requestAnimationFrame(loop);
}
loop();
