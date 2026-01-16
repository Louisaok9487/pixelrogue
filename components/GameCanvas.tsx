
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  RENDER_WIDTH, 
  RENDER_HEIGHT, 
  BOSS_SPAWN_WAVE,
  WAVE_DURATION,
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
  VisualEffect,
  Debris
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

// --- Joystick Component ---
const Joystick: React.FC<{ 
  onMove: (x: number, y: number) => void, 
  onStart: () => void, 
  onEnd: () => void 
}> = ({ onMove, onStart, onEnd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const handleStart = (clientX: number, clientY: number, id: number) => {
    if (touchIdRef.current !== null) return;
    touchIdRef.current = id;
    onStart();
    updatePos(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    updatePos(clientX, clientY);
  };

  const updatePos = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const maxDist = rect.width / 2;
    
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    
    setPos({ x: dx, y: dy });
    onMove(dx / maxDist, dy / maxDist);
  };

  const handleEnd = () => {
    touchIdRef.current = null;
    setPos({ x: 0, y: 0 });
    onMove(0, 0);
    onEnd();
  };

  return (
    <div 
      ref={containerRef}
      className="w-32 h-32 bg-white/10 rounded-full relative backdrop-blur-sm border-2 border-white/20 touch-none"
      onTouchStart={(e) => {
        e.preventDefault(); 
        handleStart(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.changedTouches[0].identifier);
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchIdRef.current) {
            handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            break;
          }
        }
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchIdRef.current) {
            handleEnd();
            break;
          }
        }
      }}
    >
      <div 
        className="w-12 h-12 bg-white/50 rounded-full absolute top-1/2 left-1/2 -ml-6 -mt-6 shadow-lg"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      />
    </div>
  );
};


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
    status: { burnTimer: 0, poisonTimer: 0, freezeTimer: 0, stunTimer: 0 }
  });

  const playerStatsRef = useRef<PlayerStats>({ ...heroConfig.stats, evolutionLevel: 0 });
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
    hitStop: 0,
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const debrisRef = useRef<Debris[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const textsRef = useRef<FloatingText[]>([]);
  const visualEffectsRef = useRef<VisualEffect[]>([]);
  
  const inputRef = useRef({
    // Digital
    up: false, down: false, left: false, right: false,
    // Analog / State
    moveX: 0, moveY: 0,
    attack: false,
    special: false,
    mouseX: 0, mouseY: 0,
    isMobileInput: false
  });

  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const frameIdRef = useRef<number>(0);
  const bossSpawnedRef = useRef(false);
  const shakeRef = useRef<number>(0);
  const invulnerableTimerRef = useRef(0);
  const speedBoostTimerRef = useRef(0);

  // --- Utility Functions ---
  const getDistance = (a: Vector2, b: Vector2) => Math.hypot(a.x - b.x, a.y - b.y);
  
  const addShake = (amount: number) => {
    shakeRef.current = Math.min(shakeRef.current + amount, 20);
  };
  
  const triggerHitStop = (frames: number) => {
     gameStateRef.current.hitStop = frames;
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
  
  const spawnDebris = (pos: Vector2, color: string, type: 'BLOOD' | 'BONE' | 'CRATER') => {
      debrisRef.current.push({
         id: Math.random(),
         pos: { ...pos, x: pos.x + (Math.random()-0.5)*10, y: pos.y + (Math.random()-0.5)*10 },
         color,
         size: 2 + Math.random() * 3,
         type
      });
      if (debrisRef.current.length > 200) debrisRef.current.shift();
  };

  // --- Initialization Logic for Map ---
  const initMap = () => {
    // Removed obstacles as per request for a cleaner field
  };

  // --- Random Item Spawner ---
  const spawnRandomItem = () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const pos = {
      x: playerRef.current.pos.x + Math.cos(angle) * dist,
      y: playerRef.current.pos.y + Math.sin(angle) * dist
    };

    const rand = Math.random();
    let type = EntityType.ITEM_POTION_RED;
    let color = '#ef4444';

    if (rand > 0.95) {
      type = EntityType.ITEM_SCROLL_NUKE;
      color = '#f59e0b';
    } else if (rand > 0.8) {
      type = EntityType.ITEM_BOOTS_SPEED;
      color = '#06b6d4';
    } else if (rand > 0.5) {
      type = EntityType.ITEM_POTION_BLUE;
      color = '#3b82f6';
    }

    entitiesRef.current.push({
      id: Math.random(),
      type,
      pos,
      vel: {x:0, y:0},
      radius: 8,
      hp: 1, maxHp: 1,
      color,
      damage: 0,
      speed: 0,
      isDead: false,
      status: { burnTimer: 0, poisonTimer: 0, freezeTimer: 0, stunTimer: 0 }
    });
  };

  const spawnPet = (type: EntityType) => {
     const angle = Math.random() * Math.PI * 2;
     const spawnPos = {
        x: playerRef.current.pos.x + Math.cos(angle) * 30,
        y: playerRef.current.pos.y + Math.sin(angle) * 30
     };
     
     let color = '#fff';
     let radius = 4;
     let damage = playerStatsRef.current.damage * 0.5;
     
     if (type === EntityType.PET_DOG) { color = '#92400e'; radius = 5; damage = playerStatsRef.current.damage; }
     if (type === EntityType.PET_BIRD) { color = '#0ea5e9'; radius = 3; }

     entitiesRef.current.push({
        id: Math.random(),
        type,
        pos: spawnPos,
        vel: {x:0, y:0},
        radius,
        hp: 9999, maxHp: 9999, // Immortal pets
        color,
        damage,
        speed: playerStatsRef.current.moveSpeed * 1.2,
        isDead: false,
        status: { burnTimer:0, poisonTimer:0, freezeTimer:0, stunTimer:0 },
        attackCooldown: 0
     });
     spawnParticle(spawnPos, color, 10, 1);
  };

  const spawnEnemy = (forceElite = false) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = RENDER_WIDTH; 
    const spawnPos = {
      x: playerRef.current.pos.x + Math.cos(angle) * dist,
      y: playerRef.current.pos.y + Math.sin(angle) * dist,
    };

    const currentWave = gameStateRef.current.wave;
    const rand = Math.random();
    
    // Scale stats based on wave up to 30
    const waveScaleHP = 1 + (currentWave * 0.4); 
    const waveScaleDmg = 1 + (currentWave * 0.15);
    const waveScaleSpeed = 1 + (currentWave * 0.02); // Slight speed up

    let type = EntityType.ENEMY_SLIME;
    let radius = 6;
    let maxHp = 20;
    let damage = 8;
    let speed = 0.5;
    let color = '#ef4444'; 

    // Enemy Type Distribution Logic for 30 Waves
    if (currentWave < 5) {
        if (rand > 0.8) type = EntityType.ENEMY_BAT;
        else type = EntityType.ENEMY_SLIME;
    } else if (currentWave < 10) {
        if (rand > 0.8) type = EntityType.ENEMY_SKELETON;
        else if (rand > 0.6) type = EntityType.ENEMY_BAT;
        else type = EntityType.ENEMY_SLIME;
    } else if (currentWave < 20) {
        if (rand > 0.85) type = EntityType.ENEMY_GOLEM;
        else if (rand > 0.7) type = EntityType.ENEMY_ARCHER;
        else if (rand > 0.5) type = EntityType.ENEMY_SKELETON;
        else type = EntityType.ENEMY_BAT;
    } else {
        if (rand > 0.8) type = EntityType.ENEMY_GOLEM;
        else if (rand > 0.6) type = EntityType.ENEMY_ARCHER;
        else if (rand > 0.4) type = EntityType.ENEMY_SKELETON;
        else type = EntityType.ENEMY_BAT;
    }

    // Base stats per type
    if (type === EntityType.ENEMY_SLIME) {
        maxHp = 20; damage = 8; speed = 0.5; color = '#ef4444';
    } else if (type === EntityType.ENEMY_BAT) {
        maxHp = 15; damage = 5; speed = 1.3; color = '#a78bfa'; radius = 4;
    } else if (type === EntityType.ENEMY_SKELETON) {
        maxHp = 50; damage = 15; speed = 0.85; color = '#d1d5db'; radius = 7;
    } else if (type === EntityType.ENEMY_ARCHER) {
        maxHp = 40; damage = 10; speed = 0.65; color = '#16a34a'; radius = 6;
    } else if (type === EntityType.ENEMY_GOLEM) {
        maxHp = 100; damage = 25; speed = 0.35; color = '#78716c'; radius = 10;
    }

    // Apply scaling
    maxHp *= waveScaleHP;
    damage *= waveScaleDmg;
    speed *= waveScaleSpeed;

    if (forceElite) {
       maxHp *= 4;
       damage *= 1.5;
       radius *= 1.3;
       speed *= 1.1;
       spawnFloatingText(spawnPos, "ELITE!", "#facc15");
    }

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
      xpValue: forceElite ? Math.floor(maxHp) : Math.max(1, Math.floor(maxHp / 5)), 
      knockback: { x: 0, y: 0 },
      attackCooldown: 0,
      status: { burnTimer: 0, poisonTimer: 0, freezeTimer: 0, stunTimer: 0 },
      isElite: forceElite
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
      radius: 30, // Bigger boss
      hp: 50000, // Massive HP for wave 30
      maxHp: 50000,
      color: '#a855f7',
      damage: 50,
      speed: 0.8,
      isDead: false,
      xpValue: 10000,
      knockback: { x: 0, y: 0 },
      attackCooldown: 100,
      status: { burnTimer: 0, poisonTimer: 0, freezeTimer: 0, stunTimer: 0 }
    });
    
    bossSpawnedRef.current = true;
    playSound.bossSpawn();
    addShake(20);
    spawnFloatingText(playerRef.current.pos, "FINAL BOSS!", "#9333ea");
  };
  
  const resolveCollision = (ent: Entity, newX: number, newY: number) => {
      let collided = false;
      for (const obs of entitiesRef.current) {
         if (obs.type === EntityType.OBSTACLE_ROCK || obs.type === EntityType.OBSTACLE_BARREL) {
             const dist = Math.hypot(newX - obs.pos.x, newY - obs.pos.y);
             if (dist < ent.radius + obs.radius) {
                collided = true;
                break;
             }
         }
      }
      return collided;
  };

  // --- Drawing Helpers ---
  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Entity, mousePos: Vector2, facingRight: boolean) => {
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    if (!facingRight) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(gameStateRef.current.time * 0.2) * 1;
    const isEvolved = playerStatsRef.current.damage > (HEROES[selectedHero].stats.damage * 1.8);

    if (speedBoostTimerRef.current > 0) {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
    }

    // Shield Visual
    if (playerStatsRef.current.shieldCurrent > 0) {
       const shieldPct = playerStatsRef.current.shieldCurrent / playerStatsRef.current.shieldMax;
       ctx.strokeStyle = `rgba(59, 130, 246, ${shieldPct * 0.8})`;
       ctx.lineWidth = 1.5;
       ctx.beginPath();
       ctx.arc(0, 0, p.radius + 6, 0, Math.PI*2);
       ctx.stroke();
       ctx.fillStyle = `rgba(59, 130, 246, ${shieldPct * 0.1})`;
       ctx.fill();
    }

    if (selectedHero === HeroType.KNIGHT) {
      ctx.fillStyle = p.color;
      ctx.fillRect(-4, -6 + bob, 8, 10);
      ctx.fillStyle = isEvolved ? '#fbbf24' : '#60a5fa'; 
      ctx.fillRect(-4, -10 + bob, 8, 4);
    } else if (selectedHero === HeroType.MAGE) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -12 + bob);
      ctx.lineTo(6, 4 + bob);
      ctx.lineTo(-6, 4 + bob);
      ctx.fill();
      ctx.fillStyle = isEvolved ? '#fbbf24' : '#581c87';
      ctx.beginPath();
      ctx.moveTo(-6, -8 + bob);
      ctx.lineTo(6, -8 + bob);
      ctx.lineTo(0, -16 + bob);
      ctx.fill();
    } else if (selectedHero === HeroType.ROGUE) {
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
        // If 360 attack (areaScale > 2.5), we rotate continuously or just draw big spin
        if (playerStatsRef.current.areaScale > 2.5) {
             ctx.rotate(gameStateRef.current.time * 0.5);
        } else {
             ctx.rotate(Math.PI * 0.5 + attackProgress * Math.PI); 
        }
    } else {
        ctx.rotate(Math.PI * -0.2);
    }
    
    if (selectedHero === HeroType.KNIGHT) {
      ctx.fillStyle = isEvolved ? '#fcd34d' : '#e2e8f0'; 
      ctx.fillRect(0, -8, 3, 10);
      ctx.fillStyle = '#475569'; ctx.fillRect(-1, 0, 5, 2);
    } else if (selectedHero === HeroType.MAGE) {
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, -8, 2, 12);
      ctx.fillStyle = isEvolved ? '#ef4444' : '#f0abfc'; ctx.fillRect(-1, -10, 4, 4);
    } else if (selectedHero === HeroType.ROGUE) {
      ctx.fillStyle = isEvolved ? '#4ade80' : '#cbd5e1'; 
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -6); ctx.lineTo(4, 0); ctx.fill();
    }
    ctx.restore();

    if (invulnerableTimerRef.current > 0 && Math.floor(gameStateRef.current.time / 4) % 2 === 0) {
       ctx.globalCompositeOperation = 'source-atop';
       ctx.fillStyle = 'white';
       ctx.fillRect(-10, -20, 20, 30);
    }

    ctx.restore();
  };

  const drawEntity = (ctx: CanvasRenderingContext2D, e: Entity) => {
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.8, e.radius, e.radius * 0.4, 0, 0, Math.PI*2);
    ctx.fill();

    const time = gameStateRef.current.time;

    // Draw Pets
    if (e.type === EntityType.PET_DOG || e.type === EntityType.PET_BIRD) {
       ctx.fillStyle = e.color;
       if (e.type === EntityType.PET_DOG) {
          const run = Math.sin(time * 0.3) * 2;
          ctx.fillRect(-4, -4 + run, 8, 5); // body
          ctx.fillRect(2, -7 + run, 4, 4); // head
          ctx.fillRect(-5, -3 + run, 2, 2); // tail
       } else if (e.type === EntityType.PET_BIRD) {
          const flap = Math.sin(time * 0.5) * 3;
          ctx.translate(0, -8 + flap);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-4, -2); ctx.lineTo(4, -2); ctx.fill();
          ctx.fillStyle = '#0284c7'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-6, -4 + flap); ctx.lineTo(0, -2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(6, -4 + flap); ctx.lineTo(0, -2); ctx.fill();
       }
       ctx.restore();
       return;
    }

    if (e.isElite) {
       ctx.scale(1.5, 1.5);
       ctx.shadowColor = '#facc15';
       ctx.shadowBlur = 10;
    }

    let drawColor = e.color;
    if (e.status.burnTimer > 0) drawColor = '#f97316'; 
    if (e.status.poisonTimer > 0) drawColor = '#84cc16'; 
    if (e.status.freezeTimer > 0) drawColor = '#60a5fa'; 
    if (e.status.stunTimer > 0) drawColor = '#facc15';

    const drawHp = () => {
       if (e.hp < e.maxHp) {
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = 'black';
        ctx.fillRect(-5, -e.radius - 8, 10, 2);
        ctx.fillStyle = drawColor;
        ctx.fillRect(-5, -e.radius - 8, 10 * pct, 2);
      }
    };

    if (e.type === EntityType.ENEMY_SLIME) {
      const wobble = Math.sin(time * 0.2 + e.id * 10) * 2;
      ctx.fillStyle = drawColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius, e.radius + wobble * 0.1, 0, Math.PI, 0); 
      ctx.lineTo(e.radius, 0); ctx.quadraticCurveTo(0, 2, -e.radius, 0); ctx.fill();
    } else if (e.type === EntityType.ENEMY_BAT) {
       const flap = Math.sin(time * 0.8) * 5;
       ctx.fillStyle = drawColor;
       ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
       ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -5 + flap); ctx.lineTo(-4, 2); ctx.fill();
       ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -5 + flap); ctx.lineTo(4, 2); ctx.fill();
    } else if (e.type === EntityType.ENEMY_ARCHER) {
       ctx.fillStyle = drawColor; ctx.fillRect(-3, -6, 6, 10);
       ctx.fillStyle = '#14532d'; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, -6); ctx.lineTo(0, -10); ctx.fill();
    } else if (e.type === EntityType.ENEMY_GOLEM) {
       const walk = Math.sin(time * 0.1) * 2;
       ctx.fillStyle = drawColor; ctx.fillRect(-8, -10 + walk, 16, 14);
       ctx.fillStyle = '#57534e'; ctx.fillRect(-10, -6 + walk, 4, 10); ctx.fillRect(6, -6 + walk, 4, 10);
    } else if (e.type === EntityType.ENEMY_SKELETON) {
       ctx.fillStyle = drawColor; ctx.fillRect(-2, -2, 4, 6); ctx.fillRect(-3, -7, 6, 5); 
    } else if (e.type === EntityType.ENEMY_BOSS) {
       const hover = Math.sin(time * 0.05) * 5; ctx.translate(0, hover);
       ctx.fillStyle = '#581c87'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.fill();
       ctx.fillStyle = '#3b0764'; ctx.beginPath(); ctx.arc(0, -15, 10, 0, Math.PI*2); ctx.fill();
    }

    if (e.status.burnTimer > 0 && time % 20 < 10) {
       spawnParticle({x: e.pos.x, y: e.pos.y - e.radius}, '#f97316', 1, 0.5, 1);
    }
    if (e.status.stunTimer > 0) {
        ctx.fillStyle = '#facc15';
        ctx.save();
        ctx.translate(0, -e.radius - 12);
        ctx.rotate(time * 0.2);
        ctx.fillRect(-2,-2,4,4);
        ctx.restore();
    }

    drawHp();
    ctx.restore();
  };

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

    if (gameStateRef.current.hitStop > 0) {
       gameStateRef.current.hitStop--;
       frameIdRef.current = requestAnimationFrame(loop);
       return; 
    }

    const player = playerRef.current;
    const stats = playerStatsRef.current;

    gameStateRef.current.time++;
    if (invulnerableTimerRef.current > 0) invulnerableTimerRef.current--;
    if (speedBoostTimerRef.current > 0) speedBoostTimerRef.current--;
    if (gameStateRef.current.specialCooldown > 0) gameStateRef.current.specialCooldown--;
    if (shakeRef.current > 0) shakeRef.current *= 0.9;
    if (shakeRef.current < 0.5) shakeRef.current = 0;
    
    // Shield Regeneration (1 per second if shield is missing)
    if (gameStateRef.current.time % 60 === 0 && stats.shieldCurrent < stats.shieldMax) {
       stats.shieldCurrent = Math.min(stats.shieldMax, stats.shieldCurrent + 1);
    }

    const currentWave = 1 + Math.floor(gameStateRef.current.time / WAVE_DURATION);
    gameStateRef.current.wave = Math.min(currentWave, BOSS_SPAWN_WAVE);

    let dx = 0;
    let dy = 0;
    
    if (inputRef.current.up) dy -= 1;
    if (inputRef.current.down) dy += 1;
    if (inputRef.current.left) dx -= 1;
    if (inputRef.current.right) dx += 1;
    
    dx += inputRef.current.moveX;
    dy += inputRef.current.moveY;

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    } else if (len < 0.1) {
      dx = 0; 
      dy = 0;
    }

    let currentSpeed = stats.moveSpeed;
    if (invulnerableTimerRef.current > 0 && selectedHero === HeroType.ROGUE) currentSpeed *= 2; 
    if (speedBoostTimerRef.current > 0) currentSpeed *= 1.5;

    if (dx !== 0 || dy !== 0) {
      const nextX = player.pos.x + dx * currentSpeed;
      const nextY = player.pos.y + dy * currentSpeed;
      if (!resolveCollision(player, nextX, player.pos.y)) player.pos.x = nextX;
      if (!resolveCollision(player, player.pos.x, nextY)) player.pos.y = nextY;
    }

    cameraRef.current.x += (player.pos.x - RENDER_WIDTH / 2 - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (player.pos.y - RENDER_HEIGHT / 2 - cameraRef.current.y) * 0.1;

    // Pet Spawning Logic
    const currentPets = entitiesRef.current.filter(e => e.type === EntityType.PET_DOG || e.type === EntityType.PET_BIRD).length;
    if (currentPets < stats.petCount && stats.petType !== 'NONE') {
        const type = stats.petType === 'DOG' ? EntityType.PET_DOG : EntityType.PET_BIRD;
        spawnPet(type);
    }

    if (inputRef.current.special && gameStateRef.current.specialCooldown <= 0) {
      gameStateRef.current.specialCooldown = stats.specialCooldownMax;
      playSound.levelUp(); 
      const dashDir = (Math.abs(dx)+Math.abs(dy) > 0) ? {x: dx, y: dy} : {x: 1, y: 0};
      player.pos.x += dashDir.x * 60;
      player.pos.y += dashDir.y * 60;
      
      if (selectedHero === HeroType.KNIGHT) {
         addShake(10);
         spawnParticle(player.pos, '#fbbf24', 20, 4);
         entitiesRef.current.forEach(ent => {
            if (getDistance(ent.pos, player.pos) < 80 && ent.type < EntityType.LOOT_XP) {
               ent.knockback = { x: (ent.pos.x - player.pos.x) * 0.3, y: (ent.pos.y - player.pos.y) * 0.3 };
               ent.status.stunTimer = 60;
               ent.hp -= stats.damage * 2;
               spawnFloatingText(ent.pos, "STUN", "#fbbf24");
            }
         });
      } else if (selectedHero === HeroType.MAGE) {
         addShake(5);
         spawnParticle(player.pos, '#a855f7', 10, 2); 
         for(let i=0; i<12; i++) {
           const angle = (Math.PI * 2 / 12) * i;
           projectilesRef.current.push({
             id: Math.random(), pos: { ...player.pos }, vel: { x: Math.cos(angle)*4, y: Math.sin(angle)*4 },
             damage: stats.damage, radius: 4, color: '#a855f7', isHostile: false, life: 40, pierce: 2
           });
         }
      } else if (selectedHero === HeroType.ROGUE) {
         invulnerableTimerRef.current = 60; 
         spawnParticle(player.pos, '#10b981', 10, 1);
         spawnFloatingText(player.pos, "EVADE", "#10b981");
      }
    }

    if (player.attackCooldown && player.attackCooldown > 0) {
      player.attackCooldown--;
    } else {
      if (inputRef.current.attack) {
        player.attackCooldown = stats.attackSpeed;
        playSound.attack(); 
        
        // Knight Stun Screen Chance Logic
        if (stats.stunScreenChance > 0 && Math.random() < stats.stunScreenChance) {
             addShake(10);
             spawnFloatingText(player.pos, "EARTHQUAKE!", "#fbbf24");
             entitiesRef.current.forEach(e => {
                 if (e.type < EntityType.LOOT_XP && (e.type !== EntityType.PET_DOG && e.type !== EntityType.PET_BIRD)) {
                     e.status.stunTimer = 90; // 1.5s stun
                     spawnParticle(e.pos, '#fbbf24', 3, 2);
                 }
             });
        }
        
        let angleToMouse = 0;
        if (inputRef.current.isMobileInput) {
           let closest = null; let minDist = 150; 
           entitiesRef.current.forEach(ent => {
             if (ent.type < EntityType.LOOT_XP && ent.type !== EntityType.PET_DOG && ent.type !== EntityType.PET_BIRD) { 
                const d = getDistance(player.pos, ent.pos);
                if (d < minDist) { minDist = d; closest = ent; }
             }
           });
           if (closest) {
              angleToMouse = Math.atan2(closest.pos.y - player.pos.y, closest.pos.x - player.pos.x);
           } else if (Math.abs(inputRef.current.moveX) > 0.1 || Math.abs(inputRef.current.moveY) > 0.1) {
              angleToMouse = Math.atan2(inputRef.current.moveY, inputRef.current.moveX);
           } else { angleToMouse = 0; }
        } else {
           const mouseWorldX = inputRef.current.mouseX + cameraRef.current.x;
           const mouseWorldY = inputRef.current.mouseY + cameraRef.current.y;
           angleToMouse = Math.atan2(mouseWorldY - player.pos.y, mouseWorldX - player.pos.x);
        }

        const isEvolved = stats.damage > (HEROES[selectedHero].stats.damage * 1.8);

        if (stats.weaponType === 'MELEE') {
          // Attack Area Logic - 360 Degree scaling
          let attackArc = Math.PI / 1.5; // Default 120 degrees
          if (stats.areaScale > 1.5) attackArc = Math.PI; // 180 degrees
          if (stats.areaScale > 2.5) attackArc = Math.PI * 2; // 360 degrees

          const slashRange = 25 * stats.areaScale * (isEvolved ? 1.5 : 1);
          
          visualEffectsRef.current.push({
             id: Math.random(), type: 'SLASH', pos: { x: player.pos.x, y: player.pos.y },
             angle: angleToMouse, range: slashRange, arc: attackArc, color: isEvolved ? '#fcd34d' : player.color, life: 8, maxLife: 8
          });

          entitiesRef.current.forEach(ent => {
            if (ent.type >= EntityType.LOOT_XP || ent.type === EntityType.PET_DOG || ent.type === EntityType.PET_BIRD) return; 
            const dist = getDistance(player.pos, ent.pos);
            const reach = 45 * stats.areaScale * (isEvolved ? 1.3 : 1); 
            
            if (dist < reach) {
              const angleToEnt = Math.atan2(ent.pos.y - player.pos.y, ent.pos.x - player.pos.x);
              let angleDiff = angleToEnt - angleToMouse;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              
              // Check arc collision (half of arc on each side)
              if (Math.abs(angleDiff) < (attackArc / 2)) { 
                 const isCrit = Math.random() < stats.critChance;
                 const dmg = isCrit ? stats.damage * stats.critMultiplier : stats.damage;
                 ent.hp -= dmg;
                 ent.knockback = { x: Math.cos(angleToEnt) * 4, y: Math.sin(angleToEnt) * 4 };
                 visualEffectsRef.current.push({
                   id: Math.random(), type: 'IMPACT', pos: ent.pos, life: 5, maxLife: 5, color: '#fff', size: 10
                 });
                 spawnFloatingText(ent.pos, Math.floor(dmg).toString(), isCrit ? '#fca5a5' : '#fff');
                 playSound.enemyHit();
                 if (isCrit) { addShake(3); triggerHitStop(2); } else { addShake(1); }
                 
                 // Chain Lightning Logic
                 if (Math.random() < stats.lightningChance) {
                    let chainTarget = entitiesRef.current.find(other => 
                       other.id !== ent.id && !other.isDead && other.type < EntityType.LOOT_XP && getDistance(ent.pos, other.pos) < 100
                    );
                    if (chainTarget) {
                       chainTarget.hp -= dmg * 0.8;
                       spawnLightning(ent.pos, chainTarget.pos);
                       spawnFloatingText(chainTarget.pos, "ZAP!", "#fef08a");
                    } else {
                       spawnLightning(ent.pos, {x: ent.pos.x + (Math.random()-0.5)*20, y: ent.pos.y + (Math.random()-0.5)*20});
                    }
                 }
                 if (stats.burnChance > 0) ent.status.burnTimer = 180;
                 if (stats.freezeChance > 0) ent.status.freezeTimer = 120;
                 if (stats.poisonChance > 0) ent.status.poisonTimer = 300;
              }
            }
          });
        }

        if (stats.weaponType === 'RANGED' || stats.projectileCount > 0) {
           const count = (stats.weaponType === 'RANGED' ? 1 : 0) + stats.projectileCount;
           for(let i=0; i<count; i++) {
             const spread = (i - (count-1)/2) * 0.2; 
             projectilesRef.current.push({
               id: Math.random(), pos: { ...player.pos },
               vel: { x: Math.cos(angleToMouse + spread) * 4, y: Math.sin(angleToMouse + spread) * 4 },
               damage: stats.damage * (stats.weaponType === 'RANGED' ? 1 : 0.5),
               radius: 3 * stats.areaScale * (isEvolved ? 1.5 : 1),
               color: isEvolved ? '#fcd34d' : (stats.weaponType === 'RANGED' ? heroConfig.color : '#60a5fa'),
               isHostile: false, life: 60, homing: stats.hasHoming, ricochet: stats.hasRicochet,
               pierce: stats.pierceCount + (isEvolved ? 2 : 0),
               applyBurn: stats.burnChance > 0, applyFreeze: stats.freezeChance > 0, applyPoison: stats.poisonChance > 0
             });
           }
        }
      }
    }

    if (gameStateRef.current.time % 60 === 0 && entitiesRef.current.length < 150 && !gameStateRef.current.isVictory) {
       const spawnCount = 1 + Math.floor(gameStateRef.current.time / (60 * 30)); 
       for(let i=0; i<spawnCount; i++) spawnEnemy();
       if (gameStateRef.current.time % 3600 === 0) spawnEnemy(true);
    }
    
    if (!bossSpawnedRef.current && gameStateRef.current.wave >= BOSS_SPAWN_WAVE) spawnBoss();
    if (gameStateRef.current.time % 120 === 0 && Math.random() < 0.05) spawnRandomItem();

    entitiesRef.current.forEach(ent => {
      // Pet Logic
      if (ent.type === EntityType.PET_DOG || ent.type === EntityType.PET_BIRD) {
          // Find target
          if (!ent.targetId || Math.random() < 0.05) {
             let closest = null; let minD = 200;
             entitiesRef.current.forEach(e => {
                if (e.type < EntityType.LOOT_XP && e.type !== EntityType.PET_DOG && e.type !== EntityType.PET_BIRD) {
                    const d = getDistance(ent.pos, e.pos);
                    if (d < minD) { minD = d; closest = e; }
                }
             });
             ent.targetId = closest?.id;
          }
          
          const target = entitiesRef.current.find(e => e.id === ent.targetId);
          
          if (target && !target.isDead) {
             const dist = getDistance(ent.pos, target.pos);
             const angle = Math.atan2(target.pos.y - ent.pos.y, target.pos.x - ent.pos.x);
             
             if (ent.type === EntityType.PET_DOG) {
                // Move to enemy
                ent.vel.x = Math.cos(angle) * ent.speed;
                ent.vel.y = Math.sin(angle) * ent.speed;
                
                if (dist < 10 && (ent.attackCooldown || 0) <= 0) {
                    ent.attackCooldown = 30;
                    target.hp -= ent.damage;
                    spawnParticle(target.pos, '#fff', 3, 1);
                    playSound.enemyHit();
                }
             } else if (ent.type === EntityType.PET_BIRD) {
                // Hover at distance
                if (dist > 60) {
                    ent.vel.x = Math.cos(angle) * ent.speed;
                    ent.vel.y = Math.sin(angle) * ent.speed;
                } else if (dist < 40) {
                    ent.vel.x = -Math.cos(angle) * ent.speed;
                    ent.vel.y = -Math.sin(angle) * ent.speed;
                } else {
                    ent.vel.x = 0; ent.vel.y = 0;
                }
                
                if ((ent.attackCooldown || 0) <= 0) {
                   ent.attackCooldown = 60;
                   projectilesRef.current.push({
                      id: Math.random(), pos: { ...ent.pos },
                      vel: { x: Math.cos(angle)*3, y: Math.sin(angle)*3 },
                      damage: ent.damage, radius: 2, color: '#0ea5e9', isHostile: false, life: 40
                   });
                }
             }
          } else {
             // Return to player
             const distToPlayer = getDistance(ent.pos, player.pos);
             if (distToPlayer > 40) {
                const angle = Math.atan2(player.pos.y - ent.pos.y, player.pos.x - ent.pos.x);
                ent.vel.x = Math.cos(angle) * ent.speed;
                ent.vel.y = Math.sin(angle) * ent.speed;
             } else {
                ent.vel.x = 0; ent.vel.y = 0;
             }
          }
          
          if (ent.attackCooldown && ent.attackCooldown > 0) ent.attackCooldown--;
          
          ent.pos.x += ent.vel.x;
          ent.pos.y += ent.vel.y;
          // No collision for pets
          return; 
      }

      if (ent.knockback) {
        ent.pos.x += ent.knockback.x; ent.pos.y += ent.knockback.y;
        ent.knockback.x *= 0.8; ent.knockback.y *= 0.8;
      }
      if (ent.status.stunTimer > 0) {
        ent.status.stunTimer--;
      } else {
        if (ent.type < EntityType.LOOT_XP && ent.type !== EntityType.OBSTACLE_ROCK && ent.type !== EntityType.OBSTACLE_BARREL) {
            let moveSpeed = ent.speed;
            if (ent.status.freezeTimer > 0) moveSpeed *= 0.5;
            const dist = getDistance(ent.pos, player.pos);
            if (ent.type === EntityType.ENEMY_ARCHER) {
              if (dist < 80) {
                ent.vel.x = (ent.pos.x - player.pos.x) / dist * moveSpeed;
                ent.vel.y = (ent.pos.y - player.pos.y) / dist * moveSpeed;
              } else if (dist > 150) {
                ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed;
                ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed;
              } else { ent.vel.x = 0; ent.vel.y = 0; }
              if (ent.attackCooldown !== undefined) {
                 if (ent.attackCooldown > 0) ent.attackCooldown--;
                 else if (dist < 200) {
                    ent.attackCooldown = 120;
                    const angle = Math.atan2(player.pos.y - ent.pos.y, player.pos.x - ent.pos.x);
                    // Reduced enemy bullet speed (3 * 0.7 = 2.1)
                    projectilesRef.current.push({
                       id: Math.random(), pos: { ...ent.pos }, vel: { x: Math.cos(angle)*2.1, y: Math.sin(angle)*2.1 },
                       damage: ent.damage, radius: 2, color: '#ef4444', isHostile: true, life: 100
                    });
                 }
              }
            } else if (ent.type === EntityType.ENEMY_BAT) {
              ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed + Math.sin(gameStateRef.current.time * 0.2 + ent.id)*0.5;
              ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed + Math.cos(gameStateRef.current.time * 0.2 + ent.id)*0.5;
            } else {
              if (dist > 0) {
                ent.vel.x = (player.pos.x - ent.pos.x) / dist * moveSpeed;
                ent.vel.y = (player.pos.y - ent.pos.y) / dist * moveSpeed;
              }
            }
            const nextX = ent.pos.x + ent.vel.x;
            const nextY = ent.pos.y + ent.vel.y;
            if (!resolveCollision(ent, nextX, ent.pos.y)) ent.pos.x = nextX;
            if (!resolveCollision(ent, ent.pos.x, nextY)) ent.pos.y = nextY;
            
            if (ent.type === EntityType.ENEMY_BOSS && ent.attackCooldown !== undefined) {
               if (ent.attackCooldown > 0) ent.attackCooldown--;
               else {
                  ent.attackCooldown = 80;
                  const angle = Math.atan2(player.pos.y - ent.pos.y, player.pos.x - ent.pos.x);
                  for(let i=-2; i<=2; i++) {
                     // Reduced boss bullet speed (2 * 0.7 = 1.4)
                     projectilesRef.current.push({
                       id: Math.random(), pos: { ...ent.pos }, vel: { x: Math.cos(angle + i*0.2) * 1.4, y: Math.sin(angle + i*0.2) * 1.4 },
                       damage: 15, radius: 4, color: '#ef4444', isHostile: true, life: 120
                     });
                  }
               }
            }
            if (getDistance(ent.pos, player.pos) < ent.radius + player.radius) {
               if (invulnerableTimerRef.current <= 0) {
                 // SHIELD LOGIC
                 if (stats.shieldCurrent > 0) {
                    stats.shieldCurrent -= 1; // Absorb hit
                    playSound.hit();
                    // Shield Hit Visual
                    visualEffectsRef.current.push({
                       id: Math.random(), type: 'IMPACT', pos: player.pos, life: 5, maxLife: 5, color: '#3b82f6', size: 10
                    });
                 } else {
                    player.hp -= 0.5; 
                    if (Math.random() < 0.1) { spawnParticle(player.pos, '#ff0000', 1, 1); playSound.hit(); addShake(3); }
                 }
                 
                 // REFLECTION LOGIC
                 if (stats.reflectDamage > 0) {
                    ent.hp -= (0.5 * stats.reflectDamage) * 10; // Deal 10x base hit as reflect
                    spawnFloatingText(ent.pos, "REFLECT", "#cbd5e1");
                 }
               }
            }
        }
      }
      if (ent.status.burnTimer > 0) {
        ent.status.burnTimer--;
        if (gameStateRef.current.time % 30 === 0) { ent.hp -= 2; spawnFloatingText(ent.pos, "2", "#f97316"); }
      }
      if (ent.status.poisonTimer > 0) {
        ent.status.poisonTimer--;
        if (gameStateRef.current.time % 45 === 0) { ent.hp -= 1; spawnFloatingText(ent.pos, "1", "#84cc16"); }
      }
      if (ent.status.freezeTimer > 0) ent.status.freezeTimer--;

      if (ent.type >= EntityType.LOOT_XP) {
        const dist = getDistance(ent.pos, player.pos);
        if (dist < stats.pickupRange) {
           ent.pos.x += (player.pos.x - ent.pos.x) * 0.15;
           ent.pos.y += (player.pos.y - ent.pos.y) * 0.15;
           if (dist < 10) {
             ent.hp = 0; ent.isDead = true; 
             if (ent.type === EntityType.LOOT_XP) {
               gameStateRef.current.xp += ent.xpValue || 1; gameStateRef.current.score += 10; playSound.pickup(true);
             } else if (ent.type === EntityType.LOOT_CHEST) {
                gameStateRef.current.score += 500; playSound.levelUp(); spawnFloatingText(player.pos, "TREASURE!", "#facc15");
                gameStateRef.current.xp += gameStateRef.current.xpToNextLevel;
             } else if (ent.type === EntityType.LOOT_HP || ent.type === EntityType.ITEM_POTION_RED) {
               player.hp = Math.min(player.hp + (ent.type === EntityType.LOOT_HP ? 20 : 50), stats.maxHp);
               spawnFloatingText(player.pos, "+HP", "#10b981"); playSound.pickup(false);
             } else if (ent.type === EntityType.ITEM_POTION_BLUE) {
                gameStateRef.current.xp += 100; spawnFloatingText(player.pos, "+100 XP", "#3b82f6"); playSound.pickup(true);
             } else if (ent.type === EntityType.ITEM_BOOTS_SPEED) {
                speedBoostTimerRef.current = 600; spawnFloatingText(player.pos, "SPEED!", "#06b6d4"); playSound.levelUp();
             } else if (ent.type === EntityType.ITEM_SCROLL_NUKE) {
                addShake(20); triggerHitStop(10);
                visualEffectsRef.current.push({ id: Math.random(), type: 'NUKE', pos: player.pos, life: 20, maxLife: 20, color: '#f59e0b', size: 0 });
                entitiesRef.current.forEach(e => { if (e.type < EntityType.LOOT_XP && e.type !== EntityType.ENEMY_BOSS) { e.hp = 0; spawnFloatingText(e.pos, "9999", "#f59e0b"); } });
                playSound.bossSpawn();
             }
           }
        }
      }
    });

    // Update Projectiles
    projectilesRef.current.forEach(proj => {
      if (!proj.isHostile && gameStateRef.current.time % 3 === 0) {
         particlesRef.current.push({ id: Math.random(), pos: {...proj.pos}, vel: {x:0,y:0}, life: 10, maxLife: 10, color: proj.color, size: 1 });
      }
      if (proj.homing && !proj.isHostile) {
         let closest = null; let minDist = 100;
         entitiesRef.current.forEach(ent => {
             if (ent.type >= EntityType.LOOT_XP) return;
             const d = getDistance(proj.pos, ent.pos);
             if (d < minDist) { minDist = d; closest = ent; }
         });
         if (closest) {
             const angle = Math.atan2(closest.pos.y - proj.pos.y, closest.pos.x - proj.pos.x);
             proj.vel.x += Math.cos(angle) * 0.5; proj.vel.y += Math.sin(angle) * 0.5;
             const speed = Math.hypot(proj.vel.x, proj.vel.y);
             if (speed > 4) { proj.vel.x = (proj.vel.x/speed)*4; proj.vel.y = (proj.vel.y/speed)*4; }
         }
      }
      const nextX = proj.pos.x + proj.vel.x;
      const nextY = proj.pos.y + proj.vel.y;
      let hitObstacle = false;
      for (const obs of entitiesRef.current) {
          if (obs.type === EntityType.OBSTACLE_ROCK || obs.type === EntityType.OBSTACLE_BARREL) {
              if (getDistance({x: nextX, y: nextY}, obs.pos) < proj.radius + obs.radius) {
                 hitObstacle = true; proj.life = 0; spawnParticle(proj.pos, '#9ca3af', 5, 2);
                 if (obs.type === EntityType.OBSTACLE_BARREL) { obs.hp -= 10; }
                 break;
              }
          }
      }
      if (!hitObstacle) { proj.pos.x = nextX; proj.pos.y = nextY; }
      proj.life--;
      
      if (proj.isHostile) {
        if (getDistance(proj.pos, player.pos) < proj.radius + player.radius) {
          if (invulnerableTimerRef.current <= 0) {
             // SHIELD LOGIC
             if (stats.shieldCurrent > 0) {
                 stats.shieldCurrent -= proj.damage;
                 if (stats.shieldCurrent < 0) stats.shieldCurrent = 0;
                 visualEffectsRef.current.push({
                   id: Math.random(), type: 'IMPACT', pos: player.pos, life: 5, maxLife: 5, color: '#3b82f6', size: 10
                 });
             } else {
                 player.hp -= proj.damage; spawnParticle(player.pos, '#ff0000', 5, 2); playSound.hit(); addShake(4);
             }
          }
          proj.life = 0;
        }
      } else {
        for (let ent of entitiesRef.current) {
           if (ent.type < EntityType.LOOT_XP && ent.type !== EntityType.PET_DOG && ent.type !== EntityType.PET_BIRD) {
            if (getDistance(proj.pos, ent.pos) < proj.radius + ent.radius) {
               // Use dynamic critMultiplier
               const isCrit = Math.random() < stats.critChance;
               const damageDealt = isCrit ? proj.damage * stats.critMultiplier : proj.damage;
               
               ent.hp -= damageDealt;
               spawnParticle(ent.pos, ent.color, 3, 1);
               spawnFloatingText(ent.pos, Math.floor(damageDealt).toString(), isCrit ? '#fca5a5' : '#fff');
               ent.knockback = { x: proj.vel.x * 0.5, y: proj.vel.y * 0.5 };
               playSound.enemyHit();
               if (proj.applyBurn) ent.status.burnTimer = 180;
               if (proj.applyPoison) ent.status.poisonTimer = 300;
               if (proj.applyFreeze) ent.status.freezeTimer = 120;
               if (proj.ricochet) {
                  const angle = Math.random() * Math.PI * 2;
                  proj.vel.x = Math.cos(angle) * 4; proj.vel.y = Math.sin(angle) * 4;
                  proj.life = 20; proj.ricochet = false;
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

    const survivors: Entity[] = [];
    const newLoot: Entity[] = [];
    
    for (const ent of entitiesRef.current) {
      if (ent.hp <= 0) {
         if (ent.type < EntityType.LOOT_XP && ent.type !== EntityType.PET_DOG && ent.type !== EntityType.PET_BIRD) {
            if (ent.type === EntityType.OBSTACLE_BARREL) {
               visualEffectsRef.current.push({ id: Math.random(), type: 'EXPLOSION', pos: ent.pos, life: 10, maxLife: 10, color: '#f97316', size: 40 });
               playSound.hit(); addShake(10); triggerHitStop(5);
               entitiesRef.current.forEach(nearby => { if (nearby.id !== ent.id && getDistance(ent.pos, nearby.pos) < 60) nearby.hp -= 50; });
               spawnDebris(ent.pos, '#1c1917', 'CRATER');
            } else if (ent.type === EntityType.OBSTACLE_ROCK) {
               spawnParticle(ent.pos, '#57534e', 8, 2); continue; 
            } else {
               spawnParticle(ent.pos, ent.color, 8, 2);
               spawnDebris(ent.pos, '#7f1d1d', 'BLOOD');
               if (ent.isElite) {
                  newLoot.push({
                      id: Math.random(), type: EntityType.LOOT_CHEST, pos: ent.pos, vel: {x:0,y:0}, radius: 8, hp:1, maxHp:1, color:'#facc15', damage:0, speed:0, isDead:false,
                      status: {burnTimer:0,poisonTimer:0,freezeTimer:0,stunTimer:0}
                  });
               }
                newLoot.push({
                   id: Math.random(), type: EntityType.LOOT_XP, pos: { x: ent.pos.x + (Math.random()-0.5)*10, y: ent.pos.y + (Math.random()-0.5)*10 },
                   vel: { x: 0, y: 0 }, radius: 3, hp: 1, maxHp: 1, color: '#fbbf24', damage: 0, speed: 0, isDead: false,
                   xpValue: ent.xpValue, status: {burnTimer:0, poisonTimer:0, freezeTimer:0, stunTimer:0}
                });
                if (Math.random() > 0.95) {
                   newLoot.push({
                     id: Math.random(), type: EntityType.LOOT_HP, pos: { x: ent.pos.x + 5, y: ent.pos.y },
                     vel: { x: 0, y: 0 }, radius: 4, hp: 1, maxHp: 1, color: '#10b981', damage: 0, speed: 0, isDead: false,
                     status: {burnTimer:0, poisonTimer:0, freezeTimer:0, stunTimer:0}
                   });
                }
                if (ent.type === EntityType.ENEMY_BOSS) {
                   gameStateRef.current.isVictory = true; gameStateRef.current.isPlaying = false;
                   onGameOverRef.current(gameStateRef.current.score, true); playSound.levelUp(); 
                }
            }
         }
      } else { survivors.push(ent); }
    }
    entitiesRef.current = [...survivors, ...newLoot];
    
    // Cleanup Arrays In-Place
    projectilesRef.current = projectilesRef.current.filter(p => p.life > 0);
    
    particlesRef.current = particlesRef.current.filter(p => {
       p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--; return p.life > 0;
    });
    
    textsRef.current = textsRef.current.filter(t => {
       t.pos.y += t.vel.y; t.life--; return t.life > 0;
    });

    visualEffectsRef.current = visualEffectsRef.current.filter(e => {
        e.life--; return e.life > 0;
    });

    if (gameStateRef.current.xp >= gameStateRef.current.xpToNextLevel) {
      gameStateRef.current.xp -= gameStateRef.current.xpToNextLevel;
      gameStateRef.current.level++;
      gameStateRef.current.xpToNextLevel = Math.floor(gameStateRef.current.xpToNextLevel * 1.5);
      
      // Filter upgrades by heroReq
      const possibleUpgrades = UPGRADES.filter(u => !u.heroReq || u.heroReq === selectedHero);
      const shuffled = [...possibleUpgrades].sort(() => 0.5 - Math.random());
      
      playSound.levelUp();
      onLevelUpRef.current(shuffled.slice(0, 3)); 
      gameStateRef.current.isPaused = true;
    }

    if (player.hp <= 0 && !gameStateRef.current.isGameOver) {
      gameStateRef.current.isGameOver = true;
      gameStateRef.current.isPlaying = false;
      playSound.gameOver();
      onGameOverRef.current(gameStateRef.current.score, false); 
    }

    setStatsRef.current({ ...gameStateRef.current, playerHp: player.hp, playerMaxHp: stats.maxHp });

    // -- Draw Frame --
    ctx.fillStyle = '#a8a29e'; 
    ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * shakeRef.current;
    const shakeY = (Math.random() - 0.5) * shakeRef.current;
    ctx.translate(shakeX, shakeY);
    
    const gridSize = 32;
    const startX = Math.floor(cameraRef.current.x / gridSize) * gridSize;
    const startY = Math.floor(cameraRef.current.y / gridSize) * gridSize;
    for (let x = startX; x < startX + RENDER_WIDTH + gridSize; x += gridSize) {
      for (let y = startY; y < startY + RENDER_HEIGHT + gridSize; y += gridSize) {
        const isDark = ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0);
        ctx.fillStyle = isDark ? '#78716c' : '#a8a29e'; 
        ctx.fillRect(x - cameraRef.current.x, y - cameraRef.current.y, gridSize, gridSize);
      }
    }

    ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

    debrisRef.current.forEach(d => {
       ctx.fillStyle = d.color;
       if (d.type === 'CRATER') { ctx.beginPath(); ctx.arc(d.pos.x, d.pos.y, d.size * 2, 0, Math.PI*2); ctx.fill(); }
       else { ctx.fillRect(d.pos.x, d.pos.y, d.size, d.size); }
    });

    entitiesRef.current.forEach(ent => {
      // Draw Obstacles explicitly
      if (ent.type === EntityType.OBSTACLE_ROCK) {
         ctx.shadowColor = 'rgba(0,0,0,0.5)';
         ctx.shadowBlur = 10;
         ctx.fillStyle = '#44403c'; 
         ctx.beginPath(); ctx.arc(ent.pos.x, ent.pos.y, ent.radius, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#57534e';
         ctx.beginPath(); ctx.arc(ent.pos.x - 3, ent.pos.y - 3, ent.radius/2, 0, Math.PI*2); ctx.fill();
         ctx.shadowBlur = 0;
      } else if (ent.type === EntityType.OBSTACLE_BARREL) {
         ctx.shadowColor = 'rgba(0,0,0,0.5)';
         ctx.shadowBlur = 5;
         ctx.fillStyle = '#7c2d12'; 
         ctx.fillRect(ent.pos.x-8, ent.pos.y-10, 16, 20); 
         ctx.fillStyle = '#fdba74'; 
         ctx.fillRect(ent.pos.x-8, ent.pos.y-4, 16, 4); 
         ctx.shadowBlur = 0;
      } else if (ent.type >= EntityType.LOOT_XP) {
        ctx.fillStyle = ent.color;
        if (ent.type === EntityType.ITEM_SCROLL_NUKE) { ctx.fillRect(ent.pos.x - 4, ent.pos.y - 6, 8, 12); }
        else if (ent.type === EntityType.ITEM_BOOTS_SPEED) { ctx.beginPath(); ctx.moveTo(ent.pos.x, ent.pos.y-4); ctx.lineTo(ent.pos.x+4, ent.pos.y+4); ctx.lineTo(ent.pos.x-4, ent.pos.y+4); ctx.fill(); }
        else if (ent.type === EntityType.LOOT_CHEST) { ctx.fillStyle = '#854d0e'; ctx.fillRect(ent.pos.x-6, ent.pos.y-4, 12, 8); ctx.fillStyle = '#facc15'; ctx.fillRect(ent.pos.x-2, ent.pos.y-4, 4, 8); }
        else if (ent.type === EntityType.ITEM_POTION_RED || ent.type === EntityType.ITEM_POTION_BLUE) { ctx.beginPath(); ctx.arc(ent.pos.x, ent.pos.y + 2, 4, 0, Math.PI*2); ctx.fill(); ctx.fillRect(ent.pos.x-2, ent.pos.y-6, 4, 4); }
        else { ctx.beginPath(); ctx.moveTo(ent.pos.x, ent.pos.y - 3); ctx.lineTo(ent.pos.x + 3, ent.pos.y); ctx.lineTo(ent.pos.x, ent.pos.y + 3); ctx.lineTo(ent.pos.x - 3, ent.pos.y); ctx.fill(); }
      } 
    });

    entitiesRef.current.forEach(ent => {
       if (ent.type < EntityType.LOOT_XP && ent.type !== EntityType.OBSTACLE_ROCK && ent.type !== EntityType.OBSTACLE_BARREL) drawEntity(ctx, ent);
    });

    const mouseWorldX = inputRef.current.mouseX + cameraRef.current.x;
    const mouseWorldY = inputRef.current.mouseY + cameraRef.current.y;
    
    let facingRight = true;
    if (inputRef.current.isMobileInput) {
       if (Math.abs(inputRef.current.moveX) > 0.1) { facingRight = inputRef.current.moveX > 0; }
    } else { facingRight = mouseWorldX > player.pos.x; }

    drawPlayer(ctx, player, { x: mouseWorldX, y: mouseWorldY }, facingRight);

    visualEffectsRef.current.forEach(effect => {
        if (effect.type === 'SLASH' && effect.angle !== undefined && effect.range !== undefined) {
            ctx.save(); ctx.translate(effect.pos.x, effect.pos.y); ctx.rotate(effect.angle);
            ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
            ctx.fillStyle = effect.color; ctx.shadowColor = effect.color; ctx.shadowBlur = 10;
            // Arc logic for 360
            const arc = effect.arc || (Math.PI / 2);
            ctx.beginPath(); 
            ctx.arc(0, 0, effect.range, -arc/2, arc/2); 
            ctx.arc(0, 0, effect.range * 0.8, arc/2, -arc/2, true); 
            ctx.fill();
            ctx.restore();
        } else if (effect.type === 'LIGHTNING' && effect.targetPos) {
            ctx.save(); ctx.strokeStyle = effect.color; ctx.lineWidth = effect.width || 2; ctx.shadowColor = effect.color; ctx.shadowBlur = 5;
            ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
            ctx.beginPath(); ctx.moveTo(effect.pos.x, effect.pos.y);
            const midX = (effect.pos.x + effect.targetPos.x) / 2 + (Math.random()-0.5)*10;
            const midY = (effect.pos.y + effect.targetPos.y) / 2 + (Math.random()-0.5)*10;
            ctx.lineTo(midX, midY); ctx.lineTo(effect.targetPos.x, effect.targetPos.y); ctx.stroke();
            ctx.restore();
        } else if (effect.type === 'IMPACT') {
            ctx.fillStyle = effect.color; ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
            ctx.beginPath(); ctx.arc(effect.pos.x, effect.pos.y, (effect.maxLife - effect.life) * 2, 0, Math.PI*2); ctx.fill();
        } else if (effect.type === 'NUKE' || effect.type === 'EXPLOSION') {
            ctx.fillStyle = effect.color; ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
             if (effect.type === 'NUKE') ctx.fillRect(0,0,RENDER_WIDTH,RENDER_HEIGHT);
             else { ctx.beginPath(); ctx.arc(effect.pos.x, effect.pos.y, effect.size || 20, 0, Math.PI*2); ctx.fill(); }
        }
    });

    projectilesRef.current.forEach(proj => {
      ctx.save(); ctx.fillStyle = proj.color; ctx.shadowColor = proj.color; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(proj.pos.x, proj.pos.y, proj.radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'lighter';
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    textsRef.current.forEach(t => {
      ctx.fillStyle = 'black'; ctx.fillText(t.text, t.pos.x + 1, t.pos.y + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.pos.x, t.pos.y);
    });
    
    // CRITICAL FIX: Restore context BEFORE drawing fixed UI elements like the Wave notification
    ctx.restore();

    if (gameStateRef.current.time % WAVE_DURATION < 180) { 
       ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.font = '14px "Press Start 2P"';
       ctx.strokeText(`WAVE ${gameStateRef.current.wave}`, RENDER_WIDTH/2, 40);
       ctx.fillText(`WAVE ${gameStateRef.current.wave}`, RENDER_WIDTH/2, 40);
    }

    frameIdRef.current = requestAnimationFrame(loop);
  }, [selectedHero]);

  // --- Effects ---

  useEffect(() => {
    if (gameActive) {
      const hero = HEROES[selectedHero];
      
      playerRef.current = {
        id: 0,
        type: EntityType.PLAYER,
        pos: { x: RENDER_WIDTH / 2, y: RENDER_HEIGHT / 2 },
        vel: { x: 0, y: 0 },
        radius: 6,
        hp: hero.stats.maxHp,
        maxHp: hero.stats.maxHp,
        color: hero.color,
        damage: hero.stats.damage,
        speed: hero.stats.moveSpeed,
        isDead: false,
        attackCooldown: 0,
        status: { burnTimer: 0, poisonTimer: 0, freezeTimer: 0, stunTimer: 0 }
      };

      playerStatsRef.current = { ...hero.stats, evolutionLevel: 0 };
      
      gameStateRef.current = {
        isPlaying: true,
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
        hitStop: 0,
      };

      entitiesRef.current = [];
      particlesRef.current = [];
      debrisRef.current = [];
      projectilesRef.current = [];
      textsRef.current = [];
      visualEffectsRef.current = [];
      cameraRef.current = { x: 0, y: 0 };
      bossSpawnedRef.current = false;
      inputRef.current = {
        up: false, down: false, left: false, right: false,
        moveX: 0, moveY: 0,
        attack: false, special: false,
        mouseX: 0, mouseY: 0,
        isMobileInput: false
      };
      
      initMap();
      
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      loop();
    } else {
       gameStateRef.current.isPlaying = false;
       if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    }
  }, [gameActive, selectedHero, loop]);

  useEffect(() => {
    if (selectedUpgrade) {
       // Apply stats
       const newStats = selectedUpgrade.apply(playerStatsRef.current);
       // Reset Shield if upgraded
       if (newStats.shieldMax > playerStatsRef.current.shieldMax) {
           newStats.shieldCurrent = newStats.shieldMax;
       }
       playerStatsRef.current = newStats;
       resetUpgrade();
       gameStateRef.current.isPaused = false;
    }
  }, [selectedUpgrade, resetUpgrade]);

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
    const handleMouseDown = () => { inputRef.current.attack = true; };
    const handleMouseUp = () => { inputRef.current.attack = false; };
    
    const handleMouseMove = (e: MouseEvent) => {
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = RENDER_WIDTH / rect.width;
            const scaleY = RENDER_HEIGHT / rect.height;
            inputRef.current.mouseX = (e.clientX - rect.left) * scaleX;
            inputRef.current.mouseY = (e.clientY - rect.top) * scaleY;
            inputRef.current.isMobileInput = false;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={RENDER_WIDTH}
        height={RENDER_HEIGHT}
        className="w-full h-full object-contain image-pixelated bg-[#a8a29e]"
      />
      
      {/* Mobile Controls */}
       <div className="absolute bottom-16 left-16 md:hidden z-20">
          <Joystick 
            onMove={(x, y) => {
               inputRef.current.moveX = x; 
               inputRef.current.moveY = y;
               inputRef.current.isMobileInput = true;
            }} 
            onStart={() => {}}
            onEnd={() => {
               inputRef.current.moveX = 0; 
               inputRef.current.moveY = 0;
            }}
          />
       </div>
       <button 
          className="absolute bottom-12 right-12 w-20 h-20 bg-red-600/50 rounded-full border-4 border-red-400 md:hidden active:bg-red-600/80 flex items-center justify-center z-20"
          onTouchStart={(e) => { e.preventDefault(); inputRef.current.attack = true; inputRef.current.isMobileInput = true; }}
          onTouchEnd={(e) => { e.preventDefault(); inputRef.current.attack = false; }}
       >
          <span className="text-white font-bold text-sm">ATK</span>
       </button>
       <button 
          className="absolute bottom-36 right-8 w-14 h-14 bg-blue-600/50 rounded-full border-4 border-blue-400 md:hidden active:bg-blue-600/80 flex items-center justify-center z-20"
          onTouchStart={(e) => { e.preventDefault(); inputRef.current.special = true; }}
          onTouchEnd={(e) => { e.preventDefault(); inputRef.current.special = false; }}
       >
          <span className="text-white text-[10px] font-bold">SPC</span>
       </button>
    </div>
  );
};
