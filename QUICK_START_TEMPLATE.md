
# Quick Start Template for ChirpBot V3 Duplicate

## Minimal Viable Product (MVP) Setup

### 1. Project Structure
```
your-sports-app/
├── client/               # React frontend
├── server/               # Node.js backend
├── shared/               # Shared types/schemas
├── public/               # Static assets
└── scripts/              # Build/utility scripts
```

### 2. Essential Environment Variables
```env
# Required for startup
NODE_ENV=development
PORT=5000
SESSION_SECRET=your-32-char-secret-here
DATABASE_URL=your-postgresql-url

# Optional for full features
OPENAI_API_KEY=your-openai-key
MLB_API_KEY=your-mlb-key
ESPN_API_KEY=your-espn-key
```

### 3. Core Package.json Structure
```json
{
  "name": "your-sports-app",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --bundle --outdir=dist",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "react": "^18.3.1",
    "express": "^4.21.2",
    "drizzle-orm": "^0.39.1",
    "@tanstack/react-query": "^5.60.5",
    "tailwindcss": "^3.4.17"
  }
}
```

### 4. Minimum Database Schema
```typescript
// shared/schema.ts - Start with these core tables
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 100 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  sport: varchar('sport', { length: 10 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  gameId: varchar('game_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  sport: varchar('sport', { length: 10 }).notNull(),
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(true),
});
```

### 5. Basic Server Structure
```typescript
// server/index.ts - Minimal server setup
import express from 'express';
import session from 'express-session';
import { db } from './db';

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
}));

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 6. Basic React App
```typescript
// client/src/App.tsx - Minimal frontend
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-900 text-white">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </div>
    </QueryClientProvider>
  );
}
```

## Development Phases

### Week 1: Foundation
- [ ] Set up React + Express structure
- [ ] Implement basic authentication
- [ ] Create database schema
- [ ] Build login/signup pages

### Week 2: Core Features
- [ ] Add user settings system
- [ ] Create alert display components
- [ ] Implement basic API endpoints
- [ ] Add real-time updates (polling)

### Week 3: Sport Integration
- [ ] Choose 1-2 sports to start with
- [ ] Implement basic game data fetching
- [ ] Create simple alert generation
- [ ] Add user preference filtering

### Week 4: Enhancement
- [ ] Add AI integration (optional)
- [ ] Improve UI/UX design
- [ ] Add mobile responsiveness
- [ ] Implement error handling

## Key Design Principles from ChirpBot V3

1. **Weather-on-Live Architecture**: Only activate heavy processing when games are live
2. **Alert Cylinders**: Modular alert generation for each sport
3. **User-Centric Filtering**: Global + personal settings for alert control
4. **Real-time Without WebSockets**: HTTP polling for simplicity
5. **AI Enhancement**: Optional layer that can be added later
6. **Memory Management**: Built-in cleanup and resource monitoring

This template gives you a production-ready starting point based on ChirpBot V3's proven architecture.
