import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'If-None-Match': ''
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: 'no-store'
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
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
    
    // Add timestamp to prevent 304 responses
    url.searchParams.set('_ts', Date.now().toString());
    
    const res = await fetch(url.toString(), {
      credentials: "include",
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'If-None-Match': ''
      }
    });
    
    // Force refetch by invalidating cache if 304 received - should not happen with our cache headers
    if (res.status === 304) {
      // 304 should not happen with our cache-busting headers - force refetch
      console.warn('304 response received despite cache-busting headers, forcing refetch');
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      // Return stale data to avoid error state
      const cachedData = queryClient.getQueryData(queryKey);
      return cachedData;
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Avoid unnecessary refetches in production
      staleTime: 30000, // Data fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    },
  },
});
