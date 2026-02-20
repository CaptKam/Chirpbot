# ChirpBot V3 — Complete System Specifications

**Version:** 3.1  
**Last Updated:** February 2026  
**Platform:** Replit (NixOS) with Neon PostgreSQL  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Supported Sports](#2-supported-sports)
3. [Architecture](#3-architecture)
4. [Frontend](#4-frontend)
5. [Backend](#5-backend)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Sport Engines & Alert Cylinders](#8-sport-engines--alert-cylinders)
9. [Game State Machine](#9-game-state-machine)
10. [Calendar Sync Service](#10-calendar-sync-service)
11. [AI Processing Pipeline](#11-ai-processing-pipeline)
12. [Gambling Insights Composer](#12-gambling-insights-composer)
13. [Alert Deduplication](#13-alert-deduplication)
14. [Weather System](#14-weather-system)
15. [Polling & Timing Configuration](#15-polling--timing-configuration)
16. [Notification Delivery](#16-notification-delivery)
17. [Authentication & Authorization](#17-authentication--authorization)
18. [Admin Panel](#18-admin-panel)
19. [External Data Sources](#19-external-data-sources)
20. [Performance Targets](#20-performance-targets)
21. [Dependencies](#21-dependencies)
22. [File Structure](#22-file-structure)

---

## 1. System Overview

ChirpBot V3 is a multi-sport betting intelligence platform that monitors live games in real time and generates situational alerts with AI-enhanced gambling insights. It tracks game state transitions, detects high-impact betting situations, and delivers actionable recommendations through a web dashboard and Telegram push notifications.

**Core Capabilities:**
- Real-time game monitoring across 6 professional and collegiate sports
- 80+ sport-specific alert cylinders (modular alert detection units)
- AI-enhanced gambling insights via OpenAI GPT-4o
- Sub-250ms API response times
- Intelligent caching with 0ms cache hits
- Predictive alert capabilities with probability calculations
- User-configurable alert preferences per sport and alert type
- Telegram push notification delivery
- Admin panel for system management

---

## 2. Supported Sports

| Sport  | Data Source          | Engine File        | Alert Cylinders |
|--------|----------------------|--------------------|-----------------|
| MLB    | MLB.com Official API | `mlb-engine.ts`    | 29 modules      |
| NFL    | ESPN API             | `nfl-engine.ts`    | 9 modules       |
| NCAAF  | ESPN API             | `ncaaf-engine.ts`  | 14 modules      |
| NBA    | ESPN API             | `nba-engine.ts`    | 10 modules      |
| WNBA   | ESPN API             | `wnba-engine.ts`   | 11 modules      |
| CFL    | ESPN API             | `cfl-engine.ts`    | 11 modules      |

**Total: 84 alert cylinder modules across 6 sports**

---

## 3. Architecture

### High-Level Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│   Frontend   │◄───►│    Express Server     │◄───►│  PostgreSQL  │
│  React/Vite  │     │  (Node.js + TS)       │     │   (Neon)     │
└──────────────┘     └──────────┬───────────┘     └──────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
     ┌────────────┐   ┌─────────────────┐  ┌──────────────┐
     │ Calendar    │   │ Game State      │  │ Engine       │
     │ Sync        │   │ Manager         │  │ Lifecycle    │
     │ Service     │   │ (State Machine) │  │ Manager      │
     └─────┬──────┘   └────────┬────────┘  └──────┬───────┘
           │                   │                   │
           ▼                   ▼                   ▼
  ┌──────────────┐   ┌──────────────────┐  ┌──────────────────┐
  │ Sport APIs   │   │ 6 Sport Engines  │  │ 84 Alert         │
  │ (MLB, ESPN,  │   │ (MLB, NFL, NBA,  │  │ Cylinders        │
  │  CFL)        │   │  NCAAF, WNBA,    │  │ (Modular)        │
  └──────────────┘   │  CFL)            │  └──────────────────┘
                     └──────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
     ┌────────────┐   ┌─────────────────┐  ┌──────────────┐
     │ Unified AI │   │ Gambling        │  │ Deduplicator │
     │ Processor  │   │ Insights        │  │              │
     │ (GPT-4o)   │   │ Composer        │  │              │
     └────────────┘   └─────────────────┘  └──────────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
            ┌──────────────┐     ┌──────────────┐
            │ HTTP Polling │     │ Telegram Bot │
            │ (Dashboard)  │     │ (Push)       │
            └──────────────┘     └──────────────┘
```

### Communication Pattern
- **Frontend ↔ Backend:** HTTP REST API with polling (no WebSocket)
- **Backend ↔ Data Sources:** HTTP REST with intelligent caching and rate limiting
- **Alert Delivery:** Server-Sent Events (SSE) + HTTP polling + Telegram

---

## 4. Frontend

### Stack
| Layer          | Technology                          |
|----------------|-------------------------------------|
| Framework      | React 18 with TypeScript            |
| Build Tool     | Vite 5                              |
| UI Library     | Shadcn/UI (Radix UI primitives)     |
| Styling        | Tailwind CSS 3                      |
| State Mgmt     | TanStack Query v5                   |
| Routing        | Wouter                              |
| Charts         | Recharts                            |
| Animations     | Framer Motion                       |
| Icons          | Lucide React, React Icons           |

### Pages

| Page               | File                    | Description                                      |
|--------------------|-------------------------|--------------------------------------------------|
| Landing            | `landing.tsx`           | Public landing page                              |
| Login              | `login.tsx`             | User authentication                              |
| Signup             | `signup.tsx`            | User registration                                |
| Calendar           | `calendar.tsx` (847 LOC)| Game calendar with selection/monitoring           |
| Dashboard          | `v3-dashboard.tsx` (662 LOC) | Main dashboard with live game data           |
| Alerts             | `alerts.tsx` (390 LOC)  | Real-time alert feed                             |
| Settings           | `settings.tsx` (1,151 LOC) | User preferences, Telegram config, alert prefs |
| Not Found          | `not-found.tsx`         | 404 page                                        |

### Key Components

| Component                  | Description                                        |
|----------------------------|----------------------------------------------------|
| `GameCardTemplate.tsx`     | Reusable game card with sport-specific data display |
| `UniversalAlertCard.tsx`   | Alert display card with gambling insights           |
| `AIChatInterface.tsx`      | AI-powered chat for analysis                        |
| `WeatherImpactVisualizer.tsx` | Weather condition display                        |
| `BaseballDiamond.tsx`      | Visual MLB diamond with base runner positions       |
| `SportTabs.tsx`            | Multi-sport tab navigation                          |
| `BottomNavigation.tsx`     | Mobile bottom nav bar                               |
| `PageHeader.tsx`           | Consistent page headers                             |
| `ROICalculator.tsx`        | Return-on-investment calculator                     |
| `TeamLogo.tsx`             | Dynamic team logo rendering                         |

### Design System
- **Color Palette:** Dark gradient background (`#0B1220` to `#0F1A32`)
- **Font:** Inter (Google Fonts CDN)
- **Border Radius:** 12px
- **Hover Effects:** `shadow-lg`
- **Layout:** Mobile-first responsive

---

## 5. Backend

### Stack
| Layer            | Technology                          |
|------------------|-------------------------------------|
| Runtime          | Node.js with TypeScript             |
| Framework        | Express.js 4                        |
| ORM              | Drizzle ORM                         |
| Database         | PostgreSQL (Neon serverless)         |
| Build (Prod)     | ESBuild                             |
| Dev Server       | TSX (TypeScript execution)          |
| Session Store    | connect-pg-simple                   |
| Logging          | Pino + Pino Pretty                  |
| Validation       | Zod + drizzle-zod                   |
| Security         | Helmet, CSRF tokens, bcryptjs       |

### Core Services (29 service files)

| Service                       | File                              | LOC   | Description                                            |
|-------------------------------|-----------------------------------|-------|--------------------------------------------------------|
| Game State Manager            | `game-state-manager.ts`           | 1,189 | Core state machine for game lifecycle                  |
| Calendar Sync Service         | `calendar-sync-service.ts`        | 817   | Unified data ingestion across all sports               |
| Unified AI Processor          | `unified-ai-processor.ts`         | 2,030 | Cross-sport AI enhancement pipeline (GPT-4o)           |
| Gambling Insights Composer    | `gambling-insights-composer.ts`   | 1,439 | Sport-specific gambling insight generation             |
| Engine Lifecycle Manager      | `engine-lifecycle-manager.ts`     | —     | Manages engine startup/shutdown per game               |
| Unified Deduplicator          | `unified-deduplicator.ts`         | 245   | Context-aware alert deduplication                      |
| Unified Health Monitor        | `unified-health-monitor.ts`       | —     | Engine health checks and performance metrics           |
| Unified Settings              | `unified-settings.ts`             | —     | Centralized settings management                        |
| Weather Service               | `weather-service.ts`              | —     | OpenWeatherMap integration                             |
| Weather-on-Live Service       | `weather-on-live-service.ts`      | —     | Live weather monitoring during games                   |
| Telegram Service              | `telegram.ts`                     | —     | Telegram Bot API push notifications                    |
| Odds API Service              | `odds-api-service.ts`             | —     | Odds data integration                                  |
| AI Situation Parser           | `ai-situation-parser.ts`          | —     | OpenAI-powered game situation parsing                  |
| Quality Validator             | `quality-validator.ts`            | —     | AI output validation and XSS protection                |
| Alert Cleanup                 | `alert-cleanup.ts`                | —     | Expired alert cleanup                                  |
| Game Monitoring Cleanup       | `game-monitoring-cleanup.ts`      | —     | Stale game monitoring cleanup                          |
| Memory Manager                | `middleware/memory-manager.ts`    | —     | Memory usage monitoring                                |
| Settings Cache                | `settings-cache.ts`               | —     | Performance-optimized settings caching                 |
| Text Utils                    | `text-utils.ts`                   | —     | Jaccard similarity and text processing                 |
| Advanced Player Stats         | `advanced-player-stats.ts`        | —     | Player performance analytics                           |
| MLB Performance Tracker       | `mlb-performance-tracker.ts`      | —     | Real-time batter/pitcher tracking                      |
| MLB Probability Model         | `mlb-prob-model.ts`               | —     | MLB probability calculations                           |
| Migration Adapter             | `migration-adapter.ts`            | —     | API migration compatibility layer                      |

### Sport API Services

| API Service    | File            | Data Source                |
|----------------|-----------------|----------------------------|
| MLB API        | `mlb-api.ts`    | MLB.com Official API       |
| NFL API        | `nfl-api.ts`    | ESPN API                   |
| NCAAF API      | `ncaaf-api.ts`  | ESPN API                   |
| NBA API        | `nba-api.ts`    | ESPN API                   |
| WNBA API       | `wnba-api.ts`   | ESPN API                   |
| CFL API        | `cfl-api.ts`    | ESPN API                   |
| SportsData API | `sportsdata-api.ts` | SportsData.io (fallback) |
| Base Sport API | `base-sport-api.ts` | Abstract base class      |

### Routes (`server/routes.ts` — 5,204 LOC)
The API server exposes 80+ endpoints. See [API Reference](#7-api-reference) for full listing.

---

## 6. Database Schema

### Tables

#### `users`
| Column             | Type        | Description                           |
|--------------------|-------------|---------------------------------------|
| id                 | varchar (PK)| UUID auto-generated                   |
| username           | text (unique)| Login username                       |
| email              | text (unique)| Email address                        |
| password           | text        | bcrypt-hashed password                |
| googleId           | text (unique)| OAuth Google ID                      |
| appleId            | text (unique)| OAuth Apple ID                       |
| firstName          | text        | First name                            |
| lastName           | text        | Last name                             |
| profileImage       | text        | Profile image URL                     |
| authMethod         | text        | `local`, `google`, `apple`            |
| emailVerified      | boolean     | Email verification status             |
| role               | text        | `admin`, `manager`, `analyst`, `user` |
| telegramBotToken   | text        | User's Telegram bot token             |
| telegramChatId     | text        | User's Telegram chat ID               |
| telegramEnabled    | boolean     | Telegram notifications enabled        |
| oddsApiEnabled     | boolean     | Odds API integration enabled          |
| oddsApiKey         | text        | User's personal Odds API key          |
| createdAt          | timestamp   | Account creation time                 |
| updatedAt          | timestamp   | Last update time                      |

#### `teams`
| Column      | Type        | Description              |
|-------------|-------------|--------------------------|
| id          | varchar (PK)| UUID auto-generated      |
| name        | text        | Team name                |
| initials    | text        | Team abbreviation        |
| sport       | text        | Sport league             |
| logoColor   | text        | Team brand color (hex)   |
| monitored   | boolean     | Global monitoring flag   |
| externalId  | text        | External API team ID     |

#### `user_monitored_teams`
| Column        | Type        | Description                    |
|---------------|-------------|--------------------------------|
| id            | varchar (PK)| UUID auto-generated            |
| userId        | varchar (FK)| References `users.id`          |
| gameId        | text        | Live game ID from API          |
| sport         | text        | Sport league                   |
| homeTeamName  | text        | Home team name                 |
| awayTeamName  | text        | Away team name                 |
| createdAt     | timestamp   | When monitoring started        |

#### `alerts`
| Column         | Type        | Description                         |
|----------------|-------------|-------------------------------------|
| id             | varchar (PK)| UUID auto-generated                 |
| alertKey       | varchar     | Unique alert identifier             |
| sequenceNumber | integer     | Auto-incrementing sequence          |
| sport          | text        | Sport league                        |
| gameId         | text        | Game ID                             |
| type           | text        | Alert type (e.g., RISP, RED_ZONE)   |
| state          | text        | Alert state                         |
| score          | integer     | Priority score                      |
| payload        | jsonb       | Full alert data + gambling insights |
| userId         | varchar (FK)| References `users.id`               |
| createdAt      | timestamp   | Alert creation time                 |
| expiresAt      | timestamp   | Expiry (default: +5 minutes)        |

#### `global_alert_settings`
| Column     | Type        | Description                             |
|------------|-------------|-----------------------------------------|
| id         | varchar (PK)| UUID auto-generated                     |
| sport      | text        | Sport league                            |
| alertType  | text        | Alert type identifier                   |
| enabled    | boolean     | Whether alert type is active            |
| updatedAt  | timestamp   | Last update time                        |
| updatedBy  | varchar (FK)| Admin who changed setting               |

**Unique constraint:** `(sport, alertType)`

#### `user_alert_preferences`
| Column    | Type        | Description                       |
|-----------|-------------|-----------------------------------|
| id        | varchar (PK)| UUID auto-generated               |
| userId    | varchar (FK)| References `users.id`             |
| sport     | text        | Sport league                      |
| alertType | text        | Alert type identifier             |
| enabled   | boolean     | User's preference for this alert  |
| createdAt | timestamp   | Creation time                     |
| updatedAt | timestamp   | Last update time                  |

#### `game_states`
| Column         | Type        | Description                          |
|----------------|-------------|--------------------------------------|
| id             | varchar (PK)| UUID auto-generated                  |
| extGameId      | text        | External game ID                     |
| sport          | text        | Sport league                         |
| homeTeam       | text        | Home team name                       |
| awayTeam       | text        | Away team name                       |
| homeScore      | integer     | Home team score                      |
| awayScore      | integer     | Away team score                      |
| status         | text        | `scheduled`, `live`, `final`         |
| inning         | integer     | Current inning (MLB)                 |
| isTopInning    | boolean     | Top/bottom inning (MLB)              |
| balls          | integer     | Ball count (MLB)                     |
| strikes        | integer     | Strike count (MLB)                   |
| outs           | integer     | Out count (MLB)                      |
| hasFirst       | boolean     | Runner on first (MLB)                |
| hasSecond      | boolean     | Runner on second (MLB)               |
| hasThird       | boolean     | Runner on third (MLB)                |
| currentBatter  | text        | Current batter name (MLB)            |
| currentPitcher | text        | Current pitcher name (MLB)           |
| onDeckBatter   | text        | On-deck batter name (MLB)            |
| windSpeed      | integer     | Wind speed in MPH                    |
| windDirection  | text        | Wind direction (N, NE, E, etc.)      |
| temperature    | integer     | Temperature in Fahrenheit            |
| humidity       | integer     | Humidity percentage                  |
| enhancedData   | jsonb       | Flexible extended data payload       |
| createdAt      | timestamp   | Record creation                      |
| updatedAt      | timestamp   | Last update                          |

#### `settings`
| Column                    | Type        | Description                  |
|---------------------------|-------------|------------------------------|
| id                        | varchar (PK)| UUID auto-generated          |
| sport                     | text        | Sport league                 |
| preferences               | jsonb       | `{notifications, theme}`     |
| telegramEnabled           | boolean     | Telegram toggle              |
| pushNotificationsEnabled  | boolean     | Push notifications toggle    |

---

## 7. API Reference

### Authentication
| Method | Endpoint                  | Auth     | Description                   |
|--------|---------------------------|----------|-------------------------------|
| POST   | `/api/auth/login`         | Public   | User login                    |
| POST   | `/api/auth/signup`        | Public   | User registration             |
| POST   | `/api/auth/logout`        | User     | User logout                   |
| GET    | `/api/auth/user`          | Session  | Get current user              |

### Games
| Method | Endpoint                            | Auth     | Description                          |
|--------|-------------------------------------|----------|--------------------------------------|
| GET    | `/api/games/today`                  | Public   | Today's games (filterable by sport)  |
| GET    | `/api/games/multi-day`              | Public   | Multi-day game schedule              |
| GET    | `/api/games/:gameId/enhanced`       | Public   | Enhanced game data                   |
| GET    | `/api/games/:gameId/live`           | Public   | Live game data                       |
| GET    | `/api/server-date`                  | Public   | Server date/time                     |

### User Game Monitoring
| Method | Endpoint                                      | Auth | Description                   |
|--------|-----------------------------------------------|------|-------------------------------|
| GET    | `/api/user/:userId/monitored-games`           | User | Get user's monitored games    |
| POST   | `/api/user/:userId/monitored-games`           | User | Add game to monitoring        |
| DELETE | `/api/user/:userId/monitored-games/:gameId`   | User | Remove game from monitoring   |

### Alerts
| Method | Endpoint                     | Auth     | Description                        |
|--------|------------------------------|----------|------------------------------------|
| GET    | `/api/alerts`                | Session  | Get active alerts for user         |
| GET    | `/api/alerts/snapshot`       | Public   | Alert snapshot                     |
| GET    | `/api/alerts/stats`          | Public   | Alert statistics                   |
| GET    | `/api/alerts/count`          | Public   | Alert count                        |
| DELETE | `/api/alerts/:alertId`       | User     | Delete an alert                    |
| GET    | `/realtime-alerts-sse`       | User     | Server-Sent Events stream          |

### User Alert Preferences
| Method | Endpoint                                        | Auth | Description                      |
|--------|-------------------------------------------------|------|----------------------------------|
| GET    | `/api/user/:userId/alert-preferences`           | Public | Get all preferences            |
| GET    | `/api/user/:userId/alert-preferences/:sport`    | Public | Get sport-specific preferences |
| POST   | `/api/user/:userId/alert-preferences`           | User | Update single preference         |
| POST   | `/api/user/:userId/alert-preferences/bulk`      | User | Bulk update preferences          |

### User Profile & Telegram
| Method | Endpoint                            | Auth | Description                       |
|--------|-------------------------------------|------|-----------------------------------|
| GET    | `/api/user/:userId`                 | Public | Get user profile               |
| GET    | `/api/users/me`                     | User | Get current user profile          |
| PATCH  | `/api/users/me`                     | User | Update current user profile       |
| GET    | `/api/user/:userId/telegram`        | Public | Get Telegram config            |
| POST   | `/api/user/:userId/telegram`        | Public | Update Telegram config         |
| POST   | `/api/telegram/test`                | User | Test Telegram connection          |

### Sport-Specific Data
| Method | Endpoint                              | Auth   | Description                      |
|--------|---------------------------------------|--------|----------------------------------|
| GET    | `/api/nfl/possession/:gameId`         | Public | NFL possession data              |
| GET    | `/api/ncaaf/possession/:gameId`       | Public | NCAAF possession data            |
| GET    | `/api/nfl/timeouts/:gameId`           | Public | NFL timeout tracking             |
| GET    | `/api/ncaaf/timeouts/:gameId`         | Public | NCAAF timeout tracking           |
| GET    | `/api/cfl/timeouts/:gameId`           | Public | CFL timeout tracking             |

### Weather
| Method | Endpoint                                          | Auth | Description                    |
|--------|---------------------------------------------------|------|--------------------------------|
| GET    | `/api/weather`                                    | Public | General weather data         |
| GET    | `/api/weather/team/:teamName`                     | Public | Team venue weather           |
| GET    | `/api/weather-on-live/status`                     | User | Live weather monitoring status |
| POST   | `/api/weather-on-live/control/:gameId/:action`    | User | Control weather monitoring   |
| GET    | `/api/test-weather/:team`                         | Public | Test weather for team        |

### Teams & Settings
| Method | Endpoint              | Auth | Description            |
|--------|-----------------------|------|------------------------|
| GET    | `/api/teams`          | Public | Get all teams        |
| GET    | `/api/teams/:sport`   | Public | Get teams by sport   |
| POST   | `/api/teams`          | Public | Create team          |
| PUT    | `/api/teams/:id`      | Public | Update team          |
| DELETE | `/api/teams/:id`      | Public | Delete team          |
| GET    | `/api/settings`       | User | Get user settings      |
| POST   | `/api/settings`       | User | Update settings        |

### Admin Authentication
| Method | Endpoint                        | Auth  | Description                   |
|--------|---------------------------------|-------|-------------------------------|
| POST   | `/api/admin-auth/login`         | Public| Admin login                   |
| GET    | `/api/admin-auth/verify`        | Admin | Verify admin session          |
| GET    | `/api/admin-auth/csrf-token`    | Admin | Get CSRF token                |

### Admin Management
| Method | Endpoint                                             | Auth  | Description                    |
|--------|------------------------------------------------------|-------|--------------------------------|
| GET    | `/api/admin/users`                                   | Admin | List all users                 |
| GET    | `/api/admin/users/role/:role`                        | Admin | List users by role             |
| PUT    | `/api/admin/users/:userId/role`                      | Admin | Update user role               |
| DELETE | `/api/admin/users/:userId`                           | Admin | Delete user                    |
| DELETE | `/api/admin/users/:userId/force`                     | Admin | Force delete user              |
| GET    | `/api/admin/users/:userId/alert-preferences`         | Admin | View user alert prefs          |
| PUT    | `/api/admin/users/:userId/alert-preferences`         | Admin | Update user alert prefs        |
| GET    | `/api/admin/stats`                                   | Admin | System statistics              |
| GET    | `/api/admin/system-status`                           | Admin | System status dashboard        |
| POST   | `/api/admin/enable-master-alerts`                    | Admin | Enable/disable master alerts   |
| POST   | `/api/admin/enable-first-and-second`                 | Admin | Toggle first-and-second alerts |
| POST   | `/api/admin/cleanup-alerts`                          | Admin | Trigger alert cleanup          |
| GET    | `/api/admin/cleanup-stats`                           | Admin | Cleanup statistics             |
| GET    | `/api/admin/game-monitoring-cleanup/status`          | Admin | Monitoring cleanup status      |
| POST   | `/api/admin/game-monitoring-cleanup/trigger`         | Admin | Trigger monitoring cleanup     |

### AI & Performance
| Method | Endpoint                              | Auth  | Description                        |
|--------|---------------------------------------|-------|------------------------------------|
| POST   | `/api/ai/cache/clear`                 | Admin | Clear AI cache                     |
| GET    | `/api/ai/performance/dashboard`       | Admin | AI performance dashboard           |
| GET    | `/api/ai/cache/stats`                 | Admin | AI cache statistics                |

### System & Diagnostics
| Method | Endpoint                           | Auth   | Description                       |
|--------|------------------------------------|--------|-----------------------------------|
| GET    | `/health`                          | Public | Health check                      |
| GET    | `/version`                         | Public | Version info                      |
| GET    | `/api/environment-status`          | Public | Environment configuration         |
| GET    | `/api/diagnostics/ingestion-status`| Public | Data ingestion status             |
| GET    | `/api/diagnostics/environment`     | Public | Environment diagnostics           |
| GET    | `/api/debug/comprehensive`         | Public | Full system debug info            |
| GET    | `/api/debug/database`              | Public | Database diagnostics              |

---

## 8. Sport Engines & Alert Cylinders

### Engine Architecture

Each sport has a dedicated engine that extends `BaseEngine`. Engines manage a collection of **alert cylinders** — modular detection units that each watch for a specific game situation.

```
BaseAlertModule (abstract)
├── alertType: string
├── sport: string
├── isTriggered(gameState): boolean       ← cheap trigger check
├── generateAlert(gameState): AlertResult ← create alert payload
├── calculateProbability(gameState): number ← 0-100 score
├── minConfidence?: number                ← optional gate
└── dedupeWindowMs?: number               ← optional TTL
```

### MLB Alert Cylinders (29 modules)

| Module                           | Alert Type                | Description                                      |
|----------------------------------|---------------------------|--------------------------------------------------|
| `bases-loaded-no-outs-module`    | BASES_LOADED_NO_OUTS      | Bases loaded with 0 outs                         |
| `bases-loaded-one-out-module`    | BASES_LOADED_ONE_OUT      | Bases loaded with 1 out                          |
| `bases-loaded-two-outs-module`   | BASES_LOADED_TWO_OUTS     | Bases loaded with 2 outs                         |
| `runner-on-third-no-outs-module` | RUNNER_THIRD_NO_OUTS      | Runner on 3rd, 0 outs                            |
| `runner-on-third-one-out-module` | RUNNER_THIRD_ONE_OUT      | Runner on 3rd, 1 out                             |
| `runner-on-third-two-outs-module`| RUNNER_THIRD_TWO_OUTS     | Runner on 3rd, 2 outs                            |
| `runner-on-second-no-outs-module`| RUNNER_SECOND_NO_OUTS     | Runner on 2nd, 0 outs                            |
| `first-and-second-module`        | FIRST_AND_SECOND          | Runners on 1st and 2nd                           |
| `first-and-third-no-outs-module` | FIRST_AND_THIRD_NO_OUTS   | Runners on 1st and 3rd, 0 outs                   |
| `first-and-third-one-out-module` | FIRST_AND_THIRD_ONE_OUT   | Runners on 1st and 3rd, 1 out                    |
| `first-and-third-two-outs-module`| FIRST_AND_THIRD_TWO_OUTS  | Runners on 1st and 3rd, 2 outs                   |
| `second-and-third-no-outs-module`| SECOND_AND_THIRD_NO_OUTS  | Runners on 2nd and 3rd, 0 outs                   |
| `second-and-third-one-out-module`| SECOND_AND_THIRD_ONE_OUT  | Runners on 2nd and 3rd, 1 out                    |
| `risp-prob-enhanced-module`      | RISP_ENHANCED             | Runners in scoring position (probability-enhanced)|
| `scoring-opportunity-module`     | SCORING_OPPORTUNITY       | General scoring opportunity detection            |
| `high-scoring-situation-module`  | HIGH_SCORING              | High-scoring game situation                      |
| `clutch-situation-module`        | CLUTCH_SITUATION          | Late-game clutch moments                         |
| `late-inning-close-module`       | LATE_INNING_CLOSE         | Late-inning close game                           |
| `momentum-shift-module`          | MOMENTUM_SHIFT            | Momentum change detection                        |
| `steal-likelihood-module`        | STEAL_LIKELIHOOD          | Stolen base probability                          |
| `batter-due-module`              | BATTER_DUE                | Key batter due up                                |
| `on-deck-prediction-module`      | ON_DECK_PREDICTION        | On-deck batter prediction                        |
| `pitching-change-module`         | PITCHING_CHANGE           | Pitching change detected                         |
| `strikeout-module`               | STRIKEOUT                 | High strikeout situation                         |
| `game-start-module`              | GAME_START                | Game starting                                    |
| `seventh-inning-stretch-module`  | SEVENTH_INNING_STRETCH    | 7th inning stretch                               |
| `wind-change-module`             | WIND_CHANGE               | Wind direction/speed change                      |
| `ai-scanner-module`              | AI_SCAN                   | AI-powered situation scanning                    |
| `mlb-prob-integration`           | MLB_PROB                  | MLB probability model integration                |

### NFL Alert Cylinders (9 modules)

| Module                           | Alert Type            | Description                         |
|----------------------------------|-----------------------|-------------------------------------|
| `game-start-module`              | GAME_START            | Game kickoff                        |
| `fourth-down-module`             | FOURTH_DOWN           | 4th down decision                   |
| `red-zone-module`                | RED_ZONE              | Red zone entry                      |
| `red-zone-opportunity-module`    | RED_ZONE_OPPORTUNITY  | Red zone scoring opportunity        |
| `two-minute-warning-module`      | TWO_MINUTE_WARNING    | Two-minute warning                  |
| `second-half-kickoff-module`     | SECOND_HALF_KICKOFF   | Second half kickoff                 |
| `turnover-likelihood-module`     | TURNOVER_LIKELIHOOD   | Turnover probability                |
| `massive-weather-module`         | MASSIVE_WEATHER       | Severe weather impact               |
| `ai-scanner-module`              | AI_SCAN               | AI-powered situation scanning       |

### NCAAF Alert Cylinders (14 modules)

| Module                           | Alert Type               | Description                       |
|----------------------------------|--------------------------|-----------------------------------|
| `game-start-module`              | GAME_START               | Game kickoff                      |
| `fourth-down-decision-module`    | FOURTH_DOWN_DECISION     | 4th down decision                 |
| `fourth-quarter-module`          | FOURTH_QUARTER           | 4th quarter alert                 |
| `red-zone-module`                | RED_ZONE                 | Red zone entry                    |
| `red-zone-efficiency-module`     | RED_ZONE_EFFICIENCY      | Red zone efficiency tracking      |
| `two-minute-warning-module`      | TWO_MINUTE_WARNING       | Two-minute warning                |
| `second-half-kickoff-module`     | SECOND_HALF_KICKOFF      | Second half kickoff               |
| `halftime-module`                | HALFTIME                 | Halftime                          |
| `close-game-module`              | CLOSE_GAME               | Close game detection              |
| `comeback-potential-module`      | COMEBACK_POTENTIAL        | Comeback potential                |
| `upset-opportunity-module`       | UPSET_OPPORTUNITY        | Upset opportunity                 |
| `scoring-play-module`            | SCORING_PLAY             | Scoring play                      |
| `massive-weather-module`         | MASSIVE_WEATHER          | Severe weather impact             |
| `ai-scanner-module`              | AI_SCAN                  | AI-powered situation scanning     |

### NBA Alert Cylinders (10 modules)

| Module                              | Alert Type                  | Description                        |
|-------------------------------------|-----------------------------|------------------------------------|
| `game-start-module`                 | GAME_START                  | Game tipoff                        |
| `fourth-quarter-module`             | FOURTH_QUARTER              | 4th quarter alert                  |
| `final-minutes-module`              | FINAL_MINUTES               | Final minutes of game              |
| `two-minute-warning-module`         | TWO_MINUTE_WARNING          | Under 2 minutes remaining          |
| `overtime-module`                   | OVERTIME                    | Overtime period                    |
| `clutch-performance-module`         | CLUTCH_PERFORMANCE          | Clutch performance detection       |
| `championship-implications-module`  | CHAMPIONSHIP_IMPLICATIONS   | Playoff/championship implications  |
| `playoff-intensity-module`          | PLAYOFF_INTENSITY           | Playoff intensity                  |
| `superstar-analytics-module`        | SUPERSTAR_ANALYTICS         | Star player performance tracking   |
| `ai-scanner-module`                 | AI_SCAN                     | AI-powered situation scanning      |

**NBA Pre-AI Threshold: 70** (probability must reach 70/100 before AI processing)

### WNBA Alert Cylinders (11 modules)

| Module                                  | Alert Type                      | Description                    |
|-----------------------------------------|---------------------------------|--------------------------------|
| `game-start-module`                     | GAME_START                      | Game tipoff                    |
| `fourth-quarter-module`                 | FOURTH_QUARTER                  | 4th quarter alert              |
| `final-minutes-module`                  | FINAL_MINUTES                   | Final minutes of game          |
| `two-minute-warning-module`             | TWO_MINUTE_WARNING              | Under 2 minutes remaining      |
| `high-scoring-quarter-module`           | HIGH_SCORING_QUARTER            | High-scoring quarter           |
| `low-scoring-quarter-module`            | LOW_SCORING_QUARTER             | Low-scoring quarter            |
| `clutch-time-opportunity-module`        | CLUTCH_TIME_OPPORTUNITY         | Clutch opportunity             |
| `crunch-time-defense-module`            | CRUNCH_TIME_DEFENSE             | Crunch time defense            |
| `comeback-potential-module`             | COMEBACK_POTENTIAL              | Comeback potential             |
| `wnba-championship-implications-module` | WNBA_CHAMPIONSHIP_IMPLICATIONS | Championship implications      |
| `ai-scanner-module`                     | AI_SCAN                         | AI-powered situation scanning  |

### CFL Alert Cylinders (11 modules)

| Module                             | Alert Type                 | Description                      |
|------------------------------------|----------------------------|----------------------------------|
| `game-start-module`                | GAME_START                 | Game kickoff                     |
| `fourth-quarter-module`            | FOURTH_QUARTER             | 4th quarter alert                |
| `final-minutes-module`             | FINAL_MINUTES              | Final minutes of game            |
| `two-minute-warning-module`        | TWO_MINUTE_WARNING         | Under 2 minutes remaining        |
| `third-down-situation-module`      | THIRD_DOWN_SITUATION       | 3rd down decision (CFL uses 3 downs) |
| `second-half-kickoff-module`       | SECOND_HALF_KICKOFF        | Second half kickoff              |
| `overtime-module`                  | OVERTIME                   | Overtime period                  |
| `rouge-opportunity-module`         | ROUGE_OPPORTUNITY          | CFL-specific rouge (single) opportunity |
| `grey-cup-implications-module`     | GREY_CUP_IMPLICATIONS     | Grey Cup implications            |
| `massive-weather-module`           | MASSIVE_WEATHER            | Severe weather impact            |
| `ai-scanner-module`                | AI_SCAN                    | AI-powered situation scanning    |

### Shared Module
| Module                         | Description                                        |
|--------------------------------|----------------------------------------------------|
| `ai-opportunity-scanner.ts`    | Cross-sport AI opportunity scanner base class       |

---

## 9. Game State Machine

### State Transitions

```
SCHEDULED ──► PREWARM ──► LIVE ──► FINAL ──► TERMINATED
                           │  ▲
                           ▼  │
                         PAUSED
```

| State        | Description                        | Polling Interval      |
|--------------|------------------------------------|-----------------------|
| SCHEDULED    | Game not yet started               | 30s (default)         |
| PREWARM      | T-5min: engines pre-warming        | 5s (pre-start)        |
| LIVE         | Active game, engines running       | 1s (critical/ultra-fast) |
| PAUSED       | Delayed/suspended, engines idle    | 30s                   |
| FINAL        | Game finished                      | 2s (confirmation)     |
| TERMINATED   | Cleanup complete                   | N/A                   |

### Key Properties per Game State

```typescript
interface GameStateInfo {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  currentState: GameState;
  previousState: GameState;
  stateChangedAt: Date;
  stateConfirmationCount: number;
  lastPolled: Date;
  nextPollTime: Date;
  currentPollInterval: number;
  pendingLiveConfirmation: boolean;
  liveConfirmationAttempts: number;
  isUserMonitored: boolean;
  userIds: Set<string>;
  weatherArmed: boolean;
  weatherArmReason?: WeatherArmReason;
  rawGameData?: any;
}
```

---

## 10. Calendar Sync Service

The CalendarSyncService is the **sole unified data ingestion system** for all sports data.

### Features
- Polls all 6 sport APIs on independent intervals
- Smart proximity-based polling (faster near game time)
- Feeds game data into GameStateManager for state transitions
- In-memory caching with configurable TTL
- Automatic stale game cleanup
- Performance metrics tracking

### Polling Intervals by Context

| Context                | Interval | Description                         |
|------------------------|----------|-------------------------------------|
| Default (far future)   | 30s      | Games far from start time           |
| Pre-start (T-10m)      | 5s       | Approaching game start              |
| Critical (T-2m to T+5m)| 1s       | Ultra-fast live detection           |
| Live confirmation      | 250ms    | State transition confirmation       |
| Paused/Delayed         | 30s      | Game in delay                       |
| Final confirmation     | 2s       | Game end confirmation               |

---

## 11. AI Processing Pipeline

### Unified AI Processor (`unified-ai-processor.ts` — 2,030 LOC)

The cross-sport AI enhancement pipeline processes raw alerts through OpenAI GPT-4o to generate gambling insights.

### Pipeline Flow

```
Raw Alert ──► Pre-AI Threshold Gate ──► Cross-Sport Context Builder
                                              │
                                              ▼
                                    OpenAI GPT-4o API
                                              │
                                              ▼
                                    Quality Validator
                                              │
                                              ▼
                                    Gambling Insights Composer
                                              │
                                              ▼
                                    Enhanced Alert Output
```

### Cross-Sport Context Interface

```typescript
interface CrossSportContext {
  sport: 'MLB' | 'NFL' | 'NCAAF' | 'WNBA' | 'NBA' | 'CFL';
  gameId: string;
  alertType: string;
  priority: number;
  probability: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  // Sport-specific fields (period, inning, down, etc.)
  // Weather context
  // Player performance data
}
```

### Features
- Intelligent caching with 0ms cache hits
- Circuit breaker for API failures
- Timeout protection
- Hybrid data extraction (ESPN play metadata primary, AI parsing fallback)
- Schema validation with Zod
- XSS protection on AI outputs
- Jaccard similarity for text deduplication

---

## 12. Gambling Insights Composer

### Output Structure (`GamblingInsights`)

```typescript
interface GamblingInsights {
  structuredTemplate?: string;       // Formatted with emojis
  market?: {
    moneyline?: { home?: number; away?: number };
    spread?: { points?: number; home?: number; away?: number };
    total?: { points?: number; over?: number; under?: number };
  };
  weather?: {
    impact: string;
    conditions: string;
    severity: 'low' | 'medium' | 'high';
  };
  keyPlayers?: Array<{
    name: string;
    position: string;
    relevance: string;
  }>;
  momentum?: {
    recent: string;
    trend: 'positive' | 'negative' | 'neutral';
    timeframe: string;
  };
  situation?: {
    context: string;
    significance: string;
    timing: string;
  };
  bullets?: string[];               // Actionable betting insights
  confidence?: number;              // 0-1 rating
  tags?: string[];                  // Categorization tags
}
```

### Sport-Specific Mappers
Each sport has a dedicated mapper class (extends `BaseSportMapper`) that generates sport-appropriate bullet points and context.

---

## 13. Alert Deduplication

### Unified Deduplicator

- **Alert TTL:** 5 minutes (prevents same alert from firing repeatedly)
- **Request TTL:** 30 seconds (prevents duplicate API requests)
- **Key Generation:** Composite key from `alertType + gameId + sport + context`
- **Automatic Cache Cleanup:** Periodic eviction of expired entries
- **Statistics:** Tracks total checks, duplicates blocked, and hit rate

---

## 14. Weather System

### Weather Thresholds by Sport

#### MLB (Outdoor)
| Parameter           | Threshold  | Impact                         |
|---------------------|------------|--------------------------------|
| Wind shift          | ≥20°       | Direction change alert         |
| Minimum wind speed  | ≥8 MPH     | Wind becomes relevant          |
| Outbound wind       | ≥14 MPH    | HR carry boost                 |
| Inbound wind        | ≥14 MPH    | HR suppression                 |
| Cold temperature    | ≤45°F      | Ball flight affected           |
| Hot temperature     | ≥90°F      | Pitcher stamina affected       |
| Humidity delta      | ≥10%       | Spike within 15 minutes        |
| Precipitation       | Sensitive  | Rain start/stop alerts         |
| Retractable roof    | Sensitive  | Roof state change alerts       |

#### NFL / NCAAF / CFL (Outdoor)
| Parameter           | Threshold  | Impact                         |
|---------------------|------------|--------------------------------|
| Sustained wind      | ≥18 MPH    | Passing/kicking affected       |
| Wind gusts          | ≥28 MPH    | Field goal/punt risk           |
| Cold temperature    | ≤20°F      | Wind chill threshold           |
| Heat index          | ≥95°F      | Heat stress threshold          |
| Precipitation       | Sensitive  | Rain/snow impacts              |
| Lightning           | Delay      | Stadium weather delay          |

#### NBA / WNBA (Indoor)
| Parameter           | Note                              |
|---------------------|-----------------------------------|
| Venue advisories    | Indoor — minimal weather impact   |
| Roof leaks          | Extreme weather venue advisory    |

### Weather Arming Reasons
| Reason           | Description                          |
|------------------|--------------------------------------|
| WIND_SENSITIVE   | Wind-sensitive alert armed           |
| PRECIPITATION    | Precipitation monitoring active      |
| TEMPERATURE      | Temperature extreme monitoring       |
| ROOF_STATE       | Retractable roof state tracking      |
| LIGHTNING        | Lightning delay monitoring           |
| CUSTOM           | Custom weather trigger               |

---

## 15. Polling & Timing Configuration

### Calendar Polling
| Parameter                   | Value    | Description                              |
|-----------------------------|----------|------------------------------------------|
| `defaultMs`                 | 30,000   | Default baseline polling (30s)           |
| `preStartWindowMin`         | 10       | Pre-start window begins T-10min          |
| `preStartPollMs`            | 5,000    | Pre-start polling interval (5s)          |
| `criticalWindowMin`         | 2        | Critical window begins T-2min            |
| `criticalPollMs`            | 1,000    | Critical polling interval (1s)           |
| `liveConfirmMs`             | 250      | Live confirmation interval (250ms)       |
| `requireConsecutive`        | 1        | Single confirmation needed               |
| `finalConfirmMs`            | 2,000    | Final state confirmation (2s)            |
| `pausedPollMs`              | 30,000   | Paused game polling (30s)                |

### Engine Lifecycle
| Parameter                   | Value    | Description                              |
|-----------------------------|----------|------------------------------------------|
| `tickMs`                    | 1,000    | Cylinder evaluation interval (1s)        |
| `prewarmTminusMin`          | 5        | Pre-warm starts T-5min                   |
| `prewarmLazyFetchTminusMin` | 2        | Lazy data fetch at T-2min                |
| `spinupTimeoutMs`           | 1,000    | Max engine startup time (1s)             |
| `shutdownTimeoutMs`         | 5,000    | Max engine shutdown time (5s)            |
| `healthCheckMs`             | 30,000   | Health check interval (30s)              |

### API Rate Limits & Caching
| Parameter                   | Value    | Description                              |
|-----------------------------|----------|------------------------------------------|
| `maxConcurrentCalls`        | 10       | Max concurrent API calls                 |
| `defaultTtlMs`              | 30,000   | Default cache TTL (30s)                  |
| `weatherTtlMs`              | 60,000   | Weather cache TTL (60s)                  |
| `gamesTtlMs`                | 15,000   | Games data cache TTL (15s)               |
| `batchSize`                 | 50       | Max games per batch                      |

---

## 16. Notification Delivery

### Channels

| Channel              | Method               | Description                            |
|----------------------|----------------------|----------------------------------------|
| Dashboard (Web)      | HTTP Polling         | Frontend polls `/api/alerts` every ~5s |
| Server-Sent Events   | SSE (`/realtime-alerts-sse`) | Real-time push to browser     |
| Telegram Bot         | Telegram Bot API     | Push notifications to mobile           |

### Alert Lifecycle
1. Alert cylinder fires `isTriggered()` → true
2. `generateAlert()` creates raw `AlertResult`
3. Deduplicator checks for duplicates
4. Pre-AI threshold gate (sport-specific, e.g., NBA = 70)
5. Unified AI Processor enhances with GPT-4o
6. Gambling Insights Composer adds betting context
7. Alert saved to `alerts` table with 5-minute expiry
8. Alert broadcast via SSE + available on polling endpoint
9. Telegram notification sent (if enabled for user)

---

## 17. Authentication & Authorization

### Authentication Methods
| Method   | Description                               |
|----------|-------------------------------------------|
| Local    | Username/password with bcrypt hashing      |
| Google   | OAuth2 via Google (passport-google-oauth20)|
| Apple    | Apple Sign In (prepared, not active)       |

### Session Management
- **Store:** PostgreSQL-backed (`connect-pg-simple`)
- **Cookies:** Secure, HTTP-only session cookies
- **Session Data:** `userId`, `adminUserId`, `csrfSecret`

### Role-Based Access Control
| Role     | Permissions                                       |
|----------|---------------------------------------------------|
| user     | View games, manage monitoring, configure alerts   |
| analyst  | Extended data access                              |
| manager  | Team management capabilities                      |
| admin    | Full system access, user management, system config|

### Security Measures
- CSRF tokens for admin routes
- Helmet.js HTTP security headers
- Bcrypt password hashing (via bcryptjs)
- Separate admin session namespace
- Admin users blocked from regular user routes

---

## 18. Admin Panel

### Admin Capabilities
- View and manage all users
- Assign/change user roles
- Enable/disable master alert types globally
- View AI performance dashboard and cache statistics
- Clear AI cache
- Trigger alert cleanup
- Monitor game monitoring cleanup status
- View system status and health metrics
- View Telegram debug information
- View user alert preferences
- Force delete users

### Admin Security
- Separate login endpoint (`/api/admin-auth/login`)
- CSRF token required for all mutating operations
- Admin session isolated from user sessions
- Role verification on every request

---

## 19. External Data Sources

### Primary Sports APIs

| Source              | Sports                     | Usage                              |
|---------------------|----------------------------|------------------------------------|
| MLB.com Official API| MLB                        | Live game data, play-by-play       |
| ESPN API            | NFL, NCAAF, NBA, WNBA, CFL| Live scores, game states, events   |
| SportsData.io       | All (fallback)             | Backup data source                 |

### Enhancement APIs

| Service          | Purpose                                    |
|------------------|--------------------------------------------|
| OpenAI (GPT-4o)  | AI-powered situation analysis & insights   |
| OpenWeatherMap   | Real-time venue weather data               |
| Odds API         | Live betting odds integration              |
| Telegram Bot API | Push notification delivery                 |

### Required Environment Variables / Secrets

| Variable                    | Description                    |
|-----------------------------|--------------------------------|
| `DATABASE_URL`              | PostgreSQL connection string   |
| `OPENAI_API_KEY`            | OpenAI API key for GPT-4o     |
| `OPENWEATHERMAP_API_KEY`    | Weather data API key           |
| `SESSION_SECRET`            | Express session secret         |
| User-configured: Telegram bot token, chat ID, Odds API key |

---

## 20. Performance Targets

| Metric                        | Target         | Description                              |
|-------------------------------|----------------|------------------------------------------|
| API Response Time             | < 250ms        | Sub-250ms for all API endpoints          |
| App Startup                   | < 3,000ms      | Full application startup                 |
| Live Detection (baseline)     | ≤ 20,000ms     | T-10m to T-2m detection window           |
| Live Detection (critical)     | ≤ 5,000ms      | T-2m to T+5m — GUARANTEED               |
| State Confirmation            | < 500ms        | Adds < 500ms latency                    |
| Engine Startup                | < 1,000ms      | Engine spin-up time                      |
| First Alert After Live        | < 3,000ms      | First alert generated after game goes live |
| AI Cache Hit                  | 0ms            | Instant return from intelligent cache    |

### Performance Guarantees by Detection Window

| Window                  | Maximum Latency | Description                        |
|-------------------------|-----------------|------------------------------------|
| Critical (T-2m to T+5m)| 5 seconds       | Guaranteed detection               |
| Pre-start (T-10m to T-2m)| 20 seconds    | Acceptable detection               |
| Baseline (far future)   | ~2 minutes      | Acceptable for distant games       |

---

## 21. Dependencies

### Production Dependencies (Key)

| Package                  | Version  | Purpose                               |
|--------------------------|----------|---------------------------------------|
| express                  | ^4.21.2  | HTTP server framework                 |
| drizzle-orm              | ^0.39.1  | Type-safe PostgreSQL ORM              |
| @neondatabase/serverless | ^0.10.4  | Neon PostgreSQL driver                |
| react                    | ^18.3.1  | Frontend UI library                   |
| @tanstack/react-query    | ^5.60.5  | Server state management               |
| wouter                   | ^3.3.5   | Client-side routing                   |
| zod                      | ^3.24.2  | Schema validation                     |
| drizzle-zod              | ^0.7.0   | Drizzle-Zod integration              |
| bcryptjs                 | ^3.0.2   | Password hashing                      |
| express-session          | ^1.18.2  | Session management                    |
| connect-pg-simple        | ^10.0.0  | PostgreSQL session store              |
| helmet                   | ^8.1.0   | HTTP security headers                 |
| csrf                     | ^3.1.0   | CSRF protection                       |
| pino                     | ^9.9.0   | Logging                              |
| recharts                 | ^2.15.2  | Data visualization charts             |
| framer-motion            | ^11.13.1 | Animation library                     |
| date-fns                 | ^3.6.0   | Date utilities                        |
| uuid                     | ^13.0.0  | UUID generation                       |
| cors                     | ^2.8.5   | CORS middleware                       |

### Dev Dependencies (Key)

| Package                  | Version  | Purpose                               |
|--------------------------|----------|---------------------------------------|
| vite                     | ^5.4.19  | Frontend build tool                   |
| typescript               | 5.6.3    | TypeScript compiler                   |
| tsx                      | ^4.19.1  | TypeScript execution for dev          |
| esbuild                  | ^0.25.0  | Production bundling                   |
| drizzle-kit              | ^0.30.4  | Database migrations                   |
| tailwindcss              | ^3.4.17  | Utility-first CSS                     |
| @vitejs/plugin-react     | ^4.3.2   | Vite React plugin                     |

---

## 22. File Structure

```
chirpbot-v3/
├── client/
│   └── src/
│       ├── components/
│       │   ├── ui/                    # Shadcn/UI components (18 files)
│       │   ├── AIChatInterface.tsx     # AI chat component
│       │   ├── BaseballDiamond.tsx     # MLB diamond visualization
│       │   ├── GameCardTemplate.tsx    # Game card template
│       │   ├── UniversalAlertCard.tsx  # Alert card component
│       │   ├── WeatherImpactVisualizer.tsx
│       │   ├── SportTabs.tsx
│       │   ├── PageHeader.tsx
│       │   ├── bottom-navigation.tsx
│       │   ├── roi-calculator.tsx
│       │   ├── team-logo.tsx
│       │   ├── sports-loading.tsx
│       │   ├── admin-layout.tsx
│       │   ├── RetryFeedback.tsx
│       │   └── EnhancedErrorDisplay.tsx
│       ├── hooks/
│       │   ├── use-toast.ts
│       │   ├── use-mobile.tsx
│       │   ├── use-alert-sound.ts
│       │   ├── useAuth.ts
│       │   └── useGamesAvailability.ts
│       ├── lib/
│       │   ├── queryClient.ts         # TanStack Query setup
│       │   ├── utils.ts               # Utility functions
│       │   └── team-utils.ts          # Team data utilities
│       ├── pages/
│       │   ├── calendar.tsx           # Game calendar (847 LOC)
│       │   ├── v3-dashboard.tsx       # Main dashboard (662 LOC)
│       │   ├── settings.tsx           # Settings (1,151 LOC)
│       │   ├── alerts.tsx             # Alert feed (390 LOC)
│       │   ├── landing.tsx
│       │   ├── login.tsx
│       │   ├── signup.tsx
│       │   └── not-found.tsx
│       └── App.tsx                    # App root + routing
├── server/
│   ├── config/
│   │   └── runtime.ts                # Runtime configuration (171 LOC)
│   ├── middleware/
│   │   └── memory-manager.ts
│   ├── services/
│   │   ├── engines/
│   │   │   ├── base-engine.ts         # Base engine class (377 LOC)
│   │   │   ├── mlb-engine.ts
│   │   │   ├── nfl-engine.ts
│   │   │   ├── ncaaf-engine.ts
│   │   │   ├── nba-engine.ts
│   │   │   ├── wnba-engine.ts
│   │   │   ├── cfl-engine.ts
│   │   │   ├── mlb-performance-tracker.ts
│   │   │   ├── mlb-prob-model.ts
│   │   │   └── alert-cylinders/
│   │   │       ├── ai-opportunity-scanner.ts
│   │   │       ├── mlb/               # 29 MLB cylinder modules
│   │   │       ├── nfl/               # 9 NFL cylinder modules
│   │   │       ├── ncaaf/             # 14 NCAAF cylinder modules
│   │   │       ├── nba/               # 10 NBA cylinder modules
│   │   │       ├── wnba/              # 11 WNBA cylinder modules
│   │   │       └── cfl/               # 11 CFL cylinder modules
│   │   ├── calendar-sync-service.ts   # Data ingestion (817 LOC)
│   │   ├── game-state-manager.ts      # State machine (1,189 LOC)
│   │   ├── unified-ai-processor.ts    # AI pipeline (2,030 LOC)
│   │   ├── gambling-insights-composer.ts (1,439 LOC)
│   │   ├── unified-deduplicator.ts    # Alert dedup (245 LOC)
│   │   ├── unified-health-monitor.ts
│   │   ├── unified-settings.ts
│   │   ├── weather-service.ts
│   │   ├── weather-on-live-service.ts
│   │   ├── ai-situation-parser.ts
│   │   ├── quality-validator.ts
│   │   ├── telegram.ts
│   │   ├── odds-api-service.ts
│   │   ├── alert-cleanup.ts
│   │   ├── game-monitoring-cleanup.ts
│   │   ├── settings-cache.ts
│   │   ├── text-utils.ts
│   │   ├── advanced-player-stats.ts
│   │   ├── migration-adapter.ts
│   │   ├── base-sport-api.ts
│   │   ├── mlb-api.ts
│   │   ├── nfl-api.ts
│   │   ├── ncaaf-api.ts
│   │   ├── nba-api.ts
│   │   ├── wnba-api.ts
│   │   ├── cfl-api.ts
│   │   ├── sportsdata-api.ts
│   │   └── http.ts
│   ├── routes.ts                      # API routes (5,204 LOC)
│   ├── storage.ts                     # Storage interface
│   ├── db.ts                          # Database connection
│   ├── index.ts                       # Server entry point
│   └── vite.ts                        # Vite dev server integration
├── shared/
│   ├── schema.ts                      # Database schema + types (394 LOC)
│   └── season-manager.ts             # Season scheduling logic
├── scripts/
│   ├── validate-cylinders.js          # Cylinder validation
│   └── create-cylinder.js            # Cylinder scaffolding
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
└── keep-alive.js                      # Process manager
```

---

**Total Codebase:** ~25,000+ lines of TypeScript across 120+ files  
**Alert Cylinders:** 84 modular detection units across 6 sports  
**API Endpoints:** 80+ REST endpoints  
**Database Tables:** 7 PostgreSQL tables
