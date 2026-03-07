# CHIRPBOT COMPLETE SYSTEM DOCUMENT

**Date:** March 7, 2026
**Codebase Size:** ~52,500 lines of TypeScript/JS across 196 files
**Test Framework:** Jest 30.1.3 installed, zero test files written
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

Chirpbot is a real-time sports alert platform that monitors live games across 6 sports (MLB, NFL, NCAAF, NBA, WNBA, CFL), detects significant in-game events via modular "alert cylinders," enriches them with AI-generated insights (GPT-4o), gambling odds, and weather data, then delivers alerts to users via a web dashboard (SSE + polling) and Telegram.

### Core Loop

```
Sport APIs (MLB/ESPN) --> CalendarSyncService (schedules every 30s, smart intervals)
                              |
                              v
                     GameStateManager (game lifecycle state machine)
                     SCHEDULED -> PREWARM -> LIVE -> PAUSED -> FINAL -> TERMINATED
                              |
                              v
                  EngineLifecycleManager (starts/stops sport engines per game state)
                              |
                              v
                   Sport Engines (MLB/NFL/NBA/etc.)
                     + Alert Cylinder Modules (94 modules across 6 sports)
                              |
                              v
                  UnifiedAIProcessor (GPT-4o enrichment, 2.5s timeout)
                     + GamblingInsightsComposer (odds + weather)
                     + QualityValidator (Zod + XSS protection)
                              |
                              v
                    broadcast_alerts table (PostgreSQL, 5min TTL, sequence numbers)
                              |
                     +--------+--------+
                     |                 |
              SSE /realtime-alerts-sse  Telegram Bot API
              + polling fallback        (push delivery per user)
              (client polls 10-15s)
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
| CSRF Protection | csrf | 3.1.0 |
| Database | PostgreSQL (Neon Serverless) | 16 |
| ORM | Drizzle | 0.39.1 |
| Frontend Framework | React | 18.3.1 |
| Build Tool (Client) | Vite | 5.4.19 |
| Build Tool (Server) | esbuild | 0.25.0 |
| CSS Framework | Tailwind CSS | 3.4.17 |
| UI Components | shadcn/ui + Radix UI (20+ primitives) | various |
| Data Fetching | TanStack React Query | 5.60.5 |
| Routing (Client) | Wouter | 3.3.5 |
| Animation | Framer Motion | 11.13.1 |
| Charts | Recharts | 2.15.2 |
| Forms | React Hook Form + Zod | 7.55.0 / 3.24.2 |
| Auth | Passport (local + Google OAuth) + bcryptjs | 0.7.0 / 3.0.2 |
| OpenID Connect | openid-client | 6.7.1 |
| Session Store | connect-pg-simple (PostgreSQL) | 10.0.0 |
| Logging | Pino + pino-pretty | 9.9.0 |
| AI | OpenAI GPT-4o | via OPENAI_API_KEY |
| Notifications | Telegram Bot API | custom service |
| Caching | memoizee | 0.4.17 |
| Retry Logic | p-retry | 6.2.1 |
| ID Generation | uuid | 13.0.0 |
| Dates | date-fns | 3.6.0 |
| Icons | lucide-react | 0.453.0 |
| Testing | Jest + ts-jest (installed, unused) | 30.1.3 |
| Dev Runner | tsx | 4.19.1 |
| Deployment | Replit (autoscale) | stable-24_05 nix |

### Unused/Partially Used Dependencies
- `memorystore` -- fallback session store, likely unused with pg sessions active
- `ws` -- WebSocket library installed, no WebSocket implementation exists
- ~15 of 33 shadcn/ui components appear unused
- Jest/ts-jest installed but zero test files written

---

## 3. SERVER ARCHITECTURE

### Entry Point

**`server/index.ts`** (528 lines) -- Complex bootstrap:
- Single-instance lock (prevents port conflicts across multiple processes)
- Port conflict detection with dynamic fallback
- Express middleware setup: CORS, Helmet, body parsing, Pino logging
- Separate session parsers for user auth and admin auth
- V3 alert system initialization (CalendarSync -> GameStateManager -> Engines pipeline)
- Vite dev server integration (dev mode) vs static serving (production)
- Database seeding on startup
- Emergency memory monitoring
- Graceful shutdown with socket cleanup
- Global error handlers for unhandled rejections/exceptions

**`server/main.ts`** (11 lines) -- Wrapper that imports index.ts.
**`server/db.ts`** (20 lines) -- Drizzle ORM + Neon PostgreSQL connection with SSL auto-detection.

### Routes (`server/routes.ts` -- 5,213 lines)

This single file contains ALL HTTP route definitions, middleware, service initialization, and helper functions. It is the largest file in the codebase.

#### Authentication Routes
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | No | User login with session |
| POST | `/api/auth/signup` | No | User registration |
| POST | `/api/auth/logout` | Yes | Session termination |
| GET | `/api/auth/user` | Yes | Current authenticated user |

#### Admin Authentication (separate session)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/admin-auth/login` | No | Admin login (separate session) |
| POST | `/api/admin-auth/logout` | Admin | Admin logout |
| GET | `/api/admin-auth/csrf-token` | Admin | CSRF token generation |
| GET | `/api/admin-auth/verify` | Admin | Verify admin auth status |
| GET | `/api/admin-auth/check` | Admin | Check admin session |

#### User/Profile
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/users/me` | Yes | Current user profile |
| PATCH | `/api/users/me` | Yes | Update profile |
| GET | `/api/user/:userId/telegram` | Yes | Telegram settings |
| POST | `/api/user/:userId/telegram` | Yes | Update Telegram settings |

#### Team Management
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/teams` | No | All teams |
| GET | `/api/teams/:sport` | No | Teams by sport |
| POST | `/api/teams` | Admin | Create team |
| PUT | `/api/teams/:id` | Admin | Update team |
| DELETE | `/api/teams/:id` | Admin | Delete team |

#### Games & Monitoring
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/games/today` | No | Games by sport + date (from CalendarSyncService) |
| GET | `/api/games/multi-day` | No | Multi-day game schedule |
| GET | `/api/games/:gameId/enhanced` | No | Enriched game data |
| GET | `/api/games/:gameId/live` | No | Live game status |
| GET | `/api/server-date` | No | Server's Pacific timezone date |
| GET | `/api/user/:userId/monitored-games` | Yes | User's monitored games |
| POST | `/api/user/:userId/monitored-games` | Yes | Add game to monitor |
| DELETE | `/api/user/:userId/monitored-games/:gameId` | Yes | Remove monitored game |

#### Alerts
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/alerts` | Yes | All active alerts with user filtering |
| GET | `/api/alerts/snapshot` | Yes | Alert snapshot with stats |
| GET | `/api/alerts/stats` | No | Alert statistics |
| GET | `/api/alerts/count` | No | Simple alert count |
| DELETE | `/api/alerts/:alertId` | Yes | Delete alert |
| GET | `/realtime-alerts-sse` | Yes | **Server-Sent Events stream** |

