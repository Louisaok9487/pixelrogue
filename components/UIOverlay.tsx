import React, { useState, useRef, useEffect } from 'react';
import { GameState, Upgrade, HeroType } from '../types';
import { HEROES } from '../constants';

interface UIOverlayProps {
  stats: GameState & { playerHp: number, playerMaxHp: number };
  onStart: (hero: HeroType) => void;
  gameActive: boolean;
  upgradeOptions: Upgrade[];
  onSelectUpgrade: (u: Upgrade) => void;
  endGameResult: { score: number, win: boolean } | null;
}

const HeroPreview: React.FC<{ type: HeroType; color: string }> = ({ type, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 200;
      const bob = Math.sin(time) * 1.5;

      ctx.save();
      // Center and scale up
      ctx.translate(canvas.width / 2, canvas.height / 2 + 5); // +5 to move down slightly
      ctx.scale(4, 4); // 4x scale for crisp pixel look
      ctx.imageSmoothingEnabled = false;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 7, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (type === HeroType.KNIGHT) {
        // Knight Body
        ctx.fillStyle = color;
        ctx.fillRect(-4, -6 + bob, 8, 10);
        ctx.fillStyle = '#60a5fa'; // Helmet
        ctx.fillRect(-4, -10 + bob, 8, 4);
        
        // Sword (Held to side)
        ctx.save();
        ctx.translate(6, 0 + bob);
        ctx.rotate(-0.2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, -8, 3, 10);
        ctx.fillStyle = '#475569';
        ctx.fillRect(-1, 0, 5, 2);
        ctx.restore();

      } else if (type === HeroType.MAGE) {
        // Mage Robes
        ctx.fillStyle = color;
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
        
        // Staff
        ctx.save();
        ctx.translate(7, 0 + bob);
        ctx.rotate(-0.1);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, -8, 2, 12);
        ctx.fillStyle = '#f0abfc'; // Gem
        ctx.fillRect(-1, -10, 4, 4);
        ctx.restore();

      } else if (type === HeroType.ROGUE) {
        // Rogue Hood/Cloak
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.arc(0, -5 + bob, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(-3, 0 + bob, 6, 6);
        
        // Dagger
        ctx.save();
        ctx.translate(6, 2 + bob);
        ctx.rotate(0.4);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(2, -6);
        ctx.lineTo(4, 0);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [type, color]);

  return <canvas ref={canvasRef} width={96} height={96} className="mb-2" />;
};

export const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  onStart,
  gameActive,
  upgradeOptions,
  onSelectUpgrade,
  endGameResult
}) => {
  const [selectedHero, setSelectedHero] = useState<HeroType>(HeroType.KNIGHT);

  // Hero Selection Screen
  if (!gameActive && !endGameResult) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-50 overflow-y-auto">
        <h1 className="text-4xl text-red-500 mb-2 pixel-text mt-8">NECROMANCER'S DEMISE</h1>
        <p className="mb-6 text-gray-400 text-xs">SELECT YOUR HERO</p>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
           {(Object.keys(HEROES) as HeroType[]).map((type) => {
              const hero = HEROES[type];
              const isSelected = selectedHero === type;
              return (
                 <button 
                   key={type}
                   onClick={() => setSelectedHero(type)}
                   className={`
                      p-4 w-64 border-2 rounded flex flex-col items-center transition-all relative overflow-hidden
                      ${isSelected ? 'border-white bg-gray-800 scale-105 shadow-lg shadow-white/20' : 'border-gray-700 bg-gray-900 opacity-70'}
                   `}
                 >
                    {/* Hero Preview Canvas */}
                    <HeroPreview type={type} color={hero.color} />
                    
                    <h3 className="text-xl pixel-text mb-2" style={{color: hero.color}}>{hero.name}</h3>
                    <p className="text-xs text-center text-gray-300 mb-2 h-10">{hero.description}</p>
                    
                    <div className="w-full text-xs text-gray-500 mt-2 grid grid-cols-2 gap-1 text-left border-t border-gray-700 pt-2">
                       <span className="text-green-400">HP: {hero.stats.maxHp}</span>
                       <span className="text-blue-400">SPD: {hero.stats.moveSpeed}</span>
                       <span className="text-red-400">DMG: {hero.stats.damage}</span>
                       <span className="text-yellow-400">{hero.stats.weaponType}</span>
                    </div>
                 </button>
              );
           })}
        </div>

        <button 
          onClick={() => onStart(selectedHero)}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded pixel-text border-2 border-red-800 animate-pulse"
        >
          START GAME
        </button>
      </div>
    );
  }

  // End Game Screen
  if (endGameResult) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-50 animate-in fade-in duration-500">
        <h1 className={`text-4xl mb-4 pixel-text ${endGameResult.win ? 'text-green-500' : 'text-red-500'}`}>
          {endGameResult.win ? 'VICTORY!' : 'GAME OVER'}
        </h1>
        <p className="mb-8 text-xl">Score: {endGameResult.score}</p>
        <button 
          onClick={() => onStart(selectedHero)} // Restarts with last selected
          className="px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded pixel-text"
        >
          PLAY AGAIN
        </button>
      </div>
    );
  }

  // Upgrade Selection
  if (upgradeOptions.length > 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-40">
        <h2 className="text-2xl text-yellow-400 mb-8 pixel-text">LEVEL UP!</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-4">
          {upgradeOptions.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelectUpgrade(u)}
              className={`
                flex flex-col items-center p-6 border-4 rounded bg-gray-900 hover:bg-gray-800 transition-colors
                ${u.rarity === 'legendary' ? 'border-orange-500' : u.rarity === 'rare' ? 'border-blue-500' : 'border-gray-500'}
              `}
            >
              <h3 className={`text-lg mb-2 pixel-text ${
                u.rarity === 'legendary' ? 'text-orange-400' : u.rarity === 'rare' ? 'text-blue-400' : 'text-white'
              }`}>
                {u.name}
              </h3>
              <p className="text-gray-300 text-center text-sm">{u.description}</p>
              <span className="mt-4 text-xs uppercase opacity-50">{u.rarity}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // HUD
  const specialPercent = 1 - (stats.specialCooldown / HEROES[selectedHero || HeroType.KNIGHT].stats.specialCooldownMax);
  const specialReady = specialPercent >= 1;

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          {/* Health Bar */}
          <div className="w-48 h-6 bg-gray-900 border-2 border-white relative">
            <div 
              className="h-full bg-red-600 transition-all duration-200"
              style={{ width: `${Math.max(0, (stats.playerHp / stats.playerMaxHp) * 100)}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white drop-shadow-md">
              {Math.ceil(stats.playerHp)} / {stats.playerMaxHp}
            </span>
          </div>
          {/* XP Bar */}
          <div className="w-48 h-2 bg-gray-900 border border-gray-600">
             <div 
              className="h-full bg-blue-500 transition-all duration-200"
              style={{ width: `${Math.min(100, (stats.xp / stats.xpToNextLevel) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-white">LVL {stats.level}</div>
        </div>

        <div className="text-right text-white">
          <div className="text-xl pixel-text text-yellow-400">{stats.score} PTS</div>
          <div className="text-xs text-gray-400">
             TIME: {Math.floor(stats.time / 60)}s
          </div>
        </div>
      </div>

      {/* Bottom Bar (Abilities) */}
      <div className="flex justify-center items-end gap-4 mb-4">
          <div className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 border-2 ${specialReady ? 'border-yellow-400 bg-yellow-900/50' : 'border-gray-600 bg-gray-900'} relative`}>
                  <div 
                     className="absolute bottom-0 left-0 right-0 bg-white/20 transition-all"
                     style={{ height: `${Math.min(100, specialPercent * 100)}%`}}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white">SPACE</span>
              </div>
              <span className="text-[10px] text-gray-400 uppercase">Special</span>
          </div>
      </div>

      {/* Tutorial Hint */}
      {stats.time < 300 && (
         <div className="absolute top-20 left-0 right-0 text-center text-white/50 text-xs animate-pulse">
            WASD to Move • Click to Attack • SPACE for Special
         </div>
      )}
    </div>
  );
};