
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AuthLoading } from '@/components/sports-loading';
import { Settings as SettingsIcon, Bell, Globe, ShieldAlert, Target, Trophy, Clock, Zap, Bot, BarChart3 } from "lucide-react";

// Empty alert configuration - ready for new modules
const ALERT_TYPE_CONFIG = {
  MLB: {
    // No alert types configured yet
  },
  NFL: {
    // No alert types configured yet
  },
  NBA: {
    // No alert types configured yet
  },
  NHL: {
    // No alert types configured yet
  },
  CFL: {
    // No alert types configured yet
  },
  NCAAF: {
    // No alert types configured yet
  }
};

export default function Settings() {
  const [selectedSport, setSelectedSport] = useState<string>("MLB");
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Fetch user alert preferences
  const { data: userAlertPreferences = [], isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/alert-preferences/${selectedSport.toLowerCase()}`],
    enabled: isAuthenticated && !!user?.id,
  });

  // Fetch global settings for filtering
  const { data: globalSettings } = useQuery({
    queryKey: ['/api/admin/global-settings'],
    enabled: isAuthenticated,
  });

  // Alert preference update mutation
  const updateAlertPreferenceMutation = useMutation({
    mutationFn: async ({ alertType, enabled }: { alertType: string; enabled: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const response = await apiRequest("POST", `/api/user/${user.id}/alert-preferences`, {
        sport: selectedSport,
        alertType,
        enabled
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/user/${user?.id}/alert-preferences/${selectedSport.toLowerCase()}`] 
      });
      
      toast({
        title: "Alert preference updated",
        description: `${variables.alertType} ${variables.enabled ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error: any) => {
      if (error.message.includes('globally disabled')) {
        toast({
          title: "Cannot enable alert",
          description: "This alert type has been disabled by your administrator.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update alert preference. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleAlertToggle = (alertType: string, enabled: boolean) => {
    updateAlertPreferenceMutation.mutate({ alertType, enabled });
  };

  if (isLoading) {
    return <AuthLoading message="Loading settings..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Authentication Required</h1>
          <p className="text-slate-400">Please log in to access your settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500/20 ring-1 ring-blue-500/30 rounded-full flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Alert Settings</h1>
            <p className="text-blue-300/80 text-xs font-medium">Configure Your Notifications</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Sport Selection */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100">
              Sport Selection
            </h2>
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-32 bg-white/10 border-white/20 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="MLB">MLB</SelectItem>
                <SelectItem value="NFL">NFL</SelectItem>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="NHL">NHL</SelectItem>
                <SelectItem value="CFL">CFL</SelectItem>
                <SelectItem value="NCAAF">NCAAF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Alert Configuration */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-6">
            {selectedSport} Alert Preferences
          </h2>

          {preferencesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Show empty state message */}
              <div className="text-center py-12">
                <Bot className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-100 mb-2">No Alert Types Configured</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  The alert system has been reset. No alert modules are currently available for {selectedSport}.
                  Contact your administrator to configure new alert types.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* System Status */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
            System Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-medium text-slate-100">Alert Modules</span>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                RESET
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-100">Global Settings</span>
              </div>
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                CLEARED
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
