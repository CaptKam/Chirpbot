import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
  lastActivity: number;
  messageCount: number;
  errorCount: number;
  metadata?: any;
}

interface WebSocketStats {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
}

export class EnhancedWebSocketManager extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private stats: WebSocketStats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0
  };
  
  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_ERROR_COUNT = 5;
  private readonly MAX_MESSAGE_SIZE = 1048576; // 1MB
  private readonly MAX_CLIENTS = 1000;
  
  constructor() {
    super();
    this.setupCleanupHandlers();
  }
  
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: this.MAX_MESSAGE_SIZE,
      clientTracking: false, // We'll manage clients ourselves
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    // Start heartbeat monitoring
    this.startHeartbeat();
    
    console.log('✅ Enhanced WebSocket server initialized');
  }
  
  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    
    // Check if we've reached max clients
    if (this.clients.size >= this.MAX_CLIENTS) {
      console.warn(`⚠️ Max clients reached (${this.MAX_CLIENTS}), rejecting connection`);
      ws.close(1008, 'Server at capacity');
      return;
    }
    
    const client: WebSocketClient = {
      ws,
      id: clientId,
      isAlive: true,
      lastActivity: Date.now(),
      messageCount: 0,
      errorCount: 0,
      metadata: {
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent'],
        connectedAt: new Date().toISOString()
      }
    };
    
    this.clients.set(clientId, client);
    this.stats.totalConnections++;
    this.stats.activeConnections = this.clients.size;
    
    console.log(`💚 Client connected: ${clientId} (Total: ${this.clients.size})`);
    
    // Send welcome message
    this.sendToClient(client, {
      type: 'connection_ack',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to ChirpBot V2 WebSocket'
    });
    
    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(client, data));
    ws.on('pong', () => this.handlePong(client));
    ws.on('ping', () => this.handlePing(client));
    ws.on('close', (code, reason) => this.handleClose(client, code, reason));
    ws.on('error', (error) => this.handleClientError(client, error));
  }
  
  private handleMessage(client: WebSocketClient, data: any): void {
    try {
      client.lastActivity = Date.now();
      client.messageCount++;
      this.stats.messagesReceived++;
      
      // Parse message
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
          break;
        case 'heartbeat':
          client.isAlive = true;
          break;
        case 'subscribe':
          client.metadata.subscriptions = message.channels || [];
          break;
        default:
          this.emit('message', { clientId: client.id, message });
      }
      
      // Reset error count on successful message
      client.errorCount = 0;
      
    } catch (error) {
      console.error(`❌ Error handling message from ${client.id}:`, error);
      client.errorCount++;
      
      if (client.errorCount >= this.MAX_ERROR_COUNT) {
        console.warn(`⚠️ Client ${client.id} exceeded error limit, disconnecting`);
        this.disconnectClient(client, 1011, 'Too many errors');
      }
    }
  }
  
  private handlePong(client: WebSocketClient): void {
    client.isAlive = true;
    client.lastActivity = Date.now();
  }
  
  private handlePing(client: WebSocketClient): void {
    client.lastActivity = Date.now();
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.pong();
    }
  }
  
  private handleClose(client: WebSocketClient, code: number, reason: Buffer): void {
    const reasonStr = reason?.toString() || 'Unknown';
    console.log(`🔌 Client disconnected: ${client.id} (Code: ${code}, Reason: ${reasonStr})`);
    
    this.clients.delete(client.id);
    this.stats.activeConnections = this.clients.size;
    this.emit('disconnect', { clientId: client.id, code, reason: reasonStr });
  }
  
  private handleClientError(client: WebSocketClient, error: Error): void {
    console.error(`💥 WebSocket error for client ${client.id}:`, error.message);
    client.errorCount++;
    this.stats.errors++;
    
    if (client.errorCount >= this.MAX_ERROR_COUNT) {
      this.disconnectClient(client, 1011, 'Connection error');
    }
  }
  
  private handleServerError(error: Error): void {
    console.error('💥 WebSocket server error:', error);
    this.stats.errors++;
    this.emit('serverError', error);
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHealth();
    }, this.HEARTBEAT_INTERVAL);
  }
  
  private checkClientHealth(): void {
    const now = Date.now();
    const deadClients: WebSocketClient[] = [];
    
    for (const client of Array.from(this.clients.values())) {
      // Check if client is alive
      if (!client.isAlive) {
        deadClients.push(client);
        continue;
      }
      
      // Check for timeout
      if (now - client.lastActivity > this.CLIENT_TIMEOUT) {
        console.warn(`⏰ Client ${client.id} timed out`);
        deadClients.push(client);
        continue;
      }
      
      // Send ping
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Error pinging client ${client.id}:`, error);
          deadClients.push(client);
        }
      }
    }
    
    // Clean up dead connections
    for (const client of deadClients) {
      this.disconnectClient(client, 1001, 'Connection lost');
    }
    
    if (deadClients.length > 0) {
      console.log(`🧹 Cleaned ${deadClients.length} dead connections. Active: ${this.clients.size}`);
    }
  }
  
  private disconnectClient(client: WebSocketClient, code: number, reason: string): void {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(code, reason);
      } else {
        client.ws.terminate();
      }
    } catch (error) {
      console.error(`Error disconnecting client ${client.id}:`, error);
      client.ws.terminate();
    }
    
    this.clients.delete(client.id);
    this.stats.activeConnections = this.clients.size;
  }
  
  broadcast(data: any, filter?: (client: WebSocketClient) => boolean): number {
    const payload = JSON.stringify(data);
    let sent = 0;
    
    for (const client of Array.from(this.clients.values())) {
      if (filter && !filter(client)) continue;
      
      if (client.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 65536) {
        try {
          client.ws.send(payload);
          sent++;
          this.stats.messagesSent++;
        } catch (error) {
          console.error(`Error broadcasting to client ${client.id}:`, error);
          client.errorCount++;
        }
      }
    }
    
    return sent;
  }
  
  sendToClient(client: WebSocketClient, data: any): boolean {
    if (client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      client.ws.send(JSON.stringify(data));
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      console.error(`Error sending to client ${client.id}:`, error);
      client.errorCount++;
      return false;
    }
  }
  
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private setupCleanupHandlers(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  shutdown(): void {
    console.log('🛑 Shutting down WebSocket manager...');
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all client connections
    for (const client of Array.from(this.clients.values())) {
      this.disconnectClient(client, 1001, 'Server shutting down');
    }
    
    // Close server
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ WebSocket server closed');
      });
    }
    
    this.clients.clear();
    this.removeAllListeners();
  }
  
  getStats(): WebSocketStats & { clients: number } {
    return {
      ...this.stats,
      clients: this.clients.size
    };
  }
  
  getClients(): Map<string, WebSocketClient> {
    return this.clients;
  }
}