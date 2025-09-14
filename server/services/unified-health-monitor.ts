/**
 * Unified Health Monitor System
 * Consolidated health monitoring for the alert generation system
 * Single source of truth for system health, memory monitoring, and error tracking
 */

import type { Express } from "express";
import { memoryManager } from "../middleware/memory-manager";

// === UNIFIED TYPES ===

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

export interface EngineFailureRecord {
  sport: string;
  failureCount: number;
  lastFailureTime: Date;
  isInRecovery: boolean;
  nextRetryTime: Date;
  recovered: boolean;
}

export interface CylinderFailureRecord {
  cylinderName: string;
  failureCount: number;
  lastFailureTime: Date;
  totalFailures: number;
}

export interface HealthMetrics {
  status: HealthStatus;
  startTime: Date;
  lastCheckTime: Date | null;
  lastAlertGeneratedTime: Date | null;
  lastSuccessfulPoll: Date | null;
  lastHeartbeat: Date;
  lastError: { message: string; timestamp: Date } | null;
  
  // Counters
  checksPerformed: number;
  alertsGenerated: number;
  consecutiveFailures: number;
  uptimeSeconds: number;
  
  // Recovery state
  isAutoRecovering: boolean;
  recoveryAttempts: number;
  
  // Configuration
  pollingIntervalMs: number;
  
  // Memory integration
  memoryUsageMB: number;
  memoryStatus: 'healthy' | 'warning' | 'critical';
  lastGcTime: Date | null;
  
  // Engine and cylinder failures
  engineFailures: Map<string, EngineFailureRecord>;
  cylinderFailures: Map<string, CylinderFailureRecord>;
  fallbackPollingActive: Set<string>;
}

export interface PublicHealthMetrics {
  status: HealthStatus;
  startTime: string;
  lastCheckTime: string | null;
  lastAlertGeneratedTime: string | null;
  lastSuccessfulPoll: string | null;
  lastHeartbeat: string;
  lastError: { message: string; timestamp: string } | null;
  
  checksPerformed: number;
  alertsGenerated: number;
  consecutiveFailures: number;
  uptimeSeconds: number;
  
  isAutoRecovering: boolean;
  recoveryAttempts: number;
  pollingIntervalMs: number;
  
  memoryUsageMB: number;
  memoryStatus: 'healthy' | 'warning' | 'critical';
  lastGcTime: string | null;
  
  engineFailures: Array<EngineFailureRecord & { sport: string }>;
  cylinderFailures: Array<CylinderFailureRecord>;
  fallbackPollingActive: string[];
}

export interface HealthCallbacks {
  onRestart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  generatorLabel?: string;
}

export interface HealthInitOptions {
  pollingIntervalMs?: number;
  callbacks?: HealthCallbacks;
}

// === UNIFIED HEALTH MONITOR ===

export class UnifiedHealthMonitor {
  private static instance: UnifiedHealthMonitor | null = null;
  
  private metrics: HealthMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private callbacks: HealthCallbacks = {};
  
  // Configuration thresholds
  private readonly MAX_TIME_WITHOUT_CHECK = 45000; // 45 seconds
  private readonly MAX_TIME_WITHOUT_ALERT = 600000; // 10 minutes
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 10000; // Check every 10 seconds
  private readonly AUTO_RECOVERY_DELAY = 5000; // Wait 5 seconds before recovery
  private readonly ENGINE_RECOVERY_DELAY = 30000; // 30 seconds
  private readonly CYLINDER_CLEANUP_AGE = 300000; // 5 minutes

  private constructor() {
    const startTime = new Date();
    
    this.metrics = {
      status: 'healthy',
      startTime,
      lastCheckTime: null,
      lastAlertGeneratedTime: null,
      lastSuccessfulPoll: null,
      lastHeartbeat: startTime,
      lastError: null,
      
      checksPerformed: 0,
      alertsGenerated: 0,
      consecutiveFailures: 0,
      uptimeSeconds: 0,
      
      isAutoRecovering: false,
      recoveryAttempts: 0,
      
      pollingIntervalMs: 30000,
      
      memoryUsageMB: 0,
      memoryStatus: 'healthy',
      lastGcTime: null,
      
      engineFailures: new Map(),
      cylinderFailures: new Map(),
      fallbackPollingActive: new Set()
    };
    
    this.startHealthMonitoring();
  }

