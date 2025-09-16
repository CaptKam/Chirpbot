
# ChirpBot V3 - Complete Architecture & Flow Documentation

## System Overview

ChirpBot V3 is an advanced multi-sport intelligence platform providing real-time notifications and AI-enhanced insights across 6 major sports leagues: MLB, NFL, NCAAF, NBA, WNBA, and CFL. The system features sub-250ms response times, cross-sport AI enhancement with intelligent caching, and predictive alert capabilities.

## Core Architecture

### High-Level System Flow
```
Game APIs → Calendar Sync → Game State Manager → Engine Lifecycle Manager → Sport Engines → Alert Cylinders → AI Enhancement → Database → Real-time Delivery
```

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript  
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI GPT-4o-mini and GPT-5
- **Real-time**: HTTP Polling + Server-Sent Events (SSE)
- **Authentication**: Session-based with bcrypt

## V3 Weather-on-Live Architecture

### Core Principle
Engines and weather monitoring only activate when games transition to LIVE state, ensuring efficient resource usage and ≤5s detection guarantees.

### Key Components

#### 1. Calendar Sync Service (`server/services/calendar-sync-service.ts`)
- **Purpose**: Lightweight game data synchronization
- **Features**:
  - Multi-sport API polling (MLB, NFL, NCAAF, NBA, WNBA, CFL)
  - Smart proximity-based polling intervals
  - Status change detection and broadcasting

#### 2. Game State Manager (`server/services/game-state-manager.ts`)
- **Purpose**: Core state machine for game lifecycle
- **States**: SCHEDULED → PREWARM → LIVE → PAUSED → FINAL → TERMINATED
- **Features**:
  - Timezone-aware scheduling
  - Confirmation logic for LIVE transitions
  - User monitoring integration

#### 3. Engine Lifecycle Manager (`server/services/engine-lifecycle-manager.ts`)
- **Purpose**: Dynamic engine activation based on game states
- **States**: INACTIVE → PRE_WARMING → ACTIVE → COOLDOWN → ERROR → RECOVERY
- **Features**:
  - Resource management per sport
  - Health monitoring with circuit breakers
  - Automatic recovery mechanisms

#### 4. Weather-on-Live Service (`server/services/weather-on-live-service.ts`)
- **Purpose**: Dynamic weather monitoring for live games
- **Features**:
  - Sport-specific weather evaluators
  - Arming/disarming based on alert triggers
  - Weather change detection and alerts

### Timing Guarantees

| Time Window | Polling Interval | Detection Guarantee | Purpose |
|-------------|------------------|-------------------|---------|
| **T-2m to T+5m** | **2s** | **≤5s GUARANTEED** | **Critical detection** |
| T-10m to T-2m | 10s | ≤20s acceptable | Pre-game preparation |
| Far future | 60s | ~2min best effort | Status monitoring |

## Alert System Architecture

### Alert Cylinder System
Each sport has modular alert cylinders in `server/services/engines/alert-cylinders/`:

#### MLB (20 cylinders)
- `bases-loaded-no-outs-module.ts`
- `bases-loaded-one-out-module.ts`
- `runner-on-third-no-outs-module.ts`
- `scoring-opportunity-module.ts`
- `steal-likelihood-module.ts`
- And 15 more situation-specific modules

#### NFL (8 cylinders)
- `game-start-module.ts`
- `red-zone-module.ts`
- `two-minute-warning-module.ts`
- `fourth-down-module.ts`
- And 4 more tactical modules

#### NCAAF (13 cylinders)
- College-specific modules with upset detection
- Red zone efficiency analysis
- Weather impact modules

#### WNBA (10 cylinders)
- Quarter-based alerts
- Clutch time opportunities
- Championship implications

#### NBA (9 cylinders)
- Similar to WNBA with NBA-specific rules

#### CFL (10 cylinders)
- Canadian football specific rules
- Rouge opportunity detection
- Grey Cup implications

### Alert Generation Flow

```
1. Sport Engine monitors live game data
2. Alert Cylinders evaluate conditions
3. Probability calculations determine alert worthiness
4. User filtering (global + personal settings)
5. Deduplication check
6. AI enhancement (if enabled)
7. Database storage
8. Real-time delivery via SSE
```

## AI Enhancement System

### Unified AI Processor (`server/services/unified-ai-processor.ts`)
- **Models**: GPT-4o-mini (primary), GPT-5 (advanced insights)
- **Features**:
  - 0ms intelligent caching for repeated scenarios
  - Context-aware analysis
  - Betting insights integration
  - Performance monitoring

### AI Enhancement Layers
1. **Basic Analysis**: Situation context and impact
2. **Advanced Insights**: Strategic implications
3. **Betting Intelligence**: Odds impact and recommendations
4. **Weather Integration**: Environmental factors
5. **Historical Context**: Pattern recognition
6. **Cross-Sport Learning**: Shared intelligence patterns

## Database Schema

### Core Tables
```sql
-- User Management
users: authentication and profiles
user_monitored_teams: persistent team selections

-- Alert System  
master_alert_controls: global alert type definitions (25+ types)
settings: user-specific alert preferences
alerts: generated alerts with AI enhancements

-- System Configuration
ai_settings: AI engine configuration per sport
```

