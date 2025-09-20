import { useState, useEffect, useRef } from "react";
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

import { getSeasonAwareSports, getSportTabColors } from '@shared/season-manager';

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
  NCAAF: [
    { key: 'NCAAF_GAME_START', label: 'Game Start', description: 'Alert when NCAAF game begins' },
    { key: 'NCAAF_SECOND_HALF_KICKOFF', label: 'Second Half Kickoff', description: 'Alert when second half starts' },
    { key: 'NCAAF_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of each half' },
    { key: 'NCAAF_RED_ZONE', label: 'Red Zone Entry', description: 'Team enters the red zone (20-yard line)' },
    { key: 'NCAAF_FOURTH_DOWN_DECISION', label: 'Fourth Down Decision', description: 'Critical fourth down situations' },
    { key: 'NCAAF_RED_ZONE_EFFICIENCY', label: 'Red Zone Efficiency', description: 'Red zone scoring performance analysis' },
    { key: 'NCAAF_UPSET_OPPORTUNITY', label: 'Upset Opportunity', description: 'Underdog has high upset probability' },
    { key: 'NCAAF_MASSIVE_WEATHER', label: 'Weather Alert', description: 'Severe weather impacting game conditions' },
    { key: 'NCAAF_CLOSE_GAME', label: 'Close Game', description: 'Tight game in final quarters' },
    { key: 'NCAAF_COMEBACK_POTENTIAL', label: 'Comeback Potential', description: 'Team positioned for comeback' },
    { key: 'NCAAF_FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Final quarter begins in close games' },
    { key: 'NCAAF_HALFTIME', label: 'Halftime', description: 'Halftime break and adjustments' }
  ],
  WNBA: [
    // Core WNBA game situation alerts
    { key: 'WNBA_GAME_START', label: 'Game Start', description: 'Alert when WNBA game begins' },
    { key: 'WNBA_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Official two-minute warning in WNBA games' },
    { key: 'WNBA_FINAL_MINUTES', label: 'Final Minutes', description: 'Alert during final minutes of close games' },
    { key: 'WNBA_FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Alert when fourth quarter begins' },
    { key: 'WNBA_HIGH_SCORING_QUARTER', label: 'High Scoring Quarter', description: 'Alert for exceptionally high-scoring quarters' },
    { key: 'WNBA_LOW_SCORING_QUARTER', label: 'Low Scoring Quarter', description: 'Alert for defensive battles and low-scoring quarters' },
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

  // Get dynamic colors based on active sport
  const sportColors = getSportTabColors(activeSport);

  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Telegram settings state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);

  // Enhanced toggle management with status tracking
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [toggleSuccess, setToggleSuccess] = useState<Map<string, boolean>>(new Map());
  const [toggleErrors, setToggleErrors] = useState<Map<string, string>>(new Map());

  // Global settings query to check admin-disabled alerts (now available for ALL authenticated users)
  const { data: globalSettingsResponse, isLoading: globalSettingsLoading } = useQuery({
    queryKey: [`/api/global-alert-settings/${activeSport}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 5 * 1000, // Cache for 5 seconds (reduced to match server cache)
    refetchInterval: 10 * 1000, // Refetch every 10 seconds (more responsive)
  });
  
  // Extract settings from response (handles both old admin format and new public format)
  const globalSettings = (globalSettingsResponse as any)?.settings || globalSettingsResponse;

  // Available alert types query from cylinders (accessible to all authenticated users)
  const { data: availableAlerts, isLoading: availableAlertsLoading } = useQuery({
    queryKey: [`/api/available-alerts/${activeSport}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (rarely changes)
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
  });

  // Alert preferences query
  const { data: alertPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    refetchInterval: false, // No automatic refetching - only manual invalidation
  });

  // Clear pending toggles and status indicators when fresh data arrives from server
  useEffect(() => {
    if (!preferencesLoading && alertPreferences) {
      // Clear all pending states when fresh data has arrived
      setPendingToggles(new Set());
      setToggleSuccess(new Map());
      setToggleErrors(new Map());
    }
  }, [alertPreferences, preferencesLoading]);

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

  // Simplified helper to get alert preference without optimistic state complexity
  const getAlertPreference = (sport: string, alertType: string): boolean | undefined => {
    // Return undefined while loading to show skeleton UI
    if (isSettingsLoading) return undefined;

    // Check if the alert is globally disabled by admin (highest priority)
    if (globalSettings && typeof globalSettings === 'object' && (globalSettings as Record<string, boolean>)[alertType] === false) {
      return false;
    }

    // Simple: just check server state from preference map
    const serverPreference = preferenceMap.get(alertType);
    if (serverPreference !== undefined) {
      return serverPreference;
    }

    // Default to false for new preferences
    return false;
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

  // Alert preferences mutation with optimistic updates
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
    onMutate: async ({ alertType, enabled }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      const queryKey = [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`];
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value for potential rollback
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) {
          // If no data exists, create initial array with the new preference
          return [{ alertType, enabled, sport: activeSport }];
        }
        
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
      
      // Return context for potential rollback
      return { previousData, alertType };
    },
    onSuccess: (data, variables, context) => {
      // Show success indicator
      if (variables?.alertType) {
        setToggleSuccess(prev => new Map(prev).set(variables.alertType, true));
        
        // Clear success indicator after 2 seconds
        setTimeout(() => {
          setToggleSuccess(prev => {
            const newMap = new Map(prev);
            newMap.delete(variables.alertType);
            return newMap;
          });
        }, 2000);
      }
      
      // 🚀 MULTI-TAB CONSISTENCY: Invalidate with explicit cache busting
      queryClient.invalidateQueries({
        queryKey: [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`],
        exact: true
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/global-alert-settings/${activeSport}`],
        exact: true
      });
      
      // Also invalidate the broader patterns for cross-tab consistency
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('alert-preferences') || key?.includes('global-alert-settings');
        }
      });
    },
    onError: (error: any, variables, context) => {
      // Rollback cache to previous state
      if (context?.previousData) {
        const queryKey = [`/api/user/${user?.id}/alert-preferences/${activeSport.toLowerCase()}`];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      // 🚨 ENHANCED ERROR FEEDBACK: Show inline error indicator
      if (variables?.alertType) {
        const errorMessage = error?.message || error?.toString?.() || 'Update failed';
        setToggleErrors(prev => new Map(prev).set(variables.alertType, errorMessage));
        
        // Clear error indicator after 5 seconds
        setTimeout(() => {
          setToggleErrors(prev => {
            const newMap = new Map(prev);
            newMap.delete(variables.alertType);
            return newMap;
          });
        }, 5000);
      }
      
      // Extract meaningful error message
      const errorMessage = error?.message || error?.toString?.() || 'Unknown error occurred';
      
      // Only show toast for critical authentication errors
      if (errorMessage.includes('401') || errorMessage.includes('not authenticated') || errorMessage.includes('ID missing')) {
        toast({
          title: "Authentication Required",
          description: "Please log in to save your alert preferences.",
          variant: "destructive",
        });
      }
      // Other errors show inline feedback instead of toast spam
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

    // 🛡️ PRODUCTION SAFE: Prevent rapid toggles while mutation is pending
    if (pendingToggles.has(alertType)) {
      return;
    }

    // Clear any previous status indicators for this alert
    setToggleSuccess(prev => {
      const newMap = new Map(prev);
      newMap.delete(alertType);
      return newMap;
    });
    setToggleErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(alertType);
      return newMap;
    });

    // Add to pending toggles for immediate UI feedback
    setPendingToggles(prev => new Set([...prev, alertType]));
    
    // Simple immediate mutation without complex debouncing or optimistic state
    updateAlertPreferenceMutation.mutate(
      { alertType, enabled },
      {
        onSettled: () => {
          // Remove from pending toggles when mutation completes (success or error)
          setPendingToggles(prev => {
            const newSet = new Set(prev);
            newSet.delete(alertType);
            return newSet;
          });
        }
      }
    );
  };

  // Clear pending toggles when switching sports (simplified)
  useEffect(() => {
    setPendingToggles(new Set());
  }, [activeSport]);

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



  // Helper function to get category icon with dynamic sport colors
  const getCategoryIcon = (category: string) => {
    const iconColorClass = activeSport === 'MLB' ? 'text-green-400' :
                           activeSport === 'NFL' ? 'text-orange-400' :
                           activeSport === 'NBA' ? 'text-purple-400' :
                           activeSport === 'NCAAF' ? 'text-blue-400' :
                           activeSport === 'CFL' ? 'text-red-400' :
                           activeSport === 'WNBA' ? 'text-pink-400' :
                           'text-emerald-400';
    
    switch (category) {
      case "Game Situations":
        return <Target className={`w-4 h-4 ${iconColorClass}`} />;
      case "Scoring Events":
        return <Trophy className={`w-4 h-4 ${iconColorClass}`} />;
      case "At-Bat Situations":
        return <Clock className={`w-4 h-4 ${iconColorClass}`} />;
      default:
        return <Bell className={`w-4 h-4 ${iconColorClass}`} />;
    }
  };

  // Helper functions for sport-specific dynamic classes
  const getHoverBgClass = () => {
    return activeSport === 'MLB' ? 'hover:bg-green-500/20' :
           activeSport === 'NFL' ? 'hover:bg-orange-500/20' :
           activeSport === 'NBA' ? 'hover:bg-purple-500/20' :
           activeSport === 'NCAAF' ? 'hover:bg-blue-500/20' :
           activeSport === 'CFL' ? 'hover:bg-red-500/20' :
           activeSport === 'WNBA' ? 'hover:bg-pink-500/20' :
           'hover:bg-emerald-500/20';
  };

  const getHoverBorderClass = () => {
    return activeSport === 'MLB' ? 'hover:border-green-500' :
           activeSport === 'NFL' ? 'hover:border-orange-500' :
           activeSport === 'NBA' ? 'hover:border-purple-500' :
           activeSport === 'NCAAF' ? 'hover:border-blue-500' :
           activeSport === 'CFL' ? 'hover:border-red-500' :
           activeSport === 'WNBA' ? 'hover:border-pink-500' :
           'hover:border-emerald-500';
  };

  const getHoverRingClass = () => {
    return activeSport === 'MLB' ? 'hover:ring-green-500/30' :
           activeSport === 'NFL' ? 'hover:ring-orange-500/30' :
           activeSport === 'NBA' ? 'hover:ring-purple-500/30' :
           activeSport === 'NCAAF' ? 'hover:ring-blue-500/30' :
           activeSport === 'CFL' ? 'hover:ring-red-500/30' :
           activeSport === 'WNBA' ? 'hover:ring-pink-500/30' :
           'hover:ring-emerald-500/30';
  };

  const getGroupHoverTextClass = () => {
    return activeSport === 'MLB' ? 'group-hover:text-green-400' :
           activeSport === 'NFL' ? 'group-hover:text-orange-400' :
           activeSport === 'NBA' ? 'group-hover:text-purple-400' :
           activeSport === 'NCAAF' ? 'group-hover:text-blue-400' :
           activeSport === 'CFL' ? 'group-hover:text-red-400' :
           activeSport === 'WNBA' ? 'group-hover:text-pink-400' :
           'group-hover:text-emerald-400';
  };

  const getCheckedBgClass = () => {
    return activeSport === 'MLB' ? 'data-[state=checked]:bg-green-500' :
           activeSport === 'NFL' ? 'data-[state=checked]:bg-orange-500' :
           activeSport === 'NBA' ? 'data-[state=checked]:bg-purple-500' :
           activeSport === 'NCAAF' ? 'data-[state=checked]:bg-blue-500' :
           activeSport === 'CFL' ? 'data-[state=checked]:bg-red-500' :
           activeSport === 'WNBA' ? 'data-[state=checked]:bg-pink-500' :
           'data-[state=checked]:bg-emerald-500';
  };

  const getRingClass = () => {
    return activeSport === 'MLB' ? 'ring-green-500/30' :
           activeSport === 'NFL' ? 'ring-orange-500/30' :
           activeSport === 'NBA' ? 'ring-purple-500/30' :
           activeSport === 'NCAAF' ? 'ring-blue-500/30' :
           activeSport === 'CFL' ? 'ring-red-500/30' :
           activeSport === 'WNBA' ? 'ring-pink-500/30' :
           'ring-emerald-500/30';
  };

  const getBorderClass = () => {
    return activeSport === 'MLB' ? 'border-green-500' :
           activeSport === 'NFL' ? 'border-orange-500' :
           activeSport === 'NBA' ? 'border-purple-500' :
           activeSport === 'NCAAF' ? 'border-blue-500' :
           activeSport === 'CFL' ? 'border-red-500' :
           activeSport === 'WNBA' ? 'border-pink-500' :
           'border-emerald-500';
  };

  const getCardBgClass = () => {
    return activeSport === 'MLB' ? 'bg-green-500/5' :
           activeSport === 'NFL' ? 'bg-orange-500/5' :
           activeSport === 'NBA' ? 'bg-purple-500/5' :
           activeSport === 'NCAAF' ? 'bg-blue-500/5' :
           activeSport === 'CFL' ? 'bg-red-500/5' :
           activeSport === 'WNBA' ? 'bg-pink-500/5' :
           'bg-emerald-500/5';
  };

  const getCardBorderClass = () => {
    return activeSport === 'MLB' ? 'border-green-500/20' :
           activeSport === 'NFL' ? 'border-orange-500/20' :
           activeSport === 'NBA' ? 'border-purple-500/20' :
           activeSport === 'NCAAF' ? 'border-blue-500/20' :
           activeSport === 'CFL' ? 'border-red-500/20' :
           activeSport === 'WNBA' ? 'border-pink-500/20' :
           'border-emerald-500/20';
  };

  const getCardHoverBgClass = () => {
    return activeSport === 'MLB' ? 'hover:bg-green-500/10' :
           activeSport === 'NFL' ? 'hover:bg-orange-500/10' :
           activeSport === 'NBA' ? 'hover:bg-purple-500/10' :
           activeSport === 'NCAAF' ? 'hover:bg-blue-500/10' :
           activeSport === 'CFL' ? 'hover:bg-red-500/10' :
           activeSport === 'WNBA' ? 'hover:bg-pink-500/10' :
           'hover:bg-emerald-500/10';
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
            <div className={`h-10 w-10 rounded-lg ${sportColors.bg} ring-1 ${getRingClass()} flex items-center justify-center`}>
              <Zap className={`w-5 h-5 ${sportColors.text}`} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">ChirpBot</h1>
              <p className={`${sportColors.text} opacity-80 text-xs font-medium`}>Settings Dashboard</p>
            </div>
          </div>
          {isAuthenticated && (
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className={`${getBorderClass()} ${sportColors.text} ${getHoverBgClass()} transition-all duration-300`}
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
        onSportChange={(newSport) => {
          setActiveSport(newSport);
          localStorage.setItem('settings-active-sport', newSport);
        }}
      />

      {/* Settings Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">

        {/* Alert Preferences */}
        {isAuthenticated && (
          <div className={`bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl ${sportColors.bg}`}>
            <div className="flex items-center space-x-4 mb-6">
              <div className={`h-12 w-12 rounded-lg ${sportColors.bg} ring-1 ${getRingClass()} flex items-center justify-center`}>
                <Bell className={`w-6 h-6 ${sportColors.text}`} />
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
                <div className={`w-8 h-8 border-4 ${getBorderClass()} border-t-transparent rounded-full animate-spin`}></div>
              </div>
            ) : (
              <div className="w-full">
                {/* Dynamic Alert Types Section */}
                <div className="space-y-6">
                  {/* Core Game Alerts */}
                  <div className="space-y-3">
                    <h3 className={`text-lg font-black ${sportColors.text} uppercase tracking-wide`}>
                      {activeSport === 'MLB' ? '⚾' : activeSport === 'NFL' ? '🏈' : activeSport === 'NCAAF' ? '🏈' : activeSport === 'WNBA' ? '🏀' : activeSport === 'CFL' ? '🏈' : '🏀'} {activeSport} Game Alerts
                    </h3>
                    <div className="space-y-3">
                      {(availableAlerts as any[] || []).map((alertType) => {
                        const isEnabled = getAlertPreference(activeSport, alertType.key);
                        // Check if this alert is globally disabled from the globalSettings we fetched
                        const isGloballyDisabled = globalSettings && typeof globalSettings === 'object' 
                          && (globalSettings as Record<string, boolean>)[alertType.key] === false;
                        
                        // Get user preference regardless of global override to show true user intent
                        const userPreference = preferenceMap.get(alertType.key) ?? true;
                        
                        // Show skeleton if preference is still loading
                        if (isEnabled === undefined) {
                          return (
                            <div key={alertType.key} className={`flex items-center justify-between p-3 rounded-lg border opacity-60 ${getCardBgClass()} ${getCardBorderClass()}`}>
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
                              : `${getCardBgClass()} ${getCardBorderClass()} ${getCardHoverBgClass()} hover:ring-1 ${getHoverRingClass()}`
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className={`text-sm font-semibold transition-colors ${
                                  isGloballyDisabled 
                                    ? 'text-red-400' 
                                    : `text-slate-100 ${getGroupHoverTextClass()}`
                                }`}>
                                  {alertType.label}
                                  {isGloballyDisabled && (
                                    <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                                      Globally Disabled
                                    </span>
                                  )}
                                </h4>
                                {(updateAlertPreferenceMutation.isPending || pendingToggles.has(alertType.key)) && (
                                  <div className={`w-4 h-4 border-2 ${getBorderClass()} border-t-transparent rounded-full animate-spin`}></div>
                                )}
                              </div>
                              <p className={`text-xs mt-1 ${isGloballyDisabled ? 'text-red-400/70' : 'text-slate-400'}`}>
                                {isGloballyDisabled 
                                  ? `Admin disabled system-wide. ${userPreference ? 'Your preference: ON, but overridden → Effective: OFF' : 'Your preference: OFF (matches system)'}` 
                                  : alertType.description
                                }
                              </p>
                            </div>
                            <Switch
                              checked={isEnabled && !isGloballyDisabled}
                              onCheckedChange={(enabled) => handleAlertToggle(alertType.key, enabled)}
                              disabled={updateAlertPreferenceMutation.isPending || pendingToggles.has(alertType.key) || isGloballyDisabled}
                              data-testid={`toggle-${alertType.key.toLowerCase()}`}
                              className={`${getCheckedBgClass()} transition-all duration-200`}
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
          <div className={`bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl ${sportColors.bg}`}>
            <div className="flex items-center space-x-4">
              <div className={`h-12 w-12 rounded-lg ${sportColors.bg} ring-1 ${getRingClass()} flex items-center justify-center`}>
                <SettingsIcon className={`w-6 h-6 ${sportColors.text}`} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">Account Settings</h2>
                <p className="text-sm text-slate-300">
                  Logged in as <span className={`${sportColors.text} font-semibold`}>{user.username}</span>
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