import React, { useState, useRef, useEffect } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, BrainCircuit, ExternalLink, Clock, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

// Types based on your specification
type InningHalf = "Top" | "Bot";
type BaseState = { first: boolean; second: boolean; third: boolean };

interface TeamSide {
  id: string;
  name: string;
  logoUrl?: string;
  score: number;
}

interface GameState {
  sport: "MLB" | "NCAAF" | "NBA" | "NHL";
  inning?: number;
  half?: InningHalf;
  outs?: number;
  balls?: number;
  strikes?: number;
  bases?: BaseState;
  countStr?: string;
  clockStr?: string;
  atBat?: string;
  pitcher?: string;
  scheduledAtIso?: string;
  situationText: string;
}

interface Alert {
  id: string;
  type: string;
  priority: number;
  confidence?: number;
  ts?: string;
  createdAt?: string;
  away?: TeamSide;
  home?: TeamSide;
  awayTeam?: string;
  homeTeam?: string;
  awayScore?: number;
  homeScore?: number;
  game?: GameState;
  message?: string;
  sport?: string;
  context?: any;
  ai?: { headline?: string; rec?: string; roi?: number };
  seen?: boolean;
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

interface SwipeableCardProps {
  alert: Alert;
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => Promise<void> | void;
  onAck?: (id: string) => void;
  className?: string;
  alertId?: string;
  alertData?: Alert;
  children?: React.ReactNode;
}

export function SwipeableCard({
  alert: propAlert,
  onOpen,
  onDelete,
  onAck,
  className,
  alertId,
  alertData,
  children
}: SwipeableCardProps) {
  // Use alertData if provided, fallback to alert prop
  const alert = alertData || propAlert;

  const dragX = useMotionValue(0);
  const [isDragging, setDragging] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const autoRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Panel reveals
  const showLeft = useTransform(dragX, [-420, -120, 0], [1, 1, 0]);
  const showRight = useTransform(dragX, [0, 90, 160], [0, 1, 1]);

  // Auto-return after 3s when panels are partially open
  useEffect(() => {
    const id = window.setInterval(() => {
      const x = dragX.get();
      if (!isDragging && Math.abs(x) > 10) {
        dragX.stop();
        dragX.set(0);
      }
    }, 3000);
    autoRef.current = id;
    return () => {
      if (autoRef.current) window.clearInterval(autoRef.current);
    };
  }, [isDragging, dragX]);

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
    setDeleting(true);
    try {
      await apiRequest("DELETE", `/api/alerts/${alertId || alert.id}`);

      queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((a: any) => a.id !== (alertId || alert.id));
      });

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
      setDeleting(false);
      dragX.set(0);
    }
  };

  const handleDragEnd = async (_: any, info: PanInfo) => {
    setDragging(false);
    const x = info.offset.x;
    const v = info.velocity.x;

    // Complete delete (right swipe)
    if (x > 90 || v > 300) {
      await handleDeleteAlert();
      return;
    }
    // Open AI panel (left swipe)
    if (x < -120 || v < -300) {
      dragX.set(-320);
      return;
    }
    // Return to center
    dragX.set(0);
  };

  // Create normalized data structure
  const normalizedAlert = {
    id: alert.id,
    type: alert.type,
    priority: alert.priority || 0,
    confidence: alert.confidence,
    ts: alert.ts || alert.createdAt || new Date().toISOString(),
    away: alert.away || {
      id: 'away',
      name: alert.awayTeam || 'Away',
      score: alert.awayScore || alert.context?.awayScore || alert.context?.scores?.away || 0,
      logoUrl: ''
    },
    home: alert.home || {
      id: 'home',
      name: alert.homeTeam || 'Home',
      score: alert.homeScore || alert.context?.homeScore || alert.context?.scores?.home || 0,
      logoUrl: ''
    },
    game: alert.game || {
      sport: (alert.sport as "MLB" | "NCAAF" | "NBA" | "NHL") || "MLB",
      inning: alert.context?.inning,
      half: alert.context?.isTopInning ? "Top" : "Bot",
      outs: alert.context?.outs,
      balls: alert.context?.balls,
      strikes: alert.context?.strikes,
      bases: {
        first: alert.context?.hasFirst || false,
        second: alert.context?.hasSecond || false,
        third: alert.context?.hasThird || false
      },
      countStr: alert.context?.balls !== undefined && alert.context?.strikes !== undefined
        ? `${alert.context.balls}-${alert.context.strikes}`
        : undefined,
      clockStr: alert.context?.timeRemaining,
      atBat: alert.context?.atBat,
      pitcher: alert.context?.pitcher,
      situationText: alert.message || ''
    },
    ai: alert.ai || {
      headline: alert.context?.aiEnhancedMessage || alert.context?.aiInsight,
      rec: alert.context?.recommendation || alert.context?.aiAdvice,
      roi: alert.context?.aiROI
    },
    seen: alert.seen
  };

  return (
    <div className={`relative h-[168px] select-none ${className || ""}`}>
      {/* LEFT: AI / Betting panel */}
      <motion.div
        className="absolute inset-0 rounded-2xl p-4 bg-gradient-to-r from-indigo-700 to-fuchsia-600 text-white"
        style={{ opacity: showLeft }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BrainCircuit className="h-5 w-5" />
          <span className="font-semibold">AI Insight</span>
        </div>
        <div className="text-sm line-clamp-3">
          {normalizedAlert.ai?.headline || normalizedAlert.ai?.rec || "Analyzing live situation..."}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {sportsbooks.slice(0, 5).map(b => (
            <Button
              key={b.name}
              onClick={() => handleSportsbookClick(b)}
              size="sm"
              variant="secondary"
              className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <img src={b.logo} alt="" className="h-4 w-4 rounded" />
              {b.name}
              <ExternalLink className="h-3 w-3" />
            </Button>
          ))}
        </div>
      </motion.div>

      {/* RIGHT: Delete panel */}
      <motion.div
        className="absolute inset-0 rounded-2xl p-4 bg-gradient-to-l from-rose-600 to-red-500 text-white flex items-center justify-end pr-6"
        style={{ opacity: showRight }}
      >
        <Button
          onClick={handleDeleteAlert}
          disabled={isDeleting}
          variant="destructive"
          className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </motion.div>

      {/* CENTER: Main card */}
      <motion.div
        role="button"
        aria-label={`${normalizedAlert.away.name} at ${normalizedAlert.home.name}, ${normalizedAlert.game.situationText}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen?.(normalizedAlert.id);
          if (e.key === "Delete") handleDeleteAlert();
          if (e.key === "ArrowLeft") dragX.set(-320);
          if (e.key === "ArrowRight") dragX.set(140);
        }}
        drag="x"
        dragConstraints={{ left: -420, right: 160 }}
        dragElastic={0.15}
        style={{ x: dragX }}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        className="absolute inset-0"
        transition={{
          type: "spring",
          damping: 24,
          stiffness: 260,
          mass: 0.6
        }}
      >
        <Card className={`h-full rounded-2xl border-2 ${priorityBorder(normalizedAlert.priority)} bg-white/5 backdrop-blur-sm`}>
          <CardContent className="h-full p-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <TeamScore team={normalizedAlert.away} align="left" />
              <CenterBadge game={normalizedAlert.game} priority={normalizedAlert.priority} seen={normalizedAlert.seen} />
              <TeamScore team={normalizedAlert.home} align="right" />
            </div>

            {/* Play text */}
            <p className="mt-2 text-sm leading-snug line-clamp-2 text-slate-100">
              {normalizedAlert.game.situationText}
            </p>

            {/* Footer + grid */}
            <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
              <InfoPill label="Inning" value={inningStr(normalizedAlert.game)} />
              <InfoPill label="Outs" value={String(normalizedAlert.game.outs ?? "-")}/>
              <InfoPill label="Count" value={normalizedAlert.game.countStr || "-"} />
              <BaseDiamond bases={normalizedAlert.game.bases}/>
              <PriorityPill value={normalizedAlert.priority}/>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <div>
                {normalizedAlert.game.scheduledAtIso
                  ? (<span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> First pitch {timeShort(normalizedAlert.game.scheduledAtIso)}</span>)
                  : (<span>{normalizedAlert.game.atBat ? `${normalizedAlert.game.atBat}` : ""}{normalizedAlert.game.pitcher ? `  •  ${normalizedAlert.game.pitcher}` : ""}</span>)
                }
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">{normalizedAlert.type}</Badge>
                {typeof normalizedAlert.confidence === "number" && (
                  <Badge className="bg-emerald-500/20 text-emerald-400">{normalizedAlert.confidence}%</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function TeamScore({ team, align }: { team: TeamSide; align: "left" | "right" }) {
  // Extract team name from full name (e.g., "Los Angeles Dodgers" -> "LAD")
  const getTeamCode = (name: string) => {
    const codes: Record<string, string> = {
      'Los Angeles Dodgers': 'LAD', 'Pittsburgh Pirates': 'PIT',
      'Toronto Blue Jays': 'TOR', 'Cincinnati Reds': 'CIN',
      'Cleveland Guardians': 'CLE', 'Boston Red Sox': 'BOS',
      'Seattle Mariners': 'SEA', 'Tampa Bay Rays': 'TB',
      'Los Angeles Angels': 'LAA', 'Kansas City Royals': 'KC',
      'Atlanta Braves': 'ATL', 'Chicago Cubs': 'CHC',
      'Chicago White Sox': 'CWS', 'Minnesota Twins': 'MIN',
      'Philadelphia Phillies': 'PHI', 'Milwaukee Brewers': 'MIL',
      'Athletics': 'OAK', 'St. Louis Cardinals': 'STL',
      'New York Yankees': 'NYY', 'Houston Astros': 'HOU'
    };
    return codes[name] || name.split(' ').pop()?.substring(0, 3).toUpperCase() || name.substring(0, 3).toUpperCase();
  };

  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
        {getTeamCode(team.name).substring(0, 2)}
      </div>
      <span className="text-lg font-semibold text-white">{team.score}</span>
    </div>
  );
}

function CenterBadge({ game, priority, seen }: { game: GameState; priority: number; seen?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${priorityDot(priority)} animate-pulse`} />
      <div className="rounded-xl bg-slate-800/50 px-2 py-1 text-xs font-medium text-white">
        {game.half && game.inning ? `${game.half} ${game.inning}` : game.clockStr || "—"}
      </div>
      {seen && <Check className="h-3 w-3 text-green-400" />}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/20 bg-white/5 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-medium text-white text-xs">{value}</div>
    </div>
  );
}

