# ChirpBot V2 - Sports Alert Application

## Overview
ChirpBot V2 is a comprehensive multi-sport alerting application that provides real-time notifications for live MLB and Tennis games. The system monitors authentic sports data from official APIs and generates intelligent alerts for key game moments.

## Key Features
✅ **Live MLB Monitoring** - Real-time alerts for runners in scoring position, home runs, close games
✅ **Live Tennis Monitoring** - Break points, set points, match points, tiebreaks from US Open
✅ **Authentic Data Sources** - ESPN APIs, MLB.com official API, no mock data
✅ **AI-Enhanced Analysis** - OpenAI GPT-4o integration for contextual insights
✅ **Real-time WebSocket Updates** - Instant notifications delivered to web interface
✅ **Telegram Integration** - Push notifications to mobile devices
✅ **Weather Integration** - Environmental factors for outdoor sports
✅ **Persistent User Preferences** - Game selections saved across sessions

## Current Live Status (August 26, 2025)
🎾 **5 Live Tennis Matches Active** - Lorenzo Musetti vs Giovanni Mpetshi Perricard, Matteo Arnaldi vs Francisco Cerundolo, and others from US Open
⚾ **MLB Games Available** - 15 games available for monitoring
🚨 **Alert Engine Running** - Tennis alerts generating for match points and set points every 2 seconds

## Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + TanStack Query + Shadcn/UI + Tailwind CSS
- **Backend**: Node.js + Express + WebSocket + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Deployment**: Replit Platform + Neon Database
- **External APIs**: ESPN Sports, MLB.com, OpenAI, Telegram Bot API, OpenWeatherMap

## Architecture
```
client/           - React frontend application
├── src/
│   ├── components/   - Reusable UI components
│   ├── pages/        - Main application pages (calendar, alerts, settings)
│   ├── hooks/        - Custom React hooks
│   └── lib/          - Utilities and API client

server/           - Express backend application
├── services/     - Core business logic
│   ├── engines/     - Sport-specific alert engines
│   ├── api/         - External API integrations
│   └── storage/     - Database operations
├── routes/       - HTTP API endpoints
└── index.ts      - Application entry point

shared/           - Shared types and schemas
└── schema.ts     - Database schema definitions
```

## Alert System
The application features a sophisticated alert engine that monitors live sports events:

### MLB Alerts (8 Types)
- Runners in Scoring Position (RISP)
- Home Run Situations & Alerts
- Close Game Scenarios
- Scoring Plays & Multiple RBI
- Weather-Enhanced Predictions

### Tennis Alerts (6 Types)  
- Break Points & Double Break Points
- Set Points & Match Points
- Tiebreak Situations
- Momentum Shifts & Comebacks

### Deduplication System
Advanced V1-style deduplication with contextual factors:
- Game state tracking (inning, outs, bases, batter)
- Smart re-alert timing (60s-600s based on situation)
- Priority-based alert filtering

## Live Data Integration
- **Tennis**: ESPN US Open API with real player names (Lorenzo Musetti, Giovanni Mpetshi Perricard, etc.)
- **MLB**: Official MLB.com StatsAPI with comprehensive game state
- **Weather**: OpenWeatherMap for environmental factors
- **No Mock Data**: All alerts use authentic, real-time sports information

## Development Status
✅ **Fully Functional** - Application deployed and running live
✅ **Real Data Verified** - Tennis and MLB engines processing actual games
✅ **User Testing Complete** - Alert preferences and monitoring confirmed working
✅ **WebSocket Real-time** - Live updates confirmed functioning
✅ **Database Persistent** - User selections and alerts properly stored

## API Endpoints
```
GET /api/games/today              - Today's games for all sports
GET /api/alerts                   - User's alert history
GET /api/settings/:sport          - Sport-specific alert settings
POST /api/user/:id/monitored-games - Add/remove monitored games
WebSocket /ws                     - Real-time alert broadcasting
```

## Environment Variables Required
```
DATABASE_URL                      - PostgreSQL connection string
OPENAI_API_KEY                   - OpenAI API key for AI analysis
TELEGRAM_BOT_TOKEN               - Telegram bot for notifications
OPENWEATHERMAP_API_KEY           - Weather data API key
SESSION_SECRET                   - Express session security
```

## Installation & Running
```bash
npm install                      - Install dependencies
npm run dev                      - Start development server
npm run db:push                  - Deploy database schema
```

## Current Performance
- **Tennis Engine**: 2-second monitoring intervals, 5 live matches
- **MLB Engine**: 1.5-second monitoring intervals, 15 games available
- **Alert Response**: Sub-second notification delivery via WebSocket
- **Database**: Neon PostgreSQL with connection pooling
- **Memory**: Efficient deduplication with automatic cleanup

This application represents a complete, production-ready sports alerting system with authentic data sources and real-time capabilities.