  public static getInstance(): UnifiedHealthMonitor {
    if (!UnifiedHealthMonitor.instance) {
      UnifiedHealthMonitor.instance = new UnifiedHealthMonitor();
    }
    return UnifiedHealthMonitor.instance;
  }

  // === CORE INITIALIZATION ===

  public initialize(options: HealthInitOptions = {}): void {
    if (options.pollingIntervalMs) {
      this.metrics.pollingIntervalMs = options.pollingIntervalMs;
    }
    
    if (options.callbacks) {
      this.callbacks = { ...this.callbacks, ...options.callbacks };
    }
    
    this.metrics.lastCheckTime = new Date();
    console.log('🏥 Unified Health Monitor initialized', {
      pollingInterval: this.metrics.pollingIntervalMs,
      callbacks: Object.keys(this.callbacks),
      generatorLabel: this.callbacks.generatorLabel || 'default'
    });
  }

  // === METRICS TRACKING ===

  public recordCheck(): void {
    this.metrics.lastCheckTime = new Date();
    this.metrics.checksPerformed++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastHeartbeat = new Date();
    
    // Update memory usage during checks
    this.updateMemoryMetrics();
  }

  public recordSuccessfulPoll(): void {
    this.metrics.lastSuccessfulPoll = new Date();
    this.recordCheck();
  }

  public recordAlertGenerated(count: number = 1): void {
    this.metrics.lastAlertGeneratedTime = new Date();
    this.metrics.alertsGenerated += count;
    console.log(`📊 Health Monitor: ${count} alert(s) generated. Total: ${this.metrics.alertsGenerated}`);
  }

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

  public heartbeat(): void {
    this.metrics.lastHeartbeat = new Date();
  }

  // === ENGINE FAILURE MANAGEMENT ===

  public reportEngineFailure(sport: string): void {
    const existing = this.metrics.engineFailures.get(sport);
    const now = new Date();
    
    const record: EngineFailureRecord = {
      sport,
      failureCount: (existing?.failureCount || 0) + 1,
      lastFailureTime: now,
      isInRecovery: false,
      nextRetryTime: new Date(now.getTime() + this.ENGINE_RECOVERY_DELAY),
      recovered: false
    };
    
    this.metrics.engineFailures.set(sport, record);
    console.log(`📊 Health Monitor: ${sport} engine failure #${record.failureCount} recorded`);
  }

  public markEngineRecovered(sport: string): void {
    const failure = this.metrics.engineFailures.get(sport);
    if (failure) {
      failure.recovered = true;
      failure.isInRecovery = false;
      console.log(`📊 Health Monitor: ${sport} engine recovered after ${failure.failureCount} failures`);
    }
  }

  // === CYLINDER FAILURE MANAGEMENT ===

  public reportCylinderFailure(cylinderName: string): void {
    const existing = this.metrics.cylinderFailures.get(cylinderName);
    const now = new Date();
    
    const record: CylinderFailureRecord = {
      cylinderName,
      failureCount: (existing?.failureCount || 0) + 1,
      lastFailureTime: now,
      totalFailures: (existing?.totalFailures || 0) + 1
    };
    
    this.metrics.cylinderFailures.set(cylinderName, record);
    console.log(`📊 Health Monitor: Alert cylinder ${cylinderName} failure #${record.failureCount} recorded`);
  }

