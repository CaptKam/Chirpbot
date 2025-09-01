import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Zap, LogOut, SettingsIcon, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

// Sports with alert systems implemented
const SPORTS_WITH_ALERTS = {
  "MLB": {
    name: "Major League Baseball",
    alerts: ["High Scoring Opportunity", "Home Run", "Hit Alerts", "Scoring Plays"]
  },
  "NCAAF": {
    name: "College Football", 
    alerts: ["Red Zone", "Touchdown", "Field Goal"]
  },
  "NFL": {
    name: "National Football League",
    alerts: ["Red Zone", "Touchdown", "Field Goal"] 
  },
  "NBA": {
    name: "Basketball",
    alerts: ["Coming Soon"]
  },
  "NHL": {
    name: "Hockey",
    alerts: ["Coming Soon"]
  }
};

const TEST_USER_ID = "test-user-123";

export default function Settings() {
  const [activeSport, setActiveSport] = useState(() => {
    // Persist active sport selection in localStorage
    return localStorage.getItem('settings-active-sport') || "MLB";
  });
  const { toast } = useToast();

  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id || TEST_USER_ID;

  // Fetch sport alert settings
  const { data: sportAlertSettings = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: [`/api/user/${userId}/sport-alerts`],
    enabled: isAuthenticated,
  });

  // Mutation for updating sport alert settings
  const updateSportAlertMutation = useMutation({
    mutationFn: async ({ sport, alertsEnabled }: { sport: string; alertsEnabled: boolean }) => {
      const response = await apiRequest("POST", `/api/user/${userId}/sport-alerts/${sport}`, {
        alertsEnabled
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}/sport-alerts`] });
      toast({
        title: "Settings Updated",
        description: "Sport alert preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sport alert settings.",
        variant: "destructive",
      });
    },
  });

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

  const handleLogout = () => {
    logoutMutation.mutate();
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

        {/* Sport Alert Settings */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-red-500/20 ring-1 ring-red-500/30 rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100">
                {activeSport} Alerts
              </h2>
              <p className="text-sm text-slate-400">
                {SPORTS_WITH_ALERTS[activeSport as keyof typeof SPORTS_WITH_ALERTS]?.name || activeSport}
              </p>
            </div>
          </div>

          {/* Alert Toggle */}
          {SPORTS_WITH_ALERTS[activeSport as keyof typeof SPORTS_WITH_ALERTS] ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-100">Enable {activeSport} Alerts</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Receive notifications for {activeSport} game events and scoring opportunities
                  </p>
                </div>
                <Switch
                  checked={sportAlertSettings.find((s: any) => s.sport === activeSport)?.alertsEnabled ?? true}
                  onCheckedChange={(enabled) => {
                    updateSportAlertMutation.mutate({ sport: activeSport, alertsEnabled: enabled });
                  }}
                  disabled={updateSportAlertMutation.isPending || isLoadingSettings}
                  data-testid={`alert-toggle-${activeSport.toLowerCase()}`}
                />
              </div>

              {/* Alert Types */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Alert Types Available
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {SPORTS_WITH_ALERTS[activeSport as keyof typeof SPORTS_WITH_ALERTS].alerts.map((alertType) => (
                    <div 
                      key={alertType}
                      className="flex items-center space-x-2 px-3 py-2 bg-white/5 rounded-md"
                    >
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <span className="text-sm text-slate-300">{alertType}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-center">
              <div>
                <BellOff className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">
                  Alerts Coming Soon
                </h3>
                <p className="text-sm text-slate-400">
                  Alert system for {activeSport} is currently in development
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Selected Sport Display */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-2">
            Current Selection
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

        {/* Placeholder for New Settings */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
            Settings Configuration
          </h2>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <SettingsIcon className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">
              Settings controls will be configured here.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}