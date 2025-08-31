import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, TriangleAlert } from "lucide-react";
import type { Alert } from "@shared/schema";
import { useWebSocket } from "@/hooks/use-websocket";
import { SwipeableCard } from "@/components/SwipeableCard";
import { cn } from "@/lib/utils";

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
    refetchInterval: 2000,
  });

  const markAsSeenMutation = useMutation({
    mutationFn: (alertId: string) => 
      fetch(`/api/alerts/${alertId}/seen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const filteredAlerts = Array.isArray(alerts) ? alerts
    .filter(alert => {
      if (activeFilters.includes("all")) return true;
      return activeFilters.some(filter => 
        alert.sport.toLowerCase() === filter.toLowerCase()
      );
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];

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
            <p className="text-emerald-300/80 text-sm font-medium">Law #6 & #7 Compliant</p>
          </div>
        </div>
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
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm px-3 py-1 rounded-full border border-emerald-500/30"
          >
            Mark All Read
          </Button>
        )}
      </header>
      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex space-x-2 overflow-x-auto flex-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleFilter(option.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold uppercase whitespace-nowrap transition-colors ${
                  activeFilters.includes(option.id)
                    ? "bg-emerald-500 text-slate-900"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Alerts Feed - LAW #7 COMPLIANT DISPLAY */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-8 text-center">
            <TriangleAlert className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-100 mb-2">No Alerts Found</h3>
            <p className="text-base text-slate-300">No alerts match your current filters.</p>
          </Card>
        ) : (
          <>
            {filteredAlerts.map((alert) => (
              <SwipeableCard
                key={alert.id}
                alertId={alert.id}
                className="rounded-xl"
                alertData={{
                  sport: alert.sport,
                  homeTeam: alert.gameInfo?.homeTeam,
                  awayTeam: alert.gameInfo?.awayTeam,
                  homeScore: alert.gameInfo?.score?.home || 0,
                  awayScore: alert.gameInfo?.score?.away || 0,
                  probability: 0.75,
                  priority: alert.priority || 75,
                  betbookData: null,
                  gameInfo: { v3Analysis: null }
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
                  {/* LAW #7: CLEAN LAYOUT - NO DUPLICATE INFO */}
                  <div className="p-6 space-y-4">
                    {/* Row 1: Sport + NEW Badge */}
                    <div className="flex items-center justify-between">
                      <span className="bg-blue-500/20 text-blue-300 text-base font-bold px-3 py-1 rounded-full">
                        {alert.sport}
                      </span>
                      {!alert.seen && (
                        <span className="bg-emerald-400 text-slate-900 text-sm font-black px-2 py-1 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Row 2: TITLE - Law #7 Format (NO TEAM NAMES) */}
                    <div className="mb-2">
                      <h2 className="text-sm font-semibold text-white leading-normal break-words">
                        {alert.title?.replace(/Mississippi State Bulldogs?/gi, 'Team')
                                   ?.replace(/Southern Miss Golden Eagles?/gi, 'Team')
                                   ?.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+s?\b/g, 'Team')
                                   || alert.title}
                      </h2>
                    </div>

                    {/* Row 3: Teams - ONLY HERE, NOWHERE ELSE */}
                    <div className="text-xs text-slate-200 font-medium mb-2">
                      {alert.gameInfo?.awayTeam} @ {alert.gameInfo?.homeTeam}
                    </div>

                    {/* Row 4: Description - Law #7 Format (3 lines max, NO TEAM NAMES) */}
                    <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
                      <div className="text-xs text-slate-200 leading-relaxed break-words">
                        {alert.description?.replace(/Mississippi State Bulldogs?/gi, 'Offense')
                                         ?.replace(/Southern Miss Golden Eagles?/gi, 'Defense')
                                         ?.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+s?\b/g, 'Team')
                                         || alert.description}
                      </div>
                    </div>

                    {/* Row 5: Timestamp + Priority */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {new Date(alert.timestamp || alert.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="bg-slate-700/50 px-2 py-1 rounded text-xs">
                        Priority: {alert.priority}
                      </span>
                    </div>
                  </div>
                </Card>
              </SwipeableCard>
            ))}
          </>
        )}
      </div>
    </div>
  );
}