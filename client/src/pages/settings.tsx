import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, LogOut, SettingsIcon, Bell, Target, Trophy, Clock, TrendingUp, Users, AlertTriangle, Send, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AuthLoading, StatsLoading } from '@/components/sports-loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

// Comprehensive alert configuration for all sports
const ALERT_TYPE_CONFIG = {
  MLB: [
    { key: 'RISP', label: 'Runner in Scoring Position', description: 'Alerts when a runner reaches 2nd or 3rd base' },
    { key: 'BASES_LOADED', label: 'Bases Loaded', description: 'All three bases are occupied' },
    { key: 'RUNNERS_1ST_2ND', label: 'Runners on 1st & 2nd', description: 'Prime scoring opportunity setup' },
    { key: 'CLOSE_GAME_LIVE', label: 'Close Game (Live)', description: 'Live updates for games within 3 runs' },
    { key: 'LATE_PRESSURE', label: 'Late Inning Pressure', description: '8th+ inning in close games' },
    { key: 'HOME_RUN_LIVE', label: 'Home Run (Live)', description: 'Real-time home run alerts' },
    { key: 'FULL_COUNT', label: 'Full Count', description: '3-2 count pressure situations' },
    { key: 'STRIKEOUT', label: 'Strikeout', description: 'Batter struck out' },
    { key: 'POWER_HITTER', label: 'Power Hitter', description: '20+ HR batter at bat' },
    { key: 'HOT_HITTER', label: 'Hot Hitter', description: 'Already homered today' }
  ],
  NCAAF: [
    { key: 'NCAAF_KICKOFF', label: 'Kickoff', description: 'Game start and 2nd half kickoffs' },
    { key: 'NCAAF_HALFTIME', label: 'Halftime', description: 'End of 2nd quarter with score updates' },
    { key: 'TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of any quarter' },
    { key: 'FOURTH_DOWN', label: 'Fourth Down', description: 'Critical conversion attempts' },
    { key: 'RED_ZONE', label: 'Red Zone', description: 'Inside the 20-yard line' }
  ],
  NFL: [
    { key: 'RED_ZONE', label: 'Red Zone', description: 'Team inside 20-yard line' },
    { key: 'FOURTH_DOWN', label: 'Fourth Down', description: 'Critical conversion attempts' },
    { key: 'TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'End of half situations' }
  ],
  NBA: [
      { key: "CLUTCH_TIME", label: "Clutch Time", description: "Final 5 minutes with close score" },
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "OVERTIME", label: "Overtime", description: "Games going to overtime" },
    ],
    NHL: [
      { key: "POWER_PLAY", label: "Power Play", description: "Man advantage situations" },
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "EMPTY_NET", label: "Empty Net", description: "Goalie pulled situations" },
    ],
    CFL: [
      { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
      { key: "FOURTH_DOWN", label: "Third Down (CFL)", description: "Critical down conversion attempts" },
    ]
};

