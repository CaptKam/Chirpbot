
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';

// Alert type configurations
const ALERT_TYPE_CONFIG = {
  'MLB Alerts': [
    { key: 'MLB_BASES_LOADED', label: 'Bases Loaded', description: 'High scoring opportunity' },
    { key: 'MLB_RISP', label: 'Runner in Scoring Position', description: 'Runner on 2nd or 3rd base' },
    { key: 'MLB_CLOSE_GAME', label: 'Close Game', description: 'Game within 2 runs in late innings' },
    { key: 'MLB_LATE_PRESSURE', label: 'Late Pressure', description: '7th inning or later tension' },
    { key: 'MLB_HOT_HITTER', label: 'Hot Hitter', description: 'Batter on a hitting streak' },
    { key: 'MLB_POWER_HITTER', label: 'Power Hitter At Bat', description: '20+ HR hitter batting' },
    { key: 'MLB_GAME_START', label: 'Game Start', description: 'Game beginning notification' },
    { key: 'MLB_SEVENTH_INNING_STRETCH', label: 'Seventh Inning Stretch', description: 'Classic baseball moment' }
  ],
  'NFL Alerts': [
    { key: 'NFL_RED_ZONE', label: 'Red Zone', description: 'Team inside 20-yard line' },
    { key: 'NFL_FOURTH_DOWN', label: 'Fourth Down', description: 'Critical down conversion' },
    { key: 'NFL_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of half' },
    { key: 'NFL_GAME_START', label: 'Game Start', description: 'Game beginning notification' }
  ],
  'NCAAF Alerts': [
    { key: 'NCAAF_RED_ZONE', label: 'Red Zone', description: 'Team inside 25-yard line' },
    { key: 'NCAAF_FOURTH_DOWN', label: 'Fourth Down', description: 'Critical down conversion' },
    { key: 'NCAAF_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of half' },
    { key: 'NCAAF_GAME_START', label: 'Game Start', description: 'Game beginning notification' }
  ],
  'WNBA Alerts': [
    { key: 'WNBA_GAME_START', label: 'Game Start', description: 'Game beginning notification' },
    { key: 'WNBA_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of quarter' },
    { key: 'WNBA_FINAL_MINUTES', label: 'Final Minutes', description: 'Clutch time situations' },
    { key: 'WNBA_HIGH_SCORING_QUARTER', label: 'High Scoring Quarter', description: 'Explosive offensive quarter' },
    { key: 'WNBA_LOW_SCORING_QUARTER', label: 'Low Scoring Quarter', description: 'Defensive battle quarter' },
    { key: 'WNBA_FOURTH_QUARTER', label: 'Fourth Quarter', description: 'Final quarter action' }
  ],
  'CFL Alerts': [
    { key: 'CFL_RED_ZONE', label: 'Red Zone', description: 'Team inside 25-yard line' },
    { key: 'CFL_THIRD_DOWN', label: 'Third Down', description: 'Final down conversion' },
    { key: 'CFL_TWO_MINUTE_WARNING', label: 'Two Minute Warning', description: 'Final 2 minutes of half' },
    { key: 'CFL_GAME_START', label: 'Game Start', description: 'Game beginning notification' }
  ]
};

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user preferences
  const { data: userPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/user/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch global settings
  const { data: globalSettings } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/global-settings');
      if (!response.ok) throw new Error('Failed to fetch global settings');
      return response.json();
    }
  });

  // Update alert preference mutation
  const updateAlertPreferenceMutation = useMutation({
    mutationFn: async ({ sport, alertType, enabled }: { sport: string; alertType: string; enabled: boolean }) => {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [`${sport}_${alertType}`]: enabled
        })
      });
      if (!response.ok) throw new Error('Failed to update preference');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast({
        title: "Settings Updated",
        description: "Your alert preferences have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update user settings mutation
  const updateUserSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved.",
      });
    }
  });

  const getAlertPreferenceWithRE24 = (sport: string, alertKey: string) => {
    if (!userPreferences) return false;
    
    // Remove sport prefix if it exists in the key
    const cleanKey = alertKey.startsWith(`${sport}_`) ? alertKey : `${sport}_${alertKey}`;
    return userPreferences[cleanKey] || false;
  };

  const handleAlertToggle = (sport: string, alertKey: string, enabled: boolean) => {
    const cleanAlertType = alertKey.replace(`${sport}_`, '');
    updateAlertPreferenceMutation.mutate({ sport, alertType: cleanAlertType, enabled });
  };

  const handleSettingsUpdate = (settings: Record<string, string>) => {
    updateUserSettingsMutation.mutate(settings);
  };

  if (preferencesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="p-4 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Configure your alert preferences and integrations</p>
        </div>

        {/* Settings Content */}
        <div className="p-4 space-y-6">

          {/* Alert Preferences */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center space-x-2">
              <span>🚨</span>
              <span>Alert Preferences</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose which types of alerts you want to receive for each sport
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(ALERT_TYPE_CONFIG).map(([sportCategory, alertTypes]) => (
              <div key={sportCategory} className="space-y-3">
                <h3 className="text-md font-bold text-blue-400 uppercase tracking-wide">
                  {sportCategory.includes('MLB') && '⚾'} 
                  {sportCategory.includes('NFL') && '🏈'} 
                  {sportCategory.includes('NCAAF') && '🏈'} 
                  {sportCategory.includes('WNBA') && '🏀'} 
                  {sportCategory.includes('CFL') && '🏈'} 
                  {sportCategory}
                </h3>
                <div className="space-y-3">
                  {alertTypes.filter((alertType) => {
                    // Filter out disabled alerts from global settings
                    return globalSettings && typeof globalSettings === 'object' 
                      ? (globalSettings as Record<string, boolean>)[alertType.key] !== false 
                      : true;
                  }).map((alertType) => {
                    const sport = sportCategory.split(' ')[0]; // Extract sport (MLB, NFL, etc.)
                    const isEnabled = getAlertPreferenceWithRE24(sport, alertType.key);
                    
                    return (
                      <div key={alertType.key} className="flex items-center justify-between p-3 bg-slate-500/10 rounded-lg border border-slate-500/20 hover:bg-slate-500/20 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-semibold text-slate-100">
                              {alertType.label}
                            </h4>
                            {updateAlertPreferenceMutation.isPending && (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {alertType.description}
                          </p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(enabled) => handleAlertToggle(sport, alertType.key, enabled)}
                          disabled={updateAlertPreferenceMutation.isPending}
                        />
                      </div>
                    );
                  })}
                </div>
                {sportCategory !== Object.keys(ALERT_TYPE_CONFIG)[Object.keys(ALERT_TYPE_CONFIG).length - 1] && (
                  <Separator className="bg-slate-600/30" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

          {/* Telegram Integration */}
          <TelegramSettings onUpdate={handleSettingsUpdate} userPreferences={userPreferences} />

          {/* System Information */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center space-x-2">
              <span>ℹ️</span>
              <span>System Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">User ID</span>
              <Badge variant="outline" className="text-slate-300 border-slate-600">
                {user?.id}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Account Type</span>
              <Badge variant="outline" className="text-slate-300 border-slate-600">
                {user?.role || 'Standard'}
              </Badge>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Telegram Settings Component
function TelegramSettings({ onUpdate, userPreferences }: { 
  onUpdate: (settings: Record<string, string>) => void;
  userPreferences: any;
}) {
  const [botToken, setBotToken] = React.useState(userPreferences?.TELEGRAM_BOT_TOKEN || '');
  const [chatId, setChatId] = React.useState(userPreferences?.TELEGRAM_CHAT_ID || '');
  const [enabled, setEnabled] = React.useState(userPreferences?.TELEGRAM_ENABLED === 'true');

  const handleSave = () => {
    onUpdate({
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_CHAT_ID: chatId,
      TELEGRAM_ENABLED: enabled.toString()
    });
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center space-x-2">
          <span>📱</span>
          <span>Telegram Integration</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          Get instant notifications on Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Label className="text-slate-300">Enable Telegram Notifications</Label>
        </div>
        
        {enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="botToken" className="text-slate-300">Bot Token</Label>
              <Input
                id="botToken"
                placeholder="Your Telegram bot token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-slate-100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="chatId" className="text-slate-300">Chat ID</Label>
              <Input
                id="chatId"
                placeholder="Your Telegram chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-slate-100"
              />
            </div>
            
            <Button onClick={handleSave} className="w-full">
              Save Telegram Settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
