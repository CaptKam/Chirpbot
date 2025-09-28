
import * as v8 from 'v8';

// Emergency Memory Monitor - Prevents system crashes from memory overload
export class EmergencyMemoryMonitor {
  private static instance: EmergencyMemoryMonitor;
  private monitoring = false;
  private lastCleanup = 0;

  static getInstance(): EmergencyMemoryMonitor {
    if (!this.instance) {
      this.instance = new EmergencyMemoryMonitor();
    }
    return this.instance;
  }

  start() {
    if (this.monitoring) return;
    this.monitoring = true;

    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const memPercent = memUsage.heapUsed / heapStats.heap_size_limit;
      
      // Ensure we don't divide by zero
      if (heapStats.heap_size_limit === 0) {
        console.warn('⚠️ Heap size limit is 0, skipping memory check');
        return;
      }

      if (memPercent > 0.9 && Date.now() - this.lastCleanup > 5000) {
        console.log('🚨 EMERGENCY: Memory at', Math.round(memPercent * 100), '% - forcing cleanup');
        
        // Force aggressive cleanup
        if (global.gc) {
          global.gc();
        }
        
        this.lastCleanup = Date.now();
      }
    }, 5000); // Check every 5 seconds
  }
}
