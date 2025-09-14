import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Download, TrendingUp, Target, Zap, Brain, Calculator, Activity, Clock } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AlertFooter from '@/components/AlertFooter';
import { Badge } from '@/components/ui/badge';
import { TeamLogo } from '@/components/team-logo';
import { GameCardTemplate } from '@/components/GameCardTemplate';
import { Alert } from '@/types';
import { BaseballDiamond } from '@/components/baseball-diamond';
import { getPrimaryMessage, cleanMessage, hasAIContent } from '@/utils/alert-message';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

// Utility functions
function formatTime(date: string | Date): string {
  const alertTime = new Date(date);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return alertTime.toLocaleDateString();
}

// Sport-specific color mapping
function getSportColors(sport: string): { 
  badge: string, 
  alertBg: string, 
  alertBorder: string, 
  probability: string 
} {
  switch (sport.toUpperCase()) {
    case 'MLB':
      return {
        badge: 'border-green-500/40 text-green-400 bg-green-500/10',
        alertBg: 'bg-green-500/10',
        alertBorder: 'border-green-500/30',
        probability: 'bg-green-500/20 border-green-400/40 text-green-300'
      };
    case 'NFL':
      return {
        badge: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
        alertBg: 'bg-orange-500/10',
        alertBorder: 'border-orange-500/30',
        probability: 'bg-orange-500/20 border-orange-400/40 text-orange-300'
      };
    case 'NBA':
      return {
        badge: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
        alertBg: 'bg-purple-500/10',
        alertBorder: 'border-purple-500/30',
        probability: 'bg-purple-500/20 border-purple-400/40 text-purple-300'
      };
    case 'WNBA':
      return {
        badge: 'border-pink-500/40 text-pink-400 bg-pink-500/10',
        alertBg: 'bg-pink-500/10',
        alertBorder: 'border-pink-500/30',
        probability: 'bg-pink-500/20 border-pink-400/40 text-pink-300'
      };
    case 'CFL':
      return {
        badge: 'border-red-500/40 text-red-400 bg-red-500/10',
        alertBg: 'bg-red-500/10',
        alertBorder: 'border-red-500/30',
        probability: 'bg-red-500/20 border-red-400/40 text-red-300'
      };
    case 'NCAAF':
      return {
        badge: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
        alertBg: 'bg-blue-500/10',
        alertBorder: 'border-blue-500/30',
        probability: 'bg-blue-500/20 border-blue-400/40 text-blue-300'
      };
    case 'NHL':
      return {
        badge: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
        alertBg: 'bg-cyan-500/10',
        alertBorder: 'border-cyan-500/30',
        probability: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
      };
    default:
      return {
        badge: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
        alertBg: 'bg-emerald-500/10',
        alertBorder: 'border-emerald-500/30',
        probability: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
      };
  }
}

function getAlertStatus(alertType: string, createdAt: string, gameStatus?: string): { status: 'ACTIVE' | 'EXPIRED', minutesAgo: number } {
  const alertTime = new Date(createdAt);
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));

  // If game is final, all alerts are expired
  if (gameStatus === 'final') {
    return { status: 'EXPIRED', minutesAgo };
  }

  // Time-sensitive alert types and their expiration times (in minutes)
  const alertExpirationTimes: Record<string, number> = {
    'BASES_LOADED': 15,        // Bases loaded situation typically lasts 3-5 at-bats
    'RISP': 12,                // Runners in scoring position
    'FULL_COUNT': 3,           // Full count expires very quickly
    'POWER_HITTER': 8,         // Power hitter at bat
    'HOT_HITTER': 8,           // Hot hitter at bat
    'RUNNERS_1ST_2ND': 12,     // Runners on 1st and 2nd
    'RED_ZONE': 8,             // Football red zone opportunity
    'FOURTH_DOWN': 2,          // Fourth down decision
    'TWO_MINUTE_WARNING': 5,   // Two minute warning context
    'POWER_PLAY': 4,           // Hockey power play (typically 2 minutes)
    'EMPTY_NET': 3,            // Hockey empty net situation
    'CLUTCH_TIME': 10,         // Basketball clutch time
    // Game state alerts last longer
    'CLOSE_GAME': 30,
    'CLOSE_GAME_LIVE': 30,
    'HIGH_SCORING': 45,
    'LATE_PRESSURE': 20,
    'OVERTIME': 60,
    'BLOWOUT': 60,
    'SHUTOUT': 60
  };

  const expirationMinutes = alertExpirationTimes[alertType] || 10; // Default 10 minutes
  const isActive = minutesAgo <= expirationMinutes;

  return {
    status: isActive ? 'ACTIVE' : 'EXPIRED',
    minutesAgo
  };
}

function getAlertColor(priority: number): string {
  if (priority >= 90) return 'bg-red-400';
  if (priority >= 80) return 'bg-orange-400';
  if (priority >= 70) return 'bg-yellow-400';
  return 'bg-blue-400';
}

interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
}


interface SwipeableCardProps {
  children: React.ReactNode;
  alertId: string;
  className?: string;
  onTap?: () => void;
  alertData?: Alert;
  [key: string]: any;
}

interface Sportsbook {
  name: string;
  logo: string;
  appUrl: string;
  storeUrl: string;
  color: string;
}

