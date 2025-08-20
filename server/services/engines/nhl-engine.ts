import { BaseSportEngine, AlertConfig } from './base-engine';
import { storage } from '../../storage';
import { sportsDataService } from '../sportsdata-api';

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
  monitoringInterval = 3000; // 3 seconds for fast NHL monitoring
  
  async monitor() {
    try {
      // Check if demo mode is active and real-time alerts should be paused
      const { demoSimulator } = await import('../../demo-simulator');
      if (demoSimulator.shouldPauseRealTimeAlerts()) {
        console.log('⏸️ NHL monitoring paused - demo mode active');
        return;
      }

      const settings = await storage.getSettingsBySport(this.sport);
      if (!settings) {
        return;
      }
      
      console.log(`🏒 Checking ${this.sport} games for alerts...`);
      
      // Fetch live NHL games from SportsData.io
      const games = await sportsDataService.getNHLGames();
      const liveGames = games.filter(game => game.status === 'live');
      
      if (liveGames.length === 0) {
        return;
      }
      
      console.log(`🏒 Found ${liveGames.length} live NHL games to monitor`);
      
      // Process each live game for alerts
      for (const game of liveGames) {
        const gameState: NHLGameState = {
          gameId: game.id,
          period: 1, // Default to 1 since SportsData doesn't provide detailed period info
          timeRemaining: "20:00", // SportsData doesn't provide detailed time
          homeScore: game.homeTeam.score || 0,
          awayScore: game.awayTeam.score || 0,
          homeTeam: game.homeTeam.name,
          awayTeam: game.awayTeam.name,
          powerPlay: false, // Would need more detailed data
          emptyNet: false, // Would need more detailed data
          overtime: false, // Would need more detailed data
          finalMinutes: false
        };
        
        const triggeredAlerts = await this.checkAlertConditions(gameState);
        if (triggeredAlerts.length > 0) {
          await this.processAlerts(triggeredAlerts, gameState);
        }
      }
      
    } catch (error) {
      console.error(`${this.sport} monitoring error:`, error);
    }
  }
  
  alertConfigs: AlertConfig[] = [
    {
      type: "Power Play",
      settingKey: "powerPlay",
      priority: 85,
      probability: 0.9,
      description: "⚡ POWER PLAY! Man advantage opportunity",
      conditions: (state: NHLGameState) => 
        state.powerPlay
    },
    {
      type: "Empty Net",
      settingKey: "emptyNet",
      priority: 95,
      probability: 1.0,
      description: "😨 EMPTY NET! Goalie pulled for extra attacker",
      conditions: (state: NHLGameState) => 
        state.emptyNet
    },
    {
      type: "NHL Close Game",
      settingKey: "nhlCloseGame",
      priority: 75,
      probability: 0.7,
      description: "🏆 ONE-GOAL GAME! Tight contest",
      conditions: (state: NHLGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 1 && state.period >= 2
    },
    // AI Prediction-based alerts  
    {
      type: "Power Play Goal Prediction",
      priority: 90,
      probability: 1.0,
      description: "⚡ POWER PLAY GOAL POTENTIAL - Man advantage opportunity!",
      isPrediction: true,
      predictionEvents: ["Power Play Goal", "Goal"],
      minimumPredictionProbability: 70
    },
    {
      type: "Game Winner Prediction",
      priority: 95,
      probability: 1.0,
      description: "🏆 GAME WINNER POTENTIAL - Clutch goal opportunity!",
      isPrediction: true,
      predictionEvents: ["Game Winner", "Goal"],
      minimumPredictionProbability: 65
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

  protected buildGameContext(gameState: NHLGameState): any {
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

export const nhlEngine = new NHLEngine();