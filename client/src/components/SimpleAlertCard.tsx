import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Bell, Clock, AlertTriangle, TrendingUp, Users, Brain, Target } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GameCardTemplate } from '@/components/GameCardTemplate';
import { BaseballDiamond } from './baseball-diamond';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

// Utility functions
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


interface SimpleAlert {
  id: string;
  type: string;
  message: string;
  sport: string;
  homeTeam?: string | { id?: string; name?: string; score?: number; abbreviation?: string };
  awayTeam?: string | { id?: string; name?: string; score?: number; abbreviation?: string };
  priority: number;
  confidence?: number;
  createdAt: string;
  context?: {
    homeScore?: number;
    awayScore?: number;
    quarter?: number;
    timeRemaining?: string;
    inning?: number;
    isTopInning?: boolean;
    period?: number;
    aiInsights?: string;
    recommendation?: string;
    outs?: number;
    balls?: number;
    strikes?: number;
    hasFirst?: boolean;
    hasSecond?: boolean;
    hasThird?: boolean;
    currentBatter?: string;
    currentPitcher?: string;
    scoringProbability?: number;
    weatherContext?: string;
    batterAdvantage?: string;
    handednessMatchup?: string;
    leverageIndex?: number;
    scenarioName?: string;
  };
  payload?: {
    betbookData?: {
      aiAdvice?: string;
    };
    gameInfo?: {
      v3Analysis?: {
        confidence?: number;
        reasons?: string[];
      };
    };
  };
}

interface SimpleAlertCardProps {
  alert: SimpleAlert;
  className?: string;
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
  }
];

