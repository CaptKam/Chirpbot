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
    <div className="pb-20 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white antialiased min-h-screen relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"></div>
      </div>
      
      {/* Modern Header with Sports Action Background */}
      <header className="relative bg-gradient-to-r from-red-600/80 via-orange-500/80 to-yellow-500/80 backdrop-blur-xl border-b border-white/20 text-white p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"%3E%3Cpath fill="%23ffffff" fill-opacity="0.1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,133.3C672,139,768,181,864,197.3C960,213,1056,203,1152,181.3C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"%3E%3C/path%3E%3C/svg%3E')] opacity-20"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-red-500 rounded-2xl flex items-center justify-center shadow-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-white drop-shadow-lg">🎰 BetBot</h1>
              <p className="text-yellow-200 text-sm font-bold">Live Betting Intelligence</p>
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
                {/* NEW Badge for unseen alerts */}
                {!alert.seen && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="bg-emerald-500 text-slate-900 text-xs font-black px-2 py-1 rounded-full animate-pulse shadow-lg shadow-emerald-500/50">
                      NEW
                    </span>
                  </div>
                )}
                {/* Quick Impact Header */}
                <div className="text-center mb-2">
                  <h2 className="text-base font-black uppercase tracking-wide text-emerald-400">
                    ⚡ {alert.type.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}!
                  </h2>
                </div>
                {/* Teams & Situation */}
                <div className="text-center mb-3">
                  <div className="text-xs font-medium text-slate-400 mb-1" data-testid={`alert-teams-${alert.id}`}>
                    {alert.gameInfo.awayTeam} @ {alert.gameInfo.homeTeam}
                    {alert.gameInfo.score && (
                      <span className="ml-2 text-slate-300">
                        {alert.gameInfo.score.away} - {alert.gameInfo.score.home}
                      </span>
                    )}
                  </div>
                </div>
                {/* Quick Action Insight */}
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300" data-testid={`alert-description-${alert.id}`}>
                    {alert.description}
                  </p>
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
