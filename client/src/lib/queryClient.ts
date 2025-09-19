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
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    // Handle 401s by clearing auth state and redirecting
    handle401Error();
    throw new Error("401: Unauthorized");
  }

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
    
    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      } else {
        handle401Error();
        throw new Error("401: Unauthorized");
      }
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

// Global 401 handler - defined after queryClient to avoid circular dependency
function handle401Error() {
  // Clear auth state
  queryClient.setQueryData(["/api/auth/user"], null);
  // Redirect to login
  window.location.href = "/login";
}
