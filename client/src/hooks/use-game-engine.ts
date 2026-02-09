import { useState, useEffect, useRef, useCallback } from "react";
import { useSaveGame, useGameSave } from "./use-game-save";

export interface GameState {
  musclePoints: number;
  clickPower: number;
  autoClickerLevel: number;
  maxEndurance: number;
  currentEndurance: number;
  rank: string;
}

const INITIAL_STATE: GameState = {
  musclePoints: 0,
  clickPower: 1,
  autoClickerLevel: 0,
  maxEndurance: 100,
  currentEndurance: 100,
  rank: "Débutant",
};

// Rank thresholds
const RANKS = [
  { threshold: 10000, title: "Légende du Muscle" },
  { threshold: 2500, title: "Athlète" },
  { threshold: 500, title: "Amateur" },
  { threshold: 0, title: "Débutant" },
];

export function useGameEngine() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  
  // Sync with backend on load
  const { data: serverSave, isLoading } = useGameSave();
  const { mutate: saveGame } = useSaveGame();
  
  // Ref for the auto-save interval
  const saveIntervalRef = useRef<NodeJS.Timeout>();
  // Ref for regeneration interval
  const regenIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize state from local storage or server
  useEffect(() => {
    if (isLoading) return;

    const localData = localStorage.getItem('musclefoot-save');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setGameState(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse local save", e);
      }
    } else if (serverSave) {
      setGameState({
        musclePoints: serverSave.musclePoints,
        clickPower: serverSave.clickPower,
        autoClickerLevel: serverSave.autoClickerLevel,
        maxEndurance: serverSave.maxEndurance,
        currentEndurance: serverSave.maxEndurance, // Full endurance on load
        rank: serverSave.rank,
      });
    }
    setLoaded(true);
  }, [serverSave, isLoading]);

  // Persist to local storage whenever state changes
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('musclefoot-save', JSON.stringify(gameState));
  }, [gameState, loaded]);

  // Auto-save to server every 30 seconds
  useEffect(() => {
    if (!loaded) return;
    saveIntervalRef.current = setInterval(() => {
      saveGame({
        musclePoints: gameState.musclePoints,
        clickPower: gameState.clickPower,
        autoClickerLevel: gameState.autoClickerLevel,
        maxEndurance: gameState.maxEndurance,
        rank: gameState.rank,
      });
    }, 30000);
    return () => clearInterval(saveIntervalRef.current);
  }, [gameState, saveGame, loaded]);

  // Game Loop: Regeneration & Auto Clicker
  useEffect(() => {
    if (!loaded) return;
    
    regenIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        // Regen endurance
        const newEndurance = Math.min(prev.maxEndurance, prev.currentEndurance + 5);
        
        // Auto clicker gains
        const autoGains = prev.autoClickerLevel; 
        
        // Calculate new rank
        const newTotal = prev.musclePoints + autoGains;
        const newRank = RANKS.find(r => newTotal >= r.threshold)?.title || "Débutant";

        return {
          ...prev,
          currentEndurance: newEndurance,
          musclePoints: newTotal,
          rank: newRank
        };
      });
    }, 1000); // Every second

    return () => clearInterval(regenIntervalRef.current);
  }, [loaded]);

  const click = useCallback(() => {
    setGameState(prev => {
      if (prev.currentEndurance < 10) return prev; // Not enough energy

      const newPoints = prev.musclePoints + prev.clickPower;
      const newRank = RANKS.find(r => newPoints >= r.threshold)?.title || "Débutant";

      return {
        ...prev,
        musclePoints: newPoints,
        currentEndurance: prev.currentEndurance - 10,
        rank: newRank
      };
    });
    return true; // Click successful
  }, []);

  const purchaseUpgrade = useCallback((type: 'protein' | 'coach' | 'equip', cost: number) => {
    setGameState(prev => {
      if (prev.musclePoints < cost) return prev;

      const newState = { ...prev, musclePoints: prev.musclePoints - cost };

      if (type === 'protein') newState.clickPower += 1;
      if (type === 'coach') newState.autoClickerLevel += 1;
      if (type === 'equip') {
        newState.maxEndurance += 20;
        newState.currentEndurance += 20; // Heal nicely on upgrade
      }
      return newState;
    });
  }, []);

  return {
    gameState,
    isLoaded: loaded,
    click,
    purchaseUpgrade
  };
}
