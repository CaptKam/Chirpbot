import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Download, TrendingUp, Target, Zap, Brain, Calculator, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

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
  alertData?: {
    sport?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
    probability?: number;
    priority?: number;
    betbookData?: BetbookData;
    gameInfo?: {
      v3Analysis?: {
        tier: number;
        probability: number;
        reasons: string[];
      };
    };
  };
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

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* AI Betting Insights Panel (Left Swipe) - Only show when swiped left */}
      <div className={`absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-blue-500/20 via-purple-500/10 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
        dragX < -50 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {alertData?.betbookData || alertData?.gameInfo?.v3Analysis ? (
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
            {(alertData.gameInfo?.v3Analysis || alertData.priority >= 80) && (
              <div className="space-y-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-200 font-semibold">Recommended Bet</span>
                  </div>
                  <p className="text-white text-sm font-medium">
                    {(() => {
                      // Get analysis data or generate from alert info
                      const reasons = alertData.gameInfo?.v3Analysis?.reasons || [];
                      const tier = alertData.gameInfo?.v3Analysis?.tier || Math.ceil((alertData.priority || 70) / 25);
                      const probability = alertData.gameInfo?.v3Analysis?.probability || (alertData.priority >= 95 ? 0.85 : alertData.priority >= 90 ? 0.80 : alertData.priority >= 85 ? 0.75 : 0.70);
                      const sport = alertData.sport || 'MLB';
                      
                      // Generate betting recommendation based on sport and situation
                      if (sport === 'MLB') {
                        if (reasons.some(r => r.includes('scoring position')) && reasons.some(r => r.includes('power hitter'))) {
                          return "Bet Over 8.5 runs - High scoring situation with RISP + power hitter";
                        } else if (reasons.some(r => r.includes('bases loaded'))) {
                          return "Bet Over 7.5 runs - Bases loaded situation favors scoring";  
                        } else if (reasons.some(r => r.includes('wind')) && reasons.some(r => r.includes('out'))) {
                          return "Bet Over 8.0 runs - Favorable wind conditions for offense";
                        } else if (reasons.some(r => r.includes('Close Game'))) {
                          return "Live bet team moneyline - Close game with momentum shift";
                        } else if (reasons.some(r => r.includes('late-inning'))) {
                          return "Live bet next inning Over 0.5 runs - Clutch situation";
                        } else if (tier >= 3 && probability > 0.75) {
                          return "Bet team total Over 4.5 - High probability scoring opportunity";
                        } else {
                          return "Bet Over 7.5 runs - Favorable offensive situation";
                        }
                      } else if (sport === 'NBA') {
                        if (reasons.some(r => r.includes('Clutch'))) {
                          return "Bet Over team total - High-scoring clutch situation";
                        } else if (reasons.some(r => r.includes('Overtime'))) {
                          return "Bet Over game total - Overtime adds scoring opportunity";
                        } else {
                          return "Live bet player props - High-energy situation";
                        }
                      } else if (sport === 'NHL') {
                        if (reasons.some(r => r.includes('Power Play'))) {
                          return "Bet Over 0.5 goals next period - Power play advantage";
                        } else if (reasons.some(r => r.includes('Empty Net'))) {
                          return "Bet Over game total - Empty net creates scoring chances";
                        } else {
                          return "Live bet puck line - Game momentum shifting";
                        }
                      } else if (sport === 'NFL') {
                        if (reasons.some(r => r.includes('Red Zone'))) {
                          return "Bet touchdown scorer - Red zone opportunity";
                        } else if (reasons.some(r => r.includes('Fourth Down'))) {
                          return "Live bet conversion success - High-leverage play";
                        } else {
                          return "Bet Over team total - Offensive momentum building";
                        }
                      } else {
                        return "Consider live betting opportunities - High-value situation";
                      }
                    })()}
                  </p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calculator className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-yellow-200 font-semibold">Value Insight</span>
                  </div>
                  <p className="text-white text-xs leading-relaxed">
                    {(() => {
                      const probability = alertData.gameInfo?.v3Analysis?.probability || (alertData.priority >= 95 ? 0.85 : alertData.priority >= 90 ? 0.80 : alertData.priority >= 85 ? 0.75 : 0.70);
                      const priority = alertData.priority || 70;
                      
                      if (probability > 0.8 || priority >= 95) {
                        return "Strong value detected - Consider increased stake size for this high-confidence opportunity.";
                      } else if (probability > 0.7 || priority >= 85) {
                        return "Moderate value - Standard betting size recommended for this solid opportunity.";
                      } else if (priority >= 80) {
                        return "Good value - Consider standard betting size for this opportunity.";
                      } else {
                        return "Monitor closely - Wait for better value or consider smaller stake.";
                      }
                    })()}
                  </p>
                </div>
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

            {/* AI Advice */}
            {alertData?.betbookData?.aiAdvice && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 ring-1 ring-white/20">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-200 font-semibold">AI Recommendation</span>
                </div>
                <p className="text-white text-xs leading-relaxed">
                  {alertData.betbookData.aiAdvice.length > 100 
                    ? alertData.betbookData.aiAdvice.substring(0, 100) + '...' 
                    : alertData.betbookData.aiAdvice}
                </p>
              </div>
            )}

            {/* Quick Sportsbook Access */}
            <div className="space-y-2">
              <h4 className="text-xs text-blue-200 font-medium tracking-wide uppercase">Quick Bet</h4>
              <div className="flex space-x-2">
                {sportsbooks.slice(0, 3).map((sportsbook) => (
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
          {children}
        </Card>
      </motion.div>
    </div>
  );
}
