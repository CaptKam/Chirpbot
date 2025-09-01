import type { WebSocket } from 'ws';

export const wsClients = new Set<WebSocket>();

export function broadcastAlert(payload: any) {
  const msg = JSON.stringify({ type: 'alert', payload });
  for (const ws of wsClients) {
    if ((ws as any).isAlive !== false) {
      try {
        ws.send(msg);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        wsClients.delete(ws);
      }
    }
  }
}

export function addClient(ws: WebSocket) {
  (ws as any).isAlive = true;
  wsClients.add(ws);
  
  ws.on('pong', function heartbeat() { 
    (this as any).isAlive = true; 
  });
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(ws);
  });
}

export function broadcastMessage(type: string, payload: any) {
  const msg = JSON.stringify({ type, payload });
  for (const ws of wsClients) {
    if ((ws as any).isAlive !== false) {
      try {
        ws.send(msg);
      } catch (error) {
        console.error('Error broadcasting message:', error);
        wsClients.delete(ws);
      }
    }
  }
}