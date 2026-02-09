import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, Dumbbell } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ClickStageProps {
  onTap: () => boolean;
  endurance: number;
  maxEndurance: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: string;
}

export function ClickStage({ onTap, endurance, maxEndurance }: ClickStageProps) {
  const [clicks, setClicks] = useState<FloatingText[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);
  
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch behaviors (zooming, scrolling)
    // e.preventDefault(); 
    
    const success = onTap();
    if (!success) {
      // Logic for "not enough energy" shake or error feedback could go here
      return;
    }

    // Calculate position for floating text
    const rect = buttonRef.current?.getBoundingClientRect();
    const x = 'clientX' in e 
      ? (e as React.MouseEvent).clientX 
      : (e as React.TouchEvent).touches[0].clientX;
    const y = 'clientY' in e 
      ? (e as React.MouseEvent).clientY 
      : (e as React.TouchEvent).touches[0].clientY;

    // Add visual feedback
    const newClick = {
      id: Date.now(),
      x: x - (rect?.left || 0), // Relative to container could be better, but viewport is fine for fixed overlay
      y: y - (rect?.top || 0),
      value: "+1 PM"
    };
    
    setClicks(prev => [...prev, newClick]);
    
    // Cleanup old clicks
    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== newClick.id));
    }, 1000);
  };

  const endurancePercent = (endurance / maxEndurance) * 100;
  
  return (
    <div className="flex flex-col items-center justify-center py-10 relative z-10">
      
      {/* Click Area */}
      <motion.div
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9, rotate: [0, -5, 5, 0] }}
        className="relative cursor-pointer group select-none touch-manipulation"
        onClick={handleTap}
      >
        {/* Glow behind the button */}
        <div className="absolute inset-0 bg-secondary/20 blur-[60px] rounded-full group-hover:bg-secondary/40 transition-all duration-500" />
        
        {/* The Button Circle */}
        <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-zinc-800 to-black border-4 border-zinc-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center relative overflow-hidden group-active:border-primary transition-colors duration-100">
          
          {/* Inner ring */}
          <div className="absolute inset-2 rounded-full border border-white/5" />
          
          {/* Icon */}
          <Dumbbell 
            className="w-24 h-24 md:w-32 md:h-32 text-zinc-500 group-hover:text-white transition-colors duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-active:text-primary group-active:drop-shadow-[0_0_20px_rgba(204,255,0,0.5)]" 
            strokeWidth={1.5}
          />
          
          {/* Particle effect container (for floating text) */}
          <AnimatePresence>
            {clicks.map(click => (
              <motion.div
                key={click.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -100, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute pointer-events-none text-2xl font-black text-primary text-glow font-display z-50"
                style={{ left: "50%", top: "40%", marginLeft: (Math.random() * 60 - 30) + "px" }} 
              >
                {click.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Endurance Bar */}
      <div className="w-full max-w-sm mt-8 space-y-2">
        <div className="flex justify-between text-xs uppercase font-bold tracking-widest text-muted-foreground">
          <span>Endurance</span>
          <span className={endurancePercent < 20 ? "text-destructive animate-pulse" : "text-primary"}>
            {Math.floor(endurance)} / {maxEndurance}
          </span>
        </div>
        <div className="h-4 w-full bg-black/50 rounded-full border border-white/10 overflow-hidden backdrop-blur-sm">
          <motion.div 
            className="h-full bg-gradient-to-r from-secondary to-orange-400 shadow-[0_0_10px_rgba(255,85,0,0.5)]"
            initial={{ width: "100%" }}
            animate={{ width: `${endurancePercent}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
        {endurancePercent < 10 && (
          <p className="text-center text-xs text-destructive font-mono animate-bounce mt-2">
            ⚠️ REST TO RECOVER ENERGY
          </p>
        )}
      </div>
    </div>
  );
}
