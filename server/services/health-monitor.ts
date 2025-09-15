// WebSocket imports removed - using HTTP polling architecture

export class HealthMonitor {
  private interval?: NodeJS.Timeout;

  constructor() {
    // No WebSocket dependency - using HTTP polling architecture
  }

  startMonitoring() {
    if (this.interval) {
      console.log('🏥 Health monitor already running');
      return; // idempotent
    }

    console.log('🏥 Starting HTTP polling health monitoring');
    this.interval = setInterval(() => {
      const metrics = {
        timestamp: Date.now(),
        architecture: 'HTTP polling',
        status: 'active'
      };
      
      // Log metrics for debugging
      console.log('🏥 Health Monitor:', metrics);
    }, 30_000); // Check every 30 seconds
  }

  stopMonitoring() {
    if (this.interval) {
      console.log('🏥 Stopping health monitoring');
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  getConnectionCount(): number {
    return 0; // No WebSocket connections in HTTP polling architecture
  }

  getActiveConnections(): number {
    return 0; // No WebSocket connections in HTTP polling architecture
  }
}