
# ChirpBot V3 - API Documentation

## Base URL
`https://your-app.replit.app/api`

## Authentication
Most endpoints require session authentication. Admin endpoints require elevated permissions.

## Sports Data Endpoints

### GET `/api/sports/games`
Get current live games across all sports.

**Query Parameters:**
- `sport` (optional): Filter by sport (mlb, nfl, nba, nhl)
- `status` (optional): Filter by status (live, scheduled, completed)

**Response:**
```json
{
  "games": [
    {
      "id": "mlb-776564",
      "sport": "MLB",
      "homeTeam": { "name": "Baltimore Orioles", "score": 2 },
      "awayTeam": { "name": "Boston Red Sox", "score": 1 },
      "status": "live",
      "inning": 9,
      "inningState": "bottom"
    }
  ],
  "total": 5,
  "live": 2
}
```

### GET `/api/sports/game/:gameId`
Get detailed information for a specific game.

**Response:**
```json
{
  "game": {
    "id": "mlb-776564",
    "gameState": {
      "runners": { "first": "Alex Jackson", "second": null, "third": null },
      "outs": 0,
      "balls": 2,
      "strikes": 1,
      "currentBatter": "Jeremiah Jackson"
    },
    "weather": {
      "temperature": 78,
      "windSpeed": 8,
      "windDirection": "out"
    }
  }
}
```

## Alert System Endpoints

### GET `/api/alerts`
Get user's alert history.

**Query Parameters:**
- `limit` (default: 50): Number of alerts to return
- `tier` (optional): Filter by alert tier (1, 2, 3, 4)
- `since` (optional): ISO timestamp for alerts since date

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123",
      "tier": 3,
      "game": "Boston Red Sox @ Baltimore Orioles",
      "situation": "Bases loaded, 0 outs",
      "probability": 0.847,
      "reasons": ["RISP", "Power hitter", "Late inning"],
      "timestamp": "2025-01-28T19:45:23Z"
    }
  ]
}
```

### POST `/api/alerts/test`
Trigger a test alert (admin only).

**Request Body:**
```json
{
  "tier": 2,
  "gameId": "mlb-776564",
  "situation": "Test scenario"
}
```

## User Settings Endpoints

### GET `/api/user/settings`
Get current user's alert preferences.

**Response:**
```json
{
  "settings": {
    "fourLevelEnabled": true,
    "sports": {
      "mlb": true,
      "nfl": false,
      "nba": true,
      "nhl": false
    },
    "alertTypes": {
      "risp": true,
      "basesLoaded": true,
      "powerHitter": true,
      "lateInning": true
    },
    "notifications": {
      "telegram": true,
      "email": false,
      "push": true
    }
  }
}
```

### PUT `/api/user/settings`
Update user's alert preferences.

**Request Body:**
```json
{
  "fourLevelEnabled": true,
  "sports": { "mlb": true },
  "alertTypes": { "risp": true, "powerHitter": false }
}
```

## Admin Endpoints

### GET `/api/admin/health`
Get system health status (admin only).

**Response:**
```json
{
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "espnApi": "healthy", 
    "weatherApi": "degraded",
    "telegram": "healthy"
  },
  "alertStats": {
    "last24h": {
      "tier1": 45,
      "tier2": 23,
      "tier3": 8,
      "tier4": 2
    }
  }
}
```

### GET `/api/admin/audit-logs`
Get alert audit trail (admin only).

**Query Parameters:**
- `startDate`: ISO timestamp
- `endDate`: ISO timestamp
- `gameId` (optional): Filter by specific game

**Response:**
```json
{
  "logs": [
    {
      "id": "log_456",
      "alertId": "alert_123",
      "gameId": "mlb-776564", 
      "tier": 3,
      "probability": 0.847,
      "reasons": ["RISP", "Power hitter"],
      "dedupKey": "mlb-776564-9-bottom-0-risp",
      "sent": true,
      "timestamp": "2025-01-28T19:45:23Z"
    }
  ]
}
```

### POST `/api/admin/master-controls`
Update master alert controls (admin only).

**Request Body:**
```json
{
  "globalEnabled": true,
  "thresholds": {
    "tier1": 0.65,
    "tier2": 0.70,
    "tier3": 0.80
  },
  "cooldowns": {
    "tier1": 60,
    "tier2": 90,
    "tier3": 120
  }
}
```

## WebSocket Events

### Connection
Connect to `/ws` with authentication.

### Events Received

#### `new_alert`
Real-time alert notification.
```json
{
  "type": "new_alert",
  "data": {
    "id": "alert_789",
    "tier": 2,
    "game": "Chicago Cubs @ San Francisco Giants",
    "situation": "Runner in scoring position",
    "probability": 0.723,
    "timestamp": "2025-01-28T20:15:30Z"
  }
}
```

#### `game_update`
Live game state changes.
```json
{
  "type": "game_update", 
  "data": {
    "gameId": "mlb-776550",
    "inning": 7,
    "inningState": "top",
    "score": { "home": 3, "away": 2 },
    "runners": { "first": null, "second": "Cody Bellinger", "third": null }
  }
}
```

#### `system_status`
System health updates.
```json
{
  "type": "system_status",
  "data": {
    "status": "operational",
    "activeGames": 8,
    "alertsLastHour": 12
  }
}
```

## Error Responses

All endpoints return consistent error formats:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "tier",
      "reason": "Must be between 1 and 4"
    }
  }
}
```

## Rate Limits

- **General API**: 100 requests per minute per user
- **Alert endpoints**: 10 requests per minute per user  
- **WebSocket**: 50 messages per 10 seconds per connection

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error