#### User Settings & Preferences
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/:userId/alert-preferences` | Yes | Get alert preferences |
| GET | `/api/user/:userId/alert-preferences/:sport` | Yes | Sport-specific prefs |
| POST | `/api/user/:userId/alert-preferences` | Yes | Set alert preference |
| POST | `/api/user/:userId/alert-preferences/bulk` | Yes | Bulk set preferences |
| GET | `/api/settings` | Yes | Global settings |
| POST | `/api/settings` | Yes | Update settings |

#### Gambling
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/gambling/insights/:gameId` | Yes | Gambling insights for a game |
| GET | `/api/gambling/odds/:sport` | Yes | Odds for a sport |

#### Weather & Environmental
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/weather` | No | Current weather |
| GET | `/api/weather/team/:teamName` | No | Weather for team location |
| GET | `/api/weather-on-live/status` | No | Weather monitoring status |
| POST | `/api/weather-on-live/control/:gameId/:action` | Admin | Control weather monitoring |

#### Sport-Specific Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/nfl/possession/:gameId` | No | NFL possession data |
| GET | `/api/nfl/timeouts/:gameId` | No | NFL timeout tracking |
| GET | `/api/ncaaf/possession/:gameId` | No | NCAAF possession |
| GET | `/api/ncaaf/timeouts/:gameId` | No | NCAAF timeouts |
| GET | `/api/cfl/timeouts/:gameId` | No | CFL timeouts |

#### Telegram
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/telegram/test` | Yes | Test Telegram connection |
| GET | `/api/telegram/debug` | Yes | Debug Telegram settings |

#### AI & Cache
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/ai/cache/clear` | Admin | Clear AI cache |
| GET | `/api/ai/cache/stats` | No | AI cache statistics |
| GET | `/api/ai/performance/dashboard` | No | AI performance metrics |

#### Admin Routes (all require admin auth + CSRF)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/enable-master-alerts` | Enable all alerts globally |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/role/:role` | Users by role |
| PUT | `/api/admin/users/:userId/role` | Change user role |
| DELETE | `/api/admin/users/:userId` | Soft delete user |
| DELETE | `/api/admin/users/:userId/force` | Force delete user |
| GET | `/api/admin/stats` | System statistics |
| GET | `/api/admin/system-status` | System health |
| POST | `/api/admin/cleanup-alerts` | Trigger alert cleanup |

#### Debug/Diagnostics (admin only)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/diagnostics/ingestion-status` | Migration adapter status |
| GET | `/api/diagnostics/environment` | Environment variables |
| GET | `/api/debug/comprehensive` | Full system debug |
| GET | `/api/debug/database` | Database status |
| GET | `/api/debug/alerts-system` | Alerts system health |
| GET | `/api/debug/live-monitoring` | Live game monitoring status |
| GET | `/api/debug/user-preferences/:userId` | User preference debugging |

#### System
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Health check |
| GET | `/version` | No | Server version |
| HEAD | `/api` | No | API availability check |
| GET | `/admin` | Admin | Admin panel static files |

#### Key Middleware Stack
1. Memory management (auto GC at 85%/92% heap thresholds)
2. Request deduplication (UnifiedDeduplicator)
3. Session parsing (separate user vs admin session parsers)
4. CSRF protection (admin routes only)
5. Authentication (`requireAuthentication`, `requireUserAuth`, `requireAdminAuth`)
6. Request logging (JSON response capture, duration tracking)

### Middleware (`server/middleware/`)

| File | Lines | Purpose |
|------|-------|---------|
| `circuit-breaker.ts` | 190 | Circuit breaker for external APIs (states: CLOSED -> OPEN -> HALF_OPEN). Configurable failure threshold. Singleton per service (MLB, ESPN, Weather, OpenAI). |
| `memory-manager.ts` | 139 | V8 heap inspection, auto GC at 85%, force GC at 92%, 15s cooldown between attempts. Express middleware + background cleanup. |

### Configuration (`server/config/`)

| File | Lines | Purpose |
|------|-------|---------|
| `ai-features.ts` | 12 | AI feature flags: enableAIEnhancement, enableAIScanner, duplicateSimilarityThreshold (0.72), word limits (14/18), OpenAI timeout (2.5s), temperature (0.2) |
| `runtime.ts` | 170 | Centralized timing config. Game state polling (30s default, 2s prestart, 1s critical). Weather (90s live, 20s armed). Engine lifecycle (1s tick, 5min prewarm, 30s health). API rate limits. Performance targets (startup <3s, detection <20s). Game state enum: SCHEDULED, PREWARM, LIVE, PAUSED, FINAL, TERMINATED. |

### Utilities (`server/utils/`)

| File | Lines | Purpose |
|------|-------|---------|
| `singleton-lock.ts` | 211 | Lock file-based single instance enforcement. Port availability checking with exponential backoff (5 retries). |
| `timezone.ts` | 32 | Pacific timezone date calculations |

