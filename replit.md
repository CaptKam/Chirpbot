# Overview

ChirpBot V2 is a fully functional modern sports alert application providing real-time notifications and AI-enhanced insights for sports events. Successfully deployed and tested on August 18, 2025, the application monitors sports teams across multiple leagues (MLB, NFL, NBA, NHL) using authentic ESPN API data and generates intelligent alerts for high-impact game situations. Built with a React frontend, Express backend, and PostgreSQL database, the app integrates with OpenAI for contextual analysis, weather services for environmental data, and includes Telegram notification capabilities. 

**Design System Updates (August 18, 2025):**
- Implemented modern, bold, sports-centric design with professional color palette
- Primary colors: #F2F4F7 (background), #1C2B5E (accent), #2387F4 (CTA blue), #F02D3A (alert red)
- Typography: Bold uppercase headings with letter spacing, Inter font family
- UI Components: Game cards with 12px rounded corners, shadow on hover, full-width responsive design
- Active monitoring indicated with blue border and background

Features persistent team monitoring that saves user game selections to the database and restores them on page reload. Alert generation system correctly filters for live games only.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes (August 18, 2025)

## Modern Alert Design Overhaul (August 18, 2025)
- **Complete UI Redesign**: Modern, clean alerts with instant visual clarity
- **Eliminated Team Name Repetition**: Team names shown once in clean "Away @ Home" format
- **Removed Score Clutter**: Eliminated distracting score displays per user feedback
- **Visual Hierarchy**: Color-coded headers with icons for immediate alert type recognition
- **Simplified Descriptions**: Focused on essential alert information without redundant details
- **Professional Cards**: Clean layout with proper spacing and modern shadows
- **Instant Understanding**: Users can now immediately understand what each alert means

## Enhanced RISP Alert System (August 18, 2025)
- **Issue**: RISP alerts were generating incorrectly when no runners were on base
- **Solution**: Fixed alert logic to only trigger when runners actually in scoring position (2B or 3B)
- **Enhancement**: Added batter quality factor - alerts now include detailed batter stats and profile
- **Batter Profiles**: Power Hitter, Clutch Performer, Contact Hitter, Veteran Leader, Rising Star, Regular Player
- **Smart Probability**: 90% alert chance with good batters + RISP, 40% with average batters + RISP
- **Rich Context**: Alerts now show "Power Hitter at bat (.285, 25 HR, 70% clutch)" with runner positions
- **Impact**: RISP alerts are now highly accurate and provide valuable context for betting/fantasy decisions

## Ultra-Fast Real-Time Performance Optimization
- **Performance Goal**: Fastest possible alerts - every second counts for sports betting and live trading decisions
- **Frontend Updates**: Reduced refresh intervals to 2-5 seconds across all critical data fetches
- **Alert System**: Alerts now update every 2 seconds (down from 30 seconds) with zero staleness tolerance
- **Game Data**: Live game updates every 5 seconds for immediate status changes  
- **Backend Generation**: Alert generation accelerated to 15-30 seconds (down from 1-2 minutes)
- **Impact**: Near real-time performance for time-critical sports alerts and live game monitoring

## Enhanced Alert Content for Better User Value
- **Rich Context**: Improved alert descriptions with detailed game context and momentum analysis
- **Clean Layout**: Removed cluttered betting metrics per user feedback, focusing on essential information
- **Game Information**: Real-time scores and game status with live updates
- **Visual Enhancements**: Color-coded status indicators and momentum shift animations
- **Weather Integration**: Impact assessments for outdoor games affecting play conditions
- **Professional Display**: Streamlined alert cards with essential information and clear visual hierarchy

## Advanced Mathematical Alert Engine
- **Sophisticated Logic**: Integrated comprehensive multi-sport alert engine with real mathematical calculations
- **Scoring Probabilities**: NFL red zone scoring chances (72% for 3rd & short, 48% for 4th down, 38% for late drives)
- **Priority System**: Dynamic priority scoring based on game closeness, timing, and situation criticality
- **Detailed Scenarios**: 20+ specific game situations per sport with precise statistical analysis
- **Real Calculations**: Authentic sports mathematics replacing basic placeholder logic
- **Enhanced Filtering**: Sport-specific alert filtering with granular user preference controls

## Advanced Alert System Implementation
- **Feature**: Comprehensive multi-sport alert engine with 16 user-controllable toggles
- **Implementation**: Core alert logic with context-aware filtering for MLB, NFL, NBA, NHL
- **Database**: Added 16 new boolean columns for sport-specific alert preferences
- **Frontend**: Advanced settings page with sport-specific toggle controls
- **Alert Engine**: Real-time processing with priority-based alert generation and user preference filtering
- **Sports Coverage**:
  - MLB: Game state, RISP, weather impact, and power batter alerts
  - NFL: Red zone, two-minute warnings, fourth down conversions, and turnover alerts
  - NBA: Clutch time, overtime, lead changes, and close game finish alerts  
  - NHL: Power play, empty net, third period ties, and final minute close game alerts
- **Performance**: Fast alert processing with immediate user preference application

## Production Deployment Fixes
- **Issue**: Login not working on deployed version due to session storage and cookie settings
- **Root Cause**: Using in-memory session store and incompatible cookie security settings
- **Solution**: Implemented PostgreSQL-based session storage with Replit-compatible cookie configuration
- **Configuration**: Set secure: false and sameSite: "lax" for Replit deployment compatibility
- **Database**: Created session table with 10+ active sessions for persistent session management
- **Test Accounts**: Created multiple working accounts (captkam, captkam2, prodtest, deploytest) for deployment testing
- **Status**: ✅ **RESOLVED** - Login confirmed working on August 18, 2025 with successful authentication flow

## Authentication & Game Persistence Fix
- **Issue**: Game selections were not persisting between login sessions
- **Root Cause**: Frontend was using hardcoded test user ID "test-user-123" instead of actual authenticated user ID
- **Solution**: Updated calendar.tsx to use real user ID from useAuth hook for all monitored game operations
- **Impact**: User game selections now properly persist with their account across login sessions
- **Database**: All monitored games now correctly reference the authenticated user's actual ID

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