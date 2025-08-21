# ChirpBot V2 - Deployment Instructions

## Download Package
The complete application is packaged in: **chirpbot-v2-complete.tar.gz** (435KB)

## Prerequisites
- Node.js 18+ 
- PostgreSQL database
- API Keys: OpenAI, AccuWeather (optional)

## Installation Steps

1. **Extract the archive:**
```bash
tar -xzf chirpbot-v2-complete.tar.gz
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
Create a `.env` file with:
```
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_key
ACCUWEATHER_API_KEY=your_weather_key (optional)
```

4. **Initialize database:**
```bash
npm run db:push
```

5. **Run the application:**
```bash
npm run dev
```

The app will be available at http://localhost:5000

## Key Features
- Real-time sports monitoring (MLB, NFL, NBA, NHL)
- AI-powered alerts (currently optimized to minimize API calls)
- Weather integration for outdoor games
- Demo mode with realistic alert simulation
- Telegram notifications support

## Notes
- OpenAI API calls have been optimized to reduce usage by ~95%
- All settings are configurable through the web interface
- Demo account: username "demo" (no password required)

## Production Deployment
For production deployment on Replit or other platforms, use the built-in deployment features or refer to your platform's documentation.