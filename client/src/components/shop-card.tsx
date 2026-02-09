import { motion } from "framer-motion";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ShopCardProps {
  title: string;
  description: string;
  cost: number;
  icon: LucideIcon;
  canAfford: boolean;
  onBuy: () => void;
  level?: number;
}

export function ShopCard({ 
  title, 
  description, 
  cost, 
  icon: Icon, 
  canAfford, 
  onBuy,
  level 
}: ShopCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={cn(
        "relative flex flex-col p-5 rounded-xl border transition-all duration-300 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden group",
        canAfford ? "border-white/10 hover:border-primary/50" : "border-white/5 opacity-80"
      )}
    >
      {/* Decorative background glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 rounded-lg bg-black/40 border border-white/10">
          <Icon className={cn("w-6 h-6", canAfford ? "text-primary" : "text-muted-foreground")} />
        </div>
        {level !== undefined && (
          <Badge variant="outline" className="font-mono text-xs border-white/10 bg-black/40">
            LVL {level}
          </Badge>
        )}
      </div>

      <div className="mb-4 flex-1 relative z-10">
        <h3 className="text-lg font-bold font-display tracking-wide uppercase">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-snug">{description}</p>
      </div>

      <ShinyButton 
        onClick={onBuy} 
        disabled={!canAfford} 
        variant={canAfford ? "primary" : "ghost"} 
        size="sm"
        className="w-full relative z-10"
      >
        {canAfford ? "UPGRADE" : "LOCKED"} 
        <span className="ml-2 opacity-80 font-mono">({cost} PM)</span>
      </ShinyButton>
    </motion.div>
  );
}
