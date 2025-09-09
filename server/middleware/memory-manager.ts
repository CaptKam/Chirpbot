/**
 * Google-Level Memory Management System
 * Implements intelligent garbage collection and resource cleanup
 */

export class MemoryManager {
  private static instance: MemoryManager;
  private gcThreshold = 0.85; // Trigger GC at 85% memory
  private forceGcThreshold = 0.9; // Force GC at 90% memory
  private lastGcTime = Date.now();
  private gcCooldown = 30000; // 30 seconds between GC attempts
  
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
      console.log('🧹 CRITICAL: Force garbage collection at', Math.round(memBefore * 100) + '%');
      
      // Force aggressive cleanup
      if (global.gc) {
        global.gc();
        global.gc(); // Double GC for aggressive cleanup
      }
    } else if (memBefore > this.gcThreshold) {
      console.log('🧹 Memory cleanup triggered at', Math.round(memBefore * 100) + '%');
      
      // Standard cleanup
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
      status: memPercent > this.forceGcThreshold ? 'critical' : 
             memPercent > this.gcThreshold ? 'warning' : 'healthy'
    };
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();