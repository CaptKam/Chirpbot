import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, TrendingUp, Users, Zap, Target, AlertTriangle, Wind, Cloud, Thermometer, Timer, Hash, Navigation, DollarSign, TrendingDown, Star, Smartphone, Bot, Flame, Tv } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BaseballDiamond, WeatherDisplay } from '@/components/baseball-diamond';

interface UniversalAlertProps {
  id: string;
  type: string;
  message: string;
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  confidence: number;
  priority: number;
  createdAt: string;
  homeScore?: number;
  awayScore?: number;
  context?: any;
  sentToTelegram?: boolean;
  weather?: any;
  gameInfo?: any;
  gamblingInsights?: {
    structuredTemplate?: string;
    bullets?: string[];
    confidence?: number;
    tags?: string[];
    market?: any;
    situation?: any;
  };
  hasComposerEnhancement?: boolean;
}

export function UniversalAlertCard({ alert, showEnhancements = false }: { alert: UniversalAlertProps; showEnhancements?: boolean }) {
  const formattedTime = (() => {
    try {
      if (!alert.createdAt) return 'Unknown';
      const parsed = parseISO(alert.createdAt);
      if (isNaN(parsed.getTime())) return 'Unknown';
      return format(parsed, 'HH:mm');
    } catch (error) {
      console.warn('Date parsing error for alert:', alert.id, error);
      return 'Unknown';
    }
  })();

  const getSportConfig = (sport: string) => {
    const sportConfigs = {
      'MLB': {
        iconColor: 'text-green-500 border-green-500/30 bg-green-500/10',
        icon: '⚾',
        label: 'Baseball'
      },
      'NFL': {
        iconColor: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
        icon: '🏈',
        label: 'Football'
      },
      'NBA': {
        iconColor: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
        icon: '🏀',
        label: 'Basketball'
      },
      'NHL': {
        iconColor: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10',
        icon: '🏒',
        label: 'Hockey'
      },
      'NCAAF': {
        iconColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
        icon: '🏈',
        label: 'College Football'
      },
      'WNBA': {
        iconColor: 'text-pink-500 border-pink-500/30 bg-pink-500/10',
        icon: '🏀',
        label: 'Women\'s Basketball'
      },
      'CFL': {
        iconColor: 'text-red-500 border-red-500/30 bg-red-500/10',
        icon: '🏈',
        label: 'Canadian Football'
      }
    };

    return sportConfigs[sport as keyof typeof sportConfigs] || {
      iconColor: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
      icon: <Target className="w-5 h-5" />,
      label: sport
    };
  };

  const sportConfig = getSportConfig(alert.sport);

  const getGameStateHeader = () => {
    let gamePeriod = '';
    
    if (alert.sport === 'MLB' && alert.context) {
      const inningIndicator = alert.context.isTopInning ? '▲' : '▼';
      const inning = alert.context.inning || '';
      gamePeriod = `${inningIndicator} ${inning}`;
    } else if (['NFL', 'CFL', 'NCAAF'].includes(alert.sport) && alert.context) {
      const quarter = alert.context.quarter ? `Q${alert.context.quarter}` : '';
      const time = alert.context.timeRemaining || '';
      gamePeriod = time ? `${quarter} ${time}` : quarter;
    } else if (['NBA', 'WNBA'].includes(alert.sport) && alert.context) {
      const quarter = alert.context.quarter ? `Q${alert.context.quarter}` : '';
      const time = alert.context.timeRemaining || '';
      gamePeriod = time ? `${quarter} ${time}` : quarter;
    } else if (alert.sport === 'NHL' && alert.context) {
      const period = alert.context.period ? `P${alert.context.period}` : '';
      const time = alert.context.timeRemaining || '';
      gamePeriod = time ? `${period} ${time}` : period;
    }

    const awayName = alert.awayTeam || 'Away';
    const homeName = alert.homeTeam || 'Home';
    const awayScore = alert.awayScore ?? 0;
    const homeScore = alert.homeScore ?? 0;

    return `${gamePeriod} - ${awayName} ${awayScore}, ${homeName} ${homeScore}`;
  };

  const getSituationHeader = () => {
    return alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL|NHL)_/, '').replace(/_/g, ' ');
  };

  const parseContextBullets = () => {
    const bullets: string[] = [];
    
    if (alert.message) {
      const lines = alert.message.split('\n').map(l => l.trim()).filter(l => l);
      lines.forEach(line => {
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          bullets.push(line.replace(/^[•\-*]\s*/, ''));
        } else if (bullets.length === 0) {
          bullets.push(line);
        }
      });
    }
    
    return bullets.length > 0 ? bullets : [alert.message];
  };

  const contextBullets = parseContextBullets();

  const chip = (text: string) => (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-300 border-slate-600/60 bg-slate-800/60">
      {text}
    </span>
  );

  const safeConfidence = Math.max(0, Math.min(100, Math.round((alert.confidence || 0) * 100)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
      whileHover={{ 
        scale: 1.02, 
        transition: { duration: 0.2 } 
      }}
    >
      <Card 
        className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/60 shadow-sm"
        data-testid={`universal-alert-card-${alert.id}`}
      >
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-sm text-slate-400" data-testid={`game-state-${alert.id}`}>
                {getGameStateHeader()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`${sportConfig.iconColor} font-semibold text-xs`}
                data-testid={`sport-badge-${alert.sport.toLowerCase()}`}
              >
                {alert.sport}
              </Badge>
              <span className="text-xs text-slate-500" data-testid={`alert-timestamp-${alert.id}`}>{formattedTime}</span>
            </div>
          </div>

          {/* Situation Badge Row */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${sportConfig.iconColor}`}>
              {sportConfig.icon}
            </div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-100" data-testid={`alert-type-${alert.id}`}>
              {getSituationHeader()}
            </h3>
          </div>

          {/* Context Bullets */}
          <div className="mb-3">
            <div className="rounded-xl p-4 bg-slate-800/60 border border-slate-700/50">
              <div className="space-y-2">
                {contextBullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-slate-100">
                    {contextBullets.length > 1 && <span className="text-amber-400 mt-0.5">🔥</span>}
                    <span className="leading-relaxed">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {alert.sport === 'MLB' && alert.context && (
              <>
                {alert.context.outs !== undefined && chip(`${alert.context.outs} out${alert.context.outs !== 1 ? 's' : ''}`)}
                {(alert.context.balls !== undefined && alert.context.strikes !== undefined) && 
                  chip(`${alert.context.balls}-${alert.context.strikes}`)}
              </>
            )}
            {(['NFL', 'CFL', 'NCAAF'].includes(alert.sport)) && alert.context && (
              <>
                {(alert.context.down && alert.context.yardsToGo) && 
                  chip(`${alert.context.down} & ${alert.context.yardsToGo}`)}
                {alert.context.yardLine && chip(`@ ${alert.context.yardLine}`)}
                {alert.context.redZone && chip('Red Zone')}
              </>
            )}
            {(['NBA', 'WNBA'].includes(alert.sport)) && alert.context && (
              <>
                {alert.context.quarter && chip(`Q${alert.context.quarter}`)}
                {alert.context.clutchTime && chip('Clutch Time')}
                {alert.context.run && chip(`${alert.context.run} run`)}
              </>
            )}
            {alert.sport === 'NHL' && alert.context && (
              <>
                {alert.context.period && chip(`P${alert.context.period}`)}
                {alert.context.powerPlay && chip('Power Play')}
                {alert.context.penalty && chip(alert.context.penalty)}
              </>
            )}
          </div>

          {/* Bottom: Bases/Game State + Confidence */}
          <div className="flex items-center justify-between gap-4">
            {/* MLB Bases Diamond */}
            {alert.sport === 'MLB' && alert.context && (alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird) && (
              <BaseballDiamond 
                size="sm" 
                showCount={false}
                runners={{
                  first: alert.context.hasFirst,
                  second: alert.context.hasSecond,
                  third: alert.context.hasThird
                }}
              />
            )}
            
            {/* Spacer for non-MLB or no runners */}
            {!(alert.sport === 'MLB' && alert.context && (alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird)) && (
              <div className="flex-1" />
            )}

            {/* Confidence Meter */}
            <div className="min-w-[160px]">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Confidence</span>
                <span className="text-slate-200 font-medium">{safeConfidence}%</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-2 rounded bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${safeConfidence}%` }}
                  data-testid={`confidence-bar-${alert.id}`}
                />
              </div>
              {alert.priority != null && (
                <div className="mt-2 text-[10px] font-semibold text-slate-400" data-testid={`priority-${alert.id}`}>
                  P{alert.priority}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
