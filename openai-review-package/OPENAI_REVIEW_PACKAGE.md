
# ChirpBot AI - Complete App Package for OpenAI Review

## Overview
ChirpBot AI is a sophisticated sports alert and analysis platform that leverages OpenAI's GPT models for intelligent sports context generation and betting insights. This package contains the complete application ready for review.

## Application Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI GPT-4o-mini and GPT-5
- **Real-time**: WebSockets for live alerts
- **Authentication**: Session-based with bcrypt

### Core Features
1. **Multi-Sport Monitoring**: MLB, NFL, NBA, NHL real-time game tracking
2. **AI-Powered Analysis**: Contextual sports insights using OpenAI models
3. **Intelligent Alerts**: 25+ alert types with AI confidence scoring
4. **Betting Integration**: AI-generated betting recommendations
5. **Health Monitoring**: Comprehensive AI service health tracking

## Database Schema & Setup

### Required Environment Variables
```env
DATABASE_URL=postgresql://username:password@host:port/database
OPENAI_API_KEY=sk-your-openai-api-key
SESSION_SECRET=your-secure-session-secret
NODE_ENV=production
PORT=5000
```

### Database Tables
- `users`: User authentication and profiles
- `master_alert_controls`: Sport alert configurations
- `settings`: User preferences and alert settings
- `ai_settings`: AI engine configurations per sport
- `user_monitored_teams`: Persistent team monitoring

## OpenAI Integration Details

### Models Used
- **GPT-4o-mini**: Primary model for sports analysis and alerts
- **GPT-5**: Advanced model for betting insights (latest model as of August 2025)

### API Usage Patterns
- Health monitoring with lightweight checks every 30 seconds
- Rate limiting at 30-second intervals for production calls
- Fallback mechanisms for API failures
- Temperature settings: 0.7 for analysis, 0.6 for betting advice
- Token limits: 500 for analysis, 50 for betting recommendations

### AI Features Implementation
1. **Sports Context Generation** (`OpenAiEngine.ts`):
   - Game situation analysis
   - Player performance insights
   - Momentum detection
   - Weather impact analysis

2. **Betting Analysis** (`betbook-engine.ts`):
   - Live betting opportunities
   - Value bet identification
   - Risk assessment

3. **Health Monitoring** (`ai-health-monitor.ts`):
   - Service availability tracking
   - Performance metrics
   - Automatic degraded mode detection

## Installation & Setup Instructions

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key

### Setup Steps
1. Clone/extract the application files
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Initialize database: `npm run db:push`
5. Seed initial data: Database seeding runs automatically on startup
6. Start development: `npm run dev`
7. Build for production: `npm run build`
8. Deploy: `npm run start`

## File Structure & Key Components

### Core Server Files
- `server/index.ts`: Main application entry point
- `server/db.ts`: Database connection and configuration
- `server/seed-database.ts`: Initial data seeding
- `server/routes.ts`: API endpoints and health checks

### AI Integration Files
- `server/services/ai-health-monitor.ts`: AI service monitoring
- `server/services/engines/OpenAiEngine.ts`: Core AI analysis engine
- `server/services/engines/betbook-engine.ts`: Betting analysis engine
- `server/services/engines/mlb-engine.ts`: MLB-specific monitoring

### Database Schema
- `shared/schema.ts`: Complete database schema definitions
- `drizzle.config.ts`: Database migration configuration

## API Endpoints

### Health & Monitoring
- `GET /healthz`: Liveness probe
- `GET /readyz`: Readiness probe with AI status
- `GET /api/ai/health/metrics`: Detailed AI health metrics (internal)

### Authentication
- `POST /api/auth/login`: User authentication
- `POST /api/auth/logout`: Session termination
- `GET /api/auth/user`: Current user information

## Security Considerations
- Environment variables for all sensitive data
- Session-based authentication with secure cookies
- API rate limiting for OpenAI calls
- Internal-only endpoints for health metrics
- Password hashing with bcrypt

## Performance & Reliability
- WebSocket reconnection logic with exponential backoff
- AI service health monitoring with automatic degraded mode
- Database connection pooling
- Efficient alert deduplication
- Fallback responses when AI services are unavailable

## Demo Credentials
- Username: `demo`
- Password: `demo123`
- Auto-created on first run with sample settings

## Production Deployment
- Build command: `npm run build`
- Start command: `npm run start`
- Port: 5000 (configurable via PORT env var)
- Health checks available at standard endpoints

This application demonstrates sophisticated integration with OpenAI's API for real-time sports analysis while maintaining high reliability and performance standards.
