# MUSCLEFOOT - Fitness-Themed Idle Clicker Game

## Overview

MUSCLEFOOT is a fitness-themed tap-to-earn game with Solana blockchain integration, built as a Telegram Web App (TWA) and Single Page Application (SPA). Players tap to earn $MF tokens, rank up through a 6-level progression system, and track progress toward airdrop withdrawal milestones. The app uses a neon cyberpunk aesthetic with cyan (#00f2ff) and gold (#d4ff00) colors.

### Telegram Web App Integration
- SDK loaded via `https://telegram.org/js/telegram-web-app.js` in index.html
- `initTelegramApp()` calls `ready()` and `expand()` on startup for full-screen experience
- Telegram user ID is the primary session identifier (replaces random UUID)
- If no Telegram user ID detected, game runs in "Guest Mode" (no save, banner shown)
- Haptic feedback on taps (`impactOccurred`), success/error notifications
- Helper module: `client/src/lib/telegram.ts`

### Supabase Integration
- Client-side database using `@supabase/supabase-js`
- Graceful fallback: if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing, Supabase client is null (Guest Mode, no errors)
- Config via `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`
- `game_saves` table keyed by `telegram_id` (integer primary key)
- `high_score` column: only updated when new score exceeds previous
- Offline queue: failed saves stored in localStorage and retried on reconnection
- `withdrawals` table tracks withdrawal requests per telegram_id
- Helper module: `client/src/lib/supabase.ts`

### Vercel Deployment
- Static frontend build via `bash build-vercel.sh`, output to `vercel-deploy/`
- No backend required — all API calls use Supabase client or direct Solana RPC
- `vercel.json` with SPA rewrite rules (`"source": "/(.*)"` → `/index.html`)
- Environment variables needed in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

The game has 5 main sections accessible via bottom navigation:
- **INFO** - Tokenomics display and social links (Twitter, Telegram, Buy $MUSCLEFOOT)
- **ROADMAP** - 4-phase roadmap timeline
- **PLAY** - Main tap game with energy system, rank display, countdown timer, and rank-up button
- **BOOST** - 6-level rank system display with upgrade buttons and stats per level
- **WALLET** - Hybrid wallet system (Phantom or instant-generated Solana wallet), rank-based withdrawal system, balance display

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Architecture

### Frontend
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **Navigation**: 5-tab system (INFO | ROADMAP | PLAY | BOOST | WALLET)
- **State Management**: Local React state + localStorage for persistence, with TanStack React Query for server sync
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode only)
- **Primary Colors**: Cyan (#00f2ff), Gold/Lime (#d4ff00), Deep Black (#050505)
- **Animations**: Framer Motion for tap effects, floating text, shake animations, and tab transitions
- **Icons**: Lucide React
- **Fonts**: Orbitron (display) and Rajdhani (body) from Google Fonts
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Game Engine
- All game state managed inline in the Game component (points, level, energy, wallet)
- Primary state lives in localStorage for instant responsiveness
- Periodic auto-save syncs to the server database every 30 seconds
- On startup, loads from DB and reconciles with localStorage (takes higher progress)
- Energy system: depletes per tap (cost varies by level), recovers over time based on level config
- Background recovery: calculated from elapsed time since lastTapTimestamp, works across refreshes
- 6-level rank system: Beginner (Lvl 0) -> Gym Rat (1) -> Influencer (2) -> Pro (3) -> Legend (4) -> Muscle God (5)
- Upgrade costs: 1K, 10K, 50K, 200K $MF; Muscle God requires 10 SOL payment via Solana blockchain
- Screen shake effect for Level 4+ taps, golden energy bar for Muscle God
- **Solana Payment Integration**: Uses @solana/wallet-adapter for real Phantom wallet connection
  - Muscle God upgrade: 10 SOL payment -> direct on-chain verification via RPC polling -> level 5 unlock
  - Energy Refill: 0.01 SOL payment -> instant max energy refill
  - Receiver wallet: GnNkrN2oDNre6tR6i2Z71vgMbvE8tfVeWu5VtUN4ocUX
  - Verification: Direct Solana RPC polling (getSignatureStatuses, 30 attempts, 2s intervals)

### Tokenomics
- **Total Supply**: 1,000,000,000 $MF
- **Liquidity Pool**: 55% (Fair Launch, LP Burned)
- **Community Airdrop**: 25% (Dedicated athletes & early adopters)
- **Ecosystem & Growth**: 15% (Game features & staking)
- **Marketing & Team**: 5% (Global reach & development)

### Withdrawal System
- Rank-based withdrawal with minimum limits, fees (burned from supply), and processing delays
- **Beginner**: Min 1,000 $MF, 10% fee, 72h delay
- **Gym Rat**: Min 1,000 $MF, 5% fee, 48h delay
- **Influencer**: Min 5,000 $MF, 3% fee, 24h delay
- **Pro / Legend**: Min 15,000 $MF, 2% fee, 12h delay
- **GOD (Muscle God)**: Min 15,000 $MF, 1% fee, Instant processing
- All fees permanently burned from total supply
- Database table: `withdrawals` tracks all withdrawal requests with status, amounts, fees

### Backend
- **No backend server** — all persistence is client-side via Supabase and direct Solana RPC
- Development uses Vite dev server with HMR (Express still serves for dev tooling only)
- Production is a static site deployed to Netlify

### Data Storage
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js` client
- **Tables**:
  - `game_saves`: keyed by `telegram_id` (integer PK), stores muscle_points, level, current_energy, last_tap_timestamp, wallet_address, god_pack_expiry, high_score, username
  - `withdrawals`: tracks withdrawal requests with telegram_id, amount, fee, status, delay
- **Offline Queue**: Failed saves queued in localStorage, flushed on reconnect (online event) and on successful saves

### Build System
- **Dev**: `tsx server/index.ts` runs the TypeScript server directly
- **Build**: Custom `script/build.ts` that runs Vite build for client and esbuild for server
- **Server bundle**: esbuild bundles server code to `dist/index.cjs`, with select dependencies bundled (allowlist) and others externalized
- **Client bundle**: Vite outputs to `dist/public/`

### Session Management
- Telegram user ID is the primary session identifier (replaces anonymous UUID)
- Security gate blocks game access for non-Telegram users (anti-bot protection)
- Game progress persists both locally (localStorage) and remotely (Supabase PostgreSQL)

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required, connected via `DATABASE_URL` environment variable. The database must be provisioned before the app can start.

### Key NPM Packages
- `express` v5 - HTTP server
- `drizzle-orm` + `drizzle-kit` - Database ORM and migration tooling
- `pg` - PostgreSQL client (node-postgres)
- `connect-pg-simple` - PostgreSQL session store (available but sessions are currently UUID-based)
- `zod` + `drizzle-zod` - Runtime validation
- `@tanstack/react-query` - Server state management
- `framer-motion` - Animations
- `wouter` - Client-side routing
- `nanoid` - Unique ID generation
- Full shadcn/ui component library with Radix UI primitives

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal` - Error overlay in development
- `@replit/vite-plugin-cartographer` - Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` - Dev banner (dev only)