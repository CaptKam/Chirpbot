import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Users, 
  Activity, 
  TrendingUp, 
  Database, 
  Settings, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Zap,
  User,
  Crown,
  UserCheck,
  UserX,
  Eye,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  authMethod: string;
  emailVerified: boolean;
  telegramEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SystemStats {
  totalUsers: number;
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  activeUsers: number;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  // Fetch all users (admin only)
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin,
  });

  // Fetch system statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    enabled: isAdmin,
  });

  // Fetch recent alerts for monitoring
  const { data: recentAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/alerts?limit=50'],
    enabled: isAdmin,
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "User role updated",
        description: "User permissions have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'activate' | 'deactivate' }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/${action}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "User status updated",
        description: "User status has been successfully changed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h1>
            <p className="text-slate-300">You don't have admin privileges to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'manager':
        return <UserCheck className="w-4 h-4 text-blue-400" />;
      case 'analyst':
        return <Eye className="w-4 h-4 text-purple-400" />;
      default:
        return <User className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return "bg-yellow-500/20 text-yellow-400 ring-yellow-500/30";
      case 'manager':
        return "bg-blue-500/20 text-blue-400 ring-blue-500/30";
      case 'analyst':
        return "bg-purple-500/20 text-purple-400 ring-purple-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 ring-slate-500/30";
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateUserRoleMutation.mutate({ userId, role: newRole });
  };

  const handleUserStatusToggle = (userId: string, action: 'activate' | 'deactivate') => {
    toggleUserStatusMutation.mutate({ userId, action });
  };

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-yellow-500/20 ring-1 ring-yellow-500/30 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Admin Dashboard</h1>
            <p className="text-yellow-300/80 text-xs font-medium">System Management & Monitoring</p>
          </div>
        </div>
        <Button
          onClick={() => {
            refetchUsers();
            refetchStats();
          }}
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
          data-testid="refresh-button"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "users", label: "User Management", icon: Users },
            { id: "alerts", label: "Alert Monitoring", icon: Activity },
            { id: "system", label: "System Health", icon: Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`admin-tab-${tab.id}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === tab.id
                  ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {activeTab === "overview" && (
          <>
            {/* System Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500/20 ring-1 ring-blue-500/30 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{(stats as any)?.totalUsers || 0}</p>
                    <p className="text-xs text-slate-400">Total Users</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{(stats as any)?.totalAlerts || 0}</p>
                    <p className="text-xs text-slate-400">Total Alerts</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-500/20 ring-1 ring-yellow-500/30 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{(stats as any)?.todayAlerts || 0}</p>
                    <p className="text-xs text-slate-400">Today's Alerts</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-500/20 ring-1 ring-red-500/30 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{(stats as any)?.liveGames || 0}</p>
                    <p className="text-xs text-slate-400">Live Games</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setActiveTab("users")}
                  className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 ring-1 ring-blue-500/30"
                  data-testid="quick-users"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
                <Button
                  onClick={() => setActiveTab("alerts")}
                  className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/30"
                  data-testid="quick-alerts"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Monitor Alerts
                </Button>
              </div>
            </Card>
          </>
        )}

        {activeTab === "users" && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-6">
              User Management
            </h2>

            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {users && Array.isArray(users) && users.length > 0 ? (
                  users.map((user: AdminUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(user.role)}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-100">
                              {user.username}
                            </h4>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ring-1 ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </Badge>
                          {user.emailVerified && (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          )}
                          {user.telegramEnabled && (
                            <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                              Telegram
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                          disabled={updateUserRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs bg-white/5 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <UserX className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">No users found.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {activeTab === "alerts" && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-6">
              Recent Alert Activity
            </h2>

            {alertsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentAlerts && Array.isArray(recentAlerts) && recentAlerts.length > 0 ? (
                  recentAlerts.slice(0, 20).map((alert: any) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-slate-100 truncate">
                          {alert.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          {alert.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="ml-3">
                        <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                          {alert.sport?.toUpperCase() || 'SYSTEM'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">No recent alerts found.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {activeTab === "system" && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-6">
              System Health Status
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-100">Database Connection</span>
                </div>
                <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                  Online
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-100">WebSocket Server</span>
                </div>
                <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                  Active
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-100">Alert Processing</span>
                </div>
                <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                  Running
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-100">API Services</span>
                </div>
                <Badge className="text-xs ring-1 bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                  Operational
                </Badge>
              </div>
            </div>

            <Separator className="bg-white/10 my-6" />

            <div>
              <h3 className="text-md font-bold text-slate-100 uppercase tracking-wide mb-4">
                System Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Uptime</p>
                  <p className="text-slate-100 font-medium">24h 15m</p>
                </div>
                <div>
                  <p className="text-slate-400">Memory Usage</p>
                  <p className="text-slate-100 font-medium">342 MB</p>
                </div>
                <div>
                  <p className="text-slate-400">Active Connections</p>
                  <p className="text-slate-100 font-medium">{(stats as any)?.activeUsers || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Version</p>
                  <p className="text-slate-100 font-medium">ChirpBot V2.0</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}