import { BaseSportEngine, AlertConfig } from './base-engine';

interface NHLGameState {
  gameId: string;
  period: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  powerPlay: boolean;
  emptyNet: boolean;
  overtime: boolean;
  finalMinutes: boolean;
}

export class NHLEngine extends BaseSportEngine {
  sport = 'NHL';
  monitoringInterval = 15000; // 15 seconds for NHL
  
  alertConfigs: AlertConfig[] = [
    {
      type: "Power Play Alert",
      priority: 85,
      probability: 0.9,
      description: "Power play opportunity - Man advantage!",
      conditions: (state: NHLGameState) => 
        state.powerPlay
    },
    {
      type: "Empty Net Alert",
      priority: 95,
      probability: 1.0,
      description: "Empty net - Goalie pulled!",
      conditions: (state: NHLGameState) => 
        state.emptyNet
    },
    {
      type: "Third Period Alert",
      priority: 80,
      probability: 0.8,
      description: "Third period action - Final frame!",
      conditions: (state: NHLGameState) => 
        state.period === 3 && Math.abs(state.homeScore - state.awayScore) <= 2
    },
    {
      type: "Final Minutes",
      priority: 90,
      probability: 0.9,
      description: "Final minutes - Crunch time!",
      conditions: (state: NHLGameState) => 
        state.finalMinutes && state.period === 3
    },
    {
      type: "Overtime Alert",
      priority: 100,
      probability: 1.0,
      description: "OVERTIME - Sudden death!",
      conditions: (state: NHLGameState) => 
        state.overtime
    },
    {
      type: "Close Game",
      priority: 75,
      probability: 0.7,
      description: "One-goal game - Tight contest!",
      conditions: (state: NHLGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 1 && state.period >= 2
    }
  ];
  
  extractGameState(espnData: any): NHLGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const status = competition.status;
      
      return {
        gameId: `nhl-${espnData.id}`,
        period: status.period || 1,
        timeRemaining: status.displayClock || "20:00",
        homeScore: competition.competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
        awayScore: competition.competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        powerPlay: Math.random() > 0.9, // Simulated - would need more detailed data
        emptyNet: Math.random() > 0.95, // Simulated - would need more detailed data
        overtime: status.period > 3,
        finalMinutes: status.period === 3 && this.parseTimeRemaining(status.displayClock) <= 300 // 5 minutes
      };
    } catch (error) {
      console.error('Error extracting NHL game state:', error);
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
  
  protected getGameSpecificInfo(gameState: NHLGameState) {
    return {
      period: gameState.period.toString(),
      timeRemaining: gameState.timeRemaining,
      powerPlay: gameState.powerPlay,
      emptyNet: gameState.emptyNet,
      overtime: gameState.overtime
    };
  }
}

export const nhlEngine = new NHLEngine();