### Data Flow
```
Live Game Data → Sport APIs → Engine Processing → Alert Generation → Database Storage → API Serving → Frontend Display
```

## Real-Time Architecture

### HTTP Polling + SSE Hybrid
- **HTTP Polling**: 5-second intervals for alert fetching
- **Server-Sent Events**: Instant delivery of new alerts
- **WebSocket Fallback**: Available but not primary method

### Performance Optimizations
- Settings caching with intelligent TTL
- Alert deduplication at multiple levels
- Memory management with emergency cleanup
- Circuit breakers for API failures

## Health Monitoring System

### Unified Health Monitor (`server/services/unified-health-monitor.ts`)
- **Status Levels**: healthy, degraded, unhealthy, critical
- **Monitoring**:
  - Engine health and transitions
  - Memory usage and cleanup
  - API failure tracking
  - Alert generation rates
  - Auto-recovery mechanisms

### Performance Metrics
- **Alert Generation**: 998+ total alerts tracked
- **Engine Health**: 6 healthy engines monitored
- **Memory Management**: Automatic cleanup triggers
- **API Sustainability**: <300 calls per game lifecycle

## Security & Authentication

### Session Management
- bcrypt password hashing (10 rounds)
- Secure session cookies
- Environment variable protection
- Internal-only health endpoints

### Admin Controls
- Global alert type management
- User preference overrides
- System health monitoring
- Emergency controls

## Development Laws & Constraints

### ChirpBot Development Laws
1. **No New Engines Without Discussion**
2. **Kid-Friendly Content Only**
3. **User Settings Validation Required**
4. **Deduplication Before Expensive Operations**
5. **AI Analysis Only When Enabled**
6. **Consistent Alert Structure**
7. **Alert Format Consistency & 3-Second Readability**

### Technical Constraints
- **Package.json**: System-protected, cannot edit directly
- **Port Configuration**: 5000 is designated and forwarded
- **Memory Management**: 512MB-1GB operational range
- **API Rate Limits**: Conservative usage within provider limits

## File Structure Breakdown

### Frontend (`client/src/`)
```
components/: Reusable UI components
├── ui/: shadcn/ui component library
├── SwipeableCard.tsx: Primary alert display
├── SimpleAlertCard.tsx: Compact alert view
└── WeatherImpactVisualizer.tsx: Weather data display

pages/: Application routes
├── alerts.tsx: Main alert feed
├── calendar.tsx: Team monitoring
├── settings.tsx: User preferences
└── admin.tsx: Administrative controls

hooks/: Custom React hooks
├── useAuth.ts: Authentication management
└── useGamesAvailability.ts: Game status tracking
```

### Backend (`server/`)
```
services/: Core business logic
├── engines/: Sport-specific processing
├── unified-alert-generator.ts: Central coordination
├── weather-on-live-service.ts: Dynamic weather monitoring
└── unified-health-monitor.ts: System health tracking

config/: System configuration
└── runtime.ts: Timing and performance settings

middleware/: Request processing
├── memory-manager.ts: Resource management
└── circuit-breaker.ts: Failure protection
```

## Operational Flow

### System Startup
1. **Initialization**: Core services and database connections
2. **Calendar Sync**: Start lightweight game polling
3. **Health Monitoring**: Begin system health checks
4. **Demo Data**: Seed database if needed
5. **Alert Generation**: Activate monitoring pipeline

### Game Lifecycle
1. **Detection**: Calendar sync detects scheduled games
2. **Pre-warming**: Engines prepare 5 minutes before start
3. **Activation**: Full engine activation when game goes LIVE
4. **Monitoring**: Continuous alert generation during live play
5. **Cleanup**: Engine shutdown and resource cleanup after game ends

### Alert Lifecycle
1. **Detection**: Sport engine identifies alert condition
2. **Evaluation**: Alert cylinder calculates probability
3. **Filtering**: Global and user settings validation
4. **Enhancement**: AI analysis (if enabled)
5. **Storage**: Database persistence
6. **Delivery**: Real-time distribution via SSE

## Performance Characteristics

### Response Times
- **Alert Detection**: ≤5s in critical window (T-2m to T+5m)
- **AI Enhancement**: 0ms for cached scenarios
- **Database Operations**: <100ms for standard queries
- **Real-time Delivery**: <250ms end-to-end

### Resource Usage
- **Memory**: 512MB baseline, scales with active games
- **CPU**: 5% per active game (estimated)
- **Network**: <300 API calls per game lifecycle
- **Database**: Efficient indexing for fast alert retrieval

## Monitoring & Observability

### Health Endpoints
- `/healthz`: Basic application health
- `/readyz`: AI service readiness  
- `/api/ai/health/metrics`: Detailed AI performance

### Logging & Metrics
- Structured logging with performance timing
- Alert generation tracking
- Engine state transitions
- Memory usage monitoring
- API failure rates

## Future Scalability

### Horizontal Scaling Considerations
- Stateless service design enables replication
- Database connection pooling supports multiple instances
- Session storage could be moved to Redis
- Load balancing ready architecture

### Feature Expansion
- Additional sports leagues
- Enhanced AI models
- Real-time betting integration
- Mobile push notifications
- Advanced analytics dashboard

This architecture provides a robust, scalable foundation for real-time sports intelligence with guaranteed low-latency detection and comprehensive monitoring capabilities.
