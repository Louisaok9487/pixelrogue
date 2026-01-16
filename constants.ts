
import { PlayerStats, Upgrade, HeroType } from './types';

// Rendering
export const RENDER_WIDTH = 320;
export const RENDER_HEIGHT = 180;
export const TILE_SIZE = 16;

export const LEVEL_CAP_XP_BASE = 50;
export const BOSS_SPAWN_WAVE = 30; // Extended to 30 levels
export const WAVE_DURATION = 60 * 45; // 45 seconds per wave

// Hero Definitions
export const HEROES: Record<HeroType, { name: string; description: string; stats: PlayerStats; color: string }> = {
  [HeroType.KNIGHT]: {
    name: 'Knight',
    description: 'Tanky melee. Special: Shield Bash',
    color: '#3b82f6',
    stats: {
      maxHp: 150,
      moveSpeed: 1.56,
      damage: 15,
      attackSpeed: 30,
      pickupRange: 40,
      critChance: 0.05,
      critMultiplier: 2.0,
      projectileCount: 0,
      specialCooldownMax: 300,
      hasHoming: false,
      hasRicochet: false,
      pierceCount: 0,
      weaponType: 'MELEE',
      areaScale: 1.0,
      lightningChance: 0,
      burnChance: 0,
      poisonChance: 0,
      freezeChance: 0,
      stunScreenChance: 0,
      shieldMax: 0,
      shieldCurrent: 0,
      reflectDamage: 0,
      petCount: 0,
      petType: 'NONE',
      evolutionLevel: 0,
    }
  },
  [HeroType.MAGE]: {
    name: 'Mage',
    description: 'Ranged DPS. Special: Nova',
    color: '#a855f7',
    stats: {
      maxHp: 70,
      moveSpeed: 1.68,
      damage: 8,
      attackSpeed: 20,
      pickupRange: 60,
      critChance: 0.1,
      critMultiplier: 1.5,
      projectileCount: 1,
      specialCooldownMax: 480,
      hasHoming: true,
      hasRicochet: false,
      pierceCount: 0,
      weaponType: 'RANGED',
      areaScale: 1.0,
      lightningChance: 0,
      burnChance: 0,
      poisonChance: 0,
      freezeChance: 0,
      stunScreenChance: 0,
      shieldMax: 0,
      shieldCurrent: 0,
      reflectDamage: 0,
      petCount: 0,
      petType: 'NONE',
      evolutionLevel: 0,
    }
  },
  [HeroType.ROGUE]: {
    name: 'Rogue',
    description: 'Fast Assassin. Special: Dash',
    color: '#10b981',
    stats: {
      maxHp: 90,
      moveSpeed: 2.16,
      damage: 12,
      attackSpeed: 15,
      pickupRange: 40,
      critChance: 0.25,
      critMultiplier: 2.5,
      projectileCount: 0,
      specialCooldownMax: 180,
      hasHoming: false,
      hasRicochet: false,
      pierceCount: 1,
      weaponType: 'MELEE',
      areaScale: 1.0,
      lightningChance: 0,
      burnChance: 0,
      poisonChance: 0,
      freezeChance: 0,
      stunScreenChance: 0,
      shieldMax: 0,
      shieldCurrent: 0,
      reflectDamage: 0,
      petCount: 0,
      petType: 'NONE',
      evolutionLevel: 0,
    }
  }
};

export const INITIAL_PLAYER_STATS = HEROES[HeroType.KNIGHT].stats;