### Services (non-engine)

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| GameStateManager | `game-state-manager.ts` | **1,189** | Game lifecycle state machine (SCHEDULED -> PREWARM -> LIVE -> PAUSED -> FINAL -> TERMINATED). Smart polling intervals based on proximity. Live confirmation logic. Weather arming on transitions. User-game monitoring tracking. Timezone-aware. |
| EngineLifecycleManager | `engine-lifecycle-manager.ts` | 1,256 | Dynamic engine start/stop. Engine states: INACTIVE, PRE_WARMING, ACTIVE, COOLDOWN, ERROR, RECOVERY. Circuit breaker per sport. Resource tracking (memory, CPU). Auto-recovery. **Only MLB enabled, others commented out.** |
| UnifiedAIProcessor | `unified-ai-processor.ts` | 2,032 | GPT-4o cross-sport alert enrichment. Zod schema validation. Fallback to rule-based on AI failure. Caching. Betting context generation. Game projection (win probability). AI Discovery capability. |
| GamblingInsightsComposer | `gambling-insights-composer.ts` | 1,438 | Combines alert + game state + weather + odds. Sport-specific insights. Risk/reward assessment. Player matchup analysis. Confidence scoring. |
| CalendarSyncService | `calendar-sync-service.ts` | **796** | Multi-sport schedule sync with proximity-based polling intervals. In-memory game cache with TTL. Singleton. Performance metrics. Stale game cleanup integration. |
| UnifiedHealthMonitor | `unified-health-monitor.ts` | 718 | System-wide health: DB, APIs, engines. Performance metrics aggregation. Alert/error rate tracking. Trend analysis. |
| UnifiedSettings | `unified-settings.ts` | 732 | Centralized alert preference management. Global settings cache per sport. Background refresh. Bulk operations. Cache invalidation. |
| WeatherOnLiveService | `weather-on-live-service.ts` | 957 | Arms weather monitoring when games go live. Tracks wind/temp/precipitation changes. Generates weather-change alerts. Sport-specific thresholds. |
| AdvancedPlayerStats | `advanced-player-stats.ts` | 534 | Player-level statistics tracking for context |
| BaseSportApi | `base-sport-api.ts` | 401 | Abstract base class. Rate limiting configurable per game state (live vs scheduled vs final). Caching with TTL. Circuit breaker integration. |
| MLBApiService | `mlb-api.ts` | 526 | ESPN MLB endpoint. Inning/runner/count extraction. |
| NFLApiService | `nfl-api.ts` | 468 | ESPN NFL. Possession/timeout tracking. |
| NCAAFApiService | `ncaaf-api.ts` | 393 | ESPN college football. FBS team data. |
| NBAApiService | `nba-api.ts` | 133 | ESPN NBA. Quarter/shot clock. |
| WNBAApiService | `wnba-api.ts` | 119 | ESPN WNBA. |
| CFLApiService | `cfl-api.ts` | 115 | ESPN CFL. |
| OddsApiService | `odds-api-service.ts` | 416 | The Odds API. Moneyline/spreads/totals. Rate limit 450 req/30 days. 5min cache. Bookmaker priority: DraftKings > FanDuel > BetMGM > Caesars. |
| WeatherService | `weather-service.ts` | 448 | OpenWeatherMap. Multi-source. Venue lookups. Sport-specific impact assessment. Circuit breaker. |
| Telegram | `telegram.ts` | 268 | MarkdownV2 formatting. Message chunking (4096 char limit). Sport-specific emoji. Inline keyboard for deep links. Per-user bot tokens. |
| UnifiedDeduplicator | `unified-deduplicator.ts` | 244 | Request + alert deduplication. Configurable TTL. Jaccard similarity (0.72 threshold). |
| QualityValidator | `quality-validator.ts` | 210 | AI output validation. Zod schema. XSS sanitization. |
| AISituationParser | `ai-situation-parser.ts` | 205 | Parses raw game data into AI context |
| GameMonitoringCleanup | `game-monitoring-cleanup.ts` | 197 | Removes stale game state for completed games |
| SportsDataApi | `sportsdata-api.ts` | 156 | Secondary sports data source |
| AlertCleanup | `alert-cleanup.ts` | 125 | Hourly cleanup of alerts older than 24h. Manual trigger support. |
| MigrationAdapter | `migration-adapter.ts` | 102 | Bridges CalendarSync <-> GameStateManager |
| HttpService | `http.ts` | 71 | Fetch wrapper with error handling |
| TextUtils | `text-utils.ts` | 12 | Jaccard similarity function |

### Storage Layer (`server/storage.ts` -- 1,156 lines)

Implements `IStorage` interface using Drizzle ORM. Also exports `unifiedSettings` singleton.

**~50 methods covering:**
- **Users:** getById, getByUsername, getByEmail, create, update, getAllUsers, getUsersByRole, updateRole, deleteUser, forceDeleteUser
- **Teams:** CRUD, monitoring toggle
- **Settings:** sport-specific, global, user preferences, Telegram config
- **Alerts:** create (with 5min TTL, alertKey dedup), getByUser, getAll, delete
- **Broadcast Alerts:** create, getBroadcastAlertsSince (sequence-based)
- **Monitored Games:** getUserMonitoredTeams, add, remove, getAll
- **Alert Preferences:** per-user per-sport per-type enable/disable, bulk set
- **Global Alert Settings:** admin-managed sport-wide toggles with defaults

---

## 4. ALERT CYLINDER ENGINE ARCHITECTURE

The most sophisticated part of the system. **94 files, 18,460 lines** organized as a modular plugin architecture.

### Base Engine (`server/services/engines/base-engine.ts` -- 572 lines)

The `BaseSportEngine` abstract class provides:
- `parseTimeToSeconds()` -- standardized time parsing
- `loadAlertModule()` -- dynamic import of cylinder modules
- `initializeUserAlertModules()` -- loads user-enabled modules with change-detection caching
- `isAlertEnabled()` -- resolves user preferences + global settings
- `generateLiveAlerts()` -- main alert generation loop
- Possession + timeout tracking (for football sports)
- Performance metrics (generation time, module load time, cache hits/misses)
- `LocalDedupeLedger` -- process-local dedup with TTL

Sport engines override:
- `calculateProbability()` -- sport-specific probability weighting
- `enhanceGameStateWithLiveData()` -- sport-specific API enrichment
- `getModuleMap()` -- maps alert types to module file paths

### Sport Engines

| Engine | File | Lines | Status |
|--------|------|-------|--------|
| MLBEngine | `mlb-engine.ts` | 309 | **ACTIVE** |
| NFLEngine | `nfl-engine.ts` | 187 | Disabled in EngineLifecycleManager |
| NCAAFEngine | `ncaaf-engine.ts` | 176 | Disabled |
| NBAEngine | `nba-engine.ts` | 153 | Disabled |
| WNBAEngine | `wnba-engine.ts` | 130 | Disabled |
| CFLEngine | `cfl-engine.ts` | 171 | Disabled |

**Note:** Only MLB is currently active. Other 5 sports are commented out in `engine-lifecycle-manager.ts` lines 26-32.

### Supporting Models

| File | Lines | Purpose |
|------|-------|---------|
| `mlb-prob-model.ts` | 406 | RE24 run expectancy, scoring probability by base/out state, win probability |
| `mlb-performance-tracker.ts` | 1,353 | Batter/pitcher performance tracking during live games |
| `ai-opportunity-scanner.ts` | 196 | Cross-sport AI discovery of betting opportunities |

### Alert Cylinder Modules (80+ modules)

Each module is a self-contained alert detector for a specific game situation.

