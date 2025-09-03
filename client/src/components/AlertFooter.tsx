import React from 'react';
import { Clock } from 'lucide-react';

interface AlertFooterProps {
  sport?: string;
  // MLB specific
  inning?: number;
  isTopInning?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  // Weather data
  weather?: {
    temperature?: number;
    condition?: string;
    windDescription?: string;
    homeRunFactor?: number;
  };
  // NFL/CFL/NCAAF specific
  quarter?: number;
  timeRemaining?: string;
  down?: number;
  yardsToGo?: number;
  // NBA specific (uses quarter)
  // NHL specific
  period?: number;
  // Common
  createdAt: string;
}

export default function AlertFooter({
  sport = 'MLB',
  inning,
  isTopInning,
  outs = 0,
  balls = 0,
  strikes = 0,
  hasFirst = false,
  hasSecond = false,
  hasThird = false,
  weather,
  quarter,
  timeRemaining,
  down,
  yardsToGo,
  period,
  createdAt
}: AlertFooterProps) {
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertTime = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 min ago';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  const renderSportSpecificContent = () => {
    switch (sport) {
      case 'MLB':
        return (
          <>
            {/* Inning Display */}
            {inning && (
              <div className="flex items-center space-x-1">
                <span className="text-emerald-400 font-medium">
                  {isTopInning ? '▲' : '▼'} {inning}
                </span>
              </div>
            )}

            {/* Count Display */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-300">
                {balls}-{strikes}, {outs} {outs === 1 ? 'out' : 'outs'}
              </span>
            </div>

            {/* Weather Display for MLB */}
            {weather && weather.windDescription && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-400 text-xs">
                  {weather.windDescription}
                </span>
              </div>
            )}

            {/* Baseball Diamond */}
            <div className="relative w-6 h-6 flex-shrink-0">
              <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rotate-45 border ${hasSecond ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
              <div className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-1.5 h-1.5 rotate-45 border ${hasThird ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
              <div className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-1.5 h-1.5 rotate-45 border ${hasFirst ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-slate-600 rounded-full" />
            </div>
          </>
        );

      case 'NFL':
      case 'NCAAF':
        return (
          <>
            {/* Quarter Display */}
            {quarter && (
              <div className="flex items-center space-x-1">
                <span className="text-blue-400 font-medium">Q{quarter}</span>
              </div>
            )}

            {/* Time Remaining */}
            {timeRemaining && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">{timeRemaining}</span>
              </div>
            )}

            {/* Down & Distance */}
            {down && yardsToGo && (
              <div className="flex items-center space-x-1">
                <span className="text-orange-400">{down} & {yardsToGo}</span>
              </div>
            )}

            {/* Football Field Icon */}
            <div className="relative w-8 h-4 flex-shrink-0">
              <div className="w-full h-full bg-green-700/30 border border-green-500/50 rounded-sm">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-full bg-white/30"></div>
                  <div className="absolute w-full h-0.5 bg-white/20 top-1/2 transform -translate-y-1/2"></div>
                </div>
              </div>
            </div>
          </>
        );

      case 'CFL':
        return (
          <>
            {/* Quarter Display */}
            {quarter && (
              <div className="flex items-center space-x-1">
                <span className="text-red-400 font-medium">Q{quarter}</span>
              </div>
            )}

            {/* Time Remaining */}
            {timeRemaining && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">{timeRemaining}</span>
              </div>
            )}

            {/* CFL Field (wider) */}
            <div className="relative w-10 h-4 flex-shrink-0">
              <div className="w-full h-full bg-red-700/30 border border-red-500/50 rounded-sm">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-full bg-white/30"></div>
                  <div className="absolute w-full h-0.5 bg-white/20 top-1/2 transform -translate-y-1/2"></div>
                </div>
              </div>
            </div>
          </>
        );

      case 'NBA':
        return (
          <>
            {/* Quarter Display */}
            {quarter && (
              <div className="flex items-center space-x-1">
                <span className="text-orange-400 font-medium">Q{quarter}</span>
              </div>
            )}

            {/* Time Remaining */}
            {timeRemaining && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">{timeRemaining}</span>
              </div>
            )}

            {/* Basketball Court */}
            <div className="relative w-6 h-6 flex-shrink-0">
              <div className="w-full h-full bg-orange-700/30 border border-orange-500/50 rounded">
                <div className="absolute inset-1 border border-orange-400/40 rounded-full"></div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-1 bg-orange-400/60 rounded-b"></div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-1 bg-orange-400/60 rounded-t"></div>
              </div>
            </div>
          </>
        );

      case 'NHL':
        return (
          <>
            {/* Period Display */}
            {period && (
              <div className="flex items-center space-x-1">
                <span className="text-cyan-400 font-medium">P{period}</span>
              </div>
            )}

            {/* Time Remaining */}
            {timeRemaining && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">{timeRemaining}</span>
              </div>
            )}

            {/* Hockey Rink */}
            <div className="relative w-8 h-5 flex-shrink-0">
              <div className="w-full h-full bg-cyan-700/30 border border-cyan-500/50 rounded-full">
                <div className="absolute inset-1 border border-cyan-400/40 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-red-400/60"></div>
                <div className="absolute top-1/2 left-1 transform -translate-y-1/2 w-1 h-2 border border-cyan-400/60 rounded-r"></div>
                <div className="absolute top-1/2 right-1 transform -translate-y-1/2 w-1 h-2 border border-cyan-400/60 rounded-l"></div>
              </div>
            </div>
          </>
        );

      default:
        return (
          <div className="flex items-center space-x-2">
            <span className="text-slate-300">{sport}</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-between text-xs text-slate-400">
      <div className="flex items-center space-x-4">
        {renderSportSpecificContent()}
      </div>

      {/* Time Ago */}
      <div className="flex items-center space-x-1">
        <Clock className="w-3 h-3" />
        <span>{formatTimeAgo(createdAt)}</span>
      </div>
    </div>
  );
}