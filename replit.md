# Overview

ChirpBot V2 is a fully functional modern sports alert application providing real-time notifications and AI-enhanced insights for sports events. Successfully deployed and tested on August 18, 2025, the application monitors sports teams across multiple leagues (MLB, NFL, NBA, NHL) using authentic ESPN API data and generates intelligent alerts for high-impact game situations. Built with a React frontend, Express backend, and PostgreSQL database, the app integrates with OpenAI for contextual analysis, weather services for environmental data, and includes Telegram notification capabilities. 

**Design System Updates (August 18, 2025):**
- Implemented modern, bold, sports-centric design with professional color palette
- Primary colors: #F2F4F7 (background), #1C2B5E (accent), #2387F4 (CTA blue), #F02D3A (alert red)
- Typography: Bold uppercase headings with letter spacing, Inter font family
- UI Components: Game cards with 12px rounded corners, shadow on hover, full-width responsive design
- Active monitoring indicated with blue border and background

Features persistent team monitoring that saves user game selections to the database and restores them on page reload. 

**Advanced Predictive Alert System (August 18, 2025):**
- Comprehensive alert engine with sophisticated logic for MLB, NFL, NBA, NHL
- Real-time ESPN API integration for authentic game context analysis
- Priority-based alerts (high/medium/low) with confidence scoring (70-95%)
- Predictive time windows ("This at-bat", "Next 2 minutes", "Final minutes")
- Context-aware analysis: inning situations, field position, score gaps, game clock
- BEFORE-event prediction focus: alerts trigger before critical moments happen

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes (August 18, 2025)

## Authentication & Game Persistence Fix
- **Issue**: Game selections were not persisting between login sessions
- **Root Cause**: Frontend was using hardcoded test user ID "test-user-123" instead of actual authenticated user ID
- **Solution**: Updated calendar.tsx to use real user ID from useAuth hook for all monitored game operations
- **Impact**: User game selections now properly persist with their account across login sessions
- **Database**: All monitored games now correctly reference the authenticated user's actual ID

## Advanced Predictive Alert Engine Implementation
- **New Alert Engine**: Created `server/services/alert-engine.ts` with comprehensive predictive logic
- **ESPN API Integration**: Enhanced `live-sports.ts` with detailed game data extraction and context analysis
- **Smart Alert Types**: 
  - MLB: RISP situations, late-inning pressure, power hitter scenarios, weather impacts
  - NFL: Two-minute drills, red zone opportunities, 4th down decisions, game-winning drives
  - NBA: Clutch time alerts, shot clock pressure situations
  - NHL: Power play opportunities, empty net scenarios
- **Confidence Scoring**: AI-powered confidence ratings (70-95%) based on historical game data
- **Predictive Windows**: Time-specific predictions for when events will likely occur
- **Real-time Analysis**: 30-second interval checking of live ESPN game data
- **Priority System**: High/medium/low alert classification for user notification management

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessible, modern interfaces
- **Styling**: Tailwind CSS with ChirpBot V2 design system
  - Color Palette: #F2F4F7 (bg), #1C2B5E (accent), #2387F4 (CTA), #F02D3A (alert), #DCE1E7 (borders)
  - Typography: Inter font family, bold uppercase headings with letter spacing
  - Components: 12px rounded corners on cards, shadow-lg on hover effects
- **State Management**: TanStack Query for server state with WebSocket integration for real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Responsive design optimized for mobile devices with sticky bottom navigation

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Real-time Communication**: WebSocket server for live alert broadcasting to connected clients
- **Session Management**: Express sessions with PostgreSQL session store
- **Build System**: ESBuild for production bundling with TypeScript support

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Five main entities - users, teams, alerts, settings, and user_monitored_teams
- **Persistent Monitoring**: User game selections saved to user_monitored_teams table for cross-session persistence
- **Session Storage**: PostgreSQL-backed session management using connect-pg-simple
- **Migration System**: Drizzle Kit for database schema migrations
- **Storage Classes**: DatabaseStorage for production, MemStorage fallback for testing

## Authentication & Authorization
- **Session-based Authentication**: Express sessions with secure cookie management
- **User Management**: Basic username/password authentication system
- **API Security**: Session-based request authorization for protected endpoints

## Real-time Features
- **WebSocket Integration**: Live alert broadcasting with automatic reconnection
- **Alert Processing**: Real-time sports event monitoring with AI analysis
- **Team Monitoring**: Dynamic enable/disable of team tracking with instant updates
- **Persistent Game Selection**: User game choices automatically saved to database and restored on page reload

# External Dependencies

## AI Services
- **OpenAI API**: GPT-4o integration for sports alert analysis and context generation
- **Confidence Scoring**: AI-powered confidence ratings for alert reliability

## Communication Services
- **Telegram Bot API**: Push notification delivery with rich formatting and markdown support
- **Connection Testing**: Built-in Telegram connectivity validation

## Weather Integration
- **OpenWeatherMap API**: Real-time weather data for outdoor sports venues
- **Fallback System**: Mock weather data when API keys are unavailable
- **Location-based Data**: City-specific weather conditions for game context

## Sports Data
- **ESPN API Integration**: Real-time sports data from ESPN's public API endpoints
- **Live Game Filtering**: Alert generation only occurs for games that are actually happening
- **Multi-sport Support**: MLB, NFL, NBA, NHL event types and monitoring
- **Game State Tracking**: Real-time game status and scoring updates from authentic sources

## Infrastructure Services
- **Neon Database**: PostgreSQL hosting with serverless architecture (Migration completed August 18, 2025)
  - Connection: ep-twilight-sound-aeg8aaaf-pooler.c-2.us-east-2.aws.neon.tech
  - Database: neondb
  - Region: US East 2 (AWS)
  - Pooler mode enabled for optimal performance
- **Replit Platform**: Development and deployment environment with WebSocket support
- **CDN Integration**: Google Fonts for typography and external asset delivery