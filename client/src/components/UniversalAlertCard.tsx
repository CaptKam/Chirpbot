import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, TrendingUp, Users, Zap, Target, AlertTriangle, Wind, Cloud, Thermometer, Timer, Hash, Navigation, DollarSign, TrendingDown, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BaseballDiamond, WeatherDisplay } from '@/components/baseball-diamond';
import { getSportTabColors } from '@shared/season-manager';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getDisplayContent } from '@/utils/alert-message';

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

export function UniversalAlertCard({ alert }: { alert: UniversalAlertProps }) {
  // Safe date parsing with fallback
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

  const isPriorityHigh = (alert.priority || 0) >= 80;
  const isConfidenceHigh = (alert.confidence || 0) >= 75;
  const { user, isAuthenticated } = useAuth();

  // Get optimal display content with error handling
  const { content: displayContent, isStructured } = (() => {
    try {
      return getDisplayContent(alert);
    } catch (error) {
      console.warn('Display content error for alert:', alert.id, error);
      return { content: alert.message || 'Alert content unavailable', isStructured: false };
    }
  })();

  // Query user settings for gambling insights preference
  const { data: userSettings } = useQuery({
    queryKey: [`/api/user/${user?.id}/settings/gambling-insights`],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Determine alert urgency level
  const getUrgencyLevel = () => {
    if (alert.priority >= 90) return 'CRITICAL';
    if (alert.priority >= 80) return 'HIGH';
    if (alert.priority >= 60) return 'MEDIUM';
    return 'LOW';
  };

  const urgencyLevel = getUrgencyLevel();

  // Get sport-specific icon and color with static class mappings
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
      icon: '🎯',
      label: sport
    };
  };

  const sportConfig = getSportConfig(alert.sport);

  // Get sport-specific styling - use sport colors as main theme with subtle urgency indicators
  const getSportStyle = () => {
    // Static class mappings to ensure Tailwind includes all classes
    const styleMap: Record<string, { base: string; critical: string; normal: string }> = {
      'MLB': {
        base: 'bg-green-500/5 border-green-500/20',
        critical: 'ring-2 ring-green-500/60',
        normal: 'ring-1 ring-green-500/40'
      },
      'NFL': {
        base: 'bg-orange-500/5 border-orange-500/20',
        critical: 'ring-2 ring-orange-500/60',
        normal: 'ring-1 ring-orange-500/40'
      },
      'NBA': {
        base: 'bg-purple-500/5 border-purple-500/20',
        critical: 'ring-2 ring-purple-500/60',
        normal: 'ring-1 ring-purple-500/40'
      },
      'NHL': {
        base: 'bg-cyan-500/5 border-cyan-500/20',
        critical: 'ring-2 ring-cyan-500/60',
        normal: 'ring-1 ring-cyan-500/40'
      },
      'NCAAF': {
        base: 'bg-blue-500/5 border-blue-500/20',
        critical: 'ring-2 ring-blue-500/60',
        normal: 'ring-1 ring-blue-500/40'
      },
      'CFL': {
        base: 'bg-red-500/5 border-red-500/20',
        critical: 'ring-2 ring-red-500/60',
        normal: 'ring-1 ring-red-500/40'
      },
      'WNBA': {
        base: 'bg-pink-500/5 border-pink-500/20',
        critical: 'ring-2 ring-pink-500/60',
        normal: 'ring-1 ring-pink-500/40'
      }
    };

    const sportStyle = styleMap[alert.sport] || {
      base: 'bg-slate-500/5 border-slate-500/20',
      critical: 'ring-2 ring-slate-500/60',
      normal: 'ring-1 ring-slate-500/40'
    };

    const urgencyRing = urgencyLevel === 'CRITICAL' ? sportStyle.critical : sportStyle.normal;
    return `${sportStyle.base} ${urgencyRing}`;
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
        className={`backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 ${getSportStyle()}`}
        data-testid={`universal-alert-card-${alert.id}`}
      >
        <CardContent className="p-6">
          {/* Primary Alert Header - Clean and Bold */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${sportConfig.iconColor}`}>
                {sportConfig.icon}
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-1" data-testid={`alert-type-${alert.id}`}>
                  {alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL)_/, '').replace(/_/g, ' ')}
                </h3>
                <div className="flex items-center gap-2">
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
                  <span className="text-xs text-slate-400" data-testid={`alert-timestamp-${alert.id}`}>{formattedTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Game Matchup - Clean and Prominent */}
          {alert.homeTeam && alert.awayTeam && (
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-slate-200" data-testid={`teams-${alert.id}`}>
                  {alert.awayTeam} @ {alert.homeTeam}
                </div>
                {(alert.awayScore !== undefined && alert.homeScore !== undefined) && (
                  <div className="flex items-center gap-2 text-2xl font-black text-slate-100" data-testid={`score-${alert.id}`}>
                    <span>{alert.awayScore}</span>
                    <span className="text-slate-500 text-lg">-</span>
                    <span>{alert.homeScore}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Alert Content - Always Structured Format */}
          {displayContent && (
            <div className={`mb-6 rounded-xl p-4 border ${
              isStructured 
                ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/60 border-slate-600/40' 
                : 'bg-slate-800/60 border-slate-700/50'
            }`} data-testid={`alert-content-${alert.id}`}>
              <pre className="text-slate-100 text-sm whitespace-pre-line font-medium leading-relaxed">
                {displayContent}
              </pre>
            </div>
          )}

          {/* Generative AI Enhanced Content */}
        {alert.context?.generativeAI && (
          <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-600 dark:text-purple-400">🤖</span>
              <span className="font-medium text-purple-700 dark:text-purple-300">AI Generated Insights</span>
            </div>

            {/* AI Generated Headline */}
            {alert.context.generativeAI.aiGeneratedContent?.headline && (
              <div className="mb-2">
                <div className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                  {alert.context.generativeAI.aiGeneratedContent.headline}
                </div>
              </div>
            )}

            {/* Predictive Insights */}
            {alert.context.generativeAI.predictiveInsights && (
              <div className="mb-2">
                <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Next Play Prediction:</div>
                <div className="text-sm text-purple-800 dark:text-purple-200">
                  {alert.context.generativeAI.predictiveInsights.nextPlay} 
                  <span className="text-xs text-purple-500 ml-2">
                    ({alert.context.generativeAI.predictiveInsights.probability}% confidence)
                  </span>
                </div>
              </div>
            )}

            {/* Fan Engagement Score */}
            {alert.context.generativeAI.fanEngagement && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span>🔥</span>
                  <span>Excitement: {alert.context.generativeAI.fanEngagement.excitementLevel}/10</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>📺</span>
                  <span>Watchability: {alert.context.generativeAI.fanEngagement.watchabilityScore}%</span>
                </div>
              </div>
            )}
          </div>
        )}

          {/* Game Context - Streamlined and Focused */}
          {alert.context && (
            <div className="mb-5">
              {/* MLB Context */}
              {alert.sport === 'MLB' && (
                <div className="flex items-center justify-between bg-slate-800/40 rounded-lg p-3">
                  <div className="flex items-center gap-4 text-sm text-slate-300">
                    <span className="font-medium">
                      {alert.context.isTopInning ? '▲' : '▼'} {alert.context.inning || 'N/A'}
                    </span>
                    {alert.context.outs !== undefined && (
                      <span>• {alert.context.outs} out{alert.context.outs !== 1 ? 's' : ''}</span>
                    )}
                    {(alert.context.balls !== undefined && alert.context.strikes !== undefined) && (
                      <span className="text-emerald-400 font-mono font-bold">{alert.context.balls}-{alert.context.strikes}</span>
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
              )}

              {/* NFL/CFL/NCAAF Context */}
              {(['NFL', 'CFL', 'NCAAF'].includes(alert.sport)) && (
                <div className="bg-slate-800/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-300 font-medium">Q{alert.context.quarter || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span className="text-slate-400">• {alert.context.timeRemaining}</span>
                    )}
                    {(alert.context.down && alert.context.yardsToGo) && (
                      <span className="text-orange-300 font-bold">
                        {alert.context.down} & {alert.context.yardsToGo}
                      </span>
                    )}
                    {alert.context.yardLine && (
                      <span className="text-slate-400">at {alert.context.yardLine}</span>
                    )}
                  </div>
                  {alert.context.redZone && (
                    <div className="text-red-300 font-medium text-sm">🎯 Red Zone</div>
                  )}
                </div>
              )}

              {/* NBA/WNBA Context */}
              {(['NBA', 'WNBA'].includes(alert.sport)) && (
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-300 font-medium">Q{alert.context.quarter || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span className="text-slate-400">• {alert.context.timeRemaining}</span>
                    )}
                    {alert.context.clutchTime && (
                      <span className="text-yellow-300 font-medium">⚡ Clutch Time</span>
                    )}
                    {alert.context.run && (
                      <span className="text-purple-300 font-medium">{alert.context.run} run</span>
                    )}
                  </div>
                </div>
              )}

              {/* NHL Context */}
              {alert.sport === 'NHL' && (
                <div className="bg-slate-800/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-300 font-medium">Period {alert.context.period || 'N/A'}</span>
                    {alert.context.timeRemaining && (
                      <span className="text-slate-400">• {alert.context.timeRemaining}</span>
                    )}
                  </div>
                  {alert.context.powerPlay && (
                    <div className="text-blue-300 font-medium text-sm">
                      ⚡ Power Play {alert.context.powerPlayTime && `(${alert.context.powerPlayTime})`}
                    </div>
                  )}
                  {alert.context.penalty && (
                    <div className="text-red-300 text-sm">⚠️ {alert.context.penalty}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom Stats Row - Clean and Minimal */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700/30">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <Badge 
                variant="outline" 
                className={`${sportConfig.iconColor} font-semibold text-xs`}
                data-testid={`sport-badge-${alert.sport.toLowerCase()}`}
              >
                {alert.sport}
              </Badge>
              {alert.gamblingInsights?.confidence && (
                <span className="text-slate-300 font-medium">
                  {Math.round(alert.gamblingInsights.confidence * 100)}% Confidence
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {alert.priority != null && (
                <span className={`font-bold ${
                  alert.priority >= 80 ? 'text-orange-300' : 'text-slate-400'
                }`} data-testid={`priority-${alert.id}`}>
                  P{alert.priority}
                </span>
              )}
              {alert.sentToTelegram && (
                <span className="text-blue-300">📱</span>
              )}
              {alert.weather?.temperature && (
                <span className="text-slate-400">{alert.weather.temperature}°F</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}