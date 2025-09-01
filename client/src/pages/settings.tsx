import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, LogOut, SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

export default function Settings() {
  const [activeSport, setActiveSport] = useState(() => {
    // Persist active sport selection in localStorage
    return localStorage.getItem('settings-active-sport') || "MLB";
  });
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

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
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

        {/* Placeholder for New Settings */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
            Settings Configuration
          </h2>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <SettingsIcon className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">
              Settings controls will be configured here.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}