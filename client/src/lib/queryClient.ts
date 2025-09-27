import { QueryClient, QueryFunction } from "@tanstack/react-query";
import pRetry from "p-retry";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Enhanced retry configuration with exponential backoff
export interface RetryConfig {
  retries?: number;
  minTimeout?: number;
  factor?: number;
  maxTimeout?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

// Smart retry logic that handles network errors and 5xx server errors
export const shouldRetryError = (error: any): boolean => {
  // Network errors (fetch failures)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Parse status code from error message
  const statusMatch = error.message?.match(/^(\d{3}):/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);

    // Retry on 5xx server errors
    if (status >= 500) return true;

    // Retry on specific 4xx errors (Request Timeout, Too Many Requests)
    if (status === 408 || status === 429) return true;

    // Don't retry on other 4xx client errors
    if (status >= 400 && status < 500) return false;
  }

  // Default: retry on unknown errors
  return true;
};

// Default retry configuration following requirements
export const defaultRetryConfig: RetryConfig = {
  retries: 3,           // Maximum retry attempts
  minTimeout: 1000,     // Initial delay: 1000ms (1 second)
  factor: 2,            // Exponential backoff multiplier: 2x
  maxTimeout: 10000,    // Maximum delay: 10 seconds
  shouldRetry: shouldRetryError,
};

// Enhanced apiRequest with retry logic
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryConfig?: RetryConfig,
): Promise<Response> {
  const config = { ...defaultRetryConfig, ...retryConfig };

  return pRetry(async () => {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  }, {
    retries: config.retries,
    minTimeout: config.minTimeout,
    factor: config.factor,
    maxTimeout: config.maxTimeout,
    onFailedAttempt: (error) => {
      if (!config.shouldRetry?.(error)) {
        throw error; // Don't retry if shouldRetry returns false
      }
      if (config.onRetry) {
        config.onRetry(error.attemptNumber, error);
      }
    }
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Enhanced query function with retry logic
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  retryConfig?: RetryConfig;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, retryConfig }) =>
  async ({ queryKey }) => {
    const config = { ...defaultRetryConfig, ...retryConfig };

    return pRetry(async () => {
      // Extract base URL and query parameters
      const baseUrl = queryKey[0] as string;
      const queryParams = queryKey[1] as Record<string, any> || {};

      // Construct URL with query parameters
      const url = new URL(baseUrl, window.location.origin);
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });

      const res = await fetch(url.toString(), {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    }, {
      retries: config.retries,
      minTimeout: config.minTimeout,
      factor: config.factor,
      maxTimeout: config.maxTimeout,
      onFailedAttempt: (error) => {
        if (!config.shouldRetry?.(error)) {
          throw error; // Don't retry if shouldRetry returns false
        }
        if (config.onRetry) {
          config.onRetry(error.attemptNumber, error);
        }
      }
    });
  };

// NOTE: createRetryFunction and createRetryDelay removed as they're no longer needed
// All retry logic is now handled by p-retry in apiRequest/getQueryFn functions

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Avoid unnecessary refetches in production
      staleTime: 30000, // 30 seconds - good balance of freshness and performance
      gcTime: 5 * 60 * 1000, // 5 minutes - reasonable cache retention
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 0, // Disable React Query retries - p-retry handles all retry logic
      retryDelay: undefined, // No retry delay needed since retry is disabled
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    },
  },
});