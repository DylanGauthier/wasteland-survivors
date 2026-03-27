import { TILE, MAP_W, MAP_H, FPS } from './constants';
import { Music } from './audio/MusicEngine';
import type {
  GameState, Dir, PlayerState, Laser, Enemy, Particle, Drop, Chest,
  ChainArc, DmgNumber, AshParticle, ShockRing, FallingMeteor, BladeProj,
  BeamLine, DangerZone, GrowingVein, Vec, Upgrade, Affix,
} from './types';

// ── Player names & colors ──
export const playerNames = ['JOUEUR 1', 'JOUEUR 2'];
export const PLAYER_COLORS = [
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
export const playerColors = ['#aa66ff', '#44ddff'];

// ── Title screen state ──
export const titleState = {
  mode: 0 as 0 | 1 | 2,
  playerCount: 1,
  editingPlayer: 0,
  nameInput: '',
  selectedColors: [0, 4],
  cursor: 0,
  pauseCursor: 0,
  ashParticles: [] as { x: number; y: number; dx: number; dy: number; life: number; maxLife: number }[],
};

// ── Create player ──
export function createPlayer(index: number): PlayerState {
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

// ── Players array (co-op) ──
export const players: PlayerState[] = [createPlayer(0), createPlayer(1)];
// Backward-compat aliases — point to "current" player context
export let player = players[0];
export let weapon = players[0].weapon;

// Switch alias context to a specific player
export function setPlayerContext(ps: PlayerState) {
  player = ps;
  weapon = ps.weapon;
}

export function getWeaponName(): string {
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

export function getWeaponColor(): string {
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
export const game = {
  time: 0,
  state: 'title' as GameState,
  kills: 0,
  xp: 0,
  xpToLevel: 10,
  level: 1,
  gameOver: false,
  deathScreenTimer: 0,
  won: false,
  shakeTimer: 0,
  miniBossTimer: 30 * FPS,
  bossTimer: 60 * FPS,
  miniBossCount: 0,
  bossCount: 0,
  superBossSpawned: false,
  superBossTimer: Math.floor(5 * 60 * FPS),
  megaBossSpawned: false,
  selectionOptions: [] as (Upgrade | Affix)[],
  selectionType: '' as 'levelup' | 'chest_common' | 'chest_rare',
  selectionHover: -1,
  selectionDelay: 0,
  selectingPlayer: 0,
  codexOpen: false,
  freezeFrame: 0,
  freezeZoom: 0,
  lightningTimer: 0,
  lightningFlash: 0,
};

// ── Entity arrays ──
export const lasers: Laser[] = [];
export const enemies: Enemy[] = [];
export const particles: Particle[] = [];
export const drops: Drop[] = [];
export const chests: Chest[] = [];
export const chainArcs: ChainArc[] = [];
export const dmgNumbers: DmgNumber[] = [];
export const shockRings: ShockRing[] = [];
export const fallingMeteors: FallingMeteor[] = [];
export const bladeProjs: BladeProj[] = [];
export const beamLines: BeamLine[] = [];
export const dangerZones: DangerZone[] = [];

// Floating damage numbers
export function spawnDmgNumber(x: number, y: number, value: number, color = '#ffffff') {
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
export const ashRain: AshParticle[] = [];
for (let i = 0; i < 120; i++) {
  ashRain.push({ x: Math.random() * 640, y: Math.random() * 480, speed: 0.15 + Math.random() * 0.5, size: 1 + Math.random() * 1.5, alpha: 0.12 + Math.random() * 0.2 });
}

// Callback to clear veins on reset (set by main.ts to avoid circular imports)
let _resetVeinsCallback: (() => void) | null = null;
export function registerResetVeinsCallback(cb: () => void) { _resetVeinsCallback = cb; }

// Audio started flag
export let audioStarted = false;
export function setAudioStarted(val: boolean) { audioStarted = val; }

// Spawn timer
export let spawnTimer = 60;
export function setSpawnTimer(val: number) { spawnTimer = val; }

// ── Reset game ──
export function resetGame() {
  Music.setTrack(5);
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

  // Clear veins via registered callback (avoids circular imports)
  if (_resetVeinsCallback) _resetVeinsCallback();
  spawnTimer = 60;
}
