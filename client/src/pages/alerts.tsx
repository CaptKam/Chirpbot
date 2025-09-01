import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, AlertTriangle, TrendingUp, Clock, Filter, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Alert {
  id: string;
  alertKey: string;
  sport: string;
  gameId: string;
  type: string;
  state: string;
  score: number;
  payload: {
    type: string;
    phase: string;
    score: number;
    sport: string;
    gameId: string;
    context: any;
    situation: string;
    ruleVersion: string;
    weatherBucket?: string;
  };
  createdAt: string;
}

const ALERT_TYPES = {
  HIGH_SCORING_OPP: { label: "High Scoring Opportunity", icon: TrendingUp, color: "emerald" },
  RED_ZONE: { label: "Red Zone", icon: AlertTriangle, color: "orange" },
  HOME_RUN: { label: "Home Run", icon: TrendingUp, color: "blue" },
  TOUCHDOWN: { label: "Touchdown", icon: TrendingUp, color: "green" },
  DEFAULT: { label: "Alert", icon: Bell, color: "slate" }
};

export default function Alerts() {
  const [selectedSport, setSelectedSport] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const { user, isAuthenticated } = useAuth();

  const { data: alertsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/alerts", { limit: "50", sport: selectedSport !== "ALL" ? selectedSport : undefined }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      
      if (params.limit) searchParams.set('limit', params.limit);
      if (params.sport) searchParams.set('sport', params.sport);
      
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const alerts: Alert[] = alertsData?.alerts || [];

  // Filter alerts by type if selected
  const filteredAlerts = selectedType === "ALL" 
    ? alerts 
    : alerts.filter(alert => alert.type === selectedType);

  // Get unique sports and types for filtering
  const availableSports = ["ALL", ...Array.from(new Set(alerts.map(alert => alert.sport)))];
  const availableTypes = ["ALL", ...Array.from(new Set(alerts.map(alert => alert.type)))];

  const getAlertConfig = (type: string) => {
    return ALERT_TYPES[type as keyof typeof ALERT_TYPES] || ALERT_TYPES.DEFAULT;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-slate-400";
  };

  const formatContext = (context: any, sport: string) => {
    if (sport === "MLB") {
      const { outs, runners, scoreline } = context;
      return `${scoreline?.away || 0} - ${scoreline?.home || 0} • ${outs} outs • Runners: ${runners || "empty"}`;
    }
    if (sport === "NCAAF") {
      const { down, toGo, yardline, scoreline } = context;
      return `${scoreline?.away || 0} - ${scoreline?.home || 0} • Down ${down}, ${toGo} to go at ${yardline}`;
    }
    return JSON.stringify(context);
  };

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-500/20 ring-1 ring-red-500/30 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">Alerts</h1>
            <p className="text-red-300/80 text-xs font-semibold">Real-time Sports Alerts</p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="space-y-3">
          {/* Sport Filter */}
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Sport</label>
            <div className="flex flex-wrap gap-2">
              {availableSports.map((sport) => (
                <Button
                  key={sport}
                  variant={selectedSport === sport ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSport(sport)}
                  className={selectedSport === sport 
                    ? "bg-emerald-500 text-white" 
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                  }
                  data-testid={`sport-filter-${sport.toLowerCase()}`}
                >
                  {sport}
                </Button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Alert Type</label>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={selectedType === type 
                    ? "bg-red-500 text-white" 
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                  }
                  data-testid={`type-filter-${type.toLowerCase()}`}
                >
                  {type === "ALL" ? "All Types" : getAlertConfig(type).label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-400">{filteredAlerts.length}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Total Alerts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">
              {filteredAlerts.filter(a => a.score >= 90).length}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">High Priority</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {availableSports.length - 1}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Sports Active</div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-slate-700 rounded w-24"></div>
                  <div className="h-6 bg-slate-700 rounded w-16"></div>
                </div>
                <div className="h-5 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-slate-300">
            <Bell className="w-16 h-16 mx-auto mb-4 text-slate-500" />
            <h3 className="text-lg font-semibold mb-2">No Alerts Yet</h3>
            <p className="text-sm text-slate-400">
              {selectedSport !== "ALL" || selectedType !== "ALL" 
                ? "No alerts match your current filters"
                : "Alerts will appear here when games you're monitoring trigger conditions"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const alertConfig = getAlertConfig(alert.type);
              const AlertIcon = alertConfig.icon;
              
              return (
                <Card 
                  key={alert.id}
                  className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 hover:ring-red-500/30 transition-all duration-200 p-4"
                  style={{ borderRadius: '12px' }}
                  data-testid={`alert-card-${alert.id}`}
                >
                  {/* Alert Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 bg-${alertConfig.color}-500/20 ring-1 ring-${alertConfig.color}-500/30 rounded-full flex items-center justify-center`}>
                        <AlertIcon className={`w-4 h-4 text-${alertConfig.color}-400`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-sm">{alertConfig.label}</h3>
                        <p className="text-xs text-slate-400">{alert.sport} • Game {alert.gameId}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(alert.score)}`}>
                        {alert.score}%
                      </div>
                      <Badge className="bg-slate-700/50 text-slate-300 text-xs">
                        {alert.state}
                      </Badge>
                    </div>
                  </div>

                  {/* Alert Details */}
                  <div className="space-y-2">
                    <div className="text-sm text-slate-300">
                      <span className="font-semibold">Phase:</span> {alert.payload.phase}
                    </div>
                    
                    <div className="text-sm text-slate-300">
                      <span className="font-semibold">Situation:</span> {alert.payload.situation}
                    </div>
                    
                    {alert.payload.context && (
                      <div className="text-sm text-slate-400">
                        {formatContext(alert.payload.context, alert.sport)}
                      </div>
                    )}
                    
                    {alert.payload.weatherBucket && (
                      <div className="text-xs text-blue-400">
                        Weather: {alert.payload.weatherBucket}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{format(new Date(alert.createdAt), 'MMM d, h:mm a')}</span>
                      <span className="font-mono">{alert.alertKey}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {filteredAlerts.length > 0 && (
        <div className="fixed bottom-24 right-4">
          <Button
            onClick={() => refetch()}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
            data-testid="refresh-alerts"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}