# ChirpBot V2 - Deployment Guide

## 🚀 Current Deployment Status
**Environment**: Production Ready  
**Platform**: Replit with Neon PostgreSQL  
**Status**: Live and Monitoring Real Sports Data  

## 📋 Prerequisites

### Required Services
1. **PostgreSQL Database** (Neon recommended)
2. **OpenAI API Account** (GPT-4o access)
3. **Telegram Bot** (optional, for mobile notifications)
4. **OpenWeatherMap API** (for weather-enhanced alerts)

### Environment Setup
Create a `.env` file with these variables:
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# AI Services  
OPENAI_API_KEY=sk-proj-...

# Communication
TELEGRAM_BOT_TOKEN=1234567890:ABC...

# Weather Data
OPENWEATHERMAP_API_KEY=abcd1234...

# Security
SESSION_SECRET=your-super-secure-random-string-here
```

## 🔧 Installation Steps

### 1. Clone and Install
```bash
# Copy all files from this package to your deployment environment
npm install
```

### 2. Database Setup
```bash
# Push database schema to PostgreSQL
npm run db:push

# Verify tables created
npm run db:studio  # Optional: Open Drizzle Studio
```

### 3. Configuration Verification
```bash
# Test database connection
node -e "require('./server/storage.ts')"

# Verify API keys work
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI: OK' : 'OpenAI: Missing')"
```

### 4. Start Application
```bash
# Development mode
npm run dev

# Production mode (if applicable)
npm start
```

## 🌐 Platform-Specific Deployment

### Replit Deployment (Recommended)
1. **Import Files**: Upload this complete package to a new Repl
2. **Environment Secrets**: Add all environment variables in Replit Secrets
3. **Database**: Connect to Neon PostgreSQL (already configured)
4. **Run Command**: `npm run dev` (already configured in Replit)
5. **Port Configuration**: App binds to port 5000 (frontend + backend)

### Vercel/Netlify Deployment
```bash
# Frontend build
npm run build

# Deploy built files to static hosting
# Configure API routes as serverless functions
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]
```

### Traditional Server
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start npm --name "chirpbot" -- run dev
pm2 save
pm2 startup
```

## 🔐 Security Configuration

### Session Security
- `SESSION_SECRET`: Use a strong, random 32+ character string
- Session storage: PostgreSQL-backed (secure and persistent)
- HTTPS: Strongly recommended for production

### API Key Management
- Store all API keys in environment variables, never in code
- Use platform-specific secret management (Replit Secrets, etc.)
- Implement API key rotation procedures

### Database Security
- Use connection pooling (already configured)
- Enable SSL connections (Neon default)
- Regular backup procedures recommended

## 📊 Monitoring & Health Checks

### Application Health
```bash
# Check if app is responding
curl http://localhost:5000/api/games/today

# Verify WebSocket connectivity
# (Use browser dev tools WebSocket tab)

# Check database connection
curl http://localhost:5000/api/alerts
```

### Performance Monitoring
- **CPU Usage**: Monitor during high alert periods
- **Memory**: Alert engine uses minimal memory
- **Database Connections**: Max 20 connections (pooled)
- **API Rate Limits**: Respected automatically

### Log Monitoring
Key log patterns to watch:
```
✅ Got 5 tennis matches from ESPN-Mobile
🎯 Found 0 live games (MLB)
🚨 TENNIS Alert: Match Point for match 161329
⚡ Using single fastest source: MLB-StatsAPI-Enhanced (14ms)
```

## 🔄 Maintenance Tasks

### Daily
- Monitor alert generation logs
- Check WebSocket connection health
- Verify sports data API responses

### Weekly  
- Review database performance
- Check error logs for patterns
- Validate alert accuracy

### Monthly
- Update dependencies: `npm audit fix`
- Review API usage and costs
- Database maintenance (if needed)

## 🚨 Troubleshooting

### Common Issues

**No Alerts Generating**
```bash
# Check if engines are running
# Look for: "🔧 Starting TENNIS engine with 2000ms interval"

# Verify user monitoring settings
curl http://localhost:5000/api/user/{userId}/monitored-games
```

**Database Connection Issues**
```bash
# Test connection
npm run db:push

# Check connection string format
echo $DATABASE_URL
```

**API Failures**
```bash
# Test external APIs
curl "https://statsapi.mlb.com/api/v1/schedule?sportId=1"
curl "https://site.api.espn.com/apis/site/v2/sports/tennis/womens-college-tennis/scoreboard"
```

**WebSocket Issues**
- Check browser console for connection errors
- Verify port 5000 is accessible
- Test with different browsers/devices

### Error Recovery
- **Automatic Restart**: PM2 or platform auto-restart on crashes
- **Graceful Degradation**: App continues with reduced functionality if external APIs fail
- **Data Backup**: Regular database backups recommended

## 🎯 Production Optimization

### Performance Tuning
- **Connection Pooling**: Already optimized (20 max connections)
- **Alert Deduplication**: Prevents spam, optimizes database usage
- **API Caching**: Implemented where appropriate
- **WebSocket Management**: Automatic cleanup and reconnection

### Scaling Considerations
- **Horizontal Scaling**: Multiple instances can share same database
- **Database Scaling**: Neon PostgreSQL auto-scales
- **CDN**: Consider for static assets in high-traffic scenarios
- **Load Balancing**: Standard techniques apply

This deployment guide ensures your ChirpBot V2 application runs reliably in production with optimal performance and security.