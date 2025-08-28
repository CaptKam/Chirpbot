import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Bell, CheckCircle, AlertCircle, LogOut, UserPlus, ChevronDown, ChevronUp, Settings as SettingsIcon, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import type { Settings } from "@/types";

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
    { key: "powerHitter", label: "Power Hitter Alert", description: "Advanced HR probability analysis with platoon advantages, park factors & wind effects", category: "Player Performance" },
    { key: "powerHitterOnDeck", label: "👀 Power Hitter On Deck", description: "Tier A power bats on deck - Pre-alert for next at-bat", category: "Player Performance" },
    { key: "eliteClutch", label: "Elite Clutch Hitter", description: "High OPS batters in pressure situations", category: "Player Performance" },
    { key: "avgHitter", label: ".300+ Hitter Alert", description: "Premium contact hitters at bat", category: "Player Performance" },
    { key: "rbiMachine", label: "RBI Machine Alert", description: "80+ RBI producers with scoring chances", category: "Player Performance" },
    { key: "strikeouts", label: "Strikeout Alerts", description: "Pitcher strikeout notifications", category: "Player Performance" },
    
    // === ADVANCED PREDICTION SYSTEM ===
    { key: "Home Run Prediction", label: "🚀 HR Probability Model", description: "Mathematical home run prediction using logistic regression + weather physics", category: "AI Predictions" },
    { key: "Walk-off Prediction", label: "🎯 Walk-off Situation", description: "Game-ending opportunity prediction with context analysis", category: "AI Predictions" },
    
    // === HYBRID RE24+AI SYSTEM ===
    { key: "useRE24System", label: "🧠 RE24+AI Hybrid System", description: "Advanced Run Expectancy analytics enhanced with AI predictions", category: "AI Predictions" },
    { key: "re24Level1", label: "📊 RE24 Level 1", description: "Basic situational analysis with AI enhancement", category: "AI Predictions" },
    { key: "re24Level2", label: "📈 RE24 Level 2", description: "Intermediate player analytics with contextual AI", category: "AI Predictions" },
    { key: "re24Level3", label: "🎯 RE24 Level 3", description: "Elite sabermetrics with advanced AI predictions", category: "AI Predictions" },
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

