# ChirpBot V2 - OpenAI Review Package

## Project Overview
ChirpBot V2 is a real-time sports betting alert system that monitors live MLB games to provide Game Situations alerts (RISP, Bases Loaded, Close Games, Late Innings, Extra Innings, Runners on Base) with clean, focused notifications.

## Current Status
- ✅ Using 100% real MLB API data (statsapi.mlb.com)
- ✅ Fixed global alert deduplication (30-second cooldown between same alert types)
- ✅ Enhanced UI to show alert type in titles (e.g., "Runners in Scoring Position • Player Name • Count")
- ✅ Eliminated ESPN API conflicts that caused 404 errors
- ❌ Still has 15 LSP errors across 4 files

## Technology Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket for live updates
- **External APIs**: MLB StatsAPI, OpenAI GPT-4, Weather API

## Critical LSP Errors Found

### client/src/pages/alerts.tsx (3 errors)
```
Error on line 312:
Property 'count' does not exist on type '{ homeTeam: string; awayTeam: string; ... }'
```

### server/services/engines/mlb-engine.ts (2 errors)
```
Error on line 185:
Type mismatch - missing 'obp' and 'slg' properties in batter stats

Error on line 239:
Type incompatibility in currentBatter assignment
```

### server/services/mlb-api.ts (3 errors)
```
Error on line 265:
Argument of type 'string | number' is not assignable to parameter of type 'number'

Error on line 284-286:
Cannot find name 'gamePk'
```

### server/storage.ts (7 errors)
Additional type errors in storage implementation.

## Key Issues to Review
1. **TypeScript Type Mismatches**: Multiple interface inconsistencies
2. **Alert Spam**: Despite global deduplication, system may still create multiple alerts
3. **Performance**: System monitoring multiple games simultaneously
4. **Telegram Integration**: Failed sends with 404 errors

---

## CORE FILES FOR REVIEW

### 1. PACKAGE.JSON
```json
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-*": "^1.2.4+",
    "@tanstack/react-query": "^5.60.5",
    "drizzle-orm": "^0.39.1",
    "express": "^4.21.2",
    "openai": "^5.15.0",
    "react": "^18.3.1",
    "typescript": "5.6.3",
    "ws": "^8.18.0",
    "zod": "^3.24.2"
  }
}
```

### 2. SHARED/SCHEMA.TS (Database Schema with Type Issues)
```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  sport: text("sport").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  gameInfo: jsonb("game_info").$type<{
    homeTeam: string;
    awayTeam: string;
    status: string;
    inningState?: 'top' | 'bottom';
    outs?: number;
    balls?: number;
    strikes?: number;
    runners?: {
      first: boolean;
      second: boolean;
      third: boolean;
    };
    score?: {
      home: number;
      away: number;
    };
    currentBatter?: {
      id: number;
      name: string;
      batSide: string;
      stats: {
        avg: number;
        hr: number;
        rbi: number;
        obp: number;  // ⚠️ Missing in some interfaces
        ops: number;
        slg?: number; // ⚠️ Optional but sometimes required
      };
    };
    // ⚠️ MISSING: count property that alerts.tsx expects
    count?: {
      balls: number;
      strikes: number;
    };
  }>().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  seen: boolean("seen").notNull().default(false),
});
```

### 3. CLIENT/SRC/PAGES/ALERTS.TSX (Main Alerts Display)
**Key Issue**: Line 312 references `alert.gameInfo.count` but it's not defined in the schema
```typescript
// LINE 312 (ERROR):
{alert.gameInfo.count ? `${alert.gameInfo.count.balls}-${alert.gameInfo.count.strikes}` : '0-0'} Count

// PROBLEM: gameInfo type doesn't include 'count' property
// SOLUTION: Add count?: {balls: number; strikes: number} to gameInfo schema
```

### 4. SERVER/SERVICES/ENGINES/MLB-ENGINE.TS (MLB Game Processing)
**Key Issues**: 
- Line 185: Type mismatch with batter stats (missing obp, slg)
- Line 239: currentBatter assignment incompatibility

```typescript
export interface MLBGameState {
  currentBatter?: {
    id: number;
    name: string;
    battingOrder?: number;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      ops: number;
      // ⚠️ MISSING: obp and slg that are expected in some places
    };
  };
  count?: {
    balls: number;
    strikes: number;
  };
}

// LINE 439-449 (ISSUE): Creating currentBatter with inconsistent stats
currentBatter = {
  id: currentBatterId,
  name: batterData.person.fullName,
  battingOrder: batterData.battingOrder || 0,
  batSide: batterData.person.batSide?.code || 'U',
  stats: {
    avg: avg,
    hr: hr,
    rbi: rbi,
    ops: ops
    // ⚠️ MISSING: obp, slg properties expected elsewhere
  }
};
```

