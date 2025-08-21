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
      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
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
                className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 hover:bg-white/10 transition-all duration-500 relative overflow-hidden ${
                  alert.seen 
                    ? 'ring-1 ring-slate-600/50 opacity-75' 
                    : 'ring-2 ring-emerald-500 shadow-xl shadow-emerald-500/30 border-2 border-emerald-400/50'
                }`}
                data-testid={`alert-card-${alert.id}`}
                data-alert-id={alert.id}
              >
                {/* 🎰 BETTING ALERT HEADER - Premium Design */}
                <div className="relative mb-4">
                  {!alert.seen && (
                    <div className="absolute -top-2 -right-2 z-20">
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-black px-3 py-1 rounded-full animate-pulse shadow-lg border-2 border-white">
                        🚨 HOT
                      </div>
                    </div>
                  )}
                  
                  {/* MAIN BETTING ACTION - Green Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-4 mb-3 shadow-xl border border-green-400/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">💰</span>
                        <div>
                          <div className="text-white font-black text-lg uppercase tracking-wide">
                            BET NOW
                          </div>
                          <div className="text-green-100 text-sm font-bold">
                            OVER 8.5 TOTAL RUNS
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-black text-2xl">
                          +110
                        </div>
                        <div className="text-green-100 text-xs font-bold">
                          89% HIT RATE
                        </div>
                      </div>
                    </div>
                    
                    {/* Profit Calculator */}
                    <div className="mt-3 pt-3 border-t border-green-400/30">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-100">Bet $100 →</span>
                        <span className="text-white font-black text-lg">Win $210</span>
                      </div>
                    </div>
                  </div>

                  {/* GAME SITUATION */}
                  <div className="bg-slate-800/90 rounded-lg p-3 mb-3 border-l-4 border-yellow-400">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-yellow-400 font-bold text-sm">
                        🏟️ {alert.gameInfo.awayTeam} @ {alert.gameInfo.homeTeam}
                      </div>
                      <div className="text-slate-300 font-bold">
                        {alert.gameInfo.score?.away || 0}-{alert.gameInfo.score?.home || 0}
                      </div>
                    </div>
                    <div className="text-slate-300 text-sm">
                      {alert.description}
                    </div>
                  </div>

                  {/* BETTING INTELLIGENCE */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-2 text-center">
                      <div className="text-blue-400 text-xs font-medium">CONFIDENCE</div>
                      <div className="text-white font-black">89%</div>
                    </div>
                    <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-2 text-center">
                      <div className="text-purple-400 text-xs font-medium">VALUE</div>
                      <div className="text-white font-black">HIGH</div>
                    </div>
                  </div>
                  
                  {/* URGENCY TIMER */}
                  <div className="mt-3 bg-red-600/20 border border-red-500/30 rounded-lg p-2 text-center">
                    <div className="text-red-400 text-xs font-medium mb-1">⏰ BETTING WINDOW</div>
                    <div className="text-red-300 font-bold text-sm">LINE MOVING FAST - ACT NOW!</div>
                  </div>
                </div>
                {/* Game Info */}
                {alert.gameInfo.currentBatter && (
                  <div className="mt-3 p-3 bg-emerald-500/10 backdrop-blur-sm rounded-lg ring-1 ring-emerald-500/30">
                    <div className="flex items-start">
                      <span className="text-emerald-400 mr-2">🏏</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-emerald-300 mb-1">CURRENT BATTER</p>
                        <p className="text-sm text-slate-200" data-testid={`alert-current-batter-${alert.id}`}>
                          {alert.gameInfo.currentBatter.name} ({alert.gameInfo.currentBatter.batSide}) - AVG: {alert.gameInfo.currentBatter.stats.avg.toFixed(3)}, HR: {alert.gameInfo.currentBatter.stats.hr}, RBI: {alert.gameInfo.currentBatter.stats.rbi}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </SwipeableCard>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
