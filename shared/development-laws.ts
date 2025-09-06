
/**
 * ChirpBot V2 Development Laws
 * These laws ensure system stability, user experience, and maintainable architecture
 */

export const CHIRPBOT_V2_LAWS = {
  // Core System Protection
  LAW_1_ALERT_SYSTEM_PROTECTION: {
    title: "Alert System Integrity Protection",
    description: "DO NOT MODIFY the core alert generation, WebSocket broadcasting, or database persistence without extensive testing",
    rules: [
      "The MLB alert system is production-critical - treat as immutable",
      "All alert modifications must preserve existing deduplication logic",
      "WebSocket connections and real-time broadcasting must remain stable",
      "Database schema changes require migration scripts and rollback plans"
    ],
    violation: "System downtime and loss of real-time functionality"
  },

  LAW_2_USER_PREFERENCE_COMPLIANCE: {
    title: "Mandatory User Settings Validation",
    description: "Every alert MUST respect both global admin settings and individual user preferences",
    rules: [
      "Check global alert settings before generating any alert",
      "Verify user-specific alert preferences before sending notifications", 
      "Telegram delivery must honor user's enabled/disabled state",
      "Failed preference validation must log reason and block alert"
    ],
    violation: "Users receive unwanted alerts, violating user consent"
  },

  LAW_3_PERFORMANCE_FIRST_ARCHITECTURE: {
    title: "Efficiency Before Expensive Operations", 
    description: "Always validate and deduplicate before calling external APIs or AI services",
    rules: [
      "Check alert deduplication BEFORE OpenAI analysis",
      "Validate game state BEFORE weather API calls",
      "Cache frequently accessed data (weather, team info, settings)",
      "Rate limit external API calls to prevent quota exhaustion"
    ],
    violation: "Unnecessary API costs and degraded performance"
  },

  LAW_4_MULTI_SPORT_CONSISTENCY: {
    title: "Unified Sports Engine Architecture",
    description: "All sports engines must follow the same patterns and interfaces",
    rules: [
      "New sport engines must extend BaseEngine class",
      "Alert data structure must be consistent across all sports",
      "Each engine must implement the same core methods (getTodaysGames, processLiveGame)",
      "Sport-specific alert cylinders must follow the established pattern"
    ],
    violation: "Inconsistent behavior and maintenance nightmares"
  },

  LAW_5_DATA_CONSISTENCY_GUARANTEE: {
    title: "Alert Data Integrity",
    description: "All alerts must contain complete, accurate game context information",
    rules: [
      "Required fields: id, type, sport, title, description, gameInfo, timestamp",
      "gameInfo must include: homeTeam, awayTeam, score, status, situation",
      "Scores must be synchronized between stored alerts and live game data",
      "Missing or invalid data must trigger fallback mechanisms, not failures"
    ],
    violation: "Broken UI displays and user confusion"
  },

  LAW_6_SECURITY_AND_AUTHENTICATION: {
    title: "Secure Multi-User Architecture",
    description: "Protect user data and maintain proper access controls",
    rules: [
      "All API endpoints must validate user authentication",
      "Admin functions require role verification (requireAdmin middleware)",
      "User data isolation - users can only access their own preferences/alerts",
      "Sensitive credentials (Telegram tokens) must be properly encrypted"
    ],
    violation: "Data breaches and unauthorized access"
  },

  LAW_7_REAL_TIME_RELIABILITY: {
    title: "WebSocket Connection Stability",
    description: "Maintain robust real-time connections for live alerts",
    rules: [
      "WebSocket heartbeat system must detect and clean dead connections",
      "Alert broadcasting must handle connection failures gracefully", 
      "Client reconnection logic must be automatic and transparent",
      "Connection state must be visible in health monitoring"
    ],
    violation: "Users miss critical live alerts"
  },

  LAW_8_SCALABLE_ALERT_MANAGEMENT: {
    title: "Admin Control System",
    description: "Provide comprehensive admin tools for alert system management",
    rules: [
      "Global alert toggles must override individual user settings",
      "Admin dashboard must show real-time system health",
      "Alert generation can be disabled globally for maintenance",
      "Admin actions must be logged and auditable"
    ],
    violation: "No emergency controls during system issues"
  }
} as const;

// Helper functions for law enforcement
export function validateAlertCompliance(alert: any, userSettings: any): boolean {
  // Implementation of laws 2, 5 validation
  return true; // Placeholder
}

export function checkPerformanceCompliance(operation: string): boolean {
  // Implementation of law 3 validation  
  return true; // Placeholder
}
