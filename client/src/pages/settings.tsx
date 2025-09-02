import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Zap, LogOut, SettingsIcon, Bell, Target, Trophy, Clock, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

// Comprehensive alert configuration for all sports
const ALERT_TYPE_CONFIG = {
  MLB: {
    "Game Situations": [
      { key: "RISP", label: "RISP (Runners in Scoring Position)", description: "Alert when runners are on 2nd or 3rd base" },
      { key: "BASES_LOADED", label: "Bases Loaded", description: "Alert when all three bases are occupied" },
      { key: "RUNNERS_1ST_2ND", label: "Runners on 1st & 2nd", description: "Prime scoring opportunity alert" },
      { key: "RUNNER_ON_BASE", label: "Runner on Any Base", description: "Alert when any runner reaches base (1st, 2nd, or 3rd)" },
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
      { key: "POWER_BATTER_ON_DECK", label: "Power Batter On Deck", description: "Known slugger (high HR/OPS) on deck with runners aboard" },
      { key: "CLUTCH_BATTER_ON_DECK", label: "Clutch Batter On Deck", description: "High RBI hitter on deck in late innings with tying/go-ahead runs" },
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
      { key: "TWO_MINUTE_WARNING", label: "Two Minute Warning", description: "Final 2 minutes of quarters and halves" },
    ]
  }
};

export default function Settings() {
  const [activeSport, setActiveSport] = useState(() => {
    // Persist active sport selection in localStorage
    return localStorage.getItem('settings-active-sport') || "MLB";
  });
  const { toast } = useToast();

  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Alert preferences state and queries
  const { data: alertPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`],
    enabled: !!user?.id && isAuthenticated,
  });

  // Create a map of current preferences for easy lookup
  const preferenceMap = new Map();
  if (alertPreferences) {
    alertPreferences.forEach((pref: any) => {
      preferenceMap.set(pref.alertType, pref.enabled);
    });
  }

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });

  // Alert preferences mutation
  const updateAlertPreferenceMutation = useMutation({
    mutationFn: async ({ alertType, enabled }: { alertType: string; enabled: boolean }) => {
      const response = await apiRequest("POST", `/api/user/${user?.id}/alert-preferences`, {
        sport: activeSport,
        alertType,
        enabled
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`]
      });
      toast({
        title: "Alert preference updated",
        description: "Your alert settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert preference. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAlertToggle = (alertType: string, enabled: boolean) => {
    updateAlertPreferenceMutation.mutate({ alertType, enabled });
  };

  // Helper function to get category icon
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

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">ChirpBot</h1>
            <p className="text-emerald-300/80 text-xs font-medium">V2 Alert System</p>
          </div>
        </div>
        {isAuthenticated && (
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        )}
      </header>

      {/* Sport Tabs */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => {
                setActiveSport(sport);
                localStorage.setItem('settings-active-sport', sport);
              }}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                activeSport === sport
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="p-4 space-y-6">
        {/* User Info Section */}
        {isAuthenticated && user && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
                <SettingsIcon className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Account Settings</h2>
                <p className="text-sm text-slate-300">
                  Logged in as <span className="text-emerald-400 font-medium">{user.username}</span>
                </p>
                {user.email && (
                  <p className="text-xs text-slate-400">{user.email}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Selected Sport Display */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-2">
            Selected Sport
          </h2>
          <div className="flex items-center space-x-3">
            <div className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-bold uppercase tracking-wide ring-1 ring-emerald-500/30">
              {activeSport}
            </div>
            <p className="text-sm text-slate-300">
              Configure settings for {activeSport} alerts and notifications.
            </p>
          </div>
        </Card>

        {/* Alert Preferences */}
        {isAuthenticated && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide text-slate-100">
                  {activeSport} Alert Preferences
                </h2>
                <p className="text-sm text-slate-300">
                  Toggle individual alert types for {activeSport} games
                </p>
              </div>
            </div>

            {preferencesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG] ? (
                  Object.entries(ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]).map(([category, alerts]) => (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(category)}
                        <h3 className="text-md font-bold text-slate-100 uppercase tracking-wide">
                          {category}
                        </h3>
                      </div>
                      <div className="space-y-3 ml-6">
                        {alerts.map((alert) => {
                          const isEnabled = preferenceMap.get(alert.key) ?? true; // Default to enabled
                          return (
                            <div 
                              key={alert.key} 
                              className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {alert.label}
                                  </h4>
                                  {updateAlertPreferenceMutation.isPending && (
                                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  {alert.description}
                                </p>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(enabled) => handleAlertToggle(alert.key, enabled)}
                                disabled={updateAlertPreferenceMutation.isPending}
                                data-testid={`toggle-${alert.key.toLowerCase()}`}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </div>
                          );
                        })}
                      </div>
                      {Object.keys(ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]).indexOf(category) < 
                       Object.keys(ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]).length - 1 && (
                        <Separator className="bg-white/10 my-4" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">
                      No alert types configured for {activeSport} yet.
                      <br />
                      <span className="text-xs text-slate-500">
                        Alert types will appear here as they are added to the system.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}