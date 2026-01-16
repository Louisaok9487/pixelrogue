
export type Vector2 = { x: number; y: number };

export enum EntityType {
  PLAYER,
  // Pets
  PET_DOG,
  PET_BIRD,
  // Enemies
  ENEMY_SLIME,
  ENEMY_SKELETON,
  ENEMY_BAT,
  ENEMY_ARCHER,
  ENEMY_GOLEM,
  ENEMY_BOSS,
  // Loot
  LOOT_XP,
  LOOT_HP,
  // New Items
  ITEM_POTION_RED,
  ITEM_POTION_BLUE,
  ITEM_SCROLL_NUKE,
  ITEM_BOOTS_SPEED,
  // New Environment & Special
  OBSTACLE_ROCK,
  OBSTACLE_BARREL,
  LOOT_CHEST
}

export enum HeroType {
  KNIGHT = 'KNIGHT',
  MAGE = 'MAGE',
  ROGUE = 'ROGUE',
}

export interface StatusEffects {
  burnTimer: number;   // Frames remaining
  poisonTimer: number; // Frames remaining
  freezeTimer: number; // Frames remaining
  stunTimer: number;   // Frames remaining
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
  isElite?: boolean; 
  // Status effects
  status: StatusEffects;
  // Pet specific
  targetId?: number; // For pets/enemies to track targets
}

export interface Debris {
  id: number;
  pos: Vector2;
  color: string;
  size: number;
  type: 'BLOOD' | 'BONE' | 'CRATER';
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
  type: 'SLASH' | 'LIGHTNING' | 'IMPACT' | 'NUKE' | 'EXPLOSION';
  pos: Vector2;
  // Slash
  angle?: number;
  range?: number;
  arc?: number; // Arc width in radians
  // Lightning
  targetPos?: Vector2;
  // Common
  color: string;
  life: number;
  maxLife: number;
  width?: number;
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
  // Procs
  applyBurn?: boolean;
  applyPoison?: boolean;
  applyFreeze?: boolean;
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
  heroReq?: HeroType; // Exclusive to specific hero
  apply: (stats: PlayerStats) => PlayerStats;
}

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  damage: number;
  attackSpeed: number; // Cooldown in frames
  pickupRange: number;
  critChance: number;
  critMultiplier: number; 
  projectileCount: number;
  specialCooldownMax: number; // Frames
  // Mechanics
  hasHoming: boolean;
  hasRicochet: boolean;
  pierceCount: number;
  weaponType: 'MELEE' | 'RANGED';
  // Visual & Area
  areaScale: number; // Multiplier for attack size
  // Elementals & Passives
  lightningChance: number; 
  burnChance: number;
  poisonChance: number;
  freezeChance: number;
  stunScreenChance: number; 
  // Defense & Utils
  shieldMax: number;
  shieldCurrent: number; // Runtime only, logic resets this to max on upgrade/init
  reflectDamage: number; // 0.0 to 1.0+ (percentage of damage reflected)
  // Pets
  petCount: number;
  petType: 'NONE' | 'DOG' | 'BIRD';
  // Evolution
  evolutionLevel: number;
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
  hitStop: number; 
}
