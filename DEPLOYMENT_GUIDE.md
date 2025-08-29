
# ChirpBot AI - Deployment Guide

## Quick Start for Review

### 1. Environment Setup
Create a `.env` file with these required variables:

```env
# Database (Required)
DATABASE_URL=postgresql://username:password@host:port/database_name

# OpenAI Integration (Required for AI features)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Application Security (Required)
SESSION_SECRET=your-super-secure-session-secret-here

# Application Configuration
NODE_ENV=production
PORT=5000
```

### 2. Database Setup
The application uses PostgreSQL with automatic schema management:

```bash
# Install dependencies
npm install

# Push database schema (creates tables automatically)
npm run db:push

# Database seeding happens automatically on first startup
```

### 3. Running the Application

#### Development Mode
```bash
npm run dev
```
- Starts on http://localhost:5000
- Hot reloading enabled
- Detailed logging

#### Production Mode
```bash
# Build the application
npm run build

# Start production server
npm run start
```

### 4. Health Checks
Once running, verify the application health:

- **Liveness**: `GET /healthz` - Basic application health
- **Readiness**: `GET /readyz` - AI service readiness
- **AI Metrics**: `GET /api/ai/health/metrics` - Detailed AI performance

### 5. Demo Access
- URL: `http://localhost:5000`
- Username: `demo`
- Password: `demo123`

## OpenAI API Usage

### Models Utilized
- **gpt-4o-mini**: Primary analysis engine (rate: 30s intervals)
- **gpt-5**: Advanced betting insights (latest OpenAI model)

### API Call Patterns
- Health checks every 30 seconds
- Production analysis calls rate-limited to prevent overuse
- Automatic fallback for service unavailability
- Comprehensive error handling and retry logic

### Token Management
- Analysis calls: 500 token limit
- Betting advice: 50 token limit
- Health checks: 5 token limit
- Temperature: 0.6-0.7 for optimal creativity/accuracy balance

## Database Schema Overview

### Key Tables
1. **users**: Authentication and user management
2. **master_alert_controls**: Global alert type definitions (25+ types)
3. **settings**: User-specific alert preferences
4. **ai_settings**: AI engine configuration per sport
5. **user_monitored_teams**: Persistent team monitoring selections

### Automatic Seeding
On first startup, the application automatically creates:
- Master alert controls for all sports
- Demo user account
- Default user settings
- AI configuration for each sport

## Production Considerations

### Resource Requirements
- **Memory**: 512MB minimum, 1GB recommended
- **CPU**: Single core sufficient for moderate load
- **Database**: PostgreSQL 12+ with connection pooling
- **Network**: WebSocket support required

### Monitoring & Health
- Built-in AI health monitoring with metrics
- WebSocket connection management with auto-reconnection
- Graceful degradation when AI services are unavailable
- Comprehensive error logging and recovery

### Security Features
- Session-based authentication with secure cookies
- Password hashing with bcrypt (10 rounds)
- Environment variable protection for sensitive data
- Internal-only endpoints for health metrics

This application is production-ready and demonstrates best practices for OpenAI API integration in a real-time sports monitoring context.
