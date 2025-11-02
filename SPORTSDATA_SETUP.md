
# SportsData.io Integration Setup

## Overview
ChirpBot now uses SportsData.io as a fallback source for timeout data when ESPN doesn't provide it.

## Setup Steps

1. **Get your API key from SportsData.io**
   - Sign up at https://sportsdata.io/
   - Navigate to your dashboard and get your API key

2. **Add to environment variables**
   Add this to your `.env` file (create one if it doesn't exist):
   ```
   SPORTSDATA_API_KEY=your_api_key_here
   ```

3. **Restart your application**
   The integration will automatically activate once the API key is detected.

## Testing

Test the integration with:
```bash
curl http://0.0.0.0:5000/api/test-sportsdata/NFL/401772766
```

Replace `NFL` with `NCAAF` or `CFL` as needed, and use a valid game ID.

## How It Works

- **Primary Source**: ESPN API (existing)
- **Fallback Source**: SportsData.io (new)
- **Data Flow**: 
  1. System tries ESPN first
  2. If ESPN returns null/undefined for timeouts, system tries SportsData.io
  3. If both fail, defaults to standard timeout counts (3 for NFL/NCAAF, 1 for CFL)

## API Endpoints

The timeout data is automatically available through existing endpoints:
- `/api/nfl/timeouts/:gameId`
- `/api/ncaaf/timeouts/:gameId`
- `/api/cfl/timeouts/:gameId`

## Cache

SportsData.io responses are cached for 5 seconds to minimize API calls and stay within rate limits.
