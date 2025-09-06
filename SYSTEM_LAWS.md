
# ChirpBot V2 System Laws

These laws govern the development and maintenance of ChirpBot V2 to ensure system reliability, user satisfaction, and maintainable architecture.

## 🛡️ LAW #1: Alert System Integrity Protection
**Never break what's working**

- The MLB alert system represents months of complex development and is production-critical
- Core components are protected: alert generation, WebSocket broadcasting, database persistence  
- Any modifications require extensive testing and rollback plans
- WebSocket connection stability must be maintained at all costs

**Violation Impact**: System downtime, lost real-time functionality

## 👤 LAW #2: User Preference Compliance  
**Respect user choices always**

- Every alert must check global admin settings AND individual user preferences
- Users who disable alert types must never receive those alerts
- Telegram delivery honors user's enabled/disabled state
- Failed validation must log the reason and block the alert

**Violation Impact**: Spam alerts, user dissatisfaction, privacy violations

## ⚡ LAW #3: Performance-First Architecture
**Validate before expensive operations**

- Check deduplication BEFORE calling OpenAI API
- Validate game state BEFORE weather API calls  
- Cache frequently accessed data (weather, team info, user settings)
- Rate limit external APIs to prevent quota exhaustion

**Violation Impact**: Unnecessary costs, degraded performance

## 🏈 LAW #4: Multi-Sport Consistency
**Unified architecture across all sports**

- All sport engines extend BaseEngine class
- Alert data structure consistent across MLB, NFL, NBA, NHL, CFL, NCAAF, WNBA
- Each engine implements the same core methods
- Sport-specific alert cylinders follow established patterns

**Violation Impact**: Inconsistent behavior, maintenance complexity

## 📊 LAW #5: Data Consistency Guarantee
**Complete and accurate alert context**

- Required fields: id, type, sport, title, description, gameInfo, timestamp
- gameInfo includes: homeTeam, awayTeam, score, status, situation
- Scores synchronized between stored alerts and live game data
- Missing data triggers fallbacks, not failures

**Violation Impact**: Broken UI, user confusion

## 🔒 LAW #6: Security and Authentication  
**Protect user data and access**

- All API endpoints validate user authentication
- Admin functions require role verification
- Users can only access their own data
- Sensitive credentials properly encrypted

**Violation Impact**: Data breaches, unauthorized access

## 🔄 LAW #7: Real-Time Reliability
**Stable WebSocket connections**

- Heartbeat system detects dead connections
- Broadcasting handles failures gracefully
- Automatic client reconnection
- Connection health monitoring

**Violation Impact**: Missed critical alerts

## 🎛️ LAW #8: Scalable Alert Management
**Comprehensive admin controls**

- Global toggles override user settings
- Real-time health dashboard
- Emergency alert disable capability  
- Auditable admin actions

**Violation Impact**: No emergency controls during incidents

---

## Implementation Guidelines

### For New Features:
1. Review applicable laws before starting
2. Design with multi-user security in mind
3. Implement proper error handling and fallbacks
4. Add monitoring and health checks
5. Test with various user preference combinations

### For Bug Fixes:
1. Identify which law was violated
2. Fix the root cause, not just symptoms  
3. Add safeguards to prevent regression
4. Update tests to cover the violation

### For Maintenance:
1. Regular health checks on all law compliance
2. Monitor performance metrics and API usage
3. Review logs for preference violations
4. Update documentation when laws evolve

---

**Emergency Contact**: If any law is violated in production, immediately disable affected alerts via admin dashboard and investigate the root cause.
