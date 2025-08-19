import { BaseSportEngine, AlertConfig } from './base-engine';

interface NBAGameState {
  gameId: string;
  period: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  clutchTime: boolean;
  overtime: boolean;
}

export class NBAEngine extends BaseSportEngine {
  sport = 'NBA';
  monitoringInterval = 20000; // 20 seconds for NBA
  
  alertConfigs: AlertConfig[] = [
    {
      type: "ClutchTime",
      priority: 90,
      probability: 0.9,
      description: "Clutch time - Under 5 minutes in close game!",
      conditions: (state: NBAGameState) => 
        state.clutchTime && Math.abs(state.homeScore - state.awayScore) <= 5
    },
    {
      type: "Overtime Alert",
      priority: 95,
      probability: 1.0,
      description: "OVERTIME - Extra basketball!",
      conditions: (state: NBAGameState) => 
        state.overtime
    },
    {
      type: "Fourth Quarter",
      priority: 75,
      probability: 0.8,
      description: "Fourth quarter action - Game heating up",
      conditions: (state: NBAGameState) => 
        state.period === 4 && Math.abs(state.homeScore - state.awayScore) <= 10
    },
    {
      type: "Blowout Alert",
      priority: 60,
      probability: 0.5,
      description: "One team pulling away - Potential comeback?",
      conditions: (state: NBAGameState) => 
        Math.abs(state.homeScore - state.awayScore) >= 20 && state.period >= 3
    },
    {
      type: "Close Game",
      priority: 80,
      probability: 0.8,
      description: "Tight contest - Anyone's game!",
      conditions: (state: NBAGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 3 && state.period >= 2
    }
  ];
  
  extractGameState(espnData: any): NBAGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const status = competition.status;
      
      return {
        gameId: `nba-${espnData.id}`,
        period: status.period || 1,
        timeRemaining: status.displayClock || "12:00",
        homeScore: competition.competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
        awayScore: competition.competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        clutchTime: status.period === 4 && this.parseTimeRemaining(status.displayClock) <= 300, // 5 minutes
        overtime: status.period > 4
      };
    } catch (error) {
      console.error('Error extracting NBA game state:', error);
      return null;
    }
  }
  
  private parseTimeRemaining(timeString: string): number {
    const parts = timeString.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }
  
  protected getGameSpecificInfo(gameState: NBAGameState) {
    return {
      period: gameState.period.toString(),
      timeRemaining: gameState.timeRemaining,
      clutchTime: gameState.clutchTime,
      overtime: gameState.overtime
    };
  }
}

export const nbaEngine = new NBAEngine();