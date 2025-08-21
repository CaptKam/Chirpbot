# ChirpBot V2 - Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn package manager

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your database URL and secrets

# 3. Initialize database
npm run db:push

# 4. Start development server
npm run dev
```

Application will be available at: http://localhost:5000

## Environment Configuration

### Minimum Required Variables
```bash
# Database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Session security
SESSION_SECRET="your-unique-secret-key"
```

### Optional API Keys
```bash
# For AI-powered alerts
OPENAI_API_KEY="sk-your-openai-key"

# For NFL/NBA/NHL data
SPORTSDATA_API_KEY="your-sportsdata-key"

# For weather data
ACCU_WEATHER_API_KEY="your-weather-key"

# For push notifications
TELEGRAM_BOT_TOKEN="your-telegram-token"
```

## Database Setup

### Using Neon (Recommended)
1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string to `DATABASE_URL`
4. Run `npm run db:push` to sync schema

### Using Local PostgreSQL
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu

# Create database
createdb chirpbot

# Set DATABASE_URL
DATABASE_URL="postgresql://localhost:5432/chirpbot"
```

## Production Deployment

### Build for Production
```bash
# Build the application
npm run build

# Test production build
npm run start
```

### Deployment Platforms

#### Replit Deployment
1. Fork/import this repository to Replit
2. Set environment variables in Secrets
3. Application will auto-deploy

#### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add --database postgresql
railway deploy
```

#### Vercel + PlanetScale
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Add PlanetScale database
# Update DATABASE_URL in Vercel environment variables
```

#### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## API Keys Setup

### OpenAI (for AI alerts)
1. Visit [OpenAI Platform](https://platform.openai.com)
2. Create API key
3. Add to environment: `OPENAI_API_KEY=sk-...`
4. Monitor usage in OpenAI dashboard

### SportsData.io (for NFL/NBA/NHL)
1. Sign up at [SportsData.io](https://sportsdata.io)
2. Subscribe to desired sports packages
3. Get API key from dashboard
4. Add to environment: `SPORTSDATA_API_KEY=...`

### AccuWeather (for weather data)
1. Register at [AccuWeather Developer](https://developer.accuweather.com)
2. Create application
3. Get API key
4. Add to environment: `ACCU_WEATHER_API_KEY=...`

### Telegram (for notifications)
1. Create bot with @BotFather on Telegram
2. Get bot token
3. Add to environment: `TELEGRAM_BOT_TOKEN=...`

## Security Configuration

### Session Security
```bash
# Generate secure session secret
openssl rand -base64 32

# Set in environment
SESSION_SECRET="your-generated-secret"
```

### Database Security
- Use connection pooling in production
- Enable SSL connections
- Set proper user permissions
- Regular backups

### API Security
- Use HTTPS in production
- Set proper CORS origins
- Rate limit API endpoints
- Monitor for abuse

## Performance Optimization

### Database Optimization
- Add indexes for frequent queries
- Use connection pooling
- Monitor query performance
- Regular VACUUM and ANALYZE

### Caching Strategy
- Enable query result caching
- Use CDN for static assets
- Cache API responses when possible
- Implement Redis for session store

### Monitoring Setup
```bash
# Add monitoring tools
npm install --save @sentry/node
npm install --save prometheus-client

# Configure error tracking
# Set up performance monitoring
# Add health check endpoints
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (nginx, HAProxy)
- Separate API and WebSocket servers
- Database read replicas
- CDN for static content

### Vertical Scaling
- Increase server resources
- Optimize database configuration
- Use faster storage (SSD)
- Increase connection limits

## Backup Strategy

### Database Backups
```bash
# Automated daily backups
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20250821.sql
```

### Application Backups
- Version control (Git)
- Configuration management
- Dependency management (package-lock.json)
- Environment variable documentation

## Health Monitoring

### Health Check Endpoints
- `GET /api/health` - Application health
- `GET /api/db/health` - Database connectivity
- `GET /api/engines/status` - Sport engines status

### Monitoring Alerts
- Database connection failures
- API rate limit exceeded
- High error rates
- Memory/CPU usage spikes

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
npm run db:push

# Check database server status
```

#### API Keys Not Working
```bash
# Verify environment variables are set
env | grep API_KEY

# Check API key validity
# Check rate limits and quotas
```

#### Build Failures
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run check

# Rebuild
npm run build
```

### Log Analysis
```bash
# View application logs
npm run dev

# Filter for errors
npm run dev 2>&1 | grep ERROR

# Monitor WebSocket connections
# Check API response times
```

## Maintenance

### Regular Tasks
- Update dependencies: `npm update`
- Security audits: `npm audit`
- Database maintenance: `VACUUM ANALYZE`
- Log rotation and cleanup
- API key rotation

### Version Updates
```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Test after updates
npm run check
npm run build
npm run dev
```

This deployment guide covers production-ready setup for ChirpBot V2 with all necessary configurations and best practices.