# ChirpBot V3 - Complete Deduplication Audit Report

## Executive Summary

This audit identified **6 distinct deduplication implementations** across the codebase, with **multiple redundant and potentially conflicting systems**. The primary **UnifiedDeduplicator** is properly implemented but **not universally adopted**, leading to inconsistent deduplication behavior.

---

## 1. PRIMARY SYSTEM: UnifiedDeduplicator ✅

**Location:** `server/services/unified-deduplicator.ts`

**Purpose:** Consolidated deduplication system handling 3 distinct types:
- Alert deduplication (game-context aware)
- HTTP request deduplication (middleware + caching)
- Fingerprint-based deduplication (lifecycle management)

**How it works:**
- **Alert Dedup:** Uses `alertCache` Map with 2-minute TTL window
  - Key structure: `{gameId, type, inning, half, outs, bases, batter, homeScore, awayScore, etc.}`
  - Detects exact duplicates and escalations
  - Lines: 92-295

- **Request Dedup:** Uses `requestCache` and `inflightRequests` Maps
  - Deduplicates GET requests to `/api` paths
  - 5-second cache TTL
  - Lines: 297-412

- **Fingerprint Dedup:** Uses `fingerprintStore` Map
  - Lifecycle-based deduplication (10-minute TTL)
  - Per-type cooldown support
  - Lines: 513-577

**Status:** ✅ **CANONICAL SYSTEM** - Should be the only deduplication system

---

## 2. REDUNDANT: Telegram Service Deduplication ⚠️

**Location:** `server/services/telegram.ts:38-43`

**Code:**
```typescript
const sentCache = new Map<string, number>();
const shouldSend = (dedupKey: string) => {
  const last = sentCache.get(dedupKey) ?? 0;
  if (Date.now() - last < 30000) return false; // 30 second dedup
  sentCache.set(dedupKey, now);
  return true;
}
```

**What it deduplicates:** Telegram alert messages
**How:** 30-second cache with key `${alert.type}:${gameId}`
**Conflicts with UnifiedDeduplicator:** ❌ YES
- Uses different key structure
- Different TTL (30s vs 2min)
- Happens AFTER UnifiedDeduplicator check
- Creates double-deduplication

**Recommendation:** ❌ **REMOVE** - UnifiedDeduplicator already handles this

---

## 3. REDUNDANT: SSE Broadcast Deduplication ⚠️

**Location:** `server/routes.ts:527-570`

**Code:**
```typescript
const recentBroadcasts = new Map<string, number>(); // alertKey -> timestamp
const BROADCAST_DEDUPE_TTL = 2000; // 2 seconds

// In broadcast function:
if (lastBroadcast && (now - lastBroadcast) < BROADCAST_DEDUPE_TTL) {
  console.log(`🚫 Duplicate broadcast prevented`);
  return;
}
```

**What it deduplicates:** SSE broadcast messages to connected clients
**How:** 2-second TTL on alertKey
**Conflicts with UnifiedDeduplicator:** ⚠️ PARTIAL
- Different purpose (prevents rapid re-broadcasts)
- Very short TTL (2s vs 2min)
- Acts as a "broadcast throttle" not dedup

**Recommendation:** ⚠️ **KEEP BUT DOCUMENT** - Serves different purpose (broadcast throttling vs alert deduplication)

---

## 4. REDUNDANT: Per-Module Cooldown Systems ❌

Multiple alert modules implement their own cooldown tracking:

### 4.1 MLB Modules

**`scoring-opportunity-module.ts:9-47`**
```typescript
private lastAlerts: Map<string, number> = new Map();
private readonly COOLDOWN_MS = 120000; // 2 minutes

// In isTriggered():
const lastAlert = this.lastAlerts.get(situationKey);
if (lastAlert && (Date.now() - lastAlert) < this.COOLDOWN_MS) {
  return false;
}
this.lastAlerts.set(situationKey, Date.now());
```

