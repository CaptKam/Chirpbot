import { BaseSportEngine, AlertConfig } from './base-engine';

interface NFLGameState {
  gameId: string;
  quarter: number;
  timeRemaining: string;
  possession: string;
  down: number;
  yardsToGo: number;
  yardLine: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  redZone: boolean;
  twoMinuteWarning: boolean;
}

export class NFLEngine extends BaseSportEngine {
  sport = 'NFL';
  monitoringInterval = 30000; // 30 seconds for NFL
  
  alertConfigs: AlertConfig[] = [
    {
      type: "NFL Close Game",
      priority: 80,
      probability: 0.8,
      description: "One-score game - Key betting moment",
      conditions: (state: NFLGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 7 && state.quarter >= 3
    },
    {
      type: "Red Zone Alert",
      priority: 85,
      probability: 0.9,
      description: "Team in the red zone - Scoring opportunity!",
      conditions: (state: NFLGameState) => 
        state.redZone && state.quarter >= 2
    },
    {
      type: "Two Minute Warning",
      priority: 90,
      probability: 1.0,
      description: "Two minute warning - Crunch time!",
      conditions: (state: NFLGameState) => 
        state.twoMinuteWarning && Math.abs(state.homeScore - state.awayScore) <= 10
    },
    {
      type: "Fourth Down",
      priority: 95,
      probability: 0.9,
      description: "4th down decision - Go for it or punt?",
      conditions: (state: NFLGameState) => 
        state.down === 4 && state.quarter >= 3 && state.yardsToGo <= 3
    },
    {
      type: "Overtime Alert",
      priority: 100,
      probability: 1.0,
      description: "OVERTIME - Sudden death!",
      conditions: (state: NFLGameState) => 
        state.quarter === 5
    },
    {
      type: "Final Quarter",
      priority: 70,
      probability: 0.7,
      description: "Fourth quarter action - Game on the line",
      conditions: (state: NFLGameState) => 
        state.quarter === 4 && Math.abs(state.homeScore - state.awayScore) <= 14
    }
  ];
  
  extractGameState(espnData: any): NFLGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const situation = competition.situation;
      const status = competition.status;
      
      return {
        gameId: `nfl-${espnData.id}`,
        quarter: status.period || 1,
        timeRemaining: status.displayClock || "15:00",
        possession: situation?.possession || "",
        down: situation?.down || 1,
        yardsToGo: situation?.distance || 10,
        yardLine: situation?.yardLine?.toString() || "50",
        homeScore: competition.competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
        awayScore: competition.competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        redZone: (situation?.yardLine || 100) <= 20,
        twoMinuteWarning: status.displayClock === "2:00" && status.period >= 2
      };
    } catch (error) {
      console.error('Error extracting NFL game state:', error);
      return null;
    }
  }
  
  protected getGameSpecificInfo(gameState: NFLGameState) {
    return {
      quarter: gameState.quarter.toString(),
      timeRemaining: gameState.timeRemaining,
      down: gameState.down,
      yardsToGo: gameState.yardsToGo,
      possession: gameState.possession,
      redZone: gameState.redZone
    };
  }
}

export const nflEngine = new NFLEngine();