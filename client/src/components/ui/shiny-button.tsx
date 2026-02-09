import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ className, children, variant = "primary", size = "md", disabled, ...props }, ref) => {
    
    const variants = {
      primary: "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(204,255,0,0.4)] hover:shadow-[0_0_25px_rgba(204,255,0,0.6)] border-primary",
      secondary: "bg-secondary text-secondary-foreground shadow-[0_0_15px_rgba(255,85,0,0.4)] hover:shadow-[0_0_25px_rgba(255,85,0,0.6)] border-secondary",
      danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive",
      ghost: "bg-transparent hover:bg-white/5 text-white border-white/20",
    };

    const sizes = {
      sm: "h-9 px-4 text-xs",
      md: "h-12 px-6 text-sm",
      lg: "h-16 px-10 text-lg",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
        whileTap={{ scale: disabled ? 1 : 0.96 }}
        className={cn(
          "relative overflow-hidden rounded-sm font-bold uppercase tracking-wider border transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
        
        {/* Shine effect */}
        {!disabled && (
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
        )}
      </motion.button>
    )
  }
)
ShinyButton.displayName = "ShinyButton"

export { ShinyButton }
