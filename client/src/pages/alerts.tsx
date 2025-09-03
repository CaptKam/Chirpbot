
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AlertFooter from '@/components/AlertFooter';
import { SwipeableCard } from '@/components/SwipeableCard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Activity, Zap, Clock, TrendingUp, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { removeCity } from '@/lib/team-utils';

interface Alert {
  id: string;
  type: string;
  message: string;
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  confidence: number;
  priority: number;
  createdAt: string;
  payload?: any;
  // Context data
  inning?: number;
  isTopInning?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  context?: any;
}

function AlertsPage() {
  const [selectedTab, setSelectedTab] = useState("all");

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/alerts'],
    queryFn: () => apiRequest('GET', '/api/alerts'),
    refetchInterval: 5000
  });

  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    queryFn: () => apiRequest('GET', '/api/alerts/stats'),
    refetchInterval: 10000
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Filter alerts based on selected tab
  const filteredAlerts = alerts.filter((alert: Alert) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "high") return alert.priority >= 85;
    if (selectedTab === "live") return alert.type.includes('LIVE') || alert.type === 'RISP' || alert.type === 'BASES_LOADED';
    return true;
  });

  // Get alert type emoji and display name
  const getAlertDisplay = (type: string) => {
    const displays = {
      'RISP': { emoji: '⚾', name: 'Scoring Position', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      'BASES_LOADED': { emoji: '🔥', name: 'Bases Loaded', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      'RUNNERS_1ST_2ND': { emoji: '💎', name: 'Prime Spot', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      'HOME_RUN_LIVE': { emoji: '🏠', name: 'Home Run', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      'STRIKEOUT': { emoji: '⚡', name: 'Strikeout', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      'CLOSE_GAME_LIVE': { emoji: '🔥', name: 'Close Game', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      'FULL_COUNT': { emoji: '⚾', name: 'Full Count', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
      'POWER_HITTER': { emoji: '💪', name: 'Power Hitter', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      'TWO_MINUTE_WARNING': { emoji: '⏰', name: 'Two Minute Warning', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      'NCAAF_KICKOFF': { emoji: '🏈', name: 'Kickoff', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      'NCAAF_HALFTIME': { emoji: '⏸️', name: 'Halftime', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    };
    return displays[type as keyof typeof displays] || { emoji: '📊', name: type.replace('_', ' '), color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Live Alerts</h1>
                <p className="text-sm text-slate-400">{filteredAlerts.length} active alerts</p>
              </div>
            </div>
            {alertStats && (
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-400">{alertStats.liveGames} Live</div>
                <div className="text-xs text-slate-400">games</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-600/30">
              <TabsTrigger value="all" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                All
              </TabsTrigger>
              <TabsTrigger value="high" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                High Priority
              </TabsTrigger>
              <TabsTrigger value="live" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                Live Action
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No alerts right now</h3>
            <p className="text-slate-500">Live alerts will appear here during games</p>
          </div>
        ) : (
          filteredAlerts.map((alert: Alert) => {
            const alertDisplay = getAlertDisplay(alert.type);
            const parsedPayload = alert.payload ? JSON.parse(alert.payload) : {};
            const context = parsedPayload.context || {};
            
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SwipeableCard
                  alertId={alert.id}
                  className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200"
                  alertData={{
                    sport: alert.sport,
                    homeTeam: alert.homeTeam,
                    awayTeam: alert.awayTeam,
                    homeScore: alert.homeScore,
                    awayScore: alert.awayScore,
                    priority: alert.priority,
                    betbookData: parsedPayload.betbookData,
                    gameInfo: parsedPayload.gameInfo
                  }}
                >
                  <CardContent className="p-5">
                    {/* Alert Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Badge className={`px-3 py-1.5 text-sm font-semibold border ${alertDisplay.color}`}>
                          <span className="mr-2 text-base">{alertDisplay.emoji}</span>
                          {alertDisplay.name}
                        </Badge>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-emerald-400">{alert.confidence}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{formatTime(alert.createdAt)}</span>
                    </div>
                    
                    {/* Game Matchup - Clean, No Duplicates */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">
                          {removeCity(alert.awayTeam)} @ {removeCity(alert.homeTeam)}
                        </div>
                        {(alert.awayScore !== undefined && alert.homeScore !== undefined) && (
                          <div className="text-lg font-bold text-slate-300">
                            {alert.awayScore} - {alert.homeScore}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Alert Message - Simple & Clear */}
                    <div className="mb-4">
                      <p className="text-slate-200 text-base leading-relaxed">
                        {alert.message.replace(/.*vs\s+\w+\s+-\s*/, '').replace(/.*@\s+\w+\s+-\s*/, '')}
                      </p>
                    </div>
                    
                    {/* Game Situation Footer */}
                    <AlertFooter 
                      inning={context.inning}
                      isTopInning={context.isTopInning}
                      outs={context.outs}
                      balls={context.balls}
                      strikes={context.strikes}
                      hasFirst={context.hasFirst}
                      hasSecond={context.hasSecond}
                      hasThird={context.hasThird}
                      sport={alert.sport}
                      quarter={context.quarter}
                      timeRemaining={context.timeRemaining}
                    />
                  </CardContent>
                </SwipeableCard>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AlertsPage;