export default function Settings() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [telegramStatus, setTelegramStatus] = useState<boolean | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Game Situations", "AI Predictions"]));
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [personalTelegramEnabled, setPersonalTelegramEnabled] = useState(false);
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

  // Fetch enabled alert keys from master controls  
  const { data: enabledAlertKeys, isLoading: isLoadingEnabledKeys } = useQuery<{ enabledKeys: string[] }>({
    queryKey: ["/api/settings/enabled-alert-keys", activeSport],
    queryFn: async ({ queryKey }) => {
      const [url, sport] = queryKey;
      const response = await fetch(`${url}/${sport}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch enabled alert keys");
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

  // Personal Telegram settings queries and mutations
  const { data: userTelegramSettings, isLoading: isLoadingTelegramSettings } = useQuery({
    queryKey: [`/api/user/${user?.id}/telegram`],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/user/${user.id}/telegram`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch Telegram settings");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Update local state when user telegram settings are loaded
  useEffect(() => {
    if (userTelegramSettings) {
      setPersonalTelegramEnabled(userTelegramSettings.telegramEnabled);
      // Set token and chat ID from stored settings but don't display them for security
      if (userTelegramSettings.hasCredentials) {
        setTelegramBotToken("••••••••••"); // Masked display
        setTelegramChatId("••••••••••");  // Masked display
      }
    }
  }, [userTelegramSettings]);

  const updateUserTelegramMutation = useMutation({
    mutationFn: async ({ telegramBotToken, telegramChatId, telegramEnabled }: { 
      telegramBotToken: string; 
      telegramChatId: string; 
      telegramEnabled: boolean; 
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      const response = await apiRequest("PUT", `/api/user/${user.id}/telegram`, {
        telegramBotToken,
        telegramChatId,
        telegramEnabled,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user/${user?.id}/telegram`] });
      toast({
        title: "Telegram Settings Updated",
        description: "Your personal Telegram configuration has been saved.",
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

  const testUserTelegramMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const response = await apiRequest("POST", `/api/user/${user.id}/telegram/test`, {});
      return response.json();
    },
    onSuccess: (data) => {
      setTelegramStatus(data.connected);
      toast({
        title: data.connected ? "Your Telegram Connected" : "Telegram Connection Failed",
        description: data.connected 
          ? "Your personal Telegram bot is working correctly." 
          : data.message || "Check your bot token and chat ID configuration.",
        variant: data.connected ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Unable to test Telegram connection.",
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
        title: data.connected ? "Global Telegram Connected" : "Global Telegram Connection Failed",
        description: data.connected 
          ? "The system Telegram bot is working correctly." 
          : "Check the global bot token and chat ID configuration.",
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


  const handleTelegramToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ telegramEnabled: enabled });
  };

  const handlePushNotificationsToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ pushNotificationsEnabled: enabled });
  };

  const handlePersonalTelegramToggle = (enabled: boolean) => {
    setPersonalTelegramEnabled(enabled);
    if (telegramBotToken && telegramChatId) {
      updateUserTelegramMutation.mutate({
        telegramBotToken,
        telegramChatId,
        telegramEnabled: enabled,
      });
    }
  };

  const handleSaveTelegramCredentials = () => {
    if (!telegramBotToken || !telegramChatId || telegramBotToken === "••••••••••" || telegramChatId === "••••••••••") {
      toast({
        title: "Missing Information",
        description: "Please enter both bot token and chat ID.",
        variant: "destructive",
      });
      return;
    }

    updateUserTelegramMutation.mutate({
      telegramBotToken,
      telegramChatId,
      telegramEnabled: personalTelegramEnabled,
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
        {(isLoading || isLoadingEnabledKeys) ? (
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
                🚀 Advanced Alert System
              </h2>
              
              {/* Group alerts by category */}
              {(() => {
                const allAlertConfigs = ALERT_TYPE_CONFIG[activeSport as keyof typeof ALERT_TYPE_CONFIG] || [];
                const enabledKeys = enabledAlertKeys?.enabledKeys || [];
                
                // Filter alert configs to only show those enabled in master controls
                const alertConfigs = allAlertConfigs.filter(config => 
                  enabledKeys.length === 0 || enabledKeys.includes(config.key) // Show all if no master controls loaded, otherwise filter
                );
                
                const categories = Array.from(new Set(alertConfigs.map(config => config.category || 'General')));
                
                return categories.map(category => {
                  const isExpanded = expandedCategories.has(category);
                  const categoryAlerts = alertConfigs.filter(config => (config.category || 'General') === category);
                  
                  return (
                    <div key={category} className="mb-6">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 group"
                        data-testid={`category-toggle-${category.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <h3 className="text-md font-bold text-emerald-400 uppercase tracking-wide group-hover:text-emerald-300 transition-colors">
                          {category}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-emerald-500/30">
                            {categoryAlerts.length}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                          )}
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          {categoryAlerts.map((alertConfig) => (
                            <Card key={alertConfig.key} className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-200">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 pr-4">
                                  <h4 className="font-bold text-slate-100" data-testid={`alert-type-${alertConfig.key}`}>
                                    {alertConfig.label}
                                  </h4>
                                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                                    {alertConfig.description}
                                  </p>
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={!!(settings.alertTypes as any)[alertConfig.key]}
                                    onCheckedChange={(enabled) => handleAlertTypeToggle(alertConfig.key, enabled)}
                                    data-testid={`toggle-${alertConfig.key}`}
                                    className="data-[state=checked]:bg-emerald-500 flex-shrink-0"
                                  />
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Personal Telegram Configuration */}
            {isAuthenticated && (
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4 flex items-center">
                  <SettingsIcon className="w-5 h-5 mr-2 text-emerald-400" />
                  Your Personal Telegram Bot
                </h2>

                <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 space-y-4 hover:bg-white/10 transition-all duration-200">
                  <div className="border-b border-white/10 pb-4">
                    <h3 className="font-bold text-slate-100 mb-2">Configure Your Bot</h3>
                    <p className="text-sm text-slate-300 mb-4">
                      Set up your personal Telegram bot to receive alerts directly in your own chat.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="telegram-bot-token" className="text-sm font-medium text-slate-200">
                          Telegram Bot Token
                        </Label>
                        <Input
                          id="telegram-bot-token"
                          data-testid="input-telegram-bot-token"
                          type="password"
                          value={telegramBotToken}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          placeholder={userTelegramSettings?.hasCredentials ? "••••••••••  (enter new to update)" : "7123456789:AABCDEFabcdef123456789..."}
                          className="bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
                          disabled={updateUserTelegramMutation.isPending}
                          onFocus={() => {
                            if (telegramBotToken === "••••••••••") {
                              setTelegramBotToken("");
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="telegram-chat-id" className="text-sm font-medium text-slate-200">
                          Chat ID
                        </Label>
                        <Input
                          id="telegram-chat-id"
                          data-testid="input-telegram-chat-id"
                          type="text"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder={userTelegramSettings?.hasCredentials ? "••••••••••  (enter new to update)" : "123456789 or -100123456789"}
                          className="bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
                          disabled={updateUserTelegramMutation.isPending}
                          onFocus={() => {
                            if (telegramChatId === "••••••••••") {
                              setTelegramChatId("");
                            }
                          }}
                        />
                      </div>

                      <Button
                        onClick={handleSaveTelegramCredentials}
                        disabled={updateUserTelegramMutation.isPending || !telegramBotToken || !telegramChatId || telegramBotToken === "••••••••••" || telegramChatId === "••••••••••"}
                        className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400 font-medium"
                        data-testid="save-telegram-credentials"
                      >
                        {updateUserTelegramMutation.isPending ? "Saving..." : userTelegramSettings?.hasCredentials ? "Update Credentials" : "Save Credentials"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-100">Enable Personal Alerts</h3>
                        <p className="text-sm text-slate-300 mt-1">Send alerts to your personal Telegram bot</p>
                      </div>
                      <Switch
                        checked={personalTelegramEnabled}
                        onCheckedChange={handlePersonalTelegramToggle}
                        data-testid="toggle-personal-telegram"
                        className="data-[state=checked]:bg-emerald-500"
                        disabled={!userTelegramSettings?.hasCredentials}
                      />
                    </div>

                    {userTelegramSettings?.hasCredentials && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">Personal Bot Status</span>
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
                    )}

                    {userTelegramSettings?.hasCredentials && (
                      <Button
                        onClick={() => testUserTelegramMutation.mutate()}
                        disabled={testUserTelegramMutation.isPending}
                        size="sm"
                        className="w-full bg-blue-500 text-slate-100 hover:bg-blue-400 font-medium"
                        data-testid="test-personal-telegram-button"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {testUserTelegramMutation.isPending ? "Testing..." : "Test My Bot"}
                      </Button>
                    )}

                    {!userTelegramSettings?.hasCredentials && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-sm text-yellow-300">
                          <AlertCircle className="w-4 h-4 inline mr-2" />
                          Enter your bot token and chat ID above to enable personal Telegram alerts.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

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