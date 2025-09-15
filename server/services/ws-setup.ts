import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface WSSOptions {
  noServer?: boolean;
}

export function createWSS(server: Server, options: WSSOptions = {}) {
  // 🔒 SECURITY: Support noServer mode for session-authenticated connections
  const wss = new WebSocketServer({ 
    ...(options.noServer ? { noServer: true } : { server }),
    path: "/realtime-alerts", 
    clientTracking: true 
  });

  // Keep connections alive (reduced interval for better Error 1006 resilience)
  const PING_INTERVAL = 18_000;

  wss.on("connection", (ws: WebSocket, req?: any) => {
    // 🔒 SECURITY: Connection is now authenticated - userId is attached by upgrade handler
    const userId = (ws as any).userId;
    const authenticatedAt = (ws as any).authenticatedAt;
    
    console.log(`🔌 Authenticated WebSocket connection established for user: ${userId} at ${authenticatedAt}`);
    
    // Track connection health
    (ws as any).isAlive = true;

    ws.on("pong", () => {
      (ws as any).isAlive = true;
      // Connection confirmed alive
    });

    ws.on("error", (e) => {
      console.error(`WebSocket error for user ${userId}:`, e);
      (ws as any).isAlive = false;
    });

    ws.on("close", (code, reason) => {
      console.log(`WebSocket closed for user ${userId}:`, code, reason?.toString());
      (ws as any).isAlive = false;
    });

    // Send initial connection confirmation with authenticated status
    try {
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'Authenticated real-time alerts enabled with heartbeat',
        userId: userId,
        authenticatedAt: authenticatedAt,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error sending initial WebSocket message to user ${userId}:`, error);
    }
  });

  // Heartbeat mechanism to detect dead connections
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      const sock = ws as any;
      if (!sock.isAlive) { 
        console.log('🔌 Terminating dead WebSocket connection');
        ws.terminate(); 
        continue; 
      }
      sock.isAlive = false;
      ws.ping();
    }
  }, PING_INTERVAL);

  wss.on("close", () => {
    console.log('🔌 WebSocket Server closing - clearing heartbeat interval');
    clearInterval(interval);
  });

  return wss;
}