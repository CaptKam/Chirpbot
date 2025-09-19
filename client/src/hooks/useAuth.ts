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
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoading = userLoading || adminLoading;
  const isAdminSession = adminAuth?.authenticated === true;
  const isUserSession = !!user;
  
  return {
    user,
    isLoading,
    isAuthenticated: isUserSession,
    isAdmin: user?.role === 'admin',
    isAdminSession, // NEW: Detects admin-only sessions
    error: userError,
  };
}