#### MLB (27 modules)
| Module | Detects |
|--------|---------|
| `bases-loaded-no-outs-module` | Bases loaded, 0 outs |
| `bases-loaded-one-out-module` | Bases loaded, 1 out |
| `bases-loaded-two-outs-module` | Bases loaded, 2 outs |
| `first-and-second-module` | Runners on 1st and 2nd |
| `first-and-third-no-outs-module` | 1st and 3rd, 0 outs |
| `first-and-third-one-out-module` | 1st and 3rd, 1 out |
| `first-and-third-two-outs-module` | 1st and 3rd, 2 outs |
| `second-and-third-no-outs-module` | 2nd and 3rd, 0 outs |
| `second-and-third-one-out-module` | 2nd and 3rd, 1 out |
| `runner-on-second-no-outs-module` | Runner on 2nd, 0 outs |
| `runner-on-third-no-outs-module` | Runner on 3rd, 0 outs |
| `runner-on-third-one-out-module` | Runner on 3rd, 1 out |
| `runner-on-third-two-outs-module` | Runner on 3rd, 2 outs |
| `scoring-opportunity-module` | General RISP situations |
| `risp-prob-enhanced-module` | RISP with probability model |
| `steal-likelihood-module` | Stolen base probability |
| `mlb-prob-integration` | Probability model integration |
| `pitching-change-module` | Pitching changes |
| `strikeout-module` | Strikeout detection |
| `batter-due-module` | Key batter approaching |
| `on-deck-prediction-module` | On-deck batter prediction |
| `clutch-situation-module` | Clutch moments |
| `late-inning-close-module` | Close game, late innings |
| `high-scoring-situation-module` | High-scoring game |
| `momentum-shift-module` | Momentum shifts |
| `seventh-inning-stretch-module` | 7th inning stretch |
| `wind-change-module` | Wind impact on play |
| `game-start-module` | Game starting |
| `ai-scanner-module` | AI-powered situation scan |

#### NFL (9 modules)
red-zone, red-zone-opportunity, fourth-down, two-minute-warning, second-half-kickoff, turnover-likelihood, massive-weather, game-start, ai-scanner

#### NBA (10 modules)
clutch-performance, final-minutes, fourth-quarter, overtime, playoff-intensity, superstar-analytics, championship-implications, two-minute-warning, game-start, ai-scanner

#### NCAAF (14 modules)
red-zone, red-zone-efficiency, fourth-down-decision, close-game, comeback-potential, upset-opportunity, scoring-play, halftime, fourth-quarter, two-minute-warning, massive-weather, second-half-kickoff, game-start, ai-scanner

#### WNBA (11 modules)
clutch-time-opportunity, crunch-time-defense, comeback-potential, final-minutes, fourth-quarter, high-scoring-quarter, low-scoring-quarter, wnba-championship-implications, game-start, two-minute-warning, ai-scanner

#### CFL (11 modules)
third-down-situation, rouge-opportunity (CFL-specific scoring), final-minutes, fourth-quarter, overtime, grey-cup-implications, massive-weather, second-half-kickoff, two-minute-warning, game-start, ai-scanner

**Each sport has an `ai-scanner-module.ts`** that uses GPT-4o to detect unusual situations not covered by rule-based modules.

### Engine Lifecycle Manager (`engine-lifecycle-manager.ts` -- 1,256 lines)

Manages when sport engines run:
- **Engine States:** INACTIVE -> PRE_WARMING -> ACTIVE -> COOLDOWN -> ERROR -> RECOVERY
- **Pre-warming:** Starts engines 5 minutes before a game goes live
- **Dynamic start/stop:** Only runs engines when games are in progress
- **Circuit breaker:** Per-sport with exponential backoff (10s, 30s, 60s, max 2m)
- **Health monitoring:** Auto-recovery on engine failure
- **Resource tracking:** Memory + CPU per engine
- **Memory manager integration:** Respects heap thresholds
- **Currently: only MLB engine is enabled** (others commented out)

---

## 5. CLIENT ARCHITECTURE

### Entry Point & Providers

**`client/src/main.tsx`** (43 lines) -- React root with global error handlers (unhandled rejections, network errors).
**`client/src/App.tsx`** (107 lines) -- Provider stack + routing.

