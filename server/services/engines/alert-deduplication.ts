// Enhanced Alert Deduplication System
// Brings back V1's rich contextual scope and realert functionality

export interface DeduplicationScope {
  level: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game';
  timeWindow: number; // milliseconds
  maxAlerts: number;
  realertAfterMs?: number; // Allow re-alerting after this time
}

export interface DeduplicationRule {
  alertType: string;
  scope: DeduplicationScope;
  contextFactors: string[];
}

export interface MLBGameState {
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  currentBatter?: {
    id: number;
  };
  currentPitcher?: {
    id: number;
  };
  paId?: string; // plate appearance ID if available
}

// V1-style buildDedupKey function (Patch B)
export function buildDedupKey(type: string, g: MLBGameState): string {
  const bases = (g.runners.first?'1':'0')+(g.runners.second?'1':'0')+(g.runners.third?'1':'0');
  return [
    g.gamePk, type, g.inning, g.inningState, g.outs, bases, g.currentBatter?.id ?? '-', g.paId ?? '-'
  ].join(':');
}

const DEDUP_RULES: DeduplicationRule[] = [
  {
    alertType: 'Runners in Scoring Position',
    scope: { level: 'half-inning', timeWindow: 60000, maxAlerts: 2, realertAfterMs: 180000 },
    contextFactors: ['basesHash', 'outs', 'batterId', 'inning', 'isTop']
  },
  {
    alertType: 'Bases Loaded',
    scope: { level: 'half-inning', timeWindow: 90000, maxAlerts: 1, realertAfterMs: 300000 },
    contextFactors: ['basesHash', 'outs', 'batterId', 'inning', 'isTop']
  },
  {
    alertType: 'Runners on Base',
    scope: { level: 'half-inning', timeWindow: 45000, maxAlerts: 3, realertAfterMs: 120000 },
    contextFactors: ['basesHash', 'outs', 'batterId', 'inning', 'isTop']
  },
  {
    alertType: 'Close Game Alert',
    scope: { level: 'full-inning', timeWindow: 180000, maxAlerts: 2, realertAfterMs: 600000 },
    contextFactors: ['inning', 'outs', 'basesHash']
  },
  {
    alertType: 'Late Inning Alert',
    scope: { level: 'full-inning', timeWindow: 120000, maxAlerts: 2, realertAfterMs: 300000 },
    contextFactors: ['inning', 'outs', 'basesHash']
  },
  {
    alertType: 'Extra Innings',
    scope: { level: 'game', timeWindow: 300000, maxAlerts: 1, realertAfterMs: 1800000 },
    contextFactors: ['inning']
  },
  {
    alertType: 'Hybrid RE24+AI',
    scope: { level: 'plate-appearance', timeWindow: 15000, maxAlerts: 1 },
    contextFactors: ['batterId', 'pitcherId', 'paId', 'inning', 'isTop', 'outs']
  },
  // Player Performance Alerts
  {
    alertType: 'POWER_HITTER_AT_BAT',
    scope: { level: 'plate-appearance', timeWindow: 30000, maxAlerts: 1, realertAfterMs: 120000 },
    contextFactors: ['batterId', 'paId', 'inning', 'isTop']
  },
  {
    alertType: 'Power Hitter On Deck',
    scope: { level: 'plate-appearance', timeWindow: 60000, maxAlerts: 1, realertAfterMs: 180000 },
    contextFactors: ['batterId', 'inning', 'isTop']
  },
  {
    alertType: 'Star Batter Alert',
    scope: { level: 'plate-appearance', timeWindow: 30000, maxAlerts: 1, realertAfterMs: 90000 },
    contextFactors: ['batterId', 'paId', 'inning', 'isTop']
  },
  {
    alertType: 'Elite Clutch Hitter',
    scope: { level: 'plate-appearance', timeWindow: 45000, maxAlerts: 1, realertAfterMs: 150000 },
    contextFactors: ['batterId', 'paId', 'inning', 'isTop', 'basesHash']
  },
  {
    alertType: 'Strikeout',
    scope: { level: 'plate-appearance', timeWindow: 5000, maxAlerts: 1 },
    contextFactors: ['batterId', 'pitcherId', 'paId']
  },
  {
    alertType: 'Home Run',
    scope: { level: 'game', timeWindow: 10000, maxAlerts: 1 },
    contextFactors: ['batterId', 'inning']
  },
  {
    alertType: 'Scoring Play',
    scope: { level: 'half-inning', timeWindow: 30000, maxAlerts: 3, realertAfterMs: 60000 },
    contextFactors: ['inning', 'isTop', 'outs']
  }
];

export class AlertDeduplicator {
  private alertHistory = new Map<string, { timestamp: number; count: number }>();
  private realertTracker = new Map<string, number>(); // Track when realerts are allowed

