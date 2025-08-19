import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Filter, Share2, TriangleAlert, Star, Bot, Volleyball, Dumbbell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@shared/schema";

const FILTER_OPTIONS = [
  { id: "all", label: "All Sports", active: true },
  { id: "high-impact", label: "High Impact", active: false },
  { id: "ai-verified", label: "AI Verified", active: false },
];

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);

  const { data: alerts = [], isLoading, error } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });

  // Debug logging
  console.log("Alerts loading:", isLoading);
  console.log("Alerts error:", error);
  console.log("Alerts data:", alerts);
  console.log("Alerts length:", alerts?.length);

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

  const filteredAlerts = Array.isArray(alerts) ? alerts.filter(alert => {
    if (activeFilters.includes("all")) return true;
    if (activeFilters.includes("high-impact")) {
      // Consider alerts with AI confidence > 90% as high impact
      return (alert.aiConfidence || 0) > 90;
    }
    if (activeFilters.includes("ai-verified")) {
      return alert.aiContext && (alert.aiConfidence || 0) > 75;
    }
    return true;
  }) : [];
  
  console.log("Filtered alerts:", filteredAlerts);

  // Helper function to create simple, clear alert messages
  const getSimplifiedAlertMessage = (alert: Alert): string => {
    const homeScore = (alert.gameInfo as any)?.score?.home || 0;
    const awayScore = (alert.gameInfo as any)?.score?.away || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    
    switch (alert.type) {
      case 'NFL Close Game':
        return `Close ${scoreDiff}-point game`;
      case 'ClutchTime':
        return `Clutch time - ${scoreDiff} point game`;
      case 'Bases Loaded 0 Outs':
        return 'Bases loaded, no outs!';
      case 'Bases Loaded 1 Out':
        return 'Bases loaded, 1 out';
      case 'Tie Game 9th Inning':
        return 'Tied in the 9th inning!';
      case 'RISP':
        return 'Runner in scoring position';
      case 'Game Start':
        return 'Game just started';
      case '7th Inning Warning':
        return '7th inning stretch';
      case 'Red Zone Alert':
        return 'Team in the red zone';
      case 'Two Minute Warning':
        return 'Two minute warning';
      case 'Fourth Down':
        return '4th down situation';
      case 'Overtime Alert':
        return 'OVERTIME!';
      case 'Power Play Alert':
        return 'Power play opportunity';
      case 'Empty Net Alert':
        return 'Empty net situation';
      default:
        return alert.type.replace(/([A-Z])/g, ' $1').trim();
    }
  };

  // Helper function to get team abbreviations
  const getTeamAbbreviation = (teamName: string): string => {
    const abbreviations: { [key: string]: string } = {
      'Washington Commanders': 'WSH',
      'Cincinnati Bengals': 'CIN',
      'New England Patriots': 'NE',
      'Buffalo Bills': 'BUF',
      'Miami Dolphins': 'MIA',
      'New York Jets': 'NYJ',
      'Pittsburgh Steelers': 'PIT',
      'Baltimore Ravens': 'BAL',
      'Cleveland Browns': 'CLE',
      'Los Angeles Dodgers': 'LAD',
      'San Francisco Giants': 'SF',
      'New York Yankees': 'NYY',
      'Boston Red Sox': 'BOS'
    };
    
    return abbreviations[teamName] || teamName.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 3);
  };

  return (
    <div className="pb-20 bg-chirp-bg min-h-screen">
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
            Live Alerts ({alerts.length})
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
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
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
            <p className="text-xs text-gray-500 mt-2">
              Debug: {alerts.length} total alerts loaded, {filteredAlerts.length} after filtering
            </p>
          </Card>
        ) : (
          <>
            <div className="bg-green-100 p-4 rounded mb-4">
              <p className="text-green-800 font-bold">✓ {filteredAlerts.length} alerts are loaded and ready to display!</p>
            </div>
            {filteredAlerts.map((alert) => {
            const AlertIcon = getAlertIcon(alert.type);
            const alertColorClass = getAlertColor(alert.type);
            
            return (
              <Card
                key={alert.id}
                className={`bg-white rounded-xl shadow-sm border-l-4 p-4 hover:shadow-md transition-shadow ${alertColorClass}`}
                data-testid={`alert-card-${alert.id}`}
              >
                {/* Header: Sport Type + Time */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <AlertIcon className="w-4 h-4 text-chirp-blue" />
                    <span className="text-sm font-bold text-chirp-blue uppercase tracking-wide">
                      {alert.sport}
                    </span>
                    {alert.gameInfo.quarter && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                        Q{alert.gameInfo.quarter}
                      </span>
                    )}
                    {alert.gameInfo.inning && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        {(alert.gameInfo as any).inningState === 'top' ? '⬆' : '⬇'} {alert.gameInfo.inning}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500" data-testid={`alert-time-${alert.id}`}>
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </span>
                </div>

                {/* Main Alert Message - Large and Bold */}
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight" data-testid={`alert-title-${alert.id}`}>
                    {getSimplifiedAlertMessage(alert)}
                  </h2>
                </div>

                {/* Game Score - Prominent */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase">{getTeamAbbreviation(alert.gameInfo.awayTeam)}</div>
                      <div className="text-2xl font-bold text-gray-900">{(alert.gameInfo as any)?.score?.away || 0}</div>
                    </div>
                    <div className="text-gray-400 font-bold">@</div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase">{getTeamAbbreviation(alert.gameInfo.homeTeam)}</div>
                      <div className="text-2xl font-bold text-gray-900">{(alert.gameInfo as any)?.score?.home || 0}</div>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <Button
                    size="sm"
                    className="bg-chirp-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
                    data-testid={`alert-action-${alert.id}`}
                  >
                    Watch Live
                  </Button>
                </div>

                {/* Quick Info Bar */}
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center space-x-3">
                    {alert.weatherData && (
                      <span className="flex items-center space-x-1">
                        <span>{alert.weatherData.temperature}°F</span>
                      </span>
                    )}
                    {alert.aiConfidence && alert.aiConfidence > 70 && (
                      <span className="flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        <Star className="w-3 h-3 fill-current" />
                        <span>High Confidence</span>
                      </span>
                    )}
                  </div>
                  <span className="text-green-600 font-medium">LIVE</span>
                </div>
              </Card>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
