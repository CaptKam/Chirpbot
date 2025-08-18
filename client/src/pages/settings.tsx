import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
    { 
      key: "gameStateAlerts", 
      label: "Game State Changes", 
      description: "Critical game developments like lead changes, tie games, and momentum shifts",
      expectation: "Get notified when games enter high-stakes situations or when the score dynamics change significantly"
    },
    { 
      key: "rispAlerts", 
      label: "Runners in Scoring Position", 
      description: "High-pressure at-bats with runners on 2nd or 3rd base",
      expectation: "Alert when your team has prime scoring opportunities or faces defensive pressure situations"
    },
    { 
      key: "weatherAlerts", 
      label: "Weather Impact Alerts", 
      description: "Weather conditions affecting gameplay like wind, rain, or temperature extremes",
      expectation: "Know when weather could impact hitting, pitching, or fielding for strategic advantages"
    },
    { 
      key: "batterAlerts", 
      label: "Power Batter Situations", 
      description: "Key at-bats featuring star hitters in clutch moments",
      expectation: "Never miss when your team's best hitters or opposing threats come to the plate in crucial spots"
    },
  ],
  NFL: [
    { 
      key: "redZoneAlerts", 
      label: "Red Zone Opportunities", 
      description: "Teams driving inside the 20-yard line with scoring chances",
      expectation: "Get alerts when teams enter prime scoring territory - perfect for following touchdown drives"
    },
    { 
      key: "twoMinuteAlerts", 
      label: "Two-Minute Warnings", 
      description: "Critical end-of-half situations with clock management pressure",
      expectation: "Know when games enter crunch time with strategic timeouts, hurry-up offenses, and game-winning drives"
    },
    { 
      key: "fourthDownAlerts", 
      label: "Fourth Down Conversions", 
      description: "High-risk go-for-it situations and crucial defensive stops",
      expectation: "Alert for momentum-shifting plays where teams risk everything on one down"
    },
    { 
      key: "turnoverAlerts", 
      label: "Turnover Situations", 
      description: "Interceptions, fumbles, and game-changing defensive plays",
      expectation: "Never miss the big defensive plays that can completely flip game momentum"
    },
  ],
  NBA: [
    { 
      key: "clutchTimeAlerts", 
      label: "Clutch Time (Final 5 Minutes)", 
      description: "Close games in the final stretch when every possession matters",
      expectation: "Get notified when games are within 5 points in the last 5 minutes - prime time basketball drama"
    },
    { 
      key: "overtimeAlerts", 
      label: "Overtime Games", 
      description: "Extra period games with sudden-death intensity",
      expectation: "Alert when games go to overtime - every basket could be the game winner"
    },
    { 
      key: "leadChangeAlerts", 
      label: "High Lead Changes", 
      description: "Back-and-forth games with frequent momentum swings",
      expectation: "Know when games become shootouts with multiple lead changes indicating exciting finishes"
    },
    { 
      key: "closeGameAlerts", 
      label: "Close Game Finishes", 
      description: "Tight contests decided in the final minutes",
      expectation: "Get alerts for nail-biting finishes where games are decided by just a few points"
    },
  ],
  NHL: [
    { 
      key: "powerPlayAlerts", 
      label: "Power Play Opportunities", 
      description: "Man advantage situations with prime scoring chances",
      expectation: "Know when teams get power plays - statistically the best time to score goals"
    },
    { 
      key: "emptyNetAlerts", 
      label: "Empty Net Situations", 
      description: "Goalie pulled for extra attacker in desperate final minutes",
      expectation: "Alert for high-drama moments when teams risk everything for the tying goal"
    },
    { 
      key: "thirdPeriodAlerts", 
      label: "Third Period Ties", 
      description: "Games tied entering the final period - anyone's game",
      expectation: "Get notified when games are deadlocked going into the final 20 minutes of regulation"
    },
    { 
      key: "finalMinutesAlerts", 
      label: "Final Minutes Close Games", 
      description: "Tight games in the closing minutes with potential for dramatic finishes",
      expectation: "Never miss the nail-biting final minutes when close games are decided"
    },
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
    updateSettingsMutation.mutate({
      [alertType]: enabled
    });
  };

  const handleAIToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ aiEnabled: enabled });
  };

  const handleConfidenceThresholdChange = (value: number[]) => {
    updateSettingsMutation.mutate({ aiConfidenceThreshold: value[0] });
  };

  const handleTelegramToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ telegramEnabled: enabled });
  };

  const handlePushNotificationsToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ pushNotificationsEnabled: enabled });
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <header className="bg-chirp-blue text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-chirp-red rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">ChirpBot</h1>
            <p className="text-blue-200 text-xs font-medium">V2 Alert System</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-chirp-red px-3 py-1 rounded-full">
            <span className="text-white text-xs font-bold uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-red-300 rounded-full inline-block mr-1 animate-pulse"></div>
              LIVE
            </span>
          </div>
          {!isAuthLoading && (
            isAuthenticated ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:text-gray-200 px-2"
                data-testid="button-header-logout"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">
                  {logoutMutation.isPending ? "Logging out..." : "Logout"}
                </span>
              </Button>
            ) : (
              <Link href="/signup">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:text-gray-200 px-2"
                  data-testid="button-header-signup"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  <span className="text-xs font-medium">Sign Up</span>
                </Button>
              </Link>
            )
          )}
          <Link href="/alerts">
            <Button variant="ghost" size="sm" className="relative p-0 text-white hover:text-gray-200">
              <Bell className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Sport Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => setActiveSport(sport)}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                activeSport === sport
                  ? "border-chirp-red text-chirp-red"
                  : "border-transparent text-chirp-dark hover:text-chirp-blue"
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
                <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
                <div className="bg-white rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-300 rounded w-48"></div>
                    <div className="w-11 h-6 bg-gray-300 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : settings ? (
          <>
            {/* Alert Types Section */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                Alert Types
              </h2>
              <div className="space-y-4">
                {ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG]?.map((alertConfig) => (
                  <Card key={alertConfig.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-chirp-blue mb-1" data-testid={`alert-type-${alertConfig.key}`}>
                          {alertConfig.label}
                        </h3>
                        <p className="text-sm text-chirp-dark mb-2">
                          {alertConfig.description}
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-800 font-medium">
                            <span className="font-bold">What to expect:</span> {alertConfig.expectation}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        <Switch
                          checked={!!(settings as any)[alertConfig.key]}
                          onCheckedChange={(enabled) => handleAlertTypeToggle(alertConfig.key, enabled)}
                          data-testid={`toggle-${alertConfig.key}`}
                          className="data-[state=checked]:bg-chirp-red"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* AI Settings Section */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                AI Analysis
              </h2>
              
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-chirp-blue">AI Context Enhancement</h3>
                    <p className="text-sm text-chirp-dark mt-1">Add AI analysis to all alerts</p>
                  </div>
                  <Switch
                    checked={settings.aiEnabled}
                    onCheckedChange={handleAIToggle}
                    data-testid="toggle-ai"
                    className="data-[state=checked]:bg-chirp-red"
                  />
                </div>

                {settings.aiEnabled && (
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-sm font-medium text-chirp-blue mb-2">
                      AI Confidence Threshold
                    </label>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-chirp-dark">75%</span>
                      <div className="flex-1">
                        <Slider
                          value={[settings.aiConfidenceThreshold]}
                          onValueChange={handleConfidenceThresholdChange}
                          min={75}
                          max={100}
                          step={5}
                          className="w-full"
                          data-testid="ai-confidence-slider"
                        />
                      </div>
                      <span className="text-sm text-chirp-dark">100%</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-sm font-medium text-chirp-red" data-testid="current-threshold">
                        Current: {settings.aiConfidenceThreshold}%
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Notification Settings */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                Notifications
              </h2>
              
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-chirp-blue">Telegram Alerts</h3>
                    <p className="text-sm text-chirp-dark mt-1">Send notifications to Telegram bot</p>
                  </div>
                  <Switch
                    checked={settings.telegramEnabled}
                    onCheckedChange={handleTelegramToggle}
                    data-testid="toggle-telegram"
                    className="data-[state=checked]:bg-chirp-red"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-chirp-blue">Push Notifications</h3>
                    <p className="text-sm text-chirp-dark mt-1">Browser notifications for live alerts</p>
                  </div>
                  <Switch
                    checked={settings.pushNotificationsEnabled}
                    onCheckedChange={handlePushNotificationsToggle}
                    data-testid="toggle-push-notifications"
                    className="data-[state=checked]:bg-chirp-red"
                  />
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-chirp-dark">Telegram Bot Status</span>
                    {telegramStatus === null ? (
                      <Badge className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unknown
                      </Badge>
                    ) : telegramStatus ? (
                      <Badge className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => testTelegramMutation.mutate()}
                    disabled={testTelegramMutation.isPending}
                    size="sm"
                    className="w-full bg-chirp-blue text-white hover:bg-blue-700"
                    data-testid="test-telegram-button"
                  >
                    {testTelegramMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <Card className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-chirp-blue mb-2">Settings Not Found</h3>
            <p className="text-sm text-chirp-dark">
              Unable to load settings for {activeSport}. Please try again later.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
