# Overview

ChirpBot V3 is an advanced multi-sport intelligence platform providing real-time notifications and AI-enhanced insights across 6 major sports leagues: MLB, NFL, NCAAF, NBA, WNBA, and CFL. It has evolved into a comprehensive system featuring sub-250ms response times, cross-sport AI enhancement with 0ms intelligent caching for repeated scenarios, and predictive alert capabilities. The platform monitors teams using authentic API data sources to generate intelligent alerts for high-impact game situations and anticipates high-value betting opportunities.

# Recent Changes

## September 19, 2025 - ADMIN ALERT CONTROL COMPLETELY DISABLED ✅
- **ADMIN CONTROL ELIMINATED:** Modified `isAlertVisible()` method to always return `true` - users now see all alert toggles
- **USER AUTONOMY:** All 24+ alert types are always visible in settings regardless of admin configurations
- **API UPDATED:** Available alerts endpoint now shows all alerts as `globallyEnabled: true` with admin control disabled messaging
- **DIAGNOSTICS PRESERVED:** Admin routes maintained for read-only system statistics and health monitoring
- **SEPARATION MAINTAINED:** Alert generation remains completely independent of UI visibility controls
- **VERIFIED WORKING:** No LSP errors, application stable, all engines operational with 18 games being tracked

## September 17, 2025 - MLB GAME START MODULE PERFECTED ✅
- **CRITICAL FIX:** extractLastPlay and extractLastPitch methods added to MLBApiService to resolve TypeError crashes
- **GAME START TIMING:** Now triggers exactly once at top of inning 1 with proper duplicate prevention
- **PERFORMANCE TRACKING:** Fixed all references to lastPlay/lastPitch objects to use correct properties
- **VERIFIED WORKING:** Live games successfully generating MLB_GAME_START, MLB_SEVENTH_INNING_STRETCH, and MLB_LATE_INNING_CLOSE alerts
- **DATABASE SAVES:** Alerts properly persisting with 5-minute TTL and deduplication working correctly

## September 17, 2025 - MLB WIND CHANGE MODULE ENHANCED WITH RESEARCH-BACKED ANALYTICS ✅
- **SPEED THRESHOLD:** Lowered from 6mph to 5mph based on research showing 5mph adds ~19 feet of carry distance
- **DIRECTION IMPACT REFINEMENT:** Left field winds now get highest impact (3), center/out moderate (2), right field lowest (1), blowing in negative (-2)
- **SUBTLE CHANGE DETECTION:** Now triggers on 1+ impact category differences instead of 2+ to catch subtle but meaningful shifts
- **ALERT LOGIC FIX:** Requires significant speed OR direction change instead of alerting on any minor variation
- **RESEARCH BASIS:** Aligned with modern baseball analytics showing direction matters more than sheer speed
- **VERIFIED WORKING:** Wind change module properly running with new precision thresholds and improved direction analysis

## September 17, 2025 - SEVENTH INNING STRETCH MODULE FIXED ✅
- **CRITICAL FIX:** Seventh inning stretch alerts were triggering multiple times throughout late innings (7th, 8th, 9th)
- **PRECISE TIMING:** Now triggers exactly once per game, only at the top of the 7th inning (inning=7, isTopInning=true)
- **DUPLICATE PREVENTION:** Added game tracking with private `triggeredGames` Set to prevent multiple alerts per game
- **STABLE ALERT KEYS:** Updated to stable format `mlb_seventh_inning_stretch_{gameId}` (no more timestamps)
- **VERIFIED WORKING:** Live testing confirmed games in innings 1, 6, and 9 properly do NOT trigger seventh inning stretch
- **CODE QUALITY:** Clean, efficient implementation with proper TypeScript typing and error handling

