import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Bell, 
  Crown,
  Briefcase,
  BarChart3,
  Search,
  Edit,
  Settings as SettingsIcon,
  Target,
  Trophy,
  Clock,
  Mail,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Alert configuration
const ALERT_TYPE_CONFIG = {
  MLB: {
    "Game Situations": [
      { key: "RISP", label: "RISP (Runners in Scoring Position)", description: "Alert when runners are on 2nd or 3rd base" },
      { key: "BASES_LOADED", label: "Bases Loaded", description: "Alert when all three bases are occupied" },
      { key: "RUNNERS_1ST_2ND", label: "Runners on 1st & 2nd", description: "Prime scoring opportunity alert" },
      { key: "CLOSE_GAME", label: "Close Game", description: "Games with score difference ≤ 3 runs" },
      { key: "CLOSE_GAME_LIVE", label: "Live Close Game", description: "Real-time close game situations" },
      { key: "LATE_PRESSURE", label: "Late Inning Pressure", description: "8th inning or later with close score" },
    ],
    "Scoring Events": [
      { key: "HOME_RUN_LIVE", label: "Home Run (Live)", description: "Real-time home run alerts as they happen" },
      { key: "HIGH_SCORING", label: "High-Scoring Game", description: "Games with 12+ total runs" },
      { key: "SHUTOUT", label: "Shutout Alert", description: "When a team gets shut out (0 runs)" },
      { key: "BLOWOUT", label: "Blowout Game", description: "Games with 7+ run difference" },
    ],
    "At-Bat Situations": [
      { key: "FULL_COUNT", label: "Full Count (3-2)", description: "Maximum pressure at-bat situations" },
    ]
  },
  NFL: {
    "Game Situations": [
      { key: "RED_ZONE", label: "Red Zone Situations", description: "Team inside the 20-yard line" },
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "FOURTH_DOWN", label: "Fourth Down", description: "Critical 4th down conversion attempts" },
      { key: "TWO_MINUTE_WARNING", label: "Two Minute Warning", description: "End-of-half pressure situations" },
    ]
  },
  NBA: {
    "Game Situations": [
      { key: "CLUTCH_TIME", label: "Clutch Time", description: "Final 5 minutes with close score" },
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "OVERTIME", label: "Overtime", description: "Games going to overtime" },
    ]
  },
  NHL: {
    "Game Situations": [
      { key: "POWER_PLAY", label: "Power Play", description: "Man advantage situations" },
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "EMPTY_NET", label: "Empty Net", description: "Goalie pulled situations" },
    ]
  },
  CFL: {
    "Game Situations": [
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "FOURTH_DOWN", label: "Third Down (CFL)", description: "Critical down conversion attempts" },
    ]
  },
  NCAAF: {
    "Game Situations": [
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "FOURTH_DOWN", label: "Fourth Down", description: "Critical conversion attempts" },
      { key: "TWO_MINUTE_WARNING", label: "Two Minute Warning", description: "End-of-quarter/half pressure situations" },
    ]
  }
};

type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  telegramEnabled: boolean;
  authMethod: string;
};