export const UPGRADES: Upgrade[] = [
  // --- NEW DEFENSIVE & PET UPGRADES ---
  {
    id: 'shield_gen', name: 'Energy Shield', description: '+25 Shield HP (Regenerates)', rarity: 'rare',
    apply: (s) => ({ ...s, shieldMax: s.shieldMax + 25 }),
  },
  {
    id: 'reflect_1', name: 'Spiked Armor', description: 'Reflect 50% Damage taken', rarity: 'rare',
    apply: (s) => ({ ...s, reflectDamage: s.reflectDamage + 0.5 }),
  },
  {
    id: 'pet_dog', name: 'Summon Wolf', description: 'Companions bite enemies', rarity: 'legendary',
    apply: (s) => ({ ...s, petCount: s.petCount + 1, petType: 'DOG' }),
  },
  {
    id: 'pet_bird', name: 'Summon Raven', description: 'Companions shoot magic', rarity: 'legendary',
    apply: (s) => ({ ...s, petCount: s.petCount + 1, petType: 'BIRD' }),
  },

  // --- AREA UPGRADES (Leading to 360) ---
  {
    id: 'area_massive', name: 'Titan Reach', description: '+50% Attack Area', rarity: 'rare',
    apply: (s) => ({ ...s, areaScale: s.areaScale + 0.5 }),
  },
  {
    id: 'area_spin', name: 'Whirlwind', description: 'Attacks become 360 degrees', rarity: 'legendary',
    heroReq: HeroType.KNIGHT,
    apply: (s) => ({ ...s, areaScale: 3.0 }), // Trigger 360 logic
  },
  {
    id: 'rogue_radius', name: 'Blade Dance', description: '+50% Area & Reach', rarity: 'rare',
    heroReq: HeroType.ROGUE,
    apply: (s) => ({ ...s, areaScale: s.areaScale + 0.5 }),
  },

  // --- ELEMENTAL UPGRADES ---
  {
    id: 'chain_lightning', name: 'Stormcaller', description: '+25% Chance Chain Lightning', rarity: 'legendary',
    apply: (s) => ({ ...s, lightningChance: s.lightningChance + 0.25 }),
  },
  {
    id: 'fire_aura', name: 'Inferno', description: '100% Burn Chance', rarity: 'rare',
    apply: (s) => ({ ...s, burnChance: 1.0 }),
  },
  {
    id: 'ice_age', name: 'Glacial Strike', description: '100% Freeze Chance', rarity: 'rare',
    apply: (s) => ({ ...s, freezeChance: 1.0 }),
  },


  // --- KNIGHT EXCLUSIVES ---
  {
    id: 'k_stun_1', name: 'Earthquake I', description: '5% Chance to STUN ALL', rarity: 'rare',
    heroReq: HeroType.KNIGHT,
    apply: (s) => ({ ...s, stunScreenChance: s.stunScreenChance + 0.05 }),
  },
  {
    id: 'k_stun_2', name: 'Earthquake II', description: '+10% Stun All Chance', rarity: 'legendary',
    heroReq: HeroType.KNIGHT,
    apply: (s) => ({ ...s, stunScreenChance: s.stunScreenChance + 0.10 }),
  },

  // --- MAGE EXCLUSIVES ---
  {
    id: 'm_multi_1', name: 'Arcane Mirror', description: '+2 Projectiles', rarity: 'rare',
    heroReq: HeroType.MAGE,
    apply: (s) => ({ ...s, projectileCount: s.projectileCount + 2 }),
  },
  {
    id: 'm_pierce', name: 'Aether Lance', description: '+3 Pierce & Homing', rarity: 'legendary',
    heroReq: HeroType.MAGE,
    apply: (s) => ({ ...s, pierceCount: s.pierceCount + 3, hasHoming: true }),
  },

  // --- ROGUE EXCLUSIVES ---
  {
    id: 'r_crit_dmg_1', name: 'Lethality I', description: '+50% Crit Damage', rarity: 'rare',
    heroReq: HeroType.ROGUE,
    apply: (s) => ({ ...s, critMultiplier: s.critMultiplier + 0.5 }),
  },
  {
    id: 'r_crit_dmg_2', name: 'Lethality II', description: '+100% Crit Damage', rarity: 'legendary',
    heroReq: HeroType.ROGUE,
    apply: (s) => ({ ...s, critMultiplier: s.critMultiplier + 1.0 }),
  },

  // --- GENERAL UPGRADES ---
  {
    id: 'sharp_1', name: 'Sharpness I', description: '+15% Damage', rarity: 'common',
    apply: (s) => ({ ...s, damage: s.damage * 1.15 }),
  },
  {
    id: 'vitality_1', name: 'Vitality I', description: '+30 Max HP', rarity: 'common',
    apply: (s) => ({ ...s, maxHp: s.maxHp + 30 }),
  },
  {
    id: 'swiftness', name: 'Swiftness', description: '+10% Speed', rarity: 'common',
    apply: (s) => ({ ...s, moveSpeed: s.moveSpeed * 1.1 }),
  },
  {
    id: 'frenzy_1', name: 'Frenzy', description: '-15% Cooldown', rarity: 'common',
    apply: (s) => ({ ...s, attackSpeed: Math.max(5, s.attackSpeed * 0.85) }),
  },
  {
    id: 'crit_1', name: 'Precision', description: '+10% Crit Chance', rarity: 'common',
    apply: (s) => ({ ...s, critChance: s.critChance + 0.1 }),
  },
  {
    id: 'area_1', name: 'Gigantism', description: '+20% Area', rarity: 'common',
    apply: (s) => ({ ...s, areaScale: s.areaScale * 1.2 }),
  },
  {
    id: 'magnet', name: 'Loot Magnet', description: '+50% Pickup Range', rarity: 'common',
    apply: (s) => ({ ...s, pickupRange: s.pickupRange * 1.5 }),
  },
  {
    id: 'multi_1', name: 'Multishot', description: '+1 Projectile', rarity: 'rare',
    apply: (s) => ({ ...s, projectileCount: s.projectileCount + 1 }),
  },
  {
    id: 'ricochet', name: 'Bouncing Shots', description: 'Projectiles Ricochet', rarity: 'legendary',
    apply: (s) => ({ ...s, hasRicochet: true }),
  },
];
