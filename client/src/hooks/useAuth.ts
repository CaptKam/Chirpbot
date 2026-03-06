import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
}

interface AdminAuth {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export function useAuth() {
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          return null; // Not authenticated
        }
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isUserSession = !!user;
  const isAdminRole = user?.role === 'admin';

  // Only check admin session if user is NOT already authenticated as a regular user.
  // This prevents unnecessary /api/admin-auth/verify calls (and loading flicker) for regular users.
  const { data: adminAuth, isLoading: adminLoading } = useQuery<AdminAuth>({
    queryKey: ["/api/admin-auth/verify"],
    queryFn: async () => {
      const response = await fetch("/api/admin-auth/verify", {
        credentials: "include",
      });
      if (!response.ok) {
        return { authenticated: false };
      }
      return response.json();
    },
    enabled: !userLoading && !isUserSession, // Only check if no user session found
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Regular users: loading only depends on user query. Admin-only sessions: wait for both.
  const isLoading = userLoading || (!isUserSession && adminLoading);
  const isAdminSession = adminAuth?.authenticated === true;
  
  return {
    user,
    isLoading,
    isAuthenticated: isUserSession,
    isAdmin: isAdminRole,
    isAdminSession, // NEW: Detects admin-only sessions
    error: userError,
  };
}