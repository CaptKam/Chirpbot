import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, Bell, Filter, Share2, Target, TrendingUp, 
  Timer, Trophy, Wind, Bot, AlertTriangle, 
  CircleDot, Users, Activity, Sparkles, Trash2, ExternalLink
} from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Alert } from "@/types";

const FILTER_OPTIONS = [
  { id: "all", label: "All Sports", active: true },
  { id: "high-impact", label: "High Impact", active: false },
  { id: "ai-verified", label: "AI Verified", active: false },
];

// Sportsbook quick actions with accurate brand colors and logos
const SPORTSBOOKS = [
  { 
    name: "FanDuel", 
    baseUrl: "https://sportsbook.fanduel.com", 
    color: "bg-blue-600", 
    icon: "FD",
    logo: (
      <svg viewBox="0 0 60 60" className="w-16 h-16">
        <rect width="60" height="60" fill="#1493FF" rx="8"/>
        <path d="M30 12 L42 18 L42 36 L30 42 L18 36 L18 18 Z" fill="#FFFFFF" opacity="0.15"/>
        <text x="30" y="38" textAnchor="middle" className="fill-white" style={{fontSize: '18px', fontWeight: 'bold', fontFamily: 'system-ui, sans-serif'}}>FD</text>
      </svg>
    )
  },
  { 
    name: "Bet365", 
    baseUrl: "https://www.bet365.com/#/HO/", 
    color: "bg-green-600", 
    icon: "365",
    logo: (
      <svg viewBox="0 0 60 60" className="w-16 h-16">
        <rect width="60" height="60" fill="#236C00" rx="8"/>
        <text x="19" y="33" className="fill-white" style={{fontSize: '13px', fontWeight: 'normal', fontFamily: 'system-ui, sans-serif'}}>bet</text>
        <text x="33" y="33" style={{fontSize: '13px', fontWeight: 'bold', fontFamily: 'system-ui, sans-serif', fill: '#FFD700'}}>365</text>
      </svg>
    )
  },
  { 
    name: "DraftKings", 
    baseUrl: "https://sportsbook.draftkings.com", 
    color: "bg-orange-600", 
    icon: "DK",
    logo: (
      <svg viewBox="0 0 60 60" className="w-16 h-16">
        <rect width="60" height="60" fill="#F3701D" rx="8"/>
        <rect width="60" height="60" fill="#000000" opacity="0.08" rx="8"/>
        <g transform="translate(30,22)">
          <polygon points="-9,-7 9,-7 6,-3 3,3 -3,3 -6,-3" fill="#FFFFFF"/>
          <polygon points="-2,4 2,4 0,10" fill="#FFFFFF"/>
        </g>
        <text x="30" y="48" textAnchor="middle" className="fill-white" style={{fontSize: '11px', fontWeight: 'bold', fontFamily: 'system-ui, sans-serif'}}>DK</text>
      </svg>
    )
  },
  { 
    name: "BetRivers", 
    baseUrl: "https://www.betrivers.com", 
    color: "bg-purple-600", 
    icon: "BR",
    logo: (
      <svg viewBox="0 0 60 60" className="w-16 h-16">
        <rect width="60" height="60" fill="#27388C" rx="8"/>
        <path d="M12 22 Q22 18 32 22 Q42 26 52 22" stroke="#00B4D8" strokeWidth="3" fill="none"/>
        <path d="M12 30 Q22 26 32 30 Q42 34 52 30" stroke="#00B4D8" strokeWidth="3" fill="none"/>
        <text x="30" y="48" textAnchor="middle" className="fill-white" style={{fontSize: '10px', fontWeight: 'bold', fontFamily: 'system-ui, sans-serif'}}>RIVERS</text>
      </svg>
    )
  },
];

interface SwipeableAlertCardProps {
  alert: Alert;
  config: any;
  onDelete: (alertId: string) => void;
}

