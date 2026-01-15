import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { Upgrade, GameState, HeroType } from './types';
import { initAudio } from './utils/sound';
import { HEROES } from './constants';

const App: React.FC = () => {
  const [gameActive, setGameActive] = useState(false);
  const [selectedHero, setSelectedHero] = useState<HeroType>(HeroType.KNIGHT);
  
  const [upgradeOptions, setUpgradeOptions] = useState<Upgrade[]>([]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);
  const [endGameResult, setEndGameResult] = useState<{ score: number, win: boolean } | null>(null);
  const [stats, setStats] = useState<GameState & { playerHp: number, playerMaxHp: number }>({
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
    playerHp: 100,
    playerMaxHp: 100
  });

  const handleStart = useCallback((hero: HeroType) => {
    initAudio();
    setSelectedHero(hero);
    setGameActive(true);
    setEndGameResult(null);
    setUpgradeOptions([]);
    setSelectedUpgrade(null);
  }, []);

  const handleGameOver = useCallback((score: number, win: boolean) => {
    setEndGameResult({ score, win });
    setGameActive(false);
  }, []);

  const handleLevelUp = useCallback((options: Upgrade[]) => {
    setUpgradeOptions(options);
  }, []);

  const handleSelectUpgrade = useCallback((upgrade: Upgrade) => {
    setSelectedUpgrade(upgrade);
    setUpgradeOptions([]);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#111] overflow-hidden flex items-center justify-center select-none">
      <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video shadow-2xl bg-black">
        <GameCanvas 
          gameActive={gameActive}
          selectedHero={selectedHero}
          onGameOver={handleGameOver}
          onLevelUp={handleLevelUp}
          selectedUpgrade={selectedUpgrade}
          resetUpgrade={() => setSelectedUpgrade(null)}
          setStats={setStats}
        />
        <UIOverlay 
          stats={stats}
          gameActive={gameActive}
          onStart={handleStart}
          upgradeOptions={upgradeOptions}
          onSelectUpgrade={handleSelectUpgrade}
          endGameResult={endGameResult}
        />
      </div>
    </div>
  );
};

export default App;
