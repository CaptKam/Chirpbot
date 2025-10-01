import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, TrendingUp, Users, Zap, Target, AlertTriangle, Wind, Cloud, Thermometer, Timer, Hash, Navigation, DollarSign, TrendingDown, Star, Smartphone, Bot, Flame, Tv, ArrowUp, ArrowDown, Minus, ChevronRight } from 'lucide-react';
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
    momentum?: any;
    keyPlayers?: Array<{
      name: string;
      position: string;
      relevance: string;
    }>;
    weather?: {
      impact: string;
      conditions: string;
      severity: 'low' | 'medium' | 'high';
    };
  };
  hasComposerEnhancement?: boolean;
}

export function UniversalAlertCard({ alert, showEnhancements = false }: { alert: UniversalAlertProps; showEnhancements?: boolean }) {
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

  const displayContent = alert.message || 'Alert content unavailable';

  // Helper function to generate game state header
  const getGameStateHeader = () => {
    const parts = [];
    
    // Add game time/period based on sport
    if (alert.sport === 'MLB' && alert.context) {
      const inningIndicator = alert.context.isTopInning ? '▲' : '▼';
      const inning = alert.context.inning || 'N/A';
      parts.push(`${inningIndicator} ${inning}`);
    } else if (['NFL', 'CFL', 'NCAAF'].includes(alert.sport) && alert.context) {
      const quarter = alert.context.quarter ? `Q${alert.context.quarter}` : 'N/A';
      const time = alert.context.timeRemaining || '';
      parts.push(time ? `${quarter} ${time}` : quarter);
    } else if (['NBA', 'WNBA'].includes(alert.sport) && alert.context) {
      const quarter = alert.context.quarter ? `Q${alert.context.quarter}` : 'N/A';
      const time = alert.context.timeRemaining || '';
      parts.push(time ? `${quarter} ${time}` : quarter);
    } else if (alert.sport === 'NHL' && alert.context) {
      const period = alert.context.period ? `P${alert.context.period}` : 'N/A';
      const time = alert.context.timeRemaining || '';
      parts.push(time ? `${period} ${time}` : period);
    }

    // Add score if available
    if (alert.awayScore !== undefined && alert.homeScore !== undefined) {
      const awayTeamShort = alert.awayTeam || 'Away';
      const homeTeamShort = alert.homeTeam || 'Home';
      parts.push(`${awayTeamShort} ${alert.awayScore} - ${alert.homeScore} ${homeTeamShort}`);
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  const gameStateHeader = getGameStateHeader();

  // Get sport-specific icon and color with static class mappings
  const getSportConfig = (sport: string) => {
    const sportConfigs = {
      'MLB': {
        iconColor: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        gradientFrom: 'from-green-500/10',
        gradientTo: 'to-green-500/5',
        accentColor: 'bg-green-500',
        icon: '⚾',
        label: 'Baseball'
      },
      'NFL': {
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        gradientFrom: 'from-orange-500/10',
        gradientTo: 'to-orange-500/5',
        accentColor: 'bg-orange-500',
        icon: '🏈',
        label: 'Football'
      },
      'NBA': {
        iconColor: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        gradientFrom: 'from-purple-500/10',
        gradientTo: 'to-purple-500/5',
        accentColor: 'bg-purple-500',
        icon: '🏀',
        label: 'Basketball'
      },
      'NHL': {
        iconColor: 'text-cyan-500',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
        gradientFrom: 'from-cyan-500/10',
        gradientTo: 'to-cyan-500/5',
        accentColor: 'bg-cyan-500',
        icon: '🏒',
        label: 'Hockey'
      },
      'NCAAF': {
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        gradientFrom: 'from-blue-500/10',
        gradientTo: 'to-blue-500/5',
        accentColor: 'bg-blue-500',
        icon: '🏈',
        label: 'College Football'
      },
      'WNBA': {
        iconColor: 'text-pink-500',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/30',
        gradientFrom: 'from-pink-500/10',
        gradientTo: 'to-pink-500/5',
        accentColor: 'bg-pink-500',
        icon: '🏀',
        label: 'Women\'s Basketball'
      },
      'CFL': {
        iconColor: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        gradientFrom: 'from-red-500/10',
        gradientTo: 'to-red-500/5',
        accentColor: 'bg-red-500',
        icon: '🏈',
        label: 'Canadian Football'
      }
    };

    return sportConfigs[sport as keyof typeof sportConfigs] || {
      iconColor: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      gradientFrom: 'from-slate-500/10',
      gradientTo: 'to-slate-500/5',
      accentColor: 'bg-slate-500',
      icon: <Target className="w-5 h-5" />,
      label: sport
    };
  };

  const sportConfig = getSportConfig(alert.sport);

  // Get momentum trend icon
  const getMomentumIcon = (trend?: string) => {
    if (trend === 'positive') return <ArrowUp className="w-3 h-3" />;
    if (trend === 'negative') return <ArrowDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  // Calculate confidence percentage - handle both decimal (0-1) and percentage (0-100) formats
  const confidencePercent = (() => {
    const conf = alert.confidence || 0;
    // If already a percentage (>1), clamp it to 0-100
    if (conf > 1) return Math.min(100, Math.max(0, Math.round(conf)));
    // If decimal (0-1), convert to percentage
    return Math.round(conf * 100);
  })();

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
        className={`relative backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 border overflow-hidden ${sportConfig.borderColor} bg-slate-900/50`}
        data-testid={`universal-alert-card-${alert.id}`}
      >
        {/* Sport Color Accent Bar */}
        <div className={`h-1 ${sportConfig.accentColor}`} />
        
        {/* Gradient Background Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${sportConfig.gradientFrom} ${sportConfig.gradientTo} pointer-events-none opacity-50`} />
        
        <CardContent className="p-5 relative">
          {/* Header: Sport Icon, Type, Time, Priority */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${sportConfig.bgColor} ${sportConfig.borderColor} border-2`}>
                {sportConfig.icon}
              </div>
              <div className="flex-1">
                <h3 className={`text-base font-black uppercase tracking-wide mb-1 ${sportConfig.iconColor}`} data-testid={`alert-type-${alert.id}`}>
                  {alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL|NHL)_/, '').replace(/_/g, ' ')}
                </h3>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400" data-testid={`alert-timestamp-${alert.id}`}>{formattedTime}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alert.priority != null && (
                <Badge variant="outline" className="text-xs font-bold text-slate-300 border-slate-600" data-testid={`priority-${alert.id}`}>
                  P{alert.priority}
                </Badge>
              )}
              {alert.sentToTelegram && (
                <div className={`p-1.5 rounded-lg ${sportConfig.bgColor}`}>
                  <Smartphone className={`w-4 h-4 ${sportConfig.iconColor}`} />
                </div>
              )}
            </div>
          </div>

          {/* Game State Header - Prominent Score Display */}
          {gameStateHeader && (
            <div className={`mb-4 p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
              <div className="text-base font-bold text-slate-100 text-center" data-testid={`game-state-${alert.id}`}>
                {gameStateHeader}
              </div>
            </div>
          )}

          {/* Main Alert Message with AI Badge */}
          <div className={`mb-4 rounded-xl p-4 border ${sportConfig.borderColor} bg-slate-800/80`} data-testid={`alert-content-${alert.id}`}>
            {(alert.hasComposerEnhancement || alert.context?.generativeAI) && (
              <div className="flex items-center gap-2 mb-2">
                <Bot className={`w-4 h-4 ${sportConfig.iconColor}`} />
                <span className={`text-xs font-semibold ${sportConfig.iconColor} uppercase tracking-wide`}>AI Enhanced</span>
              </div>
            )}
            <div className="text-slate-100 text-sm font-medium leading-relaxed">
              {displayContent}
            </div>
          </div>

          {/* AI Prediction Insights - Highlighted */}
          {alert.context?.generativeAI?.predictiveInsights && (
            <div className={`mb-4 p-4 rounded-xl border-2 ${sportConfig.borderColor} ${sportConfig.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${sportConfig.iconColor}`} />
                  <span className={`text-sm font-bold ${sportConfig.iconColor}`}>AI Prediction</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`px-2 py-1 rounded-full ${sportConfig.accentColor} text-white text-xs font-bold`}>
                    {alert.context.generativeAI.predictiveInsights.probability}%
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-200 font-medium">
                {alert.context.generativeAI.predictiveInsights.nextPlay}
              </div>
            </div>
          )}

          {/* AI Generated Headline */}
          {alert.context?.generativeAI?.aiGeneratedContent?.headline && (
            <div className={`mb-4 p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className={`w-3 h-3 ${sportConfig.iconColor}`} />
                <span className="text-xs font-semibold text-slate-300">AI Headline</span>
              </div>
              <div className="text-sm text-slate-100 font-semibold">
                {alert.context.generativeAI.aiGeneratedContent.headline}
              </div>
            </div>
          )}

          {/* Fan Engagement Metrics */}
          {alert.context?.generativeAI?.fanEngagement && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Flame className={`w-4 h-4 ${sportConfig.iconColor}`} />
                  <span className="text-xs font-medium text-slate-300">Excitement</span>
                </div>
                <div className="text-lg font-bold text-slate-100">
                  {alert.context.generativeAI.fanEngagement.excitementLevel}/10
                </div>
              </div>
              <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Tv className={`w-4 h-4 ${sportConfig.iconColor}`} />
                  <span className="text-xs font-medium text-slate-300">Watchability</span>
                </div>
                <div className="text-lg font-bold text-slate-100">
                  {alert.context.generativeAI.fanEngagement.watchabilityScore}%
                </div>
              </div>
            </div>
          )}

          {/* Betting Insights Section */}
          {alert.gamblingInsights && (
            <div className="mb-4 space-y-3">
              {/* Market Data */}
              {alert.gamblingInsights.market && (
                <div className={`p-4 rounded-xl border ${sportConfig.borderColor} bg-slate-800/60`}>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className={`w-4 h-4 ${sportConfig.iconColor}`} />
                    <span className={`text-sm font-bold ${sportConfig.iconColor}`}>Betting Lines</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {alert.gamblingInsights.market.spread && (
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Spread</div>
                        <div className="text-sm font-bold text-slate-100">
                          {alert.gamblingInsights.market.spread.points > 0 ? '+' : ''}{alert.gamblingInsights.market.spread.points}
                        </div>
                      </div>
                    )}
                    {alert.gamblingInsights.market.total && (
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Total</div>
                        <div className="text-sm font-bold text-slate-100">
                          {alert.gamblingInsights.market.total.points}
                        </div>
                      </div>
                    )}
                    {alert.gamblingInsights.market.moneyline && (
                      <div>
                        <div className="text-xs text-slate-400 mb-1">ML</div>
                        <div className="text-sm font-bold text-slate-100">
                          {alert.gamblingInsights.market.moneyline.home}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Key Players */}
              {alert.gamblingInsights.keyPlayers && alert.gamblingInsights.keyPlayers.length > 0 && (
                <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className={`w-4 h-4 ${sportConfig.iconColor}`} />
                    <span className="text-xs font-semibold text-slate-300">Key Players</span>
                  </div>
                  <div className="space-y-2">
                    {alert.gamblingInsights.keyPlayers.map((player, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-slate-400 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-200">
                            {player.name} <span className="text-xs text-slate-400">({player.position})</span>
                          </div>
                          <div className="text-xs text-slate-400">{player.relevance}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Momentum */}
              {alert.gamblingInsights.momentum && (
                <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${sportConfig.iconColor}`} />
                      <span className="text-xs font-semibold text-slate-300">Momentum</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getMomentumIcon(alert.gamblingInsights.momentum.trend)}
                      <span className={`text-xs font-medium ${
                        alert.gamblingInsights.momentum.trend === 'positive' ? 'text-green-400' :
                        alert.gamblingInsights.momentum.trend === 'negative' ? 'text-red-400' :
                        'text-slate-400'
                      }`}>
                        {alert.gamblingInsights.momentum.trend}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 mt-2">{alert.gamblingInsights.momentum.recent}</div>
                </div>
              )}

              {/* Situation Context */}
              {alert.gamblingInsights.situation && (
                <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-4 h-4 ${sportConfig.iconColor}`} />
                    <span className="text-xs font-semibold text-slate-300">Situation</span>
                  </div>
                  <div className="text-sm text-slate-200 mb-1">{alert.gamblingInsights.situation.context}</div>
                  <div className="text-xs text-slate-400">{alert.gamblingInsights.situation.significance}</div>
                </div>
              )}

              {/* Betting Bullets */}
              {alert.gamblingInsights.bullets && alert.gamblingInsights.bullets.length > 0 && (
                <div className={`p-3 rounded-lg bg-slate-800/60 border ${sportConfig.borderColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className={`w-4 h-4 ${sportConfig.iconColor}`} />
                    <span className="text-xs font-semibold text-slate-300">Key Factors</span>
                  </div>
                  <ul className="space-y-1.5">
                    {alert.gamblingInsights.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className={`${sportConfig.iconColor} font-bold mt-0.5`}>•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weather Impact */}
              {alert.gamblingInsights.weather && (
                <div className={`p-3 rounded-lg ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cloud className={`w-4 h-4 ${sportConfig.iconColor}`} />
                      <span className="text-xs font-semibold text-slate-300">Weather Impact</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        alert.gamblingInsights.weather.severity === 'high' ? 'border-red-500 text-red-400' :
                        alert.gamblingInsights.weather.severity === 'medium' ? 'border-yellow-500 text-yellow-400' :
                        'border-slate-500 text-slate-400'
                      }`}
                    >
                      {alert.gamblingInsights.weather.severity}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 mb-1">{alert.gamblingInsights.weather.conditions}</div>
                  <div className="text-xs text-slate-400">{alert.gamblingInsights.weather.impact}</div>
                </div>
              )}

              {/* Tags */}
              {alert.gamblingInsights.tags && alert.gamblingInsights.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {alert.gamblingInsights.tags.map((tag, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline"
                      className={`text-xs ${sportConfig.iconColor} ${sportConfig.borderColor}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Game Context - Sport-Specific */}
          {alert.context && (
            <div className="mb-4">
              {/* MLB Context */}
              {alert.sport === 'MLB' && (
                <div className={`rounded-lg p-3 ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      {alert.context.outs !== undefined && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Outs</div>
                          <div className="text-base font-bold text-slate-100">{alert.context.outs}</div>
                        </div>
                      )}
                      {(alert.context.balls !== undefined && alert.context.strikes !== undefined) && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Count</div>
                          <div className={`text-base font-bold ${sportConfig.iconColor} font-mono`}>
                            {alert.context.balls}-{alert.context.strikes}
                          </div>
                        </div>
                      )}
                    </div>
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
                <div className={`rounded-lg p-3 ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {(alert.context.down && alert.context.yardsToGo) && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Down & Distance</div>
                          <div className={`text-base font-bold ${sportConfig.iconColor}`}>
                            {alert.context.down} & {alert.context.yardsToGo}
                          </div>
                        </div>
                      )}
                      {alert.context.yardLine && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Field Position</div>
                          <div className="text-base font-bold text-slate-100">{alert.context.yardLine}</div>
                        </div>
                      )}
                    </div>
                    {alert.context.redZone && (
                      <Badge variant="outline" className="border-red-500 text-red-400 font-bold">
                        Red Zone
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* NBA/WNBA Context */}
              {(['NBA', 'WNBA'].includes(alert.sport)) && (
                <div className={`rounded-lg p-3 ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  <div className="flex items-center gap-4">
                    {alert.context.clutchTime && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-400 font-bold">
                        <Zap className="w-3 h-3 mr-1" /> Clutch Time
                      </Badge>
                    )}
                    {alert.context.run && (
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Scoring Run</div>
                        <div className={`text-base font-bold ${sportConfig.iconColor}`}>{alert.context.run}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NHL Context */}
              {alert.sport === 'NHL' && (
                <div className={`rounded-lg p-3 ${sportConfig.bgColor} border ${sportConfig.borderColor}`}>
                  {alert.context.powerPlay && (
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-bold text-blue-400">
                        Power Play {alert.context.powerPlayTime && `(${alert.context.powerPlayTime})`}
                      </span>
                    </div>
                  )}
                  {alert.context.penalty && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">{alert.context.penalty}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer: Confidence Badge and Metadata */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={`${sportConfig.iconColor} ${sportConfig.borderColor} font-bold text-xs`}
                data-testid={`sport-badge-${alert.sport.toLowerCase()}`}
              >
                {alert.sport}
              </Badge>
            </div>

            {/* Confidence Indicator */}
            {confidencePercent > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={`relative w-10 h-10 rounded-full ${sportConfig.bgColor} border-2 ${sportConfig.borderColor} flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${sportConfig.iconColor}`}>
                      {confidencePercent}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Confidence</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
