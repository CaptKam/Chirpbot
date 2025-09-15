import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, User, Shield, Moon, Sun } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { AlertLoading } from '@/components/sports-loading';
import { useToast } from '@/hooks/use-toast';

interface UserSettings {
  id: string;
  pushNotifications: boolean;
  emailNotifications: boolean;
  darkMode: boolean;
  autoRefresh: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const { toast } = useToast();

  // Fetch user settings
  const { data: userSettings, isLoading, error } = useQuery<UserSettings[]>({
    queryKey: ['/api/settings']
  });

  // Handle settings data when it arrives
  useEffect(() => {
    if (userSettings && userSettings.length > 0) {
      setSettings(userSettings[0]);
    }
  }, [userSettings]);

  const handleSettingChange = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;

    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    // Here you would typically make an API call to update the settings
    // For now, we'll just show a toast notification
    toast({
      title: "Settings Updated",
      description: `${key} has been ${value ? 'enabled' : 'disabled'}`,
    });
  };

  if (isLoading) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen" data-testid="settings-loading">
        <PageHeader 
          title="Settings" 
          subtitle="Manage your preferences"
        />
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">
          <AlertLoading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen" data-testid="settings-error">
        <PageHeader 
          title="Settings" 
          subtitle="Manage your preferences"
        />
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-red-500/30 border-0">
            <CardContent className="p-8 text-center">
              <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-100 mb-2">Error Loading Settings</h3>
              <p className="text-slate-300">Unable to load your settings. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen" data-testid="settings-page">
      <PageHeader 
        title="Settings" 
        subtitle="Manage your preferences"
      />

      <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">
        {/* Notifications Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0" data-testid="card-notifications">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-100">
                <Bell className="h-5 w-5 text-emerald-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between" data-testid="setting-push-notifications">
                <div className="space-y-0.5">
                  <Label className="text-slate-100 font-medium">Push Notifications</Label>
                  <p className="text-slate-400 text-sm">Receive push notifications for alerts</p>
                </div>
                <Switch
                  checked={settings?.pushNotifications || false}
                  onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
                  data-testid="switch-push-notifications"
                />
              </div>
              
              <div className="flex items-center justify-between" data-testid="setting-email-notifications">
                <div className="space-y-0.5">
                  <Label className="text-slate-100 font-medium">Email Notifications</Label>
                  <p className="text-slate-400 text-sm">Receive email notifications for important alerts</p>
                </div>
                <Switch
                  checked={settings?.emailNotifications || false}
                  onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                  data-testid="switch-email-notifications"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0" data-testid="card-appearance">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-100">
                <Settings className="h-5 w-5 text-emerald-500" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between" data-testid="setting-dark-mode">
                <div className="space-y-0.5">
                  <Label className="text-slate-100 font-medium flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </Label>
                  <p className="text-slate-400 text-sm">Use dark theme throughout the app</p>
                </div>
                <Switch
                  checked={settings?.darkMode || false}
                  onCheckedChange={(checked) => handleSettingChange('darkMode', checked)}
                  data-testid="switch-dark-mode"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0" data-testid="card-general">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-100">
                <User className="h-5 w-5 text-emerald-500" />
                General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between" data-testid="setting-auto-refresh">
                <div className="space-y-0.5">
                  <Label className="text-slate-100 font-medium">Auto Refresh</Label>
                  <p className="text-slate-400 text-sm">Automatically refresh alerts in real-time</p>
                </div>
                <Switch
                  checked={settings?.autoRefresh || false}
                  onCheckedChange={(checked) => handleSettingChange('autoRefresh', checked)}
                  data-testid="switch-auto-refresh"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pb-8"
        >
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
            onClick={() => {
              toast({
                title: "Settings Saved",
                description: "Your preferences have been saved successfully.",
              });
            }}
            data-testid="button-save-settings"
          >
            Save Settings
          </Button>
        </motion.div>
      </div>
    </div>
  );
}