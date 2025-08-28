
# ChirpBot V3 - Technical Deep Dive

## Alert Engine Architecture

### 1. Four-Level Alert System (`four-level-alert-system.ts`)

The core innovation is a progressive evaluation system that builds confidence through multiple analysis layers:

```typescript
interface LevelResults {
  L1: { yes: boolean; probability: number; reasons: string[] }
  L2: { yes: boolean; probability: number; reasons: string[] }  
  L3: { yes: boolean; probability: number; reasons: string[] }
  L4: { upgradeTierTo?: number; confidence: number }
}
```

**Decision Logic:**
- L1 must be true for any alert (hard requirement)
- L1 + L2 + L3 = Tier 3 alert (highest confidence)
- L1 + (L2 XOR L3) = Tier 2 alert (medium confidence)
- L1 only = Tier 1 alert (basic confidence)
- L4 can override in rare AI-detected situations

### 2. RE24 Probability Engine (`hybrid-re24-ai.ts`)

Uses run expectancy matrices to calculate scoring probabilities:

```typescript
const RE24_MATRIX = {
  '000': 0.461, // No runners, 0 outs
  '001': 0.243, // No runners, 1 out  
  '100': 0.831, // Runner on 1st, 0 outs
  '111': 2.254, // Bases loaded, 1 out
  // ... 24 total states
}
```

**Leverage Multipliers:**
- Late innings (8th+): 1.15x
- Close games (1-run): 1.10x
- RISP situations: 1.20x
- Power hitter: 1.25x

### 3. Advanced Deduplication (`alert-deduplication.ts`)

Creates contextual fingerprints to prevent duplicate alerts:

```typescript
interface AlertContext {
  gameId: string
  inning: number
  outs: number
  baseRunners: string
  batter: string
  alertType: string
  tier: number
}
```

**Cooldown Strategy:**
- Tier 1: 60 seconds
- Tier 2: 90 seconds  
- Tier 3: 120 seconds
- Tier 4: 180 seconds

## Data Pipeline Architecture

### 1. Multi-Source Aggregation (`multi-source-aggregator.ts`)

Combines data from multiple APIs with fallback logic:

```typescript
const sources = [
  { name: 'ESPN', priority: 1, timeout: 3000 },
  { name: 'MLB_STATS', priority: 2, timeout: 5000 },
  { name: 'THESPORTSDB', priority: 3, timeout: 2000 }
]
```

### 2. Adaptive Polling (`adaptive-polling.ts`)

Dynamic polling intervals based on game state:

- **Live games**: 10-15 seconds
- **Critical situations**: 5 seconds
- **Between innings**: 30 seconds
- **Game completed**: Stop polling

### 3. Weather Integration (`weather-engine.ts`)

Environmental factors affecting scoring:

```typescript
interface WeatherImpact {
  windSpeed: number      // > 10mph = +offense
  windDirection: string  // out/in to field
  temperature: number    // > 85°F = +offense  
  humidity: number       // > 70% = -offense
  pressure: number       // low pressure = +offense
}
```

## Frontend Architecture

### 1. Real-time Updates (`use-websocket.tsx`)

WebSocket hook with automatic reconnection:

```typescript
const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
}
```

### 2. Alert Rendering (`alert-vm.ts`)

View model for consistent alert presentation:

```typescript
interface AlertViewModel {
  id: string
  tier: 1 | 2 | 3 | 4
  title: string
  subtitle: string
  probability: number
  reasons: string[]
  gameContext: GameContext
  bettingLines?: BettingLine[]
}
```

### 3. Mobile-First UI

- Swipeable cards for alert interaction
- Bottom navigation for mobile UX
- Progressive disclosure for complex data

## Database Schema

### 1. User Settings
```sql
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  alert_preferences JSONB,
  four_level_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Alert Logs
```sql
CREATE TABLE alert_logs (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255),
  tier INTEGER,
  probability DECIMAL(5,4),
  reasons TEXT[],
  sent_at TIMESTAMP DEFAULT NOW(),
  dedup_key VARCHAR(255)
);
```

### 3. AI Learning Data
```sql
CREATE TABLE ai_learning_logs (
  id SERIAL PRIMARY KEY,
  game_context JSONB,
  prediction_confidence DECIMAL(5,4),
  actual_outcome BOOLEAN,
  learning_feedback JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Optimizations

### 1. Memory Management
- LRU cache for game states (max 100 games)
- Periodic cleanup of completed games
- Streaming JSON parsing for large responses

### 2. Network Efficiency
- Request batching where possible
- Compression for WebSocket messages
- CDN integration for static assets

### 3. Database Optimization
- Indexed queries on game_id and timestamp
- Partitioned tables for historical data
- Connection pooling with retry logic

## Security Implementation

### 1. Authentication
```typescript
// JWT-based session management
interface UserSession {
  userId: number
  role: 'user' | 'admin'
  permissions: string[]
  expiresAt: Date
}
```

### 2. Rate Limiting
```typescript
// Per-user and per-IP rate limits
const rateLimits = {
  alerts: { windowMs: 60000, max: 10 },
  api: { windowMs: 60000, max: 100 },
  websocket: { windowMs: 10000, max: 50 }
}
```

### 3. Input Validation
- Zod schemas for all API inputs
- SQL injection prevention via parameterized queries
- XSS protection through content sanitization

## Monitoring & Observability

### 1. Health Checks
- Database connectivity
- External API availability  
- WebSocket connection status
- Alert engine performance

### 2. Metrics Collection
- Alert frequency by tier
- API response times
- Error rates by component
- User engagement metrics

### 3. Logging Strategy
- Structured JSON logs
- Different log levels by environment
- Alert audit trail for compliance

## Deployment Configuration

### 1. Environment Setup
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### 2. Process Management
- PM2 for process clustering
- Health check endpoints
- Graceful shutdown handling

### 3. Scaling Considerations
- Horizontal scaling via load balancer
- Database read replicas
- Redis for session store and caching

This technical deep dive provides the foundation for understanding ChirpBot V3's sophisticated alert engine and real-time sports monitoring capabilities.
