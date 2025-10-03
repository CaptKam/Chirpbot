import fs from 'fs';
import path from 'path';
import os from 'os';
import { createServer } from 'net';

interface LockData {
  pid: number;
  port: number;
  timestamp: number;
}

export class SingleInstanceLock {
  private lockPath: string;
  private lockFd: number | null = null;

  constructor(lockName: string = 'chirpbot') {
    this.lockPath = path.join(os.tmpdir(), `${lockName}.lock`);
  }

  /**
   * Attempts to acquire the lock. Returns true if successful, false if another instance is running.
   */
  async acquire(port: number): Promise<boolean> {
    try {
      // Try to create exclusive lock file
      this.lockFd = fs.openSync(this.lockPath, 'wx');
      
      const lockData: LockData = {
        pid: process.pid,
        port,
        timestamp: Date.now()
      };
      
      fs.writeSync(this.lockFd, JSON.stringify(lockData, null, 2));
      
      // Setup cleanup on process exit
      process.on('exit', () => this.release());
      process.on('SIGINT', () => {
        this.release();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        this.release();
        process.exit(0);
      });
      
      return true;
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Lock file exists, check if process is still alive
        return await this.handleExistingLock(port);
      }
      throw error;
    }
  }

  private async handleExistingLock(port: number): Promise<boolean> {
    try {
      const lockContent = fs.readFileSync(this.lockPath, 'utf8');
      const lockData: LockData = JSON.parse(lockContent);
      
      // Check if the process is still alive
      if (this.isProcessAlive(lockData.pid)) {
        // In development mode, wait for the old process to die during restarts
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Development restart detected - waiting for PID ${lockData.pid} to finish shutting down...`);
          await this.waitForProcessToDie(lockData.pid, 5000);
          
          // Check again if process is still alive after waiting
          if (!this.isProcessAlive(lockData.pid)) {
            console.log(`✅ Previous process finished - acquiring lock`);
            fs.unlinkSync(this.lockPath);
            return await this.acquire(port);
          }
        }
        
        console.log(`🔒 ChirpBot instance already running (PID: ${lockData.pid}, Port: ${lockData.port})`);
        console.log('   Existing instance is healthy - exiting gracefully');
        return false;
      } else {
        // Process is dead, remove stale lock
        console.log(`🧹 Removing stale lock file (PID ${lockData.pid} no longer exists)`);
        fs.unlinkSync(this.lockPath);
        
        // Try to acquire again
        return await this.acquire(port);
      }
    } catch (error) {
      // Corrupted lock file, remove it
      console.log('🧹 Removing corrupted lock file');
      try {
        fs.unlinkSync(this.lockPath);
      } catch {}
      return await this.acquire(5000); // Try again with default port
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      // Signal 0 tests for process existence without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error: any) {
      return error.code !== 'ESRCH'; // ESRCH means process doesn't exist
    }
  }

  /**
   * Waits for a process to die during development restarts
   */
  private async waitForProcessToDie(pid: number, maxWaitMs: number): Promise<void> {
    const start = Date.now();
    const checkInterval = 500; // Check every 500ms
    
    while (this.isProcessAlive(pid) && (Date.now() - start) < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const elapsed = Date.now() - start;
      if (elapsed % 1000 < checkInterval) { // Log every second
        console.log(`⏳ Waiting for PID ${pid} to shutdown... (${Math.floor(elapsed/1000)}s/${Math.floor(maxWaitMs/1000)}s)`);
      }
    }
    
    if (this.isProcessAlive(pid)) {
      console.log(`⚠️ Process ${pid} still running after ${maxWaitMs}ms wait`);
    } else {
      console.log(`✅ Process ${pid} successfully shutdown`);
    }
  }

  /**
   * Releases the lock and cleans up
   */
  release(): void {
    if (this.lockFd !== null) {
      try {
        fs.closeSync(this.lockFd);
        this.lockFd = null;
      } catch {}
    }
    
    try {
      fs.unlinkSync(this.lockPath);
    } catch {}
  }

  /**
   * Checks if a port is in use
   */
  static async isPortInUse(port: number, host: string = '0.0.0.0'): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      
      server.listen(port, host, () => {
        server.close(() => resolve(false));
      });
      
      server.on('error', () => resolve(true));
    });
  }

  /**
   * Waits for a port to become available with exponential backoff
   */
  static async waitForPortAvailable(port: number, maxAttempts: number = 5): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const inUse = await this.isPortInUse(port);
      
      if (!inUse) {
        return true;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Cap at 5 seconds
      console.log(`⏳ Port ${port} in use, waiting ${delay}ms before retry (${attempt + 1}/${maxAttempts})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return false;
  }

  /**
   * Finds the next available port starting from the given port
   */
  static async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port <= startPort + 100; port++) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return port;
      }
    }
    throw new Error(`No available ports found in range ${startPort}-${startPort + 100}`);
  }
}