export default function Settings() {
  const [activeSport, setActiveSport] = useState(() => {
    // Persist active sport selection in localStorage
    return localStorage.getItem('settings-active-sport') || "MLB";
  });
  const { toast } = useToast();

  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Telegram settings state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);

  // Alert preferences state and queries
  const { data: alertPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds for alert preferences to show admin changes quickly
    refetchInterval: 60 * 1000, // Refetch every minute to catch admin changes
  });

  // Telegram settings query
  const { data: telegramSettings, isLoading: telegramLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/telegram`],
    enabled: !!user?.id && isAuthenticated,
  });

  // Create a map of current preferences for easy lookup
  const preferenceMap = new Map();
  if (alertPreferences) {
    alertPreferences.forEach((pref: any) => {
      preferenceMap.set(pref.alertType, pref.enabled);
    });
  }

  // Helper to get alert preference, defaulting to true if not found or not loaded
  const getAlertPreference = (sport: string, alertType: string): boolean => {
    if (preferencesLoading) return true; // Default to true while loading to avoid brief disablings
    return preferenceMap.get(alertType) ?? true;
  };

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

  // Telegram settings mutation
  const updateTelegramMutation = useMutation({
    mutationFn: async ({ botToken, chatId, enabled }: { botToken: string; chatId: string; enabled: boolean }) => {
      const response = await apiRequest("POST", `/api/user/${user?.id}/telegram`, {
        botToken,
        chatId,
        enabled
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user/${user?.id}/telegram`]
      });
      toast({
        title: "Telegram settings updated",
        description: "Your Telegram configuration has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update Telegram settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Test Telegram connection
  const testTelegramConnection = async () => {
    if (!telegramBotToken || !telegramChatId) {
      toast({
        title: "Missing Information",
        description: "Please enter both bot token and chat ID before testing.",
        variant: "destructive",
      });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const response = await apiRequest("POST", "/api/telegram/test", {
        botToken: telegramBotToken,
        chatId: telegramChatId
      });
      const result = await response.json();

      if (response.ok && result) {
        setConnectionTestResult('success');
        toast({
          title: "Connection Successful",
          description: "Your Telegram bot is working correctly!",
        });
      } else {
        setConnectionTestResult('error');
        toast({
          title: "Connection Failed",
          description: "Please check your bot token and chat ID.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setConnectionTestResult('error');
      toast({
        title: "Connection Failed",
        description: "Please check your bot token and chat ID.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAlertToggle = (alertType: string, enabled: boolean) => {
    updateAlertPreferenceMutation.mutate({ alertType, enabled });
  };

  // Populate Telegram settings from query data
  useEffect(() => {
    if (telegramSettings) {
      setTelegramEnabled(telegramSettings.telegramEnabled || false);
      setTelegramChatId(telegramSettings.telegramChatId || "");
      // Don't populate token for security (backend returns "***")
      if (telegramSettings.telegramBotToken && telegramSettings.telegramBotToken !== "***") {
        setTelegramBotToken(telegramSettings.telegramBotToken);
      }
    }
  }, [telegramSettings]);

  const handleTelegramSave = () => {
    updateTelegramMutation.mutate({
      botToken: telegramBotToken,
      chatId: telegramChatId,
      enabled: telegramEnabled
    });
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
    return <AuthLoading />;
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
              <Tabs value={activeSport} onValueChange={setActiveSport} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="MLB">⚾ MLB</TabsTrigger>
                  <TabsTrigger value="NCAAF">🏈 NCAAF</TabsTrigger>
                  <TabsTrigger value="NFL">🏈 NFL</TabsTrigger>
                </TabsList>

                <TabsContent value="MLB" className="space-y-4">
                  <div className="space-y-4">
                    {ALERT_TYPE_CONFIG['MLB']?.map((alertType) => {
                      const isEnabled = getAlertPreference('MLB', alertType.key);
                      return (
                        <div key={alertType.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-semibold text-slate-100">
                                {alertType.label}
                              </h4>
                              {updateAlertPreferenceMutation.isPending && (
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {alertType.description}
                            </p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(enabled) => handleAlertToggle(alertType.key, enabled)}
                            disabled={updateAlertPreferenceMutation.isPending}
                            data-testid={`toggle-${alertType.key.toLowerCase()}`}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="NCAAF" className="space-y-4">
                  <div className="space-y-4">
                    {ALERT_TYPE_CONFIG['NCAAF']?.map((alertType) => {
                      const isEnabled = getAlertPreference('NCAAF', alertType.key);
                      return (
                        <div key={alertType.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-semibold text-slate-100">
                                {alertType.label}
                              </h4>
                              {updateAlertPreferenceMutation.isPending && (
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {alertType.description}
                            </p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(enabled) => handleAlertToggle(alertType.key, enabled)}
                            disabled={updateAlertPreferenceMutation.isPending}
                            data-testid={`toggle-${alertType.key.toLowerCase()}`}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="NFL" className="space-y-4">
                  <div className="space-y-4">
                    {ALERT_TYPE_CONFIG['NFL']?.map((alertType) => {
                      const isEnabled = getAlertPreference('NFL', alertType.key);
                      return (
                        <div key={alertType.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-semibold text-slate-100">
                                {alertType.label}
                              </h4>
                              {updateAlertPreferenceMutation.isPending && (
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {alertType.description}
                            </p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(enabled) => handleAlertToggle(alertType.key, enabled)}
                            disabled={updateAlertPreferenceMutation.isPending}
                            data-testid={`toggle-${alertType.key.toLowerCase()}`}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </Card>
        )}

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

        {/* Telegram Configuration Section */}
        {isAuthenticated && user && (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-blue-500/20 ring-1 ring-blue-500/30 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Telegram Notifications</h2>
                <p className="text-sm text-slate-300">
                  Configure your personal Telegram bot for alert notifications
                </p>
              </div>
            </div>

            {telegramLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">Enable Telegram Notifications</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Receive real-time alerts via your personal Telegram bot
                    </p>
                  </div>
                  <Switch
                    checked={telegramEnabled}
                    onCheckedChange={setTelegramEnabled}
                    data-testid="toggle-telegram-enabled"
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>

                {/* Bot Configuration */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bot-token" className="text-sm font-medium text-slate-200">
                      Bot Token
                    </Label>
                    <Input
                      id="bot-token"
                      type="password"
                      placeholder="Enter your Telegram bot token"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      data-testid="input-telegram-bot-token"
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Get this from @BotFather on Telegram
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="chat-id" className="text-sm font-medium text-slate-200">
                      Chat ID
                    </Label>
                    <Input
                      id="chat-id"
                      placeholder="Enter your Telegram chat ID"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      data-testid="input-telegram-chat-id"
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Send /start to your bot, then message @userinfobot to get your chat ID
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    onClick={testTelegramConnection}
                    disabled={testingConnection || !telegramBotToken || !telegramChatId}
                    variant="outline"
                    size="sm"
                    data-testid="button-test-telegram"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    {testingConnection ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                    ) : connectionTestResult === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    ) : connectionTestResult === 'error' ? (
                      <XCircle className="w-4 h-4 mr-2 text-red-400" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    onClick={handleTelegramSave}
                    disabled={updateTelegramMutation.isPending}
                    size="sm"
                    data-testid="button-save-telegram"
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {updateTelegramMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                </div>

                {/* Help Text */}
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">How to Set Up Your Telegram Bot:</h4>
                  <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Open Telegram and search for @BotFather</li>
                    <li>Send /newbot and follow the instructions to create your bot</li>
                    <li>Copy the bot token provided by BotFather</li>
                    <li>Send /start to your new bot to activate it</li>
                    <li>Message @userinfobot to get your chat ID</li>
                    <li>Enter both values above and test the connection</li>
                  </ol>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}