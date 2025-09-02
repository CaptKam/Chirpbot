# ChirpBot Back Office — Admin Dashboard

A comprehensive admin dashboard for monitoring and managing the ChirpBot V2 sports alert system.

## Features

- **Live Dashboard** - Real-time KPIs and system monitoring
- **Alert Management** - ACK, MUTE, and RESEND actions with audit trail
- **System Health** - Component status monitoring and health checks  
- **Games Monitoring** - Live game tracking and status updates
- **Rules Management** - Dynamic alert configuration and thresholds
- **User Management** - Role-based access control (ADMIN/OPERATOR/VIEWER)
- **Audit Logging** - Complete activity tracking and compliance

## Quick Start

1. **Install Dependencies**
   ```bash
   cd admin
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Database Setup**
   The admin dashboard uses the same PostgreSQL database as the main ChirpBot application. Schema extensions are automatically applied.

4. **Development Server**
   ```bash
   npm run dev
   # Opens at http://localhost:3001
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | NextAuth secret key | ✅ |
| `NEXTAUTH_URL` | Admin dashboard URL | ✅ |
| `ADMIN_EMAIL` | Default admin email | ✅ |
| `ADMIN_PASSWORD` | Default admin password | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ❌ |
| `REDIS_URL` | Redis for WebSocket scaling | ❌ |

## Authentication

### Credentials Login
Default admin access using email/password configured in environment variables.

### Google OAuth  
Optional OAuth integration for team access with role-based permissions.

## Role-Based Access Control

- **ADMIN** - Full system access including user management
- **OPERATOR** - Alert management and system monitoring
- **VIEWER** - Read-only dashboard access

## API Endpoints

### Admin APIs
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/alerts` - Alert management
- `PATCH /api/admin/alerts` - Alert actions (ACK/MUTE/RESEND)
- `GET /api/admin/health` - System health status
- `POST /api/admin/health` - Health check updates

### Authentication
- `POST /api/auth/signin` - User authentication
- `POST /api/auth/signout` - Session termination

## Database Schema

The admin dashboard extends the existing ChirpBot schema with:

- `audit_logs` - Administrative action tracking
- `health_snapshots` - System component health history
- `admin_actions` - Idempotency keys for safe mutations
- `rules` - Dynamic alert configuration
- Enhanced `alerts` table with status management

## Deployment

### Replit (Recommended)
1. Create new Replit with Node.js
2. Import admin dashboard code
3. Set environment variables in Replit Secrets
4. Configure custom domain: `admin.yourdomain.com`

### Vercel + Replit Hybrid
- **UI**: Deploy to Vercel for optimal performance  
- **API**: Keep on Replit for database access
- Configure CORS for cross-origin requests

## Architecture

- **Frontend**: Next.js 14 with App Router
- **UI Library**: shadcn/ui with Tailwind CSS
- **Authentication**: NextAuth.js with multiple providers
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket integration for live updates
- **State Management**: React hooks with SWR-like patterns

## Security Features

- Session-based authentication with secure cookies
- Role-based route protection  
- CSRF protection on mutations
- Rate limiting on admin actions
- Complete audit trail for compliance
- Idempotency keys for safe retries

## Development

```bash
# Install dependencies
npm install

# Start development server  
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run lint
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database connection verified
- [ ] Admin user credentials set
- [ ] SSL/TLS certificate configured
- [ ] Custom domain pointing to deployment
- [ ] Health checks responding
- [ ] Audit logging enabled
- [ ] Role permissions tested

## Support

This admin dashboard integrates seamlessly with your existing ChirpBot V2 system, providing comprehensive operational control and monitoring capabilities.