/**
 * Million Dollar Alert Deduplication Engine
 * 
 * Prevents duplicate alerts with intelligent content-based IDs and configurable timeframes.
 * This engine sits between all sport engines and the alert storage/broadcasting system.
 */

import crypto from 'crypto';

interface AlertFingerprint {
  id: string;
  timestamp: number;
  priority: number;
  alertType: string;
  gameId: string;
  sport: string;
  contentHash: string;
}

interface DeduplicationRule {
  alertType: string;
  cooldownSeconds: number;
  realertAfterSeconds?: number; // Allow re-alerting after longer period
  scope: 'game' | 'team' | 'global'; // Scope of deduplication
}

export class AlertDeduplicationEngine {
  private alertHistory: Map<string, AlertFingerprint> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  // Default deduplication rules - configurable per alert type
  private deduplicationRules: Map<string, DeduplicationRule> = new Map([
    // NCAAF Rules
    ['ncaafGameLive', { alertType: 'ncaafGameLive', cooldownSeconds: 300, scope: 'game' }], // 5 min cooldown
    ['ncaafRedZone', { alertType: 'ncaafRedZone', cooldownSeconds: 120, realertAfterSeconds: 600, scope: 'game' }],
    ['ncaafCloseGame', { alertType: 'ncaafCloseGame', cooldownSeconds: 180, realertAfterSeconds: 900, scope: 'game' }],
    ['ncaafFourthDown', { alertType: 'ncaafFourthDown', cooldownSeconds: 60, scope: 'game' }],
    ['ncaafOvertime', { alertType: 'ncaafOvertime', cooldownSeconds: 60, scope: 'game' }],
    ['ncaafGoalLineStand', { alertType: 'ncaafGoalLineStand', cooldownSeconds: 90, scope: 'game' }],
    ['ncaafBigPlayPotential', { alertType: 'ncaafBigPlayPotential', cooldownSeconds: 120, scope: 'game' }],
    ['ncaafTwoMinuteWarning', { alertType: 'ncaafTwoMinuteWarning', cooldownSeconds: 180, scope: 'game' }],
    
    // MLB Rules  
    ['mlbGameLive', { alertType: 'mlbGameLive', cooldownSeconds: 300, scope: 'game' }],
    ['mlbHomeRun', { alertType: 'mlbHomeRun', cooldownSeconds: 30, scope: 'game' }],
    ['mlbBaseHit', { alertType: 'mlbBaseHit', cooldownSeconds: 45, scope: 'game' }],
    ['mlbScoringPlay', { alertType: 'mlbScoringPlay', cooldownSeconds: 60, scope: 'game' }],
    ['mlbRISP', { alertType: 'mlbRISP', cooldownSeconds: 60, realertAfterSeconds: 180, scope: 'game' }],
    ['mlbBasesLoaded', { alertType: 'mlbBasesLoaded', cooldownSeconds: 90, realertAfterSeconds: 300, scope: 'game' }],
    ['mlbCloseGame', { alertType: 'mlbCloseGame', cooldownSeconds: 180, realertAfterSeconds: 600, scope: 'game' }],
    
    // Generic fallback
    ['default', { alertType: 'default', cooldownSeconds: 60, scope: 'game' }]
  ]);

  constructor() {
    // Clean up old alerts every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 300000);
    
    console.log('🛡️ Alert Deduplication Engine initialized - preventing duplicate alerts');
  }

  /**
   * Main method: Check if alert should be sent and generate unique ID
   */
  public shouldSendAlert(alert: any): { shouldSend: boolean; uniqueId?: string; reason?: string } {
    try {
      // Generate unique content-based ID
      const uniqueId = this.generateUniqueAlertId(alert);
      
      // Get deduplication rule for this alert type
      const rule = this.getDeduplicationRule(alert.type);
      
      // Create deduplication key based on scope
      const deduplicationKey = this.createDeduplicationKey(alert, rule.scope);
      
      // Check if this exact alert was recently sent
      const existingAlert = this.alertHistory.get(deduplicationKey);
      
      if (existingAlert) {
        const timeSinceLastAlert = (Date.now() - existingAlert.timestamp) / 1000;
        
        // Check if we're still in cooldown period
        if (timeSinceLastAlert < rule.cooldownSeconds) {
          return {
            shouldSend: false,
            reason: `Duplicate alert blocked - ${rule.cooldownSeconds - Math.floor(timeSinceLastAlert)}s remaining in cooldown`
          };
        }
        
        // Check if content is identical (prevents exact duplicates)
        if (existingAlert.contentHash === this.generateContentHash(alert)) {
          // If we have a realert rule and enough time has passed, allow it
          if (rule.realertAfterSeconds && timeSinceLastAlert >= rule.realertAfterSeconds) {
            console.log(`🔄 Re-alerting after ${timeSinceLastAlert}s for ${alert.type}`);
          } else {
            return {
              shouldSend: false,
              reason: `Identical content blocked - same alert content recently sent`
            };
          }
        }
      }
      
      // Alert is unique and should be sent - record it
      this.recordAlert(deduplicationKey, alert, uniqueId);
      
      return {
        shouldSend: true,
        uniqueId: uniqueId
      };
      
    } catch (error) {
      console.error('❌ Alert Deduplication Engine error:', error);
      // If deduplication fails, err on the side of sending the alert
      return {
        shouldSend: true,
        uniqueId: this.generateFallbackId(alert)
      };
    }
  }

