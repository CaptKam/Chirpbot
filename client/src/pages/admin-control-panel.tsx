import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Users, 
  Settings as SettingsIcon, 
  BarChart3, 
  ChevronDown, 
  ChevronUp,
  Zap,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

const ALERT_TYPE_CONFIG = {
  MLB: [
    // === GAME SITUATION ALERTS ===
    { key: "risp", label: "RISP (Runners in Scoring Position)", description: "2nd/3rd base situations", category: "Game Situations" },
    { key: "basesLoaded", label: "Bases Loaded", description: "Maximum scoring opportunity - all bases occupied", category: "Game Situations" },
    { key: "runnersOnBase", label: "Runners on Base", description: "Any base runner situations", category: "Game Situations" },
    { key: "closeGame", label: "Close Game", description: "1-run games in late innings", category: "Game Situations" },
    { key: "lateInning", label: "Late Inning Pressure", description: "8th+ inning crucial moments", category: "Game Situations" },
    { key: "extraInnings", label: "Extra Innings", description: "Game extends beyond 9th inning", category: "Game Situations" },
    
    // === SCORING & HITTING ALERTS ===
    { key: "homeRun", label: "Home Run Situations", description: "High home run probability moments", category: "Scoring Events" },
    { key: "homeRunAlert", label: "Home Run Alerts", description: "Actual home run notifications", category: "Scoring Events" },
    { key: "hits", label: "Hit Alerts", description: "Base hit notifications", category: "Scoring Events" },
    { key: "scoring", label: "Scoring Plays", description: "RBI and run-scoring events", category: "Scoring Events" },
    
    // === PLAYER PERFORMANCE ALERTS ===
    { key: "starBatter", label: "Star Batter Alert", description: ".300+ AVG, 20+ HR, or .900+ OPS hitters", category: "Player Performance" },
    { key: "powerHitter", label: "Power Hitter Alert", description: "25+ HR sluggers with runners on base", category: "Player Performance" },
    { key: "eliteClutch", label: "Elite Clutch Hitter", description: "High OPS batters in pressure situations", category: "Player Performance" },
    { key: "avgHitter", label: ".300+ Hitter Alert", description: "Premium contact hitters at bat", category: "Player Performance" },
    { key: "rbiMachine", label: "RBI Machine Alert", description: "80+ RBI producers with scoring chances", category: "Player Performance" },
    { key: "strikeouts", label: "Strikeout Alerts", description: "Pitcher strikeout notifications", category: "Player Performance" },
    
    // === ADVANCED PREDICTION SYSTEM ===
    { key: "Home Run Prediction", label: "🚀 HR Probability Model", description: "Mathematical home run prediction using logistic regression + weather physics", category: "AI Predictions" },
    { key: "Walk-off Prediction", label: "🎯 Walk-off Situation", description: "Game-ending opportunity prediction with context analysis", category: "AI Predictions" },
    { key: "Clutch Hit Prediction", label: "⚡ Clutch Performance", description: "AI-powered clutch hitting opportunity detection", category: "AI Predictions" },
    { key: "Hot Streak Prediction", label: "🔥 Hot Streak Alert", description: "Player momentum and hot streak identification", category: "AI Predictions" },
    { key: "Double Play Prediction", label: "⚾ Double Play Risk", description: "Situation analysis for potential double plays", category: "AI Predictions" },
    { key: "Stolen Base Prediction", label: "💨 Steal Opportunity", description: "Base stealing probability and timing analysis", category: "AI Predictions" },
    
    // === WEATHER PHYSICS SYSTEM ===
    { key: "Weather Home Run Boost", label: "🌬️ Weather HR Boost", description: "Wind and air density effects on home run probability", category: "Weather Physics" },
    { key: "Weather Pitching Advantage", label: "🌡️ Pitching Weather Edge", description: "Temperature and humidity effects on pitcher performance", category: "Weather Physics" },
    
    // === SPECIAL EVENTS ===
    { key: "noHitter", label: "No-Hitter Watch", description: "Potential no-hitter in progress", category: "Special Events" },
    { key: "perfectGame", label: "Perfect Game Watch", description: "Perfect game opportunity tracking", category: "Special Events" },
    { key: "cycle", label: "Cycle Watch", description: "Player pursuing hitting for the cycle", category: "Special Events" },
    { key: "specialPlay", label: "Special Plays", description: "Rare and exceptional baseball plays", category: "Special Events" },
    
    // === GAME FLOW ===
    { key: "inningChange", label: "Inning Changes", description: "New inning momentum shifts", category: "Game Flow" },
    
    // === ADVANCED ANALYTICS ===
    { key: "re24Advanced", label: "RE24 Advanced Analytics", description: "MLB Run Expectancy 24 (RE24) mathematical analysis system", category: "Advanced Analytics" },
    { key: "mlbAIEnabled", label: "🧠 AI Analysis Engine", description: "Advanced AI context analysis for all alerts", category: "Advanced Analytics" },
  ],
  NFL: [
    { key: "redZone", label: "Red Zone Situations", description: "Team driving inside the 20-yard line", category: "Scoring Opportunities" },
    { key: "nflCloseGame", label: "NFL Close Game", description: "One-score games in final quarter", category: "Game Situations" },
    { key: "fourthDown", label: "Fourth Down", description: "Critical fourth down decisions", category: "Critical Plays" },
    { key: "twoMinuteWarning", label: "Two Minute Warning", description: "Game-deciding final drives", category: "Game Situations" },
  ],
  NBA: [
    { key: "clutchTime", label: "Clutch Time", description: "Final 2 minutes of close games", category: "Game Situations" },
    { key: "nbaCloseGame", label: "NBA Close Game", description: "Single-digit games in 4th quarter", category: "Game Situations" },
    { key: "overtime", label: "Overtime", description: "Extra period situations", category: "Special Events" },
  ],
  NHL: [
    { key: "powerPlay", label: "Power Play", description: "Man advantage situations", category: "Special Situations" },
    { key: "nhlCloseGame", label: "NHL Close Game", description: "One-goal games in final period", category: "Game Situations" },
    { key: "emptyNet", label: "Empty Net", description: "Goalie pulled for extra attacker", category: "Special Situations" },
  ],
};

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  settings: {
    [sport: string]: any;
  };
}

