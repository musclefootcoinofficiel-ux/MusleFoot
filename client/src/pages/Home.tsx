import { GameHeader } from "@/components/game-header";
import { ClickStage } from "@/components/click-stage";
import { ShopCard } from "@/components/shop-card";
import { useGameEngine } from "@/hooks/use-game-engine";
import { Loader2, BicepsFlexed, Zap, BriefcaseMedical } from "lucide-react";
import backgroundLogo from "@assets/musclefoot-logo.png_1770383943031.png";

export default function Home() {
  const { gameState, isLoaded, click, purchaseUpgrade } = useGameEngine();

  if (!isLoaded) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Shop item configs
  const SHOP_ITEMS = [
    {
      id: 'protein' as const,
      title: "Protéines Whey",
      desc: "More strength! (+1 PM / Click)",
      baseCost: 50,
      icon: BicepsFlexed,
      currentLevel: gameState.clickPower,
    },
    {
      id: 'coach' as const,
      title: "Coach Personnel",
      desc: "Trains for you! (+1 PM / Sec)",
      baseCost: 200,
      icon: Zap,
      currentLevel: gameState.autoClickerLevel,
    },
    {
      id: 'equip' as const,
      title: "Équipement Pro",
      desc: "Train longer! (+20 Max Energy)",
      baseCost: 150,
      icon: BriefcaseMedical,
      currentLevel: Math.floor((gameState.maxEndurance - 100) / 20),
    }
  ];

  // Helper to calculate progressive costs
  const getCost = (base: number, level: number) => Math.floor(base * Math.pow(1.5, level));

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden font-body relative selection:bg-primary selection:text-black">
      
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none grayscale contrast-125"
        style={{ backgroundImage: `url(${backgroundLogo})` }}
      />
      
      {/* Gradient Overlay for Readability */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/90 via-background/80 to-background pointer-events-none" />

      {/* Grid Texture Overlay */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none bg-[size:50px_50px] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]" />

      {/* Main Content Scrollable Area */}
      <main className="relative z-10 min-h-screen flex flex-col">
        
        <GameHeader 
          points={gameState.musclePoints} 
          rank={gameState.rank} 
        />

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-4 gap-8 lg:flex-row lg:gap-16">
          
          {/* Left Side: Clicker (Center Stage) */}
          <div className="w-full lg:w-1/2 flex justify-center order-1 lg:order-1">
            <ClickStage 
              onTap={click}
              endurance={gameState.currentEndurance}
              maxEndurance={gameState.maxEndurance}
            />
          </div>

          {/* Right Side: Shop (Desktop) / Bottom (Mobile) */}
          <div className="w-full lg:w-1/2 order-2 lg:order-2 pb-10">
            <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h2 className="text-2xl font-display uppercase tracking-widest text-white">
                  Gym Store <span className="text-primary">.</span>
                </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {SHOP_ITEMS.map((item) => {
                  const cost = getCost(item.baseCost, item.id === 'equip' ? item.currentLevel : item.currentLevel > 0 ? item.currentLevel - (item.id === 'protein' ? 1 : 0) : 0);
                  const canAfford = gameState.musclePoints >= cost;

                  return (
                    <ShopCard
                      key={item.id}
                      title={item.title}
                      description={item.desc}
                      cost={cost}
                      icon={item.icon}
                      canAfford={canAfford}
                      onBuy={() => purchaseUpgrade(item.id, cost)}
                      level={item.currentLevel}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
