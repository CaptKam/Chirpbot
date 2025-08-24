import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { SwipeableCard } from "@/components/SwipeableCard";
import { removeCity } from "@/lib/team-utils";

const FILTER_OPTIONS = [
  { id: "all", label: "All", active: true },
  { id: "mlb", label: "MLB", active: false },
  { id: "nfl", label: "NFL", active: false },
  { id: "nba", label: "NBA", active: false },
  { id: "nhl", label: "NHL", active: false },
];

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);
  const queryClient = useQueryClient();
  const seenAlertsRef = useRef(new Set<string>());
  const { lastMessage } = useWebSocket();

  const { data: alerts = [], isLoading, error } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 10000, // Refetch every 10 seconds for more responsive updates
  });


  const markAsSeenMutation = useMutation({
    mutationFn: (alertId: string) => 
      fetch(`/api/alerts/${alertId}/seen`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => {
        if (!res.ok) throw new Error('Failed to mark as seen');
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    }
  });

  const markAlertAsSeen = useCallback((alertId: string) => {
    if (!seenAlertsRef.current.has(alertId)) {
      seenAlertsRef.current.add(alertId);
      markAsSeenMutation.mutate(alertId);
    }
  }, [markAsSeenMutation]);

  // Mark all alerts as seen after a longer delay to let user see them
  useEffect(() => {
    // Give user 30 seconds to see the new alerts before auto-marking as seen
    const timer = setTimeout(() => {
      fetch('/api/alerts/mark-all-seen', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(() => {
        // Refresh the unseen count
        queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      });
    }, 30000); // Increased from 8 to 30 seconds
    
    return () => clearTimeout(timer);
  }, []); // Only run once when component mounts

  // Handle real-time alert updates via WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_alert') {
      // Check if the data is actually an Alert (has required properties)
      const data = lastMessage.data;
      if (data && 'type' in data && 'sport' in data && 'title' in data && 'id' in data) {
        const newAlert = data as unknown as Alert;
      
        // Update the alerts list in the query cache to add the new alert at the beginning
        queryClient.setQueryData<Alert[]>(["/api/alerts"], (oldAlerts) => {
          // Add default properties for WebSocket alert data
          const alertWithDefaults = { ...newAlert, seen: false, sentToTelegram: false };
          
          if (!oldAlerts) return [alertWithDefaults];
          
          // Check if alert already exists to prevent duplicates (check by ID and timestamp)
          const exists = oldAlerts.some(alert => 
            alert.id === alertWithDefaults.id || 
            (alert.title === alertWithDefaults.title && 
             alert.timestamp === alertWithDefaults.timestamp)
          );
          if (exists) return oldAlerts;
          
          // Add new alert at the beginning of the list
          return [alertWithDefaults, ...oldAlerts];
        });
      
        // Refresh both queries to ensure consistency
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] });
      }
    }
  }, [lastMessage, queryClient]);


  const toggleFilter = (filterId: string) => {
    if (filterId === "all") {
      setActiveFilters(["all"]);
    } else {
      setActiveFilters(prev => {
        const newFilters = prev.filter(f => f !== "all");
        if (prev.includes(filterId)) {
          return newFilters.filter(f => f !== filterId);
        } else {
          return [...newFilters, filterId];
        }
      });
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "risp":
      case "homerun":
      case "lateinning":
        return TriangleAlert;
      case "redzone":
        return Zap;
      case "clutchtime":
        return Zap;
      default:
        return TriangleAlert;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "risp":
      case "homerun":
      case "lateinning":
        return "bg-red-500/20 text-red-300 ring-red-500/50";
      case "redzone":
        return "bg-yellow-500/20 text-yellow-300 ring-yellow-500/50";
      case "clutchtime":
        return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/50";
      default:
        return "bg-red-500/20 text-red-300 ring-red-500/50";
    }
  };

  const filteredAlerts = Array.isArray(alerts) ? alerts
    .filter(alert => {
      if (activeFilters.includes("all")) return true;
      return activeFilters.some(filter => 
        alert.sport.toLowerCase() === filter.toLowerCase()
      );
    })
    .sort((a, b) => {
      // Sort by timestamp, newest first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }) : [];

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
        {/* Mark all as read button */}
        {filteredAlerts.some(a => !a.seen) && (
          <Button
            onClick={() => {
              fetch('/api/alerts/mark-all-seen', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
              }).then(() => {
                queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] });
                queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
              });
            }}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/30"
            data-testid="mark-all-read"
          >
            Mark All Read
          </Button>
        )}
      </header>
      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100">
              Live Alerts
            </h2>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex space-x-2 overflow-x-auto flex-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleFilter(option.id)}
                data-testid={`filter-${option.id}`}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-colors ${
                  activeFilters.includes(option.id)
                    ? "bg-emerald-500 text-slate-900"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Unseen count indicator */}
          {filteredAlerts.filter(a => !a.seen).length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">
                {filteredAlerts.filter(a => !a.seen).length} NEW
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Alerts Feed */}
      <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 animate-pulse">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 bg-slate-700 rounded w-20"></div>
                    <div className="h-4 bg-slate-700 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-slate-700 rounded w-12"></div>
                </div>
                <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-full mb-3"></div>
                <div className="h-16 bg-slate-700 rounded mb-3"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-slate-700 rounded w-20"></div>
                  <div className="h-4 bg-slate-700 rounded w-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-8 text-center">
            <TriangleAlert className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-100 mb-2">No Alerts Found</h3>
            <p className="text-sm text-slate-300">
              No alerts match your current filters. Try adjusting your filter settings.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Debug: {alerts.length} total alerts loaded, {filteredAlerts.length} after filtering
            </p>
          </Card>
        ) : (
          <>
            {filteredAlerts.map((alert) => {
            return (
              <SwipeableCard
                key={alert.id}
                alertId={alert.id}
                onTap={() => {
                  // Mark as seen when tapped (not dragged)
                  if (!alert.seen) {
                    markAlertAsSeen(alert.id);
                  }
                }}
                className={`bg-slate-900/80 backdrop-blur-sm rounded-lg hover:bg-slate-900/90 transition-all duration-300 relative mb-3 ${
                  alert.seen 
                    ? 'border border-slate-800 opacity-60' 
                    : 'border border-blue-500/30 shadow-lg'
                }`}
                data-testid={`alert-card-${alert.id}`}
                data-alert-id={alert.id}
              >
                {/* OpenAI-Inspired Alert Design */}
                <div className="p-5">
                  {/* Intelligent Status Indicator */}
                  {!alert.seen && (
                    <div className="absolute top-4 right-4">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  
                  {/* AI-Enhanced Content */}
                  <div className="space-y-4">
                    {/* Intelligent Headline */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                          <span className="text-red-400 text-xs font-medium uppercase tracking-wide">LIVE ALERT</span>
                        </div>
                        <h2 className="text-white font-semibold text-lg leading-tight mb-1">
                          <span className="text-emerald-400">{alert.type}</span> • {alert.gameInfo.currentBatter?.name || 'Unknown Batter'} • 
                          {alert.gameInfo.count ? `${alert.gameInfo.count.balls}-${alert.gameInfo.count.strikes}` : '0-0'} Count
                        </h2>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {alert.gameInfo.runners?.first || alert.gameInfo.runners?.second || alert.gameInfo.runners?.third ? 
                            `Runners: ${[
                              alert.gameInfo.runners?.first && '1st',
                              alert.gameInfo.runners?.second && '2nd', 
                              alert.gameInfo.runners?.third && '3rd'
                            ].filter(Boolean).join(', ')} • ${alert.gameInfo.outs || 0} ${alert.gameInfo.outs === 1 ? 'out' : 'outs'}` :
                            `Bases empty • ${alert.gameInfo.outs || 0} ${alert.gameInfo.outs === 1 ? 'out' : 'outs'} • ${alert.gameInfo.inningState === 'top' ? 'Top' : 'Bottom'} ${alert.gameInfo.inning || '?'}`
                          }
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-emerald-400 font-mono text-xl font-bold">
                          {alert.gameInfo.score?.away || 0}-{alert.gameInfo.score?.home || 0}
                        </div>
                        {alert.gameInfo.inning && (
                          <div className="text-slate-400 text-sm mt-0.5">
                            {alert.gameInfo.inningState === 'top' ? '▲' : '▼'} {alert.gameInfo.inning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Context & Intelligence */}
                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-200 font-medium text-sm">
                          {removeCity(alert.gameInfo.awayTeam)} @ {removeCity(alert.gameInfo.homeTeam)}
                        </span>
                        <div className="flex items-center space-x-3 text-xs">
                          {alert.gameInfo.outs !== undefined && (
                            <span className="text-slate-400">
                              {alert.gameInfo.outs} {alert.gameInfo.outs === 1 ? 'out' : 'outs'}
                            </span>
                          )}
                          <span className="text-slate-500">
                            {new Date(alert.timestamp).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </span>
                        </div>
                      </div>
                      
                      {/* AI Insight */}
                      <div className="text-slate-300 text-xs leading-relaxed">
                        {alert.gameInfo.outs === 2 ? 
                          "Critical moment - two outs means maximum pressure on the batter" :
                          alert.gameInfo.outs === 1 ?
                          "Moderate pressure situation with one out remaining" :
                          "Early in the sequence with no outs - prime opportunity"}
                      </div>
                    </div>

                    {/* Probability & Player Intelligence */}
                    <div className="flex items-center justify-between">
                      {/* Smart Probability */}
                      {alert.description.includes('(') && (
                        <div className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 px-4 py-2 rounded-full border border-emerald-500/30">
                          <span className="text-emerald-300 text-sm font-semibold">
                            {alert.description.match(/\(([^)]+)\)/)?.[1]}
                          </span>
                        </div>
                      )}
                      
                      {/* Batter Intelligence */}
                      {alert.gameInfo.currentBatter && (
                        <div className="text-right">
                          <div className="text-white font-medium text-sm">
                            {alert.gameInfo.currentBatter.name}
                          </div>
                          <div className="flex items-center justify-end space-x-3 text-xs mt-0.5">
                            <span className="text-slate-400 font-mono">
                              .{alert.gameInfo.currentBatter.stats.avg.toFixed(3)}
                            </span>
                            <span className="text-slate-500">
                              {alert.gameInfo.currentBatter.stats.hr} HR
                            </span>
                            <span className="text-emerald-400">
                              {alert.gameInfo.currentBatter.stats.avg >= 0.300 ? 'Elite' : 
                               alert.gameInfo.currentBatter.stats.avg >= 0.250 ? 'Solid' : 'Struggling'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI-Powered Next Action Insight */}
                    <div className="bg-gradient-to-r from-slate-800/60 to-slate-700/60 rounded-lg p-3 border-l-2 border-emerald-400">
                      <div className="flex items-start space-x-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-400/20 flex items-center justify-center mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        </div>
                        <div>
                          <div className="text-emerald-300 text-xs font-medium mb-1">AI INSIGHT</div>
                          <div className="text-slate-300 text-xs leading-relaxed">
                            {alert.gameInfo.currentBatter ? 
                              (alert.gameInfo.currentBatter.stats.avg >= 0.300 ? 
                                "Strong contact hitter at the plate - watch for gap shots" :
                                alert.gameInfo.currentBatter.stats.hr >= 20 ?
                                "Power threat - any mistake pitch could leave the yard" :
                                "Batter struggling recently - pitcher has the advantage") :
                              "Monitor this developing situation for value opportunities"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeableCard>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