  /**
   * Generate unique alert ID based on content and context
   */
  private generateUniqueAlertId(alert: any): string {
    const components = [
      alert.sport || 'unknown',
      alert.type || 'unknown',
      alert.gameInfo?.gameId || 'no-game',
      alert.gameInfo?.quarter || alert.gameInfo?.inning || 'no-period',
      alert.gameInfo?.situation || 'no-situation',
      Date.now().toString().slice(-6) // Last 6 digits of timestamp for uniqueness
    ];
    
    return components.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Generate content hash for duplicate detection
   */
  private generateContentHash(alert: any): string {
    const contentString = JSON.stringify({
      type: alert.type,
      sport: alert.sport,
      gameId: alert.gameInfo?.gameId,
      situation: alert.gameInfo?.situation,
      quarter: alert.gameInfo?.quarter,
      inning: alert.gameInfo?.inning,
      score: alert.gameInfo?.score
    });
    
    return crypto.createHash('md5').update(contentString).digest('hex');
  }

  /**
   * Create deduplication key based on scope
   */
  private createDeduplicationKey(alert: any, scope: string): string {
    switch (scope) {
      case 'game':
        return `${alert.sport}-${alert.type}-${alert.gameInfo?.gameId}`;
      case 'team':
        return `${alert.sport}-${alert.type}-${alert.gameInfo?.homeTeam}-${alert.gameInfo?.awayTeam}`;
      case 'global':
        return `${alert.sport}-${alert.type}`;
      default:
        return `${alert.sport}-${alert.type}-${alert.gameInfo?.gameId}`;
    }
  }

  /**
   * Get deduplication rule for alert type
   */
  private getDeduplicationRule(alertType: string): DeduplicationRule {
    return this.deduplicationRules.get(alertType) || this.deduplicationRules.get('default')!;
  }

  /**
   * Record alert in history
   */
  private recordAlert(key: string, alert: any, uniqueId: string): void {
    const fingerprint: AlertFingerprint = {
      id: uniqueId,
      timestamp: Date.now(),
      priority: alert.priority || 50,
      alertType: alert.type,
      gameId: alert.gameInfo?.gameId || 'unknown',
      sport: alert.sport || 'unknown',
      contentHash: this.generateContentHash(alert)
    };
    
    this.alertHistory.set(key, fingerprint);
    
    console.log(`🛡️ Alert recorded: ${key} (${this.alertHistory.size} total tracked)`);
  }

  /**
   * Clean up old alerts from memory
   */
  private cleanupOldAlerts(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoffTime = Date.now() - maxAge;
    let cleaned = 0;
    
    for (const [key, fingerprint] of this.alertHistory.entries()) {
      if (fingerprint.timestamp < cutoffTime) {
        this.alertHistory.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old alerts from deduplication cache`);
    }
  }

  /**
   * Generate fallback ID if main system fails
   */
  private generateFallbackId(alert: any): string {
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add or update deduplication rule
   */
  public setDeduplicationRule(alertType: string, rule: DeduplicationRule): void {
    this.deduplicationRules.set(alertType, rule);
    console.log(`🛡️ Updated deduplication rule for ${alertType}`);
  }

  /**
   * Get current alert statistics
   */
  public getStats(): { totalTracked: number; ruleCount: number; oldestAlert: number } {
    let oldestTimestamp = Date.now();
    
    for (const fingerprint of this.alertHistory.values()) {
      if (fingerprint.timestamp < oldestTimestamp) {
        oldestTimestamp = fingerprint.timestamp;
      }
    }
    
    return {
      totalTracked: this.alertHistory.size,
      ruleCount: this.deduplicationRules.size,
      oldestAlert: oldestTimestamp
    };
  }

  /**
   * Force clear all tracking (for testing)
   */
  public clearAll(): void {
    this.alertHistory.clear();
    console.log('🛡️ Alert deduplication cache cleared');
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.alertHistory.clear();
    console.log('🛡️ Alert Deduplication Engine shutdown');
  }
}

// Export singleton instance
export const alertDeduplicationEngine = new AlertDeduplicationEngine();