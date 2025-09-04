
import React from 'react';
import { TeamLogo } from '@/components/team-logo';
import { Badge } from '@/components/ui/badge';
import { Clock, Play } from 'lucide-react';

interface GameCardTemplateProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  sport: string;
  status?: 'live' | 'scheduled' | 'final';
  startTime?: string;
  inning?: number;
  quarter?: number;
  period?: number;
  isTopInning?: boolean;
  venue?: string;
  size?: 'sm' | 'md' | 'lg';
  showVenue?: boolean;
  showTime?: boolean;
  className?: string;
}

// Helper function to remove city from team names
const removeCity = (teamName: string) => {
  if (!teamName) return '';
  const words = teamName.split(' ');
  return words.length > 1 ? words.slice(-1).join(' ') : teamName;
};

export function GameCardTemplate({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  sport,
  status = 'scheduled',
  startTime,
  inning,
  quarter,
  period,
  isTopInning,
  venue,
  size = 'md',
  showVenue = false,
  showTime = false,
  className = ''
}: GameCardTemplateProps) {
  const logoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  const scoreSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';
  
  const formatTime = (dateString?: string) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return isNaN(date.getTime()) 
      ? 'TBD' 
      : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getGameState = () => {
    if (sport === 'MLB' && inning) {
      return (
        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          {isTopInning ? '▲' : '▼'} {inning}
        </div>
      );
    }
    if ((sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL') && quarter) {
      return (
        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          Q{quarter}
        </div>
      );
    }
    if (sport === 'NBA' && quarter) {
      return (
        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          Q{quarter}
        </div>
      );
    }
    if (sport === 'NHL' && period) {
      return (
        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          P{period}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-gradient-to-r from-slate-800/40 to-slate-700/40 rounded-lg p-3 border border-slate-600/30 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Away Team - Left Side */}
        <div className="flex items-center space-x-3">
          <div className="text-center">
            <TeamLogo
              teamName={removeCity(awayTeam)}
              sport={sport}
              size={logoSize}
              className="shadow-sm mb-1"
            />
            <div className="text-xs text-slate-300 font-medium max-w-[60px] truncate">
              {removeCity(awayTeam)}
            </div>
          </div>
          {(status === 'live' || status === 'final') && (
            <div className="text-center">
              <div className={`${scoreSize} font-bold text-slate-200`}>
                {awayScore ?? 0}
              </div>
            </div>
          )}
        </div>

        {/* Center - Game State */}
        <div className="flex-1 flex flex-col items-center space-y-1">
          <div className="text-xs text-slate-400 font-medium">@</div>
          
          {/* Status Badge - Only show FINAL */}
          {status === 'final' && (
            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 ring-1 ring-slate-600">
              FINAL
            </Badge>
          )}
          
          {/* Game State Indicators */}
          {getGameState()}
          
          {/* Time for scheduled games */}
          {status === 'scheduled' && showTime && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-300 font-medium">
                {formatTime(startTime)}
              </span>
            </div>
          )}
        </div>

        {/* Home Team - Right Side */}
        <div className="flex items-center space-x-3">
          {(status === 'live' || status === 'final') && (
            <div className="text-center">
              <div className={`${scoreSize} font-bold text-slate-200`}>
                {homeScore ?? 0}
              </div>
            </div>
          )}
          <div className="text-center">
            <TeamLogo
              teamName={removeCity(homeTeam)}
              sport={sport}
              size={logoSize}
              className="shadow-sm mb-1"
            />
            <div className="text-xs text-slate-300 font-medium max-w-[60px] truncate">
              {removeCity(homeTeam)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Venue - Bottom */}
      {showVenue && venue && (
        <div className="mt-2 pt-2 border-t border-slate-600/30">
          <div className="text-xs text-slate-400 text-center">
            {venue.length > 30 ? `${venue.substring(0, 30)}...` : venue}
          </div>
        </div>
      )}
    </div>
  );
}
