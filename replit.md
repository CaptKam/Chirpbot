# Overview

ChirpBot V3 is an advanced multi-sport betting intelligence platform offering real-time notifications, gambling insights, and AI-enhanced analysis across MLB, NFL, NCAAF, NBA, WNBA, and CFL. It delivers sub-250ms response times, cross-sport AI enhancement with 0ms intelligent caching, and predictive alert capabilities. The platform monitors teams using authentic API data to generate intelligent alerts for high-impact game situations and anticipates high-value betting opportunities with probability calculations and wagering recommendations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite).
- **UI Library**: Shadcn/ui (Radix UI primitives).
- **Styling**: Tailwind CSS with a modern, bold, sports-centric design, specific color palette, Inter font, 12px rounded corners, and shadow-lg hover effects.
- **State Management**: TanStack Query for server state with WebSocket integration.
- **Routing**: Wouter for lightweight client-side routing.
- **Design**: Mobile-first responsive.

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API, optimized for sub-250ms response times.
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe operations.
- **Multi-Sport Engine System**: 6 specialized, unified, event-driven engines (MLB, NFL, NCAAF, NBA, WNBA, CFL).
- **AsyncAI Processing**: Background AI enhancement with intelligent queuing, timeout protection, OpenAI-powered situation parsing (caching and circuit breaker), and hybrid data extraction (ESPN play metadata primary, AI parsing fallback).
- **Adaptive Polling Manager**: Intelligent game state detection with sport-specific polling intervals.
- **Real-time Communication**: WebSocket server for live alert broadcasting and enhanced alert delivery.
- **Session Management**: Express sessions with PostgreSQL session store.
- **Build System**: ESBuild for production bundling with TypeScript.
- **System Stability**: Robust error handling, auto-recovery, and `keep-alive.js` process manager.
- **Concurrency Control**: Queue-based per-game and per-sport mutex locks for race condition prevention and idempotent transitions.
- **Data Ingestion**: CalendarSyncService as the sole unified data ingestion system.

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM.
- **Schema Design**: Entities for users, teams, alerts, settings, and `user_monitored_teams`.
- **Persistence**: User game selections saved for cross-session persistence.
- **Session Storage**: PostgreSQL-backed session management using `connect-pg-simple`.
- **Migration System**: Drizzle Kit for database schema migrations.

## Authentication & Authorization
- **Authentication**: Session-based using Express sessions and secure cookies.
- **User Management**: Basic username/password system.
- **API Security**: Session-based request authorization for protected endpoints.

## Real-time Features
- **WebSocket Integration**: Live alert broadcasting with auto-reconnection and enhanced delivery.
- **Alert Processing**: Real-time sports event monitoring with AsyncAI processing and intelligent caching (0ms cache hits).
- **Team Monitoring**: Dynamic enable/disable of team tracking with instant updates.
- **Persistent Game Selection**: User choices saved and restored.
- **Deduplication**: Context-aware deduplication system for alerts.
- **Predictive Analytics**: On-Deck Prediction Module, enhanced Wind Change Detection for MLB, and real-time batter/pitcher/team performance tracking.

# External Dependencies

## AI Services
- **OpenAI API**: GPT-4o integration for sports alert analysis and context generation.

## Communication Services
- **Telegram Bot API**: Push notification delivery for alerts.

## Weather Integration
- **OpenWeatherMap API**: Real-time weather data for outdoor sports venues.

## Sports Data
- **MLB.com Official API**: Primary data source for MLB games.
- **ESPN API Integration**: Real-time sports data for NFL, NCAAF, NBA, WNBA, CFL.

## Infrastructure Services
- **Neon Database**: PostgreSQL hosting with serverless architecture.
- **Replit Platform**: Development and deployment environment.
- **Google Fonts**: CDN for typography.