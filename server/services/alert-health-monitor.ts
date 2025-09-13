/**
 * Alert Health Monitor Service
 * Provides bulletproof health monitoring for the alert generation system
 * with auto-recovery, metrics tracking, and health status reporting
 */

import { AlertGenerator } from './alert-generator';

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

export class AlertHealthMonitor {
  private static instance: AlertHealthMonitor | null = null;
  
  private metrics: HealthMetrics = {
    status: 'healthy',
    lastCheckTime: null,
    lastAlertGeneratedTime: null,
    lastSuccessfulPoll: null,
    lastError: null,
    checksPerformed: 0,
    alertsGenerated: 0,
    consecutiveFailures: 0,
    uptimeSeconds: 0,
    isAutoRecovering: false,
    recoveryAttempts: 0,
    pollingIntervalMs: 30000,
    memoryUsageMB: 0,
    engineFailures: new Map(),
    cylinderFailures: new Map(),
    fallbackPollingActive: new Set()
  };

  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private alertGenerator: AlertGenerator | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date;
  
  // Configuration thresholds
  private readonly MAX_TIME_WITHOUT_CHECK = 45000; // 45 seconds (1.5x polling interval)
  private readonly MAX_TIME_WITHOUT_ALERT = 600000; // 10 minutes
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 10000; // Check every 10 seconds
  private readonly AUTO_RECOVERY_DELAY = 5000; // Wait 5 seconds before recovery attempt

  private constructor() {
    this.startTime = new Date();
    this.lastHeartbeat = new Date();
    this.startHealthMonitoring();
  }

  static getInstance(): AlertHealthMonitor {
    if (!AlertHealthMonitor.instance) {
      AlertHealthMonitor.instance = new AlertHealthMonitor();
    }
    return AlertHealthMonitor.instance;
  }

  /**
   * Initialize monitoring with an alert generator instance
   */
  public initialize(alertGenerator: AlertGenerator, monitoringInterval?: NodeJS.Timeout): void {
    this.alertGenerator = alertGenerator;
    this.monitoringInterval = monitoringInterval || null;
    this.metrics.lastCheckTime = new Date();
    console.log('🏥 Alert Health Monitor initialized');
  }

  /**
   * Record a successful alert check
   */
  public recordCheck(): void {
    this.metrics.lastCheckTime = new Date();
    this.metrics.checksPerformed++;
    this.metrics.consecutiveFailures = 0;
    this.lastHeartbeat = new Date();
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  /**
   * Record a successful poll (data fetched from APIs)
   */
  public recordSuccessfulPoll(): void {
    this.metrics.lastSuccessfulPoll = new Date();
    this.recordCheck();
  }

  /**
   * Record when an alert is generated
   */
  public recordAlertGenerated(count: number = 1): void {
    this.metrics.lastAlertGeneratedTime = new Date();
    this.metrics.alertsGenerated += count;
    console.log(`📊 Health Monitor: ${count} alert(s) generated. Total: ${this.metrics.alertsGenerated}`);
  }

  /**
   * Record an error during alert checking
   */
  public recordError(error: Error): void {
    this.metrics.lastError = {
      message: error.message,
      timestamp: new Date()
    };
    this.metrics.consecutiveFailures++;
    console.error(`⚠️ Health Monitor: Error recorded (${this.metrics.consecutiveFailures} consecutive failures):`, error.message);
    
    // Trigger auto-recovery if needed
    if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.triggerAutoRecovery();
    }
  }

