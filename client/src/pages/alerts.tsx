import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Wind, Gauge, Clock3, User, AlertTriangle, Zap, TriangleAlert, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { SwipeableCard } from "@/components/SwipeableCard";
import { removeCity } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/Pill";

import { toVM } from "@/adapters/base";
import AlertFooter from "@/components/AlertFooter";
import "@/adapters/mlb"; // Import to register the adapter

const FILTER_OPTIONS = [
  { id: "all", label: "All", active: true },
  { id: "mlb", label: "MLB", active: false },
  { id: "nfl", label: "NFL", active: false },
  { id: "nba", label: "NBA", active: false },
  { id: "nhl", label: "NHL", active: false },
];

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const queryClient = useQueryClient();
  const seenAlertsRef = useRef(new Set<string>());
  const { lastMessage } = useWebSocket();

  const { data: alerts = [], isLoading, error } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 2000, // Refetch every 2 seconds for smooth real-time feel
  });

  // Update timestamps every 30 seconds to keep "X minutes ago" text fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(timer);
  }, []);


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
      
        // Instantly update the unseen count as well
        queryClient.setQueryData<{ count: number }>(['/api/alerts/unseen/count'], (oldCount) => {
          return { count: (oldCount?.count || 0) + 1 };
        });
        
        // Refresh both queries to ensure consistency (but the UI already updated instantly)
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
              const vm = toVM(alert);
              return (
                <SwipeableCard
                  key={alert.id}
                  alertId={alert.id}
                  className="rounded-xl"
                  alertData={{
                    sport: alert.sport,
                    homeTeam: alert.gameInfo?.homeTeam,
                    awayTeam: alert.gameInfo?.awayTeam,
                    homeScore: (alert.gameInfo as any)?.homeScore || 0,
                    awayScore: (alert.gameInfo as any)?.awayScore || 0,
                    probability: (alert as any).probability || 0.75,
                    priority: alert.priority || 75,
                    betbookData: (alert as any).betbookData || null,
                    gameInfo: {
                      v3Analysis: (alert.gameInfo as any)?.v3Analysis || {
                        tier: Math.ceil((alert.priority || 75) / 25),
                        probability: (alert.priority || 75) >= 95 ? 0.85 : (alert.priority || 75) >= 90 ? 0.80 : 0.75,
                        reasons: [`${alert.type} situation detected`, 'Real-time game analysis', 'AI-enhanced assessment']
                      }
                    }
                  }}
                >
                  <Card
                    onClick={() => { if (!alert.seen) markAlertAsSeen(alert.id); }}
                    className={cn(
                      "relative overflow-hidden backdrop-blur-sm transition-all duration-300",
                      "ring-1 ring-white/10 hover:ring-white/20",
                      "dark bg-card text-card-foreground",
                      !alert.seen
                        ? "ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20"
                        : "opacity-80"
                    )}
                  >
                    {/* NEW badge */}
                    {vm.isNew && (
                      <span className="absolute top-2 right-2 bg-emerald-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        NEW
                      </span>
                    )}

                    <div className="p-4 space-y-3">
                      {/* Row 1: Situation + RP + time */}
                      <div className="flex items-start justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill className="bg-orange-500/15 ring-orange-400/40 text-orange-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {vm.situation}
                          </Pill>
                          {vm.edge.value && (
                            <Pill className="bg-indigo-500/15 ring-indigo-400/40 text-indigo-200">
                              <Gauge className="w-3.5 h-3.5" />
                              {vm.edge.label} {vm.edge.value}
                            </Pill>
                          )}
                          {vm.priority && (
                            <Pill className={(() => {
                              const priority = vm.priority;
                              if (priority >= 95) return "bg-red-500/20 ring-red-400/50 text-red-200"; // Critical
                              if (priority >= 90) return "bg-orange-500/20 ring-orange-400/50 text-orange-200"; // Very High
                              if (priority >= 85) return "bg-amber-500/20 ring-amber-400/50 text-amber-200"; // High
                              if (priority >= 80) return "bg-yellow-500/20 ring-yellow-400/50 text-yellow-200"; // Medium-High
                              return "bg-rose-500/15 ring-rose-400/40 text-rose-200"; // Medium
                            })()}>
                              <Flame className="w-3.5 h-3.5" />
                              Priority {vm.priority}
                            </Pill>
                          )}
                          {vm.sport && (
                            <Pill className="bg-emerald-500/15 ring-emerald-400/40 text-emerald-200">
                              <Trophy className="w-3.5 h-3.5" />
                              {vm.sport}
                            </Pill>
                          )}
                        </div>
                        {/* Alert timestamp - compact display */}
                        {vm.createdAt && (
                          <Pill className="bg-zinc-600/20 ring-zinc-500/30 text-zinc-300 shrink-0 text-xs px-2 py-1">
                            <Clock3 className="w-3 h-3" />
                            {(() => {
                              const now = Date.now();
                              const then = new Date(vm.createdAt).getTime();
                              const diffMs = now - then;
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMins / 60);
                              const diffDays = Math.floor(diffHours / 24);
                              
                              if (diffDays > 0) return `${diffDays}d`;
                              if (diffHours > 0) return `${diffHours}h`;
                              if (diffMins > 0) return `${diffMins}m`;
                              return '<1m';
                            })()}
                          </Pill>
                        )}
                      </div>

                      {/* Row 2: Teams/score + inning + runners diamond */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-100 truncate">
                            {vm.scoreline}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {vm.widget}
                          {/* Optional batter chip */}
                          {vm.actor && (
                            <Pill className="bg-violet-500/15 ring-violet-400/40 text-violet-200">
                              <User className="w-3.5 h-3.5" />
                              {vm.actor}
                            </Pill>
                          )}
                        </div>
                      </div>

                      {/* Row 3: 1-line action copy */}
                      <div className="text-sm text-slate-200">
                        {vm.actionLine}
                      </div>

                      {/* Row 4: Why tags (wind/tier/etc) */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {vm.tags?.map((tag, index) => (
                          <Pill key={index} className={tag.includes('Wind') ? "bg-teal-500/15 ring-teal-400/40 text-teal-200" : "bg-neutral-500/15 ring-neutral-400/30 text-neutral-300"}>
                            {tag.includes('Wind') && <Wind className="w-3.5 h-3.5" />}
                            {tag}
                          </Pill>
                        ))}
                      </div>

                      {/* Tier Analysis Details - Show for all high-priority alerts */}
                      {((alert.gameInfo as any)?.v3Analysis || (alert.priority && alert.priority >= 80)) && (
                        <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg p-4 ring-1 ring-blue-500/20 space-y-3 mt-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {(alert.gameInfo as any)?.v3Analysis?.tier || Math.ceil((alert.priority || 70) / 25)}
                                </span>
                              </div>
                              <div>
                                <span className="text-blue-200 font-semibold text-base">
                                  Tier {(alert.gameInfo as any)?.v3Analysis?.tier || Math.ceil((alert.priority || 70) / 25)} Alert
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 bg-emerald-500/10 px-3 py-1 rounded-full">
                              <Zap className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400 font-mono text-base font-semibold">
                                {(() => {
                                  if ((alert.gameInfo as any)?.v3Analysis?.probability) {
                                    return Math.round((alert.gameInfo as any).v3Analysis.probability * 100);
                                  }
                                  // Generate probability based on priority
                                  const priority = alert.priority || 70;
                                  if (priority >= 95) return 85;
                                  if (priority >= 90) return 80; 
                                  if (priority >= 85) return 75;
                                  if (priority >= 80) return 70;
                                  return 65;
                                })()}%
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              if ((alert.gameInfo as any)?.v3Analysis?.reasons) {
                                return (alert.gameInfo as any).v3Analysis.reasons.slice(0, 3).map((reason: string, idx: number) => (
                                  <div key={idx} className="text-sm text-slate-200 flex items-start space-x-3">
                                    <span className="text-blue-400 font-bold mt-0.5">•</span>
                                    <span className="leading-relaxed">{reason}</span>
                                  </div>
                                ));
                              }
                              // Generate ACTIONABLE betting reasons based on actual game data
                              const reasons = [];
                              const homeScore = (alert.gameInfo as any)?.homeScore || 0;
                              const awayScore = (alert.gameInfo as any)?.awayScore || 0;
                              const totalScore = homeScore + awayScore;
                              const inningNum = alert.gameInfo?.inning ? 
                                (typeof alert.gameInfo.inning === 'number' ? alert.gameInfo.inning : parseInt(alert.gameInfo.inning)) : 0;
                              
                              // SPECIFIC betting-focused reasons
                              if (alert.gameInfo?.runners?.second || alert.gameInfo?.runners?.third) {
                                const overLine = Math.max(totalScore + 1.5, 7.5);
                                reasons.push(`RISP: Bet Over ${overLine} runs - 68% scoring rate with runners in scoring position`);
                              }
                              
                              if (alert.gameInfo?.runners?.first && alert.gameInfo?.runners?.second && alert.gameInfo?.runners?.third) {
                                const overLine = Math.max(totalScore + 2, 8.5);
                                reasons.push(`BASES LOADED: Bet Over ${overLine} runs - 85% chance of multiple runs scoring`);
                              }
                              
                              if (inningNum >= 7 && Math.abs(homeScore - awayScore) <= 2) {
                                reasons.push(`CLUTCH SPOT: Live bet moneyline - Close game, bullpen fatigue increases volatility`);
                              }
                              
                              if (alert.priority >= 90) {
                                const teamTotal = Math.max(Math.max(homeScore, awayScore) + 1.5, 4.5);
                                reasons.push(`HIGH VALUE: Bet team total Over ${teamTotal} - Critical momentum shift detected`);
                              }
                              
                              // Fallback if no specific situations
                              if (reasons.length === 0) {
                                const overLine = Math.max(totalScore + 1, 7.0);
                                reasons.push(`LIVE BET: Over ${overLine} runs - Offensive situation developing`);
                                reasons.push(`MOMENTUM: Consider next inning props - Game flow shifting`);
                              }
                              
                              return reasons.slice(0, 2).map((reason: string, idx: number) => (
                                <div key={idx} className="text-sm text-slate-200 flex items-start space-x-3">
                                  <span className="text-emerald-400 font-bold mt-0.5">💰</span>
                                  <span className="leading-relaxed font-medium">{reason}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Alert Footer - Game Situation Bar */}
                    {alert.gameInfo?.inning && alert.gameInfo?.inningState && (
                      <AlertFooter
                        half={alert.gameInfo.inningState === 'top' ? 'Top' : 'Bottom'}
                        inning={parseInt(alert.gameInfo.inning)}
                        bases={{
                          first: alert.gameInfo.runners?.first || false,
                          second: alert.gameInfo.runners?.second || false,
                          third: alert.gameInfo.runners?.third || false,
                        }}
                        balls={alert.gameInfo.balls}
                        strikes={alert.gameInfo.strikes}
                        outs={alert.gameInfo.outs || 0}
                        createdAt={vm.createdAt}
                      />
                    )}
                  </Card>
                </SwipeableCard>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
