import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Download, TrendingUp, Target, Zap, Brain, Calculator, Activity } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AlertFooter from '@/components/AlertFooter';
import { Badge } from '@/components/ui/badge';
import { TeamLogo } from '@/components/team-logo';
import { GameCardTemplate } from '@/components/GameCardTemplate';
import { Alert } from '@/types';

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

  // Find the matching game for this alert to get live scores
  const liveGameData = React.useMemo(() => {
    if (!todaysGames?.games || !alertData) return null;

    return todaysGames.games.find((game: any) => {
      // Match by team names (both home and away combinations)
      const gameHomeTeam = game.homeTeam?.name || '';
      const gameAwayTeam = game.awayTeam?.name || '';
      const alertHomeTeam = alertData.homeTeam || '';
      const alertAwayTeam = alertData.awayTeam || '';

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
        alertId: alertData.id,
        storedHomeScore: alertData.homeScore,
        storedAwayScore: alertData.awayScore,
        liveHomeScore: liveGameData?.homeTeam?.score,
        liveAwayScore: liveGameData?.awayTeam?.score,
        displayHomeScore: displayScores.homeScore,
        displayAwayScore: displayScores.awayScore,
        hasLiveGame: !!liveGameData,
        gameStatus: liveGameData?.status,
        homeTeam: alertData.homeTeam,
        awayTeam: alertData.awayTeam
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
    let message = `ChirpBot Alert: ${alertData?.homeTeam || ''} vs ${alertData?.awayTeam || ''}`;
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


  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* AI Betting Insights Panel (Left Swipe) - Only show when swiped left */}
      <div className={`absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
        dragX < -50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {alertData?.betbookData || alertData?.context?.reasons ? (
          <div className="h-full flex flex-col justify-center p-4 space-y-3">
            {/* AI Insights Header */}
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">AI Betting Insights</h3>
                <p className="text-blue-200 text-xs">ChirpBot v3 Analysis</p>
              </div>
            </div>

            {/* Betting Recommendations Based on Game Situation */}
            {(alertData.betbookData || alertData.context?.reasons || (alertData.priority && alertData.priority >= 80)) && (
              <div className="space-y-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-200 font-semibold">Recommended Bet</span>
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
                {(alertData.context?.reasons || alertData.context?.aiInsights) && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 ring-1 ring-white/10">
                    <div className="flex items-center space-x-2 mb-1">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-200 font-medium">AI Analysis</span>
                      <span className="text-xs text-green-300 font-mono">
                        {alertData.context.confidence || alertData.confidence}% confidence
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
              <h4 className="text-xs text-blue-200 font-medium tracking-wide uppercase">Quick Bet</h4>
              <div className="flex space-x-2">
                {sportsbooks.slice(0, 4).map((sportsbook) => (
                  <div key={sportsbook.name} className="flex flex-col items-center space-y-1">
                    <Button
                      onClick={() => {
                        handleSportsbookClick(sportsbook);
                        setDragX(0);
                      }}
                      className="h-10 w-10 p-1 rounded-lg bg-white/90 hover:bg-white hover:scale-105 shadow-lg ring-2 ring-white/20 transition-all duration-200"
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
                className="flex-1 px-3 py-2 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(displayMessage);
                  toast({ title: "Copied to clipboard", description: displayMessage.substring(0, 50) + "..." });
                }}
              >
                📋 Copy
              </button>
              <button 
                className="flex-1 px-3 py-2 text-xs font-medium bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
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
                    className="h-12 w-12 p-1.5 rounded-xl bg-white/90 hover:bg-white hover:scale-105 shadow-xl ring-2 ring-white/30 transition-all duration-200"
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
      <div className={`absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent backdrop-blur-sm flex items-center justify-start pl-4 transition-opacity duration-300 ${
        dragX > 30 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteAlert();
            setDragX(0); // Return to center after click
          }}
          disabled={isDeleting}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm ring-1 ring-red-500/30 transition-all hover:scale-110 active:scale-95"
          data-testid={`delete-alert-${alertId}`}
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
        whileDrag={{ scale: 1.01, cursor: "grabbing" }}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <Card className={className} {...props}>
          {/* Render the redesigned alert card content here */}
          {/* The actual alert content is expected to be passed as children or within alertData */}
          {/* Assuming alertData is passed and contains the alert details */}
          {alertData ? (
            <div className="p-6" key={`alert-${alertData.id}-${Date.now()}`}>
              {/* Clean Header - Calendar Page Style */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${getAlertColor(alertData.priority ?? 0)} animate-pulse`}></div>
                  <Badge 
                    variant="outline" 
                    className="px-3 py-1.5 text-sm font-bold border-emerald-500/40 text-emerald-400 bg-emerald-500/10 rounded-full"
                  >
                    {alertData.sport}
                  </Badge>
                  <span className="text-slate-300 text-sm font-semibold uppercase tracking-wider">
                    {alertData.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-emerald-400 font-bold">{alertData.confidence}%</span>
                  <span className="text-slate-400 font-medium">{formatTime(alertData.createdAt || '')}</span>
                </div>
              </div>

              {/* Game Card Template - Calendar Page Style with Live Scores */}
              <div className="mb-6">
                <GameCardTemplate
                  homeTeam={alertData.homeTeam || 'TBD'}
                  awayTeam={alertData.awayTeam || 'TBD'}
                  homeScore={displayScores.homeScore}
                  awayScore={displayScores.awayScore}
                  sport={alertData.sport}
                  status={displayScores.isLive ? "live" : "final"}
                  inning={alertData.context?.inning || liveGameData?.inning}
                  quarter={alertData.context?.quarter || liveGameData?.quarter}
                  period={alertData.context?.period || liveGameData?.period}
                  isTopInning={alertData.context?.isTopInning ?? liveGameData?.isTopInning}
                  size="lg"
                  className="shadow-lg"
                />
              </div>

              {/* Alert Message - Clean Layout */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-1">
                    {/* Message Display */}
                    <p className="text-slate-100 text-base leading-relaxed font-medium">
                      {(alertData.message || '').replace(/🔥|💎|⚾|💪|⚡|🏠|🎆|⏰|🏈/g, '').trim()}
                    </p>

                    {/* Context Information */}
                    {alertData.context?.reasons && alertData.context.reasons.length > 0 && (
                      <div className="mt-3 text-sm text-slate-300">
                        <strong>Game Situation:</strong> {alertData.context.reasons.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Game Situation Grid - Calendar Page Clean Style */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                <div className="grid grid-cols-5 gap-6 items-center">
                  {/* MLB Specific Data */}
                  {alertData.sport === 'MLB' && (
                    <>
                      {/* Inning with Top/Bottom */}
                      {alertData.context?.inning && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">INNING</div>
                          <div className="text-lg font-bold text-white bg-slate-800/50 px-3 py-2 rounded-lg shadow-sm">
                            {alertData.context?.isTopInning ? '▲' : '▼'} {alertData.context.inning}
                          </div>
                        </div>
                      )}

                      {/* Outs */}
                      {alertData.context?.outs !== undefined && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">OUTS</div>
                          <div className="text-2xl font-bold text-white">{alertData.context.outs}</div>
                        </div>
                      )}

                      {/* Ball-Strike Count */}
                      {(alertData.context?.balls !== undefined || alertData.context?.strikes !== undefined) && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">COUNT</div>
                          <div className="text-xl font-bold text-white">
                            {alertData.context?.balls ?? 0}-{alertData.context?.strikes ?? 0}
                          </div>
                        </div>
                      )}

                      {/* Baseball Diamond - Enhanced */}
                      {(alertData.context?.hasFirst || alertData.context?.hasSecond || alertData.context?.hasThird) ? (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">BASES</div>
                          <div className="relative w-10 h-10 mx-auto">
                            <div className="absolute inset-0 rotate-45 border-2 border-slate-600 bg-slate-800/30 rounded-lg shadow-sm"></div>
                            <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 ${alertData.context?.hasSecond ? 'bg-emerald-400 border-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-slate-700 border-slate-600'}`}></div>
                            <div className={`absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 ${alertData.context?.hasFirst ? 'bg-emerald-400 border-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-slate-700 border-slate-600'}`}></div>
                            <div className={`absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 ${alertData.context?.hasThird ? 'bg-emerald-400 border-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-slate-700 border-slate-600'}`}></div>
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-slate-600 border-2 border-slate-500"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">BASES</div>
                          <div className="text-sm text-slate-500 font-medium">Empty</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Football Specific Data */}
                  {(alertData.sport === 'NFL' || alertData.sport === 'NCAAF' || alertData.sport === 'CFL') && (
                    <>
                      {alertData.context?.quarter && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">QUARTER</div>
                          <div className="text-lg font-bold text-white bg-slate-800/50 px-3 py-2 rounded-lg shadow-sm">
                            Q{alertData.context.quarter}
                          </div>
                        </div>
                      )}

                      {alertData.context?.down && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">DOWN</div>
                          <div className="text-xl font-bold text-white">
                            {alertData.context.down}&{alertData.context.yardsToGo || 10}
                          </div>
                        </div>
                      )}

                      {alertData.context?.timeRemaining && (
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">TIME</div>
                          <div className="text-lg font-bold text-white">{alertData.context.timeRemaining}</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Basketball Specific Data */}
                  {alertData.sport === 'NBA' && alertData.context?.quarter && (
                    <div className="text-center">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">QUARTER</div>
                      <div className="text-lg font-bold text-white bg-slate-800/50 px-3 py-2 rounded-lg shadow-sm">
                        Q{alertData.context.quarter}
                      </div>
                    </div>
                  )}

                  {/* Hockey Specific Data */}
                  {alertData.sport === 'NHL' && alertData.context?.period && (
                    <div className="text-center">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">PERIOD</div>
                      <div className="text-lg font-bold text-white bg-slate-800/50 px-3 py-2 rounded-lg shadow-sm">
                        P{alertData.context.period}
                      </div>
                    </div>
                  )}

                  {/* Universal Time (if not sport-specific) */}
                  {!alertData.context?.quarter && !alertData.context?.period && !alertData.context?.inning && alertData.context?.timeRemaining && (
                    <div className="text-center">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">TIME</div>
                      <div className="text-lg font-bold text-white">{alertData.context.timeRemaining}</div>
                    </div>
                  )}

                  {/* Priority - Always show in last column */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">PRIORITY</div>
                    <div className={`text-2xl font-bold ${(alertData.priority ?? 0) >= 90 ? 'text-red-400' : (alertData.priority ?? 0) >= 80 ? 'text-orange-400' : (alertData.priority ?? 0) >= 70 ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {alertData.priority ?? 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            children // Fallback to rendering children if alertData is not available
          )}
        </Card>
      </motion.div>
    </div>
  );
}