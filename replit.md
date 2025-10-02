# Overview

ChirpBot V3 is an advanced multi-sport betting intelligence platform that provides real-time notifications, gambling insights, and AI-enhanced analysis across six major sports leagues: MLB, NFL, NCAAF, NBA, WNBA, and CFL. The platform delivers sub-250ms response times, cross-sport AI enhancement with 0ms intelligent caching, and predictive alert capabilities. It monitors teams using authentic API data sources to generate intelligent alerts for high-impact game situations and anticipates high-value betting opportunities with probability calculations and wagering recommendations.

# Recent Changes

## October 2, 2025 - MLB Alert Cylinder Bug Fixes
- **Deduplication Fixed**: Resolved critical bug where 5 MLB cylinders (momentum-shift, high-scoring-situation, wind-change, clutch-situation, pitching-change) used `Date.now()` in alertKeys, causing deduplication to fail and alert spam. Now using stable game context (inning + top/bottom).
- **Late-Inning Logic Fixed**: Fixed late-inning-close module that fired for all Top 7 games regardless of score. Now properly checks if game is close (≤3 runs difference) before triggering.
- **RISP Module Registered**: Added orphaned RISP_PROB_ENHANCED module to mlb-engine.ts registry (was in codebase but never loaded).
- **Code Cleanup**: Removed dead `buildEnhancedMessage()` method from bases-loaded-no-outs-module.ts. Fixed syntax error (extra brace) in high-scoring-situation-module.ts.
- **System Status**: MLB now has 27 active cylinders (up from 26), all deduplication issues resolved, 6 engines healthy.

## October 1, 2025 - Services Folder Cleanup
- **NHL Removal**: Completely removed NHL support (not a supported sport). Deleted `nhl-api.ts`, updated routes, schema, season-manager, and storage to only include the 6 supported sports: MLB, NFL, NCAAF, NBA, WNBA, CFL.
- **Dead Code Removal**: Removed `telegram-examples.md` (unused documentation).
- **Bug Fixes**: Fixed TypeScript error in `weather-on-live-service.ts` where payload could be undefined.
- **System Status**: All engines healthy, no LSP errors, MLB alerts generating correctly.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite.
- **UI Library**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with a modern, bold, sports-centric design system featuring a specific color palette, Inter font family, 12px rounded corners, and shadow-lg hover effects.
- **State Management**: TanStack Query for server state with WebSocket integration.
- **Routing**: Wouter for lightweight client-side routing.
- **Design**: Mobile-first responsive design.

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API, optimized for sub-250ms response times.
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe operations.
- **Multi-Sport Engine System**: 6 specialized engines (MLB, NFL, NCAAF, NBA, WNBA, CFL) with unified, event-driven architecture.
- **AsyncAI Processing**: Background AI enhancement with intelligent queuing and timeout protection, including an OpenAI-powered situation parser with caching and circuit breaker protection. Hybrid data extraction strategy: prioritizes ESPN play metadata (down, distance) for accuracy and speed, with AI parsing as fallback for missing fields.
- **Adaptive Polling Manager**: Intelligent game state detection with sport-specific polling intervals.
- **Real-time Communication**: WebSocket server for live alert broadcasting and enhanced alert delivery.
- **Session Management**: Express sessions with PostgreSQL session store.
- **Build System**: ESBuild for production bundling with TypeScript support.
- **System Stability**: Robust error handling, auto-recovery, and a `keep-alive.js` process manager.
- **Concurrency Control**: Implemented queue-based per-game and per-sport mutex locks to prevent race conditions and ensure idempotent transitions.
- **Data Ingestion**: CalendarSyncService as the sole unified data ingestion system across all leagues.

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM.
- **Schema Design**: Entities for users, teams, alerts, settings, and `user_monitored_teams`.
- **Persistence**: User game selections saved for cross-session persistence.
- **Session Storage**: PostgreSQL-backed session management using `connect-pg-simple`.
- **Migration System**: Drizzle Kit for database schema migrations.

## Authentication & Authorization
- **Authentication**: Session-based authentication using Express sessions and secure cookies.
- **User Management**: Basic username/password system.
- **API Security**: Session-based request authorization for protected endpoints.

## Real-time Features
- **WebSocket Integration**: Live alert broadcasting with automatic reconnection and enhanced delivery.
- **Alert Processing**: Real-time sports event monitoring with AsyncAI processing and intelligent caching (0ms cache hits).
- **Team Monitoring**: Dynamic enable/disable of team tracking with instant updates.
- **Persistent Game Selection**: User choices saved to database and restored on page reload.
- **Deduplication**: Context-aware deduplication system for alerts.
- **Predictive Analytics**: On-Deck Prediction Module and enhanced Wind Change Detection for MLB, and real-time batter/pitcher/team performance tracking.

# External Dependencies

## AI Services
- **OpenAI API**: GPT-4o integration for sports alert analysis and context generation.
- **AsyncAI Processor**: Custom background AI enhancement with intelligent caching and probability-based filtering (≥75).

## Communication Services
- **Telegram Bot API**: Push notification delivery for alerts.

## Weather Integration
- **OpenWeatherMap API**: Real-time weather data for outdoor sports venues, with a mock data fallback.

## Sports Data
- **MLB.com Official API**: Primary data source for MLB games.
- **ESPN API Integration**: Real-time sports data for NFL, NCAAF, NBA, WNBA, CFL.

## Infrastructure Services
- **Neon Database**: PostgreSQL hosting with serverless architecture.
- **Replit Platform**: Development and deployment environment.
- **Google Fonts**: CDN for typography.