**Provider Stack:**
```
QueryClientProvider (React Query)
  -> TooltipProvider (Radix)
    -> Toaster (sonner)
      -> RegularAppContent (layout wrapper, max-w-md mobile-first)
        -> BottomNavigation (authenticated users)
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

Admin users redirected to `/admin-panel` (server-rendered).

### Pages

| Page | File | Lines | Key API Calls | Polling |
|------|------|-------|---------------|---------|
| Dashboard | `dashboard.tsx` | 545 | alerts, stats, monitored-games | 15s/30s/60s |
| Landing | `landing.tsx` | 730 | None (static marketing with pricing) | -- |
| Login | `login.tsx` | 250 | POST /api/auth/login | -- |
| Signup | `signup.tsx` | 330 | POST /api/auth/signup | -- |
| Alerts | `alerts.tsx` | 651 | alerts (limit=120), stats | 30s/60s |
| Calendar | `calendar.tsx` | 533 | games/multi-day, monitored-games, server-date | -- |
| Settings | `settings.tsx` | 2,500+ | Multiple settings/telegram/gambling endpoints | -- |
| Game Narrative | `game-narrative.tsx` | 289 | alerts, gambling insights | 10s |
| Not Found | `not-found.tsx` | ~20 | -- | -- |

### Feature Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| BottomNavigation | `bottom-navigation.tsx` | 126 | Mobile bottom nav with unread alert badge |
| TeamLogo | `team-logo.tsx` | 912 | ESPN CDN logos with fallback circles, 370+ team mappings |
| SportsLoading | `sports-loading.tsx` | 317 | Sport-specific animated loading spinners |
| BaseballDiamond | `baseball-diamond.tsx` | ~50 | MLB diamond with animated runner indicators |
| PageHeader | `PageHeader.tsx` | ~40 | Sticky page header |
| ChirpBotLogo | `ChirpBotLogo.tsx` | ~30 | App logo component |
| ErrorDisplay | `EnhancedErrorDisplay.tsx` | ~80 | Error boundary + formatted error cards |
| RetryFeedback | `RetryFeedback.tsx` | ~50 | Retry state UI (pending/success/error) |
| WeatherVisualizer | `WeatherImpactVisualizer.tsx` | ~60 | Weather effect visualization |
| ROICalculator | `roi-calculator.tsx` | ~80 | Betting ROI calculator |
| SportTabs | `SportTabs.tsx` | ~40 | Reusable sport tab filter (season-aware) |

### UI Component Library (shadcn/ui)
33 files, ~2,700 lines. Copy-pasted Radix-based components (~15 appear unused).

### Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| useAuth | `useAuth.ts` | 75 | Two-tier auth: user session -> admin session. Returns user, isAuthenticated, isAdmin. |
| useGamesAvailability | `useGamesAvailability.ts` | 43 | Checks available games across all sports today |
| useToast | `use-toast.ts` | 189 | Toast notification queue |
| useMobile | `use-mobile.tsx` | 19 | Mobile viewport (768px breakpoint) |
| useAlertSound | `use-alert-sound.ts` | ~30 | Play sound on new alerts |

### State Management

**Primary:** TanStack React Query v5 for all server state.
**Client State:** React Context (auth only). No Zustand/Redux/Jotai.

**Query Client Config:**
- `staleTime: 30s`, `gcTime: 5min`
- `refetchOnWindowFocus: false`
- `retry: 3` with exponential backoff via p-retry (1s, 2s, 4s max 10s)
- Only retries 5xx, 408, 429 errors

### Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `queryClient.ts` | 167 | React Query setup, `apiRequest()` with retry |
| `utils.ts` | 6 | `cn()` Tailwind class merge |
| `team-utils.ts` | 157 | 100+ team abbreviations, nicknames, `timeAgo()`, sport accent colors |
| `error-messages.ts` | 338 | Context-aware API error parsing (network, auth, validation, rate limit) |
| `alert-message.ts` | ~50 | Alert text formatting |
| `clean-alert-formatter.ts` | ~50 | Clean alert text for Telegram |

### Types (`client/src/types/index.ts` -- 220 lines)
Key interfaces: `Team`, `Alert` (with nested context: MLB base runners, football field position, basketball clock, gambling insights, AI confidence/projections, weather), `Settings`, `User`.

---

## 6. CORE PIPELINE

### Step 1: Schedule Sync
`CalendarSyncService` runs with proximity-based intervals:
- Calls each sport API's `getGames()` for today and tomorrow
- Stores in memory Map keyed by sport
- Smart polling: faster near game starts, slower in off-hours
- `/api/games/today` reads from this cache

### Step 2: User Monitors a Game
- User toggles "Monitor" on Calendar page
- Client: `POST /api/user/:userId/monitored-games`
- Server: Inserts into `userMonitoredTeams` table
- Server: `gameStateManager.addUserToGame(gameId, userId)`
- GameStateManager adds to bidirectional maps, starts tracking

### Step 3: Game State Machine
GameStateManager runs a state machine per game:
```
SCHEDULED  -- (T-5min) --> PREWARM  -- (live confirmed) --> LIVE
                                                              |
                                                    (delay) --+--> PAUSED
                                                              |
                                                   (final) ---+--> FINAL --> TERMINATED
```
- Pre-warming starts engines 5 minutes early
- Live confirmation requires consecutive successful API responses
- Weather monitoring arms on PREWARM/LIVE transitions

### Step 4: Engine Processing
When game goes LIVE, EngineLifecycleManager activates the sport engine:
1. `enhanceGameStateWithLiveData()` -- enriches raw API data
2. `initializeUserAlertModules()` -- loads only user-enabled cylinders (cached)
3. Each active module's `evaluate(gameState)` runs
4. Modules return `AlertResult[]` with type, confidence, priority, context
5. `LocalDedupeLedger` prevents duplicate alerts within the process
6. `UnifiedDeduplicator` prevents duplicates across the system

### Step 5: AI Enrichment
UnifiedAIProcessor processes alerts:
- GPT-4o with cross-sport context (2.5s timeout, temp 0.2)
- Generates primary insight (max 14 words) + secondary (max 18 words)
- QualityValidator: Zod validation + XSS sanitization
- GamblingInsightsComposer: odds from OddsApiService + weather data
- On AI failure: graceful fallback to rule-based text

### Step 6: Delivery
- `storage.createAlert()` with 5-minute TTL and alertKey deduplication
- `broadcast_alerts` table with auto-incrementing sequence number
- **SSE:** `GET /realtime-alerts-sse` streams alerts to connected clients
- **Polling fallback:** Client polls `/api/alerts/snapshot?seq=N` every 10-15s
- **Telegram:** Sends MarkdownV2-formatted alerts to users with Telegram configured

---

## 7. DATABASE LAYER

### ORM & Driver
- **Drizzle ORM** v0.39.1 with `drizzle-kit`
- **Neon Serverless** PostgreSQL driver with SSL auto-detection
- Schema push workflow (`npm run db:push`)
- UUID primary keys with `gen_random_uuid()`

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| username | varchar | Unique |
| email | varchar | Optional, unique |
| password | varchar | bcryptjs hash |
| role | varchar | admin, manager, analyst, user |
| authMethod | varchar | local, google, apple |
| telegramBotToken | varchar | Per-user Telegram config |
| telegramChatId | varchar | Per-user Telegram config |
| oddsApiKey | varchar | Per-user odds API key |
| createdAt | timestamp | |

#### `teams`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | varchar | |
| sport | varchar | |
| logoColor | varchar | |
| externalId | varchar | |
| monitored | boolean | |

#### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| gameId | varchar | |
| alertKey | varchar | Unique (dedup constraint) |
| type | varchar | Alert type |
| title | varchar | |
| message | text | |
| sport | varchar | |
| score | integer | Confidence 0-100 |
| payload | jsonb | Full alert data (context, AI, odds, weather) |
| sequenceNumber | identity | Auto-increment for ordering |
| createdAt | timestamp | |

#### `broadcast_alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| gameId | varchar | |
| alertKey | varchar | Unique |
| type | varchar | |
| sport | varchar | |
| score | integer | |
| payload | jsonb | |
| sequenceNumber | identity | For incremental client polling |
| createdAt | timestamp | |

#### `user_monitored_teams`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK | Cascading delete |
| gameId | varchar | |
| sport | varchar | |
| homeTeamName | varchar | |
| awayTeamName | varchar | |
| createdAt | timestamp | |

#### `user_alert_preferences`
Per-user, per-sport, per-alert-type enable/disable toggles.

#### `global_alert_settings`
Admin-managed sport-wide alert type toggles. Unique constraint on (sport, alertType).

#### `settings`
User settings as JSONB blob (sport preferences, notification toggles, push config).

#### `user_preferences`
Advanced user customization stored as JSONB.

#### `game_cache`
Real-time game state caching in database.

#### `sessions`
Express session storage via `connect-pg-simple`.