  constructor() {
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Build a stable deduplication key incorporating all relevant context
   */
  buildDedupKey(alertType: string, gameState: MLBGameState): string {
    const rule = DEDUP_RULES.find(r => r.alertType === alertType);
    if (!rule) {
      // Fallback to basic key for unknown alert types
      return `${gameState.gamePk}:${alertType}:${gameState.inning}:${gameState.inningState}`;
    }

    const parts = [`${gameState.gamePk}`, alertType];
    const basesHash = (gameState.runners.first ? '1' : '0') + 
                      (gameState.runners.second ? '1' : '0') + 
                      (gameState.runners.third ? '1' : '0');

    // Build key based on context factors
    for (const factor of rule.contextFactors) {
      switch (factor) {
        case 'inning':
          parts.push(gameState.inning.toString());
          break;
        case 'isTop':
          parts.push(gameState.inningState);
          break;
        case 'outs':
          parts.push(gameState.outs.toString());
          break;
        case 'basesHash':
          parts.push(basesHash);
          break;
        case 'batterId':
          parts.push((gameState.currentBatter?.id ?? '-').toString());
          break;
        case 'pitcherId':
          parts.push((gameState.currentPitcher?.id ?? '-').toString());
          break;
        case 'paId':
          parts.push(gameState.paId ?? '-');
          break;
      }
    }

    return parts.join(':');
  }

  /**
   * Check if alert should be allowed based on deduplication rules
   */
  shouldTriggerAlert(alertType: string, gameState: MLBGameState): boolean {
    const rule = DEDUP_RULES.find(r => r.alertType === alertType);
    if (!rule) {
      console.log(`⚠️ No dedup rule found for '${alertType}', allowing alert`);
      return true;
    }

    const dedupKey = this.buildDedupKey(alertType, gameState);
    const now = Date.now();
    
    // Check main deduplication
    const history = this.alertHistory.get(dedupKey);
    if (history) {
      const timeSinceLastAlert = now - history.timestamp;
      
      // Check if within time window
      if (timeSinceLastAlert < rule.scope.timeWindow) {
        if (history.count >= rule.scope.maxAlerts) {
          console.log(`🚫 DEDUP: '${alertType}' blocked - ${history.count}/${rule.scope.maxAlerts} alerts sent in ${timeSinceLastAlert}ms window`);
          return false;
        }
      }
      
      // Check realert functionality
      if (rule.scope.realertAfterMs && timeSinceLastAlert >= rule.scope.realertAfterMs) {
        // Reset the counter for realert
        console.log(`🔄 REALERT: '${alertType}' reset after ${timeSinceLastAlert}ms (realert threshold: ${rule.scope.realertAfterMs}ms)`);
        this.alertHistory.delete(dedupKey);
        this.realertTracker.set(dedupKey, now);
      }
    }

    // Update or create history entry
    const currentHistory = this.alertHistory.get(dedupKey);
    if (currentHistory && (now - currentHistory.timestamp) < rule.scope.timeWindow) {
      // Increment count within same window
      this.alertHistory.set(dedupKey, {
        timestamp: currentHistory.timestamp,
        count: currentHistory.count + 1
      });
    } else {
      // New window or first alert
      this.alertHistory.set(dedupKey, {
        timestamp: now,
        count: 1
      });
    }

    console.log(`✅ ENHANCED DEDUP: '${alertType}' allowed (key: ${dedupKey})`);
    return true;
  }

  /**
   * Get debug information for an alert type and game state
   */
  getDebugInfo(alertType: string, gameState: MLBGameState): any {
    const rule = DEDUP_RULES.find(r => r.alertType === alertType);
    const dedupKey = this.buildDedupKey(alertType, gameState);
    const history = this.alertHistory.get(dedupKey);
    
    return {
      alertType,
      dedupKey,
      rule,
      history,
      realertAllowed: rule?.scope.realertAfterMs ? 
        this.realertTracker.get(dedupKey) : null
    };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const maxRetention = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleaned = 0;
    // Use Array.from for compatibility
    for (const [key, history] of Array.from(this.alertHistory.entries())) {
      if (now - history.timestamp > maxRetention) {
        this.alertHistory.delete(key);
        cleaned++;
      }
    }
    
    // Clean realert tracker too
    for (const [key, timestamp] of Array.from(this.realertTracker.entries())) {
      if (now - timestamp > maxRetention) {
        this.realertTracker.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old dedup entries`);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): any {
    return {
      activeEntries: this.alertHistory.size,
      realertTrackerSize: this.realertTracker.size,
      rules: DEDUP_RULES.length
    };
  }
}

// Export singleton instance
export const alertDeduplicator = new AlertDeduplicator();