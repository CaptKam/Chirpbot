// Games service to fetch live sports data from MLB and ESPN APIs
import type { Game, GameDay } from "../../shared/schema";

interface MLBScheduleGame {
  gamePk: number;
  gameDate: string;
  status: {
    statusCode: string;
    detailedState: string;
  };
  teams: {
    home: {
      team: { id: number; name: string; abbreviation: string };
      score?: number;
    };
    away: {
      team: { id: number; name: string; abbreviation: string };
      score?: number;
    };
  };
  venue: {
    name: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  };
  linescore?: {
    currentInning?: number;
    inningState?: string;
    teams: {
      home: { runs: number };
      away: { runs: number };
    };
  };
}

interface ESPNEvent {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
    };
  };
  competitions: [{
    competitors: [{
      team: { id: string; displayName: string; abbreviation: string };
      score: string;
      homeAway: string;
    }];
    venue: {
      fullName: string;
      address?: {
        latitude?: number;
        longitude?: number;
      };
    };
  }];
}

export class GamesService {
  private mlbBaseUrl = 'https://statsapi.mlb.com/api/v1';
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  async getGamesForDate(sport: string, date: string): Promise<GameDay> {
    try {
      let games: Game[] = [];

      switch (sport.toUpperCase()) {
        case 'MLB':
          games = await this.fetchMLBGames(date);
          break;
        case 'NCAAF':
          games = await this.fetchNCAAFGames(date);
          break;
        case 'NFL':
          games = await this.fetchNFLGames(date);
          break;
        case 'NBA':
          games = await this.fetchNBAGames(date);
          break;
        case 'NHL':
          games = await this.fetchNHLGames(date);
          break;
        default:
          console.warn(`Sport ${sport} not supported yet`);
      }

      return {
        date,
        games: games.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      };
    } catch (error) {
      console.error(`Failed to fetch ${sport} games for ${date}:`, error);
      return { date, games: [] };
    }
  }

  private async fetchMLBGames(date: string): Promise<Game[]> {
    try {
      const response = await fetch(`${this.mlbBaseUrl}/schedule?sportId=1&date=${date}`);
      if (!response.ok) throw new Error(`MLB API error: ${response.status}`);
      
      const data = await response.json();
      const games: Game[] = [];

      for (const dateEntry of data.dates || []) {
        for (const game of dateEntry.games || []) {
          games.push(this.transformMLBGame(game));
        }
      }

      return games;
    } catch (error) {
      console.error('Failed to fetch MLB games:', error);
      return [];
    }
  }

  private async fetchNCAAFGames(date: string): Promise<Game[]> {
    try {
      const formattedDate = date.replace(/-/g, '');
      const response = await fetch(`${this.espnBaseUrl}/football/college-football/scoreboard?dates=${formattedDate}`);
      if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
      
      const data = await response.json();
      return (data.events || []).map((event: ESPNEvent) => this.transformESPNGame(event, 'NCAAF'));
    } catch (error) {
      console.error('Failed to fetch NCAAF games:', error);
      return [];
    }
  }

  private async fetchNFLGames(date: string): Promise<Game[]> {
    try {
      const formattedDate = date.replace(/-/g, '');
      const response = await fetch(`${this.espnBaseUrl}/football/nfl/scoreboard?dates=${formattedDate}`);
      if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
      
      const data = await response.json();
      return (data.events || []).map((event: ESPNEvent) => this.transformESPNGame(event, 'NFL'));
    } catch (error) {
      console.error('Failed to fetch NFL games:', error);
      return [];
    }
  }

  private async fetchNBAGames(date: string): Promise<Game[]> {
    try {
      const formattedDate = date.replace(/-/g, '');
      const response = await fetch(`${this.espnBaseUrl}/basketball/nba/scoreboard?dates=${formattedDate}`);
      if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
      
      const data = await response.json();
      return (data.events || []).map((event: ESPNEvent) => this.transformESPNGame(event, 'NBA'));
    } catch (error) {
      console.error('Failed to fetch NBA games:', error);
      return [];
    }
  }

  private async fetchNHLGames(date: string): Promise<Game[]> {
    try {
      const formattedDate = date.replace(/-/g, '');
      const response = await fetch(`${this.espnBaseUrl}/hockey/nhl/scoreboard?dates=${formattedDate}`);
      if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
      
      const data = await response.json();
      return (data.events || []).map((event: ESPNEvent) => this.transformESPNGame(event, 'NHL'));
    } catch (error) {
      console.error('Failed to fetch NHL games:', error);
      return [];
    }
  }

  private transformMLBGame(game: MLBScheduleGame): Game {
    const status = this.mapMLBStatus(game.status.statusCode);
    
    return {
      id: game.gamePk.toString(),
      sport: 'MLB',
      homeTeam: {
        id: game.teams.home.team.id.toString(),
        name: game.teams.home.team.name,
        abbreviation: game.teams.home.team.abbreviation,
        score: game.teams.home.score
      },
      awayTeam: {
        id: game.teams.away.team.id.toString(),
        name: game.teams.away.team.name,
        abbreviation: game.teams.away.team.abbreviation,
        score: game.teams.away.score
      },
      startTime: game.gameDate,
      status,
      venue: game.venue.name,
      gamePk: game.gamePk,
      inning: game.linescore?.currentInning,
      inningState: game.linescore?.inningState
    };
  }

  private transformESPNGame(event: ESPNEvent, sport: string): Game {
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home')!;
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away')!;
    const status = this.mapESPNStatus(event.status.type.state);

    return {
      id: event.id,
      sport,
      homeTeam: {
        id: homeTeam.team.id,
        name: homeTeam.team.displayName,
        abbreviation: homeTeam.team.abbreviation,
        score: parseInt(homeTeam.score) || undefined
      },
      awayTeam: {
        id: awayTeam.team.id,
        name: awayTeam.team.displayName,
        abbreviation: awayTeam.team.abbreviation,
        score: parseInt(awayTeam.score) || undefined
      },
      startTime: event.date,
      status,
      venue: competition.venue.fullName
    };
  }

  private mapMLBStatus(statusCode: string): 'scheduled' | 'live' | 'final' {
    switch (statusCode) {
      case '1': // Scheduled
      case 'S': // Scheduled
        return 'scheduled';
      case '2': // Live
      case 'I': // In Progress
        return 'live';
      case '3': // Final
      case 'F': // Final
      case 'FT': // Final
        return 'final';
      default:
        return 'scheduled';
    }
  }

  private mapESPNStatus(state: string): 'scheduled' | 'live' | 'final' {
    switch (state) {
      case 'pre':
        return 'scheduled';
      case 'in':
        return 'live';
      case 'post':
        return 'final';
      default:
        return 'scheduled';
    }
  }
}

export const gamesService = new GamesService();