import { EventEmitter } from 'events';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
}

interface ResourceCleanup {
  name: string;
  cleanup: () => void | Promise<void>;
  interval?: number;
}

export class MemoryManager extends EventEmitter {
  private cleanupTasks: Map<string, ResourceCleanup> = new Map();
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Memory thresholds (in MB)
  private readonly WARNING_THRESHOLD = 400; // Warning at 400MB
  private readonly CRITICAL_THRESHOLD = 600; // Critical at 600MB
  private readonly FORCE_GC_THRESHOLD = 500; // Force GC at 500MB
  
  constructor() {
    super();
    this.startMemoryMonitoring();
    this.setupProcessHandlers();
  }
  
  private startMemoryMonitoring(): void {
    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemory();
    }, 30000);
  }
  
  private checkMemory(): void {
    const stats = this.getMemoryStats();
    
    if (stats.heapUsedMB > this.CRITICAL_THRESHOLD) {
      console.error(`🚨 CRITICAL: Memory usage at ${stats.heapUsedMB.toFixed(2)}MB`);
      this.emit('critical', stats);
      this.performAggressiveCleanup();
    } else if (stats.heapUsedMB > this.WARNING_THRESHOLD) {
      console.warn(`⚠️ WARNING: Memory usage at ${stats.heapUsedMB.toFixed(2)}MB`);
      this.emit('warning', stats);
      this.performCleanup();
    } else if (stats.heapUsedMB > this.FORCE_GC_THRESHOLD && global.gc) {
      console.log(`🧹 Running garbage collection at ${stats.heapUsedMB.toFixed(2)}MB`);
      global.gc();
    }
    
    // Log memory stats periodically
    if (Math.random() < 0.1) { // 10% chance to log
      console.log(`📊 Memory: ${stats.heapUsedMB.toFixed(1)}MB / ${stats.heapTotalMB.toFixed(1)}MB (RSS: ${stats.rssMB.toFixed(1)}MB)`);
    }
  }
  
  private getMemoryStats(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      heapUsedMB: mem.heapUsed / 1024 / 1024,
      heapTotalMB: mem.heapTotal / 1024 / 1024,
      rssMB: mem.rss / 1024 / 1024
    };
  }
  
  registerCleanupTask(name: string, cleanup: () => void | Promise<void>, intervalMs?: number): void {
    this.cleanupTasks.set(name, { name, cleanup, interval: intervalMs });
    
    // If interval specified, set up periodic cleanup
    if (intervalMs) {
      const existingInterval = this.cleanupIntervals.get(name);
      if (existingInterval) {
        clearInterval(existingInterval);
      }
      
      const interval = setInterval(async () => {
        try {
          await cleanup();
          console.log(`✅ Periodic cleanup completed: ${name}`);
        } catch (error) {
          console.error(`❌ Periodic cleanup failed for ${name}:`, error);
        }
      }, intervalMs);
      
      this.cleanupIntervals.set(name, interval);
    }
  }
  
  async performCleanup(): Promise<void> {
    console.log('🧹 Performing memory cleanup...');
    const startMem = this.getMemoryStats().heapUsedMB;
    
    for (const [name, task] of Array.from(this.cleanupTasks)) {
      try {
        await task.cleanup();
        console.log(`✅ Cleaned: ${name}`);
      } catch (error) {
        console.error(`❌ Cleanup failed for ${name}:`, error);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const endMem = this.getMemoryStats().heapUsedMB;
    const freed = startMem - endMem;
    console.log(`✨ Cleanup complete. Freed ${freed.toFixed(2)}MB`);
  }
  
  async performAggressiveCleanup(): Promise<void> {
    console.log('🔥 Performing aggressive memory cleanup...');
    
    // Clear all caches and temporary data
    await this.performCleanup();
    
    // Clear require cache for non-essential modules
    for (const key in require.cache) {
      if (!key.includes('node_modules') && !key.includes('server/index')) {
        delete require.cache[key];
      }
    }
    
    // Multiple GC runs if available
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const stats = this.getMemoryStats();
    console.log(`🔥 Aggressive cleanup complete. Current: ${stats.heapUsedMB.toFixed(2)}MB`);
  }
  
  private setupProcessHandlers(): void {
    // Monitor for memory warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.warn('⚠️ Max listeners exceeded:', warning);
        this.emit('maxListeners', warning);
      }
    });
  }
  
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    for (const interval of Array.from(this.cleanupIntervals.values())) {
      clearInterval(interval);
    }
    
    this.cleanupIntervals.clear();
    this.cleanupTasks.clear();
    this.removeAllListeners();
  }
  
  // Utility function to safely clear a Map or Set
  static safeClear<T>(collection: Map<any, T> | Set<T>, maxSize: number = 1000): number {
    let removed = 0;
    if (collection.size > maxSize) {
      if (collection instanceof Map) {
        const entries = Array.from(collection.entries());
        const toRemove = entries.slice(0, entries.length - maxSize);
        toRemove.forEach(([key]) => {
          collection.delete(key);
          removed++;
        });
      } else if (collection instanceof Set) {
        const entries = Array.from(collection);
        const toRemove = entries.slice(0, entries.length - maxSize);
        toRemove.forEach((item) => {
          collection.delete(item);
          removed++;
        });
      }
    }
    return removed;
  }
  
  // Monitor a specific collection
  monitorCollection(name: string, collection: Map<any, any> | Set<any>, maxSize: number = 1000): void {
    this.registerCleanupTask(
      `collection-${name}`,
      () => {
        const removed = MemoryManager.safeClear(collection, maxSize);
        if (removed > 0) {
          console.log(`🧹 Cleared ${removed} items from ${name}`);
        }
      },
      60000 // Check every minute
    );
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();

// Enable garbage collection reporting in development
if (process.env.NODE_ENV === 'development') {
  if (global.gc) {
    console.log('✅ Manual garbage collection enabled');
  } else {
    console.log('ℹ️ Run with --expose-gc flag to enable manual garbage collection');
  }
}