const sportsbooks: Sportsbook[] = [
  {
    name: 'Bet365',
    logo: bet365Logo,
    appUrl: 'bet365://',
    storeUrl: 'https://apps.apple.com/app/bet365-sportsbook-casino/id454638411',
    color: '#1E5F2F'
  },
  {
    name: 'DraftKings',
    logo: draftkingsLogo,
    appUrl: 'draftkings://',
    storeUrl: 'https://apps.apple.com/app/draftkings-sportsbook-casino/id1051014021',
    color: '#FF6B35'
  },
  {
    name: 'Fanatics',
    logo: fanaticsLogo,
    appUrl: 'fanatics://',
    storeUrl: 'https://apps.apple.com/app/fanatics-sportsbook-casino/id1601393479',
    color: '#E31837'
  },
  {
    name: 'FanDuel',
    logo: fanduelLogo,
    appUrl: 'fanduel://',
    storeUrl: 'https://apps.apple.com/app/fanduel-sportsbook-casino/id1273132976',
    color: '#0D7EFF'
  },
  {
    name: 'BetMGM',
    logo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkZEODAwIi8+PHRleHQgeD0iMjAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMDAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTJweCIgZm9udC13ZWlnaHQ9ImJvbGQiPk1HTTwvdGV4dD48L3N2Zz4=',
    appUrl: 'betmgm://',
    storeUrl: 'https://apps.apple.com/app/betmgm-sportsbook/id1439016742',
    color: '#FFD800'
  }
];