function BaseDiamond({ bases }: { bases?: BaseState }) {
  const b = bases || { first: false, second: false, third: false };
  return (
    <div className="flex items-center justify-center">
      <div className="relative h-8 w-8 rotate-45 border border-white/30 rounded-sm bg-white/5">
        <span className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full border ${b.second ? "bg-emerald-400 border-emerald-400" : "border-white/30 bg-slate-700"}`} />
        <span className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full border ${b.third ? "bg-emerald-400 border-emerald-400" : "border-white/30 bg-slate-700"}`} />
        <span className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full border ${b.first ? "bg-emerald-400 border-emerald-400" : "border-white/30 bg-slate-700"}`} />
        <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 h-2 w-2 rounded-full bg-slate-600 border border-slate-500" />
      </div>
    </div>
  );
}

function PriorityPill({ value }: { value: number }) {
  return (
    <div className={`rounded-lg px-2 py-1 text-center font-semibold text-xs ${priorityBg(value)}`}>
      {value}
    </div>
  );
}

/* ---------- Helpers ---------- */

function priorityBorder(p: number) {
  if (p >= 70) return "border-red-500";
  if (p >= 40) return "border-amber-500";
  return "border-white/10";
}

function priorityBg(p: number) {
  if (p >= 70) return "bg-red-500/20 text-red-400";
  if (p >= 40) return "bg-amber-500/20 text-amber-400";
  return "bg-white/10 text-slate-300";
}

function priorityDot(p: number) {
  if (p >= 70) return "bg-red-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-gray-400";
}

function inningStr(g: GameState) {
  return g.half && g.inning ? `${g.half.substring(0, 1)}${g.inning}` : "—";
}

function timeShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}