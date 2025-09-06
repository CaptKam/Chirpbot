import React from 'react';
import { TeamLogo } from '@/components/team-logo';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, Play, CheckCircle } from 'lucide-react';
import { BaseballDiamond, WeatherDisplay } from '@/components/baseball-diamond';
import { useQuery } from '@tanstack/react-query';

interface GameCardTemplateProps {
  // Game basic info
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation?: string;
    score?: number;
  };
  awayTeam: {
    name: string;
    abbreviation?: string;
    score?: number;
  };
  sport: string;
  status?: 'live' | 'scheduled' | 'final';
  startTime?: string;
  venue?: string;

  // Game state info
  inning?: number;
  quarter?: number;
  period?: number;
  isTopInning?: boolean;

  // Baseball specific (for enhanced display)
  runners?: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  balls?: number;
  strikes?: number;
  outs?: number;

  // Weather data
  weather?: {
    windSpeed: number;
    windDirection: string;
  };

  // Selection state
  isSelected?: boolean;
  onSelect?: () => void;

  // Display options
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  showWeather?: boolean;
  showVenue?: boolean;
  showEnhancedMLB?: boolean;
  className?: string;
}

// Helper function to remove city from team names
const removeCity = (teamName: string) => {
  if (!teamName) return '';
  const words = teamName.split(' ');
  return words.length > 1 ? words.slice(-1).join(' ') : teamName;
};

const extractTeamAbbreviation = (teamName: string) => {
  if (!teamName || teamName.trim() === '') return 'TBD';

  // Full team name mappings (check these first)
  const fullTeamMappings: Record<string, string> = {
    'San Diego Padres': 'SD',
    'Washington Nationals': 'WSH',
    'Oakland Athletics': 'OAK',
    'Tampa Bay Rays': 'TB',
    'Kansas City Royals': 'KC',
    'Kansas City': 'KC',
    'Royals': 'KC',
    // Add college teams
    'TCU Horned Frogs': 'TCU',
    'North Carolina Tar Heels': 'UNC'
  };

  // Check full team name first
  if (fullTeamMappings[teamName]) {
    return fullTeamMappings[teamName];
  }

  // Extract abbreviation from team name
  const cityPrefixes = ['New York', 'Los Angeles', 'San Francisco', 'St. Louis', 'Tampa Bay', 'San Diego', 'Washington', 'Kansas City'];
  let cleanName = teamName;

  // Remove city prefixes
  for (const prefix of cityPrefixes) {
    if (teamName.startsWith(prefix)) {
      cleanName = teamName.replace(prefix, '').trim();
      break;
    }
  }

  // Common team abbreviations
  const abbreviations: Record<string, string> = {
    'Yankees': 'NYY', 'Mets': 'NYM', 'Dodgers': 'LAD', 'Angels': 'LAA',
    'Giants': 'SF', 'Athletics': 'OAK', 'Padres': 'SD', 'Cardinals': 'STL',
    'Cubs': 'CHC', 'White Sox': 'CWS', 'Tigers': 'DET', 'Guardians': 'CLE',
    'Twins': 'MIN', 'Royals': 'KC', 'Astros': 'HOU', 'Rangers': 'TEX',
    'Mariners': 'SEA', 'Red Sox': 'BOS', 'Orioles': 'BAL', 'Blue Jays': 'TOR',
    'Rays': 'TB', 'Marlins': 'MIA', 'Nationals': 'WSH', 'Phillies': 'PHI',
    'Braves': 'ATL', 'Pirates': 'PIT', 'Reds': 'CIN', 'Brewers': 'MIL',
    'Diamondbacks': 'ARI', 'Rockies': 'COL'
  };

  return abbreviations[cleanName] || cleanName.slice(0, 3).toUpperCase();
};