export function SwipeableCard({ children, alertId, className, onTap, alertData, ...props }: SwipeableCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoReturnTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Fetch live game data for MLB alerts to get current scores
  const { data: todaysGames } = useQuery({
    queryKey: ["/api/games/today", { sport: alertData?.sport || "MLB" }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch games");
      return response.json();
    },
    enabled: alertData?.sport === 'MLB', // Only fetch for MLB alerts
    refetchInterval: 15000, // Refresh every 15 seconds for live scores
    staleTime: 10000,
  });

  // Fetch live weather data for the game
  const homeTeamName = React.useMemo(() => {
    if (!alertData) return '';
    if (typeof alertData.homeTeam === 'string') return alertData.homeTeam;
    return alertData.homeTeam?.name || '';
  }, [alertData]);

  const { data: weatherData } = useQuery({
    queryKey: ['weather', homeTeamName],
    queryFn: async () => {
      const response = await fetch(`/api/weather/team/${encodeURIComponent(homeTeamName)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Weather fetch failed');
      return response.json();
    },
    enabled: !!homeTeamName, // Only fetch if we have a team name
    refetchInterval: 60000, // Refresh every minute
    staleTime: 60000, // Cache data for 1 minute
  });


  // Find the matching game for this alert to get live scores
  const liveGameData = React.useMemo(() => {
    if (!todaysGames?.games || !alertData) return null;

    return todaysGames.games.find((game: any) => {
      // Match by team names (both home and away combinations)
      const gameHomeTeam = game.homeTeam?.name || '';
      const gameAwayTeam = game.awayTeam?.name || '';
      const alertHomeTeam = typeof alertData?.homeTeam === 'string' ? alertData.homeTeam : alertData?.homeTeam?.name || '';
      const alertAwayTeam = typeof alertData?.awayTeam === 'string' ? alertData.awayTeam : alertData?.awayTeam?.name || '';

      return (gameHomeTeam === alertHomeTeam && gameAwayTeam === alertAwayTeam) ||
             (gameHomeTeam === alertAwayTeam && gameAwayTeam === alertHomeTeam);
    });
  }, [todaysGames, alertData]);

  // Calculate scores to display - use live scores if available, fallback to stored scores
  const displayScores = React.useMemo(() => {
    const storedHomeScore = alertData?.context?.homeScore ?? alertData?.homeScore ?? 0;
    const storedAwayScore = alertData?.context?.awayScore ?? alertData?.awayScore ?? 0;

    // Use live scores if we have live game data and it's a live or final game
    if (liveGameData && (liveGameData.status === 'live' || liveGameData.status === 'final')) {
      return {
        homeScore: liveGameData.homeTeam?.score ?? storedHomeScore,
        awayScore: liveGameData.awayTeam?.score ?? storedAwayScore,
        isLive: true
      };
    }

    // Fallback to stored scores
    return {
      homeScore: storedHomeScore,
      awayScore: storedAwayScore,
      isLive: false
    };
  }, [liveGameData, alertData]);

  // Debug score data
  React.useEffect(() => {
    if (alertData) {
      console.log('🔍 SwipeableCard Score Debug:', {
        alertId: alertData?.id,
        storedHomeScore: alertData?.homeScore,
        storedAwayScore: alertData?.awayScore,
        liveHomeScore: liveGameData?.homeTeam?.score,
        liveAwayScore: liveGameData?.awayTeam?.score,
        displayHomeScore: displayScores.homeScore,
        displayAwayScore: displayScores.awayScore,
        hasLiveGame: !!liveGameData,
        gameStatus: liveGameData?.status,
        homeTeam: alertData?.homeTeam,
        awayTeam: alertData?.awayTeam
      });
    }
  }, [alertData, liveGameData, displayScores]);

  const handleSportsbookClick = (sportsbook: Sportsbook) => {
    // Try to open the app first, with better fallback handling
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // On mobile, try deep link first
      const startTime = Date.now();
      const link = document.createElement('a');
      link.href = sportsbook.appUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Check if app opened, fallback to store if not
      setTimeout(() => {
        if (Date.now() - startTime < 1500) {
          window.open(sportsbook.storeUrl, '_blank');
        }
      }, 1000);
    } else {
      // On desktop, go directly to web version
      const webUrls = {
        'Bet365': 'https://www.bet365.com',
        'DraftKings': 'https://sportsbook.draftkings.com',
        'Fanatics': 'https://sportsbook.fanaticsbetting.com',
        'FanDuel': 'https://sportsbook.fanduel.com',
        'BetMGM': 'https://sports.betmgm.com'
      };
      window.open(webUrls[sportsbook.name as keyof typeof webUrls] || sportsbook.storeUrl, '_blank');
    }

    toast({
      title: `Opening ${sportsbook.name}`,
      description: `Launching ${sportsbook.name} sportsbook...`,
    });
  };

  const handleDeleteAlert = async () => {
    setIsDeleting(true);
    try {
      const response = await apiRequest("DELETE", `/api/alerts/${alertId}`);

      // Immediately update the query cache to remove the deleted alert
      queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((alert: any) => alert.id !== alertId);
      });

      // Invalidate queries to refresh from server
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/unseen/count'] });

      toast({
        title: "Alert deleted",
        description: "The alert has been removed from your feed.",
      });
    } catch (error: any) {
      console.error('Delete alert error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const startAutoReturnTimer = () => {
    // Clear any existing timer
    if (autoReturnTimeoutRef.current) {
      clearTimeout(autoReturnTimeoutRef.current);
    }

    // Set new timer to return to center after 3 seconds
    autoReturnTimeoutRef.current = setTimeout(() => {
      setDragX(0);
    }, 3000);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 80; // Lower threshold for better responsiveness
    const velocity = info.velocity.x;

    // Use velocity for more natural swipe detection
    if (Math.abs(info.offset.x) < threshold && Math.abs(velocity) < 300) {
      setDragX(0);
    } else if (info.offset.x > threshold || velocity > 300) {
      // Swiped right - show delete
      setDragX(120);
      startAutoReturnTimer();
    } else if (info.offset.x < -threshold || velocity < -300) {
      // Swiped left - show sportsbooks
      setDragX(-360);
      startAutoReturnTimer();
    } else {
      setDragX(0);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
    // Clear any existing timer when starting a new drag
    if (autoReturnTimeoutRef.current) {
      clearTimeout(autoReturnTimeoutRef.current);
    }
  };

  const handleTap = () => {
    if (!isDragging && onTap) {
      onTap();
    }
  };

  // Clear timer on component unmount
  React.useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) {
        clearTimeout(autoReturnTimeoutRef.current);
      }
    };
  }, []);

  // Construct a display message for sharing/copying
  const displayMessage = React.useMemo(() => {
    const homeTeamName = typeof alertData?.homeTeam === 'string' ? alertData.homeTeam : alertData?.homeTeam?.name || '';
    const awayTeamName = typeof alertData?.awayTeam === 'string' ? alertData.awayTeam : alertData?.awayTeam?.name || '';
    let message = `ChirpBot Alert: ${homeTeamName} vs ${awayTeamName}`;
    if (alertData?.sport) message += ` (${alertData.sport})`;
    if (alertData?.probability !== undefined) message += ` - Probability: ${alertData.probability.toFixed(2)}%`;
    if (alertData?.priority !== undefined) message += ` - Priority: ${alertData.priority}`;
    if (alertData?.context?.reasons) {
      message += `\nReasons: ${alertData.context.reasons.join(', ')}`;
    }
    if (alertData?.betbookData?.aiAdvice) {
      message += `\nAI Advice: ${alertData.betbookData.aiAdvice}`;
    }
    return message;
  }, [alertData]);

  // Early null check to help TypeScript understand alertData is defined
  if (!alertData) {
    return <div className="p-4 text-gray-500">No alert data available</div>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl mx-2 sm:mx-0">
      {/* AI Betting Insights Panel (Left Swipe) - Only show when swiped left */}
      <div className={`absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent transition-opacity duration-300 ${
        dragX < -50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {(alertData?.betbookData || alertData?.context?.reasons || alertData?.context?.aiBettingAdvice || alertData?.context?.aiGameProjection) ? (
          <div className="h-full flex flex-col justify-center p-4 space-y-3">
            {/* AI Insights Header */}
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">AI Betting Insights</p>
                <p className="text-blue-200 text-xs">ChirpBot v3 Analysis</p>
              </div>
            </div>

            {/* AI Betting Advice */}
            {alertData?.context?.aiBettingAdvice && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-400 text-xs font-bold uppercase tracking-wide">💰 AI Betting Analysis</span>
                  <span className="text-green-300 text-xs">
                    {alertData.context.aiBettingAdvice.confidence.toFixed(1)}% confidence
                  </span>
                </div>
                <p className="text-xs font-medium text-green-100 mb-2">
                  {alertData.context.aiBettingAdvice.recommendation}
                </p>

                {/* Reasoning */}
                <div className="space-y-1 mb-2">
                  {alertData.context.aiBettingAdvice.reasoning?.map((reason: string, idx: number) => (
                    <p key={idx} className="text-xs text-green-100">• {reason}</p>
                  ))}
                </div>

                {/* Suggested Bets */}
                <div className="flex flex-wrap gap-1">
                  {alertData.context.aiBettingAdvice.suggestedBets?.map((bet: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 text-xs bg-green-600/20 text-green-300 rounded">
                      {bet}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Game Projection */}
            {alertData?.context?.aiGameProjection && (
              <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-purple-400 text-xs font-bold uppercase tracking-wide">🔮 AI Game Projection</span>
                </div>

                <p className="text-xs font-medium text-purple-100 mb-2">
                  Final: {alertData.context.aiGameProjection.finalScorePrediction}
                </p>

                {/* Win Probability */}
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-purple-300">
                    {typeof alertData?.context?.homeTeam === 'string' ? alertData.context.homeTeam : alertData?.context?.homeTeam?.name || 'Home'}: {(alertData.context as any).aiGameProjection?.winProbability?.home}%
                  </span>
                  <span className="text-purple-300">
                    {typeof alertData?.context?.awayTeam === 'string' ? alertData.context.awayTeam : alertData?.context?.awayTeam?.name || 'Away'}: {(alertData.context as any).aiGameProjection?.winProbability?.away}%
                  </span>
                </div>

                {/* Key Moments */}
                <div className="space-y-1">
                  {alertData.context.aiGameProjection.keyMoments?.map((moment: string, idx: number) => (
                    <p key={idx} className="text-xs text-purple-100">⏱️ {moment}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy Betting Analysis (fallback) */}
            {alertData?.betbookData && !alertData?.context?.aiBettingAdvice && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-400 text-xs font-bold uppercase tracking-wide">💰 Betting Analysis</span>
                  <span className="text-green-300 text-xs">
                    {alertData.context?.scoringProbability || alertData.confidence}% confidence
                  </span>
                </div>
                <p className="text-xs text-green-100 mb-2">
                  {alertData.betbookData.aiAdvice}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-100">
                    O/U: {alertData.betbookData.odds?.total}
                  </span>
                  <span className="text-slate-100">
                    Spread: {alertData.betbookData.odds?.home > 0 ? '+' : ''}{alertData.betbookData.odds?.home}
                  </span>
                </div>
              </div>
            )}

            {/* Betting Recommendations Based on Game Situation */}
            {(alertData.context?.reasons || (alertData.priority && alertData.priority >= 80)) && !alertData?.context?.aiBettingAdvice && (
              <div className="space-y-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-100 font-semibold">Recommended Bet</span>
                  </div>
                  <p className="text-white text-sm font-medium">
                    {alertData.context?.recommendation ||
                     alertData.betbookData?.aiAdvice ||
                     (() => {
                       const sport = alertData.sport || 'MLB';
                       const tier = Math.ceil((alertData.priority || 70) / 25);
                       const homeScore = alertData.context?.homeScore || alertData.homeScore || 0;
                       const awayScore = alertData.context?.awayScore || alertData.awayScore || 0;
                       const totalScore = homeScore + awayScore;

                       if (sport === 'MLB') {
                         const overLine = Math.max(totalScore + 1.5, 7.5);
                         if (tier >= 3) {
                           return `Bet Over ${overLine} runs - High-tier scoring opportunity`;
                         } else {
                           return `Bet Over ${overLine} runs - Live betting situation`;
                         }
                       } else {
                         return "Live bet recommended - High-value situation detected";
                       }
                     })()
                    }
                  </p>
                </div>

                {/* AI Analysis Reasons */}
                {(alertData.context?.reasons || alertData.context?.aiInsights) && !alertData?.context?.aiBettingAdvice && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 ring-1 ring-white/10">
                    <div className="flex items-center space-x-2 mb-1">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-100 font-medium">AI Analysis</span>
                      <span className="text-xs text-green-300 font-mono">
                        {alertData.context.confidence.toFixed(1)}% confidence
                      </span>
                    </div>

                    {/* AI Insights */}
                    {alertData.context?.aiInsights && (
                      <div className="mb-2 p-2 bg-blue-500/10 rounded border-l-2 border-blue-400">
                        <p className="text-xs text-blue-200 font-medium">{alertData.context.aiInsights}</p>
                      </div>
                    )}

                    {/* Context Reasons */}
                    {alertData.context?.reasons && (
                      <ul className="text-xs text-white/90 space-y-0.5">
                        {alertData.context.reasons.slice(0, 2).map((reason, idx) => (
                          <li key={idx} className="flex items-start space-x-1">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Quick Sportsbook Access */}
            <div className="space-y-2">
              <p className="text-xs text-blue-200 font-medium tracking-wide uppercase">Quick Bet</p>
              <div className="flex space-x-2">
                {sportsbooks.slice(0, 4).map((sportsbook) => (
                  <div key={sportsbook.name} className="flex flex-col items-center space-y-1">
                    <Button
                      onClick={() => {
                        handleSportsbookClick(sportsbook);
                        setDragX(0);
                      }}
                      className="h-10 w-10 p-1 rounded-lg bg-white/90 shadow-lg ring-2 ring-white/20"
                      style={{ backgroundColor: `${sportsbook.color}15`, borderColor: `${sportsbook.color}30` }}
                      data-testid={`ai-sportsbook-${sportsbook.name.toLowerCase()}`}
                    >
                      <img
                        src={sportsbook.logo}
                        alt={sportsbook.name}
                        className="w-full h-full rounded object-contain"
                      />
                    </Button>
                    <span className="text-xs text-white/80 font-medium">{sportsbook.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/30">
              <button
                className="flex-1 px-3 py-2 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(displayMessage);
                  toast({ title: "Copied to clipboard", description: displayMessage.substring(0, 50) + "..." });
                }}
              >
                📋 Copy
              </button>
              <button
                className="flex-1 px-3 py-2 text-xs font-medium bg-blue-500/20 text-blue-400 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  // Share alert
                  if (navigator.share) {
                    navigator.share({ text: displayMessage }).catch(() => {
                      toast({ title: "Sharing failed", description: "Could not share this alert." });
                    });
                  } else {
                    toast({ title: "Sharing not supported", description: "Your browser does not support sharing." });
                  }
                }}
              >
                📤 Share
              </button>
            </div>
          </div>
        ) : (
          // Fallback to original sportsbook buttons when no AI data
          (<div className="h-full flex flex-col items-center justify-center p-4 space-y-3">
            <h4 className="text-sm text-white/90 font-semibold tracking-wide">Sports Betting</h4>
            <div className="grid grid-cols-2 gap-3">
              {sportsbooks.map((sportsbook) => (
                <div key={sportsbook.name} className="flex flex-col items-center space-y-1">
                  <Button
                    onClick={() => {
                      handleSportsbookClick(sportsbook);
                      setDragX(0);
                    }}
                    className="h-12 w-12 p-1.5 rounded-xl bg-white/90 shadow-xl ring-2 ring-white/30"
                    style={{ backgroundColor: `${sportsbook.color}20`, borderColor: `${sportsbook.color}40` }}
                    data-testid={`sportsbook-${sportsbook.name.toLowerCase()}`}
                  >
                    <img
                      src={sportsbook.logo}
                      alt={sportsbook.name}
                      className="w-full h-full rounded-lg object-contain"
                    />
                  </Button>
                  <span className="text-xs text-white/90 font-medium text-center">{sportsbook.name}</span>
                </div>
              ))}
            </div>
          </div>)
        )}
      </div>
      {/* Delete Menu (Right Swipe) - Only show when swiped right */}
      <div className={`absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent flex items-center justify-start pl-4 transition-opacity duration-300 ${
        dragX > 30 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteAlert();
            setDragX(0); // Return to center after click
          }}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 ring-1 ring-red-500/30"
          data-testid={`delete-alert-${alertId}`}
          disabled={isDeleting}
        >
          <Trash2 className={`w-5 h-5 text-red-400 ${isDeleting ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {/* Main Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -400, right: 150 }}
        dragElastic={0.15}
        dragMomentum={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        animate={{ x: dragX }}
        transition={{
          type: "spring",
          damping: 20,
          stiffness: 250,
          mass: 0.6
        }}
        className="relative z-10"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        whileDrag={{ scale: 1.01, cursor: "grabbing" }}
      >
        <Card className={`${className} border-2 ${
          getAlertStatus(alertData.type, alertData.createdAt || '', liveGameData?.status).status === 'ACTIVE'
            ? 'border-emerald-500 shadow-emerald-500/20'
            : 'border-gray-500 shadow-gray-500/20'
        } shadow-lg`} {...props}>
          {/* Render the redesigned alert card content here */}
          {/* The actual alert content is expected to be passed as children or within alertData */}
          {/* Assuming alertData is passed and contains the alert details */}
          {alertData ? (
            <div className="p-6 relative" key={`alert-${alertData.id}-${Date.now()}`}>

              {/* Clean Header - Calendar Page Style with Proper Spacing */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`px-2 py-1 text-xs font-bold rounded-full ${getSportColors(alertData.sport || 'MLB').badge}`}
                  >
                    {alertData.sport}
                  </Badge>
                  {alertData.context?.scoringProbability && (
                    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border ${getSportColors(alertData.sport || 'MLB').probability}`}>
                      <div className={`w-1 h-1 rounded-full animate-pulse ${alertData.sport === 'MLB' ? 'bg-green-400' : 
                        alertData.sport === 'NFL' ? 'bg-orange-400' :
                        alertData.sport === 'NBA' ? 'bg-purple-400' :
                        alertData.sport === 'WNBA' ? 'bg-pink-400' :
                        alertData.sport === 'CFL' ? 'bg-red-400' :
                        alertData.sport === 'NCAAF' ? 'bg-blue-400' :
                        alertData.sport === 'NHL' ? 'bg-cyan-400' : 'bg-emerald-400'}`}></div>
                      <span className="text-xs font-semibold">
                        {alertData.context.scoringProbability.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <span className="text-slate-100 text-xs font-semibold uppercase tracking-wider">
                    {(() => {
                      // Dynamic alert type based on sport and context
                      if (alertData.sport === 'MLB') {
                        if (alertData.context?.scoringProbability) return 'SCORING OPPORTUNITY';
                        if (alertData.type?.includes('INNING')) return 'INNING UPDATE';
                        if (alertData.type?.includes('GAME_START')) return 'GAME STARTING';
                        return 'BASEBALL ALERT';
                      } else if (alertData.sport === 'NFL') {
                        if (alertData.type?.includes('RED_ZONE')) return 'RED ZONE';
                        if (alertData.type?.includes('TWO_MINUTE')) return 'TWO MINUTE WARNING';
                        if (alertData.type?.includes('GAME_START')) return 'GAME STARTING';
                        return 'FOOTBALL ALERT';
                      } else if (alertData.sport === 'NBA') {
                        if (alertData.type?.includes('CLUTCH')) return 'CLUTCH TIME';
                        if (alertData.type?.includes('GAME_START')) return 'GAME STARTING';
                        return 'BASKETBALL ALERT';
                      } else if (alertData.sport === 'WNBA') {
                        if (alertData.type?.includes('TWO_MINUTE')) return 'TWO MINUTE WARNING';
                        if (alertData.type?.includes('GAME_START')) return 'GAME STARTING';
                        return 'BASKETBALL ALERT';
                      } else if (alertData.sport === 'CFL') {
                        if (alertData.type?.includes('TWO_MINUTE')) return 'TWO MINUTE WARNING';
                        if (alertData.type?.includes('GAME_START')) return 'GAME STARTING';
                        return 'FOOTBALL ALERT';
                      }
                      return 'GAME ALERT';
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3 text-slate-200" />
                  <span className="text-slate-200 font-medium">
                    {(() => {
                      const alertTime = new Date(alertData.createdAt || '');
                      const now = new Date();
                      const diffMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));

                      if (diffMinutes < 1) return 'Just now';
                      if (diffMinutes < 60) return `${diffMinutes}m`;
                      return `${Math.floor(diffMinutes / 60)}h`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Enhanced Alert Message Display with Full Context */}
              {(() => {
                // Extract message from all possible locations with better parsing
                const extractAlertMessage = (): { message: string; context: any } => {
                  let message = '';
                  let context = {};

                  // 1. Try direct message field first
                  if (alertData.message && typeof alertData.message === 'string') {
                    message = alertData.message.trim();
                  }

                  // 2. Try payload parsing with better error handling
                  const payload = (alertData as any)?.payload;
                  if (payload) {
                    let parsedPayload = payload;
                    
                    // Parse if string
                    if (typeof payload === 'string') {
                      try {
                        parsedPayload = JSON.parse(payload);
                      } catch {
                        // If not JSON, use as direct message
                        if (!message && payload.trim()) {
                          message = payload.trim();
                        }
                      }
                    }

                    // Extract message and context from parsed payload
                    if (parsedPayload && typeof parsedPayload === 'object') {
                      if (parsedPayload.message && !message) {
                        message = parsedPayload.message;
                      }
                      if (parsedPayload.context) {
                        context = parsedPayload.context;
                      }
                      // Check nested payload
                      if (parsedPayload.payload?.message && !message) {
                        message = parsedPayload.payload.message;
                      }
                      if (parsedPayload.payload?.context) {
                        context = { ...context, ...parsedPayload.payload.context };
                      }
                    }
                  }

                  // 3. Fallback to alertData.context if available
                  if (alertData.context) {
                    context = { ...context, ...alertData.context };
                  }

                  return { message: message || 'Alert triggered', context };
                };

                const { message, context } = extractAlertMessage();

                // Debug what we found
                console.log('🔍 Alert Message Debug:', {
                  alertId: alertData.id,
                  extractedMessage: message.substring(0, 100),
                  hasContext: Object.keys(context).length > 0,
                  contextKeys: Object.keys(context),
                  sport: alertData.sport,
                  type: alertData.type
                });

                return (
                  <div className="mb-3 space-y-2">
                    {/* Main Alert Message */}
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <p className="text-base md:text-lg font-medium leading-snug text-white" data-testid="text-alert-message">
                        {message}
                      </p>
                      
                      {/* Alert Type Badge */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded">
                          {alertData.type?.replace(/_/g, ' ') || 'GAME ALERT'}
                        </span>
                        {alertData.priority && (
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            alertData.priority >= 80 ? 'bg-red-500/20 text-red-300' : 
                            alertData.priority >= 60 ? 'bg-yellow-500/20 text-yellow-300' : 
                            'bg-green-500/20 text-green-300'
                          }`}>
                            Priority: {alertData.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Context Details */}
                    {Object.keys(context).length > 0 && (
                      <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">📊 Alert Details:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {context.reasons && Array.isArray(context.reasons) && (
                            <div className="col-span-2">
                              <span className="text-green-400 font-medium">Reasons:</span>
                              <ul className="mt-1 space-y-1">
                                {context.reasons.map((reason: string, idx: number) => (
                                  <li key={idx} className="text-slate-300">• {reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {context.scoringProbability && (
                            <div>
                              <span className="text-blue-400 font-medium">Scoring Chance:</span>
                              <div className="text-white font-bold">{context.scoringProbability.toFixed(1)}%</div>
                            </div>
                          )}
                          
                          {context.confidence && (
                            <div>
                              <span className="text-purple-400 font-medium">Confidence:</span>
                              <div className="text-white font-bold">{context.confidence}%</div>
                            </div>
                          )}
                          
                          {context.inning && (
                            <div>
                              <span className="text-yellow-400 font-medium">Inning:</span>
                              <div className="text-white">{context.isTopInning ? 'Top' : 'Bottom'} {context.inning}</div>
                            </div>
                          )}
                          
                          {context.outs !== undefined && (
                            <div>
                              <span className="text-orange-400 font-medium">Outs:</span>
                              <div className="text-white">{context.outs}</div>
                            </div>
                          )}
                          
                          {(context.hasFirst || context.hasSecond || context.hasThird) && (
                            <div className="col-span-2">
                              <span className="text-green-400 font-medium">Runners:</span>
                              <div className="text-white">
                                {[
                                  context.hasFirst && '1B',
                                  context.hasSecond && '2B', 
                                  context.hasThird && '3B'
                                ].filter(Boolean).join(', ') || 'None'}
                              </div>
                            </div>
                          )}
                          
                          {context.currentBatter && (
                            <div className="col-span-2">
                              <span className="text-cyan-400 font-medium">At Bat:</span>
                              <div className="text-white">{context.currentBatter}</div>
                            </div>
                          )}
                          
                          {context.recommendation && (
                            <div className="col-span-2 mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
                              <span className="text-green-400 font-medium">💰 Betting Recommendation:</span>
                              <div className="text-green-200 text-sm mt-1">{context.recommendation}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Game Card Template - Calendar Page Style with Live Scores */}
              <div className="mb-4">
                <GameCardTemplate
                  gameId={alertData.id}
                  homeTeam={{
                    name: typeof alertData.homeTeam === 'string' ? alertData.homeTeam : (alertData.homeTeam as any)?.name || 'Home Team',
                    score: displayScores.homeScore
                  }}
                  awayTeam={{
                    name: typeof alertData.awayTeam === 'string' ? alertData.awayTeam : (alertData.awayTeam as any)?.name || 'Away Team',
                    score: displayScores.awayScore
                  }}
                  sport={alertData.sport}
                  status={displayScores.isLive ? "live" : "final"}
                  inning={alertData.context?.inning || liveGameData?.inning}
                  quarter={alertData.context?.quarter || liveGameData?.quarter}
                  period={alertData.context?.period || liveGameData?.period}
                  isTopInning={alertData.context?.isTopInning ?? liveGameData?.isTopInning}
                  runners={{
                    first: alertData.context?.hasFirst || liveGameData?.runners?.first || false,
                    second: alertData.context?.hasSecond || liveGameData?.runners?.second || false,
                    third: alertData.context?.hasThird || liveGameData?.runners?.third || false
                  }}
                  outs={alertData.context?.outs !== undefined ? alertData.context.outs : liveGameData?.outs}
                  balls={liveGameData?.balls}
                  strikes={liveGameData?.strikes}
                  weather={weatherData}
                  size="lg"
                  showWeather={true}
                  showVenue={false}
                  showEnhancedMLB={true}
                  className="shadow-lg"
                />




              </div>

              {/* Predictive Data Display for MLB */}
              {alertData.sport === 'MLB' && (alertData.context?.currentBatter || alertData.context?.onDeckBatter || alertData.context?.windSpeed) && (
                <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Current At-Bat */}
                    {alertData.context?.currentBatter && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400 font-semibold uppercase">At Bat</span>
                        </div>
                        <p className="text-sm text-white font-bold">{alertData.context.currentBatter}</p>
                        {alertData.context?.currentPitcher && (
                          <p className="text-xs text-slate-300">vs {alertData.context.currentPitcher}</p>
                        )}
                      </div>
                    )}

                    {/* On Deck */}
                    {alertData.context?.onDeckBatter && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-yellow-400 font-semibold uppercase">On Deck</span>
                        </div>
                        <p className="text-sm text-white font-bold">{alertData.context.onDeckBatter}</p>
                        {alertData.context?.isPowerHitter && (
                          <span className="text-xs text-orange-400">⚡ Power Hitter</span>
                        )}
                      </div>
                    )}

                    {/* Wind Conditions */}
                    {alertData.context?.windSpeed && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-blue-400 font-semibold uppercase">Wind</span>
                        </div>
                        <p className="text-sm text-white font-bold">
                          {alertData.context.windSpeed}mph {alertData.context.windDirection || ''}
                        </p>
                        {alertData.context?.windImpact && (
                          <p className="text-xs text-blue-300">{alertData.context.windImpact}</p>
                        )}
                      </div>
                    )}

                    {/* Scoring Probability */}
                    {alertData.context?.scoringProbability && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-semibold uppercase">Probability</span>
                        </div>
                        <p className="text-lg text-white font-bold">{alertData.context.scoringProbability.toFixed(1)}%</p>
                        <p className="text-xs text-emerald-300">Scoring Chance</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy Alert Message - Only render when no V3 message available */}
              {(() => {
                // Use the same extraction logic to check for V3 message
                const extractV3Message = (): string | null => {
                  // Check direct message field first
                  if (alertData.message && typeof alertData.message === 'string') {
                    const msg = alertData.message.trim();
                    if (msg.includes('📊') || msg.includes('🔴') || msg.includes('⚡') || 
                        msg.includes('🎯') || msg.includes('💰') || msg.includes('🏈') || 
                        msg.includes('🏀') || msg.includes('⚾') || msg.includes('🥎') ||
                        msg.includes('%') && (msg.includes('scoring') || msg.includes('chance'))) {
                      return msg;
                    }
                  }

                  const payload = (alertData as any)?.payload;
                  if (payload) {
                    let parsedPayload = payload;
                    if (typeof payload === 'string') {
                      try {
                        parsedPayload = JSON.parse(payload);
                      } catch {
                        return payload.trim();
                      }
                    }
                    if (parsedPayload?.message) return parsedPayload.message.trim();
                    if (parsedPayload?.payload?.message) return parsedPayload.payload.message.trim();
                  }

                  return null;
                };

                const v3Message = extractV3Message();

                // Only render legacy message if no V3 message exists
                if (!v3Message) {
                  return (
                    <div className={`rounded-lg p-3 mb-3 border ${getSportColors(alertData.sport || 'MLB').alertBg} ${getSportColors(alertData.sport || 'MLB').alertBorder}`}>
                      {/* Main Alert Message with Compact Typography */}
                      <div className="text-center">
                        {/* Main Situation - Clean and Simple */}
                        <p className="text-white text-sm font-semibold leading-tight">
                          {(() => {
                            // Use AI title if available
                            if (alertData?.context?.aiTitle) {
                              return alertData.context.aiTitle;
                            }

                            let message = alertData.message || '';
                            // Remove emojis and clean up
                            message = message.replace(/[\\{1F300}-\\{1F9FF}]|[\u{2600}-\u{26FF}]|[\\{2700}-\u{27BF}]/gu, '').trim();

                            // Extract the main situation text based on sport
                            if (alertData.sport === 'MLB') {
                              // For baseball, extract situation after colon
                              const parts = message.split(':');
                              if (parts.length > 1) {
                                return parts[1].trim().replace(/\\s*-\\s*\\d+%\\s+chance\\s+to\\s+score!?/i, '');
                              }
                            } else if (alertData.sport === 'NFL' || alertData.sport === 'CFL') {
                              // For football, clean up the message
                              if (message.includes('Red Zone')) {
                                return message.replace(/.*Red Zone[:\\s-]*/i, '').replace(/\\s*-\\s*\\d+%.*$/i, '');
                              } else if (message.includes('Two Minute Warning')) {
                                return 'Two minute warning - critical game situation';
                              } else if (message.includes('Game Starting')) {
                                const awayTeam = typeof alertData.awayTeam === 'string' ? alertData.awayTeam : alertData.awayTeam?.name || 'Away';
                                const homeTeam = typeof alertData.homeTeam === 'string' ? alertData.homeTeam : alertData.homeTeam?.name || 'Home';
                                return `${awayTeam} vs ${homeTeam} - Game Starting`;
                              }
                            } else if (alertData.sport === 'NBA' || alertData.sport === 'WNBA') {
                              // For basketball, clean up the message
                              if (message.includes('Clutch Time')) {
                                return 'Final 5 minutes - close game situation';
                              } else if (message.includes('Two Minute Warning')) {
                                return 'Two minute warning - critical game situation';
                              } else if (message.includes('Game Starting')) {
                                const awayTeam = typeof alertData.awayTeam === 'string' ? alertData.awayTeam : alertData.awayTeam?.name || 'Away';
                                const homeTeam = typeof alertData.homeTeam === 'string' ? alertData.homeTeam : alertData.homeTeam?.name || 'Home';
                                return `${awayTeam} vs ${homeTeam} - Game Starting`;
                              }
                            }

                            // Fallback: remove percentage text and return clean message
                            return message.replace(/\\s*-\\s*\\d+%\\s+chance\\s+to\\s+score!?/i, '').replace(/\\s*-\\s*\\d+%.*$/i, '');
                          })()}
                        </p>
                      </div>

                      {/* Priority Indicator - Compact */}
                      {alertData.priority && alertData.priority >= 80 && (
                        <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-emerald-500/20">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                          <span className="text-red-300 text-xs font-medium uppercase tracking-wide">
                            HIGH VALUE
                          </span>
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                        </div>
                      )}

                      {/* AI Insights - Enhanced */}
                      {alertData.context?.aiInsights && !alertData?.context?.aiBettingAdvice && (
                        <div className="mt-2 p-2 bg-blue-500/15 rounded-lg border border-blue-400/30">
                          <div className="space-y-1">
                            {alertData.context.aiInsights.map((insight: string, idx: number) => (
                              <p key={idx} className="text-xs text-blue-200 leading-relaxed text-center">
                                {insight}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })()}

              {/* AI Call to Action */}
              {alertData?.context?.aiCallToAction && (
                <div className="mb-1 p-1.5 bg-green-500/10 rounded border border-green-500/30">
                  <p className="text-xs font-medium text-green-300">
                    {alertData.context.aiCallToAction}
                  </p>
                </div>
              )}

            </div>
          ) : (
            children // Fallback to rendering children if alertData is not available
          )}
        </Card>
      </motion.div>
    </div>
  );
}