  /**
   * Start the internal health monitoring loop
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    console.log('🏥 Health monitoring started (checking every 10s)');
  }

  /**
   * Perform a comprehensive health check
   */
  private performHealthCheck(): void {
    const now = new Date();
    
    // Update uptime
    this.metrics.uptimeSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    // Check if monitoring is stalled
    const timeSinceLastCheck = this.metrics.lastCheckTime 
      ? now.getTime() - this.metrics.lastCheckTime.getTime()
      : Number.MAX_SAFE_INTEGER;

    // Check if alerts are being generated
    const timeSinceLastAlert = this.metrics.lastAlertGeneratedTime
      ? now.getTime() - this.metrics.lastAlertGeneratedTime.getTime()
      : Number.MAX_SAFE_INTEGER;

    // Check engine failures
    let activeEngineFailures = 0;
    this.metrics.engineFailures.forEach(failure => {
      if (!failure.recovered) {
        activeEngineFailures++;
      }
    });
    
    // Check cylinder failures
    const recentCylinderFailures = Array.from(this.metrics.cylinderFailures.values())
      .filter(f => now.getTime() - f.lastFailure.getTime() < 300000) // Last 5 minutes
      .length;
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';
    const warnings: string[] = [];
    
    // Add engine/cylinder failure warnings
    if (activeEngineFailures > 0) {
      warnings.push(`${activeEngineFailures} engine failures`);
      if (activeEngineFailures >= 3) {
        status = 'critical';
      } else {
        status = 'degraded';
      }
    }
    
    if (recentCylinderFailures > 0) {
      warnings.push(`${recentCylinderFailures} cylinder failures`);
      if (status === 'healthy') {
        status = 'degraded';
      }
    }

    // Critical: No checks in last 45 seconds
    if (timeSinceLastCheck > this.MAX_TIME_WITHOUT_CHECK) {
      status = 'critical';
      const seconds = Math.floor(timeSinceLastCheck / 1000);
      warnings.push(`No health checks for ${seconds}s`);
      console.error(`🚨 CRITICAL: Alert monitoring appears to have stopped! Last check was ${seconds}s ago`);
      
      // Trigger immediate recovery
      if (!this.metrics.isAutoRecovering) {
        this.triggerAutoRecovery();
      }
    }
    // Unhealthy: Multiple consecutive failures
    else if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      status = 'unhealthy';
      warnings.push(`${this.metrics.consecutiveFailures} consecutive failures`);
    }
    // Degraded: No alerts in 10 minutes (but still checking)
    else if (timeSinceLastAlert > this.MAX_TIME_WITHOUT_ALERT && this.metrics.checksPerformed > 0) {
      status = 'degraded';
      const minutes = Math.floor(timeSinceLastAlert / 60000);
      warnings.push(`No alerts generated for ${minutes} minutes`);
      
      // Log warning every minute after 10 minutes
      if (timeSinceLastAlert % 60000 < this.HEALTH_CHECK_INTERVAL) {
        console.warn(`⚠️ WARNING: No alerts generated in last ${minutes} minutes. System may be working but no alert conditions met.`);
      }
    }
    // Degraded: Recent errors
    else if (this.metrics.lastError && 
             (now.getTime() - this.metrics.lastError.timestamp.getTime()) < 60000) {
      status = 'degraded';
      warnings.push('Recent errors detected');
    }

    // Update status
    this.metrics.status = status;

    // Log status changes
    if (status !== 'healthy' && warnings.length > 0) {
      console.log(`🏥 Health Status: ${status.toUpperCase()} - ${warnings.join(', ')}`);
    }

