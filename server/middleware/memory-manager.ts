/**
 * Google-Level Memory Management System
 * Implements intelligent garbage collection and resource cleanup
 */

export class MemoryManager {
  private static instance: MemoryManager;
  private gcThreshold = 0.75; // Trigger GC at 75% memory - more aggressive
  private forceGcThreshold = 0.85; // Force GC at 85% memory  
  private lastGcTime = Date.now();
  private gcCooldown = 15000; // 15 seconds between GC attempts

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Get current memory usage percentage
   */
  getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / memUsage.heapTotal;
  }

  /**
   * Check if memory cleanup is needed
   */
  shouldCleanup(): boolean {
    const memPercent = this.getMemoryUsage();
    const timeSinceLastGc = Date.now() - this.lastGcTime;

    return (
      (memPercent > this.gcThreshold && timeSinceLastGc > this.gcCooldown) ||
      memPercent > this.forceGcThreshold
    );
  }

  /**
   * Perform memory cleanup and garbage collection
   */
  cleanup(): void {
    const memBefore = this.getMemoryUsage();

    if (memBefore > this.forceGcThreshold) {
      // Force aggressive cleanup - only log once per minute
      if (memBefore > 0.85 && (Date.now() - this.lastGcTime) > 60000) {
        console.log('🧹 CRITICAL: Force garbage collection at', Math.round(memBefore * 100) + '%');
      }

      // Force aggressive cleanup
      if (global.gc) {
        global.gc();
      }
    } else if (memBefore > this.gcThreshold) {
      // Standard cleanup - minimal logging
      if (global.gc) {
        global.gc();
      }
    }

    this.lastGcTime = Date.now();

    const memAfter = this.getMemoryUsage();
    const freed = (memBefore - memAfter) * 100;

    if (freed > 0) {
      console.log(`💾 Memory cleanup: ${Math.round(freed)}% freed (${Math.round(memBefore * 100)}% → ${Math.round(memAfter * 100)}%)`);
    }
  }

  /**
   * Auto-cleanup middleware for Express routes
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      // Check memory before processing
      if (this.shouldCleanup()) {
        this.cleanup();
      }

      // Cleanup after response
      res.on('finish', () => {
        if (this.shouldCleanup()) {
          // Defer cleanup to not block response
          setImmediate(() => this.cleanup());
        }
      });

      next();
    };
  }

  /**
   * Get memory stats for health monitoring
   */
  getStats() {
    const memUsage = process.memoryUsage();
    const memPercent = this.getMemoryUsage();

    return {
      percentage: Math.round(memPercent * 100),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      lastGC: new Date(this.lastGcTime).toISOString(),
      needsCleanup: this.shouldCleanup(),
      status: memPercent > 0.99 ? 'critical' :  // Only critical above 99%
             memPercent > this.gcThreshold ? 'warning' : 'healthy'
    };
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();