# CHIRPBOT COMPLETE SYSTEM DOCUMENT

**Date:** March 7, 2026
**Codebase Size:** ~52,500 lines of TypeScript/JS across 196 files
**Test Framework:** Jest installed, zero test files written
**CI/CD:** None (Husky pre-commit/pre-push hooks only)
**Linting:** None (no ESLint, Prettier, or Biome)

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Server Architecture](#3-server-architecture)
4. [Alert Cylinder Engine Architecture](#4-alert-cylinder-engine-architecture)
5. [Client Architecture](#5-client-architecture)
6. [Core Pipeline: Game State to Alert to User](#6-core-pipeline)
7. [Database Layer](#7-database-layer)
8. [External API Integrations](#8-external-api-integrations)
9. [Authentication System](#9-authentication-system)
10. [Real-Time Architecture](#10-real-time-architecture)
11. [AI Integration](#11-ai-integration)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Shared Code](#13-shared-code)
14. [Complete File Inventory](#14-complete-file-inventory)
15. [Verdict: Keep vs Replace](#15-verdict-keep-vs-replace)
16. [2026 Standards Recommendations](#16-2026-standards-recommendations)

---

## 1. SYSTEM OVERVIEW

Chirpbot is a real-time sports alert platform that monitors live games across 6 sports (MLB, NFL, NCAAF, NBA, WNBA, CFL), detects significant in-game events via modular "alert cylinders," enriches them with AI-generated insights, gambling odds, and weather data, then delivers alerts to users via a web dashboard and Telegram.

### Core Loop

```
Sport APIs (MLB/ESPN) --> CalendarSyncService (schedules every 5min)
                              |
                              v
                     GameStateManager (polls live data every 30s)
                              |
                              v
                  EngineLifecycleManager (starts/stops sport engines)
                              |
                              v
                   Sport Engines (MLB/NFL/NBA/etc.)
                     + Alert Cylinder Modules (94 modules across 6 sports)
                              |
                              v
                  UnifiedAIProcessor (GPT-4o enrichment)
                     + GamblingInsightsComposer (odds + weather)
                              |
                              v
                    broadcast_alerts table (PostgreSQL)
                              |
                     +--------+--------+
                     |                 |
              /api/alerts/snapshot     Telegram Bot
              (client polls 10-15s)   (push delivery)
                     |
                User Dashboard
```

---

## 2. TECHNOLOGY STACK

| Layer | Current | Version |
|-------|---------|---------|
| Runtime | Node.js | 20.16.11 |
| Language | TypeScript | 5.6.3 |
| Server Framework | Express | 4.21.2 |
| Security Headers | Helmet | 8.1.0 |
| Database | PostgreSQL (Neon Serverless) | 16 |
| ORM | Drizzle | 0.39.1 |
| Frontend Framework | React | 18.3.1 |
| Build Tool (Client) | Vite | 5.4.19 |
| Build Tool (Server) | esbuild | 0.25.0 |
| CSS Framework | Tailwind CSS | 3.4.17 |
| UI Components | shadcn/ui + Radix UI | various (20+ primitives) |
| Data Fetching | TanStack React Query | 5.60.5 |
| Routing (Client) | Wouter | 3.3.5 |
| Animation | Framer Motion | 11.13.1 |
| Charts | Recharts | 2.15.2 |
| Forms | React Hook Form + Zod | 7.55.0 / 3.24.2 |
| Auth | Passport (local + Google OAuth) + bcryptjs | 0.7.0 / 3.0.2 |
| CSRF | csrf | 3.1.0 |
| OpenID Connect | openid-client | 6.7.1 |
| Session Store | connect-pg-simple (PostgreSQL) | 10.0.0 |
| Logging | Pino + pino-pretty | 9.9.0 |
| AI | OpenAI GPT-4o | via OPENAI_API_KEY |
| Notifications | Telegram Bot API | custom service |
| Caching (functions) | memoizee | 0.4.17 |
| Retry Logic | p-retry | 6.2.1 |
| ID Generation | uuid | 13.0.0 |
| Dates | date-fns | 3.6.0 |
| Icons | lucide-react | 0.453.0 |
| Testing | Jest + ts-jest (installed, unused) | 30.1.3 |
| Dev Runner | tsx | 4.19.1 |
| Deployment | Replit (autoscale) | stable-24_05 nix |

### Unused/Partially Used Dependencies
- `memorystore` -- fallback session store, likely unused
- `ws` -- WebSocket library installed, no implementation
- ~15 of 33 shadcn/ui components appear unused
- Jest/ts-jest installed but zero test files exist

---

## 3. SERVER ARCHITECTURE

### Entry Point

**`server/index.ts`** (66 lines) -- Creates Express app, registers routes, starts HTTP server on port 5000.
**`server/main.ts`** (11 lines) -- Wrapper that imports index.ts.
**`server/db.ts`** (20 lines) -- Drizzle ORM + Neon PostgreSQL connection setup.

### Routes (`server/routes.ts` -- 5,213 lines)

This single file contains ALL route definitions, middleware setup, service initialization, and helper functions. It is the largest file in the codebase.

#### Authentication
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/register` or `/api/auth/signup` | No | Create user |
| POST | `/api/login` or `/api/auth/login` | No | Login, create session |
| POST | `/api/logout` or `/api/auth/logout` | Yes | Destroy session |
| GET | `/api/user` or `/api/auth/user` | Yes | Get current user |

#### Games
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/games/today` | No | Games by sport + date (from CalendarSyncService) |
| GET | `/api/games/multi-day` | No | Multi-day game schedule |
| GET | `/api/games/:gameId/live` | No | Live game data (MLBApiService) |
| GET | `/api/games/calendar-status` | No | Calendar sync status |
| GET | `/api/server-date` | No | Server's Pacific timezone date |

#### User Monitored Games
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/:userId/monitored-games` | Yes | List monitored games |
| POST | `/api/user/:userId/monitored-games` | Yes | Add game to monitor |
| DELETE | `/api/user/:userId/monitored-games/:gameId` | Yes | Remove monitored game |

#### Alerts
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/alerts/snapshot` | Yes | Broadcast alerts filtered by user prefs |
| GET | `/api/alerts` | Yes | Alert list with limit param |
| GET | `/api/alerts/stats` | No | Alert statistics |
| GET | `/api/alerts/count` | No | Simple alert count |

#### User Settings & Preferences
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/:userId/settings` | Yes | Get settings |
| PUT | `/api/user/:userId/settings` | Yes | Update settings |
| GET | `/api/user/:userId/settings/gambling` | Yes | Get gambling settings |
| PUT | `/api/user/:userId/settings/gambling` | Yes | Update gambling settings |
| GET | `/api/user/:userId/alert-preferences` | Yes | Get alert preferences |
| POST | `/api/user/:userId/alert-preferences` | Yes | Set alert preferences |

#### Gambling
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/gambling/insights/:gameId` | Yes | Gambling insights for a game |
| GET | `/api/gambling/odds/:sport` | Yes | Odds for a sport |

#### System
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| GET | `/api/debug/services` | No | Service status |

### Middleware (`server/middleware/`)

| File | Lines | Purpose |
|------|-------|---------|
| `circuit-breaker.ts` | 190 | Circuit breaker pattern for external API calls |
| `memory-manager.ts` | 139 | Memory usage monitoring, cleanup triggers |

### Configuration (`server/config/`)

| File | Lines | Purpose |
|------|-------|---------|
| `ai-features.ts` | 12 | AI feature flags (enable AI enhancement, scanner, similarity threshold) |
| `runtime.ts` | 170 | Runtime configuration, game state types, weather-arm reasons |

### Utilities (`server/utils/`)

| File | Lines | Purpose |
|------|-------|---------|
| `singleton-lock.ts` | 211 | Ensures single instance of background services |
| `timezone.ts` | 32 | Pacific timezone helpers |

### Services (non-engine, `server/services/`)

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| GameStateManager | `game-state-manager.ts` | 858 | Live game state tracking, user-game associations, polling loop |
| EngineLifecycleManager | `engine-lifecycle-manager.ts` | 1,256 | Dynamic sport engine start/stop, pre-warming, health recovery |
| CalendarSyncService | `calendar-sync-service.ts` | 484 | Pre-fetches game schedules every 5min |
| GamblingInsightsComposer | `gambling-insights-composer.ts` | 1,345 | Combines alert + game state + weather + odds |
| UnifiedAIProcessor | `unified-ai-processor.ts` | 2,032 | GPT-4o integration for alert enrichment |
| UnifiedDeduplicator | `unified-deduplicator.ts` | 244 | Cross-sport alert deduplication |
| UnifiedHealthMonitor | `unified-health-monitor.ts` | 718 | System health monitoring + automatic recovery |
| UnifiedSettings | `unified-settings.ts` | 732 | Centralized settings management |
| OddsApiService | `odds-api-service.ts` | 380 | The Odds API integration (moneyline, spreads, totals) |
| WeatherService | `weather-service.ts` | 245 | OpenWeatherMap for stadium weather |
| WeatherOnLiveService | `weather-on-live-service.ts` | 957 | Weather monitoring for live games |
| Telegram | `telegram.ts` | 268 | Telegram Bot API for push alerts |
| BaseSportApi | `base-sport-api.ts` | 489 | Abstract base class for all sport API integrations |
| MLBApiService | `mlb-api.ts` | 724 | MLB Stats API |
| NFLApiService | `nfl-api.ts` | 365 | NFL via ESPN |
| NCAAFApiService | `ncaaf-api.ts` | 295 | NCAAF via ESPN |
| NBAApiService | `nba-api.ts` | 310 | NBA via ESPN |
| WNBAApiService | `wnba-api.ts` | 265 | WNBA via ESPN |
| CFLApiService | `cfl-api.ts` | 248 | CFL via ESPN |
| AISituationParser | `ai-situation-parser.ts` | 205 | AI-powered game situation analysis |
| AdvancedPlayerStats | `advanced-player-stats.ts` | 534 | Player performance tracking |
| QualityValidator | `quality-validator.ts` | 210 | AI output validation + XSS protection |
| AlertCleanup | `alert-cleanup.ts` | 125 | Periodic alert data cleanup |
| GameMonitoringCleanup | `game-monitoring-cleanup.ts` | 197 | Cleanup stale monitored games |
| MigrationAdapter | `migration-adapter.ts` | 102 | Data migration helpers |
| SportsDataApi | `sportsdata-api.ts` | 156 | Additional sports data source |
| HttpService | `http.ts` | 71 | HTTP fetch wrapper |
| TextUtils | `text-utils.ts` | 12 | Text similarity (Jaccard) |

### Storage Layer (`server/storage.ts` -- 1,156 lines)

Implements `IStorage` interface using Drizzle ORM against Neon PostgreSQL. Also exports `unifiedSettings` singleton.

**Key Methods:**
- User CRUD: `getUser()`, `getUserByUsername()`, `createUser()`
- Alerts: `createAlert()`, `getAlerts()`, `getRecentAlerts()`, `getAlertsByType()`
- Broadcast Alerts: `createBroadcastAlert()`, `getBroadcastAlertsSince()`
- Monitored Games: `getUserMonitoredTeams()`, `addUserMonitoredTeam()`, `removeUserMonitoredTeam()`, `getAllMonitoredGames()`
- Settings: `getUserSettings()`, `updateUserSettings()`, `getUserAlertPreferences()`, `setUserAlertPreference()`
- Global Alert Settings: admin-controlled per-sport alert toggles

---

## 4. ALERT CYLINDER ENGINE ARCHITECTURE

This is the most sophisticated part of the system. **94 files, 18,460 lines** organized as a plugin architecture.

### Base Engine (`server/services/engines/base-engine.ts` -- 572 lines)

The `BaseSportEngine` abstract class provides:
- `parseTimeToSeconds()` -- standardized time parsing
- `loadAlertModule()` -- dynamic import of cylinder modules
- `initializeUserAlertModules()` -- loads user-enabled modules with change-detection caching
- `isAlertEnabled()` -- checks if an alert type is enabled for the user/sport
- `generateLiveAlerts()` -- main alert generation loop
- Possession tracking, timeout tracking
- Performance metrics (generation time, module load time, cache hits/misses)
- Deduplication (single implementation for all sports)

Sport engines override:
- `calculateProbability()` -- sport-specific probability weighting
- `enhanceGameStateWithLiveData()` -- sport-specific API enrichment
- `getModuleMap()` -- maps alert types to module file paths

### Sport Engines

| Engine | File | Lines | Status |
|--------|------|-------|--------|
| MLBEngine | `mlb-engine.ts` | 309 | **ACTIVE** |
| NFLEngine | `nfl-engine.ts` | 187 | Disabled in EngineLifecycleManager |
| NCAAFEngine | `ncaaf-engine.ts` | ~200 | Disabled |
| NBAEngine | `nba-engine.ts` | ~200 | Disabled |
| WNBAEngine | `wnba-engine.ts` | ~200 | Disabled |
| CFLEngine | `cfl-engine.ts` | ~200 | Disabled |

**Note:** Only MLB is currently active. Other sports are disabled in `engine-lifecycle-manager.ts` line 26-32 with comment "Only MLB is active right now."

### MLB Probability Model (`mlb-prob-model.ts` -- 406 lines)
Statistical probability calculations for MLB situations: RE24 run expectancy, scoring probability by base/out state, win probability.

### MLB Performance Tracker (`mlb-performance-tracker.ts` -- 1,353 lines)
Tracks batter and pitcher performance metrics during live games.

### Alert Cylinder Modules (80 modules)

Each module is a self-contained alert detector for a specific game situation.

#### MLB (27 modules)
| Module | Purpose |
|--------|---------|
| `bases-loaded-no-outs-module.ts` | Bases loaded, 0 outs |
| `bases-loaded-one-out-module.ts` | Bases loaded, 1 out |
| `bases-loaded-two-outs-module.ts` | Bases loaded, 2 outs |
| `first-and-second-module.ts` | Runners on 1st and 2nd |
| `first-and-third-no-outs-module.ts` | Runners on 1st and 3rd, 0 outs |
| `first-and-third-one-out-module.ts` | Runners on 1st and 3rd, 1 out |
| `first-and-third-two-outs-module.ts` | Runners on 1st and 3rd, 2 outs |
| `second-and-third-no-outs-module.ts` | Runners on 2nd and 3rd, 0 outs |
| `second-and-third-one-out-module.ts` | Runners on 2nd and 3rd, 1 out |
| `runner-on-second-no-outs-module.ts` | Runner on 2nd, 0 outs |
| `runner-on-third-no-outs-module.ts` | Runner on 3rd, 0 outs |
| `runner-on-third-one-out-module.ts` | Runner on 3rd, 1 out |
| `runner-on-third-two-outs-module.ts` | Runner on 3rd, 2 outs |
| `scoring-opportunity-module.ts` | General RISP situations |
| `risp-prob-enhanced-module.ts` | RISP with probability enhancement |
| `steal-likelihood-module.ts` | Stolen base probability |
| `pitching-change-module.ts` | Pitching changes |
| `strikeout-module.ts` | Strikeout detection |
| `batter-due-module.ts` | Key batter approaching |
| `on-deck-prediction-module.ts` | On-deck batter prediction |
| `clutch-situation-module.ts` | Clutch moments |
| `late-inning-close-module.ts` | Close game, late innings |
| `high-scoring-situation-module.ts` | High-scoring game detection |
| `momentum-shift-module.ts` | Momentum shifts |
| `seventh-inning-stretch-module.ts` | 7th inning stretch |
| `wind-change-module.ts` | Wind impact on play |
| `game-start-module.ts` | Game starting |

#### NFL (9 modules)
| Module | Purpose |
|--------|---------|
| `red-zone-module.ts` | Red zone entry |
| `red-zone-opportunity-module.ts` | Red zone scoring chance |
| `fourth-down-module.ts` | 4th down decisions |
| `two-minute-warning-module.ts` | 2-minute warning |
| `second-half-kickoff-module.ts` | 2nd half start |
| `turnover-likelihood-module.ts` | Turnover probability |
| `massive-weather-module.ts` | Severe weather impact |
| `game-start-module.ts` | Game starting |
| `ai-scanner-module.ts` | AI-powered situation scan |

#### NBA (10 modules)
Clutch performance, final minutes, 4th quarter, overtime, playoff intensity, superstar analytics, championship implications, game start, 2-minute warning, AI scanner

#### NCAAF (14 modules)
Red zone, 4th down decision, close game, comeback potential, upset opportunity, scoring play, halftime, 4th quarter, 2-minute warning, massive weather, 2nd half kickoff, red zone efficiency, game start, AI scanner

#### WNBA (11 modules)
Clutch time, crunch time defense, comeback potential, final minutes, 4th quarter, high-scoring quarter, low-scoring quarter, championship implications, overtime, game start, 2-minute warning, AI scanner

#### CFL (11 modules)
3rd down situation, rouge opportunity, final minutes, 4th quarter, overtime, Grey Cup implications, massive weather, 2nd half kickoff, 2-minute warning, game start, AI scanner

**Each sport also has an `ai-scanner-module.ts`** that uses GPT-4o to detect unusual situations not covered by rule-based modules.

### Engine Lifecycle Manager (`engine-lifecycle-manager.ts` -- 1,256 lines)

Manages when sport engines run:
- **Pre-warming:** Starts engines 15 minutes before a game goes live
- **Dynamic start/stop:** Only runs engines when games are in progress
- **Circuit breaker:** Per-sport loading state with exponential backoff on failure (10s, 30s, 60s, max 2m)
- **Health monitoring:** Automatic recovery on engine failure
- **Resource cleanup:** Stops engines when all games for a sport end
- **Currently: only MLB engine is enabled** (others commented out)

---

## 5. CLIENT ARCHITECTURE

### Entry Point & Providers

**`client/src/main.tsx`** (43 lines) -- React root render with global error handlers.
**`client/src/App.tsx`** (107 lines) -- Provider stack + routing.

**Provider Stack:**
```
QueryClientProvider (React Query)
  -> TooltipProvider (Radix)
    -> Toaster (sonner)
      -> RegularAppContent (layout wrapper, max-w-md mobile-first)
        -> BottomNavigation (for authenticated users)
        -> Routes
```

### Routing (Wouter)

| Path | Component | Auth |
|------|-----------|------|
| `/` | Landing | No |
| `/login` | Login | No (redirects if authed) |
| `/signup` | Signup | No (redirects if authed) |
| `/dashboard` | Dashboard | Yes |
| `/calendar` | Calendar (Games) | Yes |
| `/alerts` | Alerts | Yes |
| `/settings` | Settings | Yes |
| `/game/:gameId` | GameNarrative | Yes |
| `*` | NotFound | No |

Admin users are redirected to `/admin-panel` (server-rendered).

### Pages

| Page | File | Lines | Key API Calls | Polling |
|------|------|-------|---------------|---------|
| Dashboard | `dashboard.tsx` | 545 | alerts, stats, monitored-games | 15s/30s/60s |
| Landing | `landing.tsx` | 730 | None (static marketing page) | -- |
| Login | `login.tsx` | 250 | POST /api/auth/login | -- |
| Signup | `signup.tsx` | 330 | POST /api/auth/signup | -- |
| Alerts | `alerts.tsx` | 651 | alerts (limit=120), stats | 30s/60s |
| Calendar | `calendar.tsx` | 533 | games/multi-day, monitored-games | -- |
| Settings | `settings.tsx` | 2,500+ | Multiple settings endpoints | -- |
| Game Narrative | `game-narrative.tsx` | 289 | alerts, gambling insights | 10s |
| Not Found | `not-found.tsx` | ~20 | -- | -- |

### Feature Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| BottomNavigation | `bottom-navigation.tsx` | 126 | Mobile bottom nav with alert badge counter |
| TeamLogo | `team-logo.tsx` | 912 | Team logos with ESPN CDN fallback, 370+ team mappings |
| SportsLoading | `sports-loading.tsx` | 317 | Sport-specific loading spinners |
| BaseballDiamond | `baseball-diamond.tsx` | ~50 | MLB diamond with animated runner indicators |
| PageHeader | `PageHeader.tsx` | ~40 | Sticky page header |
| ChirpBotLogo | `ChirpBotLogo.tsx` | ~30 | App logo |
| ErrorDisplay | `EnhancedErrorDisplay.tsx` | ~80 | Error boundary + formatted errors |
| RetryFeedback | `RetryFeedback.tsx` | ~50 | Retry state UI |
| WeatherVisualizer | `WeatherImpactVisualizer.tsx` | ~60 | Weather effect visualization |
| ROICalculator | `roi-calculator.tsx` | ~80 | Betting ROI calculator |
| SportTabs | `SportTabs.tsx` | ~40 | Reusable sport tab filter |

### UI Component Library (shadcn/ui)
33 files, ~2,700 lines total. Copy-pasted Radix-based components. Includes: button, card, dialog, dropdown-menu, input, select, tabs, toast, tooltip, badge, switch, form, accordion, alert-dialog, avatar, calendar, carousel, chart, checkbox, collapsible, command, drawer, input-otp, pagination, popover, progress, radio-group, resizable, scroll-area, separator, skeleton, slider, textarea.

### Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| useAuth | `useAuth.ts` | 75 | Auth context: user, isAuthenticated, isAdmin. Two-tier check (user + admin session) |
| useGamesAvailability | `useGamesAvailability.ts` | 43 | Check available games across all sports for today |
| useToast | `use-toast.ts` | 189 | Toast notification queue management |
| useMobile | `use-mobile.tsx` | 19 | Mobile viewport detection (768px breakpoint) |
| useAlertSound | `use-alert-sound.ts` | ~30 | Play sound on new alerts |

### State Management

**Primary:** TanStack React Query v5 for all server state.
**Client State:** None (no Zustand/Redux/Jotai). Auth via React Context only.

**Query Client Config:**
- `staleTime: 30s`
- `gcTime: 5min`
- `refetchOnWindowFocus: false`
- `retry: 3` with exponential backoff via `p-retry` (1s, 2s, 4s max 10s)
- Only retries 5xx, 408 (timeout), 429 (rate limit) errors

### Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `queryClient.ts` | 167 | React Query setup, `apiRequest()` with retry via p-retry |
| `utils.ts` | 6 | `cn()` Tailwind class merge helper |
| `team-utils.ts` | 157 | Team abbreviations (100+), nicknames, `timeAgo()`, sport accent colors |
| `error-messages.ts` | 338 | Context-aware API error parsing (network, auth, validation, rate limit) |
| `alert-message.ts` | ~50 | Alert text formatting |
| `clean-alert-formatter.ts` | ~50 | Clean alert text for Telegram delivery |

### Types (`client/src/types/index.ts` -- 220 lines)
Key interfaces: `Team`, `Alert` (with nested context including MLB base runners, football field position, basketball clock, gambling insights with moneyline/spread/total, AI confidence/projections, weather), `Settings`, `User`.

---

## 6. CORE PIPELINE

### Step 1: Schedule Sync
`CalendarSyncService` runs every 5 minutes:
- Calls each sport API's `getGames(today)` and `getGames(tomorrow)`
- Stores results in memory Map keyed by sport
- `/api/games/today` reads from this cache

### Step 2: User Monitors a Game
- User toggles "Monitor" on Calendar page
- Client: `POST /api/user/:userId/monitored-games`
- Server: Inserts into `userMonitoredTeams` table
- Server: Calls `gameStateManager.addUserToGame(gameId, userId)`
- GameStateManager: Adds to bidirectional maps, triggers initial fetch

### Step 3: Live Polling + Engine Lifecycle
`GameStateManager.pollAllGames()` runs every 30 seconds:
- Gets all active gameIds from `gameUsers` map
- For each game: determines sport, calls appropriate API service
- `EngineLifecycleManager` starts sport engines when games go live (pre-warms 15min early)
- Compares new state vs previous state for change detection

### Step 4: Alert Cylinder Processing
When game state changes, the sport engine processes it:
1. `enhanceGameStateWithLiveData()` -- enriches raw API data with sport-specific details
2. `initializeUserAlertModules()` -- loads only user-enabled cylinder modules (cached)
3. Each active module's `evaluate(gameState)` runs
4. Modules return `AlertResult[]` with type, confidence, priority, context
5. `UnifiedDeduplicator` prevents duplicate alerts (Jaccard similarity)

### Step 5: AI Enrichment
`UnifiedAIProcessor` processes generated alerts:
- Calls GPT-4o with game context (2.5s timeout, temperature 0.2)
- Generates primary insight (max 14 words) + secondary insight (max 18 words)
- `QualityValidator` validates AI output, strips XSS
- `GamblingInsightsComposer` adds odds data from OddsApiService + weather data

### Step 6: Storage & Delivery
- Alerts stored in `broadcast_alerts` table with auto-incrementing sequence number
- Telegram: `telegram.ts` sends MarkdownV2-formatted alerts to users with Telegram configured
- Client polls `/api/alerts/snapshot?seq=N` every 10-15 seconds
- Server filters by user's monitored game IDs + alert preferences
- Returns only new alerts since last sequence number

---

## 7. DATABASE LAYER

### ORM & Driver
- **Drizzle ORM** v0.39.1 with `drizzle-kit` for schema management
- **Neon Serverless** PostgreSQL driver (`@neondatabase/serverless`)
- Schema push workflow (`npm run db:push`) -- no versioned migration files

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| username | varchar | Unique |
| password | varchar | bcryptjs hash |
| role | varchar | admin, manager, analyst, user |
| createdAt | timestamp | Default now() |

Also supports OAuth fields (Google, Apple) and Telegram config (botToken, chatId).

#### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| gameId | varchar | Game identifier |
| type | varchar | Alert type |
| title | varchar | Alert title |
| message | text | Alert message |
| sport | varchar | Sport code |
| score | integer | Confidence score |
| payload | jsonb | Full alert data (context, AI insights, odds) |
| createdAt | timestamp | |

#### `broadcast_alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| gameId | varchar | |
| alertKey | varchar | Deduplication key |
| type | varchar | Alert type |
| sport | varchar | |
| score | integer | Confidence score |
| payload | jsonb | Full alert data |
| sequenceNumber | serial | Auto-increment for incremental polling |
| createdAt | timestamp | |

#### `user_monitored_teams`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | varchar | FK to users |
| gameId | varchar | |
| sport | varchar | |
| homeTeamName | varchar | |
| awayTeamName | varchar | |
| createdAt | timestamp | |

#### `user_settings` / `user_preferences`
Settings and preferences stored as jsonb blobs.

#### `global_alert_settings`
Admin-controlled toggles for alert types per sport.

#### `game_cache`
Real-time game state caching in the database.

#### `sessions`
Express session storage via `connect-pg-simple`.

### Alert Type Values
`momentum_shift`, `scoring_surge`, `pitcher_change`, `base_situation`, `close_game`, `blowout`, `weather_impact`, `injury_update`, `comeback_alert`, `record_watch`, `rivalry_alert`, `playoff_implications`, plus all sport-specific cylinder types (bases_loaded, red_zone, clutch_time, etc.)

---

## 8. EXTERNAL API INTEGRATIONS

| Service | Base URL | Used For | Auth | Rate Limit |
|---------|----------|----------|------|-----------|
| MLB Stats API | `statsapi.mlb.com/api/v1/` | MLB schedules, live data, play-by-play | None (public) | Respectful polling |
| ESPN API | `site.api.espn.com/apis/site/v2/sports/` | NFL, NCAAF, NBA, WNBA, CFL scores | None (public) | Respectful polling |
| The Odds API | `api.the-odds-api.com/v4/` | Betting odds (moneyline, spreads, totals) | API key (user-provided) | 450 req/30 days |
| OpenWeatherMap | `api.openweathermap.org/data/2.5/` | Weather at stadiums | API key (env var) | Standard tier |
| OpenAI | `api.openai.com/v1/` | GPT-4o alert enrichment | API key (env var) | Standard tier |
| Telegram Bot API | `api.telegram.org/bot{token}/` | Push alert delivery | User-provided bot token | Standard |
| ESPN CDN | `a.espncdn.com/` | Team logos | None (public) | None |
| Google OAuth | Google endpoints | Social login | OAuth2 credentials | Standard |

---

## 9. AUTHENTICATION SYSTEM

### Server Side
- **Framework:** Passport.js with local strategy + Google OAuth2
- **Password:** bcryptjs hashing
- **CSRF:** csrf package for token generation/validation
- **OpenID Connect:** openid-client for OAuth2/OIDC flows
- **Session Store:** PostgreSQL via `connect-pg-simple`
- **Security Headers:** Helmet middleware
- **Roles:** admin, manager, analyst, user

### Client Side
- `useAuth()` hook queries `GET /api/auth/user` (cached 5 min)
- Two-tier check: regular user session first, then admin session via `/api/admin-auth/verify`
- `ProtectedRoute` component redirects unauthenticated users to `/`
- `PublicRoute` redirects authenticated users to `/dashboard`
- All API calls include `credentials: 'include'` for cookie passthrough
- Google/Apple social login buttons exist in UI (Google wired, Apple coming soon)

---

## 10. REAL-TIME ARCHITECTURE

### Current: HTTP Polling (No WebSockets, No SSE)

**Server-side polling:**
- GameStateManager polls sport APIs every 30 seconds
- CalendarSyncService syncs schedules every 5 minutes
- EngineLifecycleManager pre-warms engines 15 minutes before game time

**Client-side polling:**
- Dashboard: alerts every 15s, stats every 60s, monitored games every 30s
- Alerts page: alerts every 30s, stats every 60s
- Game Narrative: alerts every 10s

**Incremental Updates:**
- `broadcast_alerts` table has auto-incrementing `sequenceNumber`
- Client sends `?seq=N` to get only alerts newer than sequence N
- Efficient incremental polling without timestamp drift

**Push Delivery:**
- Telegram Bot API for users with Telegram configured
- No web push notifications
- `ws` package installed but unused

---

## 11. AI INTEGRATION

### OpenAI GPT-4o

**UnifiedAIProcessor** (`unified-ai-processor.ts` -- 2,032 lines):
- Processes alerts with `CrossSportContext` (universal game state)
- Sends sport-specific prompts to GPT-4o
- Timeout: 2.5 seconds (fails gracefully to rule-based fallback)
- Temperature: 0.2 (consistent, factual output)
- Output: primary insight (max 14 words) + secondary insight (max 18 words)

**AI Scanner Modules** (one per sport):
- Each sport has an `ai-scanner-module.ts` cylinder
- Detects unusual situations not covered by rule-based modules
- Runs as part of the normal cylinder evaluation loop

**Quality Control:**
- `QualityValidator` validates AI output format
- XSS protection via Zod schema validation
- `UnifiedDeduplicator` uses Jaccard similarity (threshold: 0.72) to prevent near-duplicate AI insights

**AI Feature Flags** (`config/ai-features.ts`):
```typescript
enableAIEnhancement: true
enableAIScanner: true
hideDuplicateInsights: true
duplicateSimilarityThreshold: 0.72
maxPrimaryWords: 14
maxSecondaryWords: 18
openAITimeoutMs: 2500
openAITemperature: 0.2
```

---

## 12. INFRASTRUCTURE & DEPLOYMENT

### Platform: Replit (Autoscale)
```
modules = ["nodejs-20", "web", "postgresql-16", "python-3.11"]
Port 3000 -> External 8081 (API)
Port 5000 -> External 80 (Frontend)
Nix channel: stable-24_05
```

### Build Pipeline
```bash
# Development
npm run dev    # NODE_ENV=development tsx server/index.ts

# Production build
npm run build  # drizzle-kit push && vite build && esbuild server -> dist/

# Production start
npm run start  # NODE_ENV=production node dist/index.js (or dist/index.cjs)
```

### Scripts
```json
"dev": "NODE_ENV=development tsx server/index.ts",
"build": "drizzle-kit push && vite build && esbuild ...",
"start": "NODE_ENV=production node dist/index.js",
"check": "tsc",
"db:push": "drizzle-kit push",
"validate-cylinders": "node scripts/validate-cylinders.js",
"create-cylinder": "node scripts/create-cylinder.js"
```

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `OPENAI_API_KEY` | Yes | GPT-4o for AI insights |
| `CANONICAL_ORIGIN` | Yes | Base URL for session/CSRF validation |
| `PORT` | No | Server port (default 5000) |
| `NODE_ENV` | No | Environment mode |
| `OPENWEATHERMAP_API_KEY` | No | Weather data |
| `ALLOW_DYNAMIC_PORT` | No | Enable dynamic port assignment |
| `SKIP_SEED_IN_PROD` | No | Skip database seeding |

User-configured (stored in DB, not env):
- `TELEGRAM_BOT_TOKEN` -- per-user Telegram bot token
- `TELEGRAM_CHAT_ID` -- per-user Telegram chat ID
- `ODDS_API_KEY` -- per-user odds API key

**No `.env.example` file exists.**

### Git Hooks (Husky)
- **pre-commit:** `node scripts/guard-new-files.js` (validates new file additions)
- **pre-push:** Blocks direct pushes to `main` (enforces feature branch + PR workflow)

### Logging
- **Pino** v9.9.0 for structured JSON logging
- **pino-pretty** for development log formatting
- No centralized log aggregation or error tracking service

### What's Missing
- No Docker/containerization
- No CI/CD pipeline (no GitHub Actions)
- No ESLint/Prettier/Biome
- No monitoring/observability beyond UnifiedHealthMonitor
- No error tracking service (no Sentry)
- No rate limiting on API endpoints (only outbound API calls)
- No API versioning (`/api/` not `/api/v1/`)
- No `.env.example` documentation

---

## 13. SHARED CODE

### `shared/schema.ts` (417 lines)
- Drizzle ORM table definitions
- Zod validation schemas (`insertUserSchema`, `insertAlertSchema`, etc.)
- TypeScript types + `AlertResult` interface used by engines
- Exported for both client and server

### `shared/season-manager.ts` (205 lines)
- Determines which sports are currently in-season
- Season date ranges for all 6 sports
- Sport accent colors for UI
- Used by client for sport tab filtering and server for polling priority

---

## 14. COMPLETE FILE INVENTORY

### Server Core

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 66 | Server bootstrap |
| `main.ts` | 11 | Entry wrapper |
| `db.ts` | 20 | Drizzle + Neon connection |
| `routes.ts` | **5,213** | ALL route definitions |
| `storage.ts` | **1,156** | Database layer |
| `seed-database.ts` | 36 | DB seeding |
| `vite.ts` | 67 | Vite dev integration |

### Server Middleware & Config

| File | Lines | Purpose |
|------|-------|---------|
| `middleware/circuit-breaker.ts` | 190 | Circuit breaker for external APIs |
| `middleware/memory-manager.ts` | 139 | Memory monitoring |
| `config/ai-features.ts` | 12 | AI feature flags |
| `config/runtime.ts` | 170 | Runtime config |
| `utils/singleton-lock.ts` | 211 | Single-instance enforcement |
| `utils/timezone.ts` | 32 | Pacific timezone helpers |

### Server Services

| Service | Lines | Purpose |
|---------|-------|---------|
| `game-state-manager.ts` | 858 | Live game state + user-game associations |
| `engine-lifecycle-manager.ts` | 1,256 | Dynamic engine start/stop |
| `unified-ai-processor.ts` | 2,032 | GPT-4o integration |
| `gambling-insights-composer.ts` | 1,345 | Odds + weather enrichment |
| `unified-health-monitor.ts` | 718 | Health monitoring + recovery |
| `unified-settings.ts` | 732 | Centralized settings |
| `weather-on-live-service.ts` | 957 | Live weather monitoring |
| `advanced-player-stats.ts` | 534 | Player performance |
| `calendar-sync-service.ts` | 484 | Schedule pre-fetching |
| `base-sport-api.ts` | 489 | Abstract sport API base |
| `mlb-api.ts` | 724 | MLB Stats API |
| `odds-api-service.ts` | 380 | The Odds API |
| `nfl-api.ts` | 365 | NFL via ESPN |
| `nba-api.ts` | 310 | NBA via ESPN |
| `ncaaf-api.ts` | 295 | NCAAF via ESPN |
| `telegram.ts` | 268 | Telegram Bot API |
| `wnba-api.ts` | 265 | WNBA via ESPN |
| `cfl-api.ts` | 248 | CFL via ESPN |
| `weather-service.ts` | 245 | OpenWeatherMap |
| `unified-deduplicator.ts` | 244 | Alert deduplication |
| `quality-validator.ts` | 210 | AI output validation |
| `ai-situation-parser.ts` | 205 | AI situation analysis |
| `game-monitoring-cleanup.ts` | 197 | Stale game cleanup |
| `sportsdata-api.ts` | 156 | Additional sports data |
| `alert-cleanup.ts` | 125 | Alert data cleanup |
| `migration-adapter.ts` | 102 | Data migration |
| `http.ts` | 71 | HTTP fetch wrapper |
| `text-utils.ts` | 12 | Jaccard similarity |

### Alert Engine System (94 files, 18,460 lines)

| Component | Files | Lines |
|-----------|-------|-------|
| `engines/base-engine.ts` | 1 | 572 |
| `engines/mlb-engine.ts` | 1 | 309 |
| `engines/mlb-prob-model.ts` | 1 | 406 |
| `engines/mlb-performance-tracker.ts` | 1 | 1,353 |
| `engines/nfl-engine.ts` | 1 | 187 |
| `engines/nba-engine.ts` | 1 | ~200 |
| `engines/ncaaf-engine.ts` | 1 | ~200 |
| `engines/wnba-engine.ts` | 1 | ~200 |
| `engines/cfl-engine.ts` | 1 | ~200 |
| MLB cylinder modules | 27 | ~5,000 |
| NFL cylinder modules | 9 | ~1,800 |
| NBA cylinder modules | 10 | ~2,000 |
| NCAAF cylinder modules | 14 | ~2,800 |
| WNBA cylinder modules | 11 | ~2,200 |
| CFL cylinder modules | 11 | ~2,200 |
| AI opportunity scanner | 1 | ~200 |

### Client Pages

| Page | Lines | Purpose |
|------|-------|---------|
| `dashboard.tsx` | 545 | Main dashboard |
| `landing.tsx` | 730 | Marketing landing |
| `alerts.tsx` | 651 | Alert feed |
| `calendar.tsx` | 533 | Game browsing |
| `settings.tsx` | 2,500+ | User settings |
| `signup.tsx` | 330 | Registration |
| `game-narrative.tsx` | 289 | Game timeline |
| `login.tsx` | 250 | Login |
| `not-found.tsx` | ~20 | 404 |

### Client Components, Hooks, Utils
- Feature components: ~1,700 lines across 11 files
- shadcn/ui: ~2,700 lines across 33 files
- Hooks: ~350 lines across 5 files
- Utilities: ~720 lines across 6 files
- Types: 220 lines

### Shared
| File | Lines | Purpose |
|------|-------|---------|
| `schema.ts` | 417 | DB schema + Zod + types |
| `season-manager.ts` | 205 | Season management |

### Grand Total
| Category | Files | Lines |
|----------|-------|-------|
| Server core | 7 | ~6,570 |
| Server middleware/config/utils | 6 | ~754 |
| Server services | 28 | ~12,590 |
| Alert engine system | 94 | ~18,460 |
| Client pages | 9 | ~5,850 |
| Client components | 44 | ~4,400 |
| Client hooks + utils + types | 12 | ~1,290 |
| Shared | 2 | 622 |
| Config files | 7 | ~450 |
| Scripts | 2 | ~200 |
| **TOTAL** | **~210** | **~52,500** |

---

## 15. VERDICT: KEEP vs REPLACE

### KEEP (Solid foundations, 2026-ready or close)

| System | Why Keep |
|--------|----------|
| **Drizzle ORM + Neon PostgreSQL** | Drizzle is the modern standard. Neon serverless is excellent. Schema is clean. |
| **TanStack React Query v5** | Industry standard for server state. Config is solid. |
| **Vite** | Current, fast, excellent DX. |
| **Tailwind CSS** | Industry standard. Custom sport theme is well-built. |
| **shadcn/ui + Radix** | Correct approach (copy components). Audit unused ones. |
| **TypeScript strict mode** | Obviously keep. |
| **BaseSportApi pattern** | Abstract base class with retry + cache + rate limiting is sound. |
| **All 6 sport API services** | Well-structured. Minor cleanup needed. |
| **OddsApiService** | Rate limiting, caching, bookmaker priority -- well-designed. |
| **CalendarSyncService** | Smart approach to avoid rate limiting. Keep the concept. |
| **Broadcast alert architecture** | Store once, filter per-user at query time. Efficient and correct. |
| **Sequence number polling** | Incremental updates via auto-incrementing seq. Clean pattern. |
| **Alert cylinder module pattern** | Plugin architecture is excellent. Each module is self-contained. Keep the architecture. |
| **BaseSportEngine** | Well-designed abstract class. Dynamic module loading with caching. |
| **Sport-specific engines** | Clean separation of concerns. Just need to re-enable non-MLB sports. |
| **MLB probability model** | RE24, win probability -- solid statistical foundation. |
| **Pino structured logging** | Already 2026-standard. Keep. |
| **Helmet security headers** | Good practice. Keep. |
| **Circuit breaker middleware** | Proper resilience pattern. Keep. |
| **Husky git hooks** | Pre-push main protection is good. |
| **Shared Drizzle+Zod schema** | Good pattern for client-server type safety. |
| **Telegram delivery** | Working push notification channel. |
| **Singleton lock** | Prevents duplicate background services. |
| **Season manager** | Simple, useful, correct. |
| **Team logo system** | ESPN CDN fallback approach works well. |

### REPLACE (Tech debt, outdated, or fundamentally broken)

| System | Why Replace | 2026 Recommendation |
|--------|-------------|---------------------|
| **Express 4** | Express 5 is stable, but Hono is the 2026 standard for TypeScript backends. Faster, smaller, better typed, built-in middleware. | **Hono** or **Express 5** |
| **routes.ts (5,213 lines)** | Single file with ALL routes, middleware, service init, helpers. Completely unmaintainable. | Split into route modules (`routes/auth.ts`, `routes/games.ts`, `routes/alerts.ts`, etc.) |
| **Session-based auth** | Cookie sessions don't work for mobile apps, can't scale horizontally without sticky sessions. | **JWT + refresh tokens** via Better Auth or Lucia Auth |
| **bcryptjs** | Works but `argon2` is the 2026 standard (winner of Password Hashing Competition). | **Argon2id** |
| **HTTP polling for real-time** | 10-15s latency is poor for live sports. Wastes bandwidth with constant requests. | **Server-Sent Events (SSE)** for alert streaming. WebSockets only if bidirectional needed. |
| **setInterval background jobs** | No retry, no dead-letter queue, no graceful shutdown for job failures. | **BullMQ** (Redis-backed job queue) or **Trigger.dev** |
| **In-memory game state** | GameStateManager state lost on server restart. Can't scale horizontally. | **Redis** for game state cache + pub/sub for multi-instance |
| **Ad-hoc input validation** | Validation scattered in route handlers. | **Zod middleware** consistently on all routes, or **tRPC** for end-to-end type safety |
| **GameStateManager** | Creates new API instances per poll, all state in memory, singleton via module export. | Proper DI container, Redis-backed state, reusable service instances |
| **GamblingInsightsComposer (1,345 lines)** | Complex string concatenation. Brittle templates. | Structured template system with composable sections. Consider more LLM-based generation. |
| **storage.ts (1,156 lines)** | Monolithic data access. Some raw SQL mixed with Drizzle. | Split into repository pattern (`UserRepository`, `AlertRepository`, etc.) |
| **Wouter** | Missing features: nested layouts, data loaders, error boundaries per route. | **TanStack Router** (type-safe, data loaders, search params) or **React Router 7** |
| **React 18** | Works but React 19 has been stable since 2025. | **React 19** (use() hook, server components readiness, improved Suspense) |
| **Zero tests** | Impossible to refactor safely. Jest installed but unused. | **Vitest** (faster than Jest, native ESM). **Playwright** for E2E. Target 80% on services. |
| **No CI/CD** | No automated testing, linting, or deployment pipeline. | **GitHub Actions**: lint -> test -> build -> deploy on push |
| **No linting** | Code style inconsistency, no error prevention. | **Biome** (2026 standard -- replaces ESLint + Prettier, 100x faster) |
| **No monitoring/observability** | UnifiedHealthMonitor exists but no external visibility. | **OpenTelemetry** + **Sentry** for error tracking. Ship Pino logs to a service. |
| **No rate limiting on endpoints** | API endpoints completely unprotected. | Rate limiting middleware (built into Hono, or express-rate-limit) |
| **No API versioning** | Breaking changes break all clients. | `/api/v1/` prefix with versioning strategy |
| **Replit-only deployment** | Vendor lock-in, limited scaling options, cold starts. | **Docker** + **Railway** or **Fly.io** for containerized deployment |
| **Single tsconfig** | Client and server share one config. | Separate `tsconfig.server.json` and `tsconfig.client.json` |
| **Only MLB engine active** | 5 of 6 sport engines disabled. | Re-enable all sport engines. Fix the issues that caused them to be disabled. |
| **Unused deps** | ws, memorystore, ~15 shadcn components. | Audit and remove all unused dependencies |
| **No web push notifications** | Only Telegram. No browser notifications. | **Web Push API** + **Service Worker** for browser push |
| **No .env.example** | New developers can't onboard. | Create `.env.example` with all required/optional vars |

---

## 16. 2026 STANDARDS RECOMMENDATIONS

### If Starting Over: Recommended Stack

```
Runtime:        Bun 1.2+ (or Node 22 LTS)
Language:       TypeScript 5.7+
Server:         Hono (or tRPC for end-to-end type safety)
Database:       PostgreSQL (Neon) -- KEEP
ORM:            Drizzle -- KEEP
Cache/State:    Redis (Upstash for serverless)
Auth:           Better Auth or Lucia Auth (Argon2id, JWT + refresh)
Real-time:      SSE for alerts, WebSocket for live game state
Jobs:           BullMQ (Redis) or Trigger.dev
Validation:     Zod -- KEEP
AI:             OpenAI GPT-4o -- KEEP (consider Claude for some tasks)
Frontend:       React 19
Routing:        TanStack Router (type-safe)
State:          TanStack Query v5 -- KEEP
Build:          Vite 6 -- KEEP (upgrade)
CSS:            Tailwind CSS 4 (new engine)
Components:     shadcn/ui -- KEEP (audit unused)
Animation:      Framer Motion -- KEEP
Logging:        Pino -- KEEP
Security:       Helmet -- KEEP
Testing:        Vitest + Playwright
Linting:        Biome
CI/CD:          GitHub Actions
Monitoring:     OpenTelemetry + Sentry
Deployment:     Docker + Railway/Fly.io
```

### Priority Order for Rebuild

**Phase 1: Foundation (Week 1-2)**
1. Set up monorepo structure (Turborepo or pnpm workspaces)
2. Biome linting + formatting
3. Vitest testing framework with initial test suite
4. GitHub Actions CI pipeline (lint -> test -> build)
5. Docker containerization
6. Split tsconfig (client/server)
7. Create `.env.example`

**Phase 2: Server Core (Week 2-4)**
1. Replace Express with Hono
2. Split routes.ts (5,213 lines) into route modules
3. Split storage.ts (1,156 lines) into repositories
4. Implement proper DI container
5. Replace session auth with JWT (Better Auth or Lucia)
6. Add Redis for game state + job queue (Upstash)
7. Implement SSE for real-time alerts
8. Add rate limiting + consistent Zod validation middleware
9. Add API versioning (`/api/v1/`)

**Phase 3: Alert Engine (Week 4-5)**
1. Re-enable all 6 sport engines (fix whatever disabled them)
2. Add BullMQ for background game polling jobs
3. Move game state from memory to Redis
4. Add dead-letter queue for failed alerts
5. Refactor GamblingInsightsComposer into composable template sections
6. Add retry/recovery for AI processor failures

**Phase 4: Client (Week 5-7)**
1. Upgrade to React 19
2. Replace Wouter with TanStack Router
3. Implement SSE client for real-time alerts (replace polling)
4. Add Web Push notifications via Service Worker
5. Add error boundaries per route
6. Audit and remove unused shadcn/ui components
7. Upgrade Tailwind to v4

**Phase 5: Quality & Deploy (Week 7-8)**
1. Write unit tests for all alert cylinder modules (target 80%+)
2. Write integration tests for API routes
3. Add Playwright E2E tests for critical flows (auth, monitor game, receive alert)
4. Set up Sentry error tracking
5. Add OpenTelemetry instrumentation
6. Ship Pino logs to aggregation service
7. Deploy to Railway/Fly.io with Docker
8. Add health checks + readiness probes
9. Set up staging environment

### What to Carry Forward As-Is
- All Drizzle schema definitions
- All 94 alert cylinder modules (the core IP)
- BaseSportEngine + sport engine implementations
- MLB probability model
- Sport API services (refactor, don't rewrite)
- OddsApiService
- CalendarSyncService concept
- Broadcast alert pattern + sequence number polling
- Telegram delivery service
- UnifiedAIProcessor (refactor the 2,032 lines, keep the logic)
- Pino logging
- Helmet + circuit breaker middleware
- Team logo mappings
- Season manager
- React Query hooks and patterns

### What to Delete
- `ws` package (unused)
- `memorystore` (unused)
- Unused shadcn/ui components (~15)
- Demo/mock data in client pages
- `theme.json` (inline into tailwind config)
- Any `alert-engine.ts` / `notification-service.ts` stubs superseded by cylinder architecture
