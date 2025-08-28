
# ChirpBot V3 - Deployment Guide

## Production Deployment on Replit

### 1. Environment Setup

Create a `.env` file with these required variables:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Sports Data APIs
ESPN_API_KEY=your_espn_api_key
MLB_STATS_API_KEY=your_mlb_api_key
THESPORTSDB_API_KEY=your_thesportsdb_key

# Weather Service
WEATHER_API_KEY=your_openweather_api_key

# Telegram Integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Security
SESSION_SECRET=your_secure_random_string_min_32_chars
JWT_SECRET=your_jwt_secret_key

# Application
NODE_ENV=production
PORT=3000
```

### 2. Database Setup

The application uses Neon PostgreSQL. Run migrations:

```bash
npm run db:push
```

Seed initial data:

```bash
npm run seed
```

### 3. Build Process

```bash
# Install dependencies
npm install

# Build client and server
npm run build
```

### 4. Start Production Server

```bash
npm start
```

### 5. Health Check

Verify deployment at:
- Main app: `https://your-app.replit.app`
- Health check: `https://your-app.replit.app/api/health`
- Admin panel: `https://your-app.replit.app/admin`

## Configuration Options

### Alert Engine Tuning

Adjust probability thresholds in production:

```typescript
// server/services/engines/four-level-alert-system.ts
const PRODUCTION_THRESHOLDS = {
  L1: 0.65, // 65% - Base threshold
  L2: 0.70, // 70% - Player analytics
  L3: 0.80, // 80% - Weather/environment
  L4: 0.85  // 85% - AI synthesis
}
```

### Performance Optimization

```typescript
// server/services/adaptive-polling.ts
const PRODUCTION_INTERVALS = {
  LIVE_GAME: 10000,      // 10 seconds
  CRITICAL: 5000,        // 5 seconds  
  BETWEEN_INNINGS: 30000, // 30 seconds
  COMPLETED: 0           // Stop polling
}
```

### Rate Limiting

```typescript
// server/middleware/rate-limit.ts
const PRODUCTION_LIMITS = {
  api: { windowMs: 60000, max: 100 },
  alerts: { windowMs: 60000, max: 10 },
  websocket: { windowMs: 10000, max: 50 }
}
```

## Monitoring & Logging

### Log Levels
- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions 
- `info`: General information (default in production)
- `debug`: Detailed debugging information

### Key Metrics to Monitor

1. **Alert Performance**
   - Alerts per hour by tier
   - Average response time
   - Deduplication effectiveness

2. **API Health**
   - External API response times
   - Error rates by endpoint
   - Database query performance

3. **User Engagement**
   - Active WebSocket connections
   - Alert click-through rates
   - Settings modification frequency

### Health Check Endpoints

- `/api/health` - Basic health status
- `/api/admin/health` - Detailed system metrics
- `/api/admin/audit-logs` - Alert audit trail

## Security Best Practices

### 1. Environment Variables
- Never commit `.env` files
- Use Replit Secrets for sensitive data
- Rotate API keys regularly

### 2. Database Security
- Use connection pooling
- Enable SSL connections
- Regular backup verification

### 3. API Security
- Implement rate limiting
- Validate all inputs
- Use HTTPS in production

### 4. Session Management
- Secure session cookies
- Regular session cleanup
- Strong JWT secrets

## Scaling Considerations

### Horizontal Scaling
The application is designed to scale horizontally:

1. **Load Balancer**: Distribute traffic across multiple instances
2. **Session Store**: Use Redis for shared sessions
3. **Database**: Read replicas for query scaling

### Performance Tuning

1. **Database Optimization**
   ```sql
   -- Index frequently queried columns
   CREATE INDEX idx_alerts_game_id ON alert_logs(game_id);
   CREATE INDEX idx_alerts_timestamp ON alert_logs(created_at);
   ```

2. **Memory Management**
   ```typescript
   // Configure garbage collection
   node --max-old-space-size=512 dist/index.js
   ```

3. **CDN Integration**
   - Serve static assets via CDN
   - Cache API responses where appropriate

## Backup & Recovery

### Database Backups
- Automated daily backups via Neon
- Point-in-time recovery capability
- Regular backup restoration testing

### Application State
- User settings backed up with user data
- Alert logs retained for 90 days
- System configurations versioned

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   - Check firewall settings
   - Verify SSL certificate
   - Monitor connection logs

2. **API Rate Limiting**
   - Monitor external API usage
   - Implement exponential backoff
   - Cache responses where possible

3. **High Memory Usage**
   - Monitor game state cache size
   - Implement periodic cleanup
   - Check for memory leaks

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=production DEBUG=chirpbot:* npm start
```

### Log Analysis

Key log patterns to monitor:
```bash
# Alert frequency
grep "Alert sent" logs/*.log | wc -l

# Error rates  
grep "ERROR" logs/*.log | tail -20

# API response times
grep "API response time" logs/*.log | awk '{print $NF}'
```

## Maintenance

### Regular Tasks
- Monitor disk usage and logs
- Review alert effectiveness metrics
- Update dependencies monthly
- Test backup restoration quarterly

### Emergency Procedures
- System restart: `pm2 restart all`
- Emergency disable: Set `ALERTS_ENABLED=false`
- Database failover: Update `DATABASE_URL`

## Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test database connectivity
4. Validate external API access

The application includes comprehensive logging and monitoring to facilitate troubleshooting and performance optimization.
