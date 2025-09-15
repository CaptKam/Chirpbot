import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { randomUUID } from 'crypto';

interface WSSOptions {
  noServer?: boolean;
}

// Generate unique server boot ID that persists for the session
const SERVER_BOOT_ID = randomUUID();
console.log(`🔌 WebSocket Server Boot ID: ${SERVER_BOOT_ID}`);

// Export for use in health endpoints
export const getServerBootId = () => SERVER_BOOT_ID;

export function createWSS(server: Server, options: WSSOptions = {}) {
  // 🔒 SECURITY: Support noServer mode for session-authenticated connections
  const wss = new WebSocketServer({ 
    ...(options.noServer ? { noServer: true } : { server }),
    path: "/realtime-alerts", 
    clientTracking: true 
  });

  // Heartbeat system to prevent idle timeouts and maintain connection stability
  const PING_INTERVAL = 30_000; // 30 seconds as requested
  let heartbeatStats = {
    totalPingsSent: 0,
    totalPongsReceived: 0,
    deadConnectionsTerminated: 0,
    activeConnections: 0,
    lastHeartbeatAt: new Date().toISOString()
  };

  wss.on("connection", (ws: WebSocket, req?: any) => {
    // 🔒 SECURITY: Connection is now authenticated - userId is attached by upgrade handler
    const userId = (ws as any).userId;
    const authenticatedAt = (ws as any).authenticatedAt;
    
    console.log(`🔌 Authenticated WebSocket connection established for user: ${userId} at ${authenticatedAt}`);
    
    // Track connection health
    (ws as any).isAlive = true;

    ws.on("pong", () => {
      (ws as any).isAlive = true;
      (ws as any).lastPongAt = new Date().toISOString();
      heartbeatStats.totalPongsReceived++;
      // Connection confirmed alive with pong response
    });

    ws.on("error", (e) => {
      console.error(`WebSocket error for user ${userId}:`, e);
      (ws as any).isAlive = false;
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 WebSocket closed for user ${userId}: code ${code}, reason: ${reason?.toString()}`);
      (ws as any).isAlive = false;
      heartbeatStats.activeConnections = Math.max(0, heartbeatStats.activeConnections - 1);
    });

    // Send initial connection confirmation with authenticated status
    try {
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'Authenticated real-time alerts enabled with 30s heartbeat',
        userId: userId,
        authenticatedAt: authenticatedAt,
        serverBootId: SERVER_BOOT_ID,
        heartbeatInterval: PING_INTERVAL,
        timestamp: new Date().toISOString()
      }));
      
      // Track active connection
      heartbeatStats.activeConnections++;
    } catch (error) {
      console.error(`Error sending initial WebSocket message to user ${userId}:`, error);
    }
  });

  // Enhanced heartbeat mechanism with detailed logging and metrics
  const interval = setInterval(() => {
    const clientCount = wss.clients.size;
    let deadConnections = 0;
    let pingsToSend = 0;
    
    heartbeatStats.lastHeartbeatAt = new Date().toISOString();
    
    for (const ws of wss.clients) {
      const sock = ws as any;
      
      if (!sock.isAlive) {
        const userId = sock.userId || 'unknown';
        console.log(`🔌 Terminating dead WebSocket connection for user: ${userId}`);
        ws.terminate();
        deadConnections++;
        heartbeatStats.deadConnectionsTerminated++;
        continue;
      }
      
      // Mark as potentially dead until pong received
      sock.isAlive = false;
      sock.lastPingAt = new Date().toISOString();
      
      try {
        ws.ping();
        pingsToSend++;
        heartbeatStats.totalPingsSent++;
      } catch (error) {
        console.error(`🔌 Error sending ping to WebSocket:`, error);
        ws.terminate();
        deadConnections++;
        heartbeatStats.deadConnectionsTerminated++;
      }
    }
    
    // Update active connections count
    heartbeatStats.activeConnections = Math.max(0, heartbeatStats.activeConnections - deadConnections);
    
    // Log heartbeat activity every minute (every 2nd heartbeat cycle)
    const shouldLog = heartbeatStats.totalPingsSent % 2 === 0;
    if (shouldLog || deadConnections > 0) {
      console.log(`🔌 Heartbeat: ${pingsToSend} pings sent, ${deadConnections} dead connections cleaned, ${clientCount} active clients`);
    }
  }, PING_INTERVAL);

  wss.on("close", () => {
    console.log('🔌 WebSocket Server closing - clearing heartbeat interval');
    clearInterval(interval);
  });

  // Add heartbeat stats method to WSS for monitoring
  (wss as any).getHeartbeatStats = () => ({ 
    ...heartbeatStats,
    currentConnections: wss.clients.size,
    serverBootId: SERVER_BOOT_ID,
    pingIntervalMs: PING_INTERVAL
  });
  
  return wss;
}