import { Trophy, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface GameHeaderProps {
  points: number;
  rank: string;
}

export function GameHeader({ points, rank }: GameHeaderProps) {
  return (
    <header className="w-full max-w-4xl mx-auto p-4 flex flex-col md:flex-row items-center justify-between gap-6 z-10 relative">
      <div className="flex flex-col items-center md:items-start">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 italic drop-shadow-lg">
          MUSCLE<span className="text-primary text-glow">FOOT</span>
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground mt-1">
          <TrendingUp className="w-4 h-4 text-secondary" />
          <span className="text-sm font-mono tracking-widest uppercase">Clicker Gym Sim</span>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl">
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Current Rank</p>
          <p className="text-lg font-bold text-secondary text-glow-orange">{rank}</p>
        </div>
        <div className="h-10 w-[1px] bg-white/10" />
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Muscle Points</p>
          <motion.p 
            key={points}
            initial={{ scale: 1.2, color: "#fff" }}
            animate={{ scale: 1, color: "var(--primary)" }}
            className="text-2xl md:text-3xl font-mono font-bold text-primary text-glow tabular-nums"
          >
            {points.toLocaleString()} <span className="text-sm">PM</span>
          </motion.p>
        </div>
        <Trophy className="w-8 h-8 text-yellow-500 drop-shadow-md" />
      </div>
    </header>
  );
}
