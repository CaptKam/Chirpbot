# ChirpBot V2 - Technical Implementation Details

## Live System Status (August 26, 2025)
The application is currently running live with real sports data:

### Active Tennis Monitoring
```
🎾 Found 5 live tennis matches
🎾 Processing tennis alerts for:
   - Lorenzo Musetti vs Giovanni Mpetshi Perricard (US Open)
   - Matteo Arnaldi vs Francisco Cerundolo (US Open)
   - Denis Shapovalov vs Marton Fucsovics (US Open)
   - Katie Boulter vs Marta Kostyuk (Women's US Open)
   - Victoria Jimenez Kasintseva vs Maya Joint (Women's US Open)

🚨 Alert Types Active:
   ✅ Match Points (Priority: 100)
   ✅ Set Points (Priority: 95)  
   ✅ Break Points (Priority: 85)
   ⏸️  Double Break Points (disabled in settings)
   ⏸️  Tiebreaks (disabled in settings)
   ⏸️  Momentum Shifts (disabled in settings)
```

### Alert Processing Pipeline
```
🎾 Tennis engine monitoring every 2000ms
⚡ Found 2 alerts for match 161329:
   - Set Point (Priority: 95)
   - Match Point (Priority: 100)
🎯 ULTRA FILTER: Keeping only TOP priority alert: Match Point
🔧 After overlap filtering: 1 alert processed
```

## Core Architecture Components

### 1. Real-time Alert Engine
**File**: `server/services/engines/`
- **Tennis Engine**: `tennis-engine.ts` - Monitors live matches every 2s
- **MLB Engine**: `mlb-engine.ts` - Enhanced with 8 alert types
- **Base Engine**: `base-engine.ts` - Shared functionality and deduplication
- **Engine Manager**: `index.ts` - Orchestrates all sport engines

### 2. Sports Data APIs
**File**: `server/services/`
- **Tennis API**: `tennis-api.ts` - ESPN US Open integration
- **MLB API**: `mlb-api.ts` - Official MLB.com StatsAPI
- **Weather API**: `weather.ts` - OpenWeatherMap integration
- **Multi-source Aggregator**: Fallback and validation systems

### 3. Database Schema
**File**: `shared/schema.ts`
```typescript
// Core entities
users              - User accounts and authentication
alerts             - Generated alert history with AI analysis
settings           - Per-sport alert preferences
user_monitored_teams - Persistent game monitoring selections
session            - Express session management
```

### 4. Frontend Architecture
**File**: `client/src/`
- **Pages**: `pages/calendar.tsx` (game selection), `pages/alerts.tsx` (history), `pages/settings.tsx` (preferences)
- **Components**: Shadcn/UI design system with ChirpBot V2 styling
- **Hooks**: `use-websocket.tsx` (real-time), `use-alert-batcher.tsx` (optimization)
- **State Management**: TanStack Query for server state

### 5. WebSocket Real-time System
**File**: `server/routes/websocket.ts`
```typescript
// Real-time alert broadcasting
WebSocket connections: Active client connections
Alert broadcasting: Instant notification delivery
Reconnection handling: Automatic client reconnection
Connection monitoring: Health checks and cleanup
```

## Alert Deduplication System
**File**: `server/services/engines/alert-deduplication.ts`

Advanced V1-style deduplication with rich contextual factors:

```typescript
// Deduplication key format
gamePk:type:inning:half:outs:bases:batter:pa

// Context factors
- basesHash: Encoded runner positions
- outs: Current out count
- batterId: Specific player ID
- inning: Current inning number
- inningState: Top/bottom half
- pitcherId: Current pitcher
- paId: Plate appearance ID

// Smart re-alert timing
RISP: 60s cooldown, 180s re-alert
Bases Loaded: 90s cooldown, 300s re-alert  
Close Game: 180s cooldown, 600s re-alert
```

## Data Flow Architecture

### 1. Sports Data Ingestion
```
ESPN/MLB APIs → API Services → Game State Extraction → Alert Engine Processing
```

### 2. Alert Generation
```
Game State → Condition Checking → Priority Filtering → Deduplication → Storage
```

### 3. Real-time Delivery
```
Alert Storage → WebSocket Broadcasting → Frontend Updates → User Notifications
```

## Performance Optimizations

### 1. Database Performance
- **Connection Pooling**: Neon PostgreSQL with pooler mode
- **Query Optimization**: Indexed lookups on game IDs and user IDs
- **Session Storage**: PostgreSQL-backed Express sessions

### 2. Memory Management
- **Deduplication Cache**: Automatic cleanup with fallback protection
- **Alert History**: Efficient storage with seen/unseen tracking
- **WebSocket Connections**: Connection pooling and cleanup

### 3. API Rate Limiting
- **ESPN API**: Optimized request patterns, 2-second intervals
- **MLB API**: Official endpoints with 1.5-second monitoring
- **Error Handling**: Graceful fallbacks and retry logic

## Security Implementation

### 1. Authentication
- **Session-based**: Express sessions with PostgreSQL storage
- **CSRF Protection**: SameSite cookie configuration
- **API Authorization**: Session validation on protected routes

### 2. Data Validation
- **Input Validation**: Zod schemas for all API requests
- **SQL Injection Prevention**: Drizzle ORM parameterized queries
- **XSS Protection**: Helmet.js security headers

### 3. Environment Security
- **Secret Management**: Environment variables for API keys
- **Database Security**: SSL connections to Neon PostgreSQL
- **Production Hardening**: Security-focused Express configuration

## Monitoring & Observability

### 1. Application Logging
```
🎾 Tennis engine monitoring live matches...
📊 MLB Settings - Monitoring: Enabled
⚡ Using single fastest source: MLB-StatsAPI-Enhanced (14ms)
🎯 Found 0 live MLB games
```

### 2. Performance Metrics
- **API Response Times**: Sub-30ms for most sports APIs
- **Alert Processing**: Sub-second alert generation
- **WebSocket Latency**: Real-time delivery < 100ms
- **Database Queries**: Optimized with connection pooling

### 3. Error Handling
- **Graceful Degradation**: Fallback data sources
- **Error Recovery**: Automatic reconnection and retry
- **User Feedback**: Clear error messages and states

## Deployment Configuration

### 1. Replit Platform
- **Runtime**: Node.js with TypeScript compilation
- **Process Management**: Automatic restart on file changes
- **Port Configuration**: Single port (5000) for frontend + backend

### 2. Database Configuration
```
Database: Neon PostgreSQL
Region: US East 2 (AWS)
Connection: Pooled connection with SSL
Schema Management: Drizzle Kit migrations
```

### 3. External Services
```
OpenAI: GPT-4o for alert analysis
Telegram: Bot API for mobile notifications  
Weather: OpenWeatherMap for environmental data
Sports: ESPN + MLB.com official APIs
```

This technical implementation provides a robust, scalable foundation for real-time sports alerting with enterprise-grade reliability and performance.