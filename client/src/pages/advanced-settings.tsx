import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Zap, Bell, CheckCircle, AlertCircle, LogOut, UserPlus, 
  Target, Clock, User, Cloud, Plus, TrendingUp, Send 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

interface AdvancedSettings {
  id: string;
  sport: string;
  aiEnabled: boolean;
  telegramEnabled: boolean;
  
  // MLB Alert Toggles
  gameStateAlerts?: boolean;
  rispAlerts?: boolean;
  weatherAlerts?: boolean;
  batterAlerts?: boolean;
  
  // NFL Alert Toggles
  redZoneAlerts?: boolean;
  twoMinuteAlerts?: boolean;
  fourthDownAlerts?: boolean;
  turnoverAlerts?: boolean;
  
  // NBA Alert Toggles
  clutchTimeAlerts?: boolean;
  overtimeAlerts?: boolean;
  leadChangeAlerts?: boolean;
  closeGameAlerts?: boolean;
  
  // NHL Alert Toggles
  powerPlayAlerts?: boolean;
  emptyNetAlerts?: boolean;
  thirdPeriodAlerts?: boolean;
  finalMinutesAlerts?: boolean;
}

export default function AdvancedSettings() {
  const [selectedSport, setSelectedSport] = useState("MLB");
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

  const { data: settings, isLoading } = useQuery<AdvancedSettings>({
    queryKey: ["/api/settings", { sport: selectedSport }],
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

  // Initialize form data with settings or defaults
  const [formData, setFormData] = useState<AdvancedSettings>({
    id: settings?.id || "",
    sport: selectedSport,
    aiEnabled: settings?.aiEnabled ?? true,
    telegramEnabled: settings?.telegramEnabled ?? false,
    
    // MLB defaults
    gameStateAlerts: settings?.gameStateAlerts ?? true,
    rispAlerts: settings?.rispAlerts ?? true,
    weatherAlerts: settings?.weatherAlerts ?? true,
    batterAlerts: settings?.batterAlerts ?? true,
    
    // NFL defaults
    redZoneAlerts: settings?.redZoneAlerts ?? true,
    twoMinuteAlerts: settings?.twoMinuteAlerts ?? true,
    fourthDownAlerts: settings?.fourthDownAlerts ?? true,
    turnoverAlerts: settings?.turnoverAlerts ?? true,
    
    // NBA defaults
    clutchTimeAlerts: settings?.clutchTimeAlerts ?? true,
    overtimeAlerts: settings?.overtimeAlerts ?? true,
    leadChangeAlerts: settings?.leadChangeAlerts ?? true,
    closeGameAlerts: settings?.closeGameAlerts ?? true,
    
    // NHL defaults
    powerPlayAlerts: settings?.powerPlayAlerts ?? true,
    emptyNetAlerts: settings?.emptyNetAlerts ?? true,
    thirdPeriodAlerts: settings?.thirdPeriodAlerts ?? true,
    finalMinutesAlerts: settings?.finalMinutesAlerts ?? true,
  });

  // Update form data when settings change
  React.useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        gameStateAlerts: settings.gameStateAlerts ?? true,
        rispAlerts: settings.rispAlerts ?? true,
        weatherAlerts: settings.weatherAlerts ?? true,
        batterAlerts: settings.batterAlerts ?? true,
        redZoneAlerts: settings.redZoneAlerts ?? true,
        twoMinuteAlerts: settings.twoMinuteAlerts ?? true,
        fourthDownAlerts: settings.fourthDownAlerts ?? true,
        turnoverAlerts: settings.turnoverAlerts ?? true,
        clutchTimeAlerts: settings.clutchTimeAlerts ?? true,
        overtimeAlerts: settings.overtimeAlerts ?? true,
        leadChangeAlerts: settings.leadChangeAlerts ?? true,
        closeGameAlerts: settings.closeGameAlerts ?? true,
        powerPlayAlerts: settings.powerPlayAlerts ?? true,
        emptyNetAlerts: settings.emptyNetAlerts ?? true,
        thirdPeriodAlerts: settings.thirdPeriodAlerts ?? true,
        finalMinutesAlerts: settings.finalMinutesAlerts ?? true,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AdvancedSettings>) => {
      const response = await apiRequest("PATCH", `/api/settings/${selectedSport}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your advanced alert settings have been saved.",
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

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  if (!isAuthenticated && !isAuthLoading) {
    return (
      <div className="min-h-screen bg-chirp-bg flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-chirp-red mx-auto" />
            <h2 className="text-xl font-bold text-chirp-dark">Authentication Required</h2>
            <p className="text-chirp-dark">Please log in to access your settings.</p>
            <Link href="/login">
              <Button className="w-full">Login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

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
            <p className="text-blue-200 text-xs font-medium">Advanced Alert Settings</p>
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
              onClick={() => setSelectedSport(sport)}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                selectedSport === sport
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
        ) : (
          <>
            {/* Core Settings */}
            <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                Core Settings
              </h2>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-enabled" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Analysis
                  </Label>
                  <Switch
                    id="ai-enabled"
                    checked={formData.aiEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, aiEnabled: checked }))}
                    data-testid="switch-ai-analysis"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="telegram-enabled" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Telegram Notifications
                  </Label>
                  <Switch
                    id="telegram-enabled"
                    checked={formData.telegramEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, telegramEnabled: checked }))}
                    data-testid="switch-telegram"
                  />
                </div>
                {formData.telegramEnabled && (
                  <div className="mt-4">
                    <Button
                      onClick={() => testTelegramMutation.mutate()}
                      disabled={testTelegramMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {telegramStatus === null && <Bell className="h-4 w-4" />}
                      {telegramStatus === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {telegramStatus === false && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {testTelegramMutation.isPending ? "Testing..." : "Test Telegram"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Sport-specific Alert Toggles */}
            {selectedSport === 'MLB' && (
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                  MLB Alert Types
                </h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="game-state-alerts" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Game State Alerts
                    </Label>
                    <Switch
                      id="game-state-alerts"
                      checked={formData.gameStateAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, gameStateAlerts: checked }))}
                      data-testid="switch-game-state"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="risp-alerts" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Runners in Scoring Position
                    </Label>
                    <Switch
                      id="risp-alerts"
                      checked={formData.rispAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, rispAlerts: checked }))}
                      data-testid="switch-risp"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="weather-alerts" className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      Weather Impact Alerts
                    </Label>
                    <Switch
                      id="weather-alerts"
                      checked={formData.weatherAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, weatherAlerts: checked }))}
                      data-testid="switch-weather"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="batter-alerts" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Power Batter Alerts
                    </Label>
                    <Switch
                      id="batter-alerts"
                      checked={formData.batterAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, batterAlerts: checked }))}
                      data-testid="switch-batter"
                    />
                  </div>
                </div>
              </Card>
            )}

            {selectedSport === 'NFL' && (
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                  NFL Alert Types
                </h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="red-zone-alerts" className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-500" />
                      Red Zone Opportunities
                    </Label>
                    <Switch
                      id="red-zone-alerts"
                      checked={formData.redZoneAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, redZoneAlerts: checked }))}
                      data-testid="switch-red-zone"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="two-minute-alerts" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Two-Minute Warnings
                    </Label>
                    <Switch
                      id="two-minute-alerts"
                      checked={formData.twoMinuteAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, twoMinuteAlerts: checked }))}
                      data-testid="switch-two-minute"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fourth-down-alerts" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Fourth Down Conversions
                    </Label>
                    <Switch
                      id="fourth-down-alerts"
                      checked={formData.fourthDownAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, fourthDownAlerts: checked }))}
                      data-testid="switch-fourth-down"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="turnover-alerts" className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Turnover Alerts
                    </Label>
                    <Switch
                      id="turnover-alerts"
                      checked={formData.turnoverAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, turnoverAlerts: checked }))}
                      data-testid="switch-turnover"
                    />
                  </div>
                </div>
              </Card>
            )}

            {selectedSport === 'NBA' && (
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                  NBA Alert Types
                </h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="clutch-time-alerts" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      Clutch Time (Final 5 Min)
                    </Label>
                    <Switch
                      id="clutch-time-alerts"
                      checked={formData.clutchTimeAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, clutchTimeAlerts: checked }))}
                      data-testid="switch-clutch-time"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="overtime-alerts" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Overtime Games
                    </Label>
                    <Switch
                      id="overtime-alerts"
                      checked={formData.overtimeAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, overtimeAlerts: checked }))}
                      data-testid="switch-overtime"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lead-change-alerts" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      High Lead Changes
                    </Label>
                    <Switch
                      id="lead-change-alerts"
                      checked={formData.leadChangeAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, leadChangeAlerts: checked }))}
                      data-testid="switch-lead-change"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="close-game-alerts" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Close Game Finishes
                    </Label>
                    <Switch
                      id="close-game-alerts"
                      checked={formData.closeGameAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, closeGameAlerts: checked }))}
                      data-testid="switch-close-game"
                    />
                  </div>
                </div>
              </Card>
            )}

            {selectedSport === 'NHL' && (
              <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-black uppercase tracking-wide text-chirp-blue mb-4">
                  NHL Alert Types
                </h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="power-play-alerts" className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      Power Play Opportunities
                    </Label>
                    <Switch
                      id="power-play-alerts"
                      checked={formData.powerPlayAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, powerPlayAlerts: checked }))}
                      data-testid="switch-power-play"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="empty-net-alerts" className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Empty Net Situations
                    </Label>
                    <Switch
                      id="empty-net-alerts"
                      checked={formData.emptyNetAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, emptyNetAlerts: checked }))}
                      data-testid="switch-empty-net"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="third-period-alerts" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Third Period Ties
                    </Label>
                    <Switch
                      id="third-period-alerts"
                      checked={formData.thirdPeriodAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, thirdPeriodAlerts: checked }))}
                      data-testid="switch-third-period"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="final-minutes-alerts" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Final Minutes Close Games
                    </Label>
                    <Switch
                      id="final-minutes-alerts"
                      checked={formData.finalMinutesAlerts}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, finalMinutesAlerts: checked }))}
                      data-testid="switch-final-minutes"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Save Button */}
            <div className="pt-4">
              <Button 
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                className="w-full bg-chirp-red hover:bg-red-700 text-white font-bold py-3"
                data-testid="button-save-settings"
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-chirp-dark hover:text-chirp-blue">
              <Bell className="w-5 h-5" />
              <span className="text-xs font-medium">Games</span>
            </Button>
          </Link>
          <Link href="/alerts">
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-chirp-dark hover:text-chirp-blue">
              <Zap className="w-5 h-5" />
              <span className="text-xs font-medium">Alerts</span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 text-chirp-red">
            <AlertCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}