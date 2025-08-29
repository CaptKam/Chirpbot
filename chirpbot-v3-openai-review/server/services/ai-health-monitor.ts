import OpenAI from 'openai';

interface AIHealthMetrics {
  isHealthy: boolean;
  isReady: boolean;
  lastSuccessfulCall: number;
  failureCount: number;
  averageLatency: number;
  cpuUsage: number;
  memoryUsage: number;
  openaiStatus: 'healthy' | 'degraded' | 'unavailable';
  degradedMode: boolean;
  lastError?: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
}

interface HealthCheck {
  timestamp: number;
  latency: number;
  success: boolean;
  error?: string;
}

class AIHealthMonitor {
  private openai: OpenAI;
  private metrics: AIHealthMetrics;
  private healthHistory: HealthCheck[] = [];
  private startTime: number;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly MAX_FAILURE_COUNT = 5;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly LATENCY_THRESHOLD = 10000; // 10 seconds
  private readonly DEGRADED_MODE_THRESHOLD = 3;

  constructor() {
    this.startTime = Date.now();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
    
    this.metrics = {
      isHealthy: true,
      isReady: false,
      lastSuccessfulCall: 0,
      failureCount: 0,
      averageLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      openaiStatus: 'healthy',
      degradedMode: false,
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('🤖 Initializing AI Health Monitor...');
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not found - AI will operate in degraded mode');
      this.metrics.degradedMode = true;
      this.metrics.openaiStatus = 'unavailable';
      this.metrics.isReady = true; // Still ready for fallback
      return;
    }

    // Perform initial readiness check
    await this.performReadinessCheck();

    // Start automated health monitoring
    this.startHealthMonitoring();
    
    console.log('✅ AI Health Monitor initialized');
  }

  private async performReadinessCheck(): Promise<void> {
    try {
      console.log('🔍 Performing AI readiness check...');
      
      const startTime = Date.now();
      
      // Lightweight test call to OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Health check: respond with "OK"' }],
        max_tokens: 5,
        temperature: 0
      });

      const latency = Date.now() - startTime;
      
      if (response.choices[0]?.message?.content) {
        this.metrics.isReady = true;
        this.metrics.lastSuccessfulCall = Date.now();
        this.metrics.openaiStatus = 'healthy';
        this.metrics.averageLatency = latency;
        console.log(`✅ AI readiness check passed (${latency}ms)`);
      } else {
        throw new Error('Invalid response from OpenAI');
      }
    } catch (error) {
      console.error('❌ AI readiness check failed:', error);
      this.handleHealthCheckFailure(error as Error);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
      this.updateSystemMetrics();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    this.lastHealthCheck = startTime;

    try {
      // Lightweight health check call
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Health' }],
        max_tokens: 3,
        temperature: 0
      });

      const latency = Date.now() - startTime;

      if (response.choices[0]?.message?.content) {
        this.handleHealthCheckSuccess(latency);
      } else {
        throw new Error('Empty response from OpenAI');
      }
    } catch (error) {
      this.handleHealthCheckFailure(error as Error);
    }
  }

  private handleHealthCheckSuccess(latency: number): void {
    this.metrics.lastSuccessfulCall = Date.now();
    this.metrics.failureCount = 0;
    this.metrics.lastError = undefined;

    // Update latency (rolling average)
    this.metrics.averageLatency = this.metrics.averageLatency === 0 ? 
      latency : (this.metrics.averageLatency + latency) / 2;

    // Determine status based on latency
    if (latency > this.LATENCY_THRESHOLD) {
      this.metrics.openaiStatus = 'degraded';
    } else {
      this.metrics.openaiStatus = 'healthy';
    }

    // Exit degraded mode if we've recovered
    if (this.metrics.degradedMode && this.metrics.failureCount === 0) {
      console.log('✅ AI engine recovered - exiting degraded mode');
      this.metrics.degradedMode = false;
    }

    this.addToHealthHistory(true, latency);
    console.log(`💚 AI health check passed (${latency}ms)`);
  }

  private handleHealthCheckFailure(error: Error): void {
    this.metrics.failureCount++;
    this.metrics.lastError = error.message;

    // Enter degraded mode if failure threshold exceeded
    if (this.metrics.failureCount >= this.DEGRADED_MODE_THRESHOLD) {
      if (!this.metrics.degradedMode) {
        console.log('🚨 AI engine entering degraded mode due to repeated failures');
        this.metrics.degradedMode = true;
      }
      this.metrics.openaiStatus = 'unavailable';
    } else {
      this.metrics.openaiStatus = 'degraded';
    }

    this.addToHealthHistory(false, 0, error.message);
    console.error(`❌ AI health check failed (${this.metrics.failureCount}/${this.MAX_FAILURE_COUNT}):`, error.message);
  }

  private addToHealthHistory(success: boolean, latency: number, error?: string): void {
    const check: HealthCheck = {
      timestamp: Date.now(),
      latency,
      success,
      error
    };

    this.healthHistory.push(check);
    
    // Keep only last 100 checks
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }
  }

  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.metrics.memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    this.metrics.uptime = Date.now() - this.startTime;
    
    // Update health status
    const timeSinceLastSuccess = Date.now() - this.metrics.lastSuccessfulCall;
    this.metrics.isHealthy = timeSinceLastSuccess < (this.HEALTH_CHECK_INTERVAL * 2) && 
                             this.metrics.failureCount < this.MAX_FAILURE_COUNT;
  }

  // Public methods for health endpoints
  public getLivenessStatus(): { status: string; timestamp: number } {
    return {
      status: this.metrics.isHealthy ? 'OK' : 'UNHEALTHY',
      timestamp: Date.now()
    };
  }

  public getReadinessStatus(): { 
    status: string; 
    ready: boolean; 
    degradedMode: boolean;
    openaiStatus: string;
    timestamp: number; 
  } {
    return {
      status: this.metrics.isReady ? 'READY' : 'NOT_READY',
      ready: this.metrics.isReady,
      degradedMode: this.metrics.degradedMode,
      openaiStatus: this.metrics.openaiStatus,
      timestamp: Date.now()
    };
  }

  public getDetailedMetrics(): AIHealthMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  public getHealthHistory(): HealthCheck[] {
    return [...this.healthHistory];
  }

  // Track API call metrics
  public recordAPICall(success: boolean, latency: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.lastSuccessfulCall = Date.now();
    } else {
      this.metrics.failureCount++;
    }

    // Update rolling average latency
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency;
    } else {
      this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
    }
  }

  // Check if AI should be used for a request
  public shouldUseAI(userHasAIEnabled: boolean = true): boolean {
    if (!userHasAIEnabled) {
      return false;
    }

    if (this.metrics.degradedMode) {
      console.log('🔄 AI request skipped - operating in degraded mode');
      return false;
    }

    if (!this.metrics.isReady || this.metrics.openaiStatus === 'unavailable') {
      console.log('🔄 AI request skipped - service not ready');
      return false;
    }

    return true;
  }

  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Singleton instance
export const aiHealthMonitor = new AIHealthMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  aiHealthMonitor.cleanup();
});

process.on('SIGINT', () => {
  aiHealthMonitor.cleanup();
});