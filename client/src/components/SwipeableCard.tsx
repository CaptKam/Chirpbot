import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import AlertFooter from "./AlertFooter";
import { WeatherImpactVisualizer } from "./WeatherImpactVisualizer";

interface SwipeableCardProps {
  alertData: any;
  onSwipe: (alertId: string, direction: 'left' | 'right') => void;
  isActive: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  alertData,
  onSwipe,
  isActive
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch live game data for score display
  const { data: gamesData } = useQuery({
    queryKey: ['games', 'today'],
    queryFn: async () => {
      const response = await fetch('/api/games/today');
      if (!response.ok) throw new Error('Failed to fetch games');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Extract scores from live data or alert context
  const gameData = gamesData?.games?.find((game: any) => 
    game.id === alertData?.context?.gameId ||
    (alertData?.context?.homeTeam?.id && game.homeTeam?.id === alertData.context.homeTeam.id)
  );

  const storedHomeScore = alertData?.context?.homeScore || alertData?.context?.homeTeam?.score || 0;
  const storedAwayScore = alertData?.context?.awayScore || alertData?.context?.awayTeam?.score || 0;
  const liveHomeScore = gameData?.homeTeam?.score || 0;
  const liveAwayScore = gameData?.awayTeam?.score || 0;

  // Use live scores if available, otherwise fall back to stored scores
  const displayHomeScore = gameData ? liveHomeScore : storedHomeScore;
  const displayAwayScore = gameData ? liveAwayScore : storedAwayScore;
  const hasLiveGame = !!gameData;

  // Debug logging
  console.log('🔍 SwipeableCard Score Debug:', {
    alertId: alertData?.id,
    storedHomeScore,
    storedAwayScore,
    liveHomeScore,
    liveAwayScore,
    displayHomeScore,
    displayAwayScore,
    hasLiveGame,
    gameStatus: gameData?.status,
    homeTeam: alertData?.context?.homeTeam || 'Home Team',
    awayTeam: alertData?.context?.awayTeam || 'Away Team'
  });

  const handleDragEnd = (info: any) => {
    setIsDragging(false);
    const threshold = 100;

    if (info.offset.x > threshold) {
      onSwipe(alertData.id, 'right');
    } else if (info.offset.x < -threshold) {
      onSwipe(alertData.id, 'left');
    }

    setDragOffset(0);
  };

  const getAlertTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'BASES_LOADED': 'from-red-500/20 to-red-600/20 border-red-500/40',
      'RISP': 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/40',
      'HOME_RUN': 'from-green-500/20 to-green-600/20 border-green-500/40',
      'CLOSE_GAME': 'from-purple-500/20 to-purple-600/20 border-purple-500/40',
      'LATE_PRESSURE': 'from-orange-500/20 to-orange-600/20 border-orange-500/40',
      'HOT_HITTER': 'from-blue-500/20 to-blue-600/20 border-blue-500/40',
      'POWER_HITTER': 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/40',
      default: 'from-slate-600/20 to-slate-700/20 border-slate-500/40'
    };

    return colorMap[type] || colorMap.default;
  };

  const formatTeamName = (team: any): string => {
    if (typeof team === 'string') return team;
    return team?.name || team?.displayName || team?.abbreviation || 'Unknown';
  };

  const formatScore = (score: number | undefined | null): string => {
    return (score ?? 0).toString();
  };

  const getAlertIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      'BASES_LOADED': '🔥',
      'RISP': '⚡',
      'HOME_RUN': '💥',
      'CLOSE_GAME': '🎯',
      'LATE_PRESSURE': '⏰',
      'HOT_HITTER': '🔥',
      'POWER_HITTER': '💪',
      default: '⚾'
    };

    return iconMap[type] || iconMap.default;
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDrag={(_, info) => setDragOffset(info.offset.x)}
      onDragEnd={(_, info) => handleDragEnd(info)}
      animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0.7 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`relative w-full max-w-sm mx-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className={`relative rounded-xl p-4 shadow-lg border bg-gradient-to-br ${getAlertTypeColor(alertData.type)} backdrop-blur-sm`}>

        {/* Swipe Indicators */}
        {Math.abs(dragOffset) > 50 && (
          <div className={`absolute inset-0 flex items-center justify-center rounded-xl transition-opacity ${
            dragOffset > 0 
              ? 'bg-green-500/20 opacity-70' 
              : 'bg-red-500/20 opacity-70'
          }`}>
            <span className="text-2xl">
              {dragOffset > 0 ? '✅' : '❌'}
            </span>
          </div>
        )}

        {/* Alert Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getAlertIcon(alertData.type)}</span>
            <span className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              {alertData.type.replace('_', ' ')}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {new Date(alertData.created_at).toLocaleTimeString()}
          </div>
        </div>

        {/* Score Display */}
        <div className="flex justify-center mb-3">
          <div className="bg-black/30 rounded-lg p-2 border border-slate-600/30">
            <div className="text-center">
              <div className="text-sm font-medium text-slate-300 mb-1">
                {formatTeamName(alertData?.context?.awayTeam)} @ {formatTeamName(alertData?.context?.homeTeam)}
              </div>
              <div className="text-xl font-bold text-white">
                {formatScore(displayAwayScore)} - {formatScore(displayHomeScore)}
                {hasLiveGame && <span className="ml-2 text-green-400 text-xs">LIVE</span>}
              </div>
              {alertData?.context?.inning && (
                <div className="text-xs text-slate-400">
                  {alertData.context.isTopInning ? 'Top' : 'Bottom'} {alertData.context.inning}
                  {alertData?.context?.outs !== undefined && (
                    <span className="ml-2">{alertData.context.outs} Outs</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Message */}
        <div className="text-center mb-3">
          <p className="text-slate-100 font-medium leading-relaxed">
            {alertData.message}
          </p>
        </div>

        {/* Probability & Priority */}
        <div className="flex justify-center space-x-4 mb-3">
          {alertData.priority && (
            <div className="bg-blue-500/20 rounded-full px-3 py-1 border border-blue-500/40">
              <span className="text-xs font-bold text-blue-200">
                {Math.round(alertData.priority)}% Confidence
              </span>
            </div>
          )}
        </div>

        {/* Weather Impact */}
        {alertData?.context?.weather && (
          <WeatherImpactVisualizer weather={alertData.context.weather} />
        )}

        {/* Betting Advice */}
        {alertData?.context?.aiAdvice && (
          <div className="mt-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-xs font-bold uppercase tracking-wide">💰 Betting Analysis</span>
            </div>
            <p className="text-xs font-medium text-green-200">
              {alertData.context.aiAdvice}
            </p>
          </div>
        )}

        {/* Alert Footer */}
        <AlertFooter 
          alertData={alertData} 
          gameData={gameData}
        />
      </div>
    </motion.div>
  );
};