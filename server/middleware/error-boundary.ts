import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

interface ErrorStats {
  total: number;
  byType: Map<string, number>;
  byEndpoint: Map<string, number>;
  lastError: Date | null;
  recentErrors: ErrorRecord[];
}

interface ErrorRecord {
  timestamp: Date;
  endpoint: string;
  method: string;
  error: string;
  stack?: string;
  recovered: boolean;
}

export class ErrorBoundary extends EventEmitter {
  private stats: ErrorStats = {
    total: 0,
    byType: new Map(),
    byEndpoint: new Map(),
    lastError: null,
    recentErrors: []
  };
  
  private readonly MAX_RECENT_ERRORS = 100;
  private readonly ERROR_THRESHOLD = 10; // Errors per minute
  private errorWindow: number[] = [];
  
  constructor() {
    super();
    this.setupMonitoring();
  }
  
  private setupMonitoring(): void {
    // Clean up error window every minute
    setInterval(() => {
      const now = Date.now();
      this.errorWindow = this.errorWindow.filter(time => now - time < 60000);
      
      if (this.errorWindow.length > this.ERROR_THRESHOLD) {
        console.error(`⚠️ High error rate detected: ${this.errorWindow.length} errors/minute`);
        this.emit('highErrorRate', this.errorWindow.length);
      }
    }, 60000);
  }
  
  // Async route wrapper
  asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        this.handleError(error, req, res, next);
      });
    };
  }
  
  // Safe route wrapper with recovery
  safeRoute(fn: Function, options: { fallback?: any; critical?: boolean } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        this.handleError(error, req, res, next, options);
      }
    };
  }
  
  // Main error handler
  handleError(
    error: any,
    req: Request,
    res: Response,
    next: NextFunction,
    options: { fallback?: any; critical?: boolean } = {}
  ): void {
    // Record error
    this.recordError(error, req);
    
    // Determine error type and severity
    const errorType = this.classifyError(error);
    const isRecoverable = this.isRecoverable(errorType);
    
    // Log error appropriately
    if (options.critical || !isRecoverable) {
      console.error(`🚨 CRITICAL ERROR [${req.method} ${req.path}]:`, error);
    } else {
      console.error(`⚠️ ERROR [${req.method} ${req.path}]:`, error.message);
    }
    
    // Send appropriate response if not already sent
    if (!res.headersSent) {
      const statusCode = this.getStatusCode(error);
      const message = this.getErrorMessage(error, req);
      
      // Try to send error response
      try {
        if (options.fallback !== undefined) {
          res.status(200).json(options.fallback);
        } else {
          res.status(statusCode).json({
            error: true,
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
          });
        }
      } catch (responseError) {
        console.error('Failed to send error response:', responseError);
        // Last resort - end the response
        res.end();
      }
    }
    
    // Emit error event for monitoring
    this.emit('error', {
      error,
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip
      },
      recovered: !options.critical
    });
  }
  
  private recordError(error: any, req: Request): void {
    const now = Date.now();
    this.errorWindow.push(now);
    
    this.stats.total++;
    this.stats.lastError = new Date();
    
    // Track by type
    const errorType = error.constructor.name;
    this.stats.byType.set(errorType, (this.stats.byType.get(errorType) || 0) + 1);
    
    // Track by endpoint
    const endpoint = `${req.method} ${req.path}`;
    this.stats.byEndpoint.set(endpoint, (this.stats.byEndpoint.get(endpoint) || 0) + 1);
    
    // Add to recent errors
    const errorRecord: ErrorRecord = {
      timestamp: new Date(),
      endpoint,
      method: req.method,
      error: error.message,
      stack: error.stack,
      recovered: true
    };
    
    this.stats.recentErrors.unshift(errorRecord);
    if (this.stats.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.stats.recentErrors = this.stats.recentErrors.slice(0, this.MAX_RECENT_ERRORS);
    }
  }
  
  private classifyError(error: any): string {
    if (error.code === 'ECONNREFUSED') return 'connection';
    if (error.code === 'ETIMEDOUT') return 'timeout';
    if (error.code === 'ENOTFOUND') return 'dns';
    if (error.name === 'ValidationError') return 'validation';
    if (error.name === 'UnauthorizedError') return 'auth';
    if (error.name === 'CastError') return 'cast';
    if (error.statusCode >= 400 && error.statusCode < 500) return 'client';
    if (error.statusCode >= 500) return 'server';
    return 'unknown';
  }
  
  private isRecoverable(errorType: string): boolean {
    const recoverableTypes = ['validation', 'auth', 'client', 'cast', 'timeout'];
    return recoverableTypes.includes(errorType);
  }
  
  private getStatusCode(error: any): number {
    if (error.statusCode) return error.statusCode;
    if (error.status) return error.status;
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'CastError') return 400;
    return 500;
  }
  
  private getErrorMessage(error: any, req: Request): string {
    // User-friendly error messages
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'validation':
        return 'Invalid input data provided';
      case 'auth':
        return 'Authentication required';
      case 'timeout':
        return 'Request timed out, please try again';
      case 'connection':
        return 'Connection error, please try again later';
      case 'dns':
        return 'Service temporarily unavailable';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }
  
  // Express error middleware
  errorMiddleware() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      this.handleError(error, req, res, next);
    };
  }
  
  // Get error statistics
  getStats(): ErrorStats {
    return {
      ...this.stats,
      byType: new Map(this.stats.byType),
      byEndpoint: new Map(this.stats.byEndpoint),
      recentErrors: [...this.stats.recentErrors]
    };
  }
  
  // Clear statistics
  clearStats(): void {
    this.stats = {
      total: 0,
      byType: new Map(),
      byEndpoint: new Map(),
      lastError: null,
      recentErrors: []
    };
    this.errorWindow = [];
  }
}

// Global error boundary instance
export const errorBoundary = new ErrorBoundary();

// Convenience function for wrapping async routes
export function asyncWrapper(fn: Function) {
  return errorBoundary.asyncHandler(fn);
}

// Convenience function for safe routes with fallback
export function safeRoute(fn: Function, fallback?: any) {
  return errorBoundary.safeRoute(fn, { fallback });
}