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
type GameState = 'playing' | 'levelup' | 'chest_common' | 'chest_rare' | 'skill_select' | 'gameover';

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
    id: 'fire_rate', name: 'FIRE RATE', desc: 'SHOOT FASTER',
    icon: [[0,1,0,0,0],[1,1,1,0,0],[0,1,0,0,0],[0,0,1,1,0],[0,0,0,1,1]],
    apply: (lv) => { weapon.fireRate = Math.max(6, 35 - lv * 4); },
  },
  {
    id: 'damage', name: 'DAMAGE', desc: 'HIT HARDER',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    apply: (lv) => { weapon.damage = 1 + lv; },
  },
  {
    id: 'move_speed', name: 'SPEED', desc: 'MOVE FASTER',
    icon: [[0,0,0,1,0],[0,0,1,1,0],[1,1,1,1,1],[0,0,1,1,0],[0,0,0,1,0]],
    apply: (lv) => { player.speed = 1.5 + lv * 0.15; },
  },
  {
    id: 'max_hp', name: 'VITALITY', desc: 'MORE HEALTH',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    apply: (lv) => { player.maxHp = 100 + lv * 10; player.hp = Math.min(player.hp + 10, player.maxHp); },
  },
  {
    id: 'pickup_radius', name: 'MAGNET', desc: 'WIDER PICKUP',
    icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
    apply: (lv) => { game.pickupRadius = 16 + lv * 10; game.magnetRadius = 30 + lv * 30; },
  },
  {
    id: 'projectile', name: 'MULTISHOT', desc: 'MORE BULLETS',
    icon: [[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1]],
    apply: (lv) => { weapon.count = 1 + lv; weapon.spread = Math.min(0.3, 0.06 * lv); },
  },
  {
    id: 'pierce', name: 'PIERCE', desc: 'PASS THROUGH',
    icon: [[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
    apply: (lv) => { weapon.pierce = lv; },
  },
  {
    id: 'proj_size', name: 'CALIBER', desc: 'BIGGER SHOTS',
    icon: [[0,0,0,0,0],[0,1,1,1,0],[0,1,1,1,0],[0,1,1,1,0],[0,0,0,0,0]],
    apply: (lv) => { weapon.size = 3 + lv; },
  },
  {
    id: 'proj_speed', name: 'VELOCITY', desc: 'FASTER BULLETS',
    icon: [[0,0,0,0,1],[0,0,0,1,1],[1,1,1,1,1],[0,0,0,1,1],[0,0,0,0,1]],
    apply: (lv) => { weapon.speed = 4 + lv * 0.5; },
  },
  {
    id: 'life_steal', name: 'LEECH', desc: 'HEAL ON KILL',
    icon: [[0,1,0,1,0],[1,0,1,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    apply: () => { /* checked in onEnemyKill */ },
  },
  {
    id: 'thorns', name: 'THORNS', desc: 'HURT ON TOUCH',
    icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
    apply: () => { /* checked in contact damage */ },
  },
  {
    id: 'orbital', name: 'ORBITAL', desc: 'ROTATING SHOTS',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    apply: () => { /* handled in update */ },
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
  { id: 'carpet_bomb', name: 'CARPET BOMB', desc: 'BOMBING RUN ACROSS SCREEN', upgrade1: 'projectile', upgrade2: 'proj_size',
    color: '#ff6622', icon: [[1,0,1,0,1],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[1,0,1,0,1]] },
  { id: 'death_ray', name: 'DEATH RAY', desc: 'CONTINUOUS LASER BEAM', upgrade1: 'damage', upgrade2: 'pierce',
    color: '#ff2244', icon: [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'sniper', name: 'SNIPER', desc: 'MASSIVE HITSCAN SHOT', upgrade1: 'proj_speed', upgrade2: 'damage',
    color: '#4488ff', icon: [[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1]] },
  { id: 'bullet_hell', name: 'BULLET HELL', desc: 'ALL SHOTS HOME ON ENEMIES', upgrade1: 'projectile', upgrade2: 'fire_rate',
    color: '#ffff44', icon: [[1,0,0,0,1],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[1,0,0,0,1]] },
  { id: 'shockwave', name: 'SHOCKWAVE', desc: 'EXPANDING WAVE PUSHES ALL', upgrade1: 'proj_size', upgrade2: 'pierce',
    color: '#44ffaa', icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]] },
  { id: 'meteor', name: 'METEOR', desc: 'ROCKS FALL FROM THE SKY', upgrade1: 'damage', upgrade2: 'proj_size',
    color: '#ff8800', icon: [[0,0,1,0,0],[0,1,1,1,0],[0,1,1,1,0],[1,1,1,1,1],[0,0,0,0,0]] },
  { id: 'nova_pulse', name: 'NOVA PULSE', desc: 'GRAVITY ORB SUCKS + EXPLODES', upgrade1: 'orbital', upgrade2: 'damage',
    color: '#ff44aa', icon: [[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1],[0,0,0,0,0],[1,0,1,0,1]] },
  { id: 'blade_storm', name: 'BLADE STORM', desc: 'SPINNING BLADES FLY OUT', upgrade1: 'thorns', upgrade2: 'orbital',
    color: '#ff8888', icon: [[0,1,0,1,0],[1,0,0,0,1],[0,0,1,0,0],[1,0,0,0,1],[0,1,0,1,0]] },
  { id: 'railgun', name: 'RAILGUN', desc: 'INSTANT LINE THROUGH ALL', upgrade1: 'proj_speed', upgrade2: 'pierce',
    color: '#88ffff', icon: [[1,0,0,0,0],[1,1,0,0,0],[1,1,1,1,1],[1,1,0,0,0],[1,0,0,0,0]] },
  // Utility
  { id: 'bullet_time', name: 'BULLET TIME', desc: 'PERIODIC SLOW-MO PULSE', upgrade1: 'move_speed', upgrade2: 'fire_rate',
    color: '#aaccff', icon: [[0,1,1,1,0],[1,0,0,1,0],[1,0,1,0,0],[1,0,0,0,0],[0,1,1,1,0]] },
  { id: 'second_life', name: 'SECOND LIFE', desc: 'OVERHEAL GOLDEN SHIELD', upgrade1: 'life_steal', upgrade2: 'max_hp',
    color: '#44ff88', icon: [[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,1,0,1,0]] },
  { id: 'warp_field', name: 'WARP FIELD', desc: 'MAGNET AURA + ENEMY PUSH', upgrade1: 'pickup_radius', upgrade2: 'move_speed',
    color: '#cc88ff', icon: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]] },
];

// Get active combos
function getActiveCombos(): Combo[] {
  return COMBOS.filter(c => {
    const lv1 = game.upgradeLevels.get(c.upgrade1) || 0;
    const lv2 = game.upgradeLevels.get(c.upgrade2) || 0;
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
    id: 'chain', name: 'CHAIN', desc: 'LIGHTNING ARC', color: '#4488ff',
    icon: [[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1]],
  },
  {
    id: 'explosion', name: 'EXPLOSION', desc: 'AOE BLAST', color: '#ff6622',
    icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
  },
  {
    id: 'affix_lifesteal', name: 'VAMPIRIC', desc: 'HEAL EACH KILL', color: '#44ff44',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'freeze', name: 'FREEZE', desc: 'SLOW ENEMIES', color: '#88ddff',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'burn', name: 'BURN', desc: 'DAMAGE OVER TIME', color: '#ff4400',
    icon: [[0,0,1,0,0],[0,1,1,0,0],[0,1,1,1,0],[1,1,1,1,0],[0,1,1,0,0]],
  },
  {
    id: 'ricochet', name: 'RICOCHET', desc: 'BOUNCE ON KILL', color: '#ddaa44',
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
    id: 'drone', name: 'DRONE', desc: 'ORBITING TURRET', color: '#44ccff',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  },
  {
    id: 'shadow_clone', name: 'SHADOW', desc: 'ECHO CLONE', color: '#8844cc',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,0,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'nova_on_kill', name: 'NOVA', desc: 'EXPLODE ON KILL', color: '#ff4488',
    icon: [[1,0,1,0,1],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[1,0,1,0,1]],
  },
  {
    id: 'thunder', name: 'THUNDER', desc: 'RANDOM STRIKES', color: '#ffff44',
    icon: [[0,0,1,1,0],[0,1,1,0,0],[1,1,1,1,0],[0,0,1,1,0],[0,1,1,0,0]],
  },
  {
    id: 'poison_trail', name: 'TOXIN', desc: 'POISON TRAIL', color: '#44ff44',
    icon: [[0,0,0,0,0],[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'second_wind', name: '2ND WIND', desc: 'REVIVE ONCE', color: '#ffffff',
    icon: [[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,1,0,1,0]],
  },
  {
    id: 'shield_orb', name: 'SHIELD', desc: 'BLOCK 1 HIT/15S', color: '#44aaff',
    icon: [[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  },
  {
    id: 'magnet_pulse', name: 'MAGNET', desc: 'PULL ALL XP/10S', color: '#ff88ff',
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
    id: 'dash', name: 'DASH', desc: 'FAST DASH + DMG', color: '#44ffcc',
    icon: [[0,0,0,1,0],[0,0,1,1,0],[1,1,1,1,1],[0,0,1,1,0],[0,0,0,1,0]],
    cooldown: 90, // 1.5s
  },
  {
    id: 'grenade', name: 'GRENADE', desc: 'BIG EXPLOSION', color: '#ff6622',
    icon: [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
    cooldown: 240, // 4s
  },
  {
    id: 'shield_skill', name: 'BARRIER', desc: 'INVINCIBLE 3S', color: '#4488ff',
    icon: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    cooldown: 360, // 6s
  },
  {
    id: 'shockwave', name: 'SHOCKWAV', desc: 'MASSIVE PUSH', color: '#ffaa44',
    icon: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    cooldown: 180, // 3s
  },
];

// ── Weapon (single, stats modified by upgrades) ──
const weapon = {
  fireRate: 35,
  speed: 4,
  damage: 1,
  size: 3,
  pierce: 0,
  count: 1,
  spread: 0,
};

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

// ── Game state ──
const game = {
  time: 0,
  state: 'playing' as GameState,
  kills: 0,
  xp: 0,
  xpToLevel: 10,
  level: 1,
  gameOver: false,
  deathScreenTimer: 0,
  won: false,
  damageFlash: 0,
  shakeTimer: 0,
  pickupRadius: 16,
  magnetRadius: 20,
  // Boss/miniboss timers
  miniBossTimer: 30 * FPS,  // first miniboss at 30s
  bossTimer: 60 * FPS,      // first boss at 60s
  miniBossCount: 0,
  bossCount: 0,
  superBossSpawned: false,
  superBossTimer: Math.floor(5 * 60 * FPS), // at 5:00
  // Selection screen
  pendingLevelUps: 0,
  selectionOptions: [] as (Upgrade | Affix)[],
  selectionType: '' as 'levelup' | 'chest_common' | 'chest_rare',
  selectionHover: -1,
  selectionDelay: 0,  // frames before clicks are accepted
  // Upgrade levels
  upgradeLevels: new Map<string, number>(),
  // Combos
  activeCombos: [] as string[],
  codexOpen: false,
  // Active affixes
  activeAffixes: [] as string[],
  // Super rares
  activeSuperRares: [] as string[],
  // Orbitals
  orbitalAngle: 0,
  // Combo ability timers
  bladeStormAngle: 0,
  novaOrbActive: null as { x: number; y: number; dx: number; dy: number; life: number; maxLife: number } | null,
  shockwaveTimer: 0,
  meteorTimer: 0,
  carpetBombTimer: 0,
  sniperTimer: 0,
  railgunTimer: 0,
  bulletTimeTimer: 0,
  bulletTimeActive: 0,
  // Visual FX
  ghostTrail: [] as { x: number; y: number; dir: Dir; age: number }[],
  freezeFrame: 0,       // frames of freeze on boss kill
  freezeZoom: 0,        // zoom amount during freeze
  lightningTimer: 0,    // countdown to next lightning flash
  lightningFlash: 0,
  hitDirX: 0,           // direction of last damage taken
  hitDirY: 0,
  // Drones
  droneAngle: 0,
  droneCount: 0,
  // Shadow clone
  shadowClone: null as { x: number; y: number; trail: Vec[] } | null,
  // Thunder
  thunderTimer: 0,
  // Poison trail
  poisonTrails: [] as { x: number; y: number; life: number }[],
  // Second wind (one-time revive)
  secondWindUsed: false,
  // Shield orb
  shieldOrbTimer: 0, // cooldown timer (counts down from 900)
  shieldOrbActive: true, // is the shield ready?
  // Magnet pulse
  magnetPulseTimer: 0,
  // Nova on kill
  novaOnKillChance: 0.15,
  // Right-click skill
  activeSkill: null as Skill | null,
  skillCooldown: 0,
  skillActive: 0, // active duration (for dash/shield)
  // Dash state
  dashDx: 0,
  dashDy: 0,
};

const player = {
  x: MAP_W / 2 * TILE + 8,
  y: MAP_H / 2 * TILE + 8,
  hp: 100,
  maxHp: 100,
  speed: 1.5,
  dir: 'down' as Dir,
  shootCooldown: 0,
  invincible: 0,
  animFrame: 0,
  animTimer: 0,
  moving: false,
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
  rarity: 'common' | 'rare' | 'skill';
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
  if (e.key === 'Tab') { e.preventDefault(); game.codexOpen = !game.codexOpen; }
  if (e.key.toLowerCase() === 'm') { Music.nextTrack(); }
  if (e.key === 'Backspace') { e.preventDefault(); resetGame(); }
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
  if (!audioStarted) { audioStarted = true; Sound.init(); Music.setTrack(0); Music.start(); }
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
  const t = Math.min(1, minutes / 5); // 0→1 over first 5 minutes
  const t2 = Math.max(0, Math.min(1, (minutes - 5) / 10)); // 0→1 from 5-15 min (late game)
  // Exponential curve: slow early, ramps hard late
  const curve = t * t;
  const lateCurve = t * t * t;
  return {
    // Spawn interval: 90 frames early → 3 frames at 5min → 2 at 10min
    spawnInterval: Math.max(2, Math.floor(90 - lateCurve * 87 - t2 * 1)),
    // Batch: 1 early → 10 at 5min → 18 at 10min
    spawnBatch: Math.min(18, 1 + Math.floor(lateCurve * 9) + Math.floor(t2 * 8)),
    bruteChance: Math.min(0.7, 0.05 + curve * 0.55 + t2 * 0.1),
    hpMult: 1 + curve * 2.5 + t2 * 3,       // x1 → x3.5 at 5min → x6.5 at 10min
    speedMult: 1 + curve * 0.6 + t2 * 0.4,  // x1 → x1.6 at 5min → x2 at 10min
    contactDmg: Math.ceil(3 + curve * 12 + t2 * 10), // 3 → 15 at 5min → 25 at 10min
  };
}

// ── Spawn helpers ──
let spawnTimer = 60;

function findSpawnPos(): Vec | null {
  const camX = player.x - VIEW_W / 2;
  const camY = player.y - VIEW_H / 2;
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
    scout:    { hp: 2,  speed: 0.55 },
    brute:    { hp: 5,  speed: 0.35 },
    dasher:   { hp: 3,  speed: 0.3 },   // slow walk, fast dash
    splitter: { hp: 4,  speed: 0.45 },
    tank:     { hp: 12, speed: 0.18 },
    swarm:    { hp: 1,  speed: 0.7 },
    exploder: { hp: 2,  speed: 0.6 },
    caster:   { hp: 3,  speed: 0.25 },
  };
  const s = stats[type] || stats.scout;
  return {
    x: pos.x, y: pos.y,
    hp: Math.ceil(s.hp * diff.hpMult),
    maxHp: Math.ceil(s.hp * diff.hpMult),
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
  const hp = Math.ceil(15 * diff.hpMult);
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
  const hp = Math.ceil(40 * diff.hpMult);
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
  const hp = Math.ceil(120 * diff.hpMult);
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

function openSelection(type: 'levelup' | 'chest_common' | 'chest_rare' | 'skill_select') {
  game.selectionType = type;
  game.selectionHover = -1;
  game.selectionDelay = 20;
  if (type === 'levelup') Sound.levelUp();
  else Sound.chestOpen();

  if (type === 'skill_select') {
    // Super boss: choose a skill
    game.selectionOptions = pickRandom(SKILLS, 3);
    game.state = 'skill_select';
  } else if (type === 'chest_rare') {
    // Boss chest: affixes + super rares only (no skills)
    const availableAffixes = AFFIXES.filter(a => !game.activeAffixes.includes(a.id));
    const availableSuperRares = SUPER_RARES.filter(s => !game.activeSuperRares.includes(s.id));
    const allRare = [...availableAffixes, ...availableSuperRares];

    if (allRare.length === 0) {
      const fallback = pickRandomUpgrades(3);
      if (fallback.length === 0) { game.pendingLevelUps = 0; game.state = 'playing'; return; }
      game.selectionOptions = fallback;
      game.state = 'chest_common';
    } else {
      game.selectionOptions = pickRandom(allRare, 3);
      game.state = 'chest_rare';
    }
  } else {
    const upgrades = pickRandomUpgrades(3);
    if (upgrades.length === 0) {
      // All upgrades maxed — skip selection, drain pending
      game.pendingLevelUps = 0;
      game.state = 'playing';
      return;
    }
    game.selectionOptions = upgrades;
    game.state = type === 'levelup' ? 'levelup' : 'chest_common';
  }
}

function pickRandomUpgrades(n: number): Upgrade[] {
  const ownedIds = Array.from(game.upgradeLevels.keys());
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
    const lv = game.upgradeLevels.get(u.id) || 0;
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

function selectOption(index: number) {
  if (index < 0 || index >= game.selectionOptions.length) return;
  Sound.select();
  const option = game.selectionOptions[index];

  if (isSkill(option)) {
    // Right-click skill
    game.activeSkill = option;
    game.skillCooldown = 0;
    spawnParticles(player.x, player.y, 30, option.color, 4);
  } else if (isSuperRare(option)) {
    // Super rare
    game.activeSuperRares.push(option.id);
    spawnParticles(player.x, player.y, 35, option.color, 5);
    // Apply immediate effects
    if (option.id === 'drone') game.droneCount++;
    if (option.id === 'shadow_clone') {
      game.shadowClone = { x: player.x, y: player.y, trail: [] };
    }
    if (option.id === 'thunder') game.thunderTimer = 180;
    if (option.id === 'magnet_pulse') game.magnetPulseTimer = 600;
  } else if (isAffix(option)) {
    // Weapon affix
    game.activeAffixes.push(option.id);
    spawnParticles(player.x, player.y, 30, option.color, 4);
  } else {
    // Upgrade
    const upgrade = option as Upgrade;
    const currentLv = game.upgradeLevels.get(upgrade.id) || 0;
    const newLv = currentLv + 1;
    game.upgradeLevels.set(upgrade.id, newLv);
    upgrade.apply(newLv);
    spawnParticles(player.x, player.y, 20, '#8899aa', 3);
  }

  game.selectionOptions = [];

  // Check for queued level ups
  if (game.pendingLevelUps > 0) {
    game.pendingLevelUps--;
    openSelection('levelup');
  } else {
    game.state = 'playing';
  }
}

// ── Affix effects ──
function applyAffixOnHit(x: number, y: number, damage: number, hitEnemy: Enemy) {
  // Chain lightning
  if (game.activeAffixes.includes('chain')) {
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
  if (game.activeAffixes.includes('explosion')) {
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
  if (game.activeAffixes.includes('freeze') && hitEnemy.hp > 0) {
    hitEnemy.slowTimer = 120;
  }

  // Burn
  if (game.activeAffixes.includes('burn') && hitEnemy.hp > 0) {
    hitEnemy.burnTimer = 180;
    hitEnemy.burnDamage = Math.max(1, Math.floor(damage * 0.3));
  }
}

function applyAffixOnKill(_x: number, _y: number) {
  // Affix life steal
  if (game.activeAffixes.includes('affix_lifesteal') && Math.random() < 0.15) {
    player.hp = Math.min(player.hp + 1, player.maxHp);
  }
}

function applyRicochet(hitX: number, hitY: number, damage: number, hitEnemy: Enemy) {
  if (!game.activeAffixes.includes('ricochet')) return;
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
  // Codex pauses the game
  if (game.codexOpen) return;

  // Handle selection screens
  if (game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare' || game.state === 'skill_select') {
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

  // Player movement (keyboard + click-to-move)
  let dx = 0, dy = 0;
  if (keys['z'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['q'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  // Click-to-move: hold left click = move toward cursor
  if (mouse.down && dx === 0 && dy === 0) {
    const camX = player.x - VIEW_W / 2;
    const camY = player.y - VIEW_H / 2;
    const worldMX = mouse.x + camX;
    const worldMY = mouse.y + camY;
    const mdx = worldMX - player.x, mdy = worldMY - player.y;
    const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mdist > 8) { // dead zone to avoid jitter
      dx = mdx / mdist;
      dy = mdy / mdist;
    }
  }

  player.moving = dx !== 0 || dy !== 0;
  if (player.moving) {
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { dx /= len; dy /= len; }
    }
    const mx = dx * player.speed, my = dy * player.speed;
    if (canMove(player.x, player.y, mx, 0, 5)) player.x += mx;
    if (canMove(player.x, player.y, 0, my, 5)) player.y += my;
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
    else player.dir = dy > 0 ? 'down' : 'up';
  }

  player.animTimer++;
  // Ghost trail — record position every 4 frames when moving
  if (player.moving && game.time % 4 === 0) {
    game.ghostTrail.push({ x: player.x, y: player.y, dir: player.dir, age: 0 });
    if (game.ghostTrail.length > 8) game.ghostTrail.shift();
  }
  for (const g of game.ghostTrail) g.age++;
  if (player.animTimer > 8) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }
  if (player.invincible > 0) player.invincible--;

  // Auto-shooting toward nearest enemy
  if (player.shootCooldown > 0) player.shootCooldown--;
  let autoTarget: Enemy | null = null;
  let autoTargetDist = 250 * 250; // max auto-aim range
  for (const e of enemies) {
    const d = dist2(player, e);
    if (d < autoTargetDist) { autoTargetDist = d; autoTarget = e; }
  }
  if (autoTarget && player.shootCooldown <= 0) {
    const baseAim = aimDir(player, autoTarget);

    // Combo-aware projectile visuals
    const hasDR = game.activeCombos.includes('death_ray');
    const hasCB = game.activeCombos.includes('carpet_bomb');
    const hasMeteor = game.activeCombos.includes('meteor');
    const hasSniper = game.activeCombos.includes('sniper');
    const hasRailgun = game.activeCombos.includes('railgun');
    const hasBH = game.activeCombos.includes('bullet_hell');

    // Pick color based on most impactful combo
    const pColor = hasDR ? '#ff2244' : hasMeteor ? '#ff6600' : hasCB ? '#ff8822' :
                   hasSniper ? '#4488ff' : hasRailgun ? '#88ffff' : hasBH ? '#ffff44' : getWeaponColor();
    const pGlow = hasDR ? '#ff4466' : hasMeteor ? '#ffaa44' : hasCB ? '#ffaa44' :
                  hasSniper ? '#88bbff' : hasRailgun ? '#aaffff' : hasBH ? '#ffffaa' : pColor;
    // Size boost for carpet bomb / meteor
    const sizeBonus = hasCB ? 3 : hasMeteor ? 2 : 0;
    // Trail boost for death ray / sniper
    const trailBonus = hasDR ? 6 : hasSniper ? 5 : hasRailgun ? 4 : 0;
    // Speed boost for sniper/railgun
    const speedMult = hasRailgun ? 2.5 : hasSniper ? 1.8 : 1;
    // Life boost for long range
    const lifeBonus = hasSniper ? 40 : hasRailgun ? 20 : 0;

    for (let i = 0; i < weapon.count; i++) {
      let aim = baseAim;
      if (weapon.count > 1) {
        const spreadAngle = (i - (weapon.count - 1) / 2) * weapon.spread;
        aim = rotateVec(baseAim, spreadAngle);
      }
      lasers.push({
        x: player.x, y: player.y,
        dx: aim.x * weapon.speed * speedMult, dy: aim.y * weapon.speed * speedMult,
        life: 60 + lifeBonus, fromPlayer: true,
        damage: weapon.damage, size: weapon.size + sizeBonus,
        pierce: weapon.pierce, pierceHit: new Set(),
        color: pColor, glowColor: pGlow,
        trailLength: Math.min(8, 1 + Math.floor(weapon.damage / 2) + trailBonus),
      });
    }
    // Muzzle flash — bigger with combos
    const flashSize = (hasDR || hasCB || hasMeteor) ? 6 : 3;
    spawnParticles(player.x + baseAim.x * 6, player.y + baseAim.y * 6, flashSize, pColor, 2);
    player.shootCooldown = weapon.fireRate;
    Sound.shoot();
  }

  // Orbital
  const orbitalLv = game.upgradeLevels.get('orbital') || 0;
  if (orbitalLv > 0) {
    game.orbitalAngle += 0.05;
    // Spawn orbital projectiles every 20 frames
    if (game.time % 20 === 0) {
      for (let i = 0; i < orbitalLv; i++) {
        const angle = game.orbitalAngle + (i / orbitalLv) * Math.PI * 2;
        const ox = player.x + Math.cos(angle) * 30;
        const oy = player.y + Math.sin(angle) * 30;
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

  // ── Check combos ──
  game.activeCombos = getActiveCombos().map(c => c.id);

  // Combo: BULLET TIME — slow enemies every 15s
  if (game.activeCombos.includes('bullet_time') && game.time % (15 * FPS) === 0) {
    for (const e of enemies) {
      e.slowTimer = Math.max(e.slowTimer, 180); // 3s slow
    }
    spawnParticles(player.x, player.y, 20, '#aaccff', 3);
  }

  // Combo: WARP FIELD — permanent magnet for all drops
  if (game.activeCombos.includes('warp_field')) {
    for (const dr of drops) {
      const ddx = player.x - dr.x, ddy = player.y - dr.y;
      const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (ddist > 2) {
        dr.x += (ddx / ddist) * 3;
        dr.y += (ddy / ddist) * 3;
      }
    }
  }

  // ══ COMBO ABILITIES (periodic, massive, screen-filling) ══
  // Universal stat helpers
  const uMulti = weapon.count;             // multishot level (1+)
  const uCaliber = weapon.size;            // caliber (3+)
  const uFireRate = game.upgradeLevels.get('fire_rate') || 0;
  const uVelocity = weapon.speed;          // velocity (4+)
  const uDmg = weapon.damage;              // damage (1+)
  const uPierce = weapon.pierce;           // pierce (0+)
  const uLeech = game.upgradeLevels.get('life_steal') || 0;
  const uThorns = game.upgradeLevels.get('thorns') || 0;
  const uOrbital = game.upgradeLevels.get('orbital') || 0;
  const uSpeed = player.speed;             // move speed
  const uVitality = game.upgradeLevels.get('max_hp') || 0;
  const uMagnet = game.upgradeLevels.get('pickup_radius') || 0;

  // Combo heal helper (leech heals on combo kills)
  function comboHeal(amount: number) {
    if (uLeech > 0 && Math.random() < uLeech * 0.03) {
      player.hp = Math.min(player.hp + amount, player.maxHp + (game.activeCombos.includes('second_life') ? 30 + uVitality * 5 : 0));
      spawnParticles(player.x, player.y, 2, '#44ff44', 1);
    }
  }

  // BLADE STORM — ALL stats scale
  if (game.activeCombos.includes('blade_storm')) {
    const bladeFreq = Math.max(20, 90 - uFireRate * 8);
    if (game.time % bladeFreq === 0) {
      const swordCount = 4 + uMulti + uOrbital; // multishot + orbital bonus
      const bladeSpeed = 3 + uVelocity * 0.3 + uSpeed * 0.3;
      for (let s = 0; s < swordCount; s++) {
        const spreadAngle = (s / swordCount) * Math.PI * 2 + game.time * 0.01 + uSpeed * 0.1;
        bladeProjs.push({
          x: player.x, y: player.y,
          dx: Math.cos(spreadAngle) * bladeSpeed, dy: Math.sin(spreadAngle) * bladeSpeed,
          life: 60 + uPierce * 12 + uVelocity * 3, angle: spreadAngle,
        });
      }
      spawnParticles(player.x, player.y, 12, '#ff4488', 3);
    }
  }
  // Update blade projectiles
  for (let i = bladeProjs.length - 1; i >= 0; i--) {
    const bp = bladeProjs[i];
    bp.x += bp.dx; bp.y += bp.dy;
    bp.angle += 0.3; // spin like a helicopter
    bp.life--;
    if (bp.life <= 0) { bladeProjs.splice(i, 1); continue; }
    const bladeHitR = 16 + uCaliber * 2 + uMagnet;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (dist2(bp, e) < bladeHitR * bladeHitR) {
        const bladeDmg = Math.max(2, uDmg * 3 + uThorns * 2);
        e.hp -= bladeDmg;
        e.hitFlash = 6;
        comboHeal(1);
      }
    }
  }

  // NOVA PULSE — ALL stats scale
  if (game.activeCombos.includes('nova_pulse')) {
    const novaFreq = Math.max(2 * FPS, 5 * FPS - uFireRate * 20);
    if (!game.novaOrbActive && game.time % novaFreq === 0 && enemies.length > 0) {
      const target = enemies[Math.floor(Math.random() * Math.min(enemies.length, 20))];
      const aim = aimDir(player, target);
      const orbSpeed = 1.2 + uVelocity * 0.15;
      game.novaOrbActive = { x: player.x, y: player.y, dx: aim.x * orbSpeed, dy: aim.y * orbSpeed,
        life: 100 + uPierce * 15, maxLife: 100 + uPierce * 15 };
    }
    if (game.novaOrbActive) {
      const orb = game.novaOrbActive;
      orb.x += orb.dx; orb.y += orb.dy;
      orb.dx *= 0.98; orb.dy *= 0.98;
      orb.life--;
      const pullR = 60 + uCaliber * 5 + uMagnet * 8;
      const pullForce = 1.5 + uMagnet * 0.3;
      for (const e of enemies) {
        const dx = orb.x - e.x, dy = orb.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < pullR && d > 2) {
          e.x += (dx / d) * pullForce * (1 - d / pullR);
          e.y += (dy / d) * pullForce * (1 - d / pullR);
          // Thorns: damage while being sucked in
          if (uThorns > 0 && game.time % 15 === 0) { e.hp -= uThorns; e.hitFlash = 3; }
        }
      }
      if (orb.life <= 0) {
        const explR = 50 + uCaliber * 6;
        for (let a = 0; a < 24; a++) {
          const angle = (a / 24) * Math.PI * 2;
          particles.push({ x: orb.x, y: orb.y, dx: Math.cos(angle) * 5, dy: Math.sin(angle) * 5,
            life: 25, maxLife: 25, color: a % 3 === 0 ? '#ff44ff' : a % 3 === 1 ? '#ffffff' : '#aa22ff', size: 3 + uCaliber * 0.3 });
        }
        game.shakeTimer = 6 + uDmg; Sound.explosion();
        for (const e of enemies) {
          if (dist2(orb, e) < explR * explR) {
            e.hp -= uDmg * 4 + uThorns * 2;
            e.hitFlash = 12;
            comboHeal(2);
          }
        }
        game.novaOrbActive = null;
      }
    }
  }

  // SHOCKWAVE — ALL stats scale
  if (game.activeCombos.includes('shockwave')) {
    const swFreq = Math.max(2 * FPS, 8 * FPS - uFireRate * 30);
    game.shockwaveTimer--;
    if (game.shockwaveTimer <= 0) {
      game.shockwaveTimer = swFreq;
      game.shakeTimer = 12 + uDmg;
      Sound.shockwave();
      const swSpeed = 5 + uVelocity * 0.5 + uSpeed;
      const swRange = 350 + uCaliber * 30 + uMagnet * 20;
      const ringCount = 1 + Math.floor(uMulti / 3) + Math.floor(uOrbital / 2);
      for (let r = 0; r < ringCount; r++) {
        shockRings.push({ x: player.x, y: player.y, radius: 10 + r * 8, maxRadius: swRange, speed: swSpeed - r * 0.5, life: 60, color: r === 0 ? '#44ffaa' : '#ffffff' });
      }
      spawnParticles(player.x, player.y, 15, '#44ffaa', 4);
      // Vitality: temp shield during shockwave
      if (uVitality > 0) player.invincible = Math.max(player.invincible, 15);
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
          const pushForce = 20 + uDmg * 3 + uThorns * 2;
          e.x += (dx / d) * pushForce;
          e.y += (dy / d) * pushForce;
          e.hp -= uDmg * 2 + uThorns;
          comboHeal(1);
          e.hitFlash = 8;
        }
      }
    }
  }

  // METEOR — ALL stats scale
  if (game.activeCombos.includes('meteor')) {
    game.meteorTimer--;
    const meteorFreq = Math.max(1.5 * FPS, 6 * FPS - uFireRate * 30);
    if (game.meteorTimer <= 0) {
      game.meteorTimer = meteorFreq;
      const meteorCount = 1 + Math.floor(uMulti / 2) + Math.floor(uOrbital / 3);
      const meteorRadius = 35 + uCaliber * 5 + uMagnet * 3;
      const meteorDmg = uDmg * 8 + uThorns * 3;
      for (let mi = 0; mi < meteorCount; mi++) {
        let bestX = player.x + (Math.random() - 0.5) * 80;
        let bestY = player.y + (Math.random() - 0.5) * 80;
        const candidates = enemies.filter(e => dist2(player, e) < (200 + uVelocity * 20) * (200 + uVelocity * 20));
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
      if (false && player.invincible <= 0 && dist2(player, fm) < fm.radius * fm.radius) {
        player.hp -= Math.ceil(fm.damage * 0.3);
        player.invincible = 30; game.damageFlash = 10;
      }
      // Fire ground
      for (let fi = 0; fi < 6; fi++) {
        if (game.poisonTrails.length < 80) {
          game.poisonTrails.push({ x: fm.x + (Math.random() - 0.5) * fm.radius, y: fm.y + (Math.random() - 0.5) * fm.radius, life: 240 });
        }
      }
      fallingMeteors.splice(i, 1);
    }
  }

  // CARPET BOMB — ALL stats scale
  if (game.activeCombos.includes('carpet_bomb')) {
    const cbFreq = Math.max(2 * FPS, 8 * FPS - uFireRate * 30);
    game.carpetBombTimer--;
    if (game.carpetBombTimer <= 0) {
      game.carpetBombTimer = cbFreq;
      const bombCount = 5 + uMulti + Math.floor(uOrbital / 2);
      const bombRadius = 25 + uCaliber * 4 + uMagnet * 2;
      const bombDmg = uDmg * 4 + uThorns * 2;
      const horizontal = Math.random() > 0.5;
      const camXb = player.x - VIEW_W / 2;
      const camYb = player.y - VIEW_H / 2;
      const spread = 60 + uCaliber * 5; // wider spread with caliber
      for (let b = 0; b < bombCount; b++) {
        const delay = b * Math.max(3, 6 - uVelocity * 0.3); // faster sweep with velocity
        const bxp = horizontal
          ? camXb + (b / bombCount) * VIEW_W + (Math.random() - 0.5) * 30
          : player.x + (Math.random() - 0.5) * spread;
        const byp = horizontal
          ? player.y + (Math.random() - 0.5) * spread
          : camYb + (b / bombCount) * VIEW_H + (Math.random() - 0.5) * 30;
        const fallSpd = Math.max(30, 50 - uVelocity * 2);
        fallingMeteors.push({ x: bxp, y: byp, fallTimer: fallSpd + delay, radius: bombRadius, damage: bombDmg });
      }
    }
  }

  // DEATH RAY — ALL stats scale (continuous beam)
  if (game.activeCombos.includes('death_ray') && autoTarget) {
    const tickRate = Math.max(2, 5 - uFireRate);
    if (game.time % tickRate === 0) {
      const aim = aimDir(player, autoTarget);
      const rayLen = 250 + uPierce * 40 + uVelocity * 20;
      const rayWidth = 10 + uCaliber * 2;
      const rayDmg = uDmg * 2 + uThorns;
      for (let d = 10; d < rayLen; d += 8) {
        const rx = player.x + aim.x * d, ry = player.y + aim.y * d;
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (dist2({ x: rx, y: ry }, e) < rayWidth * rayWidth) {
            e.hp -= rayDmg;
            e.hitFlash = 3;
            comboHeal(1);
          }
        }
      }
    }
  }

  // SNIPER — ALL stats scale
  if (game.activeCombos.includes('sniper')) {
    const snFreq = Math.max(1 * FPS, 4 * FPS - uFireRate * 20);
    game.sniperTimer--;
    if (game.sniperTimer <= 0 && autoTarget) {
      game.sniperTimer = snFreq;
      const shotCount = 1 + Math.floor(uMulti / 3);
      const snipeDmg = uDmg * 10 + uThorns * 3;
      const lineLen = 500 + uVelocity * 30 + uPierce * 50;
      for (let si = 0; si < shotCount; si++) {
        const target = si === 0 ? autoTarget : enemies[Math.floor(Math.random() * enemies.length)];
        if (!target) continue;
        const aim = aimDir(player, target);
        beamLines.push({
          x1: player.x, y1: player.y,
          x2: player.x + aim.x * lineLen, y2: player.y + aim.y * lineLen,
          life: 12, color: '#4488ff', width: 2 + uCaliber * 0.5,
        });
        for (let d = 10; d < lineLen; d += 8) {
          const sx = player.x + aim.x * d, sy = player.y + aim.y * d;
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (dist2({ x: sx, y: sy }, e) < (10 + uCaliber) * (10 + uCaliber)) {
              e.hp -= snipeDmg; e.hitFlash = 10;
              comboHeal(2);
              spawnParticles(e.x, e.y, 4, '#4488ff', 3);
            }
          }
        }
      }
      game.shakeTimer = 3 + shotCount;
    }
  }

  // BULLET HELL — homing handled in laser update, scales naturally with multishot/fire rate

  // RAILGUN — ALL stats scale
  if (game.activeCombos.includes('railgun')) {
    const rgFreq = Math.max(1 * FPS, 3 * FPS - uFireRate * 15);
    game.railgunTimer--;
    if (game.railgunTimer <= 0 && autoTarget) {
      game.railgunTimer = rgFreq;
      const lineCount = 1 + Math.floor(uMulti / 4);
      const lineLen = 600 + uVelocity * 30 + uPierce * 40;
      const rgDmg = uDmg * 5 + uThorns * 2;
      for (let ri = 0; ri < lineCount; ri++) {
        const target = ri === 0 ? autoTarget : enemies[Math.floor(Math.random() * enemies.length)];
        if (!target) continue;
        const aim = aimDir(player, target);
        beamLines.push({
          x1: player.x, y1: player.y,
          x2: player.x + aim.x * lineLen, y2: player.y + aim.y * lineLen,
          life: 8, color: '#88ffff', width: 2 + uCaliber * 0.4,
        });
        for (let d = 10; d < lineLen; d += 6) {
          const rx = player.x + aim.x * d, ry = player.y + aim.y * d;
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (dist2({ x: rx, y: ry }, e) < (8 + uCaliber) * (8 + uCaliber)) {
              e.hp -= rgDmg; e.hitFlash = 8;
              comboHeal(1);
            }
          }
        }
      }
      game.shakeTimer = 2 + lineCount;
    }
  }

  // BULLET TIME — ALL stats scale
  if (game.activeCombos.includes('bullet_time')) {
    const btFreq = Math.max(8 * FPS, 15 * FPS - uFireRate * 30);
    game.bulletTimeTimer--;
    if (game.bulletTimeTimer <= 0) {
      game.bulletTimeTimer = btFreq;
      game.bulletTimeActive = Math.floor(3 * FPS + uPierce * 15 + uVelocity * 5);
      spawnParticles(player.x, player.y, 15, '#aaccff', 3);
      // Speed boost for player during bullet time
      if (uSpeed > 1.5) player.invincible = Math.max(player.invincible, 10);
    }
    if (game.bulletTimeActive > 0) {
      game.bulletTimeActive--;
      for (const e of enemies) { e.slowTimer = Math.max(e.slowTimer, 5); }
      // Damage during slow (thorns)
      if (uThorns > 0 && game.time % 30 === 0) {
        for (const e of enemies) {
          if (dist2(player, e) < (80 + uCaliber * 10) * (80 + uCaliber * 10)) {
            e.hp -= uThorns; e.hitFlash = 3;
          }
        }
      }
      // Heal during bullet time (vitality)
      if (uVitality > 0 && game.time % 60 === 0) {
        player.hp = Math.min(player.hp + 1, player.maxHp);
      }
      // Magnet pull during bullet time
      if (uMagnet > 0) {
        for (const dr of drops) {
          const ddx = player.x - dr.x, ddy = player.y - dr.y;
          const dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > 2) { dr.x += (ddx / dd) * 2; dr.y += (ddy / dd) * 2; }
        }
      }
    }
  }

  // WARP FIELD — ALL stats scale
  if (game.activeCombos.includes('warp_field')) {
    const wfRange = 50 + uMagnet * 20 + uSpeed * 10 + uCaliber * 5;
    const pullStr = 2.5 + uVelocity * 0.3 + uMagnet * 0.5;
    // Pull all drops
    for (const dr of drops) {
      const ddx = player.x - dr.x, ddy = player.y - dr.y;
      const dd = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dd > 2 && dd < wfRange * 3) {
        dr.x += (ddx / dd) * pullStr;
        dr.y += (ddy / dd) * pullStr;
      }
    }
    // Enemy push + damage aura
    if (game.time % 10 === 0) {
      for (const e of enemies) {
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < wfRange && d > 0) {
          const pushStr = 1.5 + uDmg * 0.3;
          e.x += (dx / d) * pushStr;
          e.y += (dy / d) * pushStr;
          // Thorns aura damage
          if (uThorns > 0) { e.hp -= uThorns; e.hitFlash = 2; comboHeal(1); }
        }
      }
    }
  }

  // ── Growing veins ──
  const minutesNow = game.time / (FPS * 60);
  // Spawn new veins over time (1 every ~30s, starting at 1 min, max 8 total)
  if (minutesNow >= 1 && veins.length < 8 && game.time % (30 * FPS) === 0 && veinSpawns.length > 0) {
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

  // ── Right-click skill ──
  if (game.skillCooldown > 0) game.skillCooldown--;
  if (mouse.rightClicked && game.activeSkill && game.skillCooldown <= 0 && game.skillActive <= 0) {
    const skill = game.activeSkill;
    game.skillCooldown = skill.cooldown;
    const camX = player.x - VIEW_W / 2;
    const camY = player.y - VIEW_H / 2;
    const worldMX = mouse.x + camX;
    const worldMY = mouse.y + camY;

    switch (skill.id) {
      case 'dash': {
        Sound.dash();
        const aim = aimDir(player, { x: worldMX, y: worldMY });
        game.dashDx = aim.x * 7;
        game.dashDy = aim.y * 7;
        game.skillActive = 20;
        player.invincible = 25;
        spawnParticles(player.x, player.y, 20, '#44ffcc', 4);
        // Damage enemies along path
        for (const e of enemies) {
          if (dist2(player, e) < 40 * 40) {
            e.hp -= weapon.damage * 3;
            e.hitFlash = 10;
          }
        }
        break;
      }
      case 'grenade': {
        Sound.explosion();
        const aim = aimDir(player, { x: worldMX, y: worldMY });
        const gx = player.x + aim.x * 120;
        const gy = player.y + aim.y * 120;
        // Big explosion
        spawnParticles(gx, gy, 40, '#ff6622', 6);
        spawnParticles(gx, gy, 25, '#ffaa44', 4);
        spawnParticles(gx, gy, 15, '#ffffff', 3);
        game.shakeTimer = 8;
        const aoeRadius = 80;
        for (const e of enemies) {
          if (dist2({ x: gx, y: gy }, e) < aoeRadius * aoeRadius) {
            e.hp -= weapon.damage * 5;
            e.hitFlash = 12;
          }
        }
        break;
      }
      case 'shield_skill': {
        game.skillActive = 180; // 3s
        player.invincible = 185;
        spawnParticles(player.x, player.y, 20, '#4488ff', 3);
        break;
      }
      case 'shockwave': {
        Sound.shockwave();
        const pushRadius = 120;
        // Massive expanding shockwave rings
        for (let ring = 0; ring < 3; ring++) {
          const ringR = 20 + ring * 25;
          for (let a = 0; a < 24; a++) {
            const angle = (a / 24) * Math.PI * 2;
            particles.push({
              x: player.x, y: player.y,
              dx: Math.cos(angle) * (3 + ring * 2), dy: Math.sin(angle) * (3 + ring * 2),
              life: 20 + ring * 5, maxLife: 25 + ring * 5,
              color: ring === 0 ? '#ffffff' : ring === 1 ? '#ffcc44' : '#ff8822',
              size: 3 - ring * 0.5,
            });
          }
        }
        // Center flash
        spawnParticles(player.x, player.y, 40, '#ffee88', 6);
        spawnParticles(player.x, player.y, 20, '#ffffff', 3);
        game.shakeTimer = 12;
        // Push ALL enemies in radius, massive force
        for (const e of enemies) {
          const ddx = e.x - player.x, ddy = e.y - player.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < pushRadius && d > 0) {
            const force = 40 * (1 - d / pushRadius);
            e.x += (ddx / d) * force;
            e.y += (ddy / d) * force;
            e.hp -= weapon.damage * 2;
            e.hitFlash = 12;
          }
        }
        break;
      }
    }
  }
  mouse.rightClicked = false;

  // Dash movement
  if (game.skillActive > 0 && game.activeSkill?.id === 'dash') {
    player.x += game.dashDx;
    player.y += game.dashDy;
    spawnParticles(player.x, player.y, 2, '#44ffcc', 1);
    game.skillActive--;
  } else if (game.skillActive > 0 && game.activeSkill?.id === 'shield_skill') {
    game.skillActive--;
  }

  // ── Drone (super rare) ──
  if (game.droneCount > 0) {
    game.droneAngle += 0.03;
    if (game.time % 15 === 0) {
      for (let i = 0; i < game.droneCount; i++) {
        const angle = game.droneAngle + (i / game.droneCount) * Math.PI * 2;
        const dx = player.x + Math.cos(angle) * 40;
        const dy = player.y + Math.sin(angle) * 40;
        // Find nearest enemy
        let closest: Enemy | null = null;
        let closestDist = 120 * 120;
        for (const e of enemies) {
          const d = dist2({ x: dx, y: dy }, e);
          if (d < closestDist) { closestDist = d; closest = e; }
        }
        if (closest) {
          const aim = aimDir({ x: dx, y: dy }, closest);
          lasers.push({
            x: dx, y: dy,
            dx: aim.x * 4, dy: aim.y * 4,
            life: 30, fromPlayer: true,
            damage: Math.max(1, Math.floor(weapon.damage * 0.4)),
            size: 2, pierce: 0, pierceHit: new Set(),
            color: '#44ccff', glowColor: '#88ddff', trailLength: 1,
          });
        }
      }
    }
  }

  // ── Shadow Clone ──
  if (game.shadowClone) {
    const sc = game.shadowClone;
    // Follow player with 2s delay via trail
    sc.trail.push({ x: player.x, y: player.y });
    const delayFrames = 120; // 2s
    if (sc.trail.length > delayFrames) {
      const pos = sc.trail.shift()!;
      sc.x = pos.x;
      sc.y = pos.y;
    }
    // Clone shoots using player weapon stats (60% power)
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
            damage: cloneDmg,
            size: Math.max(2, weapon.size - 1), pierce: clonePierce, pierceHit: new Set(),
            color: '#8844cc', glowColor: '#aa66ee', trailLength: 2,
          });
        }
      }
    }
  }

  // ── Thunder (random strikes every 3s) — with full visual + SFX ──
  if (game.activeSuperRares.includes('thunder')) {
    game.thunderTimer--;
    if (game.thunderTimer <= 0) {
      game.thunderTimer = 180; // 3s
      if (enemies.length > 0) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        target.hp -= weapon.damage * 4;
        target.hitFlash = 15;
        // Lightning bolt visual — from sky to target
        chainArcs.push({ x1: target.x, y1: target.y - 200, x2: target.x + (Math.random()-0.5)*30, y2: target.y, life: 15 });
        chainArcs.push({ x1: target.x + (Math.random()-0.5)*15, y1: target.y - 150, x2: target.x, y2: target.y, life: 12 });
        spawnParticles(target.x, target.y, 20, '#ffff88', 5);
        spawnParticles(target.x, target.y, 10, '#ffffff', 3);
        game.lightningFlash = 6;
        Sound.thunder();
      }
    }
  }

  // ── Poison Trail ──
  if (game.activeSuperRares.includes('poison_trail') && player.moving && game.time % 6 === 0 && game.poisonTrails.length < 80) {
    game.poisonTrails.push({ x: player.x, y: player.y, life: 300 }); // 5s
  }
  for (let i = game.poisonTrails.length - 1; i >= 0; i--) {
    const pt = game.poisonTrails[i];
    pt.life--;
    if (pt.life <= 0) { game.poisonTrails.splice(i, 1); continue; }
    // Damage enemies in trail
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

  // ── Shield Orb (blocks 1 hit every 15s) ──
  if (game.activeSuperRares.includes('shield_orb') && !game.shieldOrbActive) {
    game.shieldOrbTimer--;
    if (game.shieldOrbTimer <= 0) {
      game.shieldOrbActive = true;
      spawnParticles(player.x, player.y, 10, '#44aaff', 2);
    }
  }

  // ── Magnet Pulse (pull all XP every 10s) ──
  if (game.activeSuperRares.includes('magnet_pulse')) {
    game.magnetPulseTimer--;
    if (game.magnetPulseTimer <= 0) {
      game.magnetPulseTimer = 600; // 10s
      spawnParticles(player.x, player.y, 20, '#ff88ff', 4);
      // Mark all drops for magnet pull (will be pulled over next few frames)
      for (const dr of drops) {
        (dr as any)._magnetPull = 60; // 1 second of strong pull
      }
      // Visual — contracting magnet ring
      shockRings.push({ x: player.x, y: player.y, radius: 300, maxRadius: 10, speed: -8, life: 30, color: '#ff88ff' });
    }
  }

  // Update lasers
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    // BULLET HELL — homing: player projectiles curve toward nearest enemy
    if (l.fromPlayer && game.activeCombos.includes('bullet_hell')) {
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

          // Affix effects
          applyAffixOnHit(l.x, l.y, l.damage, e);
          applyComboOnHit(l, e);
          applyRicochet(l.x, l.y, l.damage, e);

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
      // Enemy projectile → player collision
      if (player.invincible <= 0) {
        const ddx = l.x - player.x, ddy = l.y - player.y;
        if (ddx * ddx + ddy * ddy < 8 * 8) {
          player.hp -= l.damage;
          player.invincible = 30;
          game.damageFlash = 8;
          game.shakeTimer = 4;
          game.hitDirX = l.x - player.x;
          game.hitDirY = l.y - player.y;
          Sound.hit();
          spawnParticles(player.x, player.y, 6, '#ff2266', 2);
          lasers.splice(i, 1);
        }
      }
    }
  }

  // Enemy → player collision (no push)
  const thornsLv = game.upgradeLevels.get('thorns') || 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (player.invincible <= 0) {
      const ddx = player.x - e.x, ddy = player.y - e.y;
      const hitR = e.type === 'superboss' ? 24 : e.type === 'boss' ? 20 : e.type === 'miniboss' ? 16 : e.type === 'tank' ? 16 : 12;
      if (ddx * ddx + ddy * ddy < hitR * hitR) {
        // Shield orb blocks hit
        if (game.shieldOrbActive && game.activeSuperRares.includes('shield_orb')) {
          game.shieldOrbActive = false;
          game.shieldOrbTimer = 900; // 15s cooldown
          player.invincible = 30;
          spawnParticles(player.x, player.y, 20, '#44aaff', 4);
          continue;
        }
        const diff = getDifficulty();
        const dmg = e.type === 'superboss' ? 30 : e.type === 'boss' ? 20 : e.type === 'miniboss' ? 15 : diff.contactDmg;
        player.hp -= dmg;
        player.invincible = 60;
        game.damageFlash = 12;
        game.shakeTimer = 8;
        game.hitDirX = e.x - player.x;
        game.hitDirY = e.y - player.y;
        Sound.hit();
        spawnParticles(player.x, player.y, 10, COL.playerVisor, 2);
        // Thorns (3x if BLADE STORM combo active)
        const bladeStorm = game.activeCombos.includes('blade_storm');
        if (thornsLv > 0) {
          const thornsDmg = thornsLv * 2 * (bladeStorm ? 3 : 1);
          e.hp -= thornsDmg;
          e.hitFlash = 8;
          spawnParticles(e.x, e.y, bladeStorm ? 15 : 5, bladeStorm ? '#ff8888' : '#ffaa88', bladeStorm ? 3 : 2);
          if (e.hp <= 0) { onEnemyKill(e, i); continue; }
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

    const ddx = player.x - e.x, ddy = player.y - e.y;
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
          const aim = aimDir(e, player);
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
      if (e.elite === 'fire_trail' && e.animTimer % 10 === 0 && game.poisonTrails.length < 80) {
        game.poisonTrails.push({ x: e.x, y: e.y, life: 180 });
      }
      if (e.elite === 'teleport') {
        e.teleportTimer!--;
        if (e.teleportTimer! <= 0) {
          e.teleportTimer = 90 + Math.floor(Math.random() * 60);
          // Teleport toward player
          const angle = Math.random() * Math.PI * 2;
          const tpDist = 40 + Math.random() * 60;
          spawnParticles(e.x, e.y, 8, '#8844cc', 2);
          e.x = player.x + Math.cos(angle) * tpDist;
          e.y = player.y + Math.sin(angle) * tpDist;
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
      dangerZones.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
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
          if (game.poisonTrails.length < 80) {
            game.poisonTrails.push({
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
      // Damage player
      if (player.invincible <= 0 && dist2(player, dz) < dz.radius * dz.radius) {
        player.hp -= dz.damage;
        player.invincible = 30;
        game.damageFlash = 10;
        Sound.hit();
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

  // Despawn out-of-map enemies (keep far ones alive for horde feel)
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
    // XP orbs despawn after 30s if far from player (perf)
    if (dr.type === 'xp' && dr.age > 30 * FPS) {
      const farDist = dist2(player, dr);
      if (farDist > 200 * 200) { drops.splice(i, 1); continue; }
    }

    const ddx = player.x - dr.x, ddy = player.y - dr.y;
    const ddist = Math.sqrt(ddx * ddx + ddy * ddy);

    // Magnet pulse pull (super rare — strong pull for 1s)
    if ((dr as any)._magnetPull > 0) {
      (dr as any)._magnetPull--;
      const pullForce = 6;
      if (ddist > 5) {
        dr.x += (ddx / ddist) * pullForce;
        dr.y += (ddy / ddist) * pullForce;
      }
    }
    // Normal magnet pull — only if player has pickup upgrades
    const hasMagnet = (game.upgradeLevels.get('pickup_radius') || 0) > 0;
    if (hasMagnet && ddist < game.magnetRadius) {
      const pull = dr.type === 'xp' ? 4 : 2.5;
      if (ddist > 2) {
        dr.x += (ddx / ddist) * pull;
        dr.y += (ddy / ddist) * pull;
      }
    }

    if (ddist < game.pickupRadius) {
      if (dr.type === 'xp') {
        game.xp += dr.value;
        spawnParticles(dr.x, dr.y, 5, COL.xpOrb, 1);
        // Queue all level ups
        while (game.xp >= game.xpToLevel) {
          game.xp -= game.xpToLevel;
          game.level++;
          game.xpToLevel = Math.floor(game.xpToLevel * 1.15);
          game.pendingLevelUps++;
        }
        // Open first level up if not already in a selection
        if (game.pendingLevelUps > 0 && game.state === 'playing') {
          game.pendingLevelUps--;
          openSelection('levelup');
        }
      } else if (dr.type === 'heart') {
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.hp + dr.value, player.maxHp);
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
    const ddx = player.x - ch.x, ddy = player.y - ch.y;
    if (ddx * ddx + ddy * ddy < 14 * 14) {
      ch.opened = true;
      ch.openTimer = 60;
      spawnParticles(ch.x, ch.y, 25, ch.rarity === 'rare' ? COL.chestRare : COL.chestLock, 3);
      openSelection(ch.rarity === 'skill' ? 'skill_select' : ch.rarity === 'rare' ? 'chest_rare' : 'chest_common');
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

  // 5 minute death wall
  if (game.time >= GAME_DURATION) {
    player.hp = 0;
  }

  // Clamp HP (prevent negative display, cap overheal)
  if (!game.activeCombos.includes('second_life')) {
    player.hp = Math.min(player.hp, player.maxHp);
  } else {
    const slShield = 20 + (game.upgradeLevels.get('max_hp') || 0) * 5 + weapon.size * 2;
    player.hp = Math.min(player.hp, player.maxHp + slShield);
  }

  // Second wind check
  if (player.hp <= 0 && game.activeSuperRares.includes('second_wind') && !game.secondWindUsed) {
    game.secondWindUsed = true;
    player.hp = Math.floor(player.maxHp * 0.3);
    player.invincible = 120; // 2s invincible
    spawnParticles(player.x, player.y, 40, '#ffffff', 5);
    spawnParticles(player.x, player.y, 30, '#44ff44', 4);
    game.damageFlash = 0;
  }

  // Game over — HERO DEATH EXPLOSION
  if (player.hp <= 0) {
    game.state = 'gameover';
    game.deathScreenTimer = 0;
    game.won = game.time >= GAME_DURATION;
    if (game.won) Sound.victory(); else Sound.gameOver();
    Music.stop();

    // Massive death nova — kill all visible enemies
    const camX = player.x - VIEW_W / 2;
    const camY = player.y - VIEW_H / 2;
    for (const e of enemies) {
      const sx = e.x - camX, sy = e.y - camY;
      if (sx > -20 && sx < VIEW_W + 20 && sy > -20 && sy < VIEW_H + 20) {
        e.hp = 0;
        spawnParticles(e.x, e.y, 5, '#ff4488', 3);
      }
    }
    // Clean up dead enemies (no loot — it's a death, not a kill)
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) enemies.splice(i, 1);
    }

    // Epic explosion rings
    for (let ring = 0; ring < 5; ring++) {
      for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * Math.PI * 2;
        particles.push({
          x: player.x, y: player.y,
          dx: Math.cos(angle) * (2 + ring * 2.5), dy: Math.sin(angle) * (2 + ring * 2.5),
          life: 30 + ring * 8, maxLife: 40 + ring * 8,
          color: ring % 2 === 0 ? COL.playerVisor : '#ffffff',
          size: 4 - ring * 0.5,
        });
      }
    }
    spawnParticles(player.x, player.y, 50, COL.playerVisor, 8);
    spawnParticles(player.x, player.y, 30, '#ffffff', 5);
    game.shakeTimer = 20;
  }

  mouse.clicked = false;
}

function getCardLayout() {
  const cardW = 120;
  const cardH = 120;
  const gap = 12;
  const n = game.selectionOptions.length;
  const totalW = cardW * n + gap * (n - 1);
  const startX = (VIEW_W - totalW) / 2;
  const startY = (VIEW_H - cardH) / 2 + 15;
  return { cardW, cardH, gap, startX, startY };
}

// Get sorted order for selection options (owned first)
function getSortedSelectionMap(): number[] {
  const indices = game.selectionOptions.map((_, i) => i);
  indices.sort((a, b) => {
    const aOpt = game.selectionOptions[a];
    const bOpt = game.selectionOptions[b];
    const aOwned = 'apply' in aOpt && game.upgradeLevels.has((aOpt as Upgrade).id) ? 1 : 0;
    const bOwned = 'apply' in bOpt && game.upgradeLevels.has((bOpt as Upgrade).id) ? 1 : 0;
    return bOwned - aOwned;
  });
  return indices; // sortedMap[visualPos] = originalIndex
}

function updateSelection() {
  // Delay before accepting input (prevents accidental click from shooting)
  if (game.selectionDelay > 0) {
    game.selectionDelay--;
    mouse.clicked = false;
    return;
  }

  const { cardW, cardH, gap, startX, startY } = getCardLayout();
  const sortedMap = getSortedSelectionMap();

  game.selectionHover = -1;
  for (let vi = 0; vi < sortedMap.length; vi++) {
    const cx = startX + vi * (cardW + gap);
    if (mouse.x >= cx && mouse.x < cx + cardW &&
        mouse.y >= startY - 4 && mouse.y < startY + cardH + 4) {
      game.selectionHover = sortedMap[vi]; // map visual pos → original index
    }
  }

  // Click or keyboard
  if (mouse.clicked && game.selectionHover >= 0) {
    selectOption(game.selectionHover);
  }
  // Keys 1/2/3 select by visual position
  if (keys['1'] || keys['&']) { if (sortedMap[0] !== undefined) selectOption(sortedMap[0]); keys['1'] = false; keys['&'] = false; }
  if (keys['2'] || keys['é']) { if (sortedMap[1] !== undefined) selectOption(sortedMap[1]); keys['2'] = false; keys['é'] = false; }
  if (keys['3'] || keys['"']) { if (sortedMap[2] !== undefined) selectOption(sortedMap[2]); keys['3'] = false; keys['"'] = false; }

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
    // Big boom visual
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
    // Damage nearby enemies AND player
    for (const ne of enemies) {
      if (ne === e || ne.hp <= 0) continue;
      if (dist2({ x: e.x, y: e.y }, ne) < explR * explR) {
        ne.hp -= 5;
        ne.hitFlash = 8;
      }
    }
    // Damage player if close
    if (player.invincible <= 0 && dist2({ x: e.x, y: e.y }, player) < explR * explR) {
      player.hp -= 10;
      player.invincible = 30;
      game.damageFlash = 8;
      game.shakeTimer = 6;
    }
  }

  // Life steal (upgrade) — nerfed: 1% per level, heals 1 HP
  const lsLv = game.upgradeLevels.get('life_steal') || 0;
  if (lsLv > 0 && Math.random() < lsLv * 0.01) {
    // SECOND LIFE combo — overheal shield scales with vitality + caliber
    if (game.activeCombos.includes('second_life')) {
      const shieldCap = 20 + (game.upgradeLevels.get('max_hp') || 0) * 5 + weapon.size * 2;
      player.hp = Math.min(player.hp + 1, player.maxHp + shieldCap);
    } else {
      player.hp = Math.min(player.hp + 1, player.maxHp);
    }
    spawnParticles(player.x, player.y, 2, '#44ff44', 1);
  }

  // Affix life steal
  applyAffixOnKill(e.x, e.y);

  // Nova on kill (damage only, no recursive onEnemyKill to avoid crash)
  if (game.activeSuperRares.includes('nova_on_kill') && Math.random() < game.novaOnKillChance) {
    spawnParticles(e.x, e.y, 25, '#ff4488', 4);
    const novaR = 35;
    for (const ne of enemies) {
      if (ne === e || ne.hp <= 0) continue;
      if (dist2({ x: e.x, y: e.y }, ne) < novaR * novaR) {
        ne.hp -= weapon.damage * 2;
        ne.hitFlash = 8;
      }
    }
  }

  // Chest drops
  if (isSuperBoss) {
    chests.push({ x: e.x, y: e.y, rarity: 'skill', opened: false, openTimer: 0 });
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

function resetGame() {
  Music.setTrack(0); // restart from calm track
  Music.start();
  game.time = 0;
  game.state = 'playing';
  game.kills = 0;
  game.xp = 0;
  game.xpToLevel = 10;
  game.level = 1;
  game.deathScreenTimer = 0;
  game.won = false;
  game.pickupRadius = 16;
  game.magnetRadius = 20;
  game.miniBossTimer = 30 * FPS;
  game.bossTimer = 60 * FPS;
  game.miniBossCount = 0;
  game.bossCount = 0;
  game.superBossSpawned = false;
  game.superBossTimer = Math.floor(2.5 * 60 * FPS);
  game.pendingLevelUps = 0;
  game.activeCombos = [];
  game.codexOpen = false;
  game.selectionOptions = [];
  game.upgradeLevels = new Map();
  game.activeAffixes = [];
  game.activeSuperRares = [];
  game.orbitalAngle = 0;
  game.bladeStormAngle = 0;
  game.novaOrbActive = null;
  game.shockwaveTimer = 0;
  game.meteorTimer = 0;
  game.carpetBombTimer = 0;
  game.sniperTimer = 0;
  game.railgunTimer = 0;
  game.bulletTimeTimer = 0;
  game.bulletTimeActive = 0;
  game.droneAngle = 0;
  game.droneCount = 0;
  game.shadowClone = null;
  game.thunderTimer = 0;
  game.poisonTrails = [];
  game.secondWindUsed = false;
  game.shieldOrbTimer = 0;
  game.shieldOrbActive = true;
  game.magnetPulseTimer = 0;
  game.activeSkill = null;
  game.skillCooldown = 0;
  game.skillActive = 0;
  game.dashDx = 0;
  game.dashDy = 0;
  game.ghostTrail = [];
  game.freezeFrame = 0;
  game.freezeZoom = 0;
  game.lightningTimer = 300 + Math.floor(Math.random() * 300);
  game.lightningFlash = 0;

  weapon.fireRate = 35;
  weapon.speed = 4;
  weapon.damage = 1;
  weapon.size = 3;
  weapon.pierce = 0;
  weapon.count = 1;
  weapon.spread = 0;

  player.hp = 100;
  player.maxHp = 100;
  player.speed = 1.5;
  player.x = MAP_W / 2 * TILE + 8;
  player.y = MAP_H / 2 * TILE + 8;
  player.invincible = 0;
  player.shootCooldown = 0;
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
  const isRare = ch.rarity === 'rare' || ch.rarity === 'skill';

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
    // Body
    bx.fillStyle = isRare ? COL.chestRare : COL.chestBody;
    bx.fillRect(px - 10, cy - 5, 20, 12);
    // Lid
    bx.fillStyle = isRare ? '#cc6622' : '#aa7722';
    bx.fillRect(px - 11, cy - 9, 22, 6);
    // Lock
    bx.fillStyle = isRare ? COL.chestRareGlow : COL.chestLock;
    bx.fillRect(px - 2, cy - 3, 5, 5);
    // Sparkle
    if (Math.floor(game.time / 12) % 3 === 0) {
      bx.fillStyle = '#ffffff';
      bx.fillRect(px + 7, cy - 8, 2, 2);
    }
    if (isRare && Math.floor(game.time / 8) % 2 === 0) {
      bx.fillStyle = '#ffcc44';
      bx.fillRect(px - 8, cy - 7, 2, 2);
    }
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
  // Camera shake
  let shakeX = 0, shakeY = 0;
  if (game.shakeTimer > 0) {
    shakeX = (Math.random() - 0.5) * game.shakeTimer;
    shakeY = (Math.random() - 0.5) * game.shakeTimer;
    game.shakeTimer--;
  }
  if (game.damageFlash > 0) game.damageFlash--;

  const camX = Math.floor(player.x - VIEW_W / 2 + shakeX);
  const camY = Math.floor(player.y - VIEW_H / 2 + shakeY);

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

  // ══ WALL EYES — massive eyes in wall clusters that follow the player ══
  for (const we of wallEyes) {
    const sz = (we as any).size || 20;
    const esx = we.x - camX, esy = we.y - camY;
    if (esx < -sz * 2 || esx > VIEW_W + sz * 2 || esy < -sz * 2 || esy > VIEW_H + sz * 2) continue;

    // Pupil tracks player
    const edx = player.x - we.x, edy = player.y - we.y;
    const ed = Math.sqrt(edx * edx + edy * edy);
    const maxLook = sz * 0.2;
    const lookX = ed > 0 ? (edx / ed) * maxLook : 0;
    const lookY = ed > 0 ? (edy / ed) * maxLook * 0.6 : 0;

    const ex = Math.floor(esx), ey = Math.floor(esy);
    // Blinking — eye closes and opens slowly
    const blinkCycle = Math.sin(game.time * 0.008 + we.x * 0.3 + we.y * 0.7);
    const blinkPhase = blinkCycle > 0.85 ? (1 - (blinkCycle - 0.85) / 0.15) : 1; // 0→1, 0=closed
    if (blinkPhase < 0.05) continue; // fully closed, skip drawing

    const eyeW = sz, eyeH = sz * 0.65 * blinkPhase; // taller = more open
    const pupilR = sz * 0.25;

    // Eye socket — dark void
    bx.fillStyle = '#000000';
    bx.beginPath();
    bx.ellipse(ex, ey, eyeW + 2, eyeH + 2, 0, 0, Math.PI * 2);
    bx.fill();

    // Eye shape — pointed at corners (almond shape)
    bx.save();
    bx.beginPath();
    bx.moveTo(ex - eyeW, ey);
    bx.quadraticCurveTo(ex, ey - eyeH, ex + eyeW, ey);
    bx.quadraticCurveTo(ex, ey + eyeH, ex - eyeW, ey);
    bx.closePath();
    bx.clip();

    // Iris — dark red fill
    bx.fillStyle = '#1a0810';
    bx.fillRect(ex - eyeW, ey - eyeH, eyeW * 2, eyeH * 2);

    // Blood vessel veins in the eye
    bx.strokeStyle = '#330815';
    bx.globalAlpha = 0.4;
    bx.lineWidth = 1;
    for (let v = 0; v < 6; v++) {
      const va = (v / 6) * Math.PI * 2;
      bx.beginPath();
      bx.moveTo(ex + Math.cos(va) * pupilR * 1.5, ey + Math.sin(va) * pupilR);
      bx.lineTo(ex + Math.cos(va) * eyeW * 0.8, ey + Math.sin(va) * eyeH * 0.8);
      bx.stroke();
    }
    bx.globalAlpha = 1;

    // Iris circle (dark red/maroon)
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = '#441122';
    bx.globalAlpha = 0.5;
    bx.beginPath();
    bx.arc(ex + lookX, ey + lookY, pupilR * 1.8, 0, Math.PI * 2);
    bx.fill();

    // Pupil (slit, follows player)
    bx.fillStyle = '#ff2244';
    bx.globalAlpha = 0.7;
    bx.beginPath();
    bx.ellipse(ex + lookX, ey + lookY, pupilR * 0.4, pupilR, 0, 0, Math.PI * 2);
    bx.fill();

    // Hot center of pupil
    bx.fillStyle = '#ff4466';
    bx.globalAlpha = 0.5;
    bx.beginPath();
    bx.ellipse(ex + lookX, ey + lookY, pupilR * 0.2, pupilR * 0.6, 0, 0, Math.PI * 2);
    bx.fill();

    // Glint
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = 0.25;
    bx.beginPath();
    bx.arc(ex + lookX - pupilR * 0.3, ey + lookY - pupilR * 0.4, pupilR * 0.15, 0, Math.PI * 2);
    bx.fill();

    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
    bx.restore();

    // Eye outline glow
    bx.globalCompositeOperation = 'lighter';
    bx.strokeStyle = '#ff2244';
    bx.globalAlpha = 0.12 + Math.sin(game.time * 0.02 + we.x) * 0.06;
    bx.lineWidth = 2;
    bx.beginPath();
    bx.moveTo(ex - eyeW, ey);
    bx.quadraticCurveTo(ex, ey - eyeH, ex + eyeW, ey);
    bx.quadraticCurveTo(ex, ey + eyeH, ex - eyeW, ey);
    bx.closePath();
    bx.stroke();
    bx.globalAlpha = 1;
    bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
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

  // Poison trail / fire ground
  const hasMeteor = game.activeCombos.includes('meteor');
  const hasPoison = game.activeSuperRares.includes('poison_trail');
  for (const pt of game.poisonTrails) {
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

  // Ghost trail (afterimages)
  for (const g of game.ghostTrail) {
    const gx = g.x - camX, gy = g.y - camY;
    const alpha = Math.max(0, 0.25 - g.age * 0.01);
    if (alpha > 0) {
      bx.globalAlpha = alpha;
      bx.fillStyle = COL.playerVisor;
      bx.fillRect(Math.floor(gx) - 4, Math.floor(gy) - 5, 8, 10);
      bx.fillRect(Math.floor(gx) - 3, Math.floor(gy) - 8, 6, 5);
      bx.globalAlpha = 1;
    }
  }

  // Player
  if (game.state !== 'gameover') drawPlayer(player.x - camX, player.y - camY);

  // Shield orb visual
  if (game.activeSuperRares.includes('shield_orb') && game.shieldOrbActive) {
    const px = player.x - camX, py = player.y - camY;
    bx.strokeStyle = '#44aaff';
    bx.globalAlpha = 0.4 + Math.sin(game.time * 0.1) * 0.2;
    bx.beginPath();
    bx.arc(Math.floor(px), Math.floor(py), 12, 0, Math.PI * 2);
    bx.stroke();
    bx.globalAlpha = 1;
  }

  // Skill active visual (barrier)
  if (game.skillActive > 0 && game.activeSkill?.id === 'shield_skill') {
    const px = player.x - camX, py = player.y - camY;
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
  if (game.droneCount > 0) {
    for (let i = 0; i < game.droneCount; i++) {
      const angle = game.droneAngle + (i / game.droneCount) * Math.PI * 2;
      const dx = player.x + Math.cos(angle) * 40 - camX;
      const dy = player.y + Math.sin(angle) * 40 - camY;
      bx.fillStyle = '#44ccff';
      bx.fillRect(Math.floor(dx) - 3, Math.floor(dy) - 3, 6, 6);
      bx.fillStyle = '#88ddff';
      bx.fillRect(Math.floor(dx) - 1, Math.floor(dy) - 1, 2, 2);
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

  // ══ DEATH RAY visual — continuous beam to nearest enemy ══
  let rayTarget: Enemy | null = null;
  if (game.activeCombos.includes('death_ray')) {
    let rtDist = 250 * 250;
    for (const e of enemies) { const d = dist2(player, e); if (d < rtDist) { rtDist = d; rayTarget = e; } }
  }
  if (rayTarget) {
    const px = player.x - camX, py = player.y - camY;
    const aim = aimDir(player, rayTarget);
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

  // ══ SECOND LIFE visual — golden overheal shield ══
  if (game.activeCombos.includes('second_life') && player.hp > player.maxHp) {
    const px = player.x - camX, py = player.y - camY;
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
  }

  // ══ WARP FIELD visual — swirling vortex ══
  if (game.activeCombos.includes('warp_field')) {
    const px = player.x - camX, py = player.y - camY;
    const wfRange = 60 + (game.upgradeLevels.get('pickup_radius') || 0) * 15;
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
  }

  // ══ BULLET TIME visual — blue overlay when active ══
  if (game.bulletTimeActive > 0) {
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

  // ══ NOVA ORB visual — gravity sphere ══
  if (game.novaOrbActive) {
    const orb = game.novaOrbActive;
    const ox = orb.x - camX, oy = orb.y - camY;
    const lifeRatio = orb.life / orb.maxLife;
    const orbSize = 8 + (1 - lifeRatio) * 12; // grows as it slows

    bx.globalCompositeOperation = 'lighter';
    // Outer pull ring
    bx.strokeStyle = '#aa22ff';
    bx.globalAlpha = 0.3 + Math.sin(game.time * 0.2) * 0.15;
    bx.lineWidth = 2;
    bx.beginPath();
    bx.arc(Math.floor(ox), Math.floor(oy), orbSize + 20, 0, Math.PI * 2);
    bx.stroke();
    // Spinning gravity lines
    for (let g = 0; g < 6; g++) {
      const ga = game.time * 0.1 + (g / 6) * Math.PI * 2;
      const gx = ox + Math.cos(ga) * (orbSize + 15);
      const gy = oy + Math.sin(ga) * (orbSize + 15);
      bx.fillStyle = '#cc44ff';
      bx.globalAlpha = 0.5;
      bx.fillRect(gx - 1, gy - 1, 2, 2);
    }
    // Core
    bx.fillStyle = '#ff44ff';
    bx.globalAlpha = 0.8;
    bx.beginPath();
    bx.arc(Math.floor(ox), Math.floor(oy), orbSize, 0, Math.PI * 2);
    bx.fill();
    // Bright center
    bx.fillStyle = '#ffffff';
    bx.globalAlpha = 0.6;
    bx.beginPath();
    bx.arc(Math.floor(ox), Math.floor(oy), orbSize * 0.4, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    bx.lineWidth = 1;
    bx.globalCompositeOperation = 'source-over';
  }

  // Orbital orbs (visible glowing spheres)
  const orbLv = game.upgradeLevels.get('orbital') || 0;
  if (orbLv > 0) {
    for (let oi = 0; oi < orbLv; oi++) {
      const angle = game.orbitalAngle + (oi / orbLv) * Math.PI * 2;
      const ox = player.x + Math.cos(angle) * 30 - camX;
      const oy = player.y + Math.sin(angle) * 30 - camY;
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
      const tx = player.x + Math.cos(trailAngle) * 30 - camX;
      const ty = player.y + Math.sin(trailAngle) * 30 - camY;
      bx.fillStyle = '#6666ff';
      bx.globalAlpha = 0.3;
      bx.fillRect(Math.floor(tx) - 2, Math.floor(ty) - 2, 4, 4);
      bx.globalAlpha = 1;
    }
  }

  // Shadow clone
  if (game.shadowClone) {
    const scx = game.shadowClone.x - camX, scy = game.shadowClone.y - camY;
    bx.globalAlpha = 0.5;
    bx.fillStyle = '#8844cc';
    bx.fillRect(Math.floor(scx) - 4, Math.floor(scy) - 5, 8, 10);
    bx.fillStyle = '#aa66ee';
    bx.fillRect(Math.floor(scx) - 3, Math.floor(scy) - 8, 6, 5);
    bx.fillStyle = '#cc88ff';
    bx.fillRect(Math.floor(scx) - 2, Math.floor(scy) - 7, 4, 1);
    bx.globalAlpha = 1;
  }

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
    // Pulsing arrow
    const pulse = Math.sin(game.time * 0.1) * 0.3 + 0.7;
    const isRare = ch.rarity === 'rare' || ch.rarity === 'skill';
    const color = isRare ? COL.chestRare : COL.chestLock;
    bx.globalCompositeOperation = 'lighter';
    bx.fillStyle = color;
    bx.globalAlpha = pulse;
    // Diamond arrow shape
    bx.fillRect(ix - 3, iy - 3, 6, 6);
    bx.fillRect(ix - 1, iy - 5, 2, 2);
    bx.fillRect(ix - 1, iy + 3, 2, 2);
    bx.fillRect(ix - 5, iy - 1, 2, 2);
    bx.fillRect(ix + 3, iy - 1, 2, 2);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'source-over';
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

  // ── Selection overlay ──
  if (game.state === 'levelup' || game.state === 'chest_common' || game.state === 'chest_rare' || game.state === 'skill_select') {
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

  // Damage flash — directional red indicator
  if (game.damageFlash > 0) {
    const alpha = game.damageFlash / 15;
    // Light overall tint
    bx.fillStyle = '#330000';
    bx.globalAlpha = alpha * 0.5;
    bx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Directional indicator — thick red bar on the side the hit came from
    const hd = Math.sqrt(game.hitDirX * game.hitDirX + game.hitDirY * game.hitDirY);
    if (hd > 0) {
      const nx = game.hitDirX / hd, ny = game.hitDirY / hd;
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

  // Low HP warning — pulsing dark red vignette
  if (player.hp < player.maxHp * 0.3 && player.hp > 0) {
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

  // HP bar (left side)
  const hpBarW = 80;
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  bx.fillStyle = '#220000';
  bx.fillRect(4, 14, hpBarW, 8);
  const hpColor = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#ccaa22' : '#cc3333';
  bx.fillStyle = hpColor;
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 8);
  bx.fillStyle = '#ffffff';
  bx.fillRect(4, 14, Math.floor(hpBarW * hpRatio), 1);
  drawText(Math.max(0, player.hp) + '/' + player.maxHp, 6, 15, '#ffffff');

  // Kills
  drawText('K:' + game.kills, 4, 26, '#aaaaaa');

  // XP bar (full width, bottom of screen)
  const xpRatio = game.xp / game.xpToLevel;
  const xpBarY = VIEW_H - 10;
  bx.fillStyle = '#113333';
  bx.fillRect(4, xpBarY, barW, 7);
  bx.fillStyle = COL.xpOrb;
  bx.fillRect(4, xpBarY, Math.floor(barW * xpRatio), 7);
  bx.fillStyle = COL.xpOrbGlow;
  bx.fillRect(4, xpBarY, Math.floor(barW * xpRatio), 1);
  // Level text centered on XP bar
  const lvText = 'LV ' + game.level;
  drawText(lvText, VIEW_W / 2 - textWidth(lvText, 1) / 2, xpBarY + 1, '#ffffff', 1);

  // Weapon name + affix icons
  const wName = getWeaponName();
  const wColor = getWeaponColor();
  drawText(wName, 4, 38, wColor);

  let affixX = 4 + textWidth(wName) + 4;
  for (const affixId of game.activeAffixes) {
    const affix = AFFIXES.find(a => a.id === affixId);
    if (affix) {
      drawIcon(affix.icon, affixX, 39, affix.color);
      affixX += 8;
    }
  }

  // Upgrade slots (bottom of screen, above XP bar)
  const barY = VIEW_H - 24;
  const upgrades = Array.from(game.upgradeLevels.entries());
  let ux = 4;
  // Draw empty slots first
  for (let s = 0; s < MAX_UPGRADES; s++) {
    bx.fillStyle = '#111122';
    bx.fillRect(ux + s * 18, barY, 14, 12);
    bx.fillStyle = '#222233';
    bx.fillRect(ux + s * 18, barY, 14, 1);
    bx.fillRect(ux + s * 18, barY + 11, 14, 1);
    bx.fillRect(ux + s * 18, barY, 1, 12);
    bx.fillRect(ux + s * 18 + 13, barY, 1, 12);
  }
  // Fill with owned upgrades
  for (let i = 0; i < upgrades.length; i++) {
    const [id, lv] = upgrades[i];
    const upg = UPGRADES.find(u => u.id === id);
    if (upg) {
      const upgColor = lv >= MAX_UPGRADE_LEVEL ? '#44ff88' : '#8899aa';
      drawIcon(upg.icon, ux + i * 18 + 2, barY + 2, upgColor);
      drawText('' + lv, ux + i * 18 + 8, barY + 2, '#ffffff', 1);
    }
  }

  // Skill cooldown (bottom right)
  if (game.activeSkill) {
    const skX = VIEW_W - 50;
    const skY = VIEW_H - 30;
    const sk = game.activeSkill;
    const cdRatio = game.skillCooldown / sk.cooldown;
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
      const cdSec = Math.ceil(game.skillCooldown / FPS);
      drawText(cdSec + 'S', skX + 10, skY + 12, '#888899', 1);
    } else {
      drawText('READY', skX + 10, skY + 12, '#44ff88', 1);
    }
  }

  // Super rare icons (right side under minimap)
  if (game.activeSuperRares.length > 0) {
    let srY = 56;
    for (const srId of game.activeSuperRares) {
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

  // Minimap
  const mmX = VIEW_W - 52, mmY = 4, mmS = 48;
  bx.fillStyle = 'rgba(0,0,0,0.5)';
  bx.fillRect(mmX, mmY, mmS, mmS);
  for (let y = 0; y < mmS; y++) {
    for (let x = 0; x < mmS; x++) {
      const tx = Math.floor(x / mmS * MAP_W);
      const ty = Math.floor(y / mmS * MAP_H);
      const t = map[ty]?.[tx] ?? 0;
      if (t === 3) { bx.fillStyle = COL.darkRock; bx.fillRect(mmX + x, mmY + y, 1, 1); }
      else if (t === 2) { bx.fillStyle = COL.rock1; bx.fillRect(mmX + x, mmY + y, 1, 1); }
    }
  }
  bx.fillStyle = COL.playerVisor;
  const pmx = mmX + (player.x / (MAP_W * TILE)) * mmS;
  const pmy = mmY + (player.y / (MAP_H * TILE)) * mmS;
  bx.fillRect(pmx - 1, pmy - 1, 2, 2);
  bx.fillStyle = COL.enemyEye;
  for (const e of enemies) {
    const emx = mmX + (e.x / (MAP_W * TILE)) * mmS;
    const emy = mmY + (e.y / (MAP_H * TILE)) * mmS;
    if (e.type === 'superboss') {
      bx.fillStyle = '#ff44ff';
      bx.fillRect(emx - 2, emy - 2, 4, 4);
      bx.fillStyle = COL.enemyEye;
    } else if (e.type === 'boss') {
      bx.fillStyle = COL.bossEye;
      bx.fillRect(emx - 1, emy - 1, 3, 3);
      bx.fillStyle = COL.enemyEye;
    } else if (e.type === 'miniboss') {
      bx.fillStyle = COL.minibossEye;
      bx.fillRect(emx - 1, emy - 1, 2, 2);
      bx.fillStyle = COL.enemyEye;
    } else {
      bx.fillRect(emx, emy, 1, 1);
    }
  }
}

// Stat gain description for each upgrade
function getStatGain(id: string, newLv: number): string {
  switch (id) {
    case 'fire_rate': return '-1 COOLDOWN';
    case 'damage': return '+1 DMG';
    case 'move_speed': return '+0.15 SPD';
    case 'max_hp': return '+10 MAX HP';
    case 'pickup_radius': return '+12 RANGE';
    case 'projectile': return '+1 PROJ';
    case 'pierce': return '+1 PIERCE';
    case 'proj_size': return '+1 SIZE';
    case 'proj_speed': return '+0.5 SPD';
    case 'life_steal': return '+2% CHANCE';
    case 'thorns': return '+2 DMG';
    case 'orbital': return '+1 ORB';
    default: return 'LV ' + newLv;
  }
}

function drawSelectionScreen() {
  bx.fillStyle = 'rgba(0,0,0,0.8)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const isSkillSelect = game.state === 'skill_select';
  const isRare = game.state === 'chest_rare';
  const isChest = game.state === 'chest_common' || isRare;

  const { cardW, cardH, gap, startX, startY } = getCardLayout();

  // Title — positioned just above the cards
  const title = isSkillSelect ? 'CHOOSE SKILL' : isRare ? 'RARE LOOT' : isChest ? 'BONUS LOOT' : 'LEVEL UP';
  const titleColor = isSkillSelect ? '#ff44ff' : isRare ? '#ff8844' : isChest ? '#ffcc44' : '#44eeff';
  drawText(title, (VIEW_W - textWidth(title, 3)) / 2, startY - 40, titleColor, 3);

  // Rarity subtitle
  let subtitle = isSkillSelect ? '[ RIGHT CLICK ABILITY ]' : isRare ? '[ LEGENDARY ]' : isChest ? '[ COMMON ]' : '[ CHOOSE AN UPGRADE ]';
  const rarityColor = isSkillSelect ? '#cc44cc' : isRare ? '#ff6622' : isChest ? '#ccaa33' : '#6688aa';
  drawText(subtitle, (VIEW_W - textWidth(subtitle, 1)) / 2, startY - 18, rarityColor, 1);

  // Pending level ups count
  if (game.pendingLevelUps > 0 && !isChest && !isSkillSelect) {
    const pendingText = '+' + game.pendingLevelUps + ' MORE';
    drawText(pendingText, (VIEW_W - textWidth(pendingText, 1)) / 2, startY - 10, '#44eeff', 1);
  }
  // Slots indicator
  if (game.state === 'levelup') {
    const ownedCount = game.upgradeLevels.size;
    const slotsText = 'SLOTS: ' + ownedCount + '/' + MAX_UPGRADES;
    const slotsColor = ownedCount >= MAX_UPGRADES ? '#ff8844' : '#6688aa';
    drawText(slotsText, (VIEW_W - textWidth(slotsText, 1)) / 2, startY - 10, slotsColor, 1);
  }

  // Sort: owned upgrades first for visual priority
  const sorted = game.selectionOptions.map((opt, idx) => ({ opt, origIdx: idx }));
  sorted.sort((a, b) => {
    const aOwned = 'apply' in a.opt && game.upgradeLevels.has((a.opt as Upgrade).id) ? 1 : 0;
    const bOwned = 'apply' in b.opt && game.upgradeLevels.has((b.opt as Upgrade).id) ? 1 : 0;
    return bOwned - aOwned;
  });

  const t = game.time; // animation time

  for (let i = 0; i < sorted.length; i++) {
    const { opt, origIdx } = sorted[i];
    const cx = startX + i * (cardW + gap);
    const hovered = game.selectionHover === origIdx;

    const optIsSkill = isSkill(opt);
    const optIsSuperRare = isSuperRare(opt);
    const optIsAffix = isAffix(opt);
    const optIsUpgrade = !optIsSkill && !optIsSuperRare && !optIsAffix;
    const isOwned = optIsUpgrade && game.upgradeLevels.has((opt as Upgrade).id);
    const isHighRarity = optIsSkill || optIsSuperRare || optIsAffix;

    // Rarity color — owned items get cyan highlight
    const rarityCol = optIsSkill ? '#44ffcc' : optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : isOwned ? '#44eeff' : '#8899aa';

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
      const lv = game.upgradeLevels.get((opt as Upgrade).id) || 0;
      const pbW = cardW - 8;
      bx.fillStyle = '#111133';
      bx.fillRect(cx + 4, cardY + 3, pbW, 3);
      bx.fillStyle = '#44eeff';
      bx.fillRect(cx + 4, cardY + 3, Math.floor(pbW * lv / MAX_UPGRADE_LEVEL), 3);
      bx.fillStyle = '#88ffff';
      bx.fillRect(cx + 4, cardY + 3, Math.floor(pbW * lv / MAX_UPGRADE_LEVEL), 1);
    }

    // Tag
    const tagText = optIsSkill ? 'SKILL' : optIsSuperRare ? 'SUPER RARE' : optIsAffix ? 'LEGENDARY' : isOwned ? 'OWNED' : 'NEW';
    const tagCol = isOwned ? '#44eeff' : optIsSkill ? '#44ffcc' : optIsSuperRare ? '#ff44ff' : optIsAffix ? '#ff8844' : '#88aa44';
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
      const currentLv = game.upgradeLevels.get(upg.id) || 0;
      const newLv = currentLv + 1;

      // Stat gain
      const gain = getStatGain(upg.id, newLv);
      drawText(gain, cx + (cardW - textWidth(gain)) / 2, cardY + 64, '#44ff88');

      // Level or NEW badge
      if (currentLv > 0) {
        const lvText = 'LV ' + currentLv + '>' + newLv;
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
        const partnerLv = game.upgradeLevels.get(partnerId) || 0;
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
      drawText('RIGHT CLICK', cx + (cardW - textWidth('RIGHT CLICK', 1)) / 2, cardY + 68, '#44ffcc', 1);
      drawText(cd + 'S COOLDOWN', cx + (cardW - textWidth(cd + 'S COOLDOWN', 1)) / 2, cardY + 80, '#88aaaa', 1);
    } else {
      const label = optIsSuperRare ? 'SUPER RARE' : 'UNIQUE';
      const labelCol = optIsSuperRare ? '#ff44ff' : '#ff8844';
      drawText(label, cx + (cardW - textWidth(label, 1)) / 2, cardY + 68, labelCol, 1);
    }

    // Key hint (bottom-left, small)
    const hint = '' + (i + 1);
    drawText(hint, cx + 4, cardY + cardH - 10, '#444455', 1);
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
        const lv1 = game.upgradeLevels.get(combo.upgrade1) || 0;
        const lv2 = game.upgradeLevels.get(combo.upgrade2) || 0;
        const isActive = lv1 >= MAX_UPGRADE_LEVEL && lv2 >= MAX_UPGRADE_LEVEL;

        if (isActive) {
          // REMOVE combo — reset both upgrades to 0
          game.upgradeLevels.delete(combo.upgrade1);
          game.upgradeLevels.delete(combo.upgrade2);
          // Reset weapon stats affected
          weapon.fireRate = 35; weapon.speed = 4; weapon.damage = 1;
          weapon.size = 3; weapon.pierce = 0; weapon.count = 1; weapon.spread = 0;
          player.speed = 1.5; player.maxHp = 100;
          game.pickupRadius = 16; game.magnetRadius = 24;
          // Re-apply all remaining upgrades
          for (const [id, lv] of game.upgradeLevels) {
            const u = UPGRADES.find(uu => uu.id === id);
            if (u) u.apply(lv);
          }
        } else {
          // ACTIVATE combo — max both upgrades
          const upg1 = UPGRADES.find(u => u.id === combo.upgrade1)!;
          const upg2 = UPGRADES.find(u => u.id === combo.upgrade2)!;
          game.upgradeLevels.set(combo.upgrade1, MAX_UPGRADE_LEVEL);
          game.upgradeLevels.set(combo.upgrade2, MAX_UPGRADE_LEVEL);
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
  drawText('CLICK COMBO TO ACTIVATE', (VIEW_W - textWidth('CLICK COMBO TO ACTIVATE', 1)) / 2, 30, '#555566', 1);

  const colW = Math.floor(VIEW_W / 2);
  const startY = 44;
  const lineH = 52;

  for (let ci = 0; ci < COMBOS.length; ci++) {
    const combo = COMBOS[ci];
    const col = ci % 2;
    const row = Math.floor(ci / 2);
    const cx = col * colW + 8;
    const cy = startY + row * lineH;

    const lv1 = game.upgradeLevels.get(combo.upgrade1) || 0;
    const lv2 = game.upgradeLevels.get(combo.upgrade2) || 0;
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
  bx.fillStyle = 'rgba(0,0,0,0.7)';
  bx.fillRect(0, 0, VIEW_W, VIEW_H);

  const cx = VIEW_W / 2;
  const title = game.won ? 'YOU SURVIVED' : 'GAME OVER';
  const titleColor = game.won ? '#44ff44' : '#ff4444';
  drawText(title, cx - textWidth(title, 3) / 2, VIEW_H / 2 - 50, titleColor, 3);
  drawText(formatTime(game.time), cx - textWidth(formatTime(game.time), 2) / 2, VIEW_H / 2 - 20, '#ffcc44', 2);

  const killsText = 'KILLS: ' + game.kills;
  const levelText = 'LEVEL: ' + game.level;
  drawText(killsText, cx - textWidth(killsText) / 2, VIEW_H / 2 + 5, '#aaaaaa');
  drawText(levelText, cx - textWidth(levelText) / 2, VIEW_H / 2 + 18, COL.xpOrb);

  if (game.deathScreenTimer > 60) {
    const blink = Math.floor(game.deathScreenTimer / 20) % 2 === 0;
    if (blink) {
      const retryText = 'CLICK TO RETRY';
      drawText(retryText, cx - textWidth(retryText) / 2, VIEW_H / 2 + 40, '#888888');
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