export function SimpleAlertCard({ alert, className }: SimpleAlertCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoReturnTimeoutRef = React.useRef<NodeJS.Timeout>();



  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'TWO_MINUTE_WARNING':
      case 'NCAAF_KICKOFF':
      case 'NCAAF_HALFTIME':
        return <Clock className="h-4 w-4" />;
      case 'CLOSE_GAME':
        return <AlertTriangle className="h-4 w-4" />;
      case 'HIGH_SCORING':
        return <TrendingUp className="h-4 w-4" />;
      case 'SHUTOUT':
      case 'BLOWOUT':
        return <Users className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleSportsbookClick = (sportsbook: Sportsbook) => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      const startTime = Date.now();
      const link = document.createElement('a');
      link.href = sportsbook.appUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        if (Date.now() - startTime < 1500) {
          window.open(sportsbook.storeUrl, '_blank');
        }
      }, 1000);
    } else {
      const webUrls = {
        'Bet365': 'https://www.bet365.com',
        'DraftKings': 'https://sportsbook.draftkings.com',
        'Fanatics': 'https://sportsbook.fanaticsbetting.com',
        'FanDuel': 'https://sportsbook.fanduel.com'
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
      await apiRequest("DELETE", `/api/alerts/${alert.id}`);

      // Immediately update the query cache to remove the deleted alert
      queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((a: any) => a.id !== alert.id);
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
    if (autoReturnTimeoutRef.current) {
      clearTimeout(autoReturnTimeoutRef.current);
    }
    autoReturnTimeoutRef.current = setTimeout(() => {
      setDragX(0);
    }, 3000);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 100;
    const velocity = info.velocity.x;

    if (Math.abs(info.offset.x) < threshold && Math.abs(velocity) < 500) {
      setDragX(0);
    } else if (info.offset.x > threshold || velocity > 500) {
      setDragX(120);
      startAutoReturnTimer();
    } else if (info.offset.x < -threshold || velocity < -500) {
      setDragX(-240);
      startAutoReturnTimer();
    } else {
      setDragX(0);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
    if (autoReturnTimeoutRef.current) {
      clearTimeout(autoReturnTimeoutRef.current);
    }
  };

  React.useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) {
        clearTimeout(autoReturnTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl mx-2 sm:mx-0">
      {/* Sportsbooks Panel (Left Swipe) */}
      <div className={`absolute inset-y-0 right-0 w-60 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent transition-opacity duration-300 ${
        dragX < -50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="h-full flex flex-col items-center justify-center p-4 space-y-3">
          <h4 className="text-sm text-white/90 font-semibold tracking-wide">Quick Bet</h4>
          <div className="grid grid-cols-2 gap-3">
            {sportsbooks.map((sportsbook) => (
              <div key={sportsbook.name} className="flex flex-col items-center space-y-1">
                <Button
                  onClick={() => {
                    handleSportsbookClick(sportsbook);
                    setDragX(0);
                  }}
                  className="h-11 w-11 sm:h-10 sm:w-10 p-1 rounded-lg bg-white/90 shadow-lg ring-2 ring-white/20 touch-manipulation"
                  style={{ backgroundColor: `${sportsbook.color}15`, borderColor: `${sportsbook.color}30` }}
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
      </div>

      {/* Delete Panel (Right Swipe) */}
      <div className={`absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent flex items-center justify-start pl-4 transition-opacity duration-300 ${
        dragX > 50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <Button
          onClick={() => {
            handleDeleteAlert();
            setDragX(0);
          }}
          disabled={isDeleting}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 ring-1 ring-red-500/30"
        >
          <Trash2 className="w-5 h-5 text-red-400" />
        </Button>
      </div>

      {/* Main Simple Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -280, right: 140 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={{ x: dragX }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 300,
          mass: 0.8
        }}
        className="relative z-10 touch-manipulation"
        whileDrag={{ scale: 1.01, cursor: "grabbing" }}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div className={`${className} transition-all duration-200 relative border-2 ${
          getAlertStatus(alert.type, alert.createdAt, 
            (alert.context?.homeScore !== undefined && alert.context?.awayScore !== undefined ? 'live' : 'scheduled')
          ).status === 'ACTIVE' 
            ? 'border-emerald-500 shadow-emerald-500/20' 
            : 'border-gray-500/50 shadow-gray-500/10'
        } shadow-lg rounded-xl`}>

          <GameCardTemplate
            gameId={alert.id}
            homeTeam={{
              name: typeof alert.homeTeam === 'object' ? alert.homeTeam?.name || 'Home' : alert.homeTeam || 'Home',
              score: alert.context?.homeScore
            }}
            awayTeam={{
              name: typeof alert.awayTeam === 'object' ? alert.awayTeam?.name || 'Away' : alert.awayTeam || 'Away', 
              score: alert.context?.awayScore
            }}
            sport={alert.sport}
            status={(alert.context?.homeScore !== undefined && alert.context?.awayScore !== undefined) ? 'live' : 'scheduled'}
            inning={alert.context?.inning}
            quarter={alert.context?.quarter}
            period={alert.context?.period}
            isTopInning={alert.context?.isTopInning}
            size="md"
            showWeather={false}
            showVenue={false}
            showEnhancedMLB={false}
            className="bg-white/5 border-white/10"
          >
          </GameCardTemplate>

          {/* Alert Message and Footer - Below the standardized GameCardTemplate */}
          <div className="p-4 pt-0">

            {/* Enhanced Alert Content */}
            <div className="space-y-3">
              {/* Header: Batter vs Pitcher */}
              {alert.context?.currentBatter && alert.context?.currentPitcher ? (
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    <span className="text-blue-400">{alert.context.currentBatter}</span>
                    <span className="mx-2 text-slate-400">vs</span>
                    <span className="text-red-400">{alert.context.currentPitcher}</span>
                  </div>
                  {alert.context?.handednessMatchup && (
                    <div className="text-sm text-slate-400 mt-1">
                      {alert.context.handednessMatchup}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Probability Badge */}
              {alert.context?.scoringProbability && (
                <div className="flex justify-center mb-3">
                  <div className={`px-4 py-2 rounded-full text-sm font-bold border ${getSportColors(alert.sport).probability}`}>
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    {alert.context.scoringProbability}% Scoring Chance
                  </div>
                </div>
              )}

              {/* Alert Message with Context */}
              <div className="bg-slate-900/30 rounded-lg p-3 mb-3">
                {alert.context?.scenarioName ? (
                  <div className="text-center mb-2">
                    <p className="text-yellow-400 text-sm font-semibold">{alert.context.scenarioName}</p>
                  </div>
                ) : null}
                
                <p className="text-slate-100 text-base font-medium leading-relaxed text-center">
                  {alert.message.replace(/🔥|💎|⚾|💪|⚡|🏠|🎆|⏰|🏈|🏀|🏒/g, '').replace(/\[object Object\]/g, '').trim()}
                </p>

                {/* Baseball Situation Details */}
                {alert.sport === 'MLB' && (
                  <div className="flex justify-center items-center space-x-4 mt-3 text-sm text-slate-300">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{alert.context?.balls || 0}-{alert.context?.strikes || 0}</span>
                      <span className="text-slate-400">Count</span>
                    </div>
                    <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{alert.context?.outs || 0}</span>
                      <span className="text-slate-400">Out{(alert.context?.outs || 0) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weather Context */}
              {alert.context?.weatherContext && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2">
                  <div className="flex items-center justify-center space-x-2 text-blue-300 text-sm">
                    <span>🌬️</span>
                    <span>{alert.context.weatherContext}</span>
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {(alert.context?.aiInsights || alert.context?.batterAdvantage) && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-2">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="text-purple-200 text-sm leading-relaxed">
                      {alert.context.aiInsights || alert.context.batterAdvantage}
                    </div>
                  </div>
                </div>
              )}

              {/* Leverage Indicator */}
              {alert.context?.leverageIndex && alert.context.leverageIndex > 1.5 && (
                <div className="text-center">
                  <div className="inline-flex items-center space-x-1 text-orange-400 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    <span>High Leverage Situation ({alert.context.leverageIndex.toFixed(1)})</span>
                  </div>
                </div>
              )}
            </div>




          </div>
        </div>
      </motion.div>
    </div>
  );
}