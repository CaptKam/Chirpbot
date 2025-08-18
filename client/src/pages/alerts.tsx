import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Filter, Share2, TriangleAlert, Star, Bot, Volleyball, Dumbbell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@/types";

const FILTER_OPTIONS = [
  { id: "all", label: "All Sports", active: true },
  { id: "high-impact", label: "High Impact", active: false },
  { id: "ai-verified", label: "AI Verified", active: false },
];

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 2000, // Refetch every 2 seconds for ultra-fast updates
    staleTime: 0, // Always consider data stale for maximum freshness
    gcTime: 1000, // Minimal cache time for fastest updates (updated from deprecated cacheTime)
  });

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
        return Volleyball;
      case "clutchtime":
        return Dumbbell;
      default:
        return TriangleAlert;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "risp":
      case "homerun":
      case "lateinning":
        return "bg-red-100 text-red-800 border-red-500";
      case "redzone":
        return "bg-yellow-100 text-yellow-800 border-yellow-500";
      case "clutchtime":
        return "bg-green-100 text-green-800 border-green-500";
      default:
        return "bg-red-100 text-red-800 border-red-500";
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (activeFilters.includes("all")) return true;
    if (activeFilters.includes("high-impact")) {
      // Consider alerts with AI confidence > 90% as high impact
      return (alert.aiConfidence || 0) > 90;
    }
    if (activeFilters.includes("ai-verified")) {
      return alert.aiContext && (alert.aiConfidence || 0) > 75;
    }
    return true;
  });

  return (
    <div className="pb-20">
      {/* Header - Bold & Clean */}
      <header className="bg-black text-white p-6">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 mb-3">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-[0.3em]">ChirpBot</h1>
          </div>
          <div className="flex items-center justify-center space-x-6">
            <div className="bg-red-600 px-6 py-2 rounded-full">
              <span className="text-white text-lg font-black uppercase tracking-[0.2em]">
                <div className="w-2 h-2 bg-red-300 rounded-full inline-block mr-2 animate-pulse"></div>
                LIVE ALERTS
              </span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-full text-lg font-bold">
              {alerts.length} ACTIVE
            </div>
          </div>
        </div>
      </header>

      {/* Filters - Bold & Clean */}
      <div className="bg-gray-900 p-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-white mb-4">
            FILTER ALERTS
          </h2>
          <div className="flex justify-center space-x-3 overflow-x-auto">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleFilter(option.id)}
                data-testid={`filter-${option.id}`}
                className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-wide whitespace-nowrap transition-all ${
                  activeFilters.includes(option.id)
                    ? "bg-red-600 text-white transform scale-105"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="bg-gray-100 min-h-screen p-6 space-y-8">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border-l-4 border-gray-300 p-4 animate-pulse">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 bg-gray-300 rounded w-20"></div>
                    <div className="h-4 bg-gray-300 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-gray-300 rounded w-12"></div>
                </div>
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-full mb-3"></div>
                <div className="h-16 bg-gray-300 rounded mb-3"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-300 rounded w-20"></div>
                  <div className="h-4 bg-gray-300 rounded w-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Card className="bg-white rounded-xl shadow-sm p-8 text-center">
            <TriangleAlert className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-chirp-blue mb-2">No Alerts Found</h3>
            <p className="text-sm text-chirp-dark">
              No alerts match your current filters. Try adjusting your filter settings.
            </p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const AlertIcon = getAlertIcon(alert.type);
            
            // Extract key info for highlighting
            const isHighPriority = (alert.aiConfidence || 0) > 85;
            const gameScore = alert.gameInfo ? `${(alert.gameInfo as any)?.score?.away || 0}-${(alert.gameInfo as any)?.score?.home || 0}` : null;
            
            return (
              <Card
                key={alert.id}
                className={`bg-white rounded-2xl shadow-lg border-0 p-6 hover:shadow-xl transition-all duration-300 ${
                  isHighPriority ? 'ring-2 ring-red-500 bg-gradient-to-br from-red-50 to-orange-50' : ''
                }`}
                data-testid={`alert-card-${alert.id}`}
              >
                {/* Priority Indicator */}
                {isHighPriority && (
                  <div className="bg-red-600 text-white text-center py-3 -mx-6 -mt-6 mb-6 rounded-t-2xl">
                    <div className="text-sm font-black uppercase tracking-[0.3em] animate-pulse">
                      🚨 HIGH PRIORITY 🚨
                    </div>
                  </div>
                )}

                {/* Alert Type Header */}
                <div className="text-center mb-6">
                  <div className={`inline-flex items-center space-x-4 px-8 py-4 rounded-2xl ${
                    isHighPriority ? 'bg-red-600' : 'bg-gray-900'
                  } text-white`}>
                    <AlertIcon className="w-8 h-8" />
                    <div className="text-4xl font-black uppercase tracking-[0.2em]">
                      {alert.type === 'RISP' ? 'RISP THREAT' : alert.type}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 font-semibold mt-2 uppercase tracking-wide">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </div>
                </div>

                {/* Game Score - Massive Bold Display */}
                {alert.gameInfo && gameScore && (
                  <div className="bg-black text-white rounded-3xl p-8 mb-6 text-center">
                    <div className="text-6xl font-black mb-4 tracking-wider">
                      {(alert.gameInfo as any)?.score?.away || 0} - {(alert.gameInfo as any)?.score?.home || 0}
                    </div>
                    <div className="text-xl font-bold mb-3 text-gray-300">
                      {alert.gameInfo.awayTeam} @ {alert.gameInfo.homeTeam}
                    </div>
                    <div className="bg-red-600 rounded-full px-6 py-2 text-lg font-black uppercase tracking-widest inline-block">
                      {alert.gameInfo.status} • LIVE
                    </div>
                  </div>
                )}

                {/* Alert Description - Bold & Clean */}
                <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6">
                  <p className="text-xl font-bold leading-relaxed text-center" data-testid={`alert-description-${alert.id}`}>
                    {alert.description}
                  </p>
                </div>

                {/* AI Confidence - Prominent Badge */}
                {alert.aiConfidence && (
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-black uppercase tracking-widest ${
                      alert.aiConfidence > 90 
                        ? 'bg-green-600 text-white' 
                        : alert.aiConfidence > 75 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-gray-600 text-white'
                    }`}>
                      {alert.aiConfidence}% CONFIDENCE
                    </div>
                  </div>
                )}

                {/* AI Analysis - Bold Block */}
                {alert.aiContext && (
                  <div className="bg-blue-600 text-white rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <Bot className="w-6 h-6" />
                      <span className="text-lg font-black uppercase tracking-[0.2em]">
                        AI ANALYSIS
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-center leading-relaxed" data-testid={`alert-ai-context-${alert.id}`}>
                      {alert.aiContext}
                    </p>
                  </div>
                )}

                {/* Weather Impact - Clean Block */}
                {alert.weatherData && (
                  <div className="bg-gray-100 rounded-2xl p-4 mb-6 text-center">
                    <div className="text-lg font-black uppercase tracking-wide text-gray-800 mb-2">
                      WEATHER IMPACT
                    </div>
                    <div className="text-lg font-bold text-gray-700">
                      {alert.weatherData.temperature}°F • {alert.weatherData.condition}
                      {alert.weatherData.windSpeed && (
                        <div className="mt-1">Wind: {alert.weatherData.windSpeed}mph {alert.weatherData.windDirection}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Info - Minimal */}
                <div className="text-center pt-4 border-t-2 border-gray-200">
                  <div className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                    {alert.sport}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
