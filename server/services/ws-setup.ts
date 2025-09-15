import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export function createWSS(server: Server) {
  const wss = new WebSocketServer({ 
    server, 
    path: "/realtime-alerts", 
    clientTracking: true 
  });

  // Keep connections alive (<= 30s beats most proxy idle drops)
  const PING_INTERVAL = 25_000;

  wss.on("connection", (ws: WebSocket) => {
    console.log('🔌 New WebSocket connection established');
    
    // Track connection health
    (ws as any).isAlive = true;

    ws.on("pong", () => {
      (ws as any).isAlive = true;
      // Connection confirmed alive
    });

    ws.on("error", (e) => {
      console.error("WebSocket error:", e);
      (ws as any).isAlive = false;
    });

    ws.on("close", (code, reason) => {
      console.log("WebSocket closed:", code, reason?.toString());
      (ws as any).isAlive = false;
    });

    // Send initial connection confirmation
    try {
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'Real-time alerts enabled with heartbeat',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending initial WebSocket message:', error);
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