### 5. SERVER/SERVICES/ENGINES/BASE-ENGINE.TS (Global Deduplication)
**Key Fix Applied**: Global deduplication now works correctly
```typescript
protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
  // 🎯 GLOBAL DEDUPLICATION: Only ONE alert per alert type across ALL games
  const globalKey = alertType;
  const now = Date.now();
  const cooldownMs = 30000; // 30 seconds between same alert types globally

  const lastGlobalFire = this.lastFireAt.get(globalKey);
  if (lastGlobalFire && (now - lastGlobalFire) < cooldownMs) {
    console.log(`🚫 GLOBAL DEDUP: Alert type '${alertType}' blocked - fired ${((now - lastGlobalFire) / 1000).toFixed(1)}s ago`);
    return false;
  }

  this.lastFireAt.set(globalKey, now);
  console.log(`✅ GLOBAL ALERT: '${alertType}' allowed - first occurrence in 30s window`);
  return true;
}
```

### 6. SERVER/SERVICES/MLB-API.TS (MLB Data Integration)
**Key Issues**:
- Line 265: Type mismatch with gamePk (string | number vs number)
- Lines 284-286: Undefined gamePk variable

```typescript
// LINE 265 (ERROR):
const liveFeed = await this.getLiveFeed(gamePk); // gamePk is string | number, expects number

// LINES 284-286 (ERROR):
console.log(`Fetching live feed for game ${gamePk}`); // gamePk not defined in scope
```

## Architecture Issues to Address

### 1. Type System Inconsistencies
- **currentBatter stats**: Some places expect `{avg, hr, rbi, ops}`, others expect `{avg, hr, rbi, obp, ops, slg}`
- **count property**: Missing from gameInfo schema but used in UI
- **gamePk type**: Inconsistent string vs number usage

### 2. Alert Deduplication Status
- ✅ **Global deduplication implemented**: 30-second cooldown per alert type across all games
- ✅ **Per-game filtering**: Only highest priority alert per game
- ❌ **Edge cases**: May still have type-related issues causing duplicates

### 3. Real-time Data Flow
```
MLB API → MLBEngine → BaseSportEngine → Storage → WebSocket → React UI
    ↓           ↓            ↓              ↓         ↓        ↓
 Real data   Extract    Process     Store    Broadcast  Display
           game state   alerts     alert     real-time  to user
```

## Recommended Fixes

### 1. Fix Type Mismatches
```typescript
// In shared/schema.ts - Add missing properties
currentBatter?: {
  id: number;
  name: string;
  batSide: string;
  stats: {
    avg: number;
    hr: number;
    rbi: number;
    obp: number;    // Add this
    ops: number;
    slg: number;    // Add this
  };
};
count?: {           // Add this entire property
  balls: number;
  strikes: number;
};
```

### 2. Fix MLB API Issues
```typescript
// In mlb-api.ts - Ensure consistent gamePk typing
const gamePk = Number(game.gamePk); // Always convert to number
const liveFeed = await this.getLiveFeed(gamePk);
```

### 3. Standardize Batter Stats Interface
```typescript
// Create consistent interface across all files
interface BatterStats {
  avg: number;
  hr: number;
  rbi: number;
  obp: number;
  ops: number;
  slg?: number; // Optional for backward compatibility
}
```

## System Health Metrics
- **Live Games Detection**: ✅ Working (0 games currently - offseason)
- **Global Deduplication**: ✅ Working (30-second cooldowns active)
- **Real MLB Data**: ✅ Working (statsapi.mlb.com integration)
- **WebSocket Broadcasting**: ✅ Working
- **TypeScript Compliance**: ❌ 15 errors across 4 files

## Configuration Files

### TSCONFIG.JSON
```json
{
  "include": ["client/src/**/*", "shared/**/*", "server/**/*"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "incremental": true,
    "noEmit": true,
    "module": "ESNext",
    "strict": true,
    "lib": ["esnext", "dom", "dom.iterable"],
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    }
  }
}
```

### VITE.CONFIG.TS
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

## System Status Summary
✅ **Working**: Real MLB API data, global deduplication, WebSocket broadcasts, UI display
❌ **Broken**: TypeScript type safety (15 LSP errors)
🎯 **Goal**: Fix type mismatches for production-ready alert system

## Request for OpenAI
Please help fix the TypeScript type mismatches and ensure the alert system works flawlessly when MLB season starts. The core functionality is working, but type safety improvements are needed for production stability.

**Key Priority Issues:**
1. Fix `count` property missing from gameInfo schema
2. Standardize batter stats interface (obp/slg inconsistencies)
3. Resolve gamePk type conflicts (string vs number)
4. Clean up all 15 TypeScript errors for production deployment