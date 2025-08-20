import { BaseSportEngine, AlertConfig } from './base-engine';
import { storage } from '../../storage';

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
  monitoringInterval = 3000; // 3 seconds for fast NBA monitoring
  
  async monitor() {
    try {
      // Check if demo mode is active and real-time alerts should be paused
      const { demoSimulator } = await import('../../demo-simulator');
      if (demoSimulator.shouldPauseRealTimeAlerts()) {
        console.log('⏸️ NBA monitoring paused - demo mode active');
        return;
      }

      const settings = await storage.getSettingsBySport(this.sport);
      if (!settings) {
        return;
      }
      
      console.log(`🏀 Checking ${this.sport} games for alerts...`);
      
    } catch (error) {
      console.error(`${this.sport} monitoring error:`, error);
    }
  }
  
  alertConfigs: AlertConfig[] = [
    {
      type: "Clutch Time",
      settingKey: "clutchTime",
      priority: 90,
      probability: 0.9,
      description: "🏀 CLUTCH TIME! Under 5 minutes in close game",
      conditions: (state: NBAGameState) => 
        state.clutchTime && Math.abs(state.homeScore - state.awayScore) <= 5
    },
    {
      type: "Overtime",
      settingKey: "overtime",
      priority: 95,
      probability: 1.0,
      description: "⚡ OVERTIME! Extra basketball action",
      conditions: (state: NBAGameState) => 
        state.overtime
    },
    {
      type: "NBA Close Game",
      settingKey: "nbaCloseGame",
      priority: 80,
      probability: 0.8,
      description: "🔥 TIGHT CONTEST! Anyone's game",
      conditions: (state: NBAGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 3 && state.period >= 2
    },
    // AI Prediction-based alerts
    {
      type: "Buzzer Beater Prediction",
      priority: 95,
      probability: 1.0,
      description: "🚨 BUZZER BEATER POTENTIAL - Final seconds magic!",
      isPrediction: true,
      predictionEvents: ["Buzzer Beater", "Game Winner"],
      minimumPredictionProbability: 70
    },
    {
      type: "Three Point Opportunity",
      priority: 80,
      probability: 1.0,
      description: "🎯 HIGH THREE-POINT PROBABILITY - Shooter ready!",
      isPrediction: true,
      predictionEvents: ["Three Pointer"],
      minimumPredictionProbability: 75
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

  protected buildGameContext(gameState: NBAGameState): any {
    return {
      sport: this.sport,
      period: gameState.period,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      scoreDifference: gameState.homeScore - gameState.awayScore,
      timeRemaining: gameState.timeRemaining,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live'
    };
  }
}

export const nbaEngine = new NBAEngine();