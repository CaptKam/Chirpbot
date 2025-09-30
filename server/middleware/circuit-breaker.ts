interface CircuitBreakerOptions {
  failureThreshold?: number;  // Number of failures before opening
  recoveryTimeout?: number;   // Ms to wait before trying half-open
  monitoringPeriod?: number;  // Ms window for counting failures
  requestTimeout?: number;    // Ms timeout for individual requests
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  successCount: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  stats: {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    lastStateChange: number;
  };
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 60000, // 1 minute
      requestTimeout: options.requestTimeout || 10000, // 10 seconds
    };
    
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
      state: 'CLOSED',
      stats: {
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        lastStateChange: Date.now()
      }
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.state.stats.totalRequests++;
    
    // Check if circuit should attempt recovery
    if (this.state.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
      
      if (timeSinceLastFailure > this.options.recoveryTimeout) {
        console.log(`🔄 Circuit breaker '${this.name}' attempting recovery (HALF_OPEN)`);
        this.changeState('HALF_OPEN');
      } else {
        // Circuit is still open
        const error = new Error(`Circuit breaker '${this.name}' is OPEN - service unavailable`);
        (error as any).isCircuitBreakerError = true;
        throw error;
      }
    }

    try {
      // Add timeout wrapper
      const result = await this.executeWithTimeout(fn);
      
      // Success - update state
      this.onSuccess();
      return result;
      
    } catch (error) {
      // Failure - update state
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => {
          const error = new Error(`Circuit breaker '${this.name}' request timeout after ${this.options.requestTimeout}ms`);
          (error as any).isTimeout = true;
          reject(error);
        }, this.options.requestTimeout)
      )
    ]);
  }

  private onSuccess(): void {
    this.state.stats.totalSuccesses++;
    
    if (this.state.state === 'HALF_OPEN') {
      // Successful in half-open state - close the circuit
      console.log(`✅ Circuit breaker '${this.name}' recovered (CLOSED)`);
      this.changeState('CLOSED');
      this.state.failures = 0;
      this.state.successCount = 0;
    } else if (this.state.state === 'CLOSED') {
      // Reset failure count after success in closed state
      this.state.failures = 0;
    }
  }

  private onFailure(): void {
    this.state.stats.totalFailures++;
    this.state.lastFailureTime = Date.now();
    this.state.failures++;
    
    if (this.state.state === 'HALF_OPEN') {
      // Failed in half-open state - reopen immediately
      console.log(`⚠️ Circuit breaker '${this.name}' recovery failed (OPEN)`);
      this.changeState('OPEN');
    } else if (this.state.state === 'CLOSED' && this.state.failures >= this.options.failureThreshold) {
      // Threshold exceeded - open the circuit
      console.log(`🔴 Circuit breaker '${this.name}' opened after ${this.state.failures} failures`);
      this.changeState('OPEN');
    }
  }

  private changeState(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    this.state.state = newState;
    this.state.stats.lastStateChange = Date.now();
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state.state,
      failures: this.state.failures,
      stats: this.state.stats,
      options: this.options
    };
  }

  // Force reset (for testing or manual recovery)
  reset(): void {
    console.log(`🔧 Circuit breaker '${this.name}' manually reset`);
    this.changeState('CLOSED');
    this.state.failures = 0;
    this.state.successCount = 0;
  }
}

// Create singleton instances for each external service
export const mlbApiCircuit = new CircuitBreaker('MLB_API', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  requestTimeout: 5000    // 5 seconds
});

export const espnApiCircuit = new CircuitBreaker('ESPN_API', {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  requestTimeout: 5000
});

export const weatherApiCircuit = new CircuitBreaker('WEATHER_API', {
  failureThreshold: 5,  // More tolerant for weather
  recoveryTimeout: 60000,
  requestTimeout: 3000
});

export const openaiApiCircuit = new CircuitBreaker('OPENAI_API', {
  failureThreshold: 3,  // Conservative for AI calls
  recoveryTimeout: 60000, // 1 minute recovery
  requestTimeout: 10000   // 10 seconds for AI responses
});

// Helper function to wrap fetch with circuit breaker
export async function protectedFetch(
  circuit: CircuitBreaker,
  url: string,
  options?: RequestInit
): Promise<Response> {
  return circuit.execute(async () => {
    const response = await fetch(url, options);
    
    // Consider 5xx errors as failures
    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  });
}