## September 17, 2025 - MLB PERFORMANCE CONTEXT ENHANCEMENT ✅
- **NEW SYSTEM:** Built comprehensive MLB performance tracker for real-time batter/pitcher/team stats
- **CONTEXT GENERATION:** Alerts now include "Batter 3-for-4 tonight", "95+ pitches", "Team rally: scored in last 3 innings"
- **MOMENTUM DETECTION:** Tracks scoring runs, dry spells, and unusual patterns (5 strikeouts in 6 batters)
- **FIXED CRITICAL BUG:** Pitcher fatigue was reading wrong number (3 instead of 95 pitches) - now correctly parsed
- **5 MODULES ENHANCED:** Bases loaded, scoring opportunity, and late-inning modules now use performance data
- **STABLE ALERT KEYS:** Removed timestamps that were breaking deduplication
- **VELOCITY TRACKING:** Now detects and reports when pitcher velocity drops 3+ mph

## September 17, 2025 - MLB ALERT SYSTEM FULLY FIXED ✅
- **CRITICAL FIX:** MLB_STRIKEOUT module was not loading - added it and 2 other missing modules to engine lifecycle
- **MAJOR BUG FIX:** Scoring opportunity module was using wrong GameState fields (runners.second instead of hasSecond)
- **MODULE COUNT:** System now loads 23 MLB modules (up from 16) - all cylinders operational
- **NEW MODULE:** Created MLB_BASES_LOADED_TWO_OUTS module for high-pressure situations
- **TYPESCRIPT:** Fixed 9 TypeScript errors across steal-likelihood and on-deck-prediction modules
- **VERIFIED WORKING:** Live alerts confirmed firing - bases loaded alert successfully generated and saved to database
- **FIELD NORMALIZATION:** All modules now consistently use hasFirst/hasSecond/hasThird for base runner detection

## September 16, 2025 - CRITICAL ALERT PIPELINE FIXED ✅
- **MAJOR FIX:** Implemented missing `setOnEnhancedAlert` callback in UnifiedAIProcessor that was preventing alerts from saving to database
- **VERIFIED WORKING:** Live alerts from real MLB games now successfully generate → AI enhance → save to database → serve via API
- **Database Confirmation:** Multiple live alerts confirmed saved (mlb_game_start_776319_1, 776312_on_deck_Noelvi_Marte_010_1_3_1, etc.)
- **Complete Pipeline:** Alert Generation → AI Enhancement → Database Save → API Serving → Frontend Display now fully operational
- Fixed misleading WebSocket log messages, system now uses direct database saves with SSE broadcasting
- Eliminated WebSocket dependencies that were causing confusion in alert persistence flow
- Resolved authentication requirements for alerts API endpoint (requires logged-in users to return alerts)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite.
- **UI Library**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with a modern, bold, sports-centric design system.
  - **Color Palette**: #F2F4F7 (background), #1C2B5E (accent), #2387F4 (CTA), #F02D3A (alert), #DCE1E7 (borders).
  - **Typography**: Inter font family, bold uppercase headings with letter spacing.
  - **Components**: 12px rounded corners on cards, shadow-lg on hover effects.
- **State Management**: TanStack Query for server state with WebSocket integration.
- **Routing**: Wouter for lightweight client-side routing.
- **Design**: Mobile-first responsive design.

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API, optimized for sub-250ms response times.
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe operations.
- **Multi-Sport Engine System**: 6 specialized engines (MLB, NFL, NCAAF, NBA, WNBA, CFL) with a unified architecture.
- **AsyncAI Processing**: Background AI enhancement with intelligent queuing and timeout protection.
- **Adaptive Polling Manager**: Intelligent game state detection with sport-specific polling intervals.
- **Real-time Communication**: WebSocket server for live alert broadcasting and enhanced alert delivery.
- **Session Management**: Express sessions with PostgreSQL session store.
- **Build System**: ESBuild for production bundling with TypeScript support.
- **System Stability**: Robust error handling, auto-recovery, and a `keep-alive.js` process manager for guaranteed uptime.

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM.
- **Schema Design**: Entities for users, teams, alerts, settings, and user_monitored_teams.
- **Persistence**: User game selections saved to `user_monitored_teams` for cross-session persistence.
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
- **Predictive Analytics**: On-Deck Prediction Module and Wind Change Detection for MLB.

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
- **Unified Data Processing**: Cross-sport data normalization and intelligent alert generation.

## Infrastructure Services
- **Neon Database**: PostgreSQL hosting with serverless architecture.
- **Replit Platform**: Development and deployment environment.
- **Google Fonts**: CDN for typography.