
import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Bell, Clock, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

interface SimpleAlert {
  id: string;
  type: string;
  message: string;
  sport: string;
  homeTeam?: string;
  awayTeam?: string;
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
    <div className="relative overflow-hidden rounded-xl">
      {/* Sportsbooks Panel (Left Swipe) */}
      <div className={`absolute inset-y-0 right-0 w-60 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
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
                  className="h-10 w-10 p-1 rounded-lg bg-white/90 hover:bg-white hover:scale-105 shadow-lg ring-2 ring-white/20 transition-all duration-200"
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
      <div className={`absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent backdrop-blur-sm flex items-center justify-start pl-4 transition-opacity duration-300 ${
        dragX > 50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <Button
          onClick={() => {
            handleDeleteAlert();
            setDragX(0);
          }}
          disabled={isDeleting}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm ring-1 ring-red-500/30 transition-all"
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
        className="relative z-10"
        whileDrag={{ scale: 1.01, cursor: "grabbing" }}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <Card className={`${className} bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/30 transition-all duration-200`}>
          <div className="p-4">
            {/* Simple Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getAlertColor(alert.priority)} animate-pulse`}></div>
                <div className="flex items-center gap-1 text-emerald-400">
                  {getAlertIcon(alert.type)}
                  <Badge variant="outline" className="px-2 py-0 text-xs font-bold border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    {alert.sport}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{formatTime(alert.createdAt)}</span>
                <span className="text-emerald-400 font-bold">{alert.priority}</span>
              </div>
            </div>

            {/* Simple Team Display */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-sm font-medium">
                  {alert.awayTeam?.split(' ').pop() || 'Away'}
                </span>
                <span className="text-slate-500 text-xs">@</span>
                <span className="text-slate-300 text-sm font-medium">
                  {alert.homeTeam?.split(' ').pop() || 'Home'}
                </span>
              </div>
              
              {/* Score if available */}
              {(alert.context?.homeScore !== undefined && alert.context?.awayScore !== undefined) && (
                <div className="flex items-center gap-2 text-lg font-bold">
                  <span className="text-white">{alert.context.awayScore}</span>
                  <span className="text-slate-500">-</span>
                  <span className="text-white">{alert.context.homeScore}</span>
                </div>
              )}
            </div>

            {/* Alert Message - Clean & Simple */}
            <div className="bg-slate-900/50 rounded-lg p-3 border-l-2 border-emerald-500">
              <p className="text-slate-100 text-sm font-medium leading-relaxed">
                {alert.message.replace(/🔥|💎|⚾|💪|⚡|🏠|🎆|⏰|🏈|🏀|🏒/g, '').trim()}
              </p>
              
              {/* AI Insights - Simple Display */}
              {(alert.context?.aiInsights || alert.context?.recommendation) && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs">🤖</span>
                    </div>
                    <span className="text-xs text-blue-300 font-medium">AI Analysis</span>
                  </div>
                  {alert.context.recommendation && (
                    <p className="text-xs text-green-300 font-medium">
                      {alert.context.recommendation}
                    </p>
                  )}
                  {alert.context.aiInsights && (
                    <p className="text-xs text-slate-300 mt-1">
                      {alert.context.aiInsights}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Basic Game Context - Minimal */}
            {(alert.context?.quarter || alert.context?.inning || alert.context?.period || alert.context?.timeRemaining) && (
              <div className="mt-3 flex items-center gap-3 text-xs">
                {/* Time/Period Info */}
                {alert.context.quarter && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">
                    Q{alert.context.quarter}
                  </span>
                )}
                {alert.context.inning && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">
                    {alert.context.isTopInning ? 'T' : 'B'}{alert.context.inning}
                  </span>
                )}
                {alert.context.period && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">
                    P{alert.context.period}
                  </span>
                )}
                {alert.context.timeRemaining && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">
                    {alert.context.timeRemaining}
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
