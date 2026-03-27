// ── Types ──
export interface Vec { x: number; y: number; }
export type Dir = 'up' | 'down' | 'left' | 'right';
export type GameState = 'title' | 'playing' | 'paused' | 'levelup' | 'chest_common' | 'chest_rare' | 'gameover';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: number[][]; // 5x5 pixel art
  apply: (level: number) => void;
}

export interface Combo {
  id: string;
  name: string;
  desc: string;
  upgrade1: string;
  upgrade2: string;
  color: string;
  icon: number[][];
}

export interface Affix {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
}

export interface SuperRare {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
}

export interface Skill {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: number[][];
  cooldown: number; // frames
}

export interface PlayerState {
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
  // Per-player pending level ups
  pendingLevelUps: number;
  kills: number;
  totalDamage: number;
  // Revive system (co-op)
  reviveProgress: number;
  deathX: number; deathY: number;
  // Per-player selection state
  selectionOptions: (Upgrade | Affix)[];
  selectionHover: number;
  selectionDone: boolean;
  // Pickup
  pickupRadius: number;
  magnetRadius: number;
  // Player identity
  playerIndex: number;
  visorColor: string;
  dead: boolean;
}

export interface Laser {
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

export interface Enemy {
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
  emergeTimer: number;
  slowTimer: number;
  burnTimer: number;
  burnDamage: number;
}

export interface Particle {
  x: number; y: number;
  dx: number; dy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

export interface Drop {
  x: number; y: number;
  type: 'xp' | 'heart';
  value: number;
  life: number;
  age: number;
  bobTimer: number;
}

export interface Chest {
  x: number; y: number;
  rarity: 'common' | 'rare';
  opened: boolean;
  openTimer: number;
}

export interface ChainArc {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;
}

export interface DmgNumber { x: number; y: number; value: number; life: number; color: string; }

export interface AshParticle { x: number; y: number; speed: number; size: number; alpha: number; }

export interface ShockRing {
  x: number; y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  life: number;
  color: string;
}

export interface FallingMeteor {
  x: number; y: number;
  fallTimer: number;
  radius: number;
  damage: number;
}

export interface BladeProj {
  x: number; y: number;
  dx: number; dy: number;
  life: number;
  angle: number;
}

export interface BeamLine {
  x1: number; y1: number; x2: number; y2: number;
  life: number; color: string; width: number;
}

export interface DangerZone {
  x: number; y: number;
  radius: number;
  warnTime: number;
  damage: number;
  life: number;
}

export type EliteAffix = 'fire_trail' | 'teleport' | 'reflect' | 'haste' | 'regen';

export interface GrowingVein {
  segments: Vec[];
  targetLen: number;
  growTimer: number;
  growRate: number;
  angle: number;
  startTime: number;
  width: number;
  maxWidth: number;
}
