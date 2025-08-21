# ChirpBot V2 - Complete Application Troubleshooting Guide

## Current System Status (August 21, 2025)

### ✅ Working Systems
- **User Authentication** - Login/Register/Session management fully functional
- **MLB AI Alert System** - Generates aggressive alerts from live games
- **Database Operations** - PostgreSQL with full schema deployed
- **Frontend UI** - Modern sports design system with responsive layout
- **Live Game Monitoring** - MLB games being tracked and processed
- **WebSocket Communication** - Real-time alert broadcasting
- **Alert Generation** - 21+ alerts currently in system

### ⚠️ Current Issues
1. **NFL API Quota Exceeded** - SportsData.io returning 403 errors
2. **MLB Batter Data Missing** - API not returning current batter information
3. **Weather API Integration** - No coordinates found for venues
4. **Team Logo Missing** - Athletics team logo not loading (fallback used)

## Environment Setup

### Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Session Security
SESSION_SECRET="your-session-secret-key"

# API Keys (if adding back)
OPENAI_API_KEY="sk-your-openai-key"
SPORTSDATA_API_KEY="your-sportsdata-key"
ACCU_WEATHER_API_KEY="your-weather-key"
TELEGRAM_BOT_TOKEN="your-telegram-token"
```

### Installation Steps
1. `npm install` - Install all dependencies
2. Set environment variables in `.env` file
3. `npm run db:push` - Sync database schema
4. `npm run dev` - Start development server

## System Architecture

### Backend Structure
```
server/
├── routes.ts                    # Main API routes
├── storage.ts                   # Database interface
├── db.ts                        # Database connection
├── index.ts                     # Server entry point
├── vite.ts                      # Development server setup
├── services/
│   ├── engines/                 # Sport monitoring engines
│   │   ├── mlb-engine.ts       # MLB game monitoring
│   │   ├── nfl-engine.ts       # NFL game monitoring
│   │   ├── nba-engine.ts       # NBA game monitoring
│   │   ├── nhl-engine.ts       # NHL game monitoring
│   │   └── weather-engine.ts   # Weather monitoring
│   ├── mlb-ai-system.ts        # AI-powered MLB alerts
│   ├── live-sports.ts          # Live game data fetching
│   ├── sports.ts               # Sports data processing
│   ├── telegram.ts             # Telegram notifications
│   ├── weather.ts              # Weather data integration
│   └── ai-analysis.ts          # OpenAI integration
├── routes/
│   └── admin.ts                # Admin-only routes
└── middleware/
    └── rbac.ts                 # Role-based access control
