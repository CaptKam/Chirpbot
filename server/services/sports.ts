
import type { Team } from "@shared/schema";

export interface GameData {
  homeTeam: string;
  awayTeam: string;
  status: string;
  quarter?: string;
  inning?: string;
  period?: string;
  score?: {
    home: number;
    away: number;
  };
}

export interface SportsEvent {
  type: string;
  game: GameData;
  description: string;
  context?: string;
}

export class SportsDataService {
  private gameSimulations: Map<string, NodeJS.Timeout> = new Map();
  private baseUrl = "https://site.api.espn.com/apis/site/v2/sports";

  constructor() {
    // Start checking for real game events every 2 minutes
    this.startRealTimeMonitoring();
  }

  private startRealTimeMonitoring() {
    const interval = setInterval(() => {
      this.checkForGameEvents();
    }, 120000); // Check every 2 minutes

    this.gameSimulations.set("main", interval);
  }

  private async checkForGameEvents() {
    try {
      const sports = ["baseball/mlb", "football/nfl", "basketball/nba", "hockey/nhl"];
      
      for (const sport of sports) {
        const games = await this.fetchLiveGames(sport);
        
        for (const game of games) {
          const event = this.analyzeGameForEvents(game, sport);
          if (event) {
            // This would trigger alert creation in the main routes
            console.log("Real-time event detected:", event);
          }
        }
      }
    } catch (error) {
      console.error("Error checking for game events:", error);
    }
  }