---

## 8. EXTERNAL API INTEGRATIONS

| Service | Base URL | Used For | Auth | Rate Limit |
|---------|----------|----------|------|-----------|
| MLB Stats API / ESPN | `site.api.espn.com` | MLB schedules, live data | None (public) | Smart polling per game state |
| ESPN API | `site.api.espn.com/apis/site/v2/sports/` | NFL, NCAAF, NBA, WNBA, CFL | None (public) | Smart polling |
| The Odds API | `api.the-odds-api.com/v4/` | Moneyline, spreads, totals | User API key | 450 req/30 days |
| OpenWeatherMap | `api.openweathermap.org/data/2.5/` | Stadium weather | Env API key | Standard tier |
| OpenAI | `api.openai.com/v1/` | GPT-4o alert enrichment | Env API key | 2.5s timeout |
| Telegram Bot API | `api.telegram.org/bot{token}/` | Push alert delivery | Per-user bot token | Standard |
| ESPN CDN | `a.espncdn.com/` | Team logos | None (public) | None |
| Google OAuth | Google endpoints | Social login | OAuth2 credentials | Standard |

---

## 9. AUTHENTICATION SYSTEM

### Server Side
- **Framework:** Passport.js with local strategy + Google OAuth2 (`passport-google-oauth20`)
- **OpenID Connect:** `openid-client` for OAuth2/OIDC flows
- **Password:** bcryptjs hashing
- **CSRF:** `csrf` package for admin route protection
- **Security Headers:** Helmet middleware
- **Sessions:** Two separate session parsers:
  - User sessions: `express-session` + `connect-pg-simple`
  - Admin sessions: separate session with CSRF token validation
- **Roles:** admin, manager, analyst, user
- **Session Config:** Cookie-based, `sameSite: 'lax'`

### Client Side
- `useAuth()` hook: two-tier check (user session -> admin session)
- `ProtectedRoute`: redirects to `/` if unauthenticated
- `PublicRoute`: redirects authenticated users to `/dashboard`, admins to `/admin-panel`
- `credentials: 'include'` on all API calls
- Google social login wired, Apple "coming soon"

---

## 10. REAL-TIME ARCHITECTURE

### SSE (Server-Sent Events) -- EXISTS
`GET /realtime-alerts-sse` (requires user auth) provides a server-sent events stream for real-time alert delivery.

### HTTP Polling -- PRIMARY FALLBACK
Client-side polling remains the primary consumption method:
- Dashboard: alerts every 15s, stats every 60s, monitored games every 30s
- Alerts page: every 30s
- Game Narrative: every 10s

### Incremental Updates
- `broadcast_alerts` + `alerts` tables have identity `sequenceNumber`
- Client sends `?seq=N` to get only newer alerts
- Efficient incremental polling

### Push: Telegram
Per-user Telegram bot token + chat ID. MarkdownV2-formatted alerts with sport-specific emoji and inline keyboards.

### WebSocket
`ws` package installed but no implementation exists.

---

## 11. AI INTEGRATION

### OpenAI GPT-4o

**UnifiedAIProcessor** (`unified-ai-processor.ts` -- 2,032 lines):
- `CrossSportContext` interface: universal game state for all sports
- Sends sport-specific prompts to GPT-4o
- Timeout: 2.5 seconds (graceful fallback to rule-based on failure)
- Temperature: 0.2 (consistent, factual output)
- Output: primary insight (max 14 words) + secondary insight (max 18 words)
- Betting context generation
- Game projection (win probability, key factors)
- AI Discovery capability (identifies non-obvious opportunities)
- Response caching

**AI Scanner Modules** (one per sport):
Each sport's `ai-scanner-module.ts` cylinder uses GPT-4o to detect unusual situations not covered by rule-based modules.

**Quality Control:**
- `QualityValidator`: Zod schema validation + XSS sanitization
- `UnifiedDeduplicator`: Jaccard similarity threshold 0.72

**AI Feature Flags** (`config/ai-features.ts`):
```
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
npm run dev     # NODE_ENV=development tsx server/index.ts
npm run build   # drizzle-kit push && vite build && esbuild server -> dist/
npm run start   # NODE_ENV=production node dist/index.js
npm run check   # TypeScript type checking
npm run db:push # Apply schema changes
npm run validate-cylinders  # Validate alert module integrity
npm run create-cylinder     # Generate new sport alert module
```

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL |
| `SESSION_SECRET` | Yes | Express session signing |
| `OPENAI_API_KEY` | Yes | GPT-4o insights |
| `CANONICAL_ORIGIN` | Yes | CORS/session origin |
| `PORT` | No | Server port (default 5000) |
| `NODE_ENV` | No | development/production |
| `OPENWEATHERMAP_API_KEY` | No | Weather data |
| `ALLOW_DYNAMIC_PORT` | No | Dynamic port fallback |
| `SKIP_SEED_IN_PROD` | No | Skip DB seeding |

User-configured (stored in DB):
- Telegram bot token + chat ID (per user)
- Odds API key (per user)

**No `.env.example` file exists.**

### Git Hooks (Husky)
- **pre-commit:** `node scripts/guard-new-files.js`
- **pre-push:** Blocks direct pushes to `main`

### Logging
Pino v9.9.0 structured JSON logging + pino-pretty for development.

### What's Missing
- No Docker/containerization
- No CI/CD pipeline
- No ESLint/Prettier/Biome
- No external error tracking (no Sentry)
- No rate limiting on API endpoints
- No API versioning
- No `.env.example`
- 5 of 6 sport engines disabled

---

## 13. SHARED CODE

### `shared/schema.ts` (417 lines)
Drizzle ORM table definitions + Zod validation schemas + TypeScript types (AlertResult, etc.). Used by both client and server.

### `shared/season-manager.ts` (205 lines)
Sport season date ranges, in-season detection, accent colors. Used by client for sport tabs and server for polling priority.

---

## 14. COMPLETE FILE INVENTORY

### Server Core (7 files, ~7,000 lines)
| File | Lines |
|------|-------|
| `routes.ts` | 5,213 |
| `storage.ts` | 1,156 |
| `index.ts` | 528 |
| `vite.ts` | 51 |
| `seed-database.ts` | 36 |
| `db.ts` | 20 |
| `main.ts` | 11 |

### Server Middleware/Config/Utils (6 files, ~750 lines)
| File | Lines |
|------|-------|
| `middleware/circuit-breaker.ts` | 190 |
| `config/runtime.ts` | 170 |
| `middleware/memory-manager.ts` | 139 |
| `utils/singleton-lock.ts` | 211 |
| `utils/timezone.ts` | 32 |
| `config/ai-features.ts` | 12 |

