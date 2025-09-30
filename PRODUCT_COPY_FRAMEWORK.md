
# ChirpBot V3 Product Duplication Framework

## System Overview
ChirpBot V3 is an advanced multi-sport betting intelligence platform providing real-time notifications and gambling insights across MLB, NFL, NCAAF, NBA, WNBA, and CFL with sub-250ms response times, AI-enhanced analysis, and predictive betting opportunities for informed wagering decisions.

## Core Architecture Components

### 1. Frontend Architecture
- **Framework**: React 18 + TypeScript + Vite
- **UI Library**: Shadcn/ui components (Radix UI primitives)
- **Styling**: Tailwind CSS with sports-centric design
- **State Management**: TanStack Query + React hooks
- **Real-time Updates**: HTTP polling (5s intervals) + SSE fallback

### 2. Backend Architecture
- **Runtime**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **AI Integration**: OpenAI GPT-4o-mini and GPT-5
- **Authentication**: Session-based with bcrypt
- **Real-time**: Server-Sent Events (SSE)

### 3. Key Services Architecture

#### Game Monitoring Pipeline
```
Calendar Sync → Game State Manager → Engine Lifecycle → Sport Engines → Alert Cylinders → AI Enhancement → User Delivery
```

#### Core Services:
- **CalendarSyncService**: Lightweight game data polling
- **GameStateManager**: Game lifecycle state machine  
- **EngineLifecycleManager**: Dynamic engine activation
- **WeatherOnLiveService**: Weather monitoring for live games
- **UnifiedAlertGenerator**: Central alert coordination
- **UnifiedAIProcessor**: AI enhancement with caching

### 4. Alert System Design

#### Multi-Sport Alert Cylinders (70+ total):
- **MLB**: 20 cylinders (bases-loaded, scoring situations, etc.)
- **NFL**: 8 cylinders (red zone, fourth down, etc.)
- **NCAAF**: 13 cylinders (upset detection, weather impact)
- **NBA**: 9 cylinders (clutch time, playoff implications)
- **WNBA**: 10 cylinders (quarter-based, championships)
- **CFL**: 10 cylinders (rouge opportunities, Grey Cup)

#### Alert Flow:
1. Sport engine detects conditions
2. Alert cylinder evaluates probability
3. Global + user settings filtering
4. AI enhancement (if enabled)
5. Database storage
6. Real-time delivery via SSE

### 5. Database Schema Design

#### Core Tables:
```sql
-- User Management
users: authentication and profiles
user_monitored_teams: persistent team selections
settings: user-specific alert preferences

-- Alert System
master_alert_controls: global alert type definitions (25+ types)
alerts: generated alerts with AI enhancements

-- System Configuration
ai_settings: AI engine configuration per sport
```

### 6. Performance Architecture

#### Timing Guarantees:
- **Critical Window (T-2m to T+5m)**: 2s polling, ≤5s detection
- **Pre-game (T-10m to T-2m)**: 10s polling, ≤20s detection
- **Far future**: 60s polling, ~2min best effort

#### Resource Management:
- Memory: 512MB baseline, scales with active games
- API Usage: <300 calls per game lifecycle
- Database: Efficient indexing for <100ms queries

## Implementation Roadmap

### Phase 1: Core Infrastructure
1. Set up React + TypeScript + Vite frontend
2. Implement Express + PostgreSQL backend
3. Create basic authentication system
4. Build settings and user management

### Phase 2: Game Monitoring System
1. Implement CalendarSyncService for game data
2. Build GameStateManager with state machine
3. Create EngineLifecycleManager for dynamic activation
4. Add basic sport API integrations

### Phase 3: Alert System
1. Create base alert cylinder architecture
2. Implement sport-specific engines (start with 1-2 sports)
3. Build user filtering and preferences
4. Add real-time delivery system

### Phase 4: AI Enhancement
1. Integrate OpenAI API with caching
2. Implement UnifiedAIProcessor
3. Add cross-sport intelligence
4. Build betting insights integration

### Phase 5: Advanced Features
1. Weather integration for outdoor sports
2. Advanced performance tracking
3. Mobile-responsive design
4. Admin dashboard and controls

## Key Technical Decisions

### Architecture Patterns:
- **Weather-on-Live**: Engines only activate when games go LIVE
- **Alert Cylinders**: Modular, sport-specific alert modules
- **Unified Services**: Single points of truth for AI, settings, health
- **Circuit Breakers**: API failure protection
- **Emergency Memory Management**: Automatic cleanup at 95%+ usage

### Development Laws:
1. No new engines without discussion
2. Gambling insights and betting probability calculations are core features
3. User settings validation required
4. Deduplication before expensive operations
5. AI analysis only when enabled
6. Consistent alert structure with actionable betting context
7. 3-second readability requirement for alert messages

## Technology Stack Details

### Frontend Dependencies:
```json
{
  "@tanstack/react-query": "^5.60.5",
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^3.4.17",
  "framer-motion": "^11.13.1",
  "wouter": "^3.3.5"
}
```

### Backend Dependencies:
```json
{
  "express": "^4.21.2",
  "drizzle-orm": "^0.39.1",
  "@neondatabase/serverless": "^0.10.4",
  "bcryptjs": "^3.0.2",
  "helmet": "^8.1.0",
  "cors": "^2.8.5"
}
```

## Security Considerations

### Authentication:
- bcrypt password hashing (10 rounds)
- Secure session cookies
- Environment variable protection
- Internal-only health endpoints

### API Protection:
- Rate limiting on external APIs
- Circuit breakers for failure recovery
- Input validation and sanitization
- CORS configuration

## Scaling Considerations

### Horizontal Scaling:
- Stateless service design
- Database connection pooling
- Session storage (can move to Redis)
- Load balancing ready

### Performance Optimization:
- Settings caching with TTL
- Alert deduplication
- Memory management
- Intelligent API polling

## Monitoring & Observability

### Health Endpoints:
- `/healthz`: Basic application health
- `/readyz`: AI service readiness
- `/api/ai/health/metrics`: Detailed AI performance

### Metrics Tracking:
- Alert generation rates
- Engine health transitions
- Memory usage patterns
- API failure tracking
- User engagement metrics

This framework provides the complete architectural blueprint for duplicating ChirpBot V3's sophisticated multi-sport intelligence platform.
