import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Shield, 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  BarChart3, 
  UserCheck, 
  UserX, 
  Crown,
  Briefcase,
  Search,
  ChevronRight,
  Target,
  Trophy,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Alert configuration from settings.tsx
const ALERT_TYPE_CONFIG = {
  MLB: {
    "Probability Engine": [
      { key: "RISP_CHANCE", label: "RISP Probability", description: "Advanced RISP scoring probability with RE24 calculations" },
      { key: "SCORING_PROBABILITY", label: "High Scoring Probability", description: "Situations with 100%+ run expectancy" },
      { key: "CLOSE_GAME_LATE", label: "Close Game Late", description: "7th inning+ within one run (probability-based)" },
      { key: "LATE_PRESSURE", label: "Late Pressure", description: "8th+ inning pressure situations (RE24 enhanced)" },
      { key: "NINTH_TIE", label: "Ninth Inning Tie", description: "Maximum pressure tie games in 9th+ innings" },
    ],
    "Weather & Power": [
      { key: "WIND_JETSTREAM", label: "Wind Assist", description: "Tailwind conditions favoring home runs" },
      { key: "HR_HITTER_AT_BAT", label: "Power Hitter Up", description: "High-power batter with HR potential" },
    ],
    "Legacy Alerts": [
      { key: "RISP", label: "RISP (Legacy)", description: "Basic runners in scoring position alerts" },
      { key: "BASES_LOADED", label: "Bases Loaded (Legacy)", description: "Simple bases loaded detection" },
      { key: "RUNNERS_1ST_2ND", label: "Runners 1st & 2nd (Legacy)", description: "Basic 1st & 2nd base alerts" },
      { key: "CLOSE_GAME", label: "Close Game (Legacy)", description: "Basic close game detection" },
      { key: "CLOSE_GAME_LIVE", label: "Live Close Game (Legacy)", description: "Basic real-time close games" },
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

export default function Admin() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>("MLB");
  const { toast } = useToast();
  const { user: currentUser, isAuthenticated } = useAuth();

  // Redirect to web admin panel
  if (isAuthenticated && currentUser && currentUser.role === 'admin') {
    window.location.href = '/admin-panel';
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Redirecting to Admin Panel</h1>
          <p className="text-slate-400">Please wait while we redirect you to the web admin interface...</p>
        </div>
      </div>
    );
  }

  // Access denied for non-admin users
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
      <div className="text-center">
        <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h1>
        <p className="text-slate-400">You need admin privileges to access this page.</p>
      </div>
    </div>
  );

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
  });

  // Fetch user alert preferences when user is selected
  const { data: userAlertPreferences, isLoading: preferencesLoading } = useQuery({
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
      case 'admin': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'manager': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'analyst': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Game Situations":
        return <Target className="w-4 h-4 text-emerald-400" />;
      case "Scoring Events":
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case "At-Bat Situations":
        return <Clock className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  if (usersLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-yellow-500/20 ring-1 ring-yellow-500/30 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Admin Dashboard</h1>
            <p className="text-yellow-300/80 text-xs font-medium">User & Permission Management</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-slate-100">{(stats as any)?.users?.total || 0}</p>
                <p className="text-xs text-slate-400">Total Users</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Bell className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-slate-100">{(stats as any)?.alerts?.today || 0}</p>
                <p className="text-xs text-slate-400">Today's Alerts</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Role Distribution */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
            Role Distribution
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-slate-300">Admins</span>
              </div>
              <span className="text-lg font-bold text-slate-100">{(stats as any)?.users?.admins || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-300">Managers</span>
              </div>
              <span className="text-lg font-bold text-slate-100">{(stats as any)?.users?.managers || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-300">Analysts</span>
              </div>
              <span className="text-lg font-bold text-slate-100">{(stats as any)?.users?.analysts || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Users</span>
              </div>
              <span className="text-lg font-bold text-slate-100">{(stats as any)?.users?.regular || 0}</span>
            </div>
          </div>
        </Card>

        {/* Users Management */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
            User Management
          </h2>
          <div className="space-y-3">
            {(users as User[] || []).map((user: User) => (
              <div 
                key={user.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => handleUserClick(user)}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(user.role)}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">{user.username}</h4>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                      {user.role.toUpperCase()}
                    </Badge>
                    {user.telegramEnabled && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        TELEGRAM
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                    <SelectTrigger className="w-32 h-8 bg-white/10 border-white/20 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedUser && getRoleIcon(selectedUser.role)}
              <span>Manage User: {selectedUser?.username}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <h3 className="text-md font-bold text-slate-100 mb-3">User Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-100 ml-2">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Role:</span>
                    <Badge className={`ml-2 ${getRoleBadgeColor(selectedUser.role)}`}>
                      {selectedUser.role.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400">Auth Method:</span>
                    <span className="text-slate-100 ml-2">{selectedUser.authMethod}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Telegram:</span>
                    <span className={`ml-2 ${selectedUser.telegramEnabled ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedUser.telegramEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Alert Preferences Management */}
              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-bold text-slate-100">Alert Preferences</h3>
                  <Select value={selectedSport} onValueChange={setSelectedSport}>
                    <SelectTrigger className="w-32 bg-white/10 border-white/20 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="MLB">MLB</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="NHL">NHL</SelectItem>
                      <SelectItem value="CFL">CFL</SelectItem>
                      <SelectItem value="NCAAF">NCAAF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {preferencesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG] ? (
                      Object.entries(ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG]).map(([category, alerts]) => (
                        <div key={category} className="space-y-3">
                          <div className="flex items-center space-x-2">
                            {getCategoryIcon(category)}
                            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                              {category}
                            </h4>
                          </div>
                          <div className="space-y-2 ml-6">
                            {alerts.map((alert) => {
                              const preference = (userAlertPreferences as any[] || []).find((p: any) => 
                                p.alertType === alert.key && p.sport === selectedSport
                              );
                              const isEnabled = preference?.enabled ?? true;
                              
                              return (
                                <div key={alert.key} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                                  <div className="flex-1">
                                    <h5 className="text-xs font-semibold text-slate-100">{alert.label}</h5>
                                    <p className="text-xs text-slate-400">{alert.description}</p>
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
                                    className="data-[state=checked]:bg-emerald-500"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {Object.keys(ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG]).indexOf(category) < 
                           Object.keys(ALERT_TYPE_CONFIG[selectedSport as keyof typeof ALERT_TYPE_CONFIG]).length - 1 && (
                            <Separator className="bg-white/10 my-3" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-400 text-sm">No alert types configured for {selectedSport} yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}