**`on-deck-prediction-module.ts:8-80`**
```typescript
private lastAlertedBatter: { [gameId: string]: { batter: string; situation: string; timestamp: number } } = {};
private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// In generateAlert():
if (lastAlert && lastAlert.batter === onDeckBatter && 
    lastAlert.situation === situationKey &&
    Date.now() - lastAlert.timestamp < this.ALERT_COOLDOWN) {
  return null;
}
```

**`wind-change-module.ts`** - Has lastAlerts tracking

### 4.2 NCAAF Modules

**`close-game-module.ts:9-43`**
```typescript
private lastAlerts: Map<string, number> = new Map();
private readonly COOLDOWN_MS = 180000; // 3 minutes

// Same pattern as MLB modules
```

**`massive-weather-module.ts`** - Has lastAlerts tracking

### 4.3 NFL Modules

**`turnover-likelihood-module.ts`** - Has lastAlerts tracking
**`massive-weather-module.ts`** - Has lastAlerts tracking

### 4.4 CFL Modules

**`massive-weather-module.ts`** - Has lastAlerts tracking

### 4.5 WNBA Modules

**`comeback-potential-module.ts`** - Has lastAlerts tracking

**What they deduplicate:** Individual module alerts
**How:** Local Map with varying cooldown periods (2-5 minutes)
**Conflicts with UnifiedDeduplicator:** ❌ YES - MAJOR CONFLICT
- Different key structures per module
- Different TTLs (2-5min vs UnifiedDeduplicator 2min)
- Dedup happens BEFORE UnifiedDeduplicator check
- Creates triple-deduplication in some cases

**Recommendation:** ❌ **REMOVE ALL** - UnifiedDeduplicator handles this

---

## 5. PROPER USAGE: Weather Service ✅

**Location:** `server/services/weather-on-live-service.ts:756-764`

**Code:**
```typescript
// Check for duplicates using unified deduplicator
const dedupKey = {
  gameId: change.gameId,
  type: change.changeType,
  sport: change.sport
};
if (!unifiedDeduplicator.shouldSendAlert(dedupKey)) {
  console.log(`🔄 Weather alert deduplicated: ${alertKey}`);
  return;
}
```

**Status:** ✅ **CORRECT** - Uses UnifiedDeduplicator properly

---

## 6. PROPER USAGE: Unified Alert Generator ✅

**Location:** `server/services/unified-alert-generator.ts:1150`

**Code:**
```typescript
if (this.deduplication.shouldSendAlert(alertKeyObj)) {
  // Create and process alert
}
```

**Status:** ✅ **CORRECT** - Uses UnifiedDeduplicator as intended

---

## Conflict Analysis

### Critical Issues:

1. **Triple Deduplication Pipeline:**
   ```
   Module cooldown → UnifiedDeduplicator → Telegram sentCache
   ```
   Alert can be blocked at any of 3 points with different logic

2. **Inconsistent Key Structures:**
   - Module: `${gameId}_${type}_${situation}`
   - UnifiedDeduplicator: `{gameId, type, inning, half, outs, bases, batter, ...}`
   - Telegram: `${type}:${gameId}`
   
   Same alert has different fingerprints at each level

3. **Varying TTLs:**
   - Module cooldowns: 2-5 minutes
   - UnifiedDeduplicator: 2 minutes (alerts), 10 minutes (fingerprints)
   - Telegram: 30 seconds
   - SSE Broadcast: 2 seconds

4. **Race Conditions:**
   - Module updates its cache
   - UnifiedDeduplicator updates its cache
   - If game state changes rapidly, can get into inconsistent state

5. **Memory Leaks:**
   - Module Maps never cleared (grow indefinitely)
   - UnifiedDeduplicator has proper cleanup
   - Multiple Maps tracking same data

---

## Recommendations

### Phase 1: Remove Redundant Systems (High Priority)

1. **Remove all per-module cooldown systems** ❌
   - Files: All modules listed in section 4
   - Lines: Remove `lastAlerts`, `lastAlertedBatter` Maps and cooldown checks
   - Reason: UnifiedDeduplicator handles this better

