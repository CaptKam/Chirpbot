import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Download, TrendingUp, Target, Zap, Brain, Calculator, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AlertFooter from '@/components/AlertFooter';
import { Badge } from '@/components/ui/badge';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

// Assume these utility functions exist and are imported
declare function formatTime(date: string | Date): string;
declare function getAlertColor(priority: number): string;

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

interface Alert {
  id: string;
  type: string;
  message: string;
  sport?: string;
  homeTeam?: string;
  awayTeam?: string;
  probability?: number;
  priority?: number;
  betbookData?: BetbookData;
  context?: {
    homeScore?: number;
    awayScore?: number;
    inning?: number;
    isTopInning?: boolean;
    balls?: number;
    strikes?: number;
    outs?: number;
    hasFirst?: boolean;
    hasSecond?: boolean;
    hasThird?: boolean;
    weather?: {
      temperature: number;
      condition: string;
    };
    quarter?: number;
    timeRemaining?: string;
    down?: number;
    yardsToGo?: number;
    period?: number;
  };
  createdAt: string;
  confidence?: number;
  homeScore?: number;
  awayScore?: number;
  inning?: number;
  isTopInning?: boolean;
  balls?: number;
  strikes?: number;
  outs?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  weather?: {
    temperature: number;
    condition: string;
  };
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

      // Invalidate and refetch alerts
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/unseen/count'] });