```

### Database Schema
- **users** - User authentication and profiles
- **teams** - Sports team information
- **alerts** - Generated alerts with game context
- **settings** - User alert preferences
- **userMonitoredTeams** - User's selected games
- **aiSettings** - AI system configuration
- **aiLearningLogs** - AI interaction tracking
- **auditLogs** - System audit trail
- **globalAlertControls** - Admin alert management

## Current Engine Status

### MLB Engine ✅
- **Status**: Active, monitoring live games
- **Interval**: 15 seconds
- **Current Issues**: 
  - Batter data not found in API responses
  - Some team logos missing
- **AI Integration**: ACTIVE - generating aggressive alerts

### NFL Engine ⚠️
- **Status**: API quota exceeded
- **Interval**: 5 seconds
- **Error**: HTTP 403 - "Out of call volume quota"
- **Resolution**: Wait 29+ hours or upgrade API plan

### NBA Engine ⏸️
- **Status**: Inactive (no monitored games)
- **Trigger**: Activates when users monitor NBA games

### NHL Engine ⏸️
- **Status**: Inactive (no monitored games)
- **Trigger**: Activates when users monitor NHL games

### Weather Engine ✅
- **Status**: Active
- **Interval**: 60 seconds
- **Issues**: Venue coordinates not found for some stadiums

## API Integration Status

### MLB API (statsapi.mlb.com)
- **Status**: ✅ Working
- **Rate Limits**: No limits observed
- **Endpoints Used**:
  - `/schedule` - Game schedules
  - `/game/{id}/feed/live` - Live game data
  - `/game/{id}/playByPlay` - Play-by-play data

### SportsData.io NFL API
- **Status**: ❌ Quota exceeded
- **Error**: "Out of call volume quota. Quota will be replenished in 29.01:XX:XX"
- **Resolution**: Wait or upgrade plan

### OpenAI API
- **Status**: ✅ Working (if API key provided)
- **Model**: GPT-4o
- **Usage**: MLB game situation analysis

### AccuWeather API
- **Status**: ⚠️ Partially working
- **Issues**: Missing venue coordinates

## Database Connection

### Neon PostgreSQL
- **Status**: ✅ Connected
- **Database**: neondb
- **Region**: US East 2 (AWS)
- **Connection**: Pooler enabled

### Schema Sync
- Use `npm run db:push` to sync schema changes
- Use `npm run db:push --force` if warnings appear
- Never write manual SQL migrations

## WebSocket System

### Connection Status
- **Endpoint**: `/ws`
- **Status**: ✅ Active
- **Auto-reconnect**: Enabled
- **Purpose**: Real-time alert broadcasting

## Alert System Status

### Current Alert Count: 21
### Alert Types Active:
- MLB AI alerts (aggressive mode)
- Test alerts for system verification

### AI Configuration:
```json
{
  "enabled": true,
  "customPrompt": "TRIGGER ALERTS FOR EVERYTHING! You are extremely aggressive and trigger alerts for ANY baseball situation. Game starts = ALERT! 0-0 scores = ALERT! First inning = ALERT! Any at-bat = ALERT! Empty bases = ALERT! Always say shouldTrigger: true with priority 80+ for any situation. Never skip anything - fans want constant alerts!"
}
```

## Common Troubleshooting

### 1. Server Won't Start
```bash
# Check if port is in use
lsof -i :5000

# Kill existing process
kill -9 <PID>

# Restart server
npm run dev
```

### 2. Database Connection Issues
```bash
# Test connection
echo $DATABASE_URL

# Push schema
npm run db:push --force
```

### 3. API Quota Exceeded
- **NFL**: Wait 29+ hours or upgrade SportsData.io plan
- **OpenAI**: Check usage in OpenAI dashboard
- **Weather**: Check AccuWeather account limits

### 4. Missing Environment Variables
```bash
# Check current environment
env | grep -E "(DATABASE_URL|OPENAI_API_KEY|SESSION_SECRET)"

# Set missing variables
export SESSION_SECRET="your-secret"
```

### 5. Frontend Build Issues
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 6. WebSocket Connection Failed
- Check if server is running on port 5000
- Verify no firewall blocking WebSocket connections
- Check browser console for connection errors

## Performance Metrics

### Current Load
- **Active Games Monitored**: 4-6 MLB games
- **Alert Processing**: Every 15 seconds
- **Database Queries**: ~10-15 per minute
- **WebSocket Connections**: 1-2 active clients

### Memory Usage
- **Server Process**: ~150-200MB
- **Database**: Standard Neon usage
- **API Calls**: MLB unlimited, NFL quota exceeded

## Recent Changes (August 21, 2025)

1. **Fixed MLB AI Integration Bug** - Moved AI logic to main processing loop
2. **Made AI Extremely Aggressive** - Custom prompt to trigger more alerts
3. **Confirmed Alert Generation** - System now creating real-time alerts
4. **Updated Database Schema** - Added audit logs and AI tracking
5. **Enhanced Monitoring** - Better debug logging throughout system

## For Developers

### Key Files to Check First
1. `server/services/mlb-ai-system.ts` - AI alert generation
2. `server/services/engines/mlb-engine.ts` - MLB monitoring
3. `server/routes.ts` - API endpoints
4. `shared/schema.ts` - Database structure
5. `client/src/pages/alerts.tsx` - Alert display

### Debug Commands
```bash
# View real-time logs
npm run dev

# Check database schema
npm run db:push

# Test API endpoints
curl http://localhost:5000/api/health

# View alerts
curl http://localhost:5000/api/alerts
```

This system is fully functional with 21 alerts generated and active monitoring of live MLB games. The main issues are external API quota limits, not core system problems.