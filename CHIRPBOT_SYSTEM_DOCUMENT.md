# CHIRPBOT COMPLETE SYSTEM DOCUMENT

**Date:** March 7, 2026
**Codebase Size:** ~51,000 lines of TypeScript across 191 files
**Test Coverage:** 0% (zero test files exist)
**CI/CD:** None
**Linting:** None

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Server Architecture](#3-server-architecture)
4. [Client Architecture](#4-client-architecture)
5. [Core Pipeline: Game State to Alert to User](#5-core-pipeline)
6. [Database Layer](#6-database-layer)
7. [External API Integrations](#7-external-api-integrations)
8. [Authentication System](#8-authentication-system)
9. [Real-Time Architecture](#9-real-time-architecture)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Shared Code](#11-shared-code)
12. [Complete File Inventory](#12-complete-file-inventory)
13. [Verdict: Keep vs Replace](#13-verdict-keep-vs-replace)
14. [2026 Standards Recommendations](#14-2026-standards-recommendations)

---

## 1. SYSTEM OVERVIEW

Chirpbot is a real-time sports alert platform that monitors live games across 6 sports (MLB, NFL, NCAAF, NBA, WNBA, CFL), detects significant in-game events (momentum shifts, scoring surges, close games, etc.), enriches them with gambling odds and weather data, and delivers alerts to users via a web dashboard.

### Core Loop

```
Sport APIs (MLB/ESPN) --> CalendarSyncService (schedules every 5min)
                              |
                              v
                     GameStateManager (polls live data every 30s)
                              |
                              v
                        AlertEngine (detects events, scores confidence)
                              |
                              v
                  GamblingInsightsComposer (enriches with odds + weather)
                              |
                              v
                    broadcast_alerts table (PostgreSQL)
                              |
                              v
                  /api/alerts/snapshot (client polls every 10-15s)
                              |
                              v
                        User Dashboard
```

---

## 2. TECHNOLOGY STACK

| Layer | Current | Version |
|-------|---------|---------|
| Runtime | Node.js | 20 |
| Language | TypeScript | 5.6.3 |
| Server Framework | Express | 4.21.2 |
| Database | PostgreSQL (Neon Serverless) | - |
| ORM | Drizzle | 0.39.3 |
| Frontend Framework | React | 18.3.1 |
| Build Tool | Vite | 6.0.0 |
| CSS Framework | Tailwind CSS | 3.4.17 |
| UI Components | shadcn/ui + Radix UI | various |
| Data Fetching | TanStack React Query | 5.62.11 |
| Routing (Client) | Wouter | 3.5.0 |
| Animation | Framer Motion | 11.15.0 |
| Auth | bcrypt + express-session | - |
| Session Store | connect-pg-simple (PostgreSQL) | 10.0.0 |
| Deployment | Replit | - |
| Testing | None | - |
| CI/CD | None | - |
| Linting | None | - |

### Installed but Unused Dependencies
- `passport` / `passport-local` -- listed in package.json but auth uses manual bcrypt + session
- `ws` -- WebSocket library installed but no WebSocket implementation exists
- `memorystore` -- fallback session store, likely unused with pg sessions
- Several shadcn/ui components (~15 of 33) appear unused

---

## 3. SERVER ARCHITECTURE

### Entry Point

**`server/index.ts`** (66 lines) -- Creates Express app, registers routes, starts HTTP server on port 5000.
**`server/main.ts`** (11 lines) -- Simple wrapper that imports and runs index.ts.

### Routes (`server/routes.ts` -- 2,786 lines)

This single file contains ALL route definitions, middleware, service initialization, and helper functions.

#### Authentication
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/register` | No | Create user (bcrypt hash) |
| POST | `/api/login` | No | Login, create session |
| POST | `/api/logout` | Yes | Destroy session |
| GET | `/api/user` | Yes | Get current user |

#### Games
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/games/today` | No | Games by sport + date (from CalendarSyncService) |
| GET | `/api/games/:gameId/live` | No | Live game data (MLBApiService) |
| GET | `/api/games/calendar-status` | No | Calendar sync status |
| GET | `/api/server-date` | No | Server's Pacific timezone date |
| GET | `/api/games/multi-day` | No | Multi-day game schedule |

#### User Monitored Games
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/:userId/monitored-games` | Yes | List monitored games |
| POST | `/api/user/:userId/monitored-games` | Yes | Add game to monitor |
| DELETE | `/api/user/:userId/monitored-games/:gameId` | Yes | Remove monitored game |

#### Alerts
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/alerts/snapshot` | Yes | Broadcast alerts filtered by user's monitored games + preferences |
| GET | `/api/alerts/stats` | No | Alert statistics |
| GET | `/api/alerts/count` | No | Simple alert count |
| GET | `/api/alerts` | Yes | Alert list with limit param |

#### User Settings
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/:userId/settings` | Yes | Get settings |
| PUT | `/api/user/:userId/settings` | Yes | Update settings |
| GET | `/api/user/:userId/settings/gambling` | Yes | Get gambling settings |
| PUT | `/api/user/:userId/settings/gambling` | Yes | Update gambling settings |
| GET | `/api/user/:userId/alert-preferences` | Yes | Get alert preferences by sport |
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

### Services

#### AlertEngine (`server/services/alert-engine.ts` -- 1,093 lines)
Core alert detection engine. Processes game state updates and generates alerts.

**Alert Types Detected:**
| Type | Detection Logic |
|------|----------------|
| `momentum_shift` | Consecutive scoring events, scoring runs |
| `scoring_surge` | Rapid scoring (3+ runs in an inning, etc.) |
| `close_game` | Score within 1-2 points in late game |
| `blowout` | Large score differential |
| `comeback_alert` | Team overcoming significant deficit |
| `base_situation` | Runners in scoring position, bases loaded (MLB) |
| `pitcher_change` | Pitching changes, bullpen usage (MLB) |
| `weather_impact` | Weather conditions affecting play |

**Key Features:**
- Deduplication via alert keys + cooldown periods (3-10 minutes per type)
- Confidence scoring (0-100) based on game context
- Broadcasts alerts to `broadcast_alerts` table

#### GameStateManager (`server/services/game-state-manager.ts` -- 858 lines)
Singleton that manages live game state tracking and user-game associations.

**Data Structures:**
```
gameStates:     Map<gameId, GameState>       -- current state per game
userGames:      Map<userId, Set<gameId>>     -- which games each user monitors
gameUsers:      Map<gameId, Set<userId>>     -- which users monitor each game
previousStates: Map<gameId, GameState>       -- for diff detection
```

**Key Behavior:**
- Polls live game data every 30 seconds for monitored games
- Compares current vs previous state to detect changes
- Feeds changed states into AlertEngine
- Creates new API service instances on every poll cycle (no reuse)
- All state lives in memory -- lost on server restart

#### GamblingInsightsComposer (`server/services/gambling-insights-composer.ts` -- 1,345 lines)
The largest service. Combines alert + game state + weather + odds into rich gambling insights.

**Produces:**
- Situation summary (what happened)
- Market impact analysis
- Edge analysis (potential value plays)
- Risk assessment with confidence

#### OddsApiService (`server/services/odds-api-service.ts` -- 380 lines)
Integration with The Odds API (`api.the-odds-api.com/v4`).

**Key Details:**
- Rate limit: 450 requests per 30 days
- Cache: 5-minute fresh, 10-minute stale fallback
- Bookmaker priority: DraftKings > FanDuel > BetMGM > Caesars > any
- Markets: moneyline (h2h), spreads, totals
- Data quality scoring: excellent/good/limited/poor
- User-provided API keys supported

#### CalendarSyncService (`server/services/calendar-sync-service.ts` -- 484 lines)
Singleton that pre-fetches game schedules every 5 minutes to avoid rate limiting sport APIs.
- Syncs today + tomorrow for all sports
- In-memory cache
- Used by `/api/games/today` endpoint

#### BaseSportApi (`server/services/base-sport-api.ts` -- 489 lines)
Abstract base class for all sport API integrations.
- HTTP request wrapper with retry (3 retries, exponential backoff)
- In-memory cache with configurable TTL (default 60s)
- Rate limiting per service
- Abstract methods: `getGames()`, `getLiveGameData()`, `parseGameData()`

#### Sport-Specific APIs
| Service | File | Lines | External API |
|---------|------|-------|-------------|
| MLBApiService | `mlb-api.ts` | 724 | `statsapi.mlb.com/api/v1/` |
| NFLApiService | `nfl-api.ts` | 365 | ESPN `site.api.espn.com` |
| NCAAFApiService | `ncaaf-api.ts` | 295 | ESPN |
| NBAApiService | `nba-api.ts` | 310 | ESPN |
| WNBAApiService | `wnba-api.ts` | 265 | ESPN |
| CFLApiService | `cfl-api.ts` | 248 | ESPN |

MLB uses MLB's official Stats API. All other sports use ESPN's public scoreboard API.

#### WeatherService (`server/services/weather-service.ts` -- 245 lines)
OpenWeatherMap integration with stadium coordinate mapping (30+ MLB stadiums, some NFL/NBA venues). 30-minute cache TTL.

#### Other Services
| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| TeamLogoService | `team-logo-service.ts` | 156 | Maps team names to ESPN CDN logo URLs (~124 teams) |
| TimeoutPossessionTracker | `timeout-possession-tracker.ts` | 312 | Tracks timeouts + possession for football sports |
| NotificationService | `notification-service.ts` | 178 | Stub/basic notification delivery (partially implemented) |

### Storage Layer (`server/storage.ts` -- 494 lines)

Implements `IStorage` interface using Drizzle ORM against Neon PostgreSQL.

**Key Methods:**
- User CRUD: `getUser()`, `getUserByUsername()`, `createUser()`
- Alerts: `createAlert()`, `getAlerts()`, `getRecentAlerts()`, `getAlertsByType()`
- Broadcast Alerts: `createBroadcastAlert()`, `getBroadcastAlertsSince()`
- Monitored Games: `getUserMonitoredTeams()`, `addUserMonitoredTeam()`, `removeUserMonitoredTeam()`
- Settings: `getUserSettings()`, `updateUserSettings()`, `getUserAlertPreferences()`, `setUserAlertPreference()`

**Issues:**
- Some raw SQL mixed with Drizzle query builder
- No connection pooling configuration
- No transaction support for multi-step operations

---

## 4. CLIENT ARCHITECTURE

### Entry Point & Providers

**`client/src/main.tsx`** (43 lines) -- React root render with global error handlers.
**`client/src/App.tsx`** (107 lines) -- Provider stack + routing.

**Provider Stack:**
```
QueryClientProvider (React Query)
  -> TooltipProvider (Radix)
    -> AuthProvider (custom context)
      -> Toaster (sonner)
        -> Routes
```

### Routing (Wouter)

| Path | Component | Auth |
|------|-----------|------|
| `/` | Landing | No |
| `/login` | Login | No (redirects if authed) |
| `/signup` | Signup | No (redirects if authed) |
| `/dashboard` | Dashboard | Yes |
| `/calendar` | Calendar | Yes |
| `/alerts` | Alerts | Yes |
| `/settings` | Settings | Yes |
| `/game/:gameId` | GameNarrative | Yes |
| `*` | NotFound | No |

### Pages

| Page | File | Lines | Key API Calls | Polling |
|------|------|-------|---------------|---------|
| Dashboard | `dashboard.tsx` | 545 | alerts, stats, monitored-games | 15s/30s/60s |
| Landing | `landing.tsx` | 730 | None (static marketing) | -- |
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
| BottomNavigation | `bottom-navigation.tsx` | 126 | Mobile bottom nav with alert badge |
| TeamLogo | `team-logo.tsx` | 912 | Team logos with ESPN CDN fallback, 370+ team mappings |
| SportsLoading | `sports-loading.tsx` | 317 | Sport-specific loading spinners |
| PageHeader | `PageHeader.tsx` | ~40 | Sticky page header |
| ChirpBotLogo | `ChirpBotLogo.tsx` | ~30 | App logo |
| BaseballDiamond | `baseball-diamond.tsx` | ~50 | MLB diamond with runner indicators |
| ErrorDisplay | `EnhancedErrorDisplay.tsx` | ~80 | Error boundary + formatted errors |
| RetryFeedback | `RetryFeedback.tsx` | ~50 | Retry state UI |

### UI Component Library (shadcn/ui)
33 files, ~2,700 lines total. Copy-pasted components (not npm). Includes: button, card, dialog, dropdown-menu, input, select, tabs, toast, tooltip, badge, switch, form, accordion, alert-dialog, avatar, calendar, carousel, chart, checkbox, collapsible, command, drawer, input-otp, pagination, popover, progress, radio-group, resizable, scroll-area, separator, skeleton, slider, textarea.

~15 of these appear unused.

### Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| useAuth | `useAuth.ts` | 75 | Auth context: user, isLoading, isAuthenticated, isAdmin |
| useGamesAvailability | `useGamesAvailability.ts` | 43 | Check available games across sports |
| useToast | `use-toast.ts` | 189 | Toast notification queue |
| useMobile | `use-mobile.tsx` | 19 | Mobile viewport detection |
| useAlertSound | `use-alert-sound.ts` | ~30 | Play sound on alerts |

### State Management

**Primary:** TanStack React Query v5 for all server state.
**Client State:** React Context (auth only). No Zustand/Redux/Jotai.

**Query Client Config:**
- `staleTime: 30s`
- `gcTime: 5min`
- `refetchOnWindowFocus: false`
- `retry: 3` with exponential backoff (1s, 2s, 4s max 10s)
- Only retries 5xx, 408, 429 errors

### Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `queryClient.ts` | 167 | React Query setup, `apiRequest()` with retry |
| `utils.ts` | 6 | `cn()` class name merge |
| `team-utils.ts` | 157 | Team abbreviations, nicknames, `timeAgo()`, sport accent colors |
| `error-messages.ts` | 338 | Context-aware API error parsing |
| `alert-message.ts` | ~50 | Alert text formatting |
| `clean-alert-formatter.ts` | ~50 | Clean alert text for Telegram |

### Types (`client/src/types/index.ts` -- 220 lines)
Key interfaces: `Team`, `Alert` (with nested context, gambling insights, weather), `Settings`, `User`.

---

## 5. CORE PIPELINE

### Step 1: Schedule Sync
`CalendarSyncService` runs every 5 minutes:
- Calls each sport API's `getGames(today)` and `getGames(tomorrow)`
- Stores results in memory Map keyed by sport
- `/api/games/today` reads from this cache (not directly from APIs)

### Step 2: User Monitors a Game
- User clicks "Monitor" on Calendar page
- Client: `POST /api/user/:userId/monitored-games` with gameId, sport, teams
- Server: Inserts into `userMonitoredTeams` table
- Server: Calls `gameStateManager.addUserToGame(gameId, userId)`
- GameStateManager: Adds to `userGames` and `gameUsers` maps, triggers initial fetch

### Step 3: Live Polling
`GameStateManager.pollAllGames()` runs every 30 seconds:
- Gets all active gameIds from `gameUsers` map
- For each game: determines sport, creates API service instance, calls `getLiveGameData(gameId)`
- Compares new state vs previous state
- If changes detected: calls `alertEngine.processGameState(newState)`

### Step 4: Alert Detection
`AlertEngine.processGameState(gameState)`:
- Runs 8 detection methods (momentum, scoring, close game, blowout, comeback, base situation, pitcher change, weather)
- Each detector returns alerts with confidence scores
- Deduplication: generates alert key, checks against recent alerts + cooldown
- New alerts are broadcast via `storage.createBroadcastAlert()`

### Step 5: Gambling Enrichment
When alerts are generated or when client requests `/api/gambling/insights/:gameId`:
- `GamblingInsightsComposer` combines: alert + game state + weather + odds
- Odds fetched from `OddsApiService` (if user has API key and rate limit allows)
- Produces structured template with situation, market impact, edge analysis

### Step 6: Client Consumption
- Dashboard polls `/api/alerts/snapshot?seq=N` every 15 seconds
- Server filters `broadcast_alerts` by: user's monitored game IDs + user's alert preferences
- Returns only new alerts since last sequence number
- Client renders alerts in Command Center, Signal Log, etc.

---

## 6. DATABASE LAYER

### ORM & Driver
- **Drizzle ORM** v0.39.3 with `drizzle-kit` for schema management
- **Neon Serverless** PostgreSQL driver (`@neondatabase/serverless`)
- Schema push workflow (`npm run db:push`) -- no migration files

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| username | varchar | Unique |
| password | varchar | bcrypt hash |
| createdAt | timestamp | Default now() |

#### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| gameId | varchar | Game identifier |
| type | varchar | Alert type enum |
| title | varchar | Alert title |
| message | text | Alert message |
| sport | varchar | Sport code |
| score | integer | Confidence score |
| payload | jsonb | Full alert data |
| createdAt | timestamp | Default now() |

#### `broadcast_alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| gameId | varchar | Game identifier |
| alertKey | varchar | Dedup key |
| type | varchar | Alert type |
| sport | varchar | Sport code |
| score | integer | Confidence score |
| payload | jsonb | Full alert data |
| sequenceNumber | serial | Auto-increment for incremental polling |
| createdAt | timestamp | Default now() |

#### `userMonitoredTeams`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| userId | varchar | FK to users |
| gameId | varchar | Game identifier |
| sport | varchar | Sport code |
| homeTeamName | varchar | Home team |
| awayTeamName | varchar | Away team |
| createdAt | timestamp | Default now() |

#### `userSettings`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| userId | varchar | FK to users |
| settings | jsonb | All settings as JSON blob |
| createdAt | timestamp | Default now() |
| updatedAt | timestamp | Auto-update |

#### `userAlertPreferences`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| userId | varchar | FK to users |
| sport | varchar | Sport code |
| alertType | varchar | Alert type |
| enabled | boolean | Toggle |
| createdAt | timestamp | Default now() |

#### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| sid | varchar PK | Session ID |
| sess | json | Session data |
| expire | timestamp | Expiry time |

### Alert Type Enum Values
`momentum_shift`, `scoring_surge`, `pitcher_change`, `base_situation`, `close_game`, `blowout`, `weather_impact`, `injury_update`, `comeback_alert`, `record_watch`, `rivalry_alert`, `playoff_implications`

---

## 7. EXTERNAL API INTEGRATIONS

| Service | Base URL | Used For | Auth | Rate Limit |
|---------|----------|----------|------|-----------|
| MLB Stats API | `statsapi.mlb.com/api/v1/` | MLB schedules, live data, play-by-play | None (public) | Respectful polling |
| ESPN API | `site.api.espn.com/apis/site/v2/sports/` | NFL, NCAAF, NBA, WNBA, CFL scores | None (public) | Respectful polling |
| The Odds API | `api.the-odds-api.com/v4/` | Betting odds (moneyline, spreads, totals) | API key (user-provided) | 450 req/30 days |
| OpenWeatherMap | `api.openweathermap.org/data/2.5/` | Weather at stadiums | API key (env var) | Standard tier |
| ESPN CDN | `a.espncdn.com/` | Team logos | None (public) | None |

---

## 8. AUTHENTICATION SYSTEM

### Server Side
- **Method:** Session-based with `express-session`
- **Password:** bcrypt hashing (salt rounds in code)
- **Session Store:** PostgreSQL via `connect-pg-simple`
- **Session Config:** 24-hour expiry, `sameSite: 'lax'`, `secure: false` in dev
- **Middleware:** `requireAuthentication` checks `req.session.userId`
- **Unused:** passport and passport-local are installed but not wired up

### Client Side
- `useAuth()` hook queries `GET /api/auth/user` (cached 5 min)
- Two-tier check: regular user first, then admin session
- `ProtectedRoute` component redirects to `/` if not authenticated
- All API calls include `credentials: 'include'` for cookie passthrough
- Login/signup via `useMutation` with redirect on success

---

## 9. REAL-TIME ARCHITECTURE

### Current: HTTP Polling (No WebSockets, No SSE)

**Server-side polling:**
- GameStateManager polls sport APIs every 30 seconds
- CalendarSyncService syncs schedules every 5 minutes

**Client-side polling:**
- Dashboard: alerts every 15s, stats every 60s, monitored games every 30s
- Alerts page: alerts every 30s, stats every 60s
- Game Narrative: alerts every 10s

**Incremental Updates:**
- `broadcast_alerts` table has auto-incrementing `sequenceNumber`
- Client sends `?seq=N` to get only alerts newer than N
- Efficient incremental polling without timestamp drift issues

**Issues:**
- `ws` package installed but no WebSocket server or client code exists
- No SSE implementation
- Polling at 10-15s intervals = up to 15s latency for real-time sports events
- Each poll is a full HTTP request/response cycle with auth check + DB query

---

## 10. INFRASTRUCTURE & DEPLOYMENT

### Platform: Replit
```
run = "npm run dev"
entrypoint = "server/index.ts"
modules = ["nodejs-20:v8-20230920-bd784b9"]
[deployment]
  run = ["sh", "-c", "npm run start"]
  build = ["sh", "-c", "npm run build"]
[[ports]]
  localPort = 5000
  externalPort = 80
```

### Build Pipeline
```bash
# Development
npm run dev    # tsx server/main.ts (runs TypeScript directly)

# Production build
npm run build  # vite build (client) && esbuild (server) -> dist/
npm run start  # NODE_ENV=production node dist/index.js
```

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `PORT` | No | Server port (default 5000) |
| `NODE_ENV` | No | Environment mode |
| `OPENWEATHERMAP_API_KEY` | No | Weather data |

**No `.env.example` file exists.**

### What's Missing
- No Docker/containerization
- No CI/CD pipeline (no GitHub Actions, no deploy scripts)
- No ESLint/Prettier/Biome
- No `.editorconfig`
- No health check beyond basic `/api/health`
- No monitoring/observability (no metrics, no structured logging, no error tracking)
- No rate limiting on API endpoints (only on outbound API calls)

---

## 11. SHARED CODE

### `shared/schema.ts` (417 lines)
- Drizzle ORM table definitions
- Zod validation schemas (`insertUserSchema`, `insertAlertSchema`, etc.)
- TypeScript types exported for both client and server

### `shared/season-manager.ts` (205 lines)
- Determines which sports are currently in-season
- Season date ranges for all 6 sports
- Used by client to show relevant sport tabs
- Used by server to prioritize polling

---

## 12. COMPLETE FILE INVENTORY

### Server (~/server/)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 66 | Server bootstrap |
| `main.ts` | 11 | Entry wrapper |
| `routes.ts` | 2,786 | ALL route definitions + middleware + helpers |
| `storage.ts` | 494 | Database layer (Drizzle) |
| `vite.ts` | 67 | Vite dev server integration |
| `services/alert-engine.ts` | 1,093 | Alert detection engine |
| `services/game-state-manager.ts` | 858 | Live game state tracking |
| `services/gambling-insights-composer.ts` | 1,345 | Gambling insight generation |
| `services/base-sport-api.ts` | 489 | Abstract sport API base class |
| `services/mlb-api.ts` | 724 | MLB Stats API integration |
| `services/nfl-api.ts` | 365 | NFL via ESPN |
| `services/ncaaf-api.ts` | 295 | NCAAF via ESPN |
| `services/nba-api.ts` | 310 | NBA via ESPN |
| `services/wnba-api.ts` | 265 | WNBA via ESPN |
| `services/cfl-api.ts` | 248 | CFL via ESPN |
| `services/odds-api-service.ts` | 380 | The Odds API integration |
| `services/calendar-sync-service.ts` | 484 | Schedule pre-fetching |
| `services/weather-service.ts` | 245 | OpenWeatherMap integration |
| `services/team-logo-service.ts` | 156 | Team logo URL mapping |
| `services/timeout-possession-tracker.ts` | 312 | Football timeout/possession tracking |
| `services/notification-service.ts` | 178 | Notification stub |

**Server Total: ~10,171 lines**

### Client (~/client/src/)

| File | Lines | Purpose |
|------|-------|---------|
| `main.tsx` | 43 | React root + global error handlers |
| `App.tsx` | 107 | Providers + routing |
| `pages/dashboard.tsx` | 545 | Main dashboard |
| `pages/landing.tsx` | 730 | Marketing landing page |
| `pages/login.tsx` | 250 | Login form |
| `pages/signup.tsx` | 330 | Registration form |
| `pages/alerts.tsx` | 651 | Alert feed + filtering |
| `pages/calendar.tsx` | 533 | Game browsing + monitoring |
| `pages/settings.tsx` | 2,500+ | User settings |
| `pages/game-narrative.tsx` | 289 | Live game timeline |
| `pages/not-found.tsx` | ~20 | 404 page |
| `components/bottom-navigation.tsx` | 126 | Mobile bottom nav |
| `components/team-logo.tsx` | 912 | Team logos (370+ mappings) |
| `components/sports-loading.tsx` | 317 | Loading spinners |
| `components/ui/*.tsx` | ~2,700 | shadcn/ui (33 files) |
| `hooks/useAuth.ts` | 75 | Auth hook |
| `hooks/useGamesAvailability.ts` | 43 | Games availability |
| `hooks/use-toast.ts` | 189 | Toast system |
| `lib/queryClient.ts` | 167 | React Query setup |
| `lib/utils.ts` | 6 | cn() helper |
| `utils/team-utils.ts` | 157 | Team utilities |
| `utils/error-messages.ts` | 338 | Error parsing |
| `types/index.ts` | 220 | TypeScript interfaces |

**Client Total: ~10,200 lines (excl. shadcn/ui: ~7,500)**

### Shared

| File | Lines | Purpose |
|------|-------|---------|
| `shared/schema.ts` | 417 | DB schema + Zod + types |
| `shared/season-manager.ts` | 205 | Season management |

### Config Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies + scripts |
| `tsconfig.json` | TypeScript config (single for client + server) |
| `vite.config.ts` | Vite build config |
| `drizzle.config.ts` | Drizzle ORM config |
| `tailwind.config.ts` | Tailwind CSS config |
| `postcss.config.js` | PostCSS config |
| `theme.json` | shadcn/ui theme |
| `.replit` | Replit deployment config |

---

## 13. VERDICT: KEEP vs REPLACE

### KEEP (Solid foundations, 2026-ready or close)

| System | Why Keep |
|--------|----------|
| **Drizzle ORM + Neon PostgreSQL** | Drizzle is the modern standard. Neon serverless is excellent. Schema is clean. |
| **TanStack React Query v5** | Industry standard for server state. Configuration is solid. |
| **Vite 6** | Current, fast, excellent DX. No change needed. |
| **Tailwind CSS** | Industry standard. Config is fine. |
| **shadcn/ui + Radix** | Correct approach (copy components, not npm). Just audit unused ones. |
| **TypeScript** | Obviously keep. Upgrade to 5.7+ for latest features. |
| **The base-sport-api pattern** | Abstract base class with retry + cache + rate limiting is sound architecture. |
| **Sport-specific API services** | MLBApiService, NFLApiService, etc. are well-structured. Minor cleanup needed. |
| **OddsApiService** | Rate limiting, caching, bookmaker priority -- all well-designed. |
| **CalendarSyncService** | Smart approach to avoid rate limiting. Keep the concept. |
| **Broadcast alert architecture** | Store once, filter per-user at query time. Efficient and correct. |
| **Sequence number polling** | Incremental updates via auto-incrementing seq. Clean pattern. |
| **Shared schema** | Drizzle + Zod in shared/ for both client and server. Good pattern. |
| **Season manager** | Simple, useful, correct. |
| **Team logo system** | ESPN CDN fallback approach works well. |

### REPLACE (Tech debt, outdated patterns, or fundamentally broken)

| System | Why Replace | 2026 Recommendation |
|--------|-------------|---------------------|
| **Express 4** | Express 5 is stable. But consider **Hono** -- it's the 2026 standard for TypeScript backends. Faster, smaller, better typed, built-in middleware. | **Hono** or **Express 5** |
| **Monolithic routes.ts (2,786 lines)** | Single file with all routes, middleware, service init, helpers. Unmaintainable. | Split into route modules (`routes/auth.ts`, `routes/games.ts`, `routes/alerts.ts`, etc.) with a clean router pattern |
| **Session-based auth** | Cookie sessions don't work for mobile apps, can't scale horizontally without sticky sessions. | **JWT + refresh tokens** (or Lucia Auth / Better Auth for 2026) |
| **express-session + connect-pg-simple** | Tight coupling to PostgreSQL sessions table. | JWT eliminates session storage entirely, or use Redis for sessions |
| **bcrypt password hashing** | Works but `argon2` is the 2026 standard (winner of Password Hashing Competition, more resistant to GPU attacks). | **Argon2id** |
| **HTTP polling for real-time** | 10-15s latency is unacceptable for live sports. Wastes bandwidth. | **Server-Sent Events (SSE)** for alert streaming. WebSockets only if bidirectional needed. |
| **setInterval background jobs** | No retry, no dead-letter queue, no graceful shutdown, no monitoring. | **BullMQ** (Redis-backed job queue) or **Trigger.dev** for background jobs |
| **In-memory game state** | Lost on server restart. Can't scale horizontally. | **Redis** for game state cache (pub/sub for multi-instance) |
| **No input validation middleware** | Ad-hoc validation in route handlers. | **Zod middleware** (already have Zod) or **tRPC** for end-to-end type safety |
| **GameStateManager singleton** | Creates new API instances per poll, all state in memory, no DI. | Proper dependency injection, Redis-backed state, reusable service instances |
| **AlertEngine (1,093 lines in one class)** | All detection logic crammed into one class. Sport-specific logic mixed with generic. | Split into detector plugins: `MomentumDetector`, `ScoringSurgeDetector`, etc. Strategy pattern. |
| **GamblingInsightsComposer (1,345 lines)** | Largest file. Complex string concatenation. Brittle. | Structured template system with composable sections. Consider LLM-based insight generation. |
| **Wouter router** | Lightweight but missing features needed at scale: nested layouts, data loaders, error boundaries per route. | **TanStack Router** (type-safe, data loaders, search params) or **React Router 7** |
| **No testing** | Zero test files. Impossible to refactor safely. | **Vitest** for unit/integration tests. **Playwright** for E2E. Minimum 80% coverage on services. |
| **No CI/CD** | No automated testing, linting, or deployment. | **GitHub Actions**: lint -> test -> build -> deploy on push |
| **No linting** | No ESLint, Prettier, or Biome. | **Biome** (2026 standard -- replaces ESLint + Prettier in one tool, 100x faster) |
| **No monitoring/observability** | No structured logging, no error tracking, no metrics. | **OpenTelemetry** + **Sentry** for error tracking. Structured JSON logging. |
| **No rate limiting on endpoints** | API endpoints have no rate limiting. | **Rate limiting middleware** (express-rate-limit or built into Hono) |
| **No API versioning** | All routes under `/api/`. Breaking changes break all clients. | `/api/v1/` prefix with versioning strategy |
| **Replit-only deployment** | Vendor lock-in, limited scaling, cold starts. | **Docker** + **Railway** or **Fly.io** for containerized deployment. Or Vercel for the frontend + separate API. |
| **Single tsconfig** | Client and server share one config. | Separate `tsconfig.server.json` and `tsconfig.client.json` |
| **Unused dependencies** | passport, passport-local, ws, memorystore, ~15 shadcn/ui components. | Audit and remove all unused deps |
| **NotificationService (stub)** | Partially implemented, does nothing useful. | **Web Push API** + **Telegram Bot API** (properly implemented) + **Email via Resend** |
| **React 18** | Works fine but React 19 has been stable since 2025. | **React 19** (use() hook, server components readiness, improved Suspense) |
| **No error boundaries** | Only one ErrorBoundary exists (in alerts). | Error boundaries per route/section |

---

## 14. 2026 STANDARDS RECOMMENDATIONS

### Architecture: If Starting Over

```
RECOMMENDED STACK (2026)
========================

Runtime:        Bun 1.2+ (or Node 22 LTS)
Language:       TypeScript 5.7+
Server:         Hono (or tRPC for end-to-end type safety)
Database:       PostgreSQL (Neon) -- keep
ORM:            Drizzle -- keep
Cache/State:    Redis (Upstash for serverless)
Auth:           Better Auth or Lucia Auth (Argon2id, JWT + refresh)
Real-time:      SSE for alerts, WebSocket for live game state
Jobs:           BullMQ (Redis) or Trigger.dev
Validation:     Zod -- keep (already have it)
Frontend:       React 19
Routing:        TanStack Router (type-safe)
State:          TanStack Query v5 -- keep
Build:          Vite 6 -- keep
CSS:            Tailwind CSS 4 (new engine)
Components:     shadcn/ui -- keep (audit unused)
Animation:      Framer Motion -- keep
Testing:        Vitest + Playwright
Linting:        Biome
CI/CD:          GitHub Actions
Monitoring:     OpenTelemetry + Sentry
Deployment:     Docker + Railway/Fly.io
```

### Priority Order for Rebuild

**Phase 1: Foundation (Week 1-2)**
1. Set up monorepo structure (Turborepo)
2. Biome linting + formatting
3. Vitest testing framework
4. GitHub Actions CI pipeline
5. Docker containerization
6. Split tsconfig (client/server)

**Phase 2: Server Core (Week 2-4)**
1. Replace Express with Hono (or tRPC)
2. Split routes.ts into modules
3. Implement proper DI container
4. Replace session auth with JWT (Better Auth or Lucia)
5. Add Redis for game state + job queue
6. Implement SSE for real-time alerts
7. Add rate limiting + input validation middleware
8. Add API versioning (`/api/v1/`)

**Phase 3: Alert Engine (Week 4-5)**
1. Split AlertEngine into detector plugins
2. Refactor GamblingInsightsComposer into structured templates
3. Add BullMQ for background game polling
4. Move game state to Redis
5. Add dead-letter queue for failed alerts

**Phase 4: Client (Week 5-7)**
1. Upgrade to React 19
2. Replace Wouter with TanStack Router
3. Implement SSE client for real-time alerts
4. Add error boundaries per route
5. Audit and remove unused shadcn/ui components
6. Upgrade Tailwind to v4

**Phase 5: Quality & Deploy (Week 7-8)**
1. Write tests (target 80% on services)
2. Add Playwright E2E tests for critical flows
3. Set up Sentry error tracking
4. Add OpenTelemetry instrumentation
5. Deploy to Railway/Fly.io with Docker
6. Add health checks + readiness probes
7. Set up structured JSON logging

### What to Carry Forward As-Is
- All Drizzle schema definitions
- Sport API service implementations (refactor, don't rewrite)
- OddsApiService (clean, well-designed)
- CalendarSyncService concept
- Broadcast alert pattern + sequence number polling
- Team logo mappings
- Season manager
- React Query hooks and caching patterns (adapt to new router)

### What to Delete
- passport / passport-local (unused)
- ws package (unused)
- memorystore (unused)
- Unused shadcn/ui components
- NotificationService stub
- All mock/demo data in client pages
- theme.json (inline into tailwind config)