    // Check memory usage
    if (this.metrics.memoryUsageMB > 512) {
      console.warn(`⚠️ High memory usage detected: ${this.metrics.memoryUsageMB}MB`);
    }
  }

  /**
   * Trigger auto-recovery mechanism
   */
  private async triggerAutoRecovery(): Promise<void> {
    if (this.metrics.isAutoRecovering) {
      console.log('🔄 Auto-recovery already in progress...');
      return;
    }

    this.metrics.isAutoRecovering = true;
    this.metrics.recoveryAttempts++;
    
    console.log(`🚑 INITIATING AUTO-RECOVERY (Attempt #${this.metrics.recoveryAttempts})`);

    try {
      // Step 1: Clear existing monitoring interval
      if (this.monitoringInterval) {
        console.log('🔧 Clearing existing monitoring interval...');
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Step 2: Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, this.AUTO_RECOVERY_DELAY));

      // Step 3: Create new alert generator if needed
      if (!this.alertGenerator) {
        console.log('🔧 Creating new AlertGenerator instance...');
        this.alertGenerator = new AlertGenerator();
      }

      // Step 4: Restart monitoring
      console.log('🔧 Restarting alert monitoring...');
      const newInterval = setInterval(async () => {
        try {
          this.recordCheck();
          console.log('⚡ Auto-recovered monitoring: Checking for live game alerts...');
          await this.alertGenerator!.generateLiveGameAlerts();
          this.recordSuccessfulPoll();
        } catch (error: any) {
          console.error('⚠️ Error in recovered monitoring:', error.message);
          this.recordError(error);
        }
      }, this.metrics.pollingIntervalMs);

      this.monitoringInterval = newInterval;
      
      // Store globally for cleanup
      (global as any).setMonitoringInterval(newInterval);

      // Step 5: Test the recovery
      await this.alertGenerator.generateLiveGameAlerts();
      
      // Success!
      this.metrics.consecutiveFailures = 0;
      this.metrics.status = 'healthy';
      this.recordSuccessfulPoll();
      
      console.log('✅ AUTO-RECOVERY SUCCESSFUL! Alert monitoring restored.');
      
    } catch (error: any) {
      console.error('❌ Auto-recovery failed:', error.message);
      this.recordError(error);
      
      // Try again after a longer delay
      setTimeout(() => {
        this.metrics.isAutoRecovering = false;
        if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.triggerAutoRecovery();
        }
      }, 30000); // Wait 30 seconds before next attempt
    } finally {
      this.metrics.isAutoRecovering = false;
    }
  }

  /**
   * Record a sport engine failure
   */
  public recordEngineFailure(sport: string): void {
    const failure = this.metrics.engineFailures.get(sport) || { count: 0, lastFailure: new Date(), recovered: false };
    failure.count++;
    failure.lastFailure = new Date();
    failure.recovered = false;
    this.metrics.engineFailures.set(sport, failure);
    console.log(`📊 Health Monitor: ${sport} engine failure #${failure.count} recorded`);
  }
  
  /**
   * Record a sport engine recovery
   */
  public recordEngineRecovery(sport: string): void {
    const failure = this.metrics.engineFailures.get(sport);
    if (failure) {
      failure.recovered = true;
      console.log(`📊 Health Monitor: ${sport} engine recovered after ${failure.count} failures`);
    }
  }
  
  /**
   * Record an alert cylinder failure
   */
  public recordCylinderFailure(cylinderName: string): void {
    const failure = this.metrics.cylinderFailures.get(cylinderName) || { count: 0, lastFailure: new Date() };
    failure.count++;
    failure.lastFailure = new Date();
    this.metrics.cylinderFailures.set(cylinderName, failure);
    console.log(`📊 Health Monitor: Alert cylinder ${cylinderName} failure #${failure.count} recorded`);
  }
  
  /**
   * Record fallback polling activation
   */
  public recordFallbackPolling(sport: string, active: boolean): void {
    if (active) {
      this.metrics.fallbackPollingActive.add(sport);
      console.log(`📊 Health Monitor: Fallback polling activated for ${sport}`);
    } else {
      this.metrics.fallbackPollingActive.delete(sport);
      console.log(`📊 Health Monitor: Fallback polling deactivated for ${sport}`);
    }
  }

  /**
   * Get current health status and metrics
   */
  public getHealthStatus(): HealthMetrics & { 
    summary: string; 
    recommendations: string[];
    timeSinceLastCheck: string;
    timeSinceLastAlert: string;
  } {
    const now = new Date();
    
    const timeSinceLastCheck = this.metrics.lastCheckTime
      ? Math.floor((now.getTime() - this.metrics.lastCheckTime.getTime()) / 1000)
      : -1;
      
    const timeSinceLastAlert = this.metrics.lastAlertGeneratedTime
      ? Math.floor((now.getTime() - this.metrics.lastAlertGeneratedTime.getTime()) / 1000)
      : -1;

    const recommendations: string[] = [];
    
    if (this.metrics.status === 'critical') {
      recommendations.push('URGENT: Alert monitoring has stopped. Auto-recovery initiated.');
    }
    if (this.metrics.status === 'unhealthy') {
      recommendations.push('Multiple failures detected. Check logs for errors.');
    }
    if (timeSinceLastAlert > 600) {
      recommendations.push('No alerts in 10+ minutes. Verify game schedules and alert conditions.');
    }
    if (this.metrics.memoryUsageMB > 512) {
      recommendations.push(`High memory usage (${this.metrics.memoryUsageMB}MB). Consider restarting.`);
    }

    const summary = this.metrics.status === 'healthy'
      ? `✅ System healthy. ${this.metrics.checksPerformed} checks, ${this.metrics.alertsGenerated} alerts generated.`
      : `⚠️ System ${this.metrics.status}. ${recommendations.join(' ')}`;

    return {
      ...this.metrics,
      summary,
      recommendations,
      timeSinceLastCheck: timeSinceLastCheck >= 0 ? `${timeSinceLastCheck}s ago` : 'Never',
      timeSinceLastAlert: timeSinceLastAlert >= 0 ? `${timeSinceLastAlert}s ago` : 'Never'
    };
  }

  /**
   * Force a manual recovery attempt
   */
  public async forceRecovery(): Promise<void> {
    console.log('🔧 Manual recovery requested...');
    await this.triggerAutoRecovery();
  }

  /**
   * Cleanup and shutdown
   */
  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 Health monitor shutdown complete');
  }
}

// Export singleton instance getter
export const getHealthMonitor = () => AlertHealthMonitor.getInstance();