export default function AdminPanel() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>("MLB");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
  });

  // Fetch user alert preferences when user is selected
  const { data: userAlertPreferences } = useQuery({
    queryKey: [`/api/admin/users/${selectedUser?.id}/alert-preferences`],
    enabled: !!selectedUser?.id,
  });

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
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

  // Alert preferences update mutation
  const updateAlertPreferencesMutation = useMutation({
    mutationFn: async ({ userId, sport, preferences }: { userId: string; sport: string; preferences: any[] }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/alert-preferences`, {
        sport,
        preferences
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${selectedUser?.id}/alert-preferences`] });
      toast({
        title: "Alert preferences updated",
        description: "User alert preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'manager': return <Briefcase className="w-4 h-4 text-blue-400" />;
      case 'analyst': return <BarChart3 className="w-4 h-4 text-purple-400" />;
      default: return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'manager': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'analyst': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Game Situations": return <Target className="w-4 h-4 text-emerald-400" />;
      case "Scoring Events": return <Trophy className="w-4 h-4 text-yellow-400" />;
      case "At-Bat Situations": return <Clock className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredUsers = (users as User[] || []).filter(user =>
    (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (usersLoading || statsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-300">Loading admin dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
          <p className="text-slate-300">Monitor system statistics and manage user access</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Users</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{(stats as any)?.users?.total || 0}</div>
              <p className="text-xs text-slate-400">
                Registered accounts
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Admins</CardTitle>
              <Crown className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{(stats as any)?.users?.admins || 0}</div>
              <p className="text-xs text-slate-400">
                Administrator accounts
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Today's Alerts</CardTitle>
              <Bell className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{(stats as any)?.alerts?.today || 0}</div>
              <p className="text-xs text-slate-400">
                Generated today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Alerts</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{(stats as any)?.alerts?.total || 0}</div>
              <p className="text-xs text-slate-400">
                All time alerts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Management Section */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-white">User Management</CardTitle>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Users Table Header */}
              <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-slate-700/50 rounded-lg text-sm font-medium text-slate-300">
                <div>User</div>
                <div>Email</div>
                <div>Role</div>
                <div>Auth Method</div>
                <div>Telegram</div>
                <div>Actions</div>
              </div>

              {/* Users Table */}
              <div className="space-y-2">
                {filteredUsers.map((user: User) => (
                  <div 
                    key={user.id}
                    className="grid grid-cols-6 gap-4 px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-700/50"
                  >
                    <div className="flex items-center space-x-3">
                      {getRoleIcon(user.role)}
                      <div>
                        <p className="font-medium text-white">{user.username}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{user.email}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-slate-300 capitalize">{user.authMethod}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <Badge 
                        className={user.telegramEnabled 
                          ? "bg-green-500/20 text-green-300 border-green-500/30" 
                          : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                        }
                      >
                        {user.telegramEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                        <SelectTrigger className="w-32 h-8 bg-slate-600 border-slate-500 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="analyst">Analyst</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => handleUserClick(user)}
                        size="sm"
                        variant="ghost"
                        className="text-slate-300 hover:text-white hover:bg-slate-600"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl">
              {selectedUser && getRoleIcon(selectedUser.role)}
              <span>Manage User: {selectedUser?.username}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">User Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-slate-400">Username</label>
                        <p className="text-white font-medium">{selectedUser.username}</p>
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">Email</label>
                        <p className="text-white">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-slate-400">Role</label>
                        <div className="mt-1">
                          <Badge className={getRoleBadgeColor(selectedUser.role)}>
                            {selectedUser.role.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">Authentication</label>
                        <p className="text-white capitalize">{selectedUser.authMethod}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alert Preferences Management */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white">Alert Preferences</CardTitle>
                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                      <SelectTrigger className="w-40 bg-slate-600 border-slate-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="MLB">MLB</SelectItem>
                        <SelectItem value="NFL">NFL</SelectItem>
                        <SelectItem value="NBA">NBA</SelectItem>
                        <SelectItem value="NHL">NHL</SelectItem>
                        <SelectItem value="CFL">CFL</SelectItem>
                        <SelectItem value="NCAAF">NCAAF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG] ? (
                      Object.entries(ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG]).map(([category, alerts]) => (
                        <div key={category} className="space-y-4">
                          <div className="flex items-center space-x-2 pb-2 border-b border-slate-600">
                            {getCategoryIcon(category)}
                            <h4 className="text-lg font-semibold text-white">{category}</h4>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {alerts.map((alert) => {
                              const preference = (userAlertPreferences as any[] || []).find((p: any) => 
                                p.alertType === alert.key && p.sport === selectedSport
                              );
                              const isEnabled = preference?.enabled ?? true;
                              
                              return (
                                <div key={alert.key} className="flex items-center justify-between p-4 bg-slate-600/50 rounded-lg border border-slate-600">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-white">{alert.label}</h5>
                                    <p className="text-sm text-slate-400 mt-1">{alert.description}</p>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={(enabled) => {
                                      const updatedPreferences = alerts.map(a => ({
                                        alertType: a.key,
                                        enabled: a.key === alert.key ? enabled : 
                                          (userAlertPreferences as any[] || []).find((p: any) => p.alertType === a.key && p.sport === selectedSport)?.enabled ?? true
                                      }));
                                      updateAlertPreferencesMutation.mutate({
                                        userId: selectedUser.id,
                                        sport: selectedSport,
                                        preferences: updatedPreferences
                                      });
                                    }}
                                    disabled={updateAlertPreferencesMutation.isPending}
                                    className="data-[state=checked]:bg-blue-600"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-400">No alert types configured for {selectedSport} yet.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}