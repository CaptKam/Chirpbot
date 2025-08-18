import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, Bell, Filter, Share2, Target, TrendingUp, 
  Timer, Trophy, Wind, Bot, AlertTriangle, 
  CircleDot, Users, Activity, Sparkles
} from "lucide-react";
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

  const getAlertTypeConfig = (type: string) => {
    const typeUpper = type.toUpperCase();
    switch (typeUpper) {
      case "RISP":
        return {
          icon: Target,
          label: "RUNNERS IN SCORING POSITION",
          shortLabel: "RISP",
          color: "bg-red-500",
          bgColor: "bg-red-50",
          borderColor: "border-red-500",
          textColor: "text-red-900",
          description: "High-probability scoring opportunity"
        };
      case "HOMERUN":
        return {
          icon: Trophy,
          label: "HOME RUN",
          shortLabel: "HR",
          color: "bg-purple-500",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-500",
          textColor: "text-purple-900",
          description: "Big momentum swing"
        };
      case "REDZONE":
        return {
          icon: AlertTriangle,
          label: "RED ZONE",
          shortLabel: "RZ",
          color: "bg-orange-500",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-500",
          textColor: "text-orange-900",
          description: "Inside the 20-yard line"
        };
      case "CLUTCHTIME":
        return {
          icon: Timer,
          label: "CLUTCH TIME",
          shortLabel: "CLUTCH",
          color: "bg-blue-500",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-500",
          textColor: "text-blue-900",
          description: "Final minutes, close game"
        };
      case "TWOMINUTEWARNING":
        return {
          icon: Timer,
          label: "2-MINUTE WARNING",
          shortLabel: "2MIN",
          color: "bg-indigo-500",
          bgColor: "bg-indigo-50",
          borderColor: "border-indigo-500",
          textColor: "text-indigo-900",
          description: "Critical drive time"
        };
      case "WEATHERIMPACT":
        return {
          icon: Wind,
          label: "WEATHER IMPACT",
          shortLabel: "WX",
          color: "bg-sky-500",
          bgColor: "bg-sky-50",
          borderColor: "border-sky-500",
          textColor: "text-sky-900",
          description: "Conditions affecting play"
        };
      case "LEADCHANGE":
        return {
          icon: TrendingUp,
          label: "LEAD CHANGE",
          shortLabel: "LEAD",
          color: "bg-green-500",
          bgColor: "bg-green-50",
          borderColor: "border-green-500",
          textColor: "text-green-900",
          description: "Momentum shift"
        };
      default:
        return {
          icon: Activity,
          label: type.toUpperCase(),
          shortLabel: type.slice(0, 4).toUpperCase(),
          color: "bg-gray-500",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-500",
          textColor: "text-gray-900",
          description: "Game event"
        };
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
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-chirp-blue mb-2">No Alerts Found</h3>
            <p className="text-sm text-chirp-dark">
              No alerts match your current filters. Try adjusting your filter settings.
            </p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const config = getAlertTypeConfig(alert.type);
            const AlertIcon = config.icon;
            
            // Parse the score from gameInfo if available
            const score = (alert.gameInfo as any)?.score || { away: 0, home: 0 };
            
            // Extract key details from description for cleaner display
            const cleanDescription = alert.description
              ?.replace(/Score:.*?\./, '') // Remove score from description
              ?.replace(alert.gameInfo.homeTeam, '') // Remove redundant team names
              ?.replace(alert.gameInfo.awayTeam, '')
              ?.trim();
            
            return (
              <Card
                key={alert.id}
                className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 ${config.borderColor} overflow-hidden`}
                data-testid={`alert-card-${alert.id}`}
              >
                {/* Alert Type Header - Large and Clear */}
                <div className={`${config.color} px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <AlertIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-black text-lg uppercase tracking-wide">
                          {config.shortLabel}
                        </h3>
                        <p className="text-white/90 text-xs">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    {alert.aiConfidence && alert.aiConfidence > 85 && (
                      <div className="flex items-center space-x-1 bg-white/20 px-3 py-1 rounded-full">
                        <Sparkles className="w-4 h-4 text-yellow-300" />
                        <span className="text-xs font-bold text-white">
                          HIGH CONFIDENCE
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Game Matchup - Clean Single Display */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs font-bold uppercase">
                        {alert.sport}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {alert.gameInfo.status}
                    </Badge>
                  </div>

                  {/* Score Display - Big and Clear */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <p className="text-sm text-gray-600 mb-1">{alert.gameInfo.awayTeam}</p>
                        <p className="text-3xl font-black text-gray-900">{score.away}</p>
                      </div>
                      <div className="text-2xl text-gray-400 mx-4">-</div>
                      <div className="text-center flex-1">
                        <p className="text-sm text-gray-600 mb-1">{alert.gameInfo.homeTeam}</p>
                        <p className="text-3xl font-black text-gray-900">{score.home}</p>
                      </div>
                    </div>
                  </div>

                  {/* Alert Details - What's Happening */}
                  <div className={`${config.bgColor} rounded-lg p-3 mb-3`}>
                    <p className={`text-sm font-medium ${config.textColor}`}>
                      {cleanDescription || alert.description}
                    </p>
                  </div>

                  {/* Weather Impact (if relevant) */}
                  {alert.weatherData && alert.type === 'WeatherImpact' && (
                    <div className="flex items-center space-x-2 bg-sky-50 rounded-lg p-2 mb-3">
                      <Wind className="w-4 h-4 text-sky-600" />
                      <span className="text-xs text-sky-900">
                        {alert.weatherData.temperature}°F • {alert.weatherData.condition}
                        {alert.weatherData.windSpeed && ` • Wind: ${alert.weatherData.windSpeed}mph`}
                      </span>
                    </div>
                  )}

                  {/* AI Insight - Concise */}
                  {alert.aiContext && (
                    <div className="border-t pt-3">
                      <div className="flex items-start space-x-2">
                        <Bot className="w-4 h-4 text-blue-600 mt-0.5" />
                        <p className="text-xs text-gray-700 leading-relaxed">
                          <span className="font-bold">AI:</span> {alert.aiContext}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="px-4 pb-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700"
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
