
# Alert Integration Guide - Complete Checklist

## When Adding ANY New Alert Type, Follow These Steps:

### 1. **Define Alert Configuration** 
Add to `client/src/pages/settings.tsx` in `ALERT_TYPE_CONFIG`:

```typescript
// Example for new MLB alert
MLB: [
  // ... existing alerts
  { key: 'NEW_ALERT_TYPE', label: 'New Alert Name', description: 'Description of when this alert triggers' }
]

// For other sports, add to appropriate section:
NFL: [...], NBA: [...], etc.
```

### 2. **Update Admin Panel Configuration**
Add to `public/admin/dashboard.js` in the alert configuration:

```javascript
// Add to appropriate sport's alert list
const MLB_ALERTS = [
  // ... existing alerts
  { key: 'NEW_ALERT_TYPE', label: 'New Alert Name', description: 'Description' }
];
```

### 3. **Update Storage Default Settings**
Add to `server/storage.ts` in `getGlobalAlertSettings()` default settings:

```typescript
const defaultSettings: Record<string, boolean> = {
  // ... existing defaults
  'NEW_ALERT_TYPE': true, // Default to enabled
};
```

### 4. **Update Backend Routes** 
Ensure `server/routes.ts` handles the new alert type in:
- `/api/admin/global-alert-settings/:sport` 
- `/api/user/:userId/alert-preferences/:sport`
- Alert filtering logic in `/api/alerts`

### 5. **Add to Alert Generation Engine**
Add detection logic in appropriate engine file:
- `server/services/engines/mlb-engine.ts` for MLB
- `server/services/engines/ncaaf-engine.ts` for NCAAF  
- `server/services/engines/wnba-engine.ts` for WNBA

```typescript
// Example detection method
private detectNewAlertType(gameData: any): boolean {
  // Your detection logic here
  return conditionMet;
}

// Add to main monitoring method
if (this.detectNewAlertType(gameData)) {
  await this.generateAlert('NEW_ALERT_TYPE', context);
}
```

### 6. **Update Alert Display**
Verify alert renders properly in:
- `client/src/components/SwipeableCard.tsx`
- `client/src/components/SimpleAlertCard.tsx`
- `client/src/pages/alerts.tsx`

### 7. **Test Integration Points**

**Admin Panel:**
- ✅ Toggle appears in admin dashboard
- ✅ Can enable/disable globally  
- ✅ "Apply to All Users" works
- ✅ Individual user management works

**User Settings:**
- ✅ Toggle appears in settings page
- ✅ User can enable/disable individually
- ✅ Respects global admin overrides
- ✅ Settings persist across sessions

**Alert Generation:**
- ✅ Alerts generate when conditions met
- ✅ Deduplication works properly
- ✅ Telegram delivery works
- ✅ WebSocket broadcasting works

### 8. **Routes Verification Checklist**

**Required API Endpoints:**
- ✅ `GET /api/admin/global-alert-settings/:sport` - Returns new alert in settings
- ✅ `PUT /api/admin/global-alert-setting` - Can update new alert globally  
- ✅ `GET /api/user/:userId/alert-preferences/:sport` - Returns user preference
- ✅ `POST /api/user/:userId/alert-preferences` - Can update user preference
- ✅ `GET /api/alerts` - Properly filters based on global settings

## **Template Files to Update:**

### settings.tsx (User Interface)
```typescript
// Add to appropriate sport section in ALERT_TYPE_CONFIG
{ key: 'NEW_ALERT_TYPE', label: 'Alert Label', description: 'When this alert triggers' }
```

### dashboard.js (Admin Interface)  
```javascript
// Add to alert configuration object
{ key: 'NEW_ALERT_TYPE', label: 'Alert Label', description: 'Admin description' }
```

### storage.ts (Backend Defaults)
```typescript
// Add to defaultSettings object
'NEW_ALERT_TYPE': true,
```

### Engine File (Detection Logic)
```typescript
// Add detection method and integrate into monitoring loop
```

## **Validation Commands:**

Run these to verify integration:
```bash
# Test admin endpoints
curl -X GET http://localhost:5173/api/admin/global-alert-settings/MLB

# Test user endpoints  
curl -X GET http://localhost:5173/api/user/{userId}/alert-preferences/mlb

# Test alert generation
curl -X POST http://localhost:5173/api/alerts/force-generate
```

## **Common Gotchas:**
- ❌ Forgetting to add to defaultSettings (breaks global settings)
- ❌ Case sensitivity mismatch between frontend/backend  
- ❌ Not updating both admin AND user interfaces
- ❌ Forgetting to add detection logic to engine
- ❌ Not testing global disable functionality

Follow this checklist completely for every new alert type!