### Server Services (28 files, ~14,500 lines)
| File | Lines |
|------|-------|
| `unified-ai-processor.ts` | 2,032 |
| `gambling-insights-composer.ts` | 1,438 |
| `engine-lifecycle-manager.ts` | 1,256 |
| `game-state-manager.ts` | 1,189 |
| `weather-on-live-service.ts` | 957 |
| `calendar-sync-service.ts` | 796 |
| `unified-settings.ts` | 732 |
| `unified-health-monitor.ts` | 718 |
| `advanced-player-stats.ts` | 534 |
| `mlb-api.ts` | 526 |
| `nfl-api.ts` | 468 |
| `weather-service.ts` | 448 |
| `odds-api-service.ts` | 416 |
| `base-sport-api.ts` | 401 |
| `ncaaf-api.ts` | 393 |
| `telegram.ts` | 268 |
| `unified-deduplicator.ts` | 244 |
| `quality-validator.ts` | 210 |
| `ai-situation-parser.ts` | 205 |
| `game-monitoring-cleanup.ts` | 197 |
| `sportsdata-api.ts` | 156 |
| `nba-api.ts` | 133 |
| `alert-cleanup.ts` | 125 |
| `wnba-api.ts` | 119 |
| `cfl-api.ts` | 115 |
| `migration-adapter.ts` | 102 |
| `http.ts` | 71 |
| `text-utils.ts` | 12 |

### Alert Engine System (94 files, 18,460 lines)
| Component | Files | Lines |
|-----------|-------|-------|
| Base engine | 1 | 572 |
| Sport engines (6) | 6 | ~1,130 |
| MLB prob model | 1 | 406 |
| MLB performance tracker | 1 | 1,353 |
| AI opportunity scanner | 1 | 196 |
| MLB cylinder modules | 29 | ~5,400 |
| NFL cylinder modules | 9 | ~1,800 |
| NBA cylinder modules | 10 | ~2,000 |
| NCAAF cylinder modules | 14 | ~2,800 |
| WNBA cylinder modules | 11 | ~2,200 |
| CFL cylinder modules | 11 | ~2,200 |

### Client (all source, ~10,000 lines)
| Category | Files | Lines |
|----------|-------|-------|
| Pages | 9 | ~5,850 |
| Feature components | 11 | ~1,700 |
| shadcn/ui components | 33 | ~2,700 |
| Hooks | 5 | ~350 |
| Utilities + types | 7 | ~990 |

### Shared (2 files, 622 lines)
| File | Lines |
|------|-------|
| `schema.ts` | 417 |
| `season-manager.ts` | 205 |

### Grand Total
| Category | Files | Lines |
|----------|-------|-------|
| Server core | 7 | ~7,000 |
| Server middleware/config/utils | 6 | ~750 |
| Server services | 28 | ~14,500 |
| Alert engine system | 94 | ~18,460 |
| Client | 65 | ~11,600 |
| Shared | 2 | ~622 |
| **TOTAL** | **~202** | **~52,930** |

---

## 15. VERDICT: KEEP vs REPLACE

### KEEP (Solid foundations, 2026-ready or close)

| System | Why Keep |
|--------|----------|
| **Drizzle ORM + Neon PostgreSQL** | Modern standard. Clean schema with UUID PKs and Zod validation. |
| **TanStack React Query v5** | Industry standard for server state. Good config. |
| **Vite** | Current, fast build tool. |
| **Tailwind CSS** | Industry standard. Custom sport theme is well-built. |
| **shadcn/ui + Radix** | Correct approach. Audit unused components. |
| **TypeScript strict mode** | Keep. Upgrade to 5.7+. |
| **Alert cylinder module architecture** | The core IP. 94 self-contained detector modules. Plugin pattern is excellent. |
| **BaseSportEngine** | Well-designed abstract class with dynamic module loading, caching, dedup. |
| **Sport-specific engines** | Clean separation. Just re-enable disabled sports. |
| **MLB probability model** | RE24, win probability -- solid statistical foundation. |
| **BaseSportApi** | Rate limiting per game state, caching, circuit breaker. Sound architecture. |
| **All sport API services** | Well-structured. Minor cleanup. |
| **OddsApiService** | Rate limiting, caching, bookmaker priority. |
| **CalendarSyncService** | Smart proximity-based polling. |
| **Broadcast alert architecture** | Store once, filter per-user. Efficient. |
| **Sequence number polling** | Clean incremental updates. |
| **Game state machine** | SCHEDULED -> PREWARM -> LIVE -> PAUSED -> FINAL -> TERMINATED is well-designed. |
| **EngineLifecycleManager** | Pre-warming, circuit breaker, resource tracking. |
| **Circuit breaker middleware** | Per-service circuit breakers. |
| **Memory manager** | V8 heap monitoring with auto GC. |
| **Pino structured logging** | Already 2026-standard. |
| **Helmet security headers** | Good practice. |
| **UnifiedDeduplicator** | Alert + request dedup with Jaccard similarity. |
| **QualityValidator** | AI output validation + XSS protection. |
| **Runtime config** | Centralized timing/thresholds. |
| **Husky git hooks** | Pre-push main protection. |
| **Shared Drizzle+Zod schema** | Client-server type safety. |
| **Telegram delivery** | Working push channel. |
| **Singleton lock** | Prevents duplicate background services. |
| **Season manager** | Simple, correct. |
| **Team logo system** | ESPN CDN with fallback. 370+ mappings. |

### REPLACE (Tech debt, outdated, or broken)

