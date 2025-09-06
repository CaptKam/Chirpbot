import { useAuth } from "@/hooks/useAuth";
import { Shield, LogOut, Users, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  // Check if current user is admin
  if (!isAuthenticated || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-300 mb-6">You need administrator privileges to access this admin panel.</p>
          <Link href="/">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Return to Main App
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    { path: "/admin-panel", icon: BarChart3, label: "Dashboard", exact: true },
    { path: "/admin-panel/users", icon: Users, label: "User Management" },
    { path: "/admin-panel/settings", icon: Settings, label: "System Settings" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Top Navigation Bar */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">ChirpBot Admin Panel</h1>
                  <p className="text-sm text-slate-300">User & System Management</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user.username}</p>
                <p className="text-xs text-slate-300">Administrator</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700/50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-800/30 backdrop-blur-sm border-r border-slate-700/50 min-h-[calc(100vh-80px)]">
          <nav className="p-6">
            <div className="space-y-2">
              {navItems.map(({ path, icon: Icon, label, exact }) => {
                const isActive = exact 
                  ? location === path 
                  : location.startsWith(path);
                
                return (
                  <Link key={path} href={path}>
                    <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                    }`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Quick Stats in Sidebar */}
          <div className="p-6 border-t border-slate-700/50 mt-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Quick Access
            </h3>
            <div className="space-y-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="w-full justify-start text-slate-300 hover:text-white">
                  Return to Main App
                </Button>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}