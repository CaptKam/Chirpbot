/**
 * Alert Health Monitor Service - Legacy Compatibility Shim
 * This file now re-exports from the unified health monitoring system
 * for backward compatibility with existing code.
 */

import { 
  getHealthMonitor as getUnifiedHealthMonitor,
  UnifiedHealthMonitor,
  type HealthStatus,
  type HealthMetrics as UnifiedHealthMetrics
} from './unified-health-monitor';
import { AlertGenerator } from './alert-generator';

// Legacy interface for backward compatibility
interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  lastCheckTime: Date | null;
  lastAlertGeneratedTime: Date | null;
  lastSuccessfulPoll: Date | null;
  lastError: { message: string; timestamp: Date } | null;
  checksPerformed: number;
  alertsGenerated: number;
  consecutiveFailures: number;
  uptimeSeconds: number;
  isAutoRecovering: boolean;
  recoveryAttempts: number;
  pollingIntervalMs: number;
  memoryUsageMB: number;
  engineFailures: Map<string, { count: number; lastFailure: Date; recovered: boolean }>;
  cylinderFailures: Map<string, { count: number; lastFailure: Date }>;
  fallbackPollingActive: Set<string>;
}

/**
 * Legacy AlertHealthMonitor class - delegates to UnifiedHealthMonitor
 * @deprecated Use getHealthMonitor() from unified-health-monitor.ts instead
 */
export class AlertHealthMonitor {
  private static instance: AlertHealthMonitor | null = null;
  private unifiedMonitor: UnifiedHealthMonitor;
  
  private constructor() {
    this.unifiedMonitor = getUnifiedHealthMonitor();
    console.log('🔄 Legacy AlertHealthMonitor shim initialized - redirecting to unified health monitor');
  }

  static getInstance(): AlertHealthMonitor {
    if (!AlertHealthMonitor.instance) {
      AlertHealthMonitor.instance = new AlertHealthMonitor();
    }
    return AlertHealthMonitor.instance;
  }

  /**
   * Initialize monitoring with an alert generator instance
   * @deprecated Delegates to unified health monitor
   */
  public initialize(alertGenerator: AlertGenerator, monitoringInterval?: NodeJS.Timeout): void {
    // Legacy compatibility - just initialize the unified monitor
    this.unifiedMonitor.initialize({ 
      pollingIntervalMs: 30000,
      callbacks: {
        generatorLabel: 'legacy-alert-generator'
      }
    });
    console.log('🔄 Legacy AlertHealthMonitor initialized - using unified health monitor');
  }

  /**
   * Record a successful alert check
   * @deprecated Delegates to unified health monitor
   */
  public recordCheck(): void {
    this.unifiedMonitor.recordCheck();
  }

  /**
   * Record a successful poll (data fetched from APIs)
   * @deprecated Delegates to unified health monitor
   */
  public recordSuccessfulPoll(): void {
    this.unifiedMonitor.recordSuccessfulPoll();
  }

  /**
   * Record when an alert is generated
   * @deprecated Delegates to unified health monitor
   */
  public recordAlertGenerated(count: number = 1): void {
    this.unifiedMonitor.recordAlertGenerated(count);
  }

  /**
   * Record an error during alert checking
   * @deprecated Delegates to unified health monitor
   */
  public recordError(error: Error): void {
    this.unifiedMonitor.recordError(error);
  }

  /**
   * Record a sport engine failure
   * @deprecated Delegates to unified health monitor
   */
  public recordEngineFailure(sport: string): void {
    this.unifiedMonitor.reportEngineFailure(sport);
  }
  
  /**
   * Record a sport engine recovery
   * @deprecated Delegates to unified health monitor
   */
  public recordEngineRecovery(sport: string): void {
    this.unifiedMonitor.markEngineRecovered(sport);
  }
  
  /**
   * Record an alert cylinder failure
   * @deprecated Delegates to unified health monitor
   */
  public recordCylinderFailure(cylinderName: string): void {
    this.unifiedMonitor.reportCylinderFailure(cylinderName);
  }
  
  /**
   * Record fallback polling activation
   * @deprecated Delegates to unified health monitor
   */
  public recordFallbackPolling(sport: string, active: boolean): void {
    this.unifiedMonitor.setFallbackPolling(sport, active);
  }

  /**
   * Get current health status and metrics
   * @deprecated Delegates to unified health monitor with legacy format conversion
   */
  public getHealthStatus(): HealthMetrics & { 
    summary: string; 
    recommendations: string[];
    timeSinceLastCheck: string;
    timeSinceLastAlert: string;
  } {
    const unifiedStatus = this.unifiedMonitor.getHealthStatus();
    const publicMetrics = this.unifiedMonitor.getPublicMetrics();
    
    // Convert unified metrics to legacy format
    const legacyMetrics: HealthMetrics = {
      status: publicMetrics.status,
      lastCheckTime: publicMetrics.lastCheckTime ? new Date(publicMetrics.lastCheckTime) : null,
      lastAlertGeneratedTime: publicMetrics.lastAlertGeneratedTime ? new Date(publicMetrics.lastAlertGeneratedTime) : null,
      lastSuccessfulPoll: publicMetrics.lastSuccessfulPoll ? new Date(publicMetrics.lastSuccessfulPoll) : null,
      lastError: publicMetrics.lastError ? {
        message: publicMetrics.lastError.message,
        timestamp: new Date(publicMetrics.lastError.timestamp)
      } : null,
      checksPerformed: publicMetrics.checksPerformed,
      alertsGenerated: publicMetrics.alertsGenerated,
      consecutiveFailures: publicMetrics.consecutiveFailures,
      uptimeSeconds: publicMetrics.uptimeSeconds,
      isAutoRecovering: publicMetrics.isAutoRecovering,
      recoveryAttempts: publicMetrics.recoveryAttempts,
      pollingIntervalMs: publicMetrics.pollingIntervalMs,
      memoryUsageMB: publicMetrics.memoryUsageMB,
      engineFailures: new Map(publicMetrics.engineFailures.map(f => [f.sport, { count: f.failureCount, lastFailure: f.lastFailureTime, recovered: f.recovered }])),
      cylinderFailures: new Map(publicMetrics.cylinderFailures.map(f => [f.cylinderName, { count: f.failureCount, lastFailure: f.lastFailureTime }])),
      fallbackPollingActive: new Set(publicMetrics.fallbackPollingActive)
    };

    return {
      ...legacyMetrics,
      summary: unifiedStatus.summary,
      recommendations: unifiedStatus.recommendations,
      timeSinceLastCheck: unifiedStatus.timeSinceLastCheck,
      timeSinceLastAlert: unifiedStatus.timeSinceLastAlert
    };
  }

  /**
   * Force a manual recovery attempt
   * @deprecated Delegates to unified health monitor
   */
  public async forceRecovery(): Promise<void> {
    await this.unifiedMonitor.forceRecovery();
  }

  /**
   * Cleanup and shutdown
   * @deprecated Delegates to unified health monitor
   */
  public shutdown(): void {
    this.unifiedMonitor.shutdown();
  }
}

// Export singleton instance getter - delegates to unified system
// @deprecated Use getHealthMonitor() from unified-health-monitor.ts instead
export const getHealthMonitor = () => {
  console.warn('⚠️ DEPRECATED: getHealthMonitor() from alert-health-monitor.ts is deprecated. Use import { getHealthMonitor } from "./unified-health-monitor" instead.');
  return AlertHealthMonitor.getInstance();
};

// Re-export from unified system for convenience
export { getHealthMonitor as getUnifiedHealthMonitor } from './unified-health-monitor';