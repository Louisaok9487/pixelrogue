
import { PlayerStats, Upgrade, HeroType } from './types';

// Rendering
export const RENDER_WIDTH = 320;
export const RENDER_HEIGHT = 180;
export const TILE_SIZE = 16;

export const LEVEL_CAP_XP_BASE = 50;
export const BOSS_SPAWN_SCORE = 1500; 

// Hero Definitions
export const HEROES: Record<HeroType, { name: string; description: string; stats: PlayerStats; color: string }> = {
  [HeroType.KNIGHT]: {
    name: 'Knight',
    description: 'Tanky melee fighter. Special: Shield Bash (Stun)',
    color: '#3b82f6',
    stats: {
      maxHp: 150,
      moveSpeed: 1.3,
      damage: 15,
      attackSpeed: 30,
      pickupRange: 40,
      critChance: 0.05,
      projectileCount: 0,
      specialCooldownMax: 300, // 5 seconds
      hasHoming: false,
      hasRicochet: false,
      freezeAura: false,
      pierceCount: 0,
      weaponType: 'MELEE',
      areaScale: 1.0,
      lightningChance: 0,
    }
  },
  [HeroType.MAGE]: {
    name: 'Mage',
    description: 'Glass cannon. Shoots magic bolts. Special: Arcane Nova',
    color: '#a855f7',
    stats: {
      maxHp: 70,
      moveSpeed: 1.4,
      damage: 8,
      attackSpeed: 20,
      pickupRange: 60,
      critChance: 0.1,
      projectileCount: 1,
      specialCooldownMax: 480, // 8 seconds
      hasHoming: true,
      hasRicochet: false,
      freezeAura: false,
      pierceCount: 0,
      weaponType: 'RANGED',
      areaScale: 1.0,
      lightningChance: 0,
    }
  },
  [HeroType.ROGUE]: {
    name: 'Rogue',
    description: 'Fast and deadly. Special: Shadow Dash (Invincible)',
    color: '#10b981',
    stats: {
      maxHp: 90,
      moveSpeed: 1.8,
      damage: 12,
      attackSpeed: 15,
      pickupRange: 40,
      critChance: 0.25,
      projectileCount: 0,
      specialCooldownMax: 180, // 3 seconds
      hasHoming: false,
      hasRicochet: false,
      freezeAura: false,
      pierceCount: 1,
      weaponType: 'MELEE',
      areaScale: 1.0,
      lightningChance: 0,
    }
  }
};

export const INITIAL_PLAYER_STATS = HEROES[HeroType.KNIGHT].stats; // Default fallbacks

// Upgrades Pool
export const UPGRADES: Upgrade[] = [
  {
    id: 'sharp_blade',
    name: 'Sharpness',
    description: '+20% Damage',
    rarity: 'common',
    apply: (s) => ({ ...s, damage: s.damage * 1.2 }),
  },
  {
    id: 'vitality',
    name: 'Vitality',
    description: '+30 Max HP',
    rarity: 'common',
    apply: (s) => ({ ...s, maxHp: s.maxHp + 30 }),
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    description: '+10% Move Speed',
    rarity: 'common',
    apply: (s) => ({ ...s, moveSpeed: s.moveSpeed * 1.1 }),
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    description: '-10% Attack Cooldown',
    rarity: 'rare',
    apply: (s) => ({ ...s, attackSpeed: Math.max(5, s.attackSpeed * 0.9) }),
  },
  {
    id: 'gigantism',
    name: 'Gigantism',
    description: '+25% Attack Area',
    rarity: 'rare',
    apply: (s) => ({ ...s, areaScale: s.areaScale * 1.25 }),
  },
  {
    id: 'thunderlord',
    name: 'Thunderlord',
    description: '20% Chance for Lightning',
    rarity: 'legendary',
    apply: (s) => ({ ...s, lightningChance: s.lightningChance + 0.2 }),
  },
  {
    id: 'magnet',
    name: 'Loot Magnet',
    description: '+50% Pickup Range',
    rarity: 'common',
    apply: (s) => ({ ...s, pickupRange: s.pickupRange * 1.5 }),
  },
  {
    id: 'multi_shot',
    name: 'Multishot',
    description: '+1 Projectile',
    rarity: 'legendary',
    apply: (s) => ({ ...s, projectileCount: s.projectileCount + 1 }),
  },
  {
    id: 'crit_master',
    name: 'Precision',
    description: '+15% Crit Chance',
    rarity: 'rare',
    apply: (s) => ({ ...s, critChance: s.critChance + 0.15 }),
  },
  {
    id: 'piercing',
    name: 'Spectral Tips',
    description: 'Projectiles pierce 1 extra enemy',
    rarity: 'rare',
    apply: (s) => ({ ...s, pierceCount: s.pierceCount + 1 }),
  },
  {
    id: 'ricochet',
    name: 'Bouncing shots',
    description: 'Projectiles bounce off walls/enemies',
    rarity: 'legendary',
    apply: (s) => ({ ...s, hasRicochet: true }),
  },
  {
    id: 'homing',
    name: 'Magic Missile',
    description: 'Projectiles seek enemies',
    rarity: 'legendary',
    apply: (s) => ({ ...s, hasHoming: true }),
  },
  {
    id: 'frost_aura',
    name: 'Frost Aura',
    description: 'Slows nearby enemies',
    rarity: 'rare',
    apply: (s) => ({ ...s, freezeAura: true }),
  }
];
