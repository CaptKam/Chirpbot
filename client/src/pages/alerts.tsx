import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, Bell, Filter, Share2, Target, TrendingUp, 
  Timer, Trophy, Wind, Bot, AlertTriangle, 
  CircleDot, Users, Activity, Sparkles, Flame,
  DollarSign, ChevronRight, Shield, Brain, Clock,
  TrendingDown, Eye, BarChart3, Gamepad2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Alert } from "@/types";

const FILTER_OPTIONS = [
  { id: "all", label: "All Alerts", icon: Gamepad2, active: true },
  { id: "high-impact", label: "High Impact", icon: Flame, active: false },
  { id: "ai-verified", label: "AI Picks", icon: Brain, active: false },
  { id: "live", label: "Live Now", icon: CircleDot, active: false },
];

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 1000,
  });

  const toggleFilter = (filterId: string) => {
    if (filterId === "all") {
      setActiveFilters(["all"]);
    } else {
      setActiveFilters(prev => {
        const newFilters = prev.filter(f => f !== "all");
        if (prev.includes(filterId)) {
          const result = newFilters.filter(f => f !== filterId);
          return result.length === 0 ? ["all"] : result;
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
          label: "RISP",
          color: "from-red-500 to-orange-500",
          borderGlow: "shadow-red-500/50",
          badge: "bg-gradient-to-r from-red-500 to-orange-500",
          pulse: true,
          priority: 95
        };
      case "HOMERUN":
        return {
          icon: Trophy,
          label: "HOME RUN",
          color: "from-purple-500 to-pink-500",
          borderGlow: "shadow-purple-500/50",
          badge: "bg-gradient-to-r from-purple-500 to-pink-500",
          pulse: false,
          priority: 85
        };
      case "REDZONE":
        return {
          icon: AlertTriangle,
          label: "RED ZONE",
          color: "from-orange-500 to-red-500",
          borderGlow: "shadow-orange-500/50",
          badge: "bg-gradient-to-r from-orange-500 to-red-500",
          pulse: true,
          priority: 90
        };
      case "CLUTCHTIME":
        return {
          icon: Timer,
          label: "CLUTCH TIME",
          color: "from-blue-500 to-cyan-500",
          borderGlow: "shadow-blue-500/50",
          badge: "bg-gradient-to-r from-blue-500 to-cyan-500",
          pulse: true,
          priority: 88
        };
      case "WEATHERIMPACT":
        return {
          icon: Wind,
          label: "WEATHER",
          color: "from-teal-500 to-green-500",
          borderGlow: "shadow-teal-500/50",
          badge: "bg-gradient-to-r from-teal-500 to-green-500",
          pulse: false,
          priority: 70
        };
      case "POWERPLAY":
        return {
          icon: Zap,
          label: "POWER PLAY",
          color: "from-yellow-500 to-orange-500",
          borderGlow: "shadow-yellow-500/50",
          badge: "bg-gradient-to-r from-yellow-500 to-orange-500",
          pulse: true,
          priority: 85
        };
      default:
        return {
          icon: Bell,
          label: type.toUpperCase(),
          color: "from-gray-500 to-gray-600",
          borderGlow: "shadow-gray-500/50",
          badge: "bg-gradient-to-r from-gray-500 to-gray-600",
          pulse: false,
          priority: 50
        };
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (activeFilters.includes("all")) return true;
    if (activeFilters.includes("high-impact") && alert.priority && alert.priority >= 80) return true;
    if (activeFilters.includes("ai-verified") && alert.aiConfidence && alert.aiConfidence >= 85) return true;
    if (activeFilters.includes("live") && alert.gameInfo.status.toLowerCase().includes("live")) return true;
    return false;
  }).sort((a, b) => {
    const aPriority = getAlertTypeConfig(a.type).priority;
    const bPriority = getAlertTypeConfig(b.type).priority;
    return bPriority - aPriority;
  });

  // Stats Bar Data
  const stats = {
    total: alerts.length,
    highImpact: alerts.filter(a => a.priority && a.priority >= 80).length,
    aiPicks: alerts.filter(a => a.aiConfidence && a.aiConfidence >= 85).length,
    live: alerts.filter(a => a.gameInfo.status.toLowerCase().includes("live")).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1419] to-[#1a1f2e]">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0F1419]/90 border-b border-gray-800/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00DC82] to-[#36D399] rounded-lg blur opacity-75 animate-pulse"></div>
                <div className="relative bg-[#0F1419] px-3 py-1.5 rounded-lg border border-[#00DC82]/20">
                  <h1 className="text-xl font-black text-white flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-[#00DC82]" />
                    LIVE ALERTS
                  </h1>
                </div>
              </div>
              {!isLoading && (
                <div className="flex items-center space-x-1 text-xs">
                  <div className="w-2 h-2 bg-[#00DC82] rounded-full animate-pulse"></div>
                  <span className="text-gray-400">Real-time</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-[#00DC82] to-[#36D399] text-black font-bold px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-[#00DC82]/25 transition-all"
              >
                <Bell className="w-4 h-4 mr-1" />
                Subscribe
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, color: "text-white" },
              { label: "High Impact", value: stats.highImpact, color: "text-orange-400" },
              { label: "AI Picks", value: stats.aiPicks, color: "text-[#00DC82]" },
              { label: "Live", value: stats.live, color: "text-red-400" }
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800">
                <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
            {FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = activeFilters.includes(option.id);
              return (
                <motion.button
                  key={option.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleFilter(option.id)}
                  data-testid={`filter-${option.id}`}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                    ${isActive 
                      ? "bg-gradient-to-r from-[#00DC82] to-[#36D399] text-black shadow-lg shadow-[#00DC82]/25" 
                      : "bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Alerts Feed */}
      <div className="p-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-900/50 rounded-xl p-4 animate-pulse border border-gray-800">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-6 bg-gray-800 rounded w-32"></div>
                    <div className="h-5 bg-gray-800 rounded w-20"></div>
                  </div>
                  <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-800 rounded w-1/2 mb-3"></div>
                  <div className="h-20 bg-gray-800 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredAlerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/50 rounded-xl p-8 text-center border border-gray-800"
            >
              <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No Alerts Available</h3>
              <p className="text-sm text-gray-400">
                Alerts will appear here when games go live. Check back soon!
              </p>
            </motion.div>
          ) : (
            filteredAlerts.map((alert, index) => {
              const config = getAlertTypeConfig(alert.type);
              const AlertIcon = config.icon;
              const isSelected = selectedAlert === alert.id;
              
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedAlert(isSelected ? null : alert.id)}
                  className="mb-3 cursor-pointer"
                >
                  <Card
                    className={`
                      relative overflow-hidden bg-gray-900/80 border border-gray-800 
                      hover:border-gray-700 transition-all duration-300
                      ${isSelected ? 'ring-2 ring-[#00DC82] shadow-xl shadow-[#00DC82]/10' : ''}
                      ${config.pulse ? 'animate-pulse-slow' : ''}
                    `}
                    data-testid={`alert-card-${alert.id}`}
                  >
                    {/* Priority Indicator */}
                    {config.priority >= 90 && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-shimmer"></div>
                    )}

                    {/* Main Content */}
                    <div className="p-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {/* Alert Type Badge */}
                          <div className={`relative`}>
                            <div className={`absolute -inset-1 bg-gradient-to-r ${config.color} rounded-lg blur opacity-50`}></div>
                            <div className={`relative bg-gradient-to-r ${config.badge} p-2 rounded-lg`}>
                              <AlertIcon className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className={`font-black text-lg bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                                {config.label}
                              </h3>
                              {alert.aiConfidence && alert.aiConfidence >= 85 && (
                                <Badge className="bg-[#00DC82]/20 text-[#00DC82] border-[#00DC82]/30 text-xs">
                                  <Brain className="w-3 h-3 mr-1" />
                                  AI {alert.aiConfidence}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                                {alert.sport}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live Indicator */}
                        {alert.gameInfo.status.toLowerCase().includes("live") && (
                          <div className="flex items-center space-x-1 bg-red-500/20 px-2 py-1 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-red-400">LIVE</span>
                          </div>
                        )}
                      </div>

                      {/* Team Matchup - Clean and Modern */}
                      <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg p-3 mb-3 border border-gray-800">
                        <div className="flex items-center justify-center space-x-3">
                          <span className="text-lg font-bold text-white">
                            {alert.gameInfo.awayTeam}
                          </span>
                          <span className="text-gray-500">@</span>
                          <span className="text-lg font-bold text-white">
                            {alert.gameInfo.homeTeam}
                          </span>
                        </div>
                      </div>

                      {/* Alert Description */}
                      <div className="bg-black/30 rounded-lg p-3 mb-3 border border-gray-800">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>

                      {/* AI Analysis - Premium Style */}
                      {alert.aiContext && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: isSelected ? 1 : 0.8, height: isSelected ? "auto" : "auto" }}
                          className="bg-gradient-to-r from-[#00DC82]/10 to-[#36D399]/10 rounded-lg p-3 border border-[#00DC82]/20"
                        >
                          <div className="flex items-start space-x-2">
                            <Brain className="w-4 h-4 text-[#00DC82] mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-xs font-bold text-[#00DC82] uppercase tracking-wide">AI Analysis</span>
                              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                                {alert.aiContext}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Action Row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                        <div className="flex items-center space-x-3">
                          {alert.priority && alert.priority >= 80 && (
                            <div className="flex items-center space-x-1">
                              <Flame className="w-4 h-4 text-orange-400" />
                              <span className="text-xs font-bold text-orange-400">HIGH IMPACT</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-white hover:bg-gray-800"
                            data-testid={`alert-share-${alert.id}`}
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-20 right-4 z-40"
      >
        <Button
          size="lg"
          className="bg-gradient-to-r from-[#00DC82] to-[#36D399] text-black font-bold rounded-full shadow-2xl shadow-[#00DC82]/30 hover:shadow-[#00DC82]/50 transition-all"
        >
          <DollarSign className="w-5 h-5 mr-2" />
          BET NOW
        </Button>
      </motion.div>
    </div>
  );
}