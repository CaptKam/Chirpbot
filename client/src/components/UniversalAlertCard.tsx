import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Target, Bot, TrendingUp, Smartphone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BaseballDiamond } from '@/components/baseball-diamond';

// Assuming formatTimeAgo is defined elsewhere or needs to be imported.
// For the purpose of this example, let's assume it's available globally or imported.
// In a real scenario, you would import it like:
// import { formatTimeAgo } from '@/lib/utils';

// Placeholder for formatTimeAgo if not provided. Replace with actual import.
const formatTimeAgo = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return 'Unknown';

    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo < 7) return `${daysAgo}d ago`;
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 4) return `${weeksAgo}w ago`;
    const monthsAgo = Math.floor(daysAgo / 30);
    if (monthsAgo < 12) return `${monthsAgo}mo ago`;
    const yearsAgo = Math.floor(daysAgo / 365);
    return `${yearsAgo}y ago`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Unknown';
  }
};


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
      // The original code was parsing and formatting to 'HH:mm'.
      // The change request is to use formatTimeAgo instead.
      // The new implementation will use formatTimeAgo.
      // The original `format(parsed, 'HH:mm')` is being replaced by `formatTimeAgo(alert.createdAt)`
      // where the original timestamp was displayed.
      return formatTimeAgo(alert.createdAt);
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

  const presentation = alert.context?.presentation;

  const displayTitle = presentation?.title || alert.message;
  const displayBody = presentation?.body;
  const displayBullets = presentation?.bullets || [];
  const displayTags = presentation?.tags || alert.gamblingInsights?.tags || [];
  const displayConfidence = presentation?.confidence || alert.gamblingInsights?.confidence || alert.confidence || 0;

  const confidencePercent = (() => {
    const conf = displayConfidence;
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
                {/* Updated time display to use formatTimeAgo */}
                <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(alert.createdAt)}</span>
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

          {/* Sport-Specific Game State Details */}
          {alert.context && (
            <>
              {/* MLB Game State */}
              {alert.sport === 'MLB' && (alert.context.inning || alert.context.outs !== undefined) && (
                <div className="mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700" data-testid="game-state-mlb">
                  <div className="flex items-center justify-center gap-4">
                    {/* Inning Indicator */}
                    {alert.context.inning && (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                          {alert.context.isTopInning ? '▲' : '▼'} {alert.context.inning}
                        </div>
                      </div>
                    )}

                    {/* Baseball Diamond with Runners */}
                    {(alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird) && (
                      <BaseballDiamond
                        runners={{
                          first: alert.context.hasFirst,
                          second: alert.context.hasSecond,
                          third: alert.context.hasThird
                        }}
                        outs={alert.context.outs ?? 0}
                        balls={alert.context.balls ?? 0}
                        strikes={alert.context.strikes ?? 0}
                        size="sm"
                        showCount={false}
                      />
                    )}

                    {/* Count and Outs */}
                    <div className="flex items-center gap-3">
                      {(alert.context.balls !== undefined || alert.context.strikes !== undefined) && (
                        <div className="text-xs text-emerald-400 font-mono bg-slate-800/50 px-2 py-1 rounded">
                          {alert.context.balls ?? 0}-{alert.context.strikes ?? 0}
                        </div>
                      )}
                      {alert.context.outs !== undefined && (
                        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                          {alert.context.outs} out{alert.context.outs !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* NFL/NCAAF/CFL Game State */}
              {(alert.sport === 'NFL' || alert.sport === 'NCAAF' || alert.sport === 'CFL') && alert.context.quarter && (
                <div className="mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700" data-testid="game-state-football">
                  <div className="flex items-center justify-center gap-4">
                    {/* Quarter */}
                    <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                      Q{alert.context.quarter}
                    </div>

                    {/* Down & Distance */}
                    {alert.context.down && alert.context.yardsToGo !== undefined && (
                      <div className="text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded font-medium">
                        {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo}
                      </div>
                    )}

                    {/* Field Position */}
                    {alert.context.fieldPosition && (
                      <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                        {alert.context.fieldPosition}
                      </div>
                    )}

                    {/* Time Remaining */}
                    {alert.context.timeRemaining && (
                      <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                        {alert.context.timeRemaining}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NBA/WNBA Game State */}
              {(alert.sport === 'NBA' || alert.sport === 'WNBA') && alert.context.quarter && (
                <div className="mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700" data-testid="game-state-basketball">
                  <div className="flex items-center justify-center gap-4">
                    {/* Quarter */}
                    <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                      Q{alert.context.quarter}
                    </div>

                    {/* Time Remaining */}
                    {alert.context.timeRemaining && (
                      <div className="text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded font-medium">
                        {alert.context.timeRemaining}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Main Alert Content - Quality Validated Display */}
          <div className="mb-3 rounded-lg p-3 bg-slate-800/40 border border-slate-700">
            {presentation?.source === 'ai' && (
              <div className="flex items-center gap-2 mb-2">
                <Bot className={`w-4 h-4 text-${sportConfig.color.replace('bg-', '')}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide text-${sportConfig.color.replace('bg-', '')}`}>
                  AI Enhanced
                </span>
              </div>
            )}

            <div className="text-sm font-semibold text-slate-100 leading-relaxed mb-1">
              {displayTitle}
            </div>

            {displayBody && (
              <div className="text-xs text-slate-300 leading-relaxed">
                {displayBody}
              </div>
            )}
          </div>

          {/* Footer - Confidence & Tags */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs border-${sportConfig.color.replace('bg-', '')}/30 text-${sportConfig.color.replace('bg-', '')}`}>
                {alert.sport}
              </Badge>
              {displayTags.slice(0, 2).map((tag: string, idx: number) => (
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