2. **Remove Telegram sentCache deduplication** ❌
   - File: `server/services/telegram.ts:38-43`
   - Remove `sentCache` Map and `shouldSend()` function
   - Reason: Duplicate of UnifiedDeduplicator logic

### Phase 2: Document Remaining Systems

3. **Keep SSE Broadcast throttling** ✅
   - File: `server/routes.ts:527-570`
   - Add comment explaining this is THROTTLING not DEDUPLICATION
   - Different purpose than alert deduplication

### Phase 3: Standardize on UnifiedDeduplicator

4. **Ensure all alert paths use UnifiedDeduplicator**
   - Weather Service: ✅ Already compliant
   - Alert Generator: ✅ Already compliant
   - All engines: ⚠️ Need to remove local dedup

5. **Update UnifiedDeduplicator configuration**
   - Document the 2-minute alert window
   - Document the fingerprint lifecycle logic
   - Add configuration options for per-sport TTLs if needed

---

## Migration Plan

### Step 1: Remove Module-Level Deduplication
```bash
# Files to modify (remove lastAlerts/cooldown logic):
server/services/engines/alert-cylinders/mlb/scoring-opportunity-module.ts
server/services/engines/alert-cylinders/mlb/on-deck-prediction-module.ts
server/services/engines/alert-cylinders/mlb/wind-change-module.ts
server/services/engines/alert-cylinders/ncaaf/close-game-module.ts
server/services/engines/alert-cylinders/ncaaf/massive-weather-module.ts
server/services/engines/alert-cylinders/nfl/turnover-likelihood-module.ts
server/services/engines/alert-cylinders/nfl/massive-weather-module.ts
server/services/engines/alert-cylinders/cfl/massive-weather-module.ts
server/services/engines/alert-cylinders/wnba/comeback-potential-module.ts
```

### Step 2: Remove Telegram Deduplication
```bash
# File to modify:
server/services/telegram.ts
# Remove lines 38-43 (sentCache logic)
```

### Step 3: Test and Verify
- Verify alerts still deduplicate correctly
- Check that no alert spam occurs
- Monitor memory usage (should decrease)
- Verify timing is consistent

---

## File Summary

### ✅ Keep (Correct Usage):
- `server/services/unified-deduplicator.ts` - PRIMARY SYSTEM
- `server/services/weather-on-live-service.ts:756-764` - Uses UnifiedDeduplicator
- `server/services/unified-alert-generator.ts:1150` - Uses UnifiedDeduplicator
- `server/routes.ts:527-570` - SSE broadcast throttling (different purpose)

### ❌ Remove (Redundant/Conflicting):
- `server/services/telegram.ts:38-43` - Duplicate deduplication
- All alert cylinder modules with `lastAlerts` or cooldown Maps (9 files)

---

## Metrics Before vs After Cleanup

### Before:
- **6 deduplication systems**
- **12+ Maps tracking alerts**
- **Inconsistent TTLs** (2s to 5min)
- **Memory leaks** in module Maps
- **Triple deduplication** on some alerts

### After:
- **2 systems** (UnifiedDeduplicator + SSE throttle)
- **3 Maps total** (alert, request, fingerprint in UnifiedDeduplicator)
- **Consistent TTLs** (documented and configurable)
- **Proper cleanup** via UnifiedDeduplicator
- **Single deduplication** per alert

---

## Conclusion

The current deduplication architecture has **significant redundancy and conflicts**. By removing the 10 redundant implementations and standardizing on **UnifiedDeduplicator**, the system will be:

1. **More reliable** - Single source of truth
2. **More performant** - Less memory overhead
3. **More maintainable** - One system to configure and debug
4. **More consistent** - Same dedup logic across all sports

**Priority:** HIGH - These conflicts can cause alert loss or spam
**Effort:** MEDIUM - 9 modules + 1 service to update
**Risk:** LOW - UnifiedDeduplicator already proven and tested
