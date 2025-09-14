/**
 * Google-Level Memory Management System
 * Implements intelligent garbage collection and resource cleanup
 */

import * as v8 from 'v8';

export class MemoryManager {
  private static instance: MemoryManager;
  private gcThreshold = 0.85; // Trigger GC at 85% of heap limit
  private forceGcThreshold = 0.92; // Force GC at 92% of heap limit  
  private lastGcTime = Date.now();
  private gcCooldown = 15000; // 15 seconds between GC attempts
  private lastCriticalLog = 0; // Prevent log spam

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Get current memory usage percentage against V8 heap limit
   */
  getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    return memUsage.heapUsed / heapStats.heap_size_limit;
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
    const memUsage = process.memoryUsage();
    const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (memBefore > this.forceGcThreshold) {
      // Force aggressive cleanup - log max once per 5 minutes
      const now = Date.now();
      if (now - this.lastCriticalLog > 300000) {
        console.log(`🧹 CRITICAL: Force garbage collection at ${Math.round(memBefore * 100)}% (${heapMB}MB)`);
        this.lastCriticalLog = now;
      }

      if (global.gc) {
        global.gc();
      }
    } else if (memBefore > this.gcThreshold) {
      if (global.gc) {
        global.gc();
      }
    }

    this.lastGcTime = Date.now();

    const memAfter = this.getMemoryUsage();
    const freedPercent = (memBefore - memAfter) * 100;

    // Only log meaningful cleanup (>1% freed)
    if (freedPercent > 1) {
      const afterMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`💾 Memory cleanup: ${Math.round(freedPercent)}% freed (${heapMB}MB → ${afterMB}MB)`);
    }
  }

  /**
   * Background cleanup for non-Express contexts
   */
  cleanupBackground(): void {
    const memPercent = this.getMemoryUsage();
    if (memPercent > this.gcThreshold) {
      if (global.gc) {
        global.gc();
      }
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
    const heapStats = v8.getHeapStatistics();
    const memPercent = this.getMemoryUsage();

    return {
      percentage: Math.round(memPercent * 100),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024), // MB
      lastGC: new Date(this.lastGcTime).toISOString(),
      needsCleanup: this.shouldCleanup(),
      status: memPercent > this.forceGcThreshold ? 'critical' :
             memPercent > this.gcThreshold ? 'warning' : 'healthy'
    };
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();