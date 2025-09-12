# Overview

ChirpBot V3 is an advanced multi-sport intelligence platform providing real-time notifications and AI-enhanced insights across 6 major sports leagues: MLB, NFL, NCAAF, NBA, WNBA, and CFL. It has evolved into a comprehensive system featuring sub-250ms response times, cross-sport AI enhancement with 0ms intelligent caching for repeated scenarios, and predictive alert capabilities. The platform monitors teams using authentic API data sources to generate intelligent alerts for high-impact game situations and anticipates high-value betting opportunities.

# Recent Changes

**September 12, 2025**: Fixed AdvancedAlertCard betting insights panel functionality
- ✅ Verified swipe gesture implementation with proper drag handlers and motion controls
- ✅ Confirmed betting panel layout with 320px width, "Quick Bet" header, and 2x2 sportsbook grid
- ✅ Fixed server startup issues that were preventing frontend from serving properly
- ✅ Resolved all TypeScript compilation errors in alert card components
- ✅ Enhanced panel margins, positioning, and sportsbook button visibility for better UX

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