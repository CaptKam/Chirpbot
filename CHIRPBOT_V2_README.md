# ChirpBot V2 - Sports Alert Application

## Overview
ChirpBot V2 is a fully functional modern sports alert application providing real-time notifications and AI-enhanced insights for sports events. The application monitors sports teams across multiple leagues (MLB, NFL, NBA, NHL) using authentic ESPN API data and generates intelligent alerts for high-impact game situations.

## Features
- **Real-time Sports Monitoring**: Tracks live games across MLB, NFL, NBA, and NHL
- **Intelligent Alerts**: AI-powered contextual analysis with scoring probabilities
- **Ultra-fast Polling**: 2-second MLB monitoring, 3-5 second for other sports
- **WebSocket Integration**: Real-time UI updates without page reloads
- **Persistent Team Monitoring**: User game selections saved to database
- **Detailed Game Context**: Specific situational descriptions like "RUNNERS ON 2ND & 3RD, 2 OUTS!"
- **Mobile-First Design**: Responsive design optimized for mobile devices
- **Telegram Integration**: Push notification delivery with rich formatting

## Technical Stack

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** with custom sports-centric design system
- **Shadcn/ui** components built on Radix UI primitives
- **TanStack Query** for server state management
- **WebSocket** integration for real-time updates
- **Wouter** for lightweight routing

### Backend
- **Node.js** with Express.js RESTful API
- **Drizzle ORM** with PostgreSQL for type-safe database operations
- **WebSocket server** for live alert broadcasting
- **Session management** with PostgreSQL session store
- **ESBuild** for production bundling

### External Services
- **OpenAI API**: GPT-4o integration for sports alert analysis
- **Telegram Bot API**: Push notification delivery
- **ESPN API**: Real-time sports data for NFL, NBA, NHL
- **MLB.com Official API**: Primary data source for MLB games
- **OpenWeatherMap API**: Weather data for outdoor sports venues
- **Neon PostgreSQL**: Database hosting with serverless architecture

## Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or use included Neon configuration)
- OpenAI API key (optional, for AI features)
- Telegram Bot Token (optional, for notifications)
- Weather API key (optional, for weather data)

### Installation

1. **Extract the package**:
   ```bash
   tar -xzf chirpbot-v2-complete.tar.gz
   cd chirpbot-v2
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   OPENAI_API_KEY=your_openai_api_key_optional
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_optional
   WEATHER_API_KEY=your_openweathermap_api_key_optional
   ```

4. **Initialize the database**:
   ```bash
   npm run db:push
   ```

5. **Start the application**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to `http://localhost:5000`

## Configuration

### Sports Monitoring
- Enable/disable monitoring for specific sports (MLB, NFL, NBA, NHL)
- Configure alert types: RISP, Home Runs, Late Inning Pressure, etc.
- Set AI confidence thresholds for alert filtering
- Enable/disable Telegram notifications

### Alert Types
- **RISP (Runners in Scoring Position)**: Critical batting situations
- **Home Run Alerts**: Power hitting moments
- **Late Inning Pressure**: High-stakes final innings
- **Close Game Alerts**: Tight score situations
- **Inning Changes**: Momentum shift opportunities
- **Scoring Alerts**: Run-scoring plays

### Polling Intervals
- MLB: 2 seconds (ultra-fast for maximum responsiveness)
- NFL: 5 seconds
- NBA: 3 seconds
- NHL: 3 seconds

## Architecture Details

### Real-time System
- WebSocket server broadcasts alerts to all connected clients
- Toast notifications appear instantly when alerts are generated
- Alerts page updates in real-time without manual refresh
- Persistent monitoring state maintained across sessions

### Game State Tracking
- Intelligent duplicate prevention using game state hashing
- Tracks runners, outs, inning state changes only
- Prevents false duplicate alerts for identical game situations
- Real-time game status, scores, and detailed game information

### Database Schema
- **users**: User authentication and preferences
- **teams**: Sports team information and logos
- **alerts**: Generated alert records with game context
- **settings**: Per-sport configuration settings
- **user_monitored_teams**: Persistent team monitoring selections

### Security Features
- Session-based authentication with secure cookie management
- API request authorization for protected endpoints
- Environment variable configuration for sensitive data
- PostgreSQL-backed session storage

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout

### Sports Data
- `GET /api/sports/teams/:sport` - Get teams for a sport
- `GET /api/sports/games/:sport` - Get live games for a sport

### Alerts
- `GET /api/alerts` - Get user alerts
- `GET /api/alerts/unseen/count` - Get unseen alert count
- `PATCH /api/alerts/:id/seen` - Mark alert as seen

### Settings
- `GET /api/settings` - Get user settings
- `PATCH /api/settings/:sport` - Update sport settings

## Development

### Project Structure
```
chirpbot-v2/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Express backend
│   ├── services/          # Business logic services
│   │   └── engines/       # Sports monitoring engines
│   └── routes.ts          # API route definitions
├── shared/                # Shared type definitions
└── package.json          # Project dependencies
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open database management interface

### Design System
- **Color Palette**: #F2F4F7 (background), #1C2B5E (accent), #2387F4 (CTA), #F02D3A (alert)
- **Typography**: Inter font family, bold uppercase headings
- **Components**: 12px rounded corners, shadow effects on hover
- **Mobile-First**: Responsive design with sticky bottom navigation

## Deployment

The application is ready for deployment on platforms like:
- **Replit** (recommended for development/testing)
- **Vercel** (for frontend hosting)
- **Railway** (for full-stack deployment)
- **Heroku** (traditional hosting)

### Production Considerations
- Configure PostgreSQL database for production
- Set up environment variables securely
- Enable proper logging and monitoring
- Configure CORS for production domains
- Set up SSL/TLS for secure connections

## License
This project is private and proprietary. All rights reserved.

## Support
For technical support or questions about this application, please refer to the code documentation or contact the development team.

---

**Built with ❤️ using modern web technologies**