// Server Watchdog - Ensures server stays alive
import { spawn } from 'child_process';
import * as path from 'path';

class ServerWatchdog {
  private serverProcess: any = null;
  private restartCount = 0;
  private lastRestartTime = Date.now();
  private readonly MAX_RESTARTS_PER_MINUTE = 5;
  
  constructor() {
    console.log('🐕 Server Watchdog initialized');
    this.startServer();
    this.setupSignalHandlers();
  }
  
  private startServer() {
    if (this.serverProcess) {
      console.log('⚠️ Server already running, skipping start');
      return;
    }
    
    // Check restart rate limiting
    const timeSinceLastRestart = Date.now() - this.lastRestartTime;
    if (timeSinceLastRestart < 60000) { // Within a minute
      this.restartCount++;
      if (this.restartCount > this.MAX_RESTARTS_PER_MINUTE) {
        console.error('❌ Too many restarts, waiting 30 seconds...');
        setTimeout(() => {
          this.restartCount = 0;
          this.startServer();
        }, 30000);
        return;
      }
    } else {
      this.restartCount = 0;
    }
    
    this.lastRestartTime = Date.now();
    console.log(`🚀 Starting server (attempt ${this.restartCount + 1})...`);
    
    // Start the actual server
    this.serverProcess = spawn('tsx', ['server/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    this.serverProcess.on('exit', (code: number, signal: string) => {
      console.log(`⚠️ Server exited with code ${code} and signal ${signal}`);
      this.serverProcess = null;
      
      // Auto-restart after a delay
      setTimeout(() => {
        console.log('🔄 Auto-restarting server...');
        this.startServer();
      }, 2000);
    });
    
    this.serverProcess.on('error', (error: Error) => {
      console.error('❌ Server process error:', error);
      this.serverProcess = null;
      setTimeout(() => this.startServer(), 5000);
    });
  }
  
  private setupSignalHandlers() {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }
  
  private shutdown(signal: string) {
    console.log(`\n🛑 Watchdog received ${signal}, shutting down...`);
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    process.exit(0);
  }
}

// Start the watchdog
new ServerWatchdog();