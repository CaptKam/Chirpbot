import React from 'react';
import { TeamLogo } from '@/components/team-logo';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, Play } from 'lucide-react';
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
    first?: boolean;
    second?: boolean;
    third?: boolean;
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
    // MLB
    'Yankees': 'NYY', 'Mets': 'NYM', 'Dodgers': 'LAD', 'Angels': 'LAA',
    'Athletics': 'OAK', 'Padres': 'SD',
    'Cubs': 'CHC', 'White Sox': 'CWS', 'Guardians': 'CLE',
    'Twins': 'MIN', 'Royals': 'KC', 'Astros': 'HOU', 'Rangers': 'TEX',
    'Mariners': 'SEA', 'Red Sox': 'BOS', 'Orioles': 'BAL', 'Blue Jays': 'TOR',
    'Rays': 'TB', 'Marlins': 'MIA', 'Nationals': 'WSH', 'Phillies': 'PHI',
    'Pirates': 'PIT', 'Reds': 'CIN', 'Brewers': 'MIL',
    'Diamondbacks': 'ARI', 'Rockies': 'COL',
    // NBA
    'Hawks': 'ATL', 'Celtics': 'BOS', 'Nets': 'BKN', 'Hornets': 'CHA',
    'Bulls': 'CHI', 'Cavaliers': 'CLE', 'Mavericks': 'DAL', 'Nuggets': 'DEN',
    'Pistons': 'DET', 'Warriors': 'GSW', 'Rockets': 'HOU', 'Pacers': 'IND',
    'Clippers': 'LAC', 'Lakers': 'LAL', 'Grizzlies': 'MEM', 'Heat': 'MIA',
    'Bucks': 'MIL', 'Timberwolves': 'MIN', 'Pelicans': 'NOP', 'Knicks': 'NYK',
    'Thunder': 'OKC', 'Magic': 'ORL', '76ers': 'PHI', 'Suns': 'PHX',
    'Trail Blazers': 'POR', 'Blazers': 'POR', 'Kings': 'SAC', 'Spurs': 'SAS',
    'Raptors': 'TOR', 'Jazz': 'UTA', 'Wizards': 'WAS',
    // NFL (avoid duplicates with MLB: Giants=SF/NYG, Cardinals=STL/ARI)
    'Falcons': 'ATL', 'Ravens': 'BAL', 'Bills': 'BUF',
    'Panthers': 'CAR', 'Bears': 'CHI', 'Bengals': 'CIN', 'Browns': 'CLE',
    'Cowboys': 'DAL', 'Broncos': 'DEN', 'Lions': 'DET', 'Packers': 'GB',
    'Texans': 'HOU', 'Colts': 'IND', 'Jaguars': 'JAX', 'Chiefs': 'KC',
    'Chargers': 'LAC', 'Rams': 'LAR', 'Raiders': 'LV', 'Dolphins': 'MIA',
    'Vikings': 'MIN', 'Patriots': 'NE', 'Saints': 'NO',
    'Jets': 'NYJ', 'Eagles': 'PHI', 'Steelers': 'PIT', 'Seahawks': 'SEA',
    '49ers': 'SF', 'Niners': 'SF', 'Buccaneers': 'TB', 'Bucs': 'TB', 'Titans': 'TEN', 'Commanders': 'WAS',
    // MLB/NFL shared names - using full names
    'SF Giants': 'SF', 'San Francisco Giants': 'SF', 'NY Giants': 'NYG', 'New York Giants': 'NYG',
    'STL Cardinals': 'STL', 'St. Louis Cardinals': 'STL', 'Arizona Cardinals': 'ARI',
    'Atlanta Braves': 'ATL', 'Detroit Tigers': 'DET'
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
  const cardHeight = size === 'sm' ? 'min-h-[120px]' : size === 'md' ? 'min-h-[130px]' : 'min-h-[160px]';

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
    enabled: showWeather && sport === 'MLB' // Only fetch for MLB games when weather is shown
  });

  // Fetch possession stats for NFL and NCAAF games
  const { data: possessionData } = useQuery({
    queryKey: ['possession', gameId, sport],
    queryFn: async () => {
      const response = await fetch(`/api/${sport.toLowerCase()}/possession/${gameId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Possession fetch failed');
      return response.json();
    },
    staleTime: 5 * 1000, // Cache for 5 seconds
    refetchInterval: status === 'live' ? 5000 : false, // Refetch every 5s for live games
    retry: 1,
    enabled: (sport === 'NFL' || sport === 'NCAAF') && status === 'live'
  });

  // Fetch timeout stats for NFL/NCAAF/CFL games
  const { data: timeoutData } = useQuery({
    queryKey: ['timeouts', gameId, sport],
    queryFn: async () => {
      const response = await fetch(`/api/${sport.toLowerCase()}/timeouts/${gameId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Timeout fetch failed');
      return response.json();
    },
    staleTime: 5 * 1000, // Cache for 5 seconds
    refetchInterval: status === 'live' ? 5000 : false, // Refetch every 5s for live games
    retry: 1,
    enabled: (sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL') && status === 'live'
  });

  // Convert wind direction degrees to cardinal direction
  const getCardinalDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const homeScore = homeTeam.score || 0;
  const awayScore = awayTeam.score || 0;

  // Fetch live game data for MLB games
  const { data: liveGameData } = useQuery({
    queryKey: ['liveGame', gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/live`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch live game data');
      return response.json();
    },
    enabled: sport === 'MLB' && status === 'live' && showEnhancedMLB,
    refetchInterval: status === 'live' ? 10000 : false, // Refetch every 10s for live games
    staleTime: 8000,
    retry: 1
  });

  // Use live data if available, otherwise use passed props
  const displayRunners = liveGameData?.runners || runners || { first: false, second: false, third: false };
  const displayOuts = liveGameData?.outs ?? outs ?? 0;
  const displayBalls = liveGameData?.balls ?? balls ?? 0;
  const displayStrikes = liveGameData?.strikes ?? strikes ?? 0;

  // Get display names (remove mascot for NCAAF)
  const awayDisplayName = removeNcaafMascot(awayTeam.name, sport);
  const homeDisplayName = removeNcaafMascot(homeTeam.name, sport);

  return (
    <Card 
      className={`bg-white/5 backdrop-blur-sm cursor-pointer transition-all duration-200 p-2 ${cardHeight} ${
        isSelected 
          ? 'ring-2 ring-emerald-500 bg-emerald-500/10 shadow-xl shadow-emerald-500/20' 
          : 'ring-1 ring-white/10'
      } ${className}`}
      style={{ borderRadius: '12px' }}
      onClick={onSelect}
      data-testid={`game-card-${gameId}`}
    >
      {/* Main Game Layout */}
      <div className="flex items-center justify-between mb-2">
        {/* Away Team - Left Side */}
        <div className="flex items-center space-x-3">
          <div className="text-center">
            <TeamLogo
              teamName={removeCity(awayDisplayName)}
              abbreviation={awayAbbr}
              sport={sport}
              size={logoSize}
              className="shadow-sm"
            />
            <div className="text-xs text-slate-300 font-medium mt-1 max-w-[60px] truncate">
              {removeCity(awayDisplayName)}
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
          {/* Status Badge */}
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

          {/* Game State for all sports */}
          {getGameState()}

          {/* Baseball Diamond for MLB games */}
          {sport === 'MLB' && showEnhancedMLB && (
            <BaseballDiamond
              runners={displayRunners}
              inning={inning}
              isTopInning={isTopInning}
              outs={displayOuts}
              balls={displayBalls}
              strikes={displayStrikes}
              size="md"
              showCount={status === 'live'}
            />
          )}
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
              teamName={removeCity(homeDisplayName)}
              abbreviation={homeAbbr}
              sport={sport}
              size={logoSize}
              className="shadow-sm"
            />
            <div className="text-xs text-slate-300 font-medium mt-1 max-w-[60px] truncate">
              {removeCity(homeDisplayName)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Weather, Time & Venue Info */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
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

        {/* Possession Stats for NFL/NCAAF */}
        {(sport === 'NFL' || sport === 'NCAAF') && status === 'live' && possessionData?.tracked && (
          <div className="flex items-center space-x-2">
            <div className="text-xs bg-slate-800/50 px-2 py-1 rounded">
              <span className="text-slate-400">Poss: </span>
              <span className={possessionData.currentPossession === 'home' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                {possessionData.homePossessions}
              </span>
              <span className="text-slate-500 mx-1">-</span>
              <span className={possessionData.currentPossession === 'away' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                {possessionData.awayPossessions}
              </span>
            </div>
          </div>
        )}

        {/* Timeout Stats for NFL/NCAAF/CFL */}
        {(sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL') && status === 'live' && timeoutData?.tracked && (
          <div className="flex items-center space-x-2">
            <div className="text-xs bg-slate-800/50 px-2 py-1 rounded">
              <span className="text-slate-400">TO: </span>
              <span className="text-slate-300">
                {timeoutData.homeTimeoutsRemaining}
              </span>
              <span className="text-slate-500 mx-1">-</span>
              <span className="text-slate-300">
                {timeoutData.awayTimeoutsRemaining}
              </span>
            </div>
          </div>
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

// Enhanced game display component that fetches live MLB data
const EnhancedGameDisplay = ({ gameId, inning, isTopInning, isLive }: { gameId: string; inning: number; isTopInning: boolean; isLive: boolean }) => {
  // Fetch live MLB game data for enhanced display
  const { data: liveGameData, error: liveDataError } = useQuery({
    queryKey: ['liveGame', gameId],
    queryFn: async () => {
      const response = await fetch(`/api/mlb/live/${gameId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        console.error(`Failed to fetch live game data for ${gameId}:`, response.status);
        throw new Error(`Failed to fetch live game data: ${response.status}`);
      }
      const data = await response.json();
      console.log(`🔍 Enhanced game data for ${gameId}:`, data);
      return data;
    },
    staleTime: 10 * 1000, // Cache for 10 seconds
    refetchInterval: isLive ? 10 * 1000 : false, // Refetch every 10 seconds if live
    retry: 1,
    enabled: !!gameId && isLive // Only fetch if we have a gameId and game is live
  });

  // Log any errors for debugging
  if (liveDataError) {
    console.error(`❌ Live data error for game ${gameId}:`, liveDataError);
  }

  // Use live data if available, otherwise fallback to default values
  const runners = liveGameData?.runners || { first: false, second: false, third: false };
  const outs = liveGameData?.outs || 0;
  const balls = liveGameData?.balls || 0;
  const strikes = liveGameData?.strikes || 0;
  const actualInning = liveGameData?.inning || inning;
  const actualIsTopInning = liveGameData?.isTopInning !== undefined ? liveGameData.isTopInning : isTopInning;

  // Debug logging for runners data
  console.log(`🔍 EnhancedGameDisplay runners for game ${gameId}:`, {
    liveGameData,
    runners,
    outs,
    balls,
    strikes,
    isLive,
    hasData: !!liveGameData
  });

  return (
    <BaseballDiamond
      runners={runners}
      inning={actualInning}
      isTopInning={actualIsTopInning}
      outs={outs}
      balls={balls}
      strikes={strikes}
      size="sm"
      showCount={isLive}
    />
  );
};