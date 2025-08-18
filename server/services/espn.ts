/**
 * ESPN Sports API Service
 * Fetches real-world sports data from ESPN's public API endpoints
 */

export interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
    displayClock?: string;
    period?: number;
  };
  competitions: Array<{
    id: string;
    venue?: {
      fullName: string;
      address: {
        city: string;
        state: string;
      };
    };
    competitors: Array<{
      id: string;
      team: {
        id: string;
        name: string;
        displayName: string;
        abbreviation: string;
        color: string;
        alternateColor: string;
        logo: string;
      };
      score: string;
      homeAway: 'home' | 'away';
    }>;
  }>;
}

export interface ESPNScoreboard {
  events: ESPNGame[];
  leagues: Array<{
    id: string;
    name: string;
    abbreviation: string;
  }>;
}

/**
 * ESPN API endpoints for major sports leagues
 */
const ESPN_ENDPOINTS = {
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
} as const;

export type SportType = keyof typeof ESPN_ENDPOINTS;

/**
 * Fetch today's games for a specific sport from ESPN API
 */
export async function fetchTodaysGames(sport: SportType): Promise<ESPNGame[]> {
  try {
    const endpoint = ESPN_ENDPOINTS[sport];
    console.log(`Fetching ${sport} games from ESPN:`, endpoint);
    
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'ChirpBot/2.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    const data: ESPNScoreboard = await response.json();
    
    console.log(`Successfully fetched ${data.events.length} ${sport} games from ESPN`);
    return data.events;
    
  } catch (error) {
    console.error(`Error fetching ${sport} games from ESPN:`, error);
    return [];
  }
}

/**
 * Fetch games for all supported sports
 */
export async function fetchAllTodaysGames(): Promise<Record<SportType, ESPNGame[]>> {
  const sports: SportType[] = ['NFL', 'MLB', 'NBA', 'NHL'];
  
  const results = await Promise.allSettled(
    sports.map(async (sport) => ({
      sport,
      games: await fetchTodaysGames(sport)
    }))
  );

  const gamesData: Record<SportType, ESPNGame[]> = {
    NFL: [],
    MLB: [],
    NBA: [],
    NHL: []
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      gamesData[result.value.sport] = result.value.games;
    } else {
      console.error(`Failed to fetch ${sports[index]} games:`, result.reason);
    }
  });

  return gamesData;
}

/**
 * Convert ESPN game data to our internal format
 */
export function formatGameForCalendar(game: ESPNGame, sport: SportType) {
  const competition = game.competitions[0];
  const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
  const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
  
  if (!homeTeam || !awayTeam) {
    throw new Error('Invalid game data: missing home or away team');
  }

  const gameStatus = game.status.type.name;
  const isLive = game.status.type.state === 'in';
  const isCompleted = game.status.type.completed;
  
  let statusDisplay = gameStatus;
  if (isLive && game.status.displayClock) {
    statusDisplay = `${game.status.displayClock}`;
    if (game.status.period) {
      const periodNames = {
        NFL: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'],
        NBA: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'],
        NHL: ['1st Period', '2nd Period', '3rd Period'],
        MLB: []
      };
      
      if (sport !== 'MLB' && periodNames[sport][game.status.period - 1]) {
        statusDisplay = `${periodNames[sport][game.status.period - 1]} • ${statusDisplay}`;
      }
    }
  }

  return {
    id: game.id,
    sport,
    homeTeam: {
      id: homeTeam.team.id,
      name: homeTeam.team.displayName,
      abbreviation: homeTeam.team.abbreviation,
      score: homeTeam.score ? parseInt(homeTeam.score) : 0,
      color: `#${homeTeam.team.color}`,
      logo: homeTeam.team.logo
    },
    awayTeam: {
      id: awayTeam.team.id,
      name: awayTeam.team.displayName,
      abbreviation: awayTeam.team.abbreviation,
      score: awayTeam.score ? parseInt(awayTeam.score) : 0,
      color: `#${awayTeam.team.color}`,
      logo: awayTeam.team.logo
    },
    venue: competition.venue ? {
      name: competition.venue.fullName,
      city: competition.venue.address.city,
      state: competition.venue.address.state
    } : null,
    gameTime: new Date(game.date),
    status: {
      display: statusDisplay,
      isLive,
      isCompleted,
      type: gameStatus
    },
    matchup: game.shortName
  };
}