      toast({
        title: "Alert deleted",
        description: "The alert has been removed from your feed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete alert. Please try again.",
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
    const threshold = 100; // Lowered back for better responsiveness
    const velocity = info.velocity.x;

    // Use velocity for more natural swipe detection
    if (Math.abs(info.offset.x) < threshold && Math.abs(velocity) < 500) {
      setDragX(0);
    } else if (info.offset.x > threshold || velocity > 500) {
      // Swiped right - show delete
      setDragX(120);
      startAutoReturnTimer();
    } else if (info.offset.x < -threshold || velocity < -500) {
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
                {alertData.context?.reasons && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 ring-1 ring-white/10">
                    <div className="flex items-center space-x-2 mb-1">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-200 font-medium">AI Analysis</span>
                      <span className="text-xs text-green-300 font-mono">
                        {alertData.context.confidence}% confidence
                      </span>
                    </div>
                    <ul className="text-xs text-white/90 space-y-0.5">
                      {alertData.context.reasons.slice(0, 2).map((reason, idx) => (
                        <li key={idx} className="flex items-start space-x-1">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}

            {/* Live Odds Display */}
            {alertData?.betbookData?.odds && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-200 font-semibold">Live Odds</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-300">{alertData.homeTeam?.split(' ').pop()}</div>
                    <div className="text-white font-mono">{alertData.betbookData.odds.home > 0 ? '+' : ''}{alertData.betbookData.odds.home}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-300">O/U</div>
                    <div className="text-white font-mono">{alertData.betbookData.odds.total}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-300">{alertData.awayTeam?.split(' ').pop()}</div>
                    <div className="text-white font-mono">{alertData.betbookData.odds.away > 0 ? '+' : ''}{alertData.betbookData.odds.away}</div>
                  </div>
                </div>
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
          <div className="h-full flex flex-col items-center justify-center p-4 space-y-3">
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
          </div>
        )}
      </div>

      {/* Delete Menu (Right Swipe) - Only show when swiped right */}
      <div className={`absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent backdrop-blur-sm flex items-center justify-start pl-4 transition-opacity duration-300 ${
        dragX > 50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <Button
          onClick={() => {
            handleDeleteAlert();
            setDragX(0); // Return to center after click
          }}
          disabled={isDeleting}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm ring-1 ring-red-500/30 transition-all"
          data-testid={`delete-alert-${alertId}`}
        >
          <Trash2 className="w-5 h-5 text-red-400" />
        </Button>
      </div>

      {/* Main Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -400, right: 140 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        animate={{ x: dragX }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 300,
          mass: 0.8
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
            <div className="p-5" key={`alert-${alertData.id}-${Date.now()}`}>
              {/* Alert Header - Type, Priority & Time */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getAlertColor(alertData.priority ?? 0)} animate-pulse`}></div>
                  <Badge 
                    variant="outline" 
                    className="px-2 py-1 text-xs font-bold border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  >
                    {alertData.type.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400">{alertData.confidence}%</span>
                  <span className="text-slate-400 text-xs">{formatTime(alertData.createdAt)}</span>
                </div>
              </div>

              {/* Team Matchup - Visual & Clean */}
              <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/40 rounded-lg p-4 mb-4 border border-slate-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-sm font-bold text-slate-300 mb-1">{alertData.awayTeam?.split(' ').pop()}</div>
                      <div className="text-2xl font-black text-white">{alertData.context?.awayScore ?? alertData.awayScore ?? '-'}</div>
                    </div>
                    <div className="px-3 py-2 bg-slate-600/50 rounded-lg">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">@ </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-slate-300 mb-1">{alertData.homeTeam?.split(' ').pop()}</div>
                      <div className="text-2xl font-black text-white">{alertData.context?.homeScore ?? alertData.homeScore ?? '-'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full mb-1">
                      {alertData.sport}
                    </div>
                    {alertData.context?.inning && (
                      <div className="text-xs text-slate-400">
                        {alertData.context.isTopInning ? 'T' : 'B'}{alertData.context.inning}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Key Situation Info - Visual Icons */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Game Situation */}
                {alertData.context?.outs !== undefined && (
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/30">
                    <div className="text-xs text-slate-400 mb-1">OUTS</div>
                    <div className="text-lg font-bold text-white">{alertData.context.outs}</div>
                  </div>
                )}

                {/* Count */}
                {(alertData.context?.balls !== undefined || alertData.context?.strikes !== undefined) && (
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/30">
                    <div className="text-xs text-slate-400 mb-1">COUNT</div>
                    <div className="text-lg font-bold text-white">
                      {alertData.context?.balls ?? 0}-{alertData.context?.strikes ?? 0}
                    </div>
                  </div>
                )}

                {/* Priority Score */}
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/30">
                  <div className="text-xs text-slate-400 mb-1">PRIORITY</div>
                  <div className={`text-lg font-bold ${alertData.priority >= 90 ? 'text-red-400' : alertData.priority >= 80 ? 'text-orange-400' : alertData.priority >= 70 ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {alertData.priority}
                  </div>
                </div>
              </div>

              {/* Alert Message - Clear & Prominent */}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4 border-l-4 border-emerald-500">
                <h3 className="text-slate-100 text-base font-medium leading-relaxed">
                  {alertData.message.replace(/🔥|💎|⚾|💪|⚡|🏠|🎆|⏰|🏈/g, '').trim()}
                </h3>
              </div>

              {/* Base Runners Visual (MLB Only) */}
              {alertData.sport === 'MLB' && (alertData.context?.hasFirst || alertData.context?.hasSecond || alertData.context?.hasThird) && (
                <div className="flex justify-center mb-4">
                  <div className="relative w-24 h-24">
                    {/* Baseball Diamond */}
                    <div className="absolute inset-0 rotate-45 border-2 border-slate-600 bg-slate-800/30"></div>

                    {/* Bases */}
                    <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${alertData.context?.hasSecond ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
                    <div className={`absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${alertData.context?.hasFirst ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
                    <div className={`absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${alertData.context?.hasThird ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-500"></div>
                  </div>
                </div>
              )}

              {/* Weather & Context (Compact) */}
              {alertData.context?.weather && (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Weather</span>
                    <span className="text-slate-300">
                      {alertData.context.weather.temperature}°F, {alertData.context.weather.condition}
                    </span>
                  </div>
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