export function GameCardTemplate({
  gameId,
  homeTeam,
  awayTeam,
  sport,
  status = 'scheduled',
  startTime,
  venue,
  inning,
  quarter,
  period,
  isTopInning,
  runners,
  balls = 0,
  strikes = 0,
  outs = 0,
  weather,
  isSelected = false,
  onSelect,
  size = 'md',
  children,
  showWeather = true,
  showVenue = true,
  showEnhancedMLB = true,
  className = ''
}: GameCardTemplateProps) {

  const logoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  const scoreSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-2xl';
  const cardHeight = size === 'sm' ? 'min-h-[120px]' : 'min-h-[160px]';

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
    if ((sport === 'NBA' || sport === 'WNBA') && quarter) {
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

  // Get team abbreviations
  const homeAbbr = homeTeam.abbreviation || extractTeamAbbreviation(homeTeam.name);
  const awayAbbr = awayTeam.abbreviation || extractTeamAbbreviation(awayTeam.name);

  // Fetch weather data for the home team
  const { data: weatherData } = useQuery({
    queryKey: ['weather', homeTeam.name],
    queryFn: async () => {
      const response = await fetch(`/api/weather/team/${encodeURIComponent(homeTeam.name)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Weather fetch failed');
      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 1,
    enabled: false // Temporarily disabled during development
  });

  // Convert wind direction degrees to cardinal direction
  const getCardinalDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  return (
    <Card 
      className={`bg-white/5 backdrop-blur-sm cursor-pointer transition-all duration-200 p-4 ${cardHeight} hover:bg-white/10 ${
        isSelected 
          ? 'ring-2 ring-emerald-500 bg-emerald-500/10 shadow-xl shadow-emerald-500/20' 
          : 'ring-1 ring-white/10 hover:ring-emerald-500/50'
      } ${className}`}
      style={{ borderRadius: '12px' }}
      onClick={onSelect}
      data-testid={`game-card-${gameId}`}
    >
      {/* Main Game Layout */}
      <div className="flex items-center justify-between mb-4">
        {/* Away Team - Left Side */}
        <div className="flex items-center space-x-3">
          <div className="text-center">
            <TeamLogo
              teamName={removeCity(awayTeam.name)}
              abbreviation={awayAbbr}
              sport={sport}
              size={logoSize}
              className="shadow-sm"
              teamColor={undefined}
            />
            <div className="text-xs text-slate-300 font-medium mt-1 max-w-[60px] truncate">
              {removeCity(awayTeam.name)}
            </div>
          </div>
          {(status === 'live' || status === 'final') && (
            <div className="text-center">
              <div className={`${scoreSize} font-bold text-slate-200`}>
                {awayTeam.score || 0}
              </div>
            </div>
          )}
        </div>

        {/* Center - Game Info & Status */}
        <div className="flex-1 flex flex-col items-center space-y-3">
          {/* Status & Selection Indicator */}
          <div className="flex items-center space-x-2">
            {(status === 'live' || status === 'final') && (
              <Badge className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                status === 'live' 
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' 
                  : 'bg-slate-700/50 text-slate-300 ring-1 ring-slate-600'
              }`}>
                {status === 'live' && <Play className="w-3 h-3 mr-1" />}
                {status === 'live' ? 'LIVE' : 'FINAL'}
              </Badge>
            )}
            {isSelected && (
              <CheckCircle className="w-5 h-5 text-emerald-400" data-testid={`game-selected-${gameId}`} />
            )}
          </div>

          {/* Enhanced MLB Display with Baseball Diamond */}
          {sport === 'MLB' && (status === 'live' || showEnhancedMLB) && (
            <div className="mt-3 flex justify-center">
              <EnhancedGameDisplay 
                gameId={gameId}
                inning={inning || 1}
                isTopInning={isTopInning || false}
                isLive={status === 'live'}
              />
            </div>
          )}

          {/* Game State for other sports */}
          {(sport !== 'MLB' || !showEnhancedMLB) && getGameState()}
        </div>

        {/* Home Team - Right Side */}
        <div className="flex items-center space-x-3">
          {(status === 'live' || status === 'final') && (
            <div className="text-center">
              <div className={`${scoreSize} font-bold text-slate-200`}>
                {homeTeam.score || 0}
              </div>
            </div>
          )}
          <div className="text-center">
            <TeamLogo
              teamName={removeCity(homeTeam.name)}
              abbreviation={homeAbbr}
              sport={sport}
              size={logoSize}
              className="shadow-sm"
              teamColor={undefined}
            />
            <div className="text-xs text-slate-300 font-medium mt-1 max-w-[60px] truncate">
              {removeCity(homeTeam.name)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Weather, Time & Venue Info */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        {/* Weather Display - Use real weather data from API */}
        {showWeather && sport === 'MLB' && weatherData && (
          <WeatherDisplay 
            windSpeed={weatherData.windSpeed}
            windDirection={getCardinalDirection(weatherData.windDirection)}
            windGust={weatherData.windGust}
            temperature={weatherData.temperature}
            stadiumWindContext={weatherData.stadiumWindContext}
            size="sm"
          />
        )}

        {/* Fallback weather display for non-MLB or when no data */}
        {showWeather && (sport !== 'MLB' || !weatherData) && (
          <WeatherDisplay 
            windSpeed={weather?.windSpeed || 5}
            windDirection={weather?.windDirection || "N"}
            size="sm"
          />
        )}

        <div className="flex items-center space-x-3">
          {/* Time for scheduled games */}
          {status === 'scheduled' && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-sm text-slate-300 font-medium">
                {formatTime(startTime)}
              </span>
            </div>
          )}

          {/* Venue */}
          {showVenue && venue && (
            <div className="text-xs text-slate-400 text-right">
              {venue.length > 25 ? `${venue.substring(0, 25)}...` : venue}
            </div>
          )}
        </div>
      </div>

      {/* Render children if provided */}
      {children}
    </Card>
  );
}

// Mock EnhancedGameDisplay for demonstration. Replace with actual component if available.
const EnhancedGameDisplay = ({ gameId, inning, isTopInning, isLive }: { gameId: string; inning: number; isTopInning: boolean; isLive: boolean }) => {
  // This is a placeholder. In a real scenario, this component would render the BaseballDiamond
  // and potentially other enhanced game details.
  // The logic for showing the baseball diamond is now handled in the GameCardTemplate itself.
  return (
    <BaseballDiamond
      runners={{ first: true, second: false, third: true }} // Example data
      inning={inning}
      isTopInning={isTopInning}
      outs={1} // Example data
      balls={2} // Example data
      strikes={1} // Example data
      size="sm"
      showCount={isLive}
    />
  );
};