| System | Why Replace | 2026 Recommendation |
|--------|-------------|---------------------|
| **Express 4** | Express 5 stable, but Hono is 2026 standard. Faster, smaller, better typed. | **Hono** or **Express 5** |
| **routes.ts (5,213 lines)** | ALL routes, middleware, service init, helpers in one file. Unmaintainable. | Split into route modules by domain. |
| **storage.ts (1,156 lines)** | Monolithic data access. Mix of Drizzle + raw SQL. | Repository pattern (`UserRepo`, `AlertRepo`, etc.) |
| **Session-based auth** | Can't scale horizontally. Doesn't work for native mobile. | **JWT + refresh tokens** via Better Auth or Lucia Auth |
| **bcryptjs** | Works but Argon2 is the 2026 standard (PHC winner). | **Argon2id** |
| **HTTP polling as primary** | SSE exists but client doesn't use it. 10-15s latency. | Make **SSE the primary** delivery. Polling as fallback only. |
| **setInterval jobs** | No retry, no dead-letter queue, no graceful shutdown. | **BullMQ** (Redis) or **Trigger.dev** |
| **In-memory game state** | Lost on restart. Can't scale horizontally. | **Redis** (Upstash) for game state + pub/sub |
| **GameStateManager (1,189 lines)** | All state in memory. Creates new API instances per poll. | DI container, Redis-backed, reusable service instances |
| **GamblingInsightsComposer (1,438 lines)** | Brittle string templates. | Composable template system or more LLM-based. |
| **UnifiedAIProcessor (2,032 lines)** | Massive file. AI + caching + formatting all mixed. | Split: AI client, prompt templates, cache, formatters |
| **Only MLB engine active** | 5/6 sport engines disabled. Core feature missing. | Re-enable all sports. Fix underlying issues. |
| **Wouter** | Missing: nested layouts, data loaders, error boundaries per route. | **TanStack Router** or **React Router 7** |
| **React 18** | React 19 stable since 2025. | **React 19** |
| **Zero tests** | Impossible to refactor safely. Jest installed but unused. | **Vitest** (faster, native ESM). Playwright for E2E. 80% target. |
| **No CI/CD** | No automation. | **GitHub Actions**: lint -> test -> build -> deploy |
| **No linting** | No style consistency. | **Biome** (replaces ESLint + Prettier, 100x faster) |
| **No error tracking** | No external visibility into failures. | **Sentry** + OpenTelemetry |
| **No rate limiting on endpoints** | API unprotected. | Rate limiting middleware |
| **No API versioning** | Breaking changes break all clients. | `/api/v1/` prefix |
| **Replit-only deployment** | Vendor lock-in, limited scaling. | **Docker** + Railway/Fly.io |
| **Single tsconfig** | Client + server share one config. | Separate tsconfig per workspace |
| **No .env.example** | Onboarding friction. | Create with all vars documented |
| **No web push** | Only Telegram + SSE/polling. | **Web Push API** + Service Worker |
| **Unused deps** | ws, memorystore, ~15 shadcn components. | Audit and remove |

---

## 16. 2026 STANDARDS RECOMMENDATIONS

### Recommended Stack (If Starting Over)

```
Runtime:        Bun 1.2+ (or Node 22 LTS)
Language:       TypeScript 5.7+
Server:         Hono (or tRPC for full type safety)
Database:       PostgreSQL (Neon) -- KEEP
ORM:            Drizzle -- KEEP
Cache/State:    Redis (Upstash for serverless)
Auth:           Better Auth or Lucia Auth (Argon2id, JWT + refresh)
Real-time:      SSE primary (already exists, just wire client)
Jobs:           BullMQ (Redis) or Trigger.dev
Validation:     Zod -- KEEP
AI:             OpenAI GPT-4o -- KEEP
Frontend:       React 19
Routing:        TanStack Router (type-safe)
State:          TanStack Query v5 -- KEEP
Build:          Vite 6 -- KEEP (upgrade)
CSS:            Tailwind CSS 4 (new engine)
Components:     shadcn/ui -- KEEP (audit unused)
Animation:      Framer Motion -- KEEP
Logging:        Pino -- KEEP
Security:       Helmet + CSRF -- KEEP
Testing:        Vitest + Playwright
Linting:        Biome
CI/CD:          GitHub Actions
Monitoring:     OpenTelemetry + Sentry
Deployment:     Docker + Railway/Fly.io
```

### Priority Order for Rebuild

**Phase 1: Foundation (Week 1-2)**
1. Monorepo structure (Turborepo or pnpm workspaces)
2. Biome linting + formatting
3. Vitest with initial test suite for cylinder modules
4. GitHub Actions CI (lint -> test -> build)
5. Docker containerization
6. Split tsconfig
7. Create `.env.example`
8. Audit + remove unused dependencies

**Phase 2: Server Core (Week 2-4)**
1. Replace Express with Hono
2. Split routes.ts (5,213 lines) into domain modules
3. Split storage.ts (1,156 lines) into repositories
4. Implement proper DI container
5. Replace session auth with JWT (Better Auth / Lucia)
6. Add Redis for game state + job queue
7. Wire client to existing SSE endpoint (replace polling as primary)
8. Add rate limiting + consistent Zod validation
9. Add API versioning (`/api/v1/`)

**Phase 3: Alert Engine (Week 4-5)**
1. **Re-enable all 6 sport engines** (highest impact)
2. Add BullMQ for background game polling
3. Move game state from memory to Redis
4. Add dead-letter queue for failed alerts
5. Split UnifiedAIProcessor (2,032 lines) into focused modules
6. Refactor GamblingInsightsComposer into composable templates

**Phase 4: Client (Week 5-7)**
1. Upgrade to React 19
2. Replace Wouter with TanStack Router
3. Connect SSE client for real-time alerts
4. Add Web Push notifications (Service Worker)
5. Add error boundaries per route
6. Remove unused shadcn/ui components
7. Upgrade Tailwind to v4

**Phase 5: Quality & Deploy (Week 7-8)**
1. Unit tests for all 94 cylinder modules (target 80%+)
2. Integration tests for API routes
3. Playwright E2E (auth, monitor game, receive alert)
4. Sentry error tracking
5. OpenTelemetry instrumentation
6. Pino logs to aggregation service
7. Deploy to Railway/Fly.io with Docker
8. Health checks + readiness probes
9. Staging environment

### What to Carry Forward As-Is
- All 94 alert cylinder modules (the core IP)
- BaseSportEngine + 6 sport engine implementations
- MLB probability model + performance tracker
- All Drizzle schema definitions
- Sport API services (refactor, don't rewrite)
- OddsApiService, CalendarSyncService, WeatherService
- Broadcast alert pattern + sequence numbers
- SSE endpoint (just needs client wiring)
- Telegram delivery service
- UnifiedAIProcessor logic (split the file, keep the AI)
- QualityValidator, UnifiedDeduplicator
- Circuit breaker, memory manager, singleton lock
- Pino logging, Helmet, CSRF
- Runtime config, AI feature flags
- Team logo mappings (370+)
- Season manager
- React Query hooks and patterns

### What to Delete
- `ws` package (unused, no WebSocket implementation)
- `memorystore` (unused with pg sessions)
- ~15 unused shadcn/ui components
- Demo/mock data in client pages
- Any legacy alert-engine.ts stubs superseded by cylinder architecture
- `passport` / `passport-local` if switching to Better Auth/Lucia
