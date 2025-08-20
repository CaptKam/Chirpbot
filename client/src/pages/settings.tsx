import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
// Slider component removed
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Bell, CheckCircle, AlertCircle, LogOut, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import type { Settings } from "@/types";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

const ALERT_TYPE_CONFIG = {
  MLB: [
    { key: "risp", label: "RISP (Runners in Scoring Position)", description: "2nd/3rd base situations" },
    { key: "closeGame", label: "Close Game", description: "1-run games in late innings" },
    { key: "lateInning", label: "Late Inning Pressure", description: "8th+ inning crucial moments" },
    { key: "homeRun", label: "Home Run Situations", description: "High home run probability moments" },
    { key: "runnersOnBase", label: "Runners on Base", description: "Any base runner situations" },
    { key: "hits", label: "Hit Alerts", description: "Base hit notifications" },
    { key: "scoring", label: "Scoring Plays", description: "RBI and run-scoring events" },
    { key: "inningChange", label: "Inning Changes", description: "New inning momentum shifts" },
    { key: "homeRunAlert", label: "Home Run Alerts", description: "Actual home run notifications" },
    { key: "strikeouts", label: "Strikeout Alerts", description: "Pitcher strikeout notifications" },
    { key: "starBatter", label: "Star Batter Alert", description: ".300+ AVG, 20+ HR, or .900+ OPS hitters" },
    { key: "powerHitter", label: "Power Hitter Alert", description: "25+ HR sluggers with runners on base" },
    { key: "eliteClutch", label: "Elite Clutch Hitter", description: "High OPS batters in pressure situations" },
    { key: "avgHitter", label: ".300+ Hitter Alert", description: "Premium contact hitters at bat" },
    { key: "rbiMachine", label: "RBI Machine Alert", description: "80+ RBI producers with scoring chances" },
  ],
  NFL: [
    { key: "redZone", label: "Red Zone Situations", description: "Team driving inside the 20-yard line" },
    { key: "nflCloseGame", label: "NFL Close Game", description: "One-score games in final quarter" },
    { key: "fourthDown", label: "Fourth Down", description: "Critical fourth down decisions" },
    { key: "twoMinuteWarning", label: "Two Minute Warning", description: "Game-deciding final drives" },
  ],
  NBA: [
    { key: "clutchTime", label: "Clutch Time", description: "Final 2 minutes of close games" },
    { key: "nbaCloseGame", label: "NBA Close Game", description: "Single-digit games in 4th quarter" },
    { key: "overtime", label: "Overtime", description: "Extra period situations" },
  ],
  NHL: [
    { key: "powerPlay", label: "Power Play", description: "Man advantage situations" },
    { key: "nhlCloseGame", label: "NHL Close Game", description: "One-goal games in final period" },
    { key: "emptyNet", label: "Empty Net", description: "Goalie pulled for extra attacker" },
  ],
};

export default function Settings() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [telegramStatus, setTelegramStatus] = useState<boolean | null>(null);
  const { toast } = useToast();


  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

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

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings", { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const response = await apiRequest("PATCH", `/api/settings/${activeSport}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/telegram/test", {});
      return response.json();
    },
    onSuccess: (data) => {
      setTelegramStatus(data.connected);
      toast({
        title: data.connected ? "Telegram Connected" : "Telegram Connection Failed",
        description: data.connected 
          ? "Your Telegram bot is working correctly." 
          : "Check your bot token and chat ID configuration.",
        variant: data.connected ? "default" : "destructive",
      });
    },
  });

  const handleAlertTypeToggle = (alertType: string, enabled: boolean) => {
    if (!settings) return;

    const updatedAlertTypes = {
      ...settings.alertTypes,
      [alertType]: enabled,
    };

    updateSettingsMutation.mutate({ alertTypes: updatedAlertTypes });
  };

  // AI handlers removed

  const handleTelegramToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ telegramEnabled: enabled });
  };

  const handlePushNotificationsToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ pushNotificationsEnabled: enabled });
  };

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
      </header>

      {/* Sport Tabs */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => setActiveSport(sport)}
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
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
                <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-slate-700 rounded w-48"></div>
                    <div className="w-11 h-6 bg-slate-700 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : settings ? (
          <>
            {/* Alert Types Section */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
                Alert Types
              </h2>
              <div className="space-y-4">
                {ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]?.map((alertConfig) => (
                  <Card key={alertConfig.key} className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-100" data-testid={`alert-type-${alertConfig.key}`}>
                          {alertConfig.label}
                        </h3>
                        <p className="text-sm text-slate-300 mt-1">
                          {alertConfig.description}
                        </p>
                      </div>
                      <Switch
                        checked={!!(settings.alertTypes as any)[alertConfig.key]}
                        onCheckedChange={(enabled) => handleAlertTypeToggle(alertConfig.key, enabled)}
                        data-testid={`toggle-${alertConfig.key}`}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Advanced Settings Removed */}

            {/* Notification Settings */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
                Notifications
              </h2>

              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 space-y-4 hover:bg-white/10 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100">Telegram Alerts</h3>
                    <p className="text-sm text-slate-300 mt-1">Send notifications to Telegram bot</p>
                  </div>
                  <Switch
                    checked={settings.telegramEnabled}
                    onCheckedChange={handleTelegramToggle}
                    data-testid="toggle-telegram"
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100">Push Notifications</h3>
                    <p className="text-sm text-slate-300 mt-1">Browser notifications for live alerts</p>
                  </div>
                  <Switch
                    checked={settings.pushNotificationsEnabled}
                    onCheckedChange={handlePushNotificationsToggle}
                    data-testid="toggle-push-notifications"
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-300">Telegram Bot Status</span>
                    {telegramStatus === null ? (
                      <Badge className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-slate-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unknown
                      </Badge>
                    ) : telegramStatus ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-emerald-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-red-500/30">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                  </div>

                  <Button
                    onClick={() => testTelegramMutation.mutate()}
                    disabled={testTelegramMutation.isPending}
                    size="sm"
                    className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400 font-medium"
                    data-testid="test-telegram-button"
                  >
                    {testTelegramMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Account Section */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
                Account
              </h2>
              <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-200">
                {!isAuthLoading && (
                  isAuthenticated ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-100">Sign Out</h3>
                        <p className="text-sm text-slate-300 mt-1">Sign out of your ChirpBot account</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/10 hover:ring-red-500/50 border-none"
                        data-testid="button-settings-logout"
                        onClick={() => logoutMutation.mutate()}
                        disabled={logoutMutation.isPending}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-100">Account Access</h3>
                        <p className="text-sm text-slate-300 mt-1">Sign up to save your settings</p>
                      </div>
                      <Link href="/signup">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/10 hover:ring-emerald-500/50 border-none"
                          data-testid="button-settings-signup"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  )
                )}
              </Card>
            </div>
          </>
        ) : (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-100 mb-2">Settings Not Found</h3>
            <p className="text-sm text-slate-300">
              Unable to load settings for {activeSport}. Please try again later.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}