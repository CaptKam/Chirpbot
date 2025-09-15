import { WebSocketServer } from "ws";

export class HealthMonitor {
  private interval?: NodeJS.Timeout;
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  startMonitoring() {
    if (this.interval) {
      console.log('🏥 Health monitor already running');
      return; // idempotent
    }

    console.log('🏥 Starting WebSocket health monitoring');
    this.interval = setInterval(() => {
      const metrics = {
        timestamp: Date.now(),
        clients: this.wss.clients.size,
        activeConnections: Array.from(this.wss.clients).filter(ws => ws.readyState === 1).length
      };
      
      // Log metrics for debugging
      if (metrics.clients > 0) {
        console.log('🏥 WebSocket Health:', metrics);
      }
    }, 30_000); // Check every 30 seconds
  }

  stopMonitoring() {
    if (this.interval) {
      console.log('🏥 Stopping WebSocket health monitoring');
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  getConnectionCount(): number {
    return this.wss.clients.size;
  }

  getActiveConnections(): number {
    return Array.from(this.wss.clients).filter(ws => ws.readyState === 1).length;
  }
}