interface BulkUpdateState {
  selectedUsers: Set<string>;
  selectedSport: string;
  selectedAlerts: Set<string>;
  isUpdating: boolean;
}

export default function AdminControlPanel() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Game Situations", "AI Predictions"]));
  const [bulkUpdate, setBulkUpdate] = useState<BulkUpdateState>({
    selectedUsers: new Set(),
    selectedSport: "MLB",
    selectedAlerts: new Set(),
    isUpdating: false
  });
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Check admin access
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md bg-red-900/20 border-red-500/20">
            <CardHeader>
              <div className="flex items-center space-x-2 text-red-400">
                <Shield className="w-5 h-5" />
                <CardTitle>Access Denied</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-red-300">Admin privileges required to access this control panel.</p>
              <div className="mt-4">
                <Link to="/">
                  <Button variant="outline" size="sm">
                    Return Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch all users and their settings
  const { data: usersData, isLoading } = useQuery<{users: AdminUser[]}>({
    queryKey: ["/api/admin/settings/all"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settings/all`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users data");
      return response.json();
    },
  });

  // Fetch alert statistics
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/settings/stats"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settings/stats`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { userIds: string[]; sport: string; updates: any }) => {
      const response = await apiRequest("POST", `/api/admin/settings/bulk-update`, updates);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/stats"] });
      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${data.summary.successful}/${data.summary.total} users.`,
      });
      setBulkUpdate(prev => ({ ...prev, selectedUsers: new Set(), selectedAlerts: new Set(), isUpdating: false }));
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to perform bulk update. Please try again.",
        variant: "destructive",
      });
      setBulkUpdate(prev => ({ ...prev, isUpdating: false }));
    },
  });

  const handleUserToggle = (userId: string) => {
    setBulkUpdate(prev => {
      const newSelected = new Set(prev.selectedUsers);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return { ...prev, selectedUsers: newSelected };
    });
  };

  const handleAlertToggle = (alertKey: string) => {
    setBulkUpdate(prev => {
      const newSelected = new Set(prev.selectedAlerts);
      if (newSelected.has(alertKey)) {
        newSelected.delete(alertKey);
      } else {
        newSelected.add(alertKey);
      }
      return { ...prev, selectedAlerts: newSelected };
    });
  };

  const handleBulkUpdate = () => {
    if (bulkUpdate.selectedUsers.size === 0 || bulkUpdate.selectedAlerts.size === 0) {
      toast({
        title: "Selection Required",
        description: "Please select users and alert types for bulk update.",
        variant: "destructive",
      });
      return;
    }

    const alertUpdates = {};
    bulkUpdate.selectedAlerts.forEach(alertKey => {
      alertUpdates[alertKey] = true; // Enable selected alerts
    });

    setBulkUpdate(prev => ({ ...prev, isUpdating: true }));
    bulkUpdateMutation.mutate({
      userIds: Array.from(bulkUpdate.selectedUsers),
      sport: bulkUpdate.selectedSport,
      updates: { alertTypes: alertUpdates }
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const filteredUsers = usersData?.users?.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const alertTypesByCategory = ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]?.reduce((acc: Record<string, any[]>, alertType: any) => {
    if (!acc[alertType.category]) acc[alertType.category] = [];
    acc[alertType.category].push(alertType);
    return acc;
  }, {} as Record<string, any[]>) || {};

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-500/20 ring-1 ring-red-500/30 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Admin Control Panel</h1>
            <p className="text-red-300/80 text-xs font-medium">Alert Settings Management</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-red-400 border-red-400/30">
            Admin: {user?.username}
          </Badge>
          <Link to="/settings">
            <Button variant="ghost" size="sm">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {stats?.totalUsers || filteredUsers.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {stats?.totalAlerts || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Enabled Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {stats?.enabledAlerts || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {stats?.totalAlerts ? Math.round((stats.enabledAlerts / stats.totalAlerts) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10">
              <Users className="w-4 h-4 mr-2" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="bulk" className="data-[state=active]:bg-white/10">
              <Zap className="w-4 h-4 mr-2" />
              Bulk Operations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-white/10">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Settings Management</CardTitle>
                    <CardDescription className="text-slate-400">
                      View and manage alert settings for all users
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading users...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUsers.map((adminUser) => (
                      <Card key={adminUser.id} className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{adminUser.username}</CardTitle>
                              <CardDescription>{adminUser.email} • Role: {adminUser.role}</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                              {Object.keys(adminUser.settings).filter(sport => adminUser.settings[sport]).length} Sports
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {SPORTS.map((sport) => {
                              const sportSettings = adminUser.settings[sport];
                              const enabledCount = sportSettings?.alertTypes 
                                ? Object.values(sportSettings.alertTypes).filter(Boolean).length 
                                : 0;
                              const totalCount = sportSettings?.alertTypes 
                                ? Object.keys(sportSettings.alertTypes).length 
                                : 0;
                              
                              return (
                                <div key={sport} className="text-center p-3 bg-white/5 rounded-lg">
                                  <div className="font-bold text-sm text-slate-300">{sport}</div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {enabledCount}/{totalCount} alerts
                                  </div>
                                  <div className="mt-2">
                                    {sportSettings ? (
                                      <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
                                        Active
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-gray-400 border-gray-400/30 text-xs">
                                        Not Set
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Operations Tab */}
          <TabsContent value="bulk" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Bulk Alert Operations</CardTitle>
                <CardDescription className="text-slate-400">
                  Enable alert types for multiple users at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sport Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-300">Select Sport</Label>
                  <Select value={bulkUpdate.selectedSport} onValueChange={(value) => 
                    setBulkUpdate(prev => ({ ...prev, selectedSport: value }))
                  }>
                    <SelectTrigger className="bg-white/5 border-white/10 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPORTS.map((sport) => (
                        <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-300">Select Users ({bulkUpdate.selectedUsers.size} selected)</Label>
                  <Card className="mt-2 bg-white/5 border-white/10 max-h-64 overflow-y-auto">
                    <CardContent className="p-4 space-y-2">
                      {filteredUsers.map((adminUser) => (
                        <div key={adminUser.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${adminUser.id}`}
                            checked={bulkUpdate.selectedUsers.has(adminUser.id)}
                            onCheckedChange={() => handleUserToggle(adminUser.id)}
                            data-testid={`checkbox-user-${adminUser.id}`}
                          />
                          <Label htmlFor={`user-${adminUser.id}`} className="text-sm cursor-pointer">
                            {adminUser.username} ({adminUser.email})
                          </Label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Alert Type Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-300">Select Alert Types ({bulkUpdate.selectedAlerts.size} selected)</Label>
                  <Card className="mt-2 bg-white/5 border-white/10 max-h-96 overflow-y-auto">
                    <CardContent className="p-4 space-y-4">
                      {Object.entries(alertTypesByCategory).map(([category, alertTypes]: [string, any[]]) => (
                        <div key={category}>
                          <button
                            onClick={() => toggleCategory(category)}
                            className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            data-testid={`category-toggle-${category.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <h3 className="font-medium text-slate-200">{category}</h3>
                            {expandedCategories.has(category) ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          
                          {expandedCategories.has(category) && (
                            <div className="mt-2 space-y-2">
                              {alertTypes.map((alertType: any) => (
                                <div key={alertType.key} className="flex items-center space-x-2 pl-4">
                                  <Checkbox
                                    id={`alert-${alertType.key}`}
                                    checked={bulkUpdate.selectedAlerts.has(alertType.key)}
                                    onCheckedChange={() => handleAlertToggle(alertType.key)}
                                    data-testid={`checkbox-alert-${alertType.key}`}
                                  />
                                  <Label htmlFor={`alert-${alertType.key}`} className="text-sm cursor-pointer">
                                    <div>
                                      <div className="font-medium text-slate-300">{alertType.label}</div>
                                      <div className="text-xs text-slate-500">{alertType.description}</div>
                                    </div>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Bulk Update Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleBulkUpdate}
                    disabled={bulkUpdate.isUpdating || bulkUpdate.selectedUsers.size === 0 || bulkUpdate.selectedAlerts.size === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-bulk-update"
                  >
                    {bulkUpdate.isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Enable Alerts for {bulkUpdate.selectedUsers.size} Users
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Alert Analytics</CardTitle>
                <CardDescription className="text-slate-400">
                  System-wide alert statistics and usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats ? (
                  <div className="space-y-6">
                    {/* Overall Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/5 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-400">{stats.totalUsers}</div>
                        <div className="text-sm text-slate-400">Total Users</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{stats.totalSettings}</div>
                        <div className="text-sm text-slate-400">Configured Settings</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-400">{stats.totalAlerts}</div>
                        <div className="text-sm text-slate-400">Total Alert Types</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-400">{stats.enabledAlerts}</div>
                        <div className="text-sm text-slate-400">Enabled Alerts</div>
                      </div>
                    </div>

                    {/* Alert Distribution */}
                    {stats.settingsByAlert && Object.keys(stats.settingsByAlert).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-200 mb-4">Alert Type Usage</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(stats.settingsByAlert).map(([alertKey, data]: [string, any]) => (
                            <div key={alertKey} className="bg-white/5 p-3 rounded-lg">
                              <div className="flex justify-between items-center">
                                <div className="text-sm font-medium text-slate-300">{alertKey}</div>
                                <div className="text-sm text-slate-400">
                                  {data.enabled || 0}/{data.total || 0}
                                </div>
                              </div>
                              <div className="mt-2 bg-white/10 rounded-full h-2">
                                <div 
                                  className="bg-emerald-500 h-2 rounded-full transition-all"
                                  style={{ width: `${data.total ? ((data.enabled || 0) / data.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sport Distribution */}
                    {stats.settingsBySport && Object.keys(stats.settingsBySport).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-200 mb-4">Settings by Sport</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(stats.settingsBySport).map(([sport, sportData]: [string, any]) => (
                            <div key={sport} className="bg-white/5 p-4 rounded-lg text-center">
                              <div className="text-xl font-bold text-emerald-400">{sport}</div>
                              <div className="text-sm text-slate-400 mt-1">
                                {sportData?.alertTypes ? Object.values(sportData.alertTypes).filter(Boolean).length : 0} alerts enabled
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading analytics...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}