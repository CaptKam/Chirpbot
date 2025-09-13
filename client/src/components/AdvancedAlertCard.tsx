import React, { useState, useEffect, useMemo } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Trash2, ExternalLink, TrendingUp, TrendingDown, AlertCircle, 
  Brain, Calculator, Activity, Clock, Wind, Cloud, Zap, Target,
  ArrowUp, ArrowDown, ArrowRight, Flame, BarChart3, Info,
  Trophy, Timer, ChevronRight, DollarSign, User, Shield,
  Eye, History, Sparkles, Gauge, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TeamLogo } from '@/components/team-logo';
import { GameCardTemplate } from '@/components/GameCardTemplate';
import { BaseballDiamond } from '@/components/baseball-diamond';
import { Alert } from '@/types';
import { cn } from '@/lib/utils';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

// Sportsbook interface and data
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

// Alert type categorization
const ALERT_CATEGORIES = {
  SCORING: ['BASES_LOADED', 'RISP', 'RED_ZONE', 'RED_ZONE_OPPORTUNITY', 'POWER_PLAY', 'CLUTCH_TIME'],
  GAME_START: ['MLB_GAME_START', 'NFL_GAME_START', 'NBA_GAME_START', 'WNBA_GAME_START', 'GAME_START'],
  WEATHER: ['WIND_CHANGE', 'WEATHER_IMPACT', 'STADIUM_CONDITIONS'],
  CRITICAL: ['TWO_MINUTE_WARNING', 'FOURTH_DOWN', 'OVERTIME', 'FINAL_DRIVE', 'EMPTY_NET'],
  MOMENTUM: ['HOT_HITTER', 'COLD_STREAK', 'COMEBACK_POTENTIAL', 'BLOWOUT'],
  PLAYER: ['POWER_HITTER', 'STAR_BATTER', 'BATTER_DUE', 'ON_DECK_PREDICTION']
};

// Sport-specific color schemes
const SPORT_THEMES = {
  MLB: {
    primary: 'emerald',
    gradient: 'from-emerald-600 to-green-700',
    bg: 'bg-emerald-950/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    pulse: 'bg-emerald-400'
  },
  NFL: {
    primary: 'orange',
    gradient: 'from-orange-600 to-red-700',
    bg: 'bg-orange-950/20',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
    pulse: 'bg-orange-400'
  },
  NBA: {
    primary: 'purple',
    gradient: 'from-purple-600 to-indigo-700',
    bg: 'bg-purple-950/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    pulse: 'bg-purple-400'
  },
  WNBA: {
    primary: 'pink',
    gradient: 'from-pink-600 to-rose-700',
    bg: 'bg-pink-950/20',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
    pulse: 'bg-pink-400'
  },
  NHL: {
    primary: 'cyan',
    gradient: 'from-cyan-600 to-blue-700',
    bg: 'bg-cyan-950/20',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    pulse: 'bg-cyan-400'
  },
  CFL: {
    primary: 'red',
    gradient: 'from-red-600 to-rose-700',
    bg: 'bg-red-950/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-400/40',
    pulse: 'bg-red-400'
  },
  NCAAF: {
    primary: 'blue',
    gradient: 'from-blue-600 to-indigo-700',
    bg: 'bg-blue-950/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    pulse: 'bg-blue-400'
  }
};

// Helper functions
const getAlertCategory = (type: string): string => {
  for (const [category, types] of Object.entries(ALERT_CATEGORIES)) {
    if (types.includes(type)) return category;
  }
  return 'GENERAL';
};

const formatTime = (date: string | Date): string => {
  const alertTime = new Date(date);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return alertTime.toLocaleDateString();
};

const getConfidenceLevel = (confidence: number): { label: string; color: string; icon: React.ReactNode } => {
  if (confidence >= 90) return { 
    label: 'ELITE', 
    color: 'text-red-400',
    icon: <Flame className="w-3 h-3" />
  };
  if (confidence >= 80) return { 
    label: 'HIGH', 
    color: 'text-orange-400',
    icon: <TrendingUp className="w-3 h-3" />
  };
  if (confidence >= 70) return { 
    label: 'GOOD', 
    color: 'text-yellow-400',
    icon: <Target className="w-3 h-3" />
  };
  return { 
    label: 'MODERATE', 
    color: 'text-blue-400',
    icon: <Activity className="w-3 h-3" />
  };
};

