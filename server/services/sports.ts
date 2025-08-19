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

  constructor() {
    // Start game simulations for monitored teams
    this.startGameSimulations();
  }

  private startGameSimulations() {
    // Simulate live game events every 30-60 seconds
    const interval = setInterval(() => {
      try {
        this.generateRandomSportsEvent();
      } catch (error) {
        console.error('Error generating random sports event:', error);
      }
    }, 30000 + Math.random() * 30000); // 30-60 seconds

    this.gameSimulations.set("main", interval);
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
      return null; // Don't generate event this time
    }

    const games = this.getMockGames(randomEvent.sport);
    const game = games[Math.floor(Math.random() * games.length)];

    return {
      type: randomEvent.type,
      game,
      description: this.generateEventDescription(randomEvent.type, game),
    };
  }

  private getMockGames(sport: string): GameData[] {
    const games: Record<string, GameData[]> = {
      MLB: [
        {
          homeTeam: "Los Angeles Dodgers",
          awayTeam: "San Francisco Giants",
          status: "Live",
          inning: "Bottom 7th",
          score: { home: 4, away: 3 }
        },
        {
          homeTeam: "San Diego Padres",
          awayTeam: "Arizona Diamondbacks",
          status: "Live",
          inning: "Top 3rd",
          score: { home: 1, away: 2 }
        }
      ],
      NFL: [
        {
          homeTeam: "Kansas City Chiefs",
          awayTeam: "Buffalo Bills",
          status: "Live",
          quarter: "4th Quarter",
          score: { home: 21, away: 17 }
        }
      ],
      NBA: [
        {
          homeTeam: "Los Angeles Lakers",
          awayTeam: "Boston Celtics",
          status: "Live",
          quarter: "4th Quarter",
          score: { home: 98, away: 102 }
        }
      ]
    };

    return games[sport] || [];
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

  async getLiveGames(sport?: string): Promise<GameData[]> {
    // In a real implementation, this would fetch from sports APIs
    if (sport) {
      return this.getMockGames(sport);
    }
    
    return [
      ...this.getMockGames("MLB"),
      ...this.getMockGames("NFL"),
      ...this.getMockGames("NBA"),
    ];
  }

  async getTeamSchedule(teamId: string): Promise<GameData[]> {
    // Mock schedule data - in real implementation, fetch from API
    return [
      {
        homeTeam: "Los Angeles Dodgers",
        awayTeam: "San Francisco Giants",
        status: "Tomorrow 7:10 PM",
      }
    ];
  }

  generateSportsEvent(): SportsEvent | null {
    return this.generateRandomSportsEvent();
  }

  cleanup() {
    this.gameSimulations.forEach((timer) => clearInterval(timer));
    this.gameSimulations.clear();
  }
}

export const sportsService = new SportsDataService();
