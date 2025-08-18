import type { Game, GameDay } from "@shared/schema";
import { generatePredictiveAlerts, type GameContext, type AlertResult } from "./alert-engine";

// ESPN API Interfaces
interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    venue?: {
      fullName: string;
    };
    competitors: Array<{
      id: string;
      homeAway: 'home' | 'away';
      team: {
        id: string;
        name: string;
        displayName: string;
        abbreviation: string;
      };
    }>;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
}

class LiveSportsService {
  private readonly ESPN_ENDPOINTS = {
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
  };

  private async fetchESPNGames(sport: 'MLB' | 'NFL' | 'NBA' | 'NHL'): Promise<Game[]> {
    try {
      const url = this.ESPN_ENDPOINTS[sport];
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`ESPN API error for ${sport}: ${response.status}`);
      }

      const data: ESPNResponse = await response.json();
      
      if (!data.events || data.events.length === 0) {
        console.log(`No ${sport} games found for today`);
        return [];
      }

      return data.events.map((game: ESPNGame): Game => {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn(`Invalid team data for game ${game.id}`);
          return null;
        }

        return {
          id: `${sport.toLowerCase()}-${game.id}`,
          sport,
          homeTeam: {
            id: homeTeam.team.id,
            name: homeTeam.team.displayName,
            abbreviation: homeTeam.team.abbreviation,
          },
          awayTeam: {
            id: awayTeam.team.id,
            name: awayTeam.team.displayName,
            abbreviation: awayTeam.team.abbreviation,
          },
          startTime: game.date,
          status: this.mapESPNStatus(game.status),
          venue: competition.venue?.fullName || 'TBD',
          isSelected: false,
        };
      }).filter((game): game is Game => game !== null);
    } catch (error) {
      console.error(`Error fetching ${sport} games from ESPN:`, error);
      return [];
    }
  }

  private mapESPNStatus(status: ESPNGame['status']): 'scheduled' | 'live' | 'final' {
    const state = status.type.state.toLowerCase();
    const name = status.type.name.toLowerCase();
    
    if (status.type.completed) return 'final';
    if (state === 'in' || name.includes('halftime') || name.includes('break')) return 'live';
    return 'scheduled';
  }

  private mapMLBStatus(status: string): 'scheduled' | 'live' | 'final' {
    switch (status) {
      case 'P': // Preview
        return 'scheduled';
      case 'L': // Live
        return 'live';
      case 'F': // Final
        return 'final';
      default:
        return 'scheduled';
    }
  }

  private getMockMLBGames(): Game[] {
    return [
      {
        id: 'mlb-mock-1',
        sport: 'MLB',
        homeTeam: {
          id: '119',
          name: 'Los Angeles Dodgers',
          abbreviation: 'LAD',
        },
        awayTeam: {
          id: '137',
          name: 'San Francisco Giants',
          abbreviation: 'SF',
        },
        startTime: new Date().toISOString(),
        status: 'live',
        venue: 'Dodger Stadium',
        isSelected: false,
      },
      {
        id: 'mlb-mock-2',
        sport: 'MLB',
        homeTeam: {
          id: '147',
          name: 'New York Yankees',
          abbreviation: 'NYY',
        },
        awayTeam: {
          id: '111',
          name: 'Boston Red Sox',
          abbreviation: 'BOS',
        },
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
        status: 'scheduled',
        venue: 'Yankee Stadium',
        isSelected: false,
      },
    ];
  }

  private getMockNFLGames(): Game[] {
    return [
      {
        id: 'nfl-mock-1',
        sport: 'NFL',
        homeTeam: {
          id: '22',
          name: 'Kansas City Chiefs',
          abbreviation: 'KC',
        },
        awayTeam: {
          id: '2',
          name: 'Buffalo Bills',
          abbreviation: 'BUF',
        },
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        status: 'scheduled',
        venue: 'Arrowhead Stadium',
        isSelected: false,
      },
    ];
  }

  private getMockNBAGames(): Game[] {
    return [
      {
        id: 'nba-mock-1',
        sport: 'NBA',
        homeTeam: {
          id: '1610612747',
          name: 'Los Angeles Lakers',
          abbreviation: 'LAL',
        },
        awayTeam: {
          id: '1610612738',
          name: 'Boston Celtics',
          abbreviation: 'BOS',
        },
        startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        status: 'scheduled',
        venue: 'Crypto.com Arena',
        isSelected: false,
      },
    ];
  }

  private getMockNHLGames(): Game[] {
    return [
      {
        id: 'nhl-mock-1',
        sport: 'NHL',
        homeTeam: {
          id: '26',
          name: 'Los Angeles Kings',
          abbreviation: 'LAK',
        },
        awayTeam: {
          id: '24',
          name: 'Anaheim Ducks',
          abbreviation: 'ANA',
        },
        startTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        status: 'scheduled',
        venue: 'Crypto.com Arena',
        isSelected: false,
      },
    ];
  }

  async getTodaysGames(sport?: string): Promise<GameDay> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let games: Game[] = [];

    if (!sport) {
      // Fetch all sports simultaneously
      const [mlbGames, nflGames, nbaGames, nhlGames] = await Promise.all([
        this.fetchESPNGames('MLB'),
        this.fetchESPNGames('NFL'),
        this.fetchESPNGames('NBA'),
        this.fetchESPNGames('NHL'),
      ]);
      games = [...mlbGames, ...nflGames, ...nbaGames, ...nhlGames];
    } else {
      // Fetch specific sport
      const sportCode = sport.toUpperCase() as 'MLB' | 'NFL' | 'NBA' | 'NHL';
      if (['MLB', 'NFL', 'NBA', 'NHL'].includes(sportCode)) {
        games = await this.fetchESPNGames(sportCode);
      } else {
        console.warn(`Unknown sport: ${sport}`);
      }
    }

    return {
      date: today,
      games,
    };
  }

  // NEW: Predictive Alert Generation Methods
  
  /**
   * Analyzes all live games and generates predictive alerts
   */
  async analyzeAllLiveGames(): Promise<AlertResult[]> {
    const allAlerts: AlertResult[] = [];
    
    for (const sport of ['MLB', 'NFL', 'NBA', 'NHL'] as const) {
      try {
        const games = await this.fetchESPNGames(sport);
        const liveGames = games.filter(game => game.status === 'live');
        
        for (const game of liveGames) {
          const gameAlerts = await this.generateAlertsForGame(game);
          allAlerts.push(...gameAlerts);
        }
      } catch (error) {
        console.error(`Error analyzing ${sport} games:`, error);
      }
    }
    
    return allAlerts;
  }

  /**
   * Generates predictive alerts for a specific live game
   */
  async generateAlertsForGame(game: Game): Promise<AlertResult[]> {
    try {
      // Fetch detailed game data from ESPN
      const detailedData = await this.fetchDetailedGameData(game);
      
      // Extract game context for alert engine
      const context = this.extractGameContext(game, detailedData);
      
      // Generate predictive alerts
      const alerts = generatePredictiveAlerts(context);
      
      // Add game info to each alert
      return alerts.map(alert => ({
        ...alert,
        gameId: game.id,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        sport: game.sport
      }));
      
    } catch (error) {
      console.error(`Error generating alerts for game ${game.id}:`, error);
      return [];
    }
  }

  /**
   * Fetches detailed real-time game data from ESPN
   */
  private async fetchDetailedGameData(game: Game): Promise<any> {
    try {
      const gameId = game.id.replace(`${game.sport.toLowerCase()}-`, '');
      const sport = game.sport.toLowerCase();
      
      // Construct ESPN detail URL based on sport
      const detailUrls = {
        mlb: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`,
        nfl: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
        nba: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
        nhl: `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`
      };
      
      const url = detailUrls[sport as keyof typeof detailUrls];
      if (!url) return {};
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ChirpBot/2.0' }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch detailed data for ${game.id}: ${response.status}`);
        return {};
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`Error fetching detailed game data for ${game.id}:`, error);
      return {};
    }
  }

  /**
   * Extracts GameContext from ESPN API data for predictive analysis
   */
  private extractGameContext(game: Game, detailedData: any): GameContext {
    const baseContext: GameContext = {
      sport: game.sport as 'MLB' | 'NFL' | 'NBA' | 'NHL',
      homeScore: 0,
      awayScore: 0
    };

    try {
      if (!detailedData || !detailedData.header) {
        return baseContext;
      }

      const competition = detailedData.header.competitions?.[0];
      if (!competition) return baseContext;

      // Extract scores
      const competitors = competition.competitors || [];
      const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
      
      baseContext.homeScore = parseInt(homeTeam?.score || '0');
      baseContext.awayScore = parseInt(awayTeam?.score || '0');

      // Sport-specific context extraction
      if (game.sport === 'MLB') {
        return this.extractMLBContext(baseContext, detailedData);
      } else if (game.sport === 'NFL') {
        return this.extractNFLContext(baseContext, detailedData);
      } else if (game.sport === 'NBA') {
        return this.extractNBAContext(baseContext, detailedData);
      } else if (game.sport === 'NHL') {
        return this.extractNHLContext(baseContext, detailedData);
      }

    } catch (error) {
      console.warn(`Error extracting context for ${game.id}:`, error);
    }

    return baseContext;
  }

  private extractMLBContext(base: GameContext, data: any): GameContext {
    try {
      const situation = data.situation;
      const status = data.header?.competitions?.[0]?.status;
      
      return {
        ...base,
        inning: status?.period || 1,
        half: status?.type?.detail?.includes('Top') ? 'top' : 'bottom',
        outs: situation?.outs || 0,
        runnersOn: this.parseMLBRunners(situation),
        count: {
          balls: situation?.balls || 0,
          strikes: situation?.strikes || 0
        }
      };
    } catch (error) {
      console.warn('Error extracting MLB context:', error);
      return base;
    }
  }

  private extractNFLContext(base: GameContext, data: any): GameContext {
    try {
      const situation = data.situation;
      const status = data.header?.competitions?.[0]?.status;
      
      return {
        ...base,
        quarter: status?.period || 1,
        timeRemainingSec: this.parseNFLTime(status?.displayClock),
        down: situation?.down || 1,
        distance: situation?.distance || 10,
        fieldPosition: situation?.yardLine || 50,
        redZone: (situation?.yardLine || 50) <= 20,
        isTwoMinWarning: this.parseNFLTime(status?.displayClock) <= 120
      };
    } catch (error) {
      console.warn('Error extracting NFL context:', error);
      return base;
    }
  }

  private extractNBAContext(base: GameContext, data: any): GameContext {
    try {
      const status = data.header?.competitions?.[0]?.status;
      const timeMs = this.parseNBATime(status?.displayClock);
      
      return {
        ...base,
        period: status?.period || 1,
        timeRemainingMs: timeMs,
        clutchTime: (status?.period >= 4 && timeMs <= 120000), // Final 2 minutes
        shotClock: data.situation?.shotClock || 24
      };
    } catch (error) {
      console.warn('Error extracting NBA context:', error);
      return base;
    }
  }

  private extractNHLContext(base: GameContext, data: any): GameContext {
    try {
      const status = data.header?.competitions?.[0]?.status;
      
      return {
        ...base,
        periodNumber: status?.period || 1,
        timeRemainingPeriodMs: this.parseHockeyTime(status?.displayClock),
        powerPlay: data.situation?.powerPlay || false,
        manAdvantage: data.situation?.manAdvantage || 0
      };
    } catch (error) {
      console.warn('Error extracting NHL context:', error);
      return base;
    }
  }

  // Helper methods for parsing ESPN data
  private parseMLBRunners(situation: any): string[] {
    const runners: string[] = [];
    if (situation?.onFirst) runners.push('1B');
    if (situation?.onSecond) runners.push('2B');  
    if (situation?.onThird) runners.push('3B');
    return runners;
  }

  private parseNFLTime(timeString: string): number {
    if (!timeString) return 0;
    const [minutes, seconds] = timeString.split(':').map(Number);
    return (minutes * 60) + seconds;
  }

  private parseNBATime(timeString: string): number {
    if (!timeString) return 0;
    const [minutes, seconds] = timeString.split(':').map(Number);
    return ((minutes * 60) + seconds) * 1000; // Convert to milliseconds
  }

  private parseHockeyTime(timeString: string): number {
    if (!timeString) return 0;
    const [minutes, seconds] = timeString.split(':').map(Number);
    return ((minutes * 60) + seconds) * 1000; // Convert to milliseconds
  }
}

export const liveSportsService = new LiveSportsService();