import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@shared/schema";

const FILTER_OPTIONS = [
  { id: "all", label: "All", active: true },
  { id: "mlb", label: "MLB", active: false },
  { id: "nfl", label: "NFL", active: false },
  { id: "nba", label: "NBA", active: false },
  { id: "nhl", label: "NHL", active: false },
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
    return activeFilters.some(filter => 
      alert.sport.toLowerCase() === filter.toLowerCase()
    );
  }) : [];
  
  console.log("Filtered alerts:", filteredAlerts);

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
        <div className="mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
            Live Alerts ({alerts.length})
          </h2>
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
            {filteredAlerts.map((alert) => {
            return (
              <Card
                key={alert.id}
                className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-4 hover:shadow-lg transition-shadow"
                data-testid={`alert-card-${alert.id}`}
              >
                {/* Quick Impact Header */}
                <div className="text-center mb-2">
                  <h2 className="text-base font-black uppercase tracking-wide text-red-600">
                    ⚡ {alert.type.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}!
                  </h2>
                </div>
                
                {/* Key Situation */}
                <div className="text-center mb-2">
                  <h3 className="font-bold text-chirp-blue" style={{fontSize: '15px'}} data-testid={`alert-title-${alert.id}`}>
                    {alert.title.toUpperCase()}
                  </h3>
                </div>

                {/* Quick Action Insight */}
                <div className="text-center">
                  <p className="text-sm font-medium text-chirp-dark" data-testid={`alert-description-${alert.id}`}>
                    {alert.description}
                  </p>
                </div>

                {/* AI Analysis */}
                {alert.aiContext && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-2 border-blue-400">
                    <div className="flex items-start">
                      <span className="text-blue-600 mr-2">🤖</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-blue-800 mb-1">AI ANALYSIS</p>
                        <p className="text-sm text-blue-700" data-testid={`alert-ai-context-${alert.id}`}>
                          {alert.aiContext}
                        </p>
                        {alert.aiConfidence && (
                          <p className="text-xs text-blue-600 mt-2 font-medium">
                            {alert.aiConfidence}% Confidence
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
