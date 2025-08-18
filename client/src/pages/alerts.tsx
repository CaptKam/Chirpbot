import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Filter, Share2, TriangleAlert, Star, Bot, Volleyball, Dumbbell, Clock, TrendingUp, Cloud } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TeamLogo } from "@/components/team-logo";
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
      {/* Header */}
      <header className="bg-chirp-blue text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-chirp-red rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">ChirpBot</h1>
            <p className="text-blue-200 text-xs font-medium">V2 Alert System</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-chirp-red px-3 py-1 rounded-full">
            <span className="text-white text-xs font-bold uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-red-300 rounded-full inline-block mr-1 animate-pulse"></div>
              LIVE
            </span>
          </div>
          <Button variant="ghost" size="sm" className="relative p-0 text-white hover:text-gray-200">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-chirp-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {alerts.length}
            </span>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
            Live Alerts
          </h2>
          <Button size="sm" className="bg-chirp-red text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
            <Filter className="w-3 h-3 mr-1" />
            Filter
          </Button>
        </div>
        <div className="flex space-x-2 overflow-x-auto">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => toggleFilter(option.id)}
              data-testid={`filter-${option.id}`}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-colors ${
                activeFilters.includes(option.id)
                  ? "bg-chirp-blue text-white"
                  : "bg-gray-100 text-chirp-dark hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="p-4 space-y-4">
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
            const alertColorClass = getAlertColor(alert.type);
            
            return (
              <Card
                key={alert.id}
                className="bg-white rounded-2xl shadow-lg border-0 p-0 overflow-hidden hover:shadow-xl transition-all duration-300"
                data-testid={`alert-card-${alert.id}`}
              >
                {/* Modern Header with Team Matchup */}
                {alert.gameInfo && (
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      {/* Team Logos and Matchup */}
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex items-center space-x-2">
                          <TeamLogo teamName={alert.gameInfo.awayTeam} size="md" />
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-300">{alert.gameInfo.awayTeam}</div>
                            <div className="text-xl font-black text-white">{(alert.gameInfo as any)?.score?.away || 0}</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center mx-2">
                          <div className="text-xs text-gray-400 font-medium">VS</div>
                          <div className="text-xs text-gray-400">{alert.gameInfo.status}</div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className="text-center">
                            <div className="text-xl font-black text-white">{(alert.gameInfo as any)?.score?.home || 0}</div>
                            <div className="text-sm font-medium text-gray-300">{alert.gameInfo.homeTeam}</div>
                          </div>
                          <TeamLogo teamName={alert.gameInfo.homeTeam} size="md" />
                        </div>
                      </div>
                      
                      {/* Alert Type Badge */}
                      <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase shadow-lg">
                        <AlertIcon className="w-3 h-3 mr-1" />
                        {alert.type}
                      </Badge>
                    </div>
                  </div>
                )}
                
                {/* Alert Content */}
                <div className="p-5">
                  {/* Alert Title and Description */}
                  <div className="mb-4">
                    <h3 className="font-black text-lg text-gray-900 mb-2 leading-tight" data-testid={`alert-title-${alert.id}`}>
                      {alert.title}
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed" data-testid={`alert-description-${alert.id}`}>
                      {alert.description}
                    </p>
                  </div>

                  {/* AI Analysis Section */}
                  {alert.aiContext && (
                    <div className="mb-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                      <div className="flex items-start space-x-3">
                        <div className="bg-indigo-500 rounded-full p-2">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-indigo-900 text-sm">AI Analysis</h4>
                            {alert.aiConfidence && (
                              <div className="flex items-center space-x-2">
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                <span className="text-xs font-bold text-indigo-700">{alert.aiConfidence}% Confidence</span>
                              </div>
                            )}
                          </div>
                          <p className="text-indigo-800 text-sm leading-relaxed" data-testid={`alert-ai-context-${alert.id}`}>
                            {alert.aiContext}
                          </p>
                          {alert.aiConfidence && (
                            <div className="mt-2 w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${alert.aiConfidence}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weather Information */}
                  {alert.weatherData && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-200">
                      <div className="flex items-center space-x-2">
                        <Cloud className="w-4 h-4 text-sky-600" />
                        <span className="font-semibold text-sky-900 text-sm">Weather Impact:</span>
                        <span className="text-sky-800 text-sm">
                          {alert.weatherData.temperature}°F, {alert.weatherData.condition}
                        </span>
                        {alert.weatherData.windSpeed && (
                          <span className="text-sky-700 text-sm">
                            • Wind: {alert.weatherData.windSpeed}mph {alert.weatherData.windDirection}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Momentum Indicator */}
                  {alert.gameInfo && (alert.gameInfo as any)?.momentumShift && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <TrendingUp className="w-4 h-4 text-red-600" />
                        <span className="font-bold text-red-800 text-sm">MOMENTUM SHIFT DETECTED</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modern Footer */}
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-medium uppercase tracking-wide">{alert.sport}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span data-testid={`alert-time-${alert.id}`}>
                          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50" data-testid={`alert-share-${alert.id}`}>
                      <Share2 className="w-4 h-4" />
                    </Button>
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
