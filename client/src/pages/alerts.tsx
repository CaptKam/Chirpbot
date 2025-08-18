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
                className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${alertColorClass}`}
                data-testid={`alert-card-${alert.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Badge className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${alertColorClass.split(' ').slice(0, 2).join(' ')}`}>
                      <AlertIcon className="w-3 h-3 mr-1" />
                      {alert.type}
                    </Badge>
                    <span className="text-xs text-chirp-dark" data-testid={`alert-time-${alert.id}`}>
                      {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  {alert.aiConfidence && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-xs font-medium text-chirp-dark">
                        {alert.aiConfidence}% AI
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mb-3">
                  <h3 className="font-bold text-chirp-blue mb-1" data-testid={`alert-title-${alert.id}`}>
                    {alert.title}
                  </h3>
                  <p className="text-sm text-chirp-dark" data-testid={`alert-description-${alert.id}`}>
                    {alert.description}
                  </p>
                </div>

                {/* Enhanced Game Info Display */}
                {alert.gameInfo && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-bold text-chirp-blue">
                          {alert.gameInfo.awayTeam} {alert.gameInfo.score?.away} - {alert.gameInfo.score?.home} {alert.gameInfo.homeTeam}
                        </div>
                        <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                          {alert.gameInfo.status}
                        </div>
                      </div>
                    </div>
                    
                    {/* Betting Context */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {alert.gameInfo.trendIndicator && (
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-600">Trend:</span>
                          <span className={`font-bold ${
                            alert.gameInfo.trendIndicator === 'Close Game' ? 'text-red-600' : 
                            alert.gameInfo.trendIndicator === 'Blowout Risk' ? 'text-orange-600' : 'text-blue-600'
                          }`}>
                            {alert.gameInfo.trendIndicator}
                          </span>
                        </div>
                      )}
                      {alert.gameInfo.overUnderHint && (
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-600">O/U:</span>
                          <span className={`font-bold ${
                            alert.gameInfo.overUnderHint.includes('Over') ? 'text-red-600' : 
                            alert.gameInfo.overUnderHint.includes('Under') ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {alert.gameInfo.overUnderHint}
                          </span>
                        </div>
                      )}
                      {alert.gameInfo.bettingValue && (
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-600">Value:</span>
                          <span className="font-bold text-green-600">{alert.gameInfo.bettingValue}</span>
                        </div>
                      )}
                      {alert.gameInfo.gamePhase && (
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-600">Phase:</span>
                          <span className="font-bold text-purple-600">{alert.gameInfo.gamePhase}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Momentum Indicator */}
                    {alert.gameInfo.momentumShift && (
                      <div className="mt-2 flex items-center space-x-2 text-xs">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="font-bold text-red-700">MOMENTUM SHIFT DETECTED</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Weather Display */}
                {alert.weatherData && (
                  <div className="mb-3 text-xs text-chirp-dark bg-sky-50 p-2 rounded-lg">
                    <span className="font-medium">Weather Impact:</span> {alert.weatherData.temperature}°F, {alert.weatherData.condition}
                    {alert.weatherData.windSpeed && (
                      <span> • Wind: {alert.weatherData.windSpeed}mph {alert.weatherData.windDirection}</span>
                    )}
                  </div>
                )}

                {/* AI Context */}
                {alert.aiContext && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase text-blue-800 tracking-wide">
                        AI Analysis
                      </span>
                    </div>
                    <p className="text-sm text-blue-800" data-testid={`alert-ai-context-${alert.id}`}>
                      {alert.aiContext}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-chirp-dark" data-testid={`alert-game-info-${alert.id}`}>
                      {alert.gameInfo.awayTeam} @ {alert.gameInfo.homeTeam}
                    </span>
                    <span className="text-sm text-chirp-blue">
                      {alert.gameInfo.status}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 text-chirp-red hover:text-red-700"
                    data-testid={`alert-share-${alert.id}`}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
