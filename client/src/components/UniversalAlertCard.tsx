import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Target, Bot, TrendingUp, Smartphone } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Helper function to remove mascot from NCAAF team names
const removeNcaafMascot = (teamName: string, sport?: string) => {
  if (!teamName || sport !== 'NCAAF') return teamName;
  
  // Common NCAAF mascots to remove
  const mascots = [
    'Tigers', 'Bulldogs', 'Crimson Tide', 'Volunteers', 'Gators', 'Wildcats',
    'Aggies', 'Longhorns', 'Sooners', 'Trojans', 'Bruins', 'Cardinal', 
    'Fighting Irish', 'Seminoles', 'Hurricanes', 'Cavaliers', 'Yellow Jackets',
    'Blue Devils', 'Demon Deacons', 'Tar Heels', 'Wolfpack', 'Orange',
    'Eagles', 'Panthers', 'Cardinals', 'Badgers', 'Hawkeyes', 'Cornhuskers',
    'Wolverines', 'Buckeyes', 'Nittany Lions', 'Spartans', 'Hoosiers',
    'Boilermakers', 'Terrapins', 'Scarlet Knights', 'Golden Gophers',
    'Illini', 'Horned Frogs', 'Red Raiders', 'Mountaineers', 'Cowboys',
    'Jayhawks', 'Cyclones', 'Bears', 'Ducks', 'Beavers', 'Huskies',
    'Cougars', 'Sun Devils', 'Utes', 'Buffaloes', 'Knights', 'Bulls',
    'Bearcats', 'Rebels', 'Rainbow Warriors', 'Aztecs', 'Broncos', 'Mustangs',
    'Mean Green', 'Owls', 'Golden Panthers', 'Blazers', 'Roadrunners'
  ];
  
  // Remove mascot if found at the end
  for (const mascot of mascots) {
    if (teamName.endsWith(mascot)) {
      return teamName.replace(mascot, '').trim();
    }
  }
  
  return teamName;
};

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
  gamblingInsights?: {
    structuredTemplate?: string;
    bullets?: string[];
    confidence?: number;
    tags?: string[];
  };
  hasComposerEnhancement?: boolean;
}

export function UniversalAlertCard({ alert, showEnhancements = false }: { alert: UniversalAlertProps; showEnhancements?: boolean }) {
  // Safe date parsing
  const formattedTime = (() => {
    try {
      if (!alert.createdAt) return 'Unknown';
      const parsed = parseISO(alert.createdAt);
      if (isNaN(parsed.getTime())) return 'Unknown';
      return format(parsed, 'HH:mm');
    } catch (error) {
      return 'Unknown';
    }
  })();

  // Get sport configuration
  const getSportConfig = (sport: string) => {
    const configs = {
      'MLB': { color: 'bg-green-500', icon: '⚾', label: 'Baseball' },
      'NFL': { color: 'bg-orange-500', icon: '🏈', label: 'Football' },
      'NBA': { color: 'bg-purple-500', icon: '🏀', label: 'Basketball' },
      'NCAAF': { color: 'bg-blue-500', icon: '🏈', label: 'College Football' },
      'WNBA': { color: 'bg-pink-500', icon: '🏀', label: 'Women\'s Basketball' },
      'CFL': { color: 'bg-red-500', icon: '🏈', label: 'Canadian Football' }
    };
    return configs[sport as keyof typeof configs] || { color: 'bg-slate-500', icon: '⭐', label: sport };
  };

  const sportConfig = getSportConfig(alert.sport);

  // Clean and format the display message
  const getDisplayMessage = () => {
    // Priority 1: Use structured template from gambling insights (clean emoji format)
    if (alert.gamblingInsights?.structuredTemplate) {
      return alert.gamblingInsights.structuredTemplate;
    }

    // Priority 2: Use AI-enhanced message if available
    if (alert.context?.aiEnhanced && alert.message) {
      return alert.message;
    }

    // Priority 3: Use regular message, cleaned up
    if (alert.message) {
      return alert.message.replace(/\[object Object\]/g, '').trim();
    }

    // Fallback
    return `${alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL)_/, '').replace(/_/g, ' ')} Alert`;
  };

  const displayMessage = getDisplayMessage();

  // Calculate confidence percentage
  const confidencePercent = (() => {
    const conf = alert.gamblingInsights?.confidence || alert.confidence || 0;
    if (conf > 1) return Math.min(100, Math.max(0, Math.round(conf)));
    return Math.round(conf * 100);
  })();

  // Format game state for header
  const gameStateHeader = (() => {
    const parts = [];
    
    // Remove mascots for NCAAF teams
    const displayAwayTeam = removeNcaafMascot(alert.awayTeam, alert.sport);
    const displayHomeTeam = removeNcaafMascot(alert.homeTeam, alert.sport);

    // Add score if available
    if (alert.awayScore !== undefined && alert.homeScore !== undefined) {
      parts.push(`${displayAwayTeam} ${alert.awayScore} - ${alert.homeScore} ${displayHomeTeam}`);
    } else {
      parts.push(`${displayAwayTeam} @ ${displayHomeTeam}`);
    }

    return parts.join(' • ');
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`relative backdrop-blur-sm bg-slate-900/50 border-slate-700 overflow-hidden`}>
        {/* Sport color accent */}
        <div className={`h-1 ${sportConfig.color}`} />

        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${sportConfig.color}/20 border border-${sportConfig.color}/30`}>
                {sportConfig.icon}
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-bold uppercase tracking-wide text-${sportConfig.color.replace('bg-', '')}`}>
                  {alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL)_/, '').replace(/_/g, ' ')}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400">{formattedTime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {alert.priority > 75 && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400">
                  High
                </Badge>
              )}
              {alert.sentToTelegram && (
                <Smartphone className="w-4 h-4 text-blue-400" />
              )}
            </div>
          </div>

          {/* Game State */}
          <div className="mb-3 p-2 rounded-lg bg-slate-800/60 border border-slate-700">
            <div className="text-sm font-medium text-slate-100 text-center">
              {gameStateHeader}
            </div>
          </div>

          {/* Main Alert Content - AI-Controlled Display */}
          <div className="mb-3 rounded-lg p-3 bg-slate-800/40 border border-slate-700">
            {(alert.hasComposerEnhancement || alert.context?.aiEnhanced) && (
              <div className="flex items-center gap-2 mb-2">
                <Bot className={`w-4 h-4 text-${sportConfig.color.replace('bg-', '')}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide text-${sportConfig.color.replace('bg-', '')}`}>
                  AI Enhanced
                </span>
              </div>
            )}

            <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">
              {displayMessage}
            </div>
          </div>

          {/* AI Insights Bullets (if available) */}
          {alert.context?.aiInsights && alert.context.aiInsights.length > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span className="text-xs font-semibold text-slate-300">Key Insights</span>
              </div>
              <ul className="space-y-1">
                {alert.context.aiInsights.slice(0, 3).map((insight: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span className="flex-1">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer - Confidence & Tags */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs border-${sportConfig.color.replace('bg-', '')}/30 text-${sportConfig.color.replace('bg-', '')}`}>
                {alert.sport}
              </Badge>
              {alert.gamblingInsights?.tags?.slice(0, 2).map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-slate-600 text-slate-400">
                  {tag}
                </Badge>
              ))}
            </div>

            {confidencePercent > 0 && (
              <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-400">{confidencePercent}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}