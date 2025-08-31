import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock3, Timer, ChevronUp, ChevronDown } from 'lucide-react';

export interface AlertFooterProps {
  sport: 'MLB' | 'NFL' | 'NCAAF' | 'NBA' | 'NHL';
  gameInfo?: {
    // MLB specific
    half?: 'Top' | 'Bottom';
    inning?: number;
    bases?: {
      first: boolean;
      second: boolean;
      third: boolean;
      home?: boolean;
    };
    balls?: number;
    strikes?: number;
    outs?: number;
    
    // Football specific
    quarter?: number;
    down?: number;
    distance?: number;
    yardLine?: number;
    possessionTeam?: string;
    
    // Basketball specific
    period?: number;
    fouls?: { home: number; away: number };
    
    // Hockey specific
    shots?: { home: number; away: number };
    penalties?: number;
    
    // Common
    clock?: string;
    score?: { home: number; away: number };
    homeTeam?: string;
    awayTeam?: string;
  };
  createdAt?: string;
}

// Reusable indicator for B/S/O lights
const Indicator: React.FC<{ label: string; count?: number; max: number }> = ({
  label,
  count,
  max,
}) => {
  // If count is undefined/null, don't render the indicator
  if (count === undefined || count === null) {
    return null;
  }
  
  return (
    <div className="flex items-center space-x-1">
      <span className="text-sm font-medium mr-1">{label}</span>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < count ? 'bg-green-400' : 'bg-gray-500'
          }`}
        ></span>
      ))}
    </div>
  );
};

// Baseball Diamond Component
const BaseballDiamond: React.FC<{ bases: { first: boolean; second: boolean; third: boolean; home?: boolean } }> = ({ bases }) => (
  <div className="relative w-8 h-8 ml-2">
    {/* Second Base (top) */}
    <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 border border-gray-500 ${bases.second ? 'bg-green-500' : 'bg-gray-700'}`}></div>
    {/* Third Base (left) */}
    <div className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-2 h-2 rotate-45 border border-gray-500 ${bases.third ? 'bg-green-500' : 'bg-gray-700'}`}></div>
    {/* First Base (right) */}
    <div className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-2 h-2 rotate-45 border border-gray-500 ${bases.first ? 'bg-green-500' : 'bg-gray-700'}`}></div>
    {/* Home Plate (bottom) */}
    <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 border border-gray-500 ${bases.home ? 'bg-green-500' : 'bg-gray-700'}`}></div>
  </div>
);

// Football Field Component  
const FootballField: React.FC<{ down?: number; distance?: number; yardLine?: number }> = ({ down, distance, yardLine }) => (
  <div className="flex items-center space-x-2 text-xs">
    {down && distance && (
      <span className="bg-orange-600 px-2 py-1 rounded text-white font-semibold">
        {down}{down === 1 ? 'st' : down === 2 ? 'nd' : down === 3 ? 'rd' : 'th'} & {distance}
      </span>
    )}
    {yardLine && (
      <span className="text-green-400 font-medium">{yardLine} yd</span>
    )}
  </div>
);

/**
 * Multi-Sport AlertFooter
 * Shows sport-specific quick glance information
 */
const AlertFooter: React.FC<AlertFooterProps> = ({ sport, gameInfo, createdAt }) => {
  const renderSportSpecific = () => {
    switch (sport) {
      case 'MLB':
        return (
          <>
            <div className="flex items-center space-x-3">
              {gameInfo?.inning && (
                <div className="flex items-center space-x-1">
                  {gameInfo.half === 'Top' ? (
                    <ChevronUp className="w-4 h-4 text-blue-400" />
                  ) : gameInfo.half === 'Bottom' ? (
                    <ChevronDown className="w-4 h-4 text-orange-400" />
                  ) : null}
                  <span className="text-sm font-semibold text-yellow-400">{gameInfo.inning}{gameInfo.half ? (gameInfo.half === 'Top' ? 'T' : 'B') : ''}</span>
                </div>
              )}
              {gameInfo?.bases && <BaseballDiamond bases={gameInfo.bases} />}
            </div>
            <div className="flex items-center space-x-3">
              <Indicator label="B" count={gameInfo?.balls} max={4} />
              <Indicator label="S" count={gameInfo?.strikes} max={3} />
              <Indicator label="O" count={gameInfo?.outs} max={3} />
            </div>
          </>
        );
      
      case 'NFL':
      case 'NCAAF':
        return (
          <>
            <div className="flex items-center space-x-3">
              {gameInfo?.quarter && (
                <span className="text-sm font-semibold">Q{gameInfo.quarter}</span>
              )}
              <FootballField down={gameInfo?.down} distance={gameInfo?.distance} yardLine={gameInfo?.yardLine} />
            </div>
            <div className="flex items-center space-x-2">
              {gameInfo?.clock && (
                <div className="flex items-center space-x-1">
                  <Timer className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-mono">{gameInfo.clock}</span>
                </div>
              )}
              {gameInfo?.score && (
                <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                  {gameInfo.score.away}-{gameInfo.score.home}
                </span>
              )}
            </div>
          </>
        );
      
      case 'NBA':
        return (
          <>
            <div className="flex items-center space-x-3">
              {gameInfo?.period && (
                <span className="text-sm font-semibold">Q{gameInfo.period}</span>
              )}
              {gameInfo?.score && (
                <span className="text-sm bg-orange-600 px-2 py-1 rounded text-white">
                  {gameInfo.score.away}-{gameInfo.score.home}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {gameInfo?.fouls && (
                <>
                  <span className="text-xs">Fouls: {gameInfo.fouls.away}-{gameInfo.fouls.home}</span>
                </>
              )}
              {gameInfo?.clock && (
                <div className="flex items-center space-x-1">
                  <Timer className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-mono">{gameInfo.clock}</span>
                </div>
              )}
            </div>
          </>
        );
      
      case 'NHL':
        return (
          <>
            <div className="flex items-center space-x-3">
              {gameInfo?.period && (
                <span className="text-sm font-semibold">P{gameInfo.period}</span>
              )}
              {gameInfo?.shots && (
                <span className="text-xs">SOG: {gameInfo.shots.away}-{gameInfo.shots.home}</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {gameInfo?.penalties && gameInfo.penalties > 0 && (
                <span className="text-xs bg-red-600 px-2 py-1 rounded text-white">
                  {gameInfo.penalties} PEN
                </span>
              )}
              {gameInfo?.clock && (
                <div className="flex items-center space-x-1">
                  <Timer className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-mono">{gameInfo.clock}</span>
                </div>
              )}
            </div>
          </>
        );
      
      default:
        return (
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">Live Game</span>
            {gameInfo?.score && (
              <span className="text-sm bg-gray-700 px-2 py-1 rounded">
                {gameInfo.score.away}-{gameInfo.score.home}
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-800/90 backdrop-blur-sm text-white border-t border-white/10">
      {renderSportSpecific()}
      {createdAt && (
        <div className="flex items-center space-x-0.5 text-[10px] text-gray-400">
          <Clock3 className="w-3 h-3" />
          <span>{formatDistanceToNow(new Date(createdAt)).replace(' ago', '').replace('about ', '').replace('less than a ', '<1').replace(' minutes', 'm').replace(' minute', 'm').replace(' hours', 'h').replace(' hour', 'h')}</span>
        </div>
      )}
    </div>
  );
};

export default AlertFooter;