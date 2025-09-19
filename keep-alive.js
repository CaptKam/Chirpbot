#!/usr/bin/env node

/**
 * ULTIMATE BULLETPROOF SERVER MANAGER
 * This script ensures ChirpBot V2 NEVER stays down
 * It monitors the server process and restarts it instantly if it crashes
 */

import { spawn } from 'child_process';
import http from 'http';

class UltimateServerManager {
  constructor() {
    this.serverProcess = null;
    this.restartCount = 0;
    this.lastRestartTime = 0;
    this.maxRestartsPerMinute = 10;
    this.isShuttingDown = false;
    
    console.log('🛡️ ULTIMATE SERVER MANAGER STARTING');
    console.log('💪 Your server will NEVER stay down');
    
    this.startServer();
    this.setupHealthCheck();
    this.setupSignalHandlers();
  }
  
  async startServer() {
    if (this.isShuttingDown) return;
    
    // Rate limiting
    const now = Date.now();
    if (now - this.lastRestartTime < 60000) {
      this.restartCount++;
    } else {
      this.restartCount = 0;
    }
    
    if (this.restartCount > this.maxRestartsPerMinute) {
      console.log('⏸️ Rate limit reached, waiting 30 seconds...');
      setTimeout(() => {
        this.restartCount = 0;
        this.startServer();
      }, 30000);
      return;
    }
    
    this.lastRestartTime = now;
    
    console.log(`🚀 Starting server (attempt ${this.restartCount + 1})...`);
    
    // Kill any existing process first
    if (this.serverProcess) {
      try {
        this.serverProcess.kill('SIGTERM');
      } catch (e) {
        // Process already dead
      }
      this.serverProcess = null;
    }
    
    // Wait a moment for port to free up
    await this.sleep(1000);
    
    // Start the server process
    this.serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
      detached: false
    });
    
    this.serverProcess.on('error', (error) => {
      console.error('❌ Server process error:', error.message);
      this.handleServerExit(1, 'ERROR');
    });
    
    this.serverProcess.on('exit', (code, signal) => {
      console.log(`⚠️ Server exited with code ${code} and signal ${signal}`);
      this.handleServerExit(code, signal);
    });
    
    // Give server time to start
    await this.sleep(3000);
  }
  
  handleServerExit(code, signal) {
    if (this.isShuttingDown) return;
    
    this.serverProcess = null;
    
    console.log(`🔄 Server crashed! Restarting in 2 seconds...`);
    console.log(`📊 Restart count: ${this.restartCount}`);
    
    setTimeout(() => {
      this.startServer();
    }, 2000);
  }
  
  setupHealthCheck() {
    // Check server health every 30 seconds
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      const isHealthy = await this.checkServerHealth();
      if (!isHealthy && this.serverProcess) {
        console.log('💔 Server health check failed, restarting...');
        this.handleServerExit(1, 'HEALTH_CHECK');
      }
    }, 30000);
  }
  
  async checkServerHealth() {
    // Use the same port logic as the server (PORT env var or default to 3000)
    const port = process.env.PORT || 3000;
    
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/api/health`, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }
  
  setupSignalHandlers() {
    const shutdown = (signal) => {
      console.log(`\n🛑 ${signal} received - shutting down gracefully...`);
      this.isShuttingDown = true;
      
      if (this.serverProcess) {
        this.serverProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.serverProcess) {
            this.serverProcess.kill('SIGKILL');
          }
          process.exit(0);
        }, 5000);
      } else {
        process.exit(0);
      }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the ultimate manager
new UltimateServerManager();

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled rejection in manager:', reason);
  // Don't crash the manager!
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught exception in manager:', error.message);
  // Don't crash the manager!
});