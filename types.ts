
export type Vector2 = { x: number; y: number };

export enum EntityType {
  PLAYER,
  ENEMY_SLIME,
  ENEMY_SKELETON,
  ENEMY_BAT,
  ENEMY_ARCHER,
  ENEMY_GOLEM,
  ENEMY_BOSS,
  LOOT_XP,
  LOOT_HP,
}

export enum HeroType {
  KNIGHT = 'KNIGHT',
  MAGE = 'MAGE',
  ROGUE = 'ROGUE',
}

export interface Entity {
  id: number;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  hp: number;
  maxHp: number;
  color: string;
  damage: number;
  speed: number;
  isDead: boolean;
  // Specific properties
  attackCooldown?: number;
  knockback?: Vector2;
  xpValue?: number;
  // Status effects
  freezeTimer?: number;
}

export interface Particle {
  id: number;
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface VisualEffect {
  id: number;
  type: 'SLASH' | 'LIGHTNING' | 'IMPACT';
  pos: Vector2;
  // Slash
  angle?: number;
  range?: number;
  // Lightning
  targetPos?: Vector2;
  // Common
  color: string;
  life: number;
  maxLife: number;
  width?: number;
  // Fix: Add optional size property to VisualEffect to support usage in GameCanvas
  size?: number;
}

export interface Projectile {
  id: number;
  pos: Vector2;
  vel: Vector2;
  damage: number;
  radius: number;
  color: string;
  isHostile: boolean; // true if hurts player
  life: number;
  // Mechanics
  pierce?: number;
  homing?: boolean;
  ricochet?: boolean;
}

export interface FloatingText {
  id: number;
  pos: Vector2;
  text: string;
  color: string;
  life: number;
  vel: Vector2;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'legendary';
  apply: (stats: PlayerStats) => PlayerStats;
}

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  damage: number;
  attackSpeed: number; // Cooldown in frames
  pickupRange: number;
  critChance: number;
  projectileCount: number;
  specialCooldownMax: number; // Frames
  // New Mechanics
  hasHoming: boolean;
  hasRicochet: boolean;
  freezeAura: boolean;
  pierceCount: number;
  weaponType: 'MELEE' | 'RANGED';
  // Visual & Area
  areaScale: number; // Multiplier for attack size
  lightningChance: number; // 0-1 chance to proc lightning
}

export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  isVictory: boolean;
  wave: number;
  score: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  time: number;
  specialCooldown: number;
}
