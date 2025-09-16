import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, LogOut, SettingsIcon, Bell, Target, Trophy, Clock, TrendingUp, Users, AlertTriangle, Send, CheckCircle, XCircle, Monitor, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SportTabs } from '@/components/SportTabs';
import { AuthLoading, StatsLoading } from '@/components/sports-loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();

// Alert type configurations - now populated from cylinder modules via API
const ALERT_TYPE_CONFIG: Record<string, any[]> = {
  MLB: [
    { key: 'MLB_GAME_START', label: 'Game Start', description: 'Alert when MLB game begins' },
    { key: 'MLB_SEVENTH_INNING_STRETCH', label: 'Seventh Inning Stretch', description: 'Traditional 7th inning stretch alert' },
    { key: 'MLB_RUNNER_ON_THIRD_NO_OUTS', label: 'Runner on 3rd, 0 Outs', description: '84% scoring probability situation' },
    { key: 'MLB_FIRST_AND_THIRD_NO_OUTS', label: '1st & 3rd, 0 Outs', description: '86% scoring probability situation' },
    { key: 'MLB_SECOND_AND_THIRD_NO_OUTS', label: '2nd & 3rd, 0 Outs', description: '85% scoring probability situation' },
    { key: 'MLB_BASES_LOADED_NO_OUTS', label: 'Bases Loaded, 0 Outs', description: '86% scoring probability situation' },
    { key: 'MLB_RUNNER_ON_THIRD_ONE_OUT', label: 'Runner on 3rd, 1 Out', description: '66% scoring probability situation' },
    { key: 'MLB_SECOND_AND_THIRD_ONE_OUT', label: '2nd & 3rd, 1 Out', description: '68% scoring probability situation' },
    { key: 'MLB_BASES_LOADED_ONE_OUT', label: 'Bases Loaded, 1 Out', description: '66% scoring probability situation' }
  ],
  WNBA: [
    // Existing WNBA alert types
    { key: 'WNBA_GAME_START', label: 'Game Start', description: 'Alert when WNBA game begins' },
    { key: 'WNBA_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Official two-minute warning in WNBA games' },
    { key: 'FINAL_MINUTES', label: 'Final Minutes', description: 'Alert during final minutes of close games' },
    { key: 'HIGH_SCORING_QUARTER', label: 'High Scoring Quarter', description: 'Alert for exceptionally high-scoring quarters' },
    { key: 'LOW_SCORING_QUARTER', label: 'Low Scoring Quarter', description: 'Alert for defensive battles and low-scoring quarters' },
    { key: 'FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Alert when fourth quarter begins' },
    // V3-10: New WNBA predictive alert types
    { key: 'WNBA_CLUTCH_TIME_OPPORTUNITY', label: 'Clutch Time Opportunity', description: 'High-leverage moments in final minutes and overtime' },
    { key: 'WNBA_COMEBACK_POTENTIAL', label: 'Comeback Potential', description: 'Identifies potential comeback scenarios and momentum shifts' },
    { key: 'WNBA_CRUNCH_TIME_DEFENSE', label: 'Crunch Time Defense', description: 'Critical defensive stops needed in clutch situations' },
    { key: 'WNBA_CHAMPIONSHIP_IMPLICATIONS', label: 'Championship Implications', description: 'Games with playoff positioning and championship impact' }
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

  // Global settings query to check admin-disabled alerts (now available for ALL authenticated users)
  const { data: globalSettingsResponse, isLoading: globalSettingsLoading } = useQuery({
    queryKey: [`/api/global-alert-settings/${activeSport}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 0, // Immediate invalidation to see admin changes instantly
    refetchInterval: 5 * 1000, // Refetch every 5 seconds to catch admin toggle changes
  });
  
  // Extract settings from response (handles both old admin format and new public format)
  const globalSettings = globalSettingsResponse?.settings || globalSettingsResponse;

  // Available alert types query from cylinders (accessible to all authenticated users)
  const { data: availableAlerts, isLoading: availableAlertsLoading } = useQuery({
    queryKey: [`/api/available-alerts/${activeSport}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 0, // Immediate invalidation to see admin changes instantly
    refetchInterval: 5 * 1000, // Refetch every 5 seconds to catch admin toggle changes
  });

  // Alert preferences query
  const { data: alertPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 0, // Immediate invalidation to see admin changes instantly
    refetchInterval: 5 * 1000, // Refetch every 5 seconds to catch admin changes
  });

  // Telegram settings query
  const { data: telegramSettings, isLoading: telegramLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/telegram`],
    enabled: !!user?.id && isAuthenticated,
  });

  // Unified loading state - coordinate all loading states (now includes global settings for all users)
  const isSettingsLoading = preferencesLoading || 
                           availableAlertsLoading || 
                           globalSettingsLoading;

  // Create a map of current preferences for easy lookup
  const preferenceMap = new Map();
  if (alertPreferences && Array.isArray(alertPreferences)) {
    alertPreferences.forEach((pref: any) => {
      preferenceMap.set(pref.alertType, pref.enabled);
    });
  }

  // Helper to get alert preference, returning undefined during loading to prevent false UI states
  const getAlertPreference = (sport: string, alertType: string): boolean | undefined => {
    if (isSettingsLoading) return undefined; // Return undefined while loading to show skeleton UI

    // Check if the alert is globally disabled by admin (now checked for ALL users)
    if (globalSettings && typeof globalSettings === 'object' && (globalSettings as Record<string, boolean>)[alertType] === false) {
      return false;
    }

    // For AI Enhancement alerts, look up in MLB preferences (since they're MLB-specific)
    if (alertType.startsWith('AI_')) {
      return preferenceMap.get(alertType) ?? true;
    }

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
      // Check if user is authenticated and has an ID
      if (!user?.id) {
        throw new Error('User not authenticated or ID missing');
      }

      const response = await apiRequest("POST", `/api/user/${user.id}/alert-preferences`, {
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
    onError: (error: any) => {
      // Extract meaningful error message
      const errorMessage = error?.message || error?.toString?.() || 'Unknown error occurred';
      
      // Check for specific error types
      if (errorMessage.includes('401') || errorMessage.includes('not authenticated') || errorMessage.includes('ID missing')) {
        toast({
          title: "Authentication Required",
          description: "Please log in to save your alert preferences.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('globally disabled')) {
        // Handle globally disabled alerts
        toast({
          title: "Alert Disabled",
          description: "This alert type has been globally disabled by the administrator and cannot be enabled.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('400')) {
        // Extract the actual error message from the 400 response
        try {
          const match = errorMessage.match(/400: ({.*})/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            toast({
              title: "Cannot Update",
              description: parsed.message || "This preference cannot be updated at this time.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: "Failed to update alert preference. Please try again.",
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "Error",
            description: "Failed to update alert preference. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error", 
          description: "Failed to update alert preference. Please try again.",
          variant: "destructive",
        });
      }
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
    // Early validation
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to change alert preferences.",
        variant: "destructive",
      });
      return;
    }
    
    // Optimistic update - update cache immediately for smooth UX
    const queryKey = [`/api/user/${user.id}/alert-preferences/${activeSport.toLowerCase()}`];
    const previousData = queryClient.getQueryData(queryKey);
    
    // Update cache optimistically
    queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      
      // Find existing preference for this alert type
      const existingIndex = oldData.findIndex((pref: any) => pref.alertType === alertType);
      
      if (existingIndex >= 0) {
        // Update existing preference
        const newData = [...oldData];
        newData[existingIndex] = { ...newData[existingIndex], enabled };
        return newData;
      } else {
        // Add new preference
        return [...oldData, { alertType, enabled, sport: activeSport }];
      }
    });
    
    // Perform mutation with rollback on error
    updateAlertPreferenceMutation.mutate({ alertType, enabled }, {
      onError: () => {
        // Rollback optimistic update on error
        queryClient.setQueryData(queryKey, previousData);
      }
    });
  };

  // Populate Telegram settings from query data
  useEffect(() => {
    if (telegramSettings && typeof telegramSettings === 'object') {
      const settings = telegramSettings as any;
      setTelegramEnabled(settings.telegramEnabled || false);
      setTelegramChatId(settings.telegramChatId || "");
      // Show placeholder for configured tokens (backend returns "***" for security)
      if (settings.telegramBotToken === "***") {
        setTelegramBotToken("••••••••••••••••••••••••••••••••••••••••••••••"); // Placeholder to show token is configured
      } else if (settings.telegramBotToken && settings.telegramBotToken !== "***") {
        setTelegramBotToken(settings.telegramBotToken);
      }
    }
  }, [telegramSettings]);

  const handleTelegramSave = () => {
    // Don't send placeholder dots - send empty string to keep existing token
    const tokenToSend = telegramBotToken.startsWith('••••') ? '' : telegramBotToken;
    
    updateTelegramMutation.mutate({
      botToken: tokenToSend,
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
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-[#0B1220]/70 border-b border-white/10 text-slate-100 px-4 py-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">ChirpBot</h1>
              <p className="text-[#10B981]/80 text-xs font-medium">Settings Dashboard</p>
            </div>
          </div>
          {isAuthenticated && (
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-emerald-500/30 text-[#10B981] hover:bg-emerald-500/10 hover:border-[#10B981] transition-all duration-300"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
      </header>

      {/* Sport Tabs */}
      <SportTabs
        sports={SPORTS}
        activeSport={activeSport}
        onSportChange={setActiveSport}
        onSportChangeCallback={() => {
          localStorage.setItem('settings-active-sport', activeSport);
        }}
      />

      {/* Settings Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Selected Sport Display */}
        <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <Target className="w-6 h-6 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">
                Sport Configuration
              </h2>
              <p className="text-sm text-slate-300">
                Manage your {activeSport} alert preferences and notifications
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="px-4 py-2 bg-[#10B981]/20 text-[#10B981] rounded-lg font-bold uppercase tracking-wide ring-1 ring-[#10B981]/30 shadow-lg shadow-emerald-500/25">
              {activeSport}
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400" />
            <p className="text-sm text-slate-300">
              Real-time alert configuration panel
            </p>
          </div>
        </div>

        {/* Alert Preferences */}
        {isAuthenticated && (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">
                  {activeSport} Alert Preferences
                </h2>
                <p className="text-sm text-slate-300">
                  Configure real-time notifications for {activeSport} game situations
                </p>
              </div>
            </div>

            {isSettingsLoading || !availableAlerts ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="w-full">
                {/* Dynamic Alert Types Section */}
                <div className="space-y-6">
                  {/* Core Game Alerts */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-black text-[#10B981] uppercase tracking-wide">
                      {activeSport === 'MLB' ? '⚾' : activeSport === 'NFL' ? '🏈' : activeSport === 'NCAAF' ? '🏈' : activeSport === 'WNBA' ? '🏀' : activeSport === 'CFL' ? '🏈' : '🏀'} {activeSport} Game Alerts
                    </h3>
                    <div className="space-y-3">
                      {(availableAlerts as any[] || []).map((alertType) => {
                        const isEnabled = getAlertPreference(activeSport, alertType.key);
                        // Check if this alert is globally disabled from the globalSettings we fetched
                        const isGloballyDisabled = globalSettings && typeof globalSettings === 'object' 
                          && (globalSettings as Record<string, boolean>)[alertType.key] === false;
                        
                        // Show skeleton if preference is still loading
                        if (isEnabled === undefined) {
                          return (
                            <div key={alertType.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 opacity-60">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {alertType.label}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  {alertType.description}
                                </p>
                              </div>
                              <div className="w-10 h-6 bg-slate-600 rounded-full animate-pulse"></div>
                            </div>
                          );
                        }
                        
                        return (
                          <div key={alertType.key} className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-300 group ${
                            isGloballyDisabled 
                              ? 'bg-red-500/5 border-red-500/20 opacity-60' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:ring-1 hover:ring-[#10B981]/30'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className={`text-sm font-semibold transition-colors ${
                                  isGloballyDisabled 
                                    ? 'text-red-400' 
                                    : 'text-slate-100 group-hover:text-[#10B981]'
                                }`}>
                                  {alertType.label}
                                  {isGloballyDisabled && (
                                    <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                                      Globally Disabled
                                    </span>
                                  )}
                                </h4>
                                {updateAlertPreferenceMutation.isPending && (
                                  <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
                                )}
                              </div>
                              <p className={`text-xs mt-1 ${isGloballyDisabled ? 'text-red-400/70' : 'text-slate-400'}`}>
                                {isGloballyDisabled 
                                  ? 'This alert type has been disabled by an administrator and cannot be enabled.' 
                                  : alertType.description
                                }
                              </p>
                            </div>
                            <Switch
                              checked={isEnabled && !isGloballyDisabled}
                              onCheckedChange={(enabled) => handleAlertToggle(alertType.key, enabled)}
                              disabled={updateAlertPreferenceMutation.isPending || isGloballyDisabled}
                              data-testid={`toggle-${alertType.key.toLowerCase()}`}
                              className="data-[state=checked]:bg-[#10B981]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Show message when no alerts are available or all are disabled */}
                  {(!availableAlerts || (availableAlerts as any[]).length === 0) && (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No alert cylinders available for {activeSport}.</p>
                    </div>
                  )}

                  {/* Show admin disabled message only for admin users */}
                  {user?.role === 'admin' && (availableAlerts as any[] || []).filter((alertType) => {
                    return globalSettings && typeof globalSettings === 'object' ? (globalSettings as Record<string, boolean>)[alertType.key] !== false : false;
                  }).length === 0 && (availableAlerts as any[] || []).length > 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-400">All {activeSport} alert types have been disabled by your administrator.</p>
                    </div>
                  )}
                </div>

                    
              </div>
            )}
          </div>
        )}

        {/* User Info Section */}
        {isAuthenticated && user && (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <SettingsIcon className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">Account Settings</h2>
                <p className="text-sm text-slate-300">
                  Logged in as <span className="text-[#10B981] font-semibold">{user.username}</span>
                </p>
                {user.email && (
                  <p className="text-xs text-slate-400">{user.email}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Telegram Configuration Section */}
        {isAuthenticated && user && (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <Send className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">Telegram Notifications</h2>
                <p className="text-sm text-slate-300">
                  Configure your personal Telegram bot for instant alert delivery
                </p>
              </div>
            </div>

            {telegramLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:ring-1 hover:ring-[#10B981]/30 transition-all duration-300 group">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 group-hover:text-[#10B981] transition-colors">Enable Telegram Notifications</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Receive real-time alerts via your personal Telegram bot
                    </p>
                  </div>
                  <Switch
                    checked={telegramEnabled}
                    onCheckedChange={setTelegramEnabled}
                    data-testid="toggle-telegram-enabled"
                    className="data-[state=checked]:bg-[#10B981]"
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
                      placeholder={telegramBotToken.startsWith('••••') ? "Bot token configured - enter new token to change" : "Enter your Telegram bot token"}
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      data-testid="input-telegram-bot-token"
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]/30 transition-all duration-300"
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
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]/30 transition-all duration-300"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Send /start to your bot, then message @userinfobot to get your chat ID
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={testTelegramConnection}
                    disabled={testingConnection || !telegramBotToken || !telegramChatId}
                    variant="outline"
                    size="sm"
                    data-testid="button-test-telegram"
                    className="border-emerald-500/30 text-[#10B981] hover:bg-emerald-500/10 hover:border-[#10B981] transition-all duration-300 group"
                  >
                    {testingConnection ? (
                      <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin mr-2" />
                    ) : connectionTestResult === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-[#10B981]" />
                    ) : connectionTestResult === 'error' ? (
                      <XCircle className="w-4 h-4 mr-2 text-red-400" />
                    ) : (
                      <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    onClick={handleTelegramSave}
                    disabled={updateTelegramMutation.isPending}
                    size="sm"
                    data-testid="button-save-telegram"
                    className="bg-[#10B981] hover:bg-emerald-600 text-slate-900 shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-all duration-300 group font-semibold"
                  >
                    {updateTelegramMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    )}
                    Save Settings
                  </Button>
                </div>

                {/* Help Text */}
                <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20 ring-1 ring-emerald-500/20">
                  <h4 className="text-sm font-semibold text-[#10B981] mb-2">How to Set Up Your Telegram Bot:</h4>
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
          </div>
        )}
        
        
      </div>
    </div>
  );
}