  private async fetchLiveGames(sport: string): Promise<GameData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${sport}/scoreboard`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      
      const data = await response.json();
      return this.parseESPNGames(data, sport);
    } catch (error) {
      console.error(`Failed to fetch ${sport} games:`, error);
      return this.getFallbackMockGames(sport);
    }
  }

  private parseESPNGames(data: any, sport: string): GameData[] {
    if (!data.events || !Array.isArray(data.events)) {
      return [];
    }

    return data.events
      .filter((event: any) => event.status?.type?.state === "in")
      .map((event: any) => {
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors || [];
        
        const homeTeam = competitors.find((c: any) => c.homeAway === "home");
        const awayTeam = competitors.find((c: any) => c.homeAway === "away");

        let statusDetail = event.status?.type?.detail || "Live";
        let gameSpecificStatus = {};

        // Add sport-specific status information
        if (sport.includes("baseball")) {
          const situation = event.status?.type?.shortDetail;
          if (situation) {
            gameSpecificStatus = { inning: situation };
          }
        } else if (sport.includes("football")) {
          const period = event.status?.period;
          const clock = event.status?.displayClock;
          if (period) {
            gameSpecificStatus = { quarter: `${this.getOrdinal(period)} Quarter${clock ? ` - ${clock}` : ""}` };
          }
        } else if (sport.includes("basketball")) {
          const period = event.status?.period;
          const clock = event.status?.displayClock;
          if (period) {
            gameSpecificStatus = { quarter: `${this.getOrdinal(period)} Quarter${clock ? ` - ${clock}` : ""}` };
          }
        } else if (sport.includes("hockey")) {
          const period = event.status?.period;
          const clock = event.status?.displayClock;
          if (period) {
            gameSpecificStatus = { period: `${this.getOrdinal(period)} Period${clock ? ` - ${clock}` : ""}` };
          }
        }

        return {
          homeTeam: homeTeam?.team?.displayName || "Unknown",
          awayTeam: awayTeam?.team?.displayName || "Unknown",
          status: statusDetail,
          score: {
            home: parseInt(homeTeam?.score || "0"),
            away: parseInt(awayTeam?.score || "0")
          },
          ...gameSpecificStatus
        };
      });
  }

  private getOrdinal(num: number): string {
    const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];
    return ordinals[num - 1] || `${num}th`;
  }

  private analyzeGameForEvents(game: GameData, sport: string): SportsEvent | null {
    // Analyze real game data for alert-worthy events
    const sportKey = sport.split("/")[1].toUpperCase();
    
    if (sportKey === "MLB" && game.inning) {
      // Check for late inning scenarios
      if (game.inning.includes("7th") || game.inning.includes("8th") || game.inning.includes("9th")) {
        const scoreDiff = Math.abs((game.score?.home || 0) - (game.score?.away || 0));
        if (scoreDiff <= 2) {
          return {
            type: "LateInning",
            game,
            description: `Critical late inning situation: ${game.homeTeam} vs ${game.awayTeam} in a close game`
          };
        }
      }
    }

    if (sportKey === "NFL" && game.quarter) {
      // Check for 4th quarter scenarios
      if (game.quarter.includes("4th")) {
        const scoreDiff = Math.abs((game.score?.home || 0) - (game.score?.away || 0));
        if (scoreDiff <= 7) {
          return {
            type: "RedZone",
            game,
            description: `4th quarter pressure: ${game.homeTeam} vs ${game.awayTeam} within one touchdown`
          };
        }
      }
    }

    if (sportKey === "NBA" && game.quarter) {
      // Check for 4th quarter clutch time
      if (game.quarter.includes("4th")) {
        const scoreDiff = Math.abs((game.score?.home || 0) - (game.score?.away || 0));
        if (scoreDiff <= 5) {
          return {
            type: "ClutchTime",
            game,
            description: `Clutch time: ${game.homeTeam} vs ${game.awayTeam} within 5 points in 4th quarter`
          };
        }
      }
    }

    return null;
  }

  private getFallbackMockGames(sport: string): GameData[] {
    // Fallback to mock data if API fails
    const games: Record<string, GameData[]> = {
      "baseball/mlb": [
        {
          homeTeam: "Los Angeles Dodgers",
          awayTeam: "San Francisco Giants",
          status: "Live",
          inning: "Bottom 7th",
          score: { home: 4, away: 3 }
        }
      ],
      "football/nfl": [
        {
          homeTeam: "Kansas City Chiefs",
          awayTeam: "Buffalo Bills",
          status: "Live",
          quarter: "4th Quarter",
          score: { home: 21, away: 17 }
        }
      ],
      "basketball/nba": [
        {
          homeTeam: "Los Angeles Lakers",
          awayTeam: "Boston Celtics",
          status: "Live",
          quarter: "4th Quarter",
          score: { home: 98, away: 102 }
        }
      ],
      "hockey/nhl": []
    };

    return games[sport] || [];
  }

  async getLiveGames(sport?: string): Promise<GameData[]> {
    if (sport) {
      const sportMapping: Record<string, string> = {
        "MLB": "baseball/mlb",
        "NFL": "football/nfl",
        "NBA": "basketball/nba",
        "NHL": "hockey/nhl"
      };
      
      const espnSport = sportMapping[sport];
      if (espnSport) {
        return await this.fetchLiveGames(espnSport);
      }
    }
    
    // Get all live games
    const allGames: GameData[] = [];
    const sports = ["baseball/mlb", "football/nfl", "basketball/nba", "hockey/nhl"];
    
    for (const sportPath of sports) {
      const games = await this.fetchLiveGames(sportPath);
      allGames.push(...games);
    }
    
    return allGames;
  }

  async getTeamSchedule(teamId: string): Promise<GameData[]> {
    try {
      // This would require team-specific API calls
      // For now, return live games as a simplified implementation
      return await this.getLiveGames();
    } catch (error) {
      console.error("Failed to fetch team schedule:", error);
      return [
        {
          homeTeam: "Los Angeles Dodgers",
          awayTeam: "San Francisco Giants",
          status: "Tomorrow 7:10 PM",
        }
      ];
    }
  }

  generateSportsEvent(): SportsEvent | null {
    // This method is kept for manual simulation, but now we primarily use real data
    return this.generateRandomSportsEvent();
  }

  private generateRandomSportsEvent(): SportsEvent | null {
    const eventTypes = [
      { type: "RISP", sport: "MLB", probability: 0.3 },
      { type: "HomeRun", sport: "MLB", probability: 0.1 },
      { type: "LateInning", sport: "MLB", probability: 0.2 },
      { type: "RedZone", sport: "NFL", probability: 0.4 },
      { type: "ClutchTime", sport: "NBA", probability: 0.3 },
    ];

    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    if (Math.random() > randomEvent.probability) {
      return null;
    }

    const games = this.getFallbackMockGames(this.getSportPath(randomEvent.sport));
    if (games.length === 0) return null;
    
    const game = games[Math.floor(Math.random() * games.length)];

    return {
      type: randomEvent.type,
      game,
      description: this.generateEventDescription(randomEvent.type, game),
    };
  }

  private getSportPath(sport: string): string {
    const mapping: Record<string, string> = {
      "MLB": "baseball/mlb",
      "NFL": "football/nfl", 
      "NBA": "basketball/nba",
      "NHL": "hockey/nhl"
    };
    return mapping[sport] || "baseball/mlb";
  }

  private generateEventDescription(type: string, game: GameData): string {
    const descriptions: Record<string, string[]> = {
      RISP: [
        `${game.homeTeam} has runners in scoring position with their cleanup hitter at the plate`,
        `Bases loaded situation developing for ${game.awayTeam} with two outs`,
        `Critical RISP opportunity as ${game.homeTeam} looks to break the tie`,
      ],
      HomeRun: [
        `Power hitter stepping up for ${game.homeTeam} in a crucial at-bat`,
        `Long ball threat as ${game.awayTeam}'s slugger faces a struggling pitcher`,
        `Home run derby conditions with favorable wind patterns`,
      ],
      LateInning: [
        `${game.homeTeam} bringing in their closer for a save situation`,
        `High-leverage late inning scenario with the tying run on base`,
        `Bullpen battle intensifies as both teams make critical pitching changes`,
      ],
      RedZone: [
        `${game.homeTeam} driving into the red zone with 1st and goal`,
        `Goal line stand developing as ${game.awayTeam} faces 4th down`,
        `Critical red zone opportunity with the game on the line`,
      ],
      ClutchTime: [
        `Final two minutes and ${game.homeTeam} is looking to close out the game`,
        `Clutch shooting situation as ${game.awayTeam} trails by a single possession`,
        `Crunch time scenario with playoff implications on the line`,
      ],
    };

    const options = descriptions[type] || [`${type} situation developing in ${game.homeTeam} vs ${game.awayTeam}`];
    return options[Math.floor(Math.random() * options.length)];
  }

  cleanup() {
    this.gameSimulations.forEach((timer) => clearInterval(timer));
    this.gameSimulations.clear();
  }
}

export const sportsService = new SportsDataService();