function SwipeableAlertCard({ alert, config, onDelete }: SwipeableAlertCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    
    const currentX = e.touches[0].clientX;
    const deltaX = startXRef.current - currentX;
    
    // Only allow left swipe (positive deltaX)
    if (deltaX > 0) {
      setSwipeX(Math.min(deltaX, 120)); // Max swipe of 120px
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    
    // If swiped more than 60px, reveal the menu
    if (swipeX > 60) {
      setSwipeX(120);
      setIsRevealed(true);
    } else {
      setSwipeX(0);
      setIsRevealed(false);
    }
  };

  const closeMenu = () => {
    setSwipeX(0);
    setIsRevealed(false);
  };

  const generateGameUrl = (sportsbook: any, alert: Alert) => {
    const { homeTeam, awayTeam } = alert.gameInfo;
    const sport = alert.sport.toLowerCase();
    
    // Get today's date for game-specific searches
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Clean team names for better matching
    const cleanHome = homeTeam.replace(/\s+/g, '+');
    const cleanAway = awayTeam.replace(/\s+/g, '+');
    
    // Encode for URL
    const encodedHome = encodeURIComponent(homeTeam);
    const encodedAway = encodeURIComponent(awayTeam);
    const gameMatchup = encodeURIComponent(`${awayTeam} @ ${homeTeam}`);
    
    // Generate game-specific URLs for each sportsbook
    switch (sportsbook.name) {
      case "FanDuel":
        // FanDuel specific game search with matchup format
        return `${sportsbook.baseUrl}/${sport}?tab=popular&search=${gameMatchup}`;
      case "DraftKings":
        // DraftKings game search with @ format
        return `${sportsbook.baseUrl}/${sport}?category=game+lines&search=${encodedAway}+%40+${encodedHome}`;
      case "Bet365":
        // Bet365 with NJ-specific URL structure for live games
        const betBaseUrl = "https://www.nj.bet365.com/?_h=2fxB10_5kFJPW2ZqihjR5w%3D%3D&btsffd=1";
        // Use search parameters to find the specific game matchup
        return `${betBaseUrl}#/AC/B1/C1/D8/E${sport === 'mlb' ? '15' : sport === 'nfl' ? '13' : '18'}/F2/G9/I1/?search=${gameMatchup}`;
      case "BetRivers":
        // BetRivers with specific game search
        return `${sportsbook.baseUrl}/sportsbook/${sport}?tab=popular&search=${gameMatchup}`;
      default:
        return `${sportsbook.baseUrl}/${sport}?search=${gameMatchup}`;
    }
  };

  const handleSportsbookClick = (sportsbook: any) => {
    const gameUrl = generateGameUrl(sportsbook, alert);
    window.open(gameUrl, '_blank');
  };

  const AlertIcon = config.icon;
  
  // Parse the score from gameInfo if available
  const score = (alert.gameInfo as any)?.score || { 
    away: (alert.gameInfo as any)?.awayScore || 0, 
    home: (alert.gameInfo as any)?.homeScore || 0 
  };
  
  // Extract team names without cities
  const getTeamNameWithoutCity = (fullTeamName: string) => {
    // Remove common city prefixes and return just the team name
    return fullTeamName
      .replace(/^(Los Angeles|New York|San Francisco|Chicago|Boston|Philadelphia|Detroit|Houston|Atlanta|Miami|Dallas|Denver|Seattle|Portland|Phoenix|San Antonio|San Diego|Tampa Bay|Kansas City|Las Vegas|Oklahoma City|New Orleans|Charlotte|Memphis|Milwaukee|Cleveland|Cincinnati|Pittsburgh|Buffalo|Indianapolis|Jacksonville|Nashville|Green Bay|Baltimore|Minnesota|Washington|Carolina|New England)\s+/i, '')
      .trim();
  };
  
  const awayTeamName = getTeamNameWithoutCity(alert.gameInfo.awayTeam);
  const homeTeamName = getTeamNameWithoutCity(alert.gameInfo.homeTeam);
  
  // Extract key details from description for cleaner display
  const cleanDescription = alert.description
    ?.replace(/Score:.*?\./, '') // Remove score from description
    ?.replace(alert.gameInfo.homeTeam, '') // Remove redundant team names
    ?.replace(alert.gameInfo.awayTeam, '')
    ?.trim();

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Hidden Menu Behind Card */}
      <div className="absolute inset-0 bg-gray-100 flex items-center justify-end pr-2 rounded-xl">
        <div className="flex flex-col items-center space-y-1 justify-center h-full">
          {/* Sportsbook Quick Actions - Stacked Vertically */}
          <div className="flex flex-col space-y-1">
            {SPORTSBOOKS.map((sportsbook) => (
              <Button
                key={sportsbook.name}
                onClick={() => handleSportsbookClick(sportsbook)}
                className="bg-white hover:bg-gray-50 border border-gray-200 p-2 h-16 w-20 rounded-lg flex items-center justify-center shadow-sm"
                data-testid={`sportsbook-${sportsbook.name.toLowerCase()}`}
                title={`Open ${sportsbook.name} for ${alert.gameInfo.awayTeam} @ ${alert.gameInfo.homeTeam}`}
              >
                {sportsbook.logo}
              </Button>
            ))}
          </div>
          
          {/* Delete Button */}
          <Button
            onClick={() => onDelete(alert.id)}
            className="bg-red-500 hover:bg-red-600 text-white p-1 h-8 w-12 rounded-lg flex items-center justify-center mt-1"
            data-testid={`delete-alert-${alert.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Alert Card */}
      <Card
        ref={cardRef}
        className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-l-4 ${config.borderColor} overflow-hidden relative`}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isRevealed ? closeMenu : undefined}
        data-testid={`alert-card-${alert.id}`}
      >
        {/* Redesigned Header with Team Logos and Score */}
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          {/* Top row - Sport, Time, Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="text-xs font-bold uppercase">
                {alert.sport}
              </Badge>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
              </span>
            </div>
            <Badge className="bg-green-100 text-green-800 border-green-300">
              {alert.gameInfo.status}
            </Badge>
          </div>

          {/* Team Matchup with Logos and Score */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-3">
            {/* Away Team */}
            <div className="flex items-center space-x-2 flex-1">
              <TeamLogo teamName={alert.gameInfo.awayTeam} size="md" />
              <span className="font-bold text-gray-900">{awayTeamName}</span>
            </div>
            
            {/* Score */}
            <div className="flex items-center space-x-3 px-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">
                  {score.away} - {score.home}
                </div>
              </div>
            </div>
            
            {/* Home Team */}
            <div className="flex items-center space-x-2 flex-1 justify-end">
              <span className="font-bold text-gray-900">{homeTeamName}</span>
              <TeamLogo teamName={alert.gameInfo.homeTeam} size="md" />
            </div>
          </div>
        </div>

        {/* Alert Content */}
        <div className="px-4 pt-2 pb-2">

          {/* Alert Type and Details */}
          <div className={`${config.color} rounded-lg p-3 mb-3`}>
            <div className="flex items-center space-x-2 mb-2">
              <AlertIcon className="w-5 h-5 text-white" />
              <h3 className="text-white font-bold text-sm uppercase tracking-wide">
                {config.shortLabel}
              </h3>
              {alert.aiConfidence && alert.aiConfidence > 85 && (
                <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full ml-auto">
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  <span className="text-xs font-bold text-white">HIGH</span>
                </div>
              )}
            </div>
            <p className="text-white/95 text-sm font-medium">
              {cleanDescription || alert.description}
            </p>
          </div>

          {/* Weather Impact (if relevant) */}
          {alert.weatherData && alert.type === 'WeatherImpact' && (
            <div className="flex items-center space-x-2 bg-sky-50 rounded-lg p-2 mb-3">
              <Wind className="w-4 h-4 text-sky-600" />
              <span className="text-xs text-sky-900">
                {alert.weatherData.temperature}°F • {alert.weatherData.condition}
                {alert.weatherData.windSpeed && ` • Wind: ${alert.weatherData.windSpeed}mph`}
              </span>
            </div>
          )}

          {/* AI Insight - Concise */}
          {alert.aiContext && (
            <div className="border-t pt-3">
              <div className="flex items-start space-x-2">
                <Bot className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-bold">AI:</span> {alert.aiContext}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="px-4 pb-3 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {isRevealed ? "Tap to close" : "Swipe left for actions"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
            data-testid={`alert-share-${alert.id}`}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function Alerts() {
  const [activeFilters, setActiveFilters] = useState(["all"]);
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 2000, // Refetch every 2 seconds for ultra-fast updates
    staleTime: 0, // Always consider data stale for maximum freshness
    gcTime: 1000, // Minimal cache time for fastest updates (updated from deprecated cacheTime)
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("DELETE", `/api/alerts/${alertId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert deleted",
        description: "The alert has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleFilter = (filterId: string) => {
    if (filterId === "all") {
      setActiveFilters(["all"]);
    } else {
      setActiveFilters(prev => {
        const newFilters = prev.filter(f => f !== "all");
        if (prev.includes(filterId)) {
          return newFilters.filter(f => f !== filterId);
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
          label: "RUNNERS IN SCORING POSITION",
          shortLabel: "RISP",
          color: "bg-red-500",
          bgColor: "bg-red-50",
          borderColor: "border-red-500",
          textColor: "text-red-900",
          description: "High-probability scoring opportunity"
        };
      case "HOMERUN":
        return {
          icon: Trophy,
          label: "HOME RUN",
          shortLabel: "HR",
          color: "bg-purple-500",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-500",
          textColor: "text-purple-900",
          description: "Big momentum swing"
        };
      case "REDZONE":
        return {
          icon: AlertTriangle,
          label: "RED ZONE",
          shortLabel: "RZ",
          color: "bg-orange-500",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-500",
          textColor: "text-orange-900",
          description: "Inside the 20-yard line"
        };
      case "CLUTCHTIME":
        return {
          icon: Timer,
          label: "CLUTCH TIME",
          shortLabel: "CLUTCH",
          color: "bg-blue-500",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-500",
          textColor: "text-blue-900",
          description: "Final minutes, close game"
        };
      case "TWOMINUTEWARNING":
        return {
          icon: Timer,
          label: "2-MINUTE WARNING",
          shortLabel: "2MIN",
          color: "bg-indigo-500",
          bgColor: "bg-indigo-50",
          borderColor: "border-indigo-500",
          textColor: "text-indigo-900",
          description: "Critical drive time"
        };
      case "WEATHERIMPACT":
        return {
          icon: Wind,
          label: "WEATHER IMPACT",
          shortLabel: "WX",
          color: "bg-sky-500",
          bgColor: "bg-sky-50",
          borderColor: "border-sky-500",
          textColor: "text-sky-900",
          description: "Conditions affecting play"
        };
      case "LEADCHANGE":
        return {
          icon: TrendingUp,
          label: "LEAD CHANGE",
          shortLabel: "LEAD",
          color: "bg-green-500",
          bgColor: "bg-green-50",
          borderColor: "border-green-500",
          textColor: "text-green-900",
          description: "Momentum shift"
        };
      default:
        return {
          icon: Activity,
          label: type.toUpperCase(),
          shortLabel: type.slice(0, 4).toUpperCase(),
          color: "bg-gray-500",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-500",
          textColor: "text-gray-900",
          description: "Game event"
        };
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (activeFilters.includes("all")) return true;
    if (activeFilters.includes("high-impact")) {
      // Consider alerts with AI confidence > 90% as high impact
      return (alert.aiConfidence || 0) > 90;
    }
    if (activeFilters.includes("ai-verified")) {
      return alert.aiContext && (alert.aiConfidence || 0) > 75;
    }
    return true;
  });

  return (
    <div className="pb-20">
      {/* Header */}
      <header className="bg-chirp-blue text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-chirp-red rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">ChirpBot</h1>
            <p className="text-blue-200 text-xs font-medium">V2 Alert System</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-chirp-red px-3 py-1 rounded-full">
            <span className="text-white text-xs font-bold uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-red-300 rounded-full inline-block mr-1 animate-pulse"></div>
              LIVE
            </span>
          </div>
          <Button variant="ghost" size="sm" className="relative p-0 text-white hover:text-gray-200">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-chirp-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {alerts.length}
            </span>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
            Live Alerts
          </h2>
          <Button size="sm" className="bg-chirp-red text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
            <Filter className="w-3 h-3 mr-1" />
            Filter
          </Button>
        </div>
        <div className="flex space-x-2 overflow-x-auto">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => toggleFilter(option.id)}
              data-testid={`filter-${option.id}`}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-colors ${
                activeFilters.includes(option.id)
                  ? "bg-chirp-blue text-white"
                  : "bg-gray-100 text-chirp-dark hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border-l-4 border-gray-300 p-4 animate-pulse">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 bg-gray-300 rounded w-20"></div>
                    <div className="h-4 bg-gray-300 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-gray-300 rounded w-12"></div>
                </div>
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-full mb-3"></div>
                <div className="h-16 bg-gray-300 rounded mb-3"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-300 rounded w-20"></div>
                  <div className="h-4 bg-gray-300 rounded w-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Card className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-chirp-blue mb-2">No Alerts Found</h3>
            <p className="text-sm text-chirp-dark">
              No alerts match your current filters. Try adjusting your filter settings.
            </p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const config = getAlertTypeConfig(alert.type);
            
            return (
              <SwipeableAlertCard
                key={alert.id}
                alert={alert}
                config={config}
                onDelete={deleteAlertMutation.mutate}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
