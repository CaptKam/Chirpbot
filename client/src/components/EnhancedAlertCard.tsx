import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, TrendingUp, Zap, Target, DollarSign, Star, Brain, Trophy, Wind, Eye } from 'lucide-react';
// Removed date-fns dependency for better compatibility

// Enhanced interface with proper AI payload typing
interface EnhancedAlertCardProps {
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
  weather?: {
    impact?: string;
    conditions?: string;
    temperature?: number;
    condition?: string;
    windSpeed?: number;
    windDirection?: string;
  };
  gameInfo?: any;
  gamblingInsights?: {
    bullets?: string[];
    confidence?: number;
    odds?: {
      home?: number;
      away?: number;
      total?: number;
      spread?: number;
    };
    market?: any;
    situation?: any;
    weather?: {
      impact?: string;
      conditions?: string;
      severity?: 'low' | 'medium' | 'high';
    };
  };
  payload?: {
    headline?: string;
    action?: {
      primaryAction?: string;
      confidence?: number;
      reasoning?: string[];
    };
    prediction?: {
      nextCriticalMoment?: string;
      probability?: number;
      keyFactors?: string[];
    };
    weather?: {
      impact?: string;
      conditions?: string;
      temperature?: number;
    };
  };
}

export function EnhancedAlertCard({ alert }: { alert: EnhancedAlertCardProps }) {
  // DEBUG: Log component rendering to verify it's being called
  console.log('🎯 EnhancedAlertCard rendering alert:', {
    id: alert.id,
    type: alert.type,
    sport: alert.sport,
    hasPayload: !!alert.payload,
    hasGamblingInsights: !!alert.gamblingInsights,
    headline: alert.payload?.headline,
    action: alert.payload?.action?.primaryAction
  });
  
  // Safe date parsing with fallback using native Date constructor
  const formattedTime = (() => {
    try {
      if (!alert.createdAt) return 'Unknown';
      
      // Try parsing with native Date constructor - more tolerant than parseISO
      let parsed;
      if (typeof alert.createdAt === 'string') {
        // Handle various timestamp formats
        parsed = new Date(alert.createdAt);
      } else {
        parsed = new Date();
      }
      
      if (isNaN(parsed.getTime())) {
        console.warn('Invalid date for alert:', alert.id, alert.createdAt);
        return 'Unknown';
      }
      
      // Format time as HH:mm using native methods
      return parsed.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    } catch (error) {
      console.warn('Date parsing error for alert:', alert.id, error);
      return 'Unknown';
    }
  })();

  // Get sport-specific icon and color configurations
  const getSportConfig = (sport: string) => {
    const sportConfigs = {
      'MLB': {
        iconColor: 'text-green-500 border-green-500/30 bg-green-500/10',
        icon: '⚾',
        label: 'Baseball',
        gradientFrom: 'from-green-500/20',
        gradientTo: 'to-emerald-500/10',
        accentColor: 'text-green-400'
      },
      'NFL': {
        iconColor: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
        icon: '🏈',
        label: 'Football',
        gradientFrom: 'from-orange-500/20',
        gradientTo: 'to-red-500/10',
        accentColor: 'text-orange-400'
      },
      'NBA': {
        iconColor: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
        icon: '🏀',
        label: 'Basketball',
        gradientFrom: 'from-purple-500/20',
        gradientTo: 'to-blue-500/10',
        accentColor: 'text-purple-400'
      },
      'NHL': {
        iconColor: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10',
        icon: '🏒',
        label: 'Hockey',
        gradientFrom: 'from-cyan-500/20',
        gradientTo: 'to-blue-500/10',
        accentColor: 'text-cyan-400'
      },
      'NCAAF': {
        iconColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
        icon: '🏈',
        label: 'College Football',
        gradientFrom: 'from-blue-500/20',
        gradientTo: 'to-indigo-500/10',
        accentColor: 'text-blue-400'
      },
      'WNBA': {
        iconColor: 'text-pink-500 border-pink-500/30 bg-pink-500/10',
        icon: '🏀',
        label: 'Women\'s Basketball',
        gradientFrom: 'from-pink-500/20',
        gradientTo: 'to-purple-500/10',
        accentColor: 'text-pink-400'
      },
      'CFL': {
        iconColor: 'text-red-500 border-red-500/30 bg-red-500/10',
        icon: '🏈',
        label: 'Canadian Football',
        gradientFrom: 'from-red-500/20',
        gradientTo: 'to-orange-500/10',
        accentColor: 'text-red-400'
      }
    };

    return sportConfigs[sport as keyof typeof sportConfigs] || {
      iconColor: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
      icon: '🎯',
      label: sport,
      gradientFrom: 'from-slate-500/20',
      gradientTo: 'to-gray-500/10',
      accentColor: 'text-slate-400'
    };
  };

  const sportConfig = getSportConfig(alert.sport);

  // Get sport-specific card styling
  const getSportStyle = () => {
    const styleMap: Record<string, { base: string; ring: string }> = {
      'MLB': {
        base: 'bg-gradient-to-br from-green-900/20 via-slate-900/80 to-emerald-900/20 border-green-500/20',
        ring: 'ring-2 ring-green-500/30'
      },
      'NFL': {
        base: 'bg-gradient-to-br from-orange-900/20 via-slate-900/80 to-red-900/20 border-orange-500/20',
        ring: 'ring-2 ring-orange-500/30'
      },
      'NBA': {
        base: 'bg-gradient-to-br from-purple-900/20 via-slate-900/80 to-blue-900/20 border-purple-500/20',
        ring: 'ring-2 ring-purple-500/30'
      },
      'NHL': {
        base: 'bg-gradient-to-br from-cyan-900/20 via-slate-900/80 to-blue-900/20 border-cyan-500/20',
        ring: 'ring-2 ring-cyan-500/30'
      },
      'NCAAF': {
        base: 'bg-gradient-to-br from-blue-900/20 via-slate-900/80 to-indigo-900/20 border-blue-500/20',
        ring: 'ring-2 ring-blue-500/30'
      },
      'CFL': {
        base: 'bg-gradient-to-br from-red-900/20 via-slate-900/80 to-orange-900/20 border-red-500/20',
        ring: 'ring-2 ring-red-500/30'
      },
      'WNBA': {
        base: 'bg-gradient-to-br from-pink-900/20 via-slate-900/80 to-purple-900/20 border-pink-500/20',
        ring: 'ring-2 ring-pink-500/30'
      }
    };

    const sportStyle = styleMap[alert.sport] || {
      base: 'bg-gradient-to-br from-slate-900/20 via-slate-900/80 to-gray-900/20 border-slate-500/20',
      ring: 'ring-2 ring-slate-500/30'
    };

    return `${sportStyle.base} ${sportStyle.ring}`;
  };

  // Enhanced weather data with comprehensive fallback logic
  const getWeatherData = () => {
    // Priority order: payload.weather -> gamblingInsights.weather -> alert.weather -> alert.context.weather
    const payloadWeather = alert.payload?.weather;
    const gamblingWeather = alert.gamblingInsights?.weather;
    const alertWeather = alert.weather;
    const contextWeather = alert.context?.weather;
    
    const impact = payloadWeather?.impact || 
                   gamblingWeather?.impact || 
                   alertWeather?.impact;
    
    const conditions = payloadWeather?.conditions || 
                      gamblingWeather?.conditions || 
                      alertWeather?.conditions || 
                      alertWeather?.condition || 
                      contextWeather?.condition;
    
    const temperature = payloadWeather?.temperature || 
                       alertWeather?.temperature || 
                       contextWeather?.temperature;
    
    return { impact, conditions, temperature };
  };
  
  const weatherData = getWeatherData();
  
  // Safe confidence calculation for both 0-1 and 0-100 scales
  const getSafeConfidence = (confidence: number | undefined) => {
    if (confidence === undefined || confidence === null) return null;
    
    // If confidence is already > 1, assume it's already in percentage (0-100)
    if (confidence > 1) {
      return Math.round(Math.min(confidence, 100)); // Cap at 100
    }
    
    // If confidence is 0-1, convert to percentage
    return Math.round(confidence * 100);
  };
  
  // Check if we have AI-enhanced content
  const hasAIContent = !!(
    alert.payload?.headline ||
    alert.payload?.action?.primaryAction ||
    alert.gamblingInsights?.bullets?.length ||
    alert.payload?.prediction?.nextCriticalMoment ||
    alert.gamblingInsights?.confidence ||
    alert.gamblingInsights?.odds ||
    weatherData.impact || weatherData.conditions ||
    alert.payload?.action?.reasoning?.length
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 15 }}
      whileHover={{ 
        scale: 1.02, 
        y: -5,
        transition: { duration: 0.3, type: "spring", stiffness: 200 } 
      }}
    >
      <Card 
        className={`backdrop-blur-lg rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 border-0 ${getSportStyle()} relative overflow-hidden`}
        data-testid={`enhanced-alert-card-${alert.id}`}
      >
        {/* AI Enhancement Indicator */}
        {hasAIContent && (
          <div className="absolute top-4 right-4 z-10">
            <Badge 
              className={`${sportConfig.iconColor} animate-pulse`}
              data-testid={`ai-badge-${alert.id}`}
            >
              <Brain className="w-3 h-3 mr-1" />
              AI Enhanced
            </Badge>
          </div>
        )}

        <CardContent className="p-7 min-h-[280px]">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${sportConfig.iconColor} shadow-lg`}>
                {sportConfig.icon}
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-wider text-slate-100 mb-2" data-testid={`enhanced-alert-type-${alert.id}`}>
                  {alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL)_/, '').replace(/_/g, ' ')}
                </h3>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline"
                    className={`text-xs font-bold bg-slate-800/60 ${sportConfig.accentColor} border-slate-600/50`}
                    data-testid={`enhanced-urgency-badge-${alert.id}`}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    LIVE ALERT
                  </Badge>
                  <span className="text-xs text-slate-400" data-testid={`enhanced-alert-timestamp-${alert.id}`}>{formattedTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI-Enhanced Headline - Priority 1 */}
          {alert.payload?.headline && (
            <div className="mb-6" data-testid={`ai-headline-${alert.id}`}>
              <div className={`p-5 rounded-2xl bg-gradient-to-r ${sportConfig.gradientFrom} ${sportConfig.gradientTo} border border-slate-700/50 backdrop-blur-sm`}>
                <div className="flex items-start gap-3">
                  <Star className={`w-5 h-5 ${sportConfig.accentColor} flex-shrink-0 mt-1`} />
                  <div className="text-lg font-bold text-slate-100 leading-relaxed">
                    {alert.payload.headline}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Game Matchup with Enhanced Styling */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-slate-800/40 rounded-xl p-4 backdrop-blur-sm border border-slate-700/30">
              <div className="text-lg font-bold text-slate-200" data-testid={`enhanced-teams-${alert.id}`}>
                {(alert.awayTeam || "Unknown") + " @ " + (alert.homeTeam || "Unknown")}
              </div>
              {(alert.awayScore !== undefined && alert.homeScore !== undefined) && (
                <div className="flex items-center gap-2 text-3xl font-black text-slate-100" data-testid={`enhanced-score-${alert.id}`}>
                  <span>{alert.awayScore}</span>
                  <span className="text-slate-500 text-xl">-</span>
                  <span>{alert.homeScore}</span>
                </div>
              )}
            </div>
          </div>

          {/* Primary Action - Priority 2 */}
          {alert.payload?.action?.primaryAction && (
            <div className="mb-6" data-testid={`ai-primary-action-${alert.id}`}>
              <div className="p-5 bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-2xl border border-amber-800/40">
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-amber-300 text-sm font-semibold mb-1">AI Recommendation</div>
                    <div className="text-amber-100 font-bold text-base">
                      {alert.payload.action.primaryAction}
                    </div>
                    {alert.payload.action.confidence != null && (
                      <div className="text-amber-400 text-xs mt-2 font-medium">
                        Confidence: {getSafeConfidence(alert.payload.action.confidence)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gambling Insights Bullets - Priority 3 */}
          {alert.gamblingInsights?.bullets && alert.gamblingInsights.bullets.length > 0 && (
            <div className="mb-6" data-testid={`gambling-insights-${alert.id}`}>
              <div className="p-5 bg-gradient-to-r from-emerald-900/30 to-green-900/30 rounded-2xl border border-emerald-800/40">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-emerald-300 text-sm">Betting Insights</span>
                </div>
                <div className="space-y-2">
                  {alert.gamblingInsights.bullets.slice(0, 3).map((bullet, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-emerald-400 text-xs">•</span>
                      <span className="text-emerald-100 text-sm font-medium">
                        {bullet}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prediction - Priority 4 */}
          {alert.payload?.prediction?.nextCriticalMoment && (
            <div className="mb-6" data-testid={`ai-prediction-${alert.id}`}>
              <div className="p-5 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-2xl border border-purple-800/40">
                <div className="flex items-start gap-3">
                  <Eye className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-purple-300 text-sm font-semibold mb-1">Next Critical Moment</div>
                    <div className="text-purple-100 font-bold text-base">
                      {alert.payload.prediction.nextCriticalMoment}
                    </div>
                    {alert.payload.prediction.probability != null && (
                      <div className="text-purple-400 text-xs mt-2 font-medium">
                        Probability: {getSafeConfidence(alert.payload.prediction.probability)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Stats Row */}
          <div className="flex items-center justify-between bg-slate-800/40 rounded-xl p-4 backdrop-blur-sm border border-slate-700/30">
            <div className="flex items-center gap-4">
              <Badge 
                variant="outline" 
                className={`${sportConfig.iconColor} font-bold text-xs`}
                data-testid={`enhanced-sport-badge-${alert.sport.toLowerCase()}`}
              >
                {alert.sport}
              </Badge>
              
              {/* Gambling Confidence - Priority 5 */}
              {alert.gamblingInsights?.confidence != null && (
                <div className="flex items-center gap-2" data-testid={`gambling-confidence-${alert.id}`}>
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-300 font-bold text-sm">
                    {getSafeConfidence(alert.gamblingInsights.confidence)}% Confidence
                  </span>
                </div>
              )}

              {/* Weather Impact - Priority 7 - Enhanced with fallback logic */}
              {(weatherData.impact || weatherData.conditions) && (
                <div className="flex items-center gap-2" data-testid={`weather-impact-${alert.id}`}>
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-300 text-xs font-medium">
                    {weatherData.impact ? 'Weather Impact' : 'Weather Conditions'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {alert.priority != null && (
                <span className="font-bold text-slate-400" data-testid={`enhanced-priority-${alert.id}`}>
                  P{alert.priority}
                </span>
              )}
              {alert.sentToTelegram && (
                <span className="text-blue-300">📱</span>
              )}
            </div>
          </div>

          {/* Betting Odds - Priority 6 */}
          {alert.gamblingInsights?.odds && (
            <div className="mt-4" data-testid={`betting-odds-${alert.id}`}>
              <div className="p-4 bg-gradient-to-r from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-600/40">
                <div className="text-slate-300 text-sm font-semibold mb-2">Live Odds</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {alert.gamblingInsights.odds.home && (
                    <div className="bg-slate-700/50 rounded p-2 text-center">
                      <div className="text-slate-400 mb-1">Home</div>
                      <div className="text-green-300 font-bold">
                        {alert.gamblingInsights.odds.home > 0 ? '+' : ''}{alert.gamblingInsights.odds.home}
                      </div>
                    </div>
                  )}
                  {alert.gamblingInsights.odds.away && (
                    <div className="bg-slate-700/50 rounded p-2 text-center">
                      <div className="text-slate-400 mb-1">Away</div>
                      <div className="text-red-300 font-bold">
                        {alert.gamblingInsights.odds.away > 0 ? '+' : ''}{alert.gamblingInsights.odds.away}
                      </div>
                    </div>
                  )}
                  {alert.gamblingInsights.odds.total && (
                    <div className="bg-slate-700/50 rounded p-2 text-center">
                      <div className="text-slate-400 mb-1">Total</div>
                      <div className="text-blue-300 font-bold">
                        {alert.gamblingInsights.odds.total}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Reasoning - Priority 8 */}
          {alert.payload?.action?.reasoning && alert.payload.action.reasoning.length > 0 && (
            <div className="mt-4" data-testid={`action-reasoning-${alert.id}`}>
              <div className="p-4 bg-gradient-to-r from-slate-800/40 to-slate-700/30 rounded-xl border border-slate-600/30">
                <div className="text-slate-300 text-sm font-semibold mb-2">AI Reasoning</div>
                <div className="space-y-1">
                  {alert.payload.action.reasoning.slice(0, 3).map((reason, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-slate-300 text-xs">
                        {reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback Content */}
          {!hasAIContent && (
            <div className="mb-6" data-testid={`fallback-content-${alert.id}`}>
              <div className="p-5 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <div className="text-slate-200 text-base font-medium leading-relaxed">
                  {alert.message || 'Alert content unavailable'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}