import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, TrendingUp, Users, Zap, Target, AlertTriangle, Wind, Cloud, Thermometer, Timer, Hash, Navigation } from 'lucide-react';
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
}

export function UniversalAlertCard({ alert }: { alert: UniversalAlertProps }) {
  const formattedTime = format(parseISO(alert.createdAt), 'HH:mm');
  const isPriorityHigh = alert.priority >= 80;
  const isConfidenceHigh = alert.confidence >= 75;
  
  // Determine alert urgency level
  const getUrgencyLevel = () => {
    if (alert.priority >= 90) return 'CRITICAL';
    if (alert.priority >= 80) return 'HIGH';
    if (alert.priority >= 60) return 'MEDIUM';
    return 'LOW';
  };

  const urgencyLevel = getUrgencyLevel();

  // Get sport-specific icon and color
  const getSportConfig = (sport: string) => {
    switch (sport) {
      case 'MLB':
        return { 
          color: 'text-green-400 border-green-500/30 bg-green-500/10',
          icon: '⚾',
          label: 'Baseball'
        };
      case 'NFL':
        return { 
          color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
          icon: '🏈',
          label: 'Football'
        };
      case 'NBA':
        return { 
          color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
          icon: '🏀',
          label: 'Basketball'
        };
      case 'NHL':
        return { 
          color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
          icon: '🏒',
          label: 'Hockey'
        };
      case 'NCAAF':
        return { 
          color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
          icon: '🏈',
          label: 'College Football'
        };
      case 'WNBA':
        return { 
          color: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
          icon: '🏀',
          label: 'Women\'s Basketball'
        };
      case 'CFL':
        return { 
          color: 'text-red-400 border-red-500/30 bg-red-500/10',
          icon: '🏈',
          label: 'Canadian Football'
        };
      default:
        return { 
          color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
          icon: '🎯',
          label: sport
        };
    }
  };

  const sportConfig = getSportConfig(alert.sport);

  // Get urgency styling
  const getUrgencyStyle = () => {
    switch (urgencyLevel) {
      case 'CRITICAL':
        return 'ring-2 ring-red-500/50 bg-red-500/5 border-red-500/20';
      case 'HIGH':
        return 'ring-1 ring-orange-500/40 bg-orange-500/5 border-orange-500/20';
      case 'MEDIUM':
        return 'ring-1 ring-yellow-500/40 bg-yellow-500/5 border-yellow-500/20';
      default:
        return 'ring-1 ring-slate-500/20 bg-slate-500/5 border-slate-500/20';
    }
  };

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
        className={`backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 ${getUrgencyStyle()}`}
        data-testid={`universal-alert-card-${alert.id}`}
      >
        <CardContent className="p-5">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${sportConfig.color}`}>
                {sportConfig.icon}
              </div>
              <div>
                <Badge 
                  variant="outline" 
                  className={`${sportConfig.color} font-semibold text-xs`}
                  data-testid={`sport-badge-${alert.sport.toLowerCase()}`}
                >
                  {alert.sport}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-3 h-3" />
              <span data-testid={`alert-timestamp-${alert.id}`}>{formattedTime}</span>
            </div>
          </div>

          {/* Alert Type and Priority */}
          <div className="flex items-center gap-2 mb-3">
            <Badge 
              variant="secondary" 
              className="bg-slate-700/50 text-slate-200 border-slate-600/50 text-xs"
              data-testid={`alert-type-${alert.id}`}
            >
              {alert.type.replace(/_/g, ' ')}
            </Badge>
            <Badge 
              variant="outline"
              className={`text-xs font-bold ${
                urgencyLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                urgencyLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                urgencyLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                'bg-slate-500/20 text-slate-300 border-slate-500/40'
              }`}
              data-testid={`urgency-badge-${alert.id}`}
            >
              {urgencyLevel}
            </Badge>
          </div>

          {/* Teams and Score */}
          {alert.homeTeam && alert.awayTeam && (
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-200 font-medium text-sm" data-testid={`teams-${alert.id}`}>
                    {alert.awayTeam} @ {alert.homeTeam}
                  </span>
                </div>
                {(alert.awayScore !== undefined && alert.homeScore !== undefined) && (
                  <div className="flex items-center gap-1 text-slate-300 font-bold text-sm" data-testid={`score-${alert.id}`}>
                    <span>{alert.awayScore}</span>
                    <span className="text-slate-500">-</span>
                    <span>{alert.homeScore}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alert Message */}
          <div className="mb-4">
            <p className="text-slate-100 text-sm leading-relaxed font-medium" data-testid={`alert-message-${alert.id}`}>
              {alert.message}
            </p>
          </div>

          {/* Sport-Specific Context Information */}
          {alert.context && (
            <div className="mb-4 space-y-3">
              {/* MLB Context */}
              {alert.sport === 'MLB' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Target className="w-3 h-3" />
                      <span>
                        {alert.context.isTopInning ? '▲' : '▼'} {alert.context.inning || 'N/A'}
                        {alert.context.outs !== undefined && (
                          <span className="ml-2">• {alert.context.outs} out{alert.context.outs !== 1 ? 's' : ''}</span>
                        )}
                      </span>
                      {(alert.context.balls !== undefined && alert.context.strikes !== undefined) && (
                        <span className="ml-2 text-emerald-400 font-mono">{alert.context.balls}-{alert.context.strikes}</span>
                      )}
                    </div>
                    {/* Baseball Diamond for base runners */}
                    {(alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird) && (
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
                  </div>
                </div>
              )}

              {/* NFL/CFL/NCAAF Context */}
              {(['NFL', 'CFL', 'NCAAF'].includes(alert.sport)) && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Q{alert.context.quarter || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span>• {alert.context.timeRemaining}</span>
                    )}
                  </div>
                  {(alert.context.down && alert.context.yardsToGo) && (
                    <div className="flex items-center gap-2 text-xs">
                      <Hash className="w-3 h-3 text-orange-400" />
                      <span className="text-orange-300 font-medium">
                        {alert.context.down} & {alert.context.yardsToGo}
                      </span>
                      {alert.context.yardLine && (
                        <span className="text-slate-400">at {alert.context.yardLine}</span>
                      )}
                    </div>
                  )}
                  {alert.context.redZone && (
                    <div className="flex items-center gap-1 text-xs">
                      <Target className="w-3 h-3 text-red-400" />
                      <span className="text-red-300 font-medium">Red Zone</span>
                    </div>
                  )}
                  {alert.context.possession && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Navigation className="w-3 h-3" />
                      <span>{alert.context.possession} possession</span>
                    </div>
                  )}
                </div>
              )}

              {/* NBA/WNBA Context */}
              {(['NBA', 'WNBA'].includes(alert.sport)) && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Q{alert.context.quarter || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span>• {alert.context.timeRemaining}</span>
                    )}
                  </div>
                  {alert.context.clutchTime && (
                    <div className="flex items-center gap-1 text-xs">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-300 font-medium">Clutch Time</span>
                    </div>
                  )}
                  {alert.context.run && (
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-300">{alert.context.run} run</span>
                    </div>
                  )}
                </div>
              )}

              {/* NHL Context */}
              {alert.sport === 'NHL' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Timer className="w-3 h-3" />
                    <span>Period {alert.context.period || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span>• {alert.context.timeRemaining}</span>
                    )}
                  </div>
                  {alert.context.powerPlay && (
                    <div className="flex items-center gap-1 text-xs">
                      <Zap className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-300 font-medium">Power Play</span>
                      {alert.context.powerPlayTime && (
                        <span className="text-slate-400">({alert.context.powerPlayTime})</span>
                      )}
                    </div>
                  )}
                  {alert.context.penalty && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-red-300">{alert.context.penalty}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Section */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
            <div className="flex items-center gap-3">
              {alert.confidence != null && (
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className={`w-3 h-3 ${isConfidenceHigh ? 'text-green-400' : 'text-yellow-400'}`} />
                  <span className={isConfidenceHigh ? 'text-green-300' : 'text-yellow-300'} data-testid={`confidence-${alert.id}`}>
                    {alert.confidence}%
                  </span>
                </div>
              )}
              {alert.priority != null && (
                <div className="flex items-center gap-1 text-xs">
                  <Zap className={`w-3 h-3 ${isPriorityHigh ? 'text-orange-400' : 'text-slate-400'}`} />
                  <span className={isPriorityHigh ? 'text-orange-300' : 'text-slate-400'} data-testid={`priority-${alert.id}`}>
                    P{alert.priority}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {alert.sentToTelegram && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                  📱 Sent
                </Badge>
              )}
              {alert.weather && (
                <div className="flex items-center gap-1">
                  {(alert.weather.windDescription || alert.weather.windSpeed || alert.weather.temperature) && (
                    <WeatherDisplay
                      size="sm"
                      windSpeed={alert.weather.windSpeed}
                      windDirection={alert.weather.windDirection}
                      windGust={alert.weather.windGust}
                      temperature={alert.weather.temperature}
                      stadiumWindContext={alert.weather.windDescription || alert.weather.condition}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}