  public clearCylinderFailuresOlderThan(maxAgeMs: number = this.CYLINDER_CLEANUP_AGE): number {
    const now = new Date();
    let cleared = 0;
    
    for (const [key, failure] of this.metrics.cylinderFailures.entries()) {
      if (now.getTime() - failure.lastFailureTime.getTime() > maxAgeMs) {
        this.metrics.cylinderFailures.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 Health Monitor: Cleared ${cleared} old cylinder failures`);
    }
    
    return cleared;
  }

  // === FALLBACK POLLING MANAGEMENT ===

  public setFallbackPolling(sport: string, active: boolean): void {
    if (active) {
      this.metrics.fallbackPollingActive.add(sport);
      console.log(`📊 Health Monitor: Fallback polling activated for ${sport}`);
    } else {
      this.metrics.fallbackPollingActive.delete(sport);
      console.log(`📊 Health Monitor: Fallback polling deactivated for ${sport}`);
    }
  }

  // === MEMORY INTEGRATION ===

  private updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    const memStats = memoryManager.getStats();
    this.metrics.memoryStatus = memStats.status as 'healthy' | 'warning' | 'critical';
    this.metrics.lastGcTime = memStats.lastGC ? new Date(memStats.lastGC) : null;
    
    // Trigger cleanup if needed and status is critical
    if (this.metrics.memoryStatus === 'critical' && memStats.needsCleanup) {
      console.log('🧹 Health Monitor: Triggering memory cleanup due to critical status');
      memoryManager.cleanup();
    }
  }

  // === STATUS COMPUTATION ===

  public computeStatus(): HealthStatus {
    const now = new Date();
    
    // Update uptime
    this.metrics.uptimeSeconds = Math.floor((now.getTime() - this.metrics.startTime.getTime()) / 1000);
    
    // Time-based checks
    const timeSinceLastCheck = this.metrics.lastCheckTime 
      ? now.getTime() - this.metrics.lastCheckTime.getTime()
      : Number.MAX_SAFE_INTEGER;

    const timeSinceLastAlert = this.metrics.lastAlertGeneratedTime
      ? now.getTime() - this.metrics.lastAlertGeneratedTime.getTime()
      : Number.MAX_SAFE_INTEGER;

    // Count active failures
    let activeEngineFailures = 0;
    this.metrics.engineFailures.forEach(failure => {
      if (!failure.recovered) {
        activeEngineFailures++;
      }
    });
    
    const recentCylinderFailures = Array.from(this.metrics.cylinderFailures.values())
      .filter(f => now.getTime() - f.lastFailureTime.getTime() < this.CYLINDER_CLEANUP_AGE)
      .length;
    
    // Determine status priority order: critical -> unhealthy -> degraded -> healthy
    
    // Critical: No checks in configured time OR critical memory
    if (timeSinceLastCheck > this.MAX_TIME_WITHOUT_CHECK) {
      return 'critical';
    }
    if (this.metrics.memoryStatus === 'critical') {
      return 'critical';
    }
    if (activeEngineFailures >= 3) {
      return 'critical';
    }
    
    // Unhealthy: Multiple consecutive failures
    if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return 'unhealthy';
    }
    
    // Degraded: Various warning conditions
    if (timeSinceLastAlert > this.MAX_TIME_WITHOUT_ALERT && this.metrics.checksPerformed > 0) {
      return 'degraded';
    }
    if (activeEngineFailures > 0 || recentCylinderFailures > 0) {
      return 'degraded';
    }
    if (this.metrics.memoryStatus === 'warning') {
      return 'degraded';
    }
    if (this.metrics.lastError && 
        (now.getTime() - this.metrics.lastError.timestamp.getTime()) < 60000) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // === HEALTH MONITORING LOOP ===

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    console.log('🏥 Unified health monitoring started (checking every 10s)');
  }

  private performHealthCheck(): void {
    // Update memory metrics
    this.updateMemoryMetrics();
    
    // Clean old cylinder failures
    this.clearCylinderFailuresOlderThan();
    
    // Compute current status
    const previousStatus = this.metrics.status;
    this.metrics.status = this.computeStatus();
    
    // Log status changes and warnings
    if (this.metrics.status !== 'healthy') {
      const warnings = this.generateWarnings();
      if (warnings.length > 0) {
        console.log(`🏥 Health Status: ${this.metrics.status.toUpperCase()} - ${warnings.join(', ')}`);
      }
    }
    
    // Check if we need auto-recovery
    if (this.metrics.status === 'critical' && !this.metrics.isAutoRecovering) {
      this.triggerAutoRecovery();
    }
  }

  private generateWarnings(): string[] {
    const now = new Date();
    const warnings: string[] = [];
    
    const timeSinceLastCheck = this.metrics.lastCheckTime 
      ? now.getTime() - this.metrics.lastCheckTime.getTime()
      : Number.MAX_SAFE_INTEGER;
    
    const timeSinceLastAlert = this.metrics.lastAlertGeneratedTime
      ? now.getTime() - this.metrics.lastAlertGeneratedTime.getTime()
      : Number.MAX_SAFE_INTEGER;
    
    if (timeSinceLastCheck > this.MAX_TIME_WITHOUT_CHECK) {
      const seconds = Math.floor(timeSinceLastCheck / 1000);
      warnings.push(`No health checks for ${seconds}s`);
    }
    
    if (timeSinceLastAlert > this.MAX_TIME_WITHOUT_ALERT && this.metrics.checksPerformed > 0) {
      const minutes = Math.floor(timeSinceLastAlert / 60000);
      warnings.push(`No alerts generated for ${minutes} minutes`);
      
      // Log periodic warning
      if (timeSinceLastAlert % 60000 < this.HEALTH_CHECK_INTERVAL) {
        console.warn(`⚠️ WARNING: No alerts generated in last ${minutes} minutes. System may be working but no alert conditions met.`);
      }
    }
    
    if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      warnings.push(`${this.metrics.consecutiveFailures} consecutive failures`);
    }
    
    let activeEngineFailures = 0;
    this.metrics.engineFailures.forEach(failure => {
      if (!failure.recovered) {
        activeEngineFailures++;
      }
    });
    
    if (activeEngineFailures > 0) {
      warnings.push(`${activeEngineFailures} engine failures`);
    }
    
    const recentCylinderFailures = Array.from(this.metrics.cylinderFailures.values())
      .filter(f => now.getTime() - f.lastFailureTime.getTime() < this.CYLINDER_CLEANUP_AGE)
      .length;
      
    if (recentCylinderFailures > 0) {
      warnings.push(`${recentCylinderFailures} cylinder failures`);
    }
    
    if (this.metrics.lastError && 
        (now.getTime() - this.metrics.lastError.timestamp.getTime()) < 60000) {
      warnings.push('Recent errors detected');
    }
    
    if (this.metrics.memoryStatus !== 'healthy') {
      warnings.push(`Memory ${this.metrics.memoryStatus} (${this.metrics.memoryUsageMB}MB)`);
    }
    
    return warnings;
  }

  // === AUTO-RECOVERY ===

  public async triggerAutoRecovery(): Promise<void> {
    if (this.metrics.isAutoRecovering) {
      console.log('🔄 Auto-recovery already in progress...');
      return;
    }

    this.metrics.isAutoRecovering = true;
    this.metrics.recoveryAttempts++;
    
    console.log(`🚑 INITIATING AUTO-RECOVERY (Attempt #${this.metrics.recoveryAttempts})`);

    try {
      // Step 1: Stop existing monitoring if callback provided
      if (this.callbacks.onStop) {
        console.log('🔧 Stopping existing monitoring...');
        await this.callbacks.onStop();
      }

      // Step 2: Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, this.AUTO_RECOVERY_DELAY));

      // Step 3: Restart monitoring if callback provided
      if (this.callbacks.onRestart) {
        console.log('🔧 Restarting monitoring...');
        await this.callbacks.onRestart();
      }

      // Step 4: Test recovery
      this.metrics.consecutiveFailures = 0;
      this.metrics.status = this.computeStatus();
      this.recordSuccessfulPoll();
      
      console.log('✅ AUTO-RECOVERY SUCCESSFUL! Monitoring restored.');
      
    } catch (error: any) {
      console.error('❌ Auto-recovery failed:', error.message);
      this.recordError(error);
      
      // Schedule retry after longer delay
      setTimeout(() => {
        this.metrics.isAutoRecovering = false;
        if (this.metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.triggerAutoRecovery();
        }
      }, 30000);
    } finally {
      this.metrics.isAutoRecovering = false;
    }
  }

  // === PUBLIC METRICS ===

  public getPublicMetrics(): PublicHealthMetrics {
    return {
      status: this.metrics.status,
      startTime: this.metrics.startTime.toISOString(),
      lastCheckTime: this.metrics.lastCheckTime?.toISOString() || null,
      lastAlertGeneratedTime: this.metrics.lastAlertGeneratedTime?.toISOString() || null,
      lastSuccessfulPoll: this.metrics.lastSuccessfulPoll?.toISOString() || null,
      lastHeartbeat: this.metrics.lastHeartbeat.toISOString(),
      lastError: this.metrics.lastError ? {
        message: this.metrics.lastError.message,
        timestamp: this.metrics.lastError.timestamp.toISOString()
      } : null,
      
      checksPerformed: this.metrics.checksPerformed,
      alertsGenerated: this.metrics.alertsGenerated,
      consecutiveFailures: this.metrics.consecutiveFailures,
      uptimeSeconds: this.metrics.uptimeSeconds,
      
      isAutoRecovering: this.metrics.isAutoRecovering,
      recoveryAttempts: this.metrics.recoveryAttempts,
      pollingIntervalMs: this.metrics.pollingIntervalMs,
      
      memoryUsageMB: this.metrics.memoryUsageMB,
      memoryStatus: this.metrics.memoryStatus,
      lastGcTime: this.metrics.lastGcTime?.toISOString() || null,
      
      engineFailures: Array.from(this.metrics.engineFailures.values()),
      cylinderFailures: Array.from(this.metrics.cylinderFailures.values()),
      fallbackPollingActive: Array.from(this.metrics.fallbackPollingActive)
    };
  }

  public getHealthStatus(): {
    status: HealthStatus;
    summary: string;
    recommendations: string[];
    timeSinceLastCheck: string;
    timeSinceLastAlert: string;
    warnings: string[];
  } {
    const now = new Date();
    
    const timeSinceLastCheck = this.metrics.lastCheckTime
      ? Math.floor((now.getTime() - this.metrics.lastCheckTime.getTime()) / 1000)
      : -1;
      
    const timeSinceLastAlert = this.metrics.lastAlertGeneratedTime
      ? Math.floor((now.getTime() - this.metrics.lastAlertGeneratedTime.getTime()) / 1000)
      : -1;

    const warnings = this.generateWarnings();
    const recommendations: string[] = [];
    
    if (this.metrics.status === 'critical') {
      recommendations.push('URGENT: Critical system issues detected. Auto-recovery initiated.');
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
      : `⚠️ System ${this.metrics.status}. ${warnings.join(' ')}`;

    return {
      status: this.metrics.status,
      summary,
      recommendations,
      warnings,
      timeSinceLastCheck: timeSinceLastCheck >= 0 ? `${timeSinceLastCheck}s ago` : 'Never',
      timeSinceLastAlert: timeSinceLastAlert >= 0 ? `${timeSinceLastAlert}s ago` : 'Never'
    };
  }

  // === FORCE RECOVERY ===

  public async forceRecovery(): Promise<void> {
    console.log('🔧 Manual recovery requested...');
    await this.triggerAutoRecovery();
  }

  // === SHUTDOWN ===

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 Unified health monitor shutdown complete');
  }
}

// === SINGLETON EXPORT ===

let monitorInstance: UnifiedHealthMonitor | null = null;

export function getHealthMonitor(): UnifiedHealthMonitor {
  if (!monitorInstance) {
    monitorInstance = UnifiedHealthMonitor.getInstance();
  }
  return monitorInstance;
}

// === API ROUTES ===

export function registerHealthRoutes(app: Express): void {
  const monitor = getHealthMonitor();
  
  // GET /api/health/status → {status, uptimeSeconds, warnings}
  app.get('/api/health/status', (req, res) => {
    try {
      const healthStatus = monitor.getHealthStatus();
      res.json({
        status: healthStatus.status,
        uptimeSeconds: monitor.getPublicMetrics().uptimeSeconds,
        warnings: healthStatus.warnings,
        summary: healthStatus.summary,
        recommendations: healthStatus.recommendations
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/health/metrics → getPublicMetrics()
  app.get('/api/health/metrics', (req, res) => {
    try {
      const metrics = monitor.getPublicMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/health/memory → memoryManager.getStats()
  app.get('/api/health/memory', (req, res) => {
    try {
      const memStats = memoryManager.getStats();
      res.json(memStats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/health/heartbeat → monitor.heartbeat()
  app.post('/api/health/heartbeat', (req, res) => {
    try {
      monitor.heartbeat();
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/health/recover → triggerAutoRecovery() (admin/auth protected)
  app.post('/api/health/recover', async (req, res) => {
    try {
      // TODO: Add authentication/authorization check here if needed
      await monitor.forceRecovery();
      res.json({ success: true, message: 'Recovery initiated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('🔗 Health monitoring API routes registered');
}