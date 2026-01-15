
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  RENDER_WIDTH, 
  RENDER_HEIGHT, 
  LEVEL_CAP_XP_BASE,
  BOSS_SPAWN_SCORE,
  UPGRADES,
  HEROES
} from '../constants';
import { 
  Entity, 
  EntityType, 
  Vector2, 
  Particle, 
  Projectile, 
  FloatingText, 
  GameState, 
  PlayerStats,
  Upgrade,
  HeroType,
  VisualEffect
} from '../types';
import { playSound } from '../utils/sound';

interface GameCanvasProps {
  onGameOver: (score: number, win: boolean) => void;
  onLevelUp: (options: Upgrade[]) => void;
  selectedUpgrade: Upgrade | null;
  resetUpgrade: () => void;
  gameActive: boolean;
  setStats: (stats: GameState & { playerHp: number, playerMaxHp: number }) => void;
  selectedHero: HeroType;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onGameOver, 
  onLevelUp, 
  selectedUpgrade, 
  resetUpgrade, 
  gameActive,
  setStats,
  selectedHero
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Callback Refs
  const onGameOverRef = useRef(onGameOver);
  const onLevelUpRef = useRef(onLevelUp);
  const setStatsRef = useRef(setStats);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onLevelUpRef.current = onLevelUp;
    setStatsRef.current = setStats;
  }, [onGameOver, onLevelUp, setStats]);
  
  const heroConfig = HEROES[selectedHero];

  // Game State Refs
  const playerRef = useRef<Entity>({
    id: 0,
    type: EntityType.PLAYER,
    pos: { x: RENDER_WIDTH / 2, y: RENDER_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    radius: 6,
    hp: heroConfig.stats.maxHp,
    maxHp: heroConfig.stats.maxHp,
    color: heroConfig.color,
    damage: heroConfig.stats.damage,
    speed: heroConfig.stats.moveSpeed,
    isDead: false,
    attackCooldown: 0,
  });

  const playerStatsRef = useRef<PlayerStats>({ ...heroConfig.stats });
  const gameStateRef = useRef<GameState>({
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    isVictory: false,
    wave: 1,
    score: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    time: 0,
    specialCooldown: 0,
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const textsRef = useRef<FloatingText[]>([]);
  const visualEffectsRef = useRef<VisualEffect[]>([]); // New visual effects layer
  
  const inputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    special: false,
    mouseX: 0,
    mouseY: 0,
  });

  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const frameIdRef = useRef<number>(0);
  const bossSpawnedRef = useRef(false);
  const shakeRef = useRef<number>(0);
  const invulnerableTimerRef = useRef(0);

  // --- Utility Functions ---
  const getDistance = (a: Vector2, b: Vector2) => Math.hypot(a.x - b.x, a.y - b.y);
  
  const addShake = (amount: number) => {
    shakeRef.current = Math.min(shakeRef.current + amount, 20);
  };

  const spawnParticle = (pos: Vector2, color: string, count: number, speed: number, sizeBase: number = 2) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = {
        x: Math.cos(angle) * (Math.random() * speed),
        y: Math.sin(angle) * (Math.random() * speed)
      };
      particlesRef.current.push({
        id: Math.random(),
        pos: { ...pos },
        vel,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color,
        size: 1 + Math.random() * sizeBase
      });
    }
  };

  const spawnFloatingText = (pos: Vector2, text: string, color: string) => {
    textsRef.current.push({
      id: Math.random(),
      pos: { x: pos.x, y: pos.y - 12 },
      vel: { x: (Math.random() - 0.5) * 0.5, y: -0.8 },
      text,
      color,
      life: 50
    });
  };

  const spawnLightning = (from: Vector2, to: Vector2) => {
     visualEffectsRef.current.push({
        id: Math.random(),
        type: 'LIGHTNING',
        pos: from,
        targetPos: to,
        color: '#fef08a',
        life: 8,
        maxLife: 8,
        width: 2
     });
  };

  const spawnEnemy = () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = RENDER_WIDTH; 
    const spawnPos = {
      x: playerRef.current.pos.x + Math.cos(angle) * dist,
      y: playerRef.current.pos.y + Math.sin(angle) * dist,
    };

    const rand = Math.random();
    let type = EntityType.ENEMY_SLIME;
    let radius = 6;
    let maxHp = 20;
    let damage = 8;
    let speed = 0.5;
    let color = '#ef4444'; // Red

    const score = gameStateRef.current.score;

    if (score > 800 && rand > 0.8) {
      type = EntityType.ENEMY_GOLEM;
      radius = 10;
      maxHp = 80;
      damage = 25;
      speed = 0.3;
      color = '#78716c'; // Stone
    } else if (score > 300 && rand > 0.7) {
      type = EntityType.ENEMY_ARCHER;
      radius = 6;
      maxHp = 30;
      damage = 10;
      speed = 0.6;
      color = '#16a34a'; // Green
    } else if (score > 100 && rand > 0.85) {
      type = EntityType.ENEMY_SKELETON;
      radius = 7;
      maxHp = 40;
      damage = 15;
      speed = 0.8;
      color = '#d1d5db';
    } else if (rand > 0.6) {
      type = EntityType.ENEMY_BAT;
      radius = 4;
      maxHp = 10;
      damage = 5;
      speed = 1.2;
      color = '#a78bfa'; // Purple
    }

    // Scaling
    const levelScale = 1 + (gameStateRef.current.level * 0.1);
    maxHp *= levelScale;

    entitiesRef.current.push({
      id: Math.random(),
      type,
      pos: spawnPos,
      vel: { x: 0, y: 0 },
      radius,
      hp: maxHp,
      maxHp,
      color,
      damage,
      speed,
      isDead: false,
      xpValue: Math.max(1, Math.floor(maxHp / 5)), 
      knockback: { x: 0, y: 0 },
      attackCooldown: 0 
    });
  };

  const spawnBoss = () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 150;
    const spawnPos = {
      x: playerRef.current.pos.x + Math.cos(angle) * dist,
      y: playerRef.current.pos.y + Math.sin(angle) * dist,
    };

    entitiesRef.current.push({
      id: Math.random(),
      type: EntityType.ENEMY_BOSS,
      pos: spawnPos,
      vel: { x: 0, y: 0 },
      radius: 20,
      hp: 3000,
      maxHp: 3000,
      color: '#a855f7',
      damage: 30,
      speed: 0.65,
      isDead: false,
      xpValue: 1000,
      knockback: { x: 0, y: 0 },
      attackCooldown: 100
    });
    
    bossSpawnedRef.current = true;
    playSound.bossSpawn();
    addShake(15);
    spawnFloatingText(playerRef.current.pos, "BOSS APPROACHING!", "#9333ea");
  };

  // --- Drawing Helpers ---
  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Entity, mousePos: Vector2) => {
    const facingRight = mousePos.x > p.pos.x;
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    if (!facingRight) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(gameStateRef.current.time * 0.2) * 1;

    if (selectedHero === HeroType.KNIGHT) {
      // Knight Body
      ctx.fillStyle = p.color;
      ctx.fillRect(-4, -6 + bob, 8, 10);
      ctx.fillStyle = '#60a5fa'; // Helmet
      ctx.fillRect(-4, -10 + bob, 8, 4);
    } else if (selectedHero === HeroType.MAGE) {
      // Mage Robes
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -12 + bob);
      ctx.lineTo(6, 4 + bob);
      ctx.lineTo(-6, 4 + bob);
      ctx.fill();
      // Hat
      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.moveTo(-6, -8 + bob);
      ctx.lineTo(6, -8 + bob);
      ctx.lineTo(0, -16 + bob);
      ctx.fill();
    } else if (selectedHero === HeroType.ROGUE) {
      // Rogue Hood/Cloak
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.arc(0, -5 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.fillRect(-3, 0 + bob, 6, 6);
    }

    // Weapon
    const isAttacking = p.attackCooldown && p.attackCooldown > (playerStatsRef.current.attackSpeed - 10);
    const attackProgress = isAttacking ? 1 - (p.attackCooldown! / playerStatsRef.current.attackSpeed) : 0;
    
    ctx.save();
    ctx.translate(4, -2 + bob);
    if (isAttacking) {
        ctx.rotate(Math.PI * 0.5 + attackProgress * Math.PI); 
    } else {
        ctx.rotate(Math.PI * -0.2);
    }
    
    if (selectedHero === HeroType.KNIGHT) {
      // Sword
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, -8, 3, 10);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-1, 0, 5, 2);
    } else if (selectedHero === HeroType.MAGE) {
      // Staff
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, -8, 2, 12);
      ctx.fillStyle = '#f0abfc'; // Gem
      ctx.fillRect(-1, -10, 4, 4);
    } else if (selectedHero === HeroType.ROGUE) {
      // Dagger
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(2, -6);
      ctx.lineTo(4, 0);
      ctx.fill();
    }
    ctx.restore();

    // Invulnerability Flash
    if (invulnerableTimerRef.current > 0 && Math.floor(gameStateRef.current.time / 4) % 2 === 0) {
       ctx.globalCompositeOperation = 'source-atop';
       ctx.fillStyle = 'white';
       ctx.fillRect(-10, -20, 20, 30);
    }

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Entity) => {
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    const time = gameStateRef.current.time;

    // HP Bar logic common
    const drawHp = () => {
       if (e.hp < e.maxHp) {
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = 'black';
        ctx.fillRect(-5, -e.radius - 8, 10, 2);
        ctx.fillStyle = e.color;
        ctx.fillRect(-5, -e.radius - 8, 10 * pct, 2);
      }
    };

    if (e.type === EntityType.ENEMY_SLIME) {
      const wobble = Math.sin(time * 0.2 + e.id * 10) * 2;
      const scaleX = 1 - wobble * 0.1;
      const scaleY = 1 + wobble * 0.1;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * scaleX, e.radius * scaleY, 0, Math.PI, 0); 
      ctx.lineTo(e.radius * scaleX, 0); 
      ctx.quadraticCurveTo(0, 2, -e.radius * scaleX, 0);
      ctx.fill();
    } else if (e.type === EntityType.ENEMY_BAT) {
       const flap = Math.sin(time * 0.8) * 5;
       ctx.fillStyle = e.color;
       ctx.beginPath();
       ctx.arc(0, 0, 3, 0, Math.PI*2); // Body
       ctx.fill();
       // Wings
       ctx.beginPath();
       ctx.moveTo(0, 0);
       ctx.lineTo(-8, -5 + flap);
       ctx.lineTo(-4, 2);
       ctx.fill();
       ctx.beginPath();
       ctx.moveTo(0, 0);
       ctx.lineTo(8, -5 + flap);
       ctx.lineTo(4, 2);
       ctx.fill();
    } else if (e.type === EntityType.ENEMY_ARCHER) {
       ctx.fillStyle = e.color;
       ctx.fillRect(-3, -6, 6, 10);
       // Hood
       ctx.fillStyle = '#14532d';
       ctx.beginPath();
       ctx.moveTo(-4, -6);
       ctx.lineTo(4, -6);
       ctx.lineTo(0, -10);
       ctx.fill();
       // Bow
       ctx.strokeStyle = '#92400e';
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.arc(4, 0, 5, -Math.PI/2, Math.PI/2);
       ctx.stroke();
    } else if (e.type === EntityType.ENEMY_GOLEM) {
       const walk = Math.sin(time * 0.1) * 2;
       ctx.fillStyle = e.color;
       ctx.fillRect(-8, -10 + walk, 16, 14); // Body
       ctx.fillStyle = '#57534e';
       ctx.fillRect(-10, -6 + walk, 4, 10); // L Arm
       ctx.fillRect(6, -6 + walk, 4, 10); // R Arm
       // Eyes
       ctx.fillStyle = '#fca5a5';
       ctx.fillRect(-3, -8 + walk, 2, 2);
       ctx.fillRect(1, -8 + walk, 2, 2);
    } else if (e.type === EntityType.ENEMY_SKELETON) {
       const walk = Math.sin(time * 0.3 + e.id);
       ctx.fillStyle = '#e5e7eb'; // Ribs
       ctx.fillRect(-2, -2, 4, 6);
       ctx.fillRect(-3, -7, 6, 5); // Head
       ctx.fillStyle = '#111'; // Eyes
       ctx.fillRect(-1, -5, 1, 1);
       ctx.fillRect(1, -5, 1, 1);
    } else if (e.type === EntityType.ENEMY_BOSS) {
       // Boss Draw
       const hover = Math.sin(time * 0.05) * 5;
       ctx.translate(0, hover);
       ctx.fillStyle = '#581c87'; 
       ctx.beginPath();
       ctx.moveTo(0, -20); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.fill();
       ctx.fillStyle = '#3b0764';
       ctx.beginPath(); ctx.arc(0, -15, 10, 0, Math.PI*2); ctx.fill();
       ctx.fillStyle = '#facc15'; 
       ctx.fillRect(-4, -15, 2, 2); ctx.fillRect(2, -15, 2, 2);
    }

    if (e.freezeTimer && e.freezeTimer > 0) {
       ctx.fillStyle = 'rgba(147, 197, 253, 0.5)';
       ctx.beginPath();
       ctx.arc(0, 0, e.radius + 2, 0, Math.PI*2);
       ctx.fill();
    }

    drawHp();
    ctx.restore();
  };

  // --- Main Loop ---
  const loop = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (gameStateRef.current.isPaused || !gameStateRef.current.isPlaying) {
      if (gameStateRef.current.isPlaying) {
          frameIdRef.current = requestAnimationFrame(loop);
      }
      return;
    }

    // -- Update --
    const player = playerRef.current;
    const stats = playerStatsRef.current;

    // Cooldowns
    if (invulnerableTimerRef.current > 0) invulnerableTimerRef.current--;
    if (gameStateRef.current.specialCooldown > 0) gameStateRef.current.specialCooldown--;

    // Shake decay
    if (shakeRef.current > 0) shakeRef.current *= 0.9;
    if (shakeRef.current < 0.5) shakeRef.current = 0;

    // Player Movement
    let dx = 0;
    let dy = 0;
    if (inputRef.current.up) dy -= 1;
    if (inputRef.current.down) dy += 1;
    if (inputRef.current.left) dx -= 1;
    if (inputRef.current.right) dx += 1;

    let currentSpeed = stats.moveSpeed;
    if (invulnerableTimerRef.current > 0 && selectedHero === HeroType.ROGUE) currentSpeed *= 2; 

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      player.pos.x += dx * currentSpeed;
      player.pos.y += dy * currentSpeed;
    }

    // Camera follow player
    cameraRef.current.x += (player.pos.x - RENDER_WIDTH / 2 - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (player.pos.y - RENDER_HEIGHT / 2 - cameraRef.current.y) * 0.1;

    // Special Ability
    if (inputRef.current.special && gameStateRef.current.specialCooldown <= 0) {
      gameStateRef.current.specialCooldown = stats.specialCooldownMax;
      playSound.levelUp(); 
      
      if (selectedHero === HeroType.KNIGHT) {
         // Shield Bash
         addShake(10);
         spawnParticle(player.pos, '#fbbf24', 20, 4);
         entitiesRef.current.forEach(ent => {
            if (getDistance(ent.pos, player.pos) < 80 && ent.type !== EntityType.PLAYER) {
               ent.knockback = {
                 x: (ent.pos.x - player.pos.x) * 0.3,
                 y: (ent.pos.y - player.pos.y) * 0.3
               };
               ent.freezeTimer = 60;
               ent.hp -= stats.damage * 2;
               spawnFloatingText(ent.pos, "STUN", "#fbbf24");
            }
         });
      } else if (selectedHero === HeroType.MAGE) {
         // Nova
         addShake(5);
         for(let i=0; i<12; i++) {
           const angle = (Math.PI * 2 / 12) * i;
           projectilesRef.current.push({
             id: Math.random(),
             pos: { ...player.pos },
             vel: { x: Math.cos(angle)*4, y: Math.sin(angle)*4 },
             damage: stats.damage,
             radius: 4,
             color: '#a855f7',
             isHostile: false,
             life: 40,
             pierce: 2
           });
         }
      } else if (selectedHero === HeroType.ROGUE) {
         // Dash
         invulnerableTimerRef.current = 60; 
         spawnParticle(player.pos, '#10b981', 10, 1);
         spawnFloatingText(player.pos, "DASH!", "#10b981");
      }
    }

    // Player Attack
    if (player.attackCooldown && player.attackCooldown > 0) {
      player.attackCooldown--;
    } else {
      if (inputRef.current.attack) {
        player.attackCooldown = stats.attackSpeed;
        playSound.attack(); 
        
        const mouseWorldX = inputRef.current.mouseX + cameraRef.current.x;
        const mouseWorldY = inputRef.current.mouseY + cameraRef.current.y;
        const angleToMouse = Math.atan2(mouseWorldY - player.pos.y, mouseWorldX - player.pos.x);

        if (stats.weaponType === 'MELEE') {
          // COOLER MELEE SLASH
          const slashRange = 25 * stats.areaScale;
          visualEffectsRef.current.push({
             id: Math.random(),
             type: 'SLASH',
             pos: { x: player.pos.x, y: player.pos.y },
             angle: angleToMouse,
             range: slashRange,
             color: player.color,
             life: 8,
             maxLife: 8
          });

          // Hit Detection with Scaling Area
          entitiesRef.current.forEach(ent => {
            if (ent.type === EntityType.LOOT_XP || ent.type === EntityType.LOOT_HP) return;
            
            const dist = getDistance(player.pos, ent.pos);
            const reach = 45 * stats.areaScale; // Scaling Hitbox

            if (dist < reach) {
              const angleToEnt = Math.atan2(ent.pos.y - player.pos.y, ent.pos.x - player.pos.x);
              let angleDiff = angleToEnt - angleToMouse;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

              if (Math.abs(angleDiff) < 1.2) { // Wider swing area
                 const isCrit = Math.random() < stats.critChance;
                 const dmg = isCrit ? stats.damage * 2 : stats.damage;
                 ent.hp -= dmg;
                 ent.knockback = {
                   x: Math.cos(angleToEnt) * 4,
                   y: Math.sin(angleToEnt) * 4
                 };
                 // Impact spark
                 visualEffectsRef.current.push({
                   id: Math.random(), type: 'IMPACT', pos: ent.pos, life: 5, maxLife: 5, color: '#fff', size: 10
                 });
                 
                 spawnFloatingText(ent.pos, Math.floor(dmg).toString(), isCrit ? '#fca5a5' : '#fff');
                 playSound.enemyHit();
                 addShake(2); 

                 // Lightning Proc
                 if (Math.random() < stats.lightningChance) {
                    // Find nearby enemy to chain
                    let chainTarget = entitiesRef.current.find(other => 
                       other.id !== ent.id && 
                       !other.isDead &&
                       [EntityType.ENEMY_SLIME, EntityType.ENEMY_SKELETON, EntityType.ENEMY_GOLEM, EntityType.ENEMY_ARCHER, EntityType.ENEMY_BAT].includes(other.type) &&
                       getDistance(ent.pos, other.pos) < 100
                    );

                    if (chainTarget) {
                       chainTarget.hp -= dmg * 0.8;
                       spawnLightning(ent.pos, chainTarget.pos);
                       spawnFloatingText(chainTarget.pos, "ZAP!", "#fef08a");
                    } else {
                       // Visual lightning to ground
                       spawnLightning(ent.pos, {x: ent.pos.x + (Math.random()-0.5)*20, y: ent.pos.y + (Math.random()-0.5)*20});
                    }
                 }
              }
            }
          });
        }

        // Projectiles (Mage always shoots, others if upgraded)
        if (stats.weaponType === 'RANGED' || stats.projectileCount > 0) {
           const count = (stats.weaponType === 'RANGED' ? 1 : 0) + stats.projectileCount;
           
           for(let i=0; i<count; i++) {
             // Spread logic
             const spread = (i - (count-1)/2) * 0.2; 
             projectilesRef.current.push({
               id: Math.random(),
               pos: { ...player.pos },
               vel: { x: Math.cos(angleToMouse + spread) * 4, y: Math.sin(angleToMouse + spread) * 4 },
               damage: stats.damage * (stats.weaponType === 'RANGED' ? 1 : 0.5),
               radius: 3 * stats.areaScale, // Scale projectile size
               color: stats.weaponType === 'RANGED' ? heroConfig.color : '#60a5fa',
               isHostile: false,
               life: 60,
               homing: stats.hasHoming,
               ricochet: stats.hasRicochet,
               pierce: stats.pierceCount
             });
           }
        }
      }
    }

    // Spawn Logic
    if (gameStateRef.current.time % 60 === 0 && entitiesRef.current.length < 100 && !gameStateRef.current.isVictory) {
       const spawnRate = Math.max(20, 120 - Math.floor(gameStateRef.current.time / 60)); // Spawn faster over time
       const spawnCount = 1 + Math.floor(gameStateRef.current.time / 1200);
       for(let i=0; i<spawnCount; i++) spawnEnemy();
    }
    if (!bossSpawnedRef.current && gameStateRef.current.score >= BOSS_SPAWN_SCORE) {
      spawnBoss();
    }

    // Update Entities
    entitiesRef.current.forEach(ent => {
      // Knockback / Physics
      if (ent.knockback) {
        ent.pos.x += ent.knockback.x;
        ent.pos.y += ent.knockback.y;
        ent.knockback.x *= 0.8;
        ent.knockback.y *= 0.8;
      }

      if (ent.freezeTimer && ent.freezeTimer > 0) {
        ent.freezeTimer--;
      }

      // Enemy AI
      if ([EntityType.ENEMY_SLIME, EntityType.ENEMY_SKELETON, EntityType.ENEMY_BOSS, EntityType.ENEMY_BAT, EntityType.ENEMY_GOLEM, EntityType.ENEMY_ARCHER].includes(ent.type)) {
        
        let moveSpeed = ent.speed;
        if (stats.freezeAura && getDistance(ent.pos, player.pos) < 60) moveSpeed *= 0.5;
        if (ent.freezeTimer && ent.freezeTimer > 0) moveSpeed = 0;

        const dist = getDistance(ent.pos, player.pos);
        
        // AI Behavior
        if (ent.type === EntityType.ENEMY_ARCHER) {
          // Archer runs away if too close, stops to shoot
          if (dist < 80) {
            ent.vel.x = (ent.pos.x - player.pos.x) / dist * moveSpeed;
            ent.vel.y = (ent.pos.y - player.pos.y) / dist * moveSpeed;
          } else if (dist > 150) {
            ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed;
            ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed;
          } else {
            ent.vel.x = 0; ent.vel.y = 0;
          }

          // Shoot
          if (ent.attackCooldown !== undefined) {
             if (ent.attackCooldown > 0) ent.attackCooldown--;
             else if (dist < 200) {
                ent.attackCooldown = 120;
                const angle = Math.atan2(player.pos.y - ent.pos.y, player.pos.x - ent.pos.x);
                projectilesRef.current.push({
                   id: Math.random(),
                   pos: { ...ent.pos },
                   vel: { x: Math.cos(angle)*3, y: Math.sin(angle)*3 },
                   damage: ent.damage,
                   radius: 2,
                   color: '#ef4444',
                   isHostile: true,
                   life: 100
                });
             }
          }

        } else if (ent.type === EntityType.ENEMY_BAT) {
           // Erratic movement
           ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed + Math.sin(gameStateRef.current.time * 0.2 + ent.id)*0.5;
           ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed + Math.cos(gameStateRef.current.time * 0.2 + ent.id)*0.5;
        } else {
           // Basic chase
           if (dist > 0) {
            ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed;
            ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed;
          }
        }
        
        ent.pos.x += ent.vel.x;
        ent.pos.y += ent.vel.y;

        // Collision Player
        if (getDistance(ent.pos, player.pos) < ent.radius + player.radius) {
           if (invulnerableTimerRef.current <= 0) {
             player.hp -= 0.2; // Contact damage
             if (Math.random() < 0.1) {
               spawnParticle(player.pos, '#ff0000', 1, 1);
               playSound.hit();
               addShake(3);
             }
           }
        }

        // Boss Attack (Nova)
        if (ent.type === EntityType.ENEMY_BOSS) {
          if (ent.attackCooldown && ent.attackCooldown > 0) {
            ent.attackCooldown--;
          } else if (dist < 200) {
             ent.attackCooldown = 80;
             playSound.attack();
             const angle = Math.atan2(player.pos.y - ent.pos.y, player.pos.x - ent.pos.x);
             for(let i=-2; i<=2; i++) {
               projectilesRef.current.push({
                 id: Math.random(),
                 pos: { ...ent.pos },
                 vel: { x: Math.cos(angle + i*0.2) * 2, y: Math.sin(angle + i*0.2) * 2 },
                 damage: 15,
                 radius: 4,
                 color: '#ef4444',
                 isHostile: true,
                 life: 120
               });
             }
          }
        }
      } 
      else if (ent.type === EntityType.LOOT_XP || ent.type === EntityType.LOOT_HP) {
        const dist = getDistance(ent.pos, player.pos);
        if (dist < stats.pickupRange) {
           ent.pos.x += (player.pos.x - ent.pos.x) * 0.15;
           ent.pos.y += (player.pos.y - ent.pos.y) * 0.15;
           if (dist < 10) {
             // IMPORTANT: Fix for loot bug
             ent.hp = 0; // Mark for removal by setting hp <= 0
             ent.isDead = true; 
             
             if (ent.type === EntityType.LOOT_XP) {
               gameStateRef.current.xp += ent.xpValue || 1;
               gameStateRef.current.score += 10;
               playSound.pickup(true);
             } else {
               player.hp = Math.min(player.hp + 20, stats.maxHp);
               spawnFloatingText(player.pos, "+HP", "#10b981");
               playSound.pickup(false);
             }
           }
        }
      }
    });

    // Update Projectiles
    projectilesRef.current.forEach(proj => {
      // Trail effect
      if (!proj.isHostile && gameStateRef.current.time % 3 === 0) {
         particlesRef.current.push({
            id: Math.random(),
            pos: {...proj.pos},
            vel: {x:0,y:0},
            life: 10, maxLife: 10,
            color: proj.color,
            size: 1
         });
      }

      // Homing Logic
      if (proj.homing && !proj.isHostile) {
         let closest = null;
         let minDist = 100;
         entitiesRef.current.forEach(ent => {
             if (ent.type === EntityType.LOOT_XP || ent.type === EntityType.LOOT_HP) return;
             const d = getDistance(proj.pos, ent.pos);
             if (d < minDist) { minDist = d; closest = ent; }
         });
         if (closest) {
             const angle = Math.atan2(closest.pos.y - proj.pos.y, closest.pos.x - proj.pos.x);
             proj.vel.x += Math.cos(angle) * 0.5;
             proj.vel.y += Math.sin(angle) * 0.5;
             // Normalize speed
             const speed = Math.hypot(proj.vel.x, proj.vel.y);
             if (speed > 4) { proj.vel.x = (proj.vel.x/speed)*4; proj.vel.y = (proj.vel.y/speed)*4; }
         }
      }

      proj.pos.x += proj.vel.x;
      proj.pos.y += proj.vel.y;
      proj.life--;
      
      if (proj.isHostile) {
        if (getDistance(proj.pos, player.pos) < proj.radius + player.radius) {
          if (invulnerableTimerRef.current <= 0) {
            player.hp -= proj.damage;
            spawnParticle(player.pos, '#ff0000', 5, 2);
            playSound.hit();
            addShake(4);
          }
          proj.life = 0;
        }
      } else {
        // Player Projectile hitting enemies
        for (let ent of entitiesRef.current) {
           if ([EntityType.ENEMY_SLIME, EntityType.ENEMY_SKELETON, EntityType.ENEMY_BOSS, EntityType.ENEMY_BAT, EntityType.ENEMY_GOLEM, EntityType.ENEMY_ARCHER].includes(ent.type)) {
            if (getDistance(proj.pos, ent.pos) < proj.radius + ent.radius) {
               ent.hp -= proj.damage;
               
               spawnParticle(ent.pos, ent.color, 3, 1);
               spawnFloatingText(ent.pos, Math.floor(proj.damage).toString(), '#fff');
               ent.knockback = { x: proj.vel.x * 0.5, y: proj.vel.y * 0.5 };
               playSound.enemyHit();
               
               if (proj.ricochet) {
                  // Find nearest other enemy
                  const angle = Math.random() * Math.PI * 2; // Random bounce for simplicity
                  proj.vel.x = Math.cos(angle) * 4;
                  proj.vel.y = Math.sin(angle) * 4;
                  proj.life = 20; // Reduce life on bounce
                  proj.ricochet = false; // Only bounce once for now
               } else if ((proj.pierce || 0) > 0) {
                  proj.pierce = (proj.pierce || 0) - 1;
               } else {
                  proj.life = 0;
               }
               break; 
            }
          }
        }
      }
    });

    // Cleanup & Loot Generation
    const survivors: Entity[] = [];
    const newLoot: Entity[] = [];
    
    for (const ent of entitiesRef.current) {
      if (ent.hp <= 0) {
         // Only spawn particles if it was alive just before this frame check or if it's an enemy dying
         if (ent.type !== EntityType.LOOT_XP && ent.type !== EntityType.LOOT_HP) {
            spawnParticle(ent.pos, ent.color, 8, 2);
         }

         if ([EntityType.ENEMY_SLIME, EntityType.ENEMY_SKELETON, EntityType.ENEMY_BOSS, EntityType.ENEMY_BAT, EntityType.ENEMY_GOLEM, EntityType.ENEMY_ARCHER].includes(ent.type)) {
            // Drop XP
            newLoot.push({
               id: Math.random(),
               type: EntityType.LOOT_XP,
               pos: { x: ent.pos.x + (Math.random()-0.5)*10, y: ent.pos.y + (Math.random()-0.5)*10 },
               vel: { x: 0, y: 0 },
               radius: 3,
               hp: 1, maxHp: 1, color: '#fbbf24', damage: 0, speed: 0, isDead: false,
               xpValue: ent.xpValue
            });
            
            if (Math.random() > 0.95) {
               newLoot.push({
                 id: Math.random(),
                 type: EntityType.LOOT_HP,
                 pos: { x: ent.pos.x + 5, y: ent.pos.y },
                 vel: { x: 0, y: 0 },
                 radius: 4,
                 hp: 1, maxHp: 1, color: '#10b981', damage: 0, speed: 0, isDead: false
               });
            }
            if (ent.type === EntityType.ENEMY_BOSS) {
               gameStateRef.current.isVictory = true;
               gameStateRef.current.isPlaying = false;
               onGameOverRef.current(gameStateRef.current.score, true); 
               playSound.levelUp(); 
            }
         }
      } else {
        survivors.push(ent);
      }
    }
    entitiesRef.current = [...survivors, ...newLoot];
    projectilesRef.current = projectilesRef.current.filter(p => p.life > 0);
    textsRef.current = textsRef.current.filter(t => t.life > 0);
    particlesRef.current = particlesRef.current.filter(p => {
       p.pos.x += p.vel.x;
       p.pos.y += p.vel.y;
       p.life--;
       return p.life > 0;
    });

    textsRef.current.forEach(t => {
      t.pos.y += t.vel.y;
      t.life--;
    });

    // Update Visual Effects
    visualEffectsRef.current = visualEffectsRef.current.filter(e => {
        e.life--;
        return e.life > 0;
    });

    // Level Up
    if (gameStateRef.current.xp >= gameStateRef.current.xpToNextLevel) {
      gameStateRef.current.xp -= gameStateRef.current.xpToNextLevel;
      gameStateRef.current.level++;
      gameStateRef.current.xpToNextLevel = Math.floor(gameStateRef.current.xpToNextLevel * 1.5);
      
      const shuffled = [...UPGRADES].sort(() => 0.5 - Math.random());
      playSound.levelUp();
      onLevelUpRef.current(shuffled.slice(0, 3)); 
      gameStateRef.current.isPaused = true;
    }

    if (player.hp <= 0) {
      gameStateRef.current.isGameOver = true;
      gameStateRef.current.isPlaying = false;
      playSound.gameOver();
      onGameOverRef.current(gameStateRef.current.score, false); 
    }

    gameStateRef.current.time++;
    // Use Ref to call setStats without dependencies
    setStatsRef.current({ ...gameStateRef.current, playerHp: player.hp, playerMaxHp: stats.maxHp });

    // -- Draw Frame --
    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    ctx.save();
    
    // Apply Shake
    const shakeX = (Math.random() - 0.5) * shakeRef.current;
    const shakeY = (Math.random() - 0.5) * shakeRef.current;
    ctx.translate(shakeX, shakeY);
    
    // Floor (Checkered)
    const gridSize = 32;
    const startX = Math.floor(cameraRef.current.x / gridSize) * gridSize;
    const startY = Math.floor(cameraRef.current.y / gridSize) * gridSize;
    for (let x = startX; x < startX + RENDER_WIDTH + gridSize; x += gridSize) {
      for (let y = startY; y < startY + RENDER_HEIGHT + gridSize; y += gridSize) {
        const isDark = ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0);
        ctx.fillStyle = isDark ? '#262626' : '#2a2a2a';
        ctx.fillRect(x - cameraRef.current.x, y - cameraRef.current.y, gridSize, gridSize);
      }
    }

    ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

    // Entities
    entitiesRef.current.forEach(ent => {
      if (ent.type === EntityType.LOOT_XP || ent.type === EntityType.LOOT_HP) {
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.moveTo(ent.pos.x, ent.pos.y - 3);
        ctx.lineTo(ent.pos.x + 3, ent.pos.y);
        ctx.lineTo(ent.pos.x, ent.pos.y + 3);
        ctx.lineTo(ent.pos.x - 3, ent.pos.y);
        ctx.fill();
      }
    });

    entitiesRef.current.forEach(ent => {
       if (ent.type !== EntityType.LOOT_XP && ent.type !== EntityType.LOOT_HP) {
         drawEnemy(ctx, ent);
       }
    });

    const mouseWorldX = inputRef.current.mouseX + cameraRef.current.x;
    const mouseWorldY = inputRef.current.mouseY + cameraRef.current.y;
    drawPlayer(ctx, player, { x: mouseWorldX, y: mouseWorldY });

    // Draw Visual Effects (Slash, Lightning)
    visualEffectsRef.current.forEach(effect => {
        if (effect.type === 'SLASH' && effect.angle !== undefined && effect.range !== undefined) {
            ctx.save();
            ctx.translate(effect.pos.x, effect.pos.y);
            ctx.rotate(effect.angle);
            ctx.globalAlpha = effect.life / effect.maxLife;
            ctx.fillStyle = effect.color;
            ctx.shadowColor = effect.color;
            ctx.shadowBlur = 10;
            
            // Draw Crescent
            ctx.beginPath();
            ctx.arc(0, 0, effect.range, -Math.PI/4, Math.PI/4);
            ctx.arc(0, 0, effect.range * 0.8, Math.PI/4, -Math.PI/4, true);
            ctx.fill();
            
            ctx.restore();
        } else if (effect.type === 'LIGHTNING' && effect.targetPos) {
            ctx.save();
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = effect.width || 2;
            ctx.shadowColor = effect.color;
            ctx.shadowBlur = 5;
            ctx.globalAlpha = effect.life / effect.maxLife;
            
            ctx.beginPath();
            ctx.moveTo(effect.pos.x, effect.pos.y);
            // Jagged line
            const midX = (effect.pos.x + effect.targetPos.x) / 2 + (Math.random()-0.5)*10;
            const midY = (effect.pos.y + effect.targetPos.y) / 2 + (Math.random()-0.5)*10;
            ctx.lineTo(midX, midY);
            ctx.lineTo(effect.targetPos.x, effect.targetPos.y);
            ctx.stroke();
            ctx.restore();
        } else if (effect.type === 'IMPACT') {
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = effect.life / effect.maxLife;
            ctx.beginPath();
            ctx.arc(effect.pos.x, effect.pos.y, (effect.maxLife - effect.life) * 2, 0, Math.PI*2);
            ctx.fill();
        }
    });

    projectilesRef.current.forEach(proj => {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.pos.x, proj.pos.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'lighter';
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    textsRef.current.forEach(t => {
      ctx.fillStyle = 'black';
      ctx.fillText(t.text, t.pos.x + 1, t.pos.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.pos.x, t.pos.y);
    });

    ctx.restore();

    // Lighting Vignette
    const gradient = ctx.createRadialGradient(
      RENDER_WIDTH / 2, RENDER_HEIGHT / 2, 80,
      RENDER_WIDTH / 2, RENDER_HEIGHT / 2, 220
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    frameIdRef.current = requestAnimationFrame(loop);
  }, [selectedHero]); // Re-create loop if hero changes, but usually game restarts anyway

  // --- Handling Upgrades Effect ---
  useEffect(() => {
    if (selectedUpgrade) {
      playerStatsRef.current = selectedUpgrade.apply(playerStatsRef.current);
      playerRef.current.hp = Math.min(playerRef.current.hp + 20, playerStatsRef.current.maxHp);
      gameStateRef.current.isPaused = false;
      resetUpgrade();
    }
  }, [selectedUpgrade, resetUpgrade]);

  // --- Input Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'KeyW': inputRef.current.up = true; break;
        case 'KeyS': inputRef.current.down = true; break;
        case 'KeyA': inputRef.current.left = true; break;
        case 'KeyD': inputRef.current.right = true; break;
        case 'Space': inputRef.current.special = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'KeyW': inputRef.current.up = false; break;
        case 'KeyS': inputRef.current.down = false; break;
        case 'KeyA': inputRef.current.left = false; break;
        case 'KeyD': inputRef.current.right = false; break;
        case 'Space': inputRef.current.special = false; break;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = RENDER_WIDTH / rect.width;
      const scaleY = RENDER_HEIGHT / rect.height;
      inputRef.current.mouseX = (e.clientX - rect.left) * scaleX;
      inputRef.current.mouseY = (e.clientY - rect.top) * scaleY;
    };
    const handleMouseDown = () => inputRef.current.attack = true;
    const handleMouseUp = () => inputRef.current.attack = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Start/Restart Logic ---
  useEffect(() => {
    if (gameActive) {
      if (!gameStateRef.current.isPlaying) {
        // Reset State
        playerRef.current = {
            ...playerRef.current,
            pos: { x: RENDER_WIDTH / 2, y: RENDER_HEIGHT / 2 },
            hp: heroConfig.stats.maxHp,
            maxHp: heroConfig.stats.maxHp,
            color: heroConfig.color,
            damage: heroConfig.stats.damage,
            speed: heroConfig.stats.moveSpeed,
            isDead: false,
            attackCooldown: 0,
        };
        playerStatsRef.current = { ...heroConfig.stats };
        gameStateRef.current = {
            isPlaying: true,
            isPaused: false,
            isGameOver: false,
            isVictory: false,
            wave: 1,
            score: 0,
            level: 1,
            xp: 0,
            xpToNextLevel: 100, // Sync with init
            time: 0,
            specialCooldown: 0,
        };
        entitiesRef.current = [];
        projectilesRef.current = [];
        particlesRef.current = [];
        textsRef.current = [];
        visualEffectsRef.current = [];
        bossSpawnedRef.current = false;
        shakeRef.current = 0;
        
        frameIdRef.current = requestAnimationFrame(loop);
      }
    } else {
        gameStateRef.current.isPlaying = false;
        cancelAnimationFrame(frameIdRef.current);
    }
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameActive, loop, selectedHero]);

  return (
    <canvas
      ref={canvasRef}
      width={RENDER_WIDTH}
      height={RENDER_HEIGHT}
      className="w-full h-full object-contain cursor-crosshair bg-[#050505]"
    />
  );
};