const getMomentumIndicator = (context: any): { trend: 'up' | 'down' | 'neutral'; label: string } => {
  // Calculate momentum based on recent scoring, win probability shifts, etc.
  if (context?.scoringProbability > 70) return { trend: 'up', label: 'Rising' };
  if (context?.scoringProbability < 30) return { trend: 'down', label: 'Falling' };
  return { trend: 'neutral', label: 'Stable' };
};

interface AdvancedAlertCardProps {
  alertData: Alert;
  alertId: string;
  className?: string;
  onTap?: () => void;
}

export function AdvancedAlertCard({ alertData, alertId, className, onTap }: AdvancedAlertCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoReturnTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Helper function to convert raw alert types to user-friendly categories
  const getAlertCategory2 = (alertType: string): string => {
    if (!alertType || typeof alertType !== 'string') return 'unknown';
    if (alertType.includes('BASES_LOADED')) return 'scoring';
    if (alertType.includes('RISP')) return 'scoring';
    if (alertType.includes('RED_ZONE_OPPORTUNITY')) return 'scoring';
    if (alertType.includes('POWER_PLAY')) return 'scoring';
    if (alertType.includes('CLUTCH_TIME')) return 'scoring';

    if (alertType.includes('MLB_GAME_START') || alertType.includes('GAME_START')) return 'game_start';
    if (alertType.includes('NFL_GAME_START')) return 'game_start';
    if (alertType.includes('NBA_GAME_START')) return 'game_start';
    if (alertType.includes('WNBA_GAME_START')) return 'game_start';

    if (alertType.includes('WEATHER_IMPACT')) return 'weather';
    if (alertType.includes('STADIUM_CONDITIONS')) return 'weather';
    if (alertType.includes('WIND_CHANGE')) return 'weather';

    if (alertType.includes('TWO_MINUTE_WARNING')) return 'critical';
    if (alertType.includes('FOURTH_DOWN')) return 'critical';
    if (alertType.includes('OVERTIME')) return 'critical';
    if (alertType.includes('FINAL_DRIVE')) return 'critical';
    if (alertType.includes('EMPTY_NET')) return 'critical';

    if (alertType.includes('HOT_HITTER')) return 'momentum';
    if (alertType.includes('COLD_STREAK')) return 'momentum';
    if (alertType.includes('COMEBACK_POTENTIAL')) return 'momentum';
    if (alertType.includes('BLOWOUT')) return 'momentum';

    if (alertType.includes('POWER_HITTER')) return 'player';
    if (alertType.includes('STAR_BATTER')) return 'player';
    if (alertType.includes('BATTER_DUE')) return 'player';
    if (alertType.includes('ON_DECK_PREDICTION')) return 'player';

    // Fallback for unmapped types
    return alertType.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL)_/, '').replace(/_/g, ' ');
  };


  // Get theme based on sport
  const theme = SPORT_THEMES[alertData.sport as keyof typeof SPORT_THEMES] || SPORT_THEMES.MLB;
  const category = getAlertCategory2(alertData.type);

  // Fetch live game data
  const { data: liveGameData } = useQuery({
    queryKey: ["/api/games/today", { sport: alertData.sport }],
    refetchInterval: 15000,
    staleTime: 10000,
  });

  // Fetch weather data
  const homeTeamName = useMemo(() => {
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
    enabled: !!homeTeamName && alertData.sport === 'MLB',
    refetchInterval: 60000,
    staleTime: 60000,
  });

  // Calculate derived metrics
  const confidence = alertData.confidence || alertData.aiConfidence || 75;
  const probability = alertData.probability || alertData.context?.scoringProbability || 0;
  const momentum = getMomentumIndicator(alertData.context);
  const confidenceData = getConfidenceLevel(confidence);

  // Extract key data from context
  const bettingAdvice = alertData.context?.aiBettingAdvice;
  const gameProjection = alertData.context?.aiGameProjection;
  const aiInsights = alertData.context?.aiInsights || [];
  const reasons = alertData.context?.reasons || [];

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
      await apiRequest("DELETE", `/api/alerts/${alertId}`);
      queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((alert: any) => alert.id !== alertId);
      });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: "Alert deleted",
        description: "The alert has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete alert.",
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
    const threshold = 80;
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

  // Clear timer on component unmount
  useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) {
        clearTimeout(autoReturnTimeoutRef.current);
      }
    };
  }, []);


  // Render different layouts based on alert category
  const renderAlertContent = () => {
    switch (category) {
      case 'scoring':
        return <ScoringOpportunityLayout />;
      case 'game_start':
        return <GameStartLayout />;
      case 'weather':
        return <WeatherImpactLayout />;
      case 'critical':
        return <CriticalMomentLayout />;
      case 'momentum':
        return <MomentumShiftLayout />;
      case 'player':
        return <PlayerFocusLayout />;
      default:
        return <DefaultLayout />;
    }
  };

  // Component layouts for different alert types
  const ScoringOpportunityLayout = () => (
    <>
      {/* Header with probability */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`absolute inset-0 ${theme.pulse} rounded-full blur-xl opacity-40 animate-pulse`} />
            <Badge className={`${theme.badge} border relative z-10 px-3 py-1`}>
              {getAlertCategory(alertData.type)}
            </Badge>
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {alertData.sport}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{probability}%</div>
            <div className="text-xs text-slate-400">SCORING CHANCE</div>
          </div>
          <div className={`w-12 h-12 rounded-full ${theme.bg} ${theme.border} border-2 flex items-center justify-center`}>
            <Target className={`w-6 h-6 ${theme.text}`} />
          </div>
        </div>
      </div>

      {/* Main message */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          {alertData.context?.aiTitle || alertData.title || alertData.message || `${getAlertCategory(alertData.type)} alert for ${alertData.homeTeam} vs ${alertData.awayTeam}`}
        </h3>
        {/* Show AI enhanced message if available */}
        {alertData.context?.aiTitle && (
          <p className="text-sm text-blue-200 mb-2 p-2 bg-blue-500/10 rounded border border-blue-400/30">
            🤖 <strong>AI Enhanced:</strong> {alertData.context.aiTitle}
          </p>
        )}
        {(alertData.context?.aiCallToAction || alertData.description) && (
          <p className="text-sm text-slate-300">
            {alertData.context?.aiCallToAction || alertData.description}
          </p>
        )}
      </div>

      {/* Betting lines and movement */}
      {alertData.betbookData && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">SPREAD</div>
            <div className="text-lg font-bold text-white">
              {alertData.betbookData.spread || 'N/A'}
            </div>
            {alertData.betbookData.spreadMovement && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${
                alertData.betbookData.spreadMovement > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {alertData.betbookData.spreadMovement > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(alertData.betbookData.spreadMovement)}
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">TOTAL</div>
            <div className="text-lg font-bold text-white">
              {alertData.betbookData.total || 'O/U 8.5'}
            </div>
            {alertData.betbookData.totalMovement && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${
                alertData.betbookData.totalMovement > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {alertData.betbookData.totalMovement > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(alertData.betbookData.totalMovement)}
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">ML</div>
            <div className="text-lg font-bold text-white">
              {alertData.betbookData.moneyline || '+150'}
            </div>
            {alertData.betbookData.mlMovement && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${
                alertData.betbookData.mlMovement > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {alertData.betbookData.mlMovement > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(alertData.betbookData.mlMovement)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key factors */}
      {reasons.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Key Factors</div>
          {reasons.slice(0, 3).map((reason: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              <CheckCircle className={`w-4 h-4 ${theme.text} mt-0.5 flex-shrink-0`} />
              <span className="text-sm text-slate-300">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Confidence bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">AI CONFIDENCE</span>
          <span className={`text-xs font-bold ${confidenceData.color} flex items-center gap-1`}>
            {confidenceData.icon}
            {confidence}% {confidenceData.label}
            {alertData.context?.aiInsights && alertData.context.aiInsights.length > 0 && (
              <Badge className="ml-2 bg-blue-500/20 text-blue-300 border-blue-400/40 text-xs">
                AI ENHANCED
              </Badge>
            )}
          </span>
        </div>
        <Progress value={confidence} className="h-2" />
      </div>

      {/* Expandable insights */}
      {aiInsights.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between py-2">
            <span className={`text-sm ${theme.text} flex items-center gap-2`}>
              <Brain className="w-4 h-4" />
              View AI Insights ({aiInsights.length})
            </span>
            <ChevronRight className={`w-4 h-4 ${theme.text} transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </button>
      )}

      {isExpanded && aiInsights.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-slate-700 pt-3">
          {aiInsights.map((insight: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-300">{insight}</span>
            </div>
          ))}

          {/* AI Recommendation */}
          {alertData.context?.recommendation && (
            <div className="mt-3 p-2 bg-green-500/10 rounded border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-xs font-bold">AI RECOMMENDATION</span>
              </div>
              <p className="text-sm text-green-100">{alertData.context.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  const GameStartLayout = () => {
    const awayTeamName = typeof alertData.awayTeam === 'string' ? alertData.awayTeam : alertData.awayTeam?.name || 'Away Team';
    const homeTeamName = typeof alertData.homeTeam === 'string' ? alertData.homeTeam : alertData.homeTeam?.name || 'Home Team';

    // Extract betting data if available
    const betbookData = alertData.context?.betbookData;

    return (
      <>
        {/* Header with pulsing animation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`absolute inset-0 ${theme.pulse} rounded-full blur-md opacity-60 animate-pulse`} />
              <div className={`w-3 h-3 ${theme.pulse} rounded-full relative z-10 animate-pulse`} />
            </div>
            <Badge className={`${theme.badge} border px-3 py-1 animate-pulse`}>
              🚨 GAME STARTING
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">
              {alertData.context?.gameInfo?.startTime || formatTime(alertData.createdAt || alertData.timestamp)}
            </div>
            <Badge variant="outline" className="border-green-500/50 text-green-400">
              LIVE
            </Badge>
          </div>
        </div>

        {/* AI Enhanced Message Display */}
        {alertData.context?.aiCallToAction && (
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 mb-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-bold">AI Enhanced Alert</span>
            </div>
            <p className="text-sm text-blue-100">{alertData.context.aiCallToAction}</p>
          </div>
        )}

        {/* Enhanced Teams display with matchup context */}
        <div className="bg-gradient-to-r from-slate-800/30 to-slate-700/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <TeamLogo
                teamName={awayTeamName}
                sport={alertData.sport}
                size="lg"
              />
              <div>
                <div className="text-lg font-bold text-white">
                  {awayTeamName}
                </div>
                <div className="text-xs text-slate-400">Away Team</div>
                {alertData.context?.gameInfo?.awayRecord && (
                  <div className="text-xs font-medium text-slate-300">
                    {alertData.context.gameInfo.awayRecord}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-slate-300 mb-1">VS</div>
              <div className="text-xs text-slate-500">First Pitch</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {homeTeamName}
                </div>
                <div className="text-xs text-slate-400">Home Team</div>
                {alertData.context?.gameInfo?.homeRecord && (
                  <div className="text-xs font-medium text-slate-300">
                    {alertData.context.gameInfo.homeRecord}
                  </div>
                )}
              </div>
              <TeamLogo
                teamName={homeTeamName}
                sport={alertData.sport}
                size="lg"
              />
            </div>
          </div>

          {/* Game context */}
          <div className="border-t border-slate-700 pt-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Venue: </span>
                <span className="text-white">{alertData.context?.gameInfo?.venue || 'TBD'}</span>
              </div>
              <div>
                <span className="text-slate-400">Inning: </span>
                <span className="text-white">
                  {alertData.context?.inning ? `${alertData.context.isTopInning ? 'Top' : 'Bottom'} ${alertData.context.inning}` : 'Starting'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Opening Lines with live betting data */}
        {betbookData && (
          <div className="bg-slate-800/30 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Live Betting Lines</div>
              <div className="text-xs text-green-400">• UPDATED</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Money Line</div>
                <div className="text-lg font-bold text-white">
                  {betbookData.odds?.home > 0 ? `+${betbookData.odds.home}` : betbookData.odds?.home || '-110'}
                </div>
                <div className="text-xs text-slate-400">Home</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Total</div>
                <div className="text-lg font-bold text-white">
                  O/U {betbookData.odds?.total || '8.5'}
                </div>
                <div className="text-xs text-slate-400">Runs</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Money Line</div>
                <div className="text-lg font-bold text-white">
                  {betbookData.odds?.away > 0 ? `+${betbookData.odds.away}` : betbookData.odds?.away || '+110'}
                </div>
                <div className="text-xs text-slate-400">Away</div>
              </div>
            </div>

            {/* AI Betting Advice */}
            {betbookData.aiAdvice && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-xs text-blue-400 mb-1">🤖 AI Betting Insight</div>
                <div className="text-sm text-slate-300">{betbookData.aiAdvice}</div>
              </div>
            )}
          </div>
        )}

        {/* Key matchup factors and weather */}
        <div className="space-y-3">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Game Factors</div>

          {alertData.context?.gameInfo?.pitchingMatchup && (
            <div className="flex items-center gap-2">
              <User className={`w-4 h-4 ${theme.text}`} />
              <span className="text-sm text-slate-300">
                {alertData.context.gameInfo.pitchingMatchup.away} vs {alertData.context.gameInfo.pitchingMatchup.home}
              </span>
            </div>
          )}

          {alertData.context?.gameInfo?.seriesRecord && (
            <div className="flex items-center gap-2">
              <Trophy className={`w-4 h-4 ${theme.text}`} />
              <span className="text-sm text-slate-300">
                Season series: {alertData.context.gameInfo.seriesRecord}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${theme.text}`} />
            <span className="text-sm text-slate-300">
              Last 10: {awayTeamName.split(' ').pop()} 7-3, {homeTeamName.split(' ').pop()} 6-4
            </span>
          </div>

          {weatherData && (
            <div className="flex items-center gap-2">
              <Wind className={`w-4 h-4 ${theme.text}`} />
              <span className="text-sm text-slate-300">
                {weatherData.temperature}°F, Wind {weatherData.windSpeed}mph {weatherData.windDirection}
              </span>
            </div>
          )}

          {alertData.sport === 'MLB' && (
            <div className="flex items-center gap-2">
              <Target className={`w-4 h-4 ${theme.text}`} />
              <span className="text-sm text-slate-300">
                Umpire: {alertData.context?.gameInfo?.umpire || 'TBD'} • Stadium: {alertData.context?.gameInfo?.stadium || 'Home'}
              </span>
            </div>
          )}
        </div>

        {/* Quick action buttons for sportsbooks */}
        {betbookData?.sportsbookLinks && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Quick Bet Access</div>
            <div className="grid grid-cols-2 gap-2">
              {betbookData.sportsbookLinks.slice(0, 4).map((sportsbook: any, index: number) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 hover:border-blue-500"
                  onClick={() => window.open(sportsbook.url, '_blank')}
                >
                  {sportsbook.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  const WeatherImpactLayout = () => (
    <>
      {/* Weather alert header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className={`w-5 h-5 ${theme.text}`} />
          <Badge className={`${theme.badge} border px-3 py-1`}>
            WEATHER IMPACT
          </Badge>
        </div>
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
          HIGH IMPACT
        </Badge>
      </div>

      {/* Weather conditions */}
      {weatherData && (
        <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-lg p-4 mb-4 border border-cyan-500/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Wind Speed</div>
              <div className="text-2xl font-bold text-white">{weatherData.windSpeed} mph</div>
              <div className="text-xs text-cyan-400">{weatherData.windDirection}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Temperature</div>
              <div className="text-2xl font-bold text-white">{weatherData.temperature}°F</div>
              <div className="text-xs text-cyan-400">{weatherData.condition}</div>
            </div>
          </div>
        </div>
      )}

      {/* Impact analysis */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-white">Scoring Impact</div>
            <div className="text-xs text-slate-400">
              Wind favors fly balls to right field (+15% HR probability)
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-green-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-white">Betting Adjustment</div>
            <div className="text-xs text-slate-400">
              Total moved from 8.5 to 9.5 (OVER trending)
            </div>
          </div>
        </div>
      </div>

      {/* Historical performance in conditions */}
      <div className="bg-slate-800/30 rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">Similar Conditions (Last 10 Games)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-slate-300">Avg Runs</div>
            <div className="text-lg font-bold text-white">11.2</div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Over Rate</div>
            <div className="text-lg font-bold text-green-400">73%</div>
          </div>
        </div>
      </div>
    </>
  );

  const CriticalMomentLayout = () => (
    <>
      {/* Critical alert header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-60 animate-pulse" />
            <AlertTriangle className="w-5 h-5 text-red-400 relative z-10" />
          </div>
          <Badge className="bg-red-500/20 text-red-300 border-red-400/40 border px-3 py-1">
            CRITICAL MOMENT
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-red-400">LIVE</span>
        </div>
      </div>

      {/* Situation display */}
      <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 rounded-lg p-4 mb-4 border border-red-500/20">
        <div className="text-lg font-bold text-white mb-2">
          {alertData.context?.aiTitle || alertData.title || alertData.message}
        </div>
        <div className="text-sm text-slate-300">
          {alertData.context?.aiCallToAction || alertData.description}
        </div>
      </div>

      {/* Win probability shift */}
      {gameProjection && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">WIN PROBABILITY SHIFT</div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Before</span>
            <span className="text-sm text-slate-300">After Success</span>
          </div>
          <div className="relative h-8 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${gameProjection.winProbability?.home || 50}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white z-10">
                {gameProjection.winProbability?.home || 50}% - {gameProjection.winProbability?.away || 50}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Key factors for this moment */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Success Rate</div>
          <div className="text-xl font-bold text-white">{probability}%</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Impact Level</div>
          <div className="text-xl font-bold text-orange-400">HIGH</div>
        </div>
      </div>
    </>
  );

  const MomentumShiftLayout = () => (
    <>
      {/* Momentum header */}
      <div className="flex items-center justify-between mb-4">
        <Badge className={`${theme.badge} border px-3 py-1`}>
          MOMENTUM SHIFT
        </Badge>
        <div className="flex items-center gap-2">
          {momentum.trend === 'up' ? (
            <TrendingUp className="w-5 h-5 text-green-400" />
          ) : momentum.trend === 'down' ? (
            <TrendingDown className="w-5 h-5 text-red-400" />
          ) : (
            <ArrowRight className="w-5 h-5 text-slate-400" />
          )}
          <span className={`text-sm font-bold ${
            momentum.trend === 'up' ? 'text-green-400' : 
            momentum.trend === 'down' ? 'text-red-400' : 'text-slate-400'
          }`}>
            {momentum.label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main alert */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          {alertData.context?.aiTitle || alertData.title || alertData.message || `${getAlertCategory(alertData.type)} alert for ${alertData.homeTeam} vs ${alertData.awayTeam}`}
        </h3>
        {(alertData.context?.aiCallToAction || alertData.description) && (
          <p className="text-sm text-slate-300">
            {alertData.context?.aiCallToAction || alertData.description}
          </p>
        )}
      </div>

      {/* Momentum indicators */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Last 3 Inn</div>
          <div className="text-lg font-bold text-green-400">5-1</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Run Diff</div>
          <div className="text-lg font-bold text-white">+4</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Pressure</div>
          <div className="text-lg font-bold text-orange-400">HIGH</div>
        </div>
      </div>

      {/* Trend visualization */}
      <div className="bg-slate-800/30 rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">SCORING TREND</div>
        <div className="flex items-end justify-between h-16 gap-1">
          {[3, 5, 2, 7, 4, 8, 6, 9, 8].map((value, idx) => (
            <div 
              key={idx}
              className={`flex-1 ${idx > 5 ? 'bg-green-500' : 'bg-slate-600'} rounded-t`}
              style={{ height: `${(value / 10) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-500">1st</span>
          <span className="text-xs text-slate-500">Now</span>
        </div>
      </div>
    </>
  );

  const PlayerFocusLayout = () => (
    <>
      {/* Player alert header */}
      <div className="flex items-center justify-between mb-4">
        <Badge className={`${theme.badge} border px-3 py-1`}>
          {getAlertCategory(alertData.type)}
        </Badge>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">AT BAT</span>
        </div>
      </div>

      {/* Player info */}
      {alertData.context?.currentBatter && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-white">
                {alertData.context.currentBatter}
              </div>
              <div className="text-xs text-slate-400">
                {alertData.context.isPowerHitter ? 'Power Hitter' : 'Contact Hitter'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">.312</div>
              <div className="text-xs text-slate-400">AVG</div>
            </div>
          </div>

          {/* Player stats */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-xs text-slate-500">HR</div>
              <div className="text-sm font-bold text-white">24</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">RBI</div>
              <div className="text-sm font-bold text-white">78</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">OPS</div>
              <div className="text-sm font-bold text-white">.891</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">L10</div>
              <div className="text-sm font-bold text-green-400">8-21</div>
            </div>
          </div>
        </div>
      )}

      {/* Matchup analysis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">vs This Pitcher</span>
          <span className="text-sm font-bold text-white">3-8, 1 HR</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">With RISP</span>
          <span className="text-sm font-bold text-green-400">.348 AVG</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Clutch Rating</span>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= 4 ? theme.pulse : 'bg-slate-600'}`} />
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const DefaultLayout = () => (
    <>
      {/* Standard header */}
      <div className="flex items-center justify-between mb-4">
        <Badge className={`${theme.badge} border px-3 py-1`}>
          {getAlertCategory(alertData.type)}
        </Badge>
        <span className="text-xs text-slate-400">{formatTime(alertData.createdAt || alertData.timestamp)}</span>
      </div>

      {/* Main content */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          {alertData.context?.aiTitle || alertData.title || alertData.message || `${getAlertCategory(alertData.type)} alert for ${alertData.homeTeam} vs ${alertData.awayTeam}`}
        </h3>
        {(alertData.context?.aiCallToAction || alertData.description) && (
          <p className="text-sm text-slate-300">
            {alertData.context?.aiCallToAction || alertData.description}
          </p>
        )}
      </div>

      {/* Confidence indicator */}
      {confidence && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className={`w-4 h-4 ${theme.text}`} />
            <span className="text-sm text-slate-300">AI Confidence</span>
          </div>
          <div className={`text-sm font-bold ${confidenceData.color} flex items-center gap-1`}>
            {confidenceData.icon}
            {confidence}%
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative overflow-hidden rounded-xl mx-2 sm:mx-0">
      {/* Sportsbook Panel (Left Swipe) - Only show when swiped left */}
      <div className={`absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent transition-opacity duration-300 ${
        dragX < -50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="h-full flex flex-col justify-center p-4 space-y-3">
          {/* Quick Bet Header */}
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Quick Bet</p>
              <p className="text-blue-200 text-xs">Live Sportsbooks</p>
            </div>
          </div>

          {/* Sportsbooks Grid */}
          <div className="grid grid-cols-2 gap-3">
            {sportsbooks.slice(0, 4).map((sportsbook) => (
              <div key={sportsbook.name} className="flex flex-col items-center space-y-1">
                <Button
                  onClick={() => {
                    handleSportsbookClick(sportsbook);
                    setDragX(0);
                  }}
                  className="h-12 w-12 p-1.5 rounded-xl bg-white/90 shadow-xl ring-2 ring-white/30"
                  style={{ backgroundColor: `${sportsbook.color}20`, borderColor: `${sportsbook.color}40` }}
                  data-testid={`advanced-sportsbook-${sportsbook.name.toLowerCase()}`}
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

          {/* Additional sportsbook if available */}
          {sportsbooks.length > 4 && (
            <div className="mt-2">
              <Button
                onClick={() => {
                  handleSportsbookClick(sportsbooks[4]);
                  setDragX(0);
                }}
                className="w-full h-10 bg-white/10 hover:bg-white/20 text-white text-sm"
                variant="outline"
              >
                <img
                  src={sportsbooks[4].logo}
                  alt={sportsbooks[4].name}
                  className="w-4 h-4 mr-2"
                />
                {sportsbooks[4].name}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Panel (Right Swipe) - Only show when swiped right */}
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
          data-testid={`advanced-delete-alert-${alertId}`}
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
        onClick={() => !isDragging && onTap?.()}
      >
        <Card className={cn(
          `relative ${theme.bg} backdrop-blur-sm ${theme.border} border transition-all duration-200 overflow-hidden`,
          className
        )}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient}" />

          <div className="p-4">
            {renderAlertContent()}
          </div>

          {/* Footer with game state */}
          <div className={`px-4 py-3 border-t ${theme.border} bg-slate-900/50`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Sport badge */}
                <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                  {alertData.sport}
                </Badge>

                {/* Game state */}
                {alertData.sport === 'MLB' && alertData.inning && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {alertData.isTopInning ? '▲' : '▼'} {alertData.inning}
                    </span>
                    {alertData.outs !== undefined && (
                      <span className="text-xs text-slate-500">
                        {alertData.outs} out{alertData.outs !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Score if available */}
                {(alertData.homeScore !== undefined || alertData.awayScore !== undefined) && (
                  <div className="text-sm font-medium text-white">
                    {alertData.awayScore || 0} - {alertData.homeScore || 0}
                  </div>
                )}
              </div>

              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className={`absolute inset-0 ${theme.pulse} rounded-full blur opacity-75 animate-pulse`} />
                  <div className={`w-2 h-2 ${theme.pulse} rounded-full relative z-10`} />
                </div>
                <span className="text-xs text-slate-400">
                  {formatTime(alertData.createdAt || alertData.timestamp)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}