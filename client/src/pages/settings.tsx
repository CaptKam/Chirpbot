import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RetryFeedback, useRetryState } from "@/components/RetryFeedback";
import { EnhancedErrorDisplay, SettingsErrorBoundary, InlineErrorDisplay } from "@/components/EnhancedErrorDisplay";
import { parseApiError, parseTelegramError } from "@/utils/error-messages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, LogOut, SettingsIcon, Bell, Target, Trophy, Clock, TrendingUp, Users, AlertTriangle, Send, CheckCircle, XCircle, Monitor, BarChart3, ArrowRight, DollarSign, Star } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';
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
    { key: 'MLB_BASES_LOADED_ONE_OUT', label: 'Bases Loaded, 1 Out', description: '66% scoring probability situation' },
    { key: 'MLB_MOMENTUM_SHIFT', label: 'Momentum Shift', description: 'Multi-run innings and comeback scenarios' },
    { key: 'MLB_CLUTCH_SITUATION', label: 'Clutch Situation', description: 'High-pressure late-inning moments' }
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
  ],
  NBA: [
    // Core NBA game situation alerts
    { key: 'NBA_GAME_START', label: 'Game Start', description: 'Alert when NBA game begins' },
    { key: 'NBA_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Official two-minute warning in NBA games' },
    { key: 'NBA_FINAL_MINUTES', label: 'Final Minutes', description: 'Alert during final minutes of close games' },
    { key: 'NBA_FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Alert when fourth quarter begins' },
    { key: 'NBA_RED_ZONE', label: 'Red Zone Entry', description: 'Team enters scoring position' },
    { key: 'NBA_COMEBACK_POTENTIAL', label: 'Comeback Potential', description: 'Team positioned for comeback' },
    { key: 'NBA_CLOSE_GAME', label: 'Close Game', description: 'Tight game in final quarters' },
    { key: 'NBA_CLUTCH_TIME', label: 'Clutch Time', description: 'Critical moments in close games' },
    { key: 'NBA_OVERTIME', label: 'Overtime', description: 'Game extends to overtime' }
  ],
  NFL: [
    // Core NFL game situation alerts
    { key: 'NFL_GAME_START', label: 'Game Start', description: 'Alert when NFL game begins' },
    { key: 'NFL_SECOND_HALF_KICKOFF', label: 'Second Half Kickoff', description: 'Alert when second half starts' },
    { key: 'NFL_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Official two-minute warning' },
    { key: 'NFL_RED_ZONE', label: 'Red Zone Entry', description: 'Team enters the red zone (20-yard line)' },
    { key: 'NFL_RED_ZONE_OPPORTUNITY', label: 'Red Zone Opportunity', description: 'High-probability scoring opportunity' },
    { key: 'NFL_FOURTH_DOWN', label: 'Fourth Down', description: 'Critical fourth down situations' },
    { key: 'NFL_MASSIVE_WEATHER', label: 'Weather Alert', description: 'Severe weather impacting game conditions' },
    { key: 'NFL_TURNOVER_LIKELIHOOD', label: 'Turnover Likelihood', description: 'High probability of turnover' },
    { key: 'NFL_AI_SCANNER', label: 'AI Scanner', description: 'AI-powered game analysis and insights' }
  ],
  CFL: [
    // Core CFL game situation alerts
    { key: 'CFL_GAME_START', label: 'Game Start', description: 'Alert when CFL game begins' },
    { key: 'CFL_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of each half' },
    { key: 'CFL_RED_ZONE', label: 'Red Zone Entry', description: 'Team enters the red zone (20-yard line)' },
    { key: 'CFL_FOURTH_DOWN_DECISION', label: 'Fourth Down Decision', description: 'Critical fourth down situations' },
    { key: 'CFL_COMEBACK_POTENTIAL', label: 'Comeback Potential', description: 'Team positioned for comeback' },
    { key: 'CFL_CLOSE_GAME', label: 'Close Game', description: 'Tight game in final quarters' },
    { key: 'CFL_FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Final quarter begins in close games' },
    { key: 'CFL_HALFTIME', label: 'Halftime', description: 'Halftime break and adjustments' },
    { key: 'CFL_ROUGE_OPPORTUNITY', label: 'Rouge Opportunity', description: 'Single point scoring opportunity' }
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
  const { user, isAuthenticated, isAdminSession, isLoading: isAuthLoading } = useAuth();

  // Telegram settings state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);

  // Single user profile query for gambling insights (replaces broken gambling insights query)
  const { data: userProfile, isLoading: userProfileLoading, error: userProfileError } = useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user?.id && (isAuthenticated || isAdminSession),
    staleTime: 30000, // Cache for 30 seconds - reasonable freshness
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest/getQueryFn
  });

  const [testingOddsConnection, setTestingOddsConnection] = useState(false);
  const [oddsConnectionTestResult, setOddsConnectionTestResult] = useState<'success' | 'error' | null>(null);

  // 🔧 FIXED: Per-alert pending state instead of global mutex
  const [pendingAlerts, setPendingAlerts] = useState<Set<string>>(new Set());

  // Retry state management for each query section
  const globalSettingsRetry = useRetryState();
  const availableAlertsRetry = useRetryState();
  const alertPreferencesRetry = useRetryState();
  const telegramSettingsRetry = useRetryState();
  const gamblingInsightsRetry = useRetryState();

  // Global settings query to check admin-disabled alerts (now available for ALL authenticated users)
  const { data: globalSettingsResponse, isLoading: globalSettingsLoading, error: globalSettingsError } = useQuery({
    queryKey: [`/api/global-alert-settings/${activeSport}`],
    enabled: !!user?.id && (isAuthenticated || isAdminSession),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (global settings rarely change)
    refetchInterval: false, // No polling - only refetch on manual invalidation
    refetchOnWindowFocus: false, // No refetch on window focus
    refetchOnReconnect: false, // No refetch on network reconnect
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest/getQueryFn
  });

  // Extract settings from response (handles both old admin format and new public format)
  const globalSettings = (globalSettingsResponse as any)?.settings || globalSettingsResponse;

  // Available alert types query from cylinders - PUBLIC endpoint (no auth required)
  const { data: availableAlerts, isLoading: availableAlertsLoading, error: availableAlertsError } = useQuery({
    queryKey: [`/api/available-alerts/${activeSport.toLowerCase()}`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (rarely changes)
    refetchInterval: false, // No polling - only refetch on manual invalidation
    refetchOnWindowFocus: false, // No refetch on window focus
    refetchOnReconnect: false, // No refetch on network reconnect
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest/getQueryFn
  });

  // 🔧 FIXED: Hierarchical query keys for proper cache invalidation with stable sentinel for unauthenticated users
  const queryKeySegments = user?.id 
    ? ['/api/user', user.id, 'alert-preferences', activeSport.toLowerCase()] 
    : ['/api/user', 'alert-preferences', 'disabled', activeSport.toLowerCase()];

  // Alert preferences query
  const { data: alertPreferences, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: queryKeySegments,
    queryFn: async () => {
      if (!user?.id) throw new Error('User ID required');
      const response = await apiRequest("GET", `/api/user/${user.id}/alert-preferences/${activeSport.toLowerCase()}`);
      return response.json();
    },
    enabled: !!user?.id && (isAuthenticated || isAdminSession),
    staleTime: 30000, // Cache for 30 seconds - reasonable freshness
    gcTime: 5 * 60 * 1000, // 5 minute garbage collection
    refetchInterval: false, // No automatic refetching - only manual invalidation
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest/getQueryFn
  });

  // 🔧 FIXED: Clear pending state when data loads
  useEffect(() => {
    if (!preferencesLoading && alertPreferences) {
      setPendingAlerts(new Set());
    }
  }, [alertPreferences, preferencesLoading]);

  // Telegram settings query
  const { data: telegramSettings, isLoading: telegramLoading, error: telegramError } = useQuery({
    queryKey: [`/api/user/${user?.id}/telegram`],
    enabled: !!user?.id && (isAuthenticated || isAdminSession),
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest/getQueryFn
  });

  // REMOVED: Broken gambling insights query - replaced with single user profile query above
  // REMOVED: Unused odds API settings query - gambling insights now managed through /api/users/me

  // REMOVED: Combined loading state that caused cascade failures
  // Each section now handles its own loading states independently

  // Create a map of current preferences for easy lookup
  const preferenceMap = new Map();
  if (alertPreferences && Array.isArray(alertPreferences)) {
    alertPreferences.forEach((pref: any) => {
      preferenceMap.set(pref.alertType, pref.enabled);
    });
  }

  // Helper to get alert preference - returns user's actual preference (not masked by global settings)
  // Now handles individual loading states instead of combined state to prevent cascade failures
  const getAlertPreference = (sport: string, alertType: string): boolean | undefined => {
    // Check if this alert is currently pending a mutation
    if (pendingAlerts.has(alertType)) {
      return undefined; // Show loading state for pending alerts
    }

    // If preferences are still loading, show skeleton for this specific alert
    if (preferencesLoading) {
      return undefined;
    }

    // Return user's actual preference from the map (don't mask with global settings)
    const serverPreference = preferenceMap.get(alertType);
    if (serverPreference !== undefined) {
      return serverPreference;
    }

    // Default to false for new preferences
    return false;
  };

  // Helper to check if alert is globally disabled
  const isAlertGloballyDisabled = (alertType: string): boolean => {
    return globalSettings && typeof globalSettings === 'object' 
      && (globalSettings as Record<string, boolean>)[alertType] === false;
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

  // 🔧 COMPLETELY SIMPLIFIED: No optimistic updates, no complex state management
  const updateAlertPreferenceMutation = useMutation({
    mutationFn: async ({ alertType, enabled }: { alertType: string; enabled: boolean }) => {
      if (!user?.id) {
        throw new Error('User not authenticated or ID missing');
      }

      console.log(`📤 API Request: ${alertType} = ${enabled}`);
      const response = await apiRequest("POST", `/api/user/${user.id}/alert-preferences`, {
        sport: activeSport.toLowerCase(),
        alertType,
        enabled
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorData}`);
      }

      return response.json();
    },
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest
    onMutate: ({ alertType, enabled }) => {
      console.log(`🔄 Mutation starting: ${alertType} = ${enabled}`);
    },
    onSuccess: (data, { alertType, enabled }) => {
      console.log(`✅ Mutation success: ${alertType} = ${enabled}`, data);

      // Optimized: Only invalidate the specific sport's cache
      if (queryKeySegments.length > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeySegments });
      }

      // Clear pending state after successful update
      setPendingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertType);
        return newSet;
      });

      // Show success toast
      toast({
        title: "Setting Updated",
        description: `${alertType.replace(/[A-Z]+_/g, '').replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error: any, { alertType, enabled }) => {
      console.error(`❌ Mutation error: ${alertType} = ${enabled}`, error);

      // Clear pending state on error
      setPendingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertType);
        return newSet;
      });

      // Parse error to get specific, actionable error message
      const parsedError = parseApiError(error, 'alert-preferences');
      const alertDisplayName = alertType.replace(/[A-Z]+_/g, '').replace(/_/g, ' ');
      
      toast({
        title: parsedError.title,
        description: parsedError.message,
        variant: "destructive",
      });
    },
    onSettled: (data, error, { alertType }) => {
      // Mutation completed - no additional actions needed
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
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user/${user?.id}/telegram`]
      });
      toast({
        title: "Telegram settings updated",
        description: "Your Telegram configuration has been saved.",
      });
    },
    onError: (error: any) => {
      // Parse error to get specific, actionable error message
      const parsedError = parseApiError(error, 'telegram-settings');
      
      toast({
        title: parsedError.title,
        description: parsedError.message,
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
      
      // Parse Telegram-specific error to get actionable message
      const parsedError = parseTelegramError(error);
      
      toast({
        title: parsedError.title,
        description: parsedError.message,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Optimistic gambling insights mutation using PATCH /api/users/me
  const updateGamblingInsightsMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/users/me`, {
        oddsApiEnabled: enabled
      });
      return response.json();
    },
    retry: 0, // Disabled - p-retry handles all retry logic in apiRequest
    onMutate: async ({ enabled }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/users/me'] });
      
      // Snapshot the previous value
      const previousUser = queryClient.getQueryData(['/api/users/me']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['/api/users/me'], (old: any) => ({
        ...old,
        oddsApiEnabled: enabled
      }));
      
      // Return context object with snapshot
      return { previousUser };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error using the snapshot
      if (context?.previousUser) {
        queryClient.setQueryData(['/api/users/me'], context.previousUser);
      }
      
      // Parse error to get specific, actionable error message
      const parsedError = parseApiError(error, 'gambling-insights');
      
      toast({
        title: parsedError.title,
        description: parsedError.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to ensure we have latest server state
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
    },
    onSuccess: (data, { enabled }) => {
      toast({
        title: "Gambling insights updated",
        description: `Gambling insights ${enabled ? 'enabled' : 'disabled'} successfully.`,
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Simple optimistic toggle handler - no local state needed
  const handleGamblingInsightsToggle = (enabled: boolean) => {
    // Prevent concurrent toggles
    if (updateGamblingInsightsMutation.isPending) {
      return;
    }

    // Execute optimistic mutation
    updateGamblingInsightsMutation.mutate({ enabled });
  };

  // 🔧 FIXED: Debounced toggle handler to prevent rapid duplicate calls
  const handleAlertToggle = useCallback((alertType: string, enabled: boolean) => {
    // Early validation
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to change alert preferences.",
        variant: "destructive",
      });
      return;
    }

    // Don't allow toggling if globally disabled
    if (isAlertGloballyDisabled(alertType)) {
      toast({
        title: "Alert Disabled",
        description: "This alert has been disabled system-wide by the administrator.",
        variant: "destructive",
      });
      return;
    }

    // 🔧 FIXED: Immediate pending state check with mutex protection
    if (pendingAlerts.has(alertType) || updateAlertPreferenceMutation.isPending) {
      return;
    }

    // Get current preference to prevent unnecessary toggles
    const currentPreference = getAlertPreference(activeSport, alertType);
    if (currentPreference === enabled) {
      return;
    }

    // 🔧 FIXED: Immediate synchronous pending state update to prevent race conditions
    setPendingAlerts(prev => {
      const newSet = new Set(prev);
      newSet.add(alertType);
      return newSet;
    });

    // Execute mutation
    updateAlertPreferenceMutation.mutate({ alertType, enabled });
  }, [user?.id, pendingAlerts, updateAlertPreferenceMutation, activeSport, getAlertPreference, isAlertGloballyDisabled]);

  // 🔧 FIXED: Clear pending alerts when switching sports
  useEffect(() => {
    setPendingAlerts(new Set());
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

  // REMOVED: useEffect state syncing that causes race conditions and flickering

  const handleTelegramSave = () => {
    // Don't send placeholder dots - send empty string to keep existing token
    const tokenToSend = telegramBotToken.startsWith('••••') ? '' : telegramBotToken;

    updateTelegramMutation.mutate({
      botToken: tokenToSend,
      chatId: telegramChatId,
      enabled: telegramEnabled
    });
  };



  // Unified sport color class generator — one lookup replaces 13 functions
  const SPORT_COLOR_MAP: Record<string, string> = {
    MLB: 'green', NFL: 'orange', NBA: 'purple', NCAAF: 'blue', CFL: 'red', WNBA: 'pink',
  };
  const sportColor = SPORT_COLOR_MAP[activeSport] || 'blue';

  const sc = useMemo(() => ({
    hoverBg: `hover:bg-${sportColor}-500/20`,
    hoverBorder: `hover:border-${sportColor}-500`,
    hoverRing: `hover:ring-${sportColor}-500/30`,
    hoverBgLight: `hover:bg-${sportColor}-500/10`,
    groupHoverText: `group-hover:text-${sportColor}-400`,
    checkedBg: `data-[state=checked]:bg-${sportColor}-500`,
    ring: `ring-${sportColor}-500/30`,
    border: `border-${sportColor}-500`,
    borderLight: `border-${sportColor}-500/20`,
    cardBg: `bg-${sportColor}-500/5`,
    text: `text-${sportColor}-400`,
  }), [sportColor]);

  const getCategoryIcon = (category: string) => {
    const iconClass = `w-4 h-4 ${sc.text}`;
    switch (category) {
      case "Game Situations": return <Target className={iconClass} />;
      case "Scoring Events": return <Trophy className={iconClass} />;
      case "At-Bat Situations": return <Clock className={iconClass} />;
      default: return <Bell className={iconClass} />;
    }
  };

  const getHoverBgClass = () => sc.hoverBg;
  const getHoverBorderClass = () => sc.hoverBorder;
  const getHoverRingClass = () => sc.hoverRing;
  const getGroupHoverTextClass = () => sc.groupHoverText;
  const getCheckedBgClass = () => sc.checkedBg;
  const getRingClass = () => sc.ring;
  const getBorderClass = () => sc.border;
  const getCardBgClass = () => sc.cardBg;
  const getCardBorderClass = () => sc.borderLight;
  const getCardHoverBgClass = () => sc.hoverBgLight;

  if (isAuthLoading) {
    return <AuthLoading />;
  }

  return (
    <div className="pb-24 sm:pb-28 bg-solidBackground text-white antialiased min-h-screen">
      <PageHeader
        title="ChirpBot"
        subtitle="Settings Dashboard"
      >
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
      </PageHeader>

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

            {/* Retry feedback for alert preferences */}
            <RetryFeedback
              isRetrying={alertPreferencesRetry.isRetrying || availableAlertsRetry.isRetrying}
              retryAttempt={Math.max(alertPreferencesRetry.retryAttempt, availableAlertsRetry.retryAttempt)}
              error={preferencesError || availableAlertsError}
            />

            <SettingsErrorBoundary
              error={preferencesError || availableAlertsError}
              context="alert-preferences"
              onRetry={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/available-alerts/${activeSport.toLowerCase()}`] });
                if (queryKeySegments.length > 0) {
                  queryClient.invalidateQueries({ queryKey: queryKeySegments });
                }
              }}
              isLoading={(preferencesLoading || availableAlertsLoading) && !availableAlerts}
              isRetrying={alertPreferencesRetry.isRetrying || availableAlertsRetry.isRetrying}
            >
              {/* Alert preferences content */}
              <div className="w-full">
                {/* Dynamic Alert Types Section */}
                <div className="space-y-6">
                  {/* Core Game Alerts */}
                  <div className="space-y-3">
                    <h3 className={`text-lg font-black ${sportColors.text} uppercase tracking-wide`}>
                      {activeSport === 'MLB' ? '⚾' : activeSport === 'NFL' ? '🏈' : activeSport === 'NCAAF' ? '🏈' : activeSport === 'WNBA' ? '🏀' : activeSport === 'CFL' ? '🏈' : '🏀'} {activeSport} Game Alerts
                    </h3>
                    <div className="space-y-3">
                      {/* Always use local config as primary source, enhance with API data when available */}
                      {(() => {
                        // Start with local config as the base
                        const baseAlerts = ALERT_TYPE_CONFIG[activeSport] || [];
                        // If API data is available, use it to enhance the local config
                        const alertsToShow = Array.isArray(availableAlerts) && availableAlerts.length > 0 
                          ? availableAlerts 
                          : baseAlerts;
                        return alertsToShow;
                      })().map((alertType: any) => {
                        const userPreference = getAlertPreference(activeSport, alertType.key);
                        const isGloballyDisabled = isAlertGloballyDisabled(alertType.key);
                        const isPending = pendingAlerts.has(alertType.key);

                        // Show skeleton if preference is still loading or pending
                        if (userPreference === undefined || isPending) {
                          return (
                            <div key={alertType.key} className={`flex items-center justify-between p-3 rounded-lg border opacity-60 ${getCardBgClass()} ${getCardBorderClass()}`}>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {alertType.label}
                                  </h4>
                                  {isPending && (
                                    <div className={`w-4 h-4 border-2 ${getBorderClass()} border-t-transparent rounded-full animate-spin`}></div>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  {isPending ? 'Updating preference...' : alertType.description}
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
                              : `${sportClasses.cardBg} border-white/10 ${sportClasses.hoverBg} hover:ring-1 ring-white/20`
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
                                {pendingAlerts.has(alertType.key) && (
                                  <div className={`w-4 h-4 border-2 ${getBorderClass()} border-t-transparent rounded-full animate-spin`}></div>
                                )}
                              </div>
                              <p className={`text-xs mt-1 ${isGloballyDisabled ? 'text-red-400/70' : 'text-slate-400'}`}>
                                {isGloballyDisabled 
                                  ? `Admin disabled system-wide. Your preference: ${userPreference ? 'ON' : 'OFF'}, but effective state: OFF` 
                                  : alertType.description
                                }</p>
                            </div>
                            <Switch
                              checked={userPreference || false}
                              onCheckedChange={(enabled) => {
                                console.log(`🎯 Switch toggled: ${alertType.key} from ${userPreference} to ${enabled}`);
                                handleAlertToggle(alertType.key, enabled);
                              }}
                              disabled={isPending || isGloballyDisabled || updateAlertPreferenceMutation.isPending}
                              data-testid={`toggle-${alertType.key.toLowerCase()}`}
                              className={`${isGloballyDisabled ? 'opacity-50' : sportClasses.checkedBg} transition-all duration-200 ${isPending ? 'pointer-events-none' : ''}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Show message only when no alerts exist in local config AND API */}
                  {(!ALERT_TYPE_CONFIG[activeSport] || ALERT_TYPE_CONFIG[activeSport].length === 0) && 
                   (!availableAlerts || (availableAlerts as any[]).length === 0) && (
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
            </SettingsErrorBoundary>
          </div>
        )}

        {/* Gambling Insights Settings Section */}
        {isAuthenticated && user && (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-purple-500/5">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 ring-1 ring-purple-500/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">Gambling Insights</h2>
                <p className="text-sm text-slate-300">
                  Enhanced alert information with betting insights and analysis
                </p>
              </div>
            </div>

            {/* Retry feedback for user profile */}
            <RetryFeedback
              isRetrying={gamblingInsightsRetry.isRetrying}
              retryAttempt={gamblingInsightsRetry.retryAttempt}
              error={userProfileError}
            />

            <SettingsErrorBoundary
              error={userProfileError}
              context="gambling-insights"
              onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/users/me'] })}
              isLoading={userProfileLoading}
              isRetrying={gamblingInsightsRetry.isRetrying}
            >
              <div className="space-y-4">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:ring-1 hover:ring-purple-400/30 transition-all duration-300 group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-purple-400 transition-colors">
                        Enable Gambling Insights
                      </h4>
                      <Badge 
                        variant="outline" 
                        className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs"
                      >
                        BETA
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      Show additional betting insights, market analysis, and strategic bullet points with your alerts
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md">Bullet Points</span>
                      <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md">Market Data</span>
                      <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md">Strategy Tips</span>
                    </div>
                  </div>
                  <Switch
                    checked={(userProfile as any)?.oddsApiEnabled || false}
                    onCheckedChange={handleGamblingInsightsToggle}
                    disabled={updateGamblingInsightsMutation.isPending}
                    data-testid="toggle-gambling-insights"
                    className="data-[state=checked]:bg-purple-400 ml-4"
                  />
                </div>

                {/* Feature Description */}
                {(userProfile as any)?.oddsApiEnabled && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Star className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="text-sm font-medium text-purple-300 mb-1">
                          Enhanced Alerts Active
                        </h5>
                        <p className="text-xs text-purple-200/80 leading-relaxed">
                          Your alerts will now include gambling insights when available. This includes strategic bullet points,
                          betting market analysis, weather impact assessments, and player performance insights to help you
                          make more informed decisions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SettingsErrorBoundary>
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
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-primaryBlue/5">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-lg bg-primaryBlue/20 ring-1 ring-primaryBlue/30 flex items-center justify-center">
                <Send className="w-6 h-6 text-[#2489F5]" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">Telegram Notifications</h2>
                <p className="text-sm text-slate-300">
                  Configure your personal Telegram bot for instant alert delivery
                </p>
              </div>
            </div>

            {/* Retry feedback for telegram settings */}
            <RetryFeedback
              isRetrying={telegramSettingsRetry.isRetrying}
              retryAttempt={telegramSettingsRetry.retryAttempt}
              error={telegramError}
            />

            <SettingsErrorBoundary
              error={telegramError}
              context="telegram-settings"
              onRetry={() => queryClient.invalidateQueries({ queryKey: [`/api/user/${user?.id}/telegram`] })}
              isLoading={telegramLoading}
              isRetrying={telegramSettingsRetry.isRetrying}
            >
              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:ring-1 hover:ring-[#2489F5]/30 transition-all duration-300 group">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 group-hover:text-[#2489F5] transition-colors">Enable Telegram Notifications</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Receive real-time alerts via your personal Telegram bot
                    </p>
                  </div>
                  <Switch
                    checked={telegramEnabled}
                    onCheckedChange={setTelegramEnabled}
                    data-testid="toggle-telegram-enabled"
                    className="data-[state=checked]:bg-[#2489F5]"
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
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-[#2489F5] focus:ring-1 focus:ring-[#2489F5]/30 transition-all duration-300"
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
                      className="mt-2 bg-white/5 border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-[#2489F5] focus:ring-1 focus:ring-[#2489F5]/30 transition-all duration-300"
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
                    className="border-primaryBlue/30 text-primaryBlue hover:bg-primaryBlue/10 hover:border-[#2489F5] transition-all duration-300 group"
                  >
                    {testingConnection ? (
                      <div className="w-4 h-4 border-2 border-[#2489F5] border-t-transparent rounded-full animate-spin mr-2" />
                    ) : connectionTestResult === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-[#2489F5]" />
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
                    className="bg-primaryBlue hover:bg-blue-600 text-white shadow-lg shadow-primaryBlue/25 hover:scale-[1.02] transition-all duration-300 group font-semibold"
                  >
                    {updateTelegramMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    )}
                    Save Settings
                  </Button>
                </div>

                {/* Help Text */}
                <div className="p-4 bg-primaryBlue/10 rounded-lg border border-primaryBlue/20 ring-1 ring-primaryBlue/20">
                  <h4 className="text-sm font-semibold text-[#2489F5] mb-2">How to Set Up Your Telegram Bot:</h4>
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
            </SettingsErrorBoundary>
          </div>
        )}


      </div>
    </div>
  );
}