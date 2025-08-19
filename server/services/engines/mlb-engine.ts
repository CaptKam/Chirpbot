import { BaseSportEngine, AlertConfig } from './base-engine';
import { mlbApi } from '../mlb-api';
import { GameContext, PREDICTION_EVENTS } from '../ai-predictions';
import { storage } from '../../storage';

interface MLBGameState {
  gameId: string;
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  balls: number;
  strikes: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  currentBatter?: {
    name: string;
    stats: {
      avg?: number;
      hr?: number;
      rbi?: number;
      obp?: number;
    };
  };
}

export class MLBEngine extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 10000; // 10 seconds for high-frequency monitoring
  
  alertConfigs: AlertConfig[] = [
    {
      type: "Game Start",
      priority: 40,
      probability: 1.0,
      description: "⚾ GAME START - First pitch!",
      conditions: (state: MLBGameState) => 
        state.inning === 1 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "7th Inning Warning", 
      priority: 50,
      probability: 1.0,
      description: "🚨 7TH INNING STRETCH - Critical innings ahead!",
      conditions: (state: MLBGameState) => 
        state.inning === 7 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "Tie Game 9th Inning",
      priority: 85,
      probability: 1.0, 
      description: "🔥 TIE GAME 9TH INNING - FINAL INNING DRAMA!",
      conditions: (state: MLBGameState) => 
        state.inning === 9 && state.inningState === 'top' && state.outs === 0 && 
        state.homeScore === state.awayScore
    },
    {
      type: "Bases Loaded 0 Outs",
      priority: 95,
      probability: 1.0,
      description: "🚨 BASES LOADED, 0 OUTS! - MAXIMUM scoring opportunity!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 0
    },
    {
      type: "Bases Loaded 1 Out", 
      priority: 85,
      probability: 1.0,
      description: "🔥 BASES LOADED, 1 OUT! - High-value scoring chance!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 1
    },
    {
      type: "Bases Loaded 2 Outs", 
      priority: 95,
      probability: 1.0,
      description: "🚨 BASES LOADED, 2 OUTS! - MAXIMUM PRESSURE! Make or break moment!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 2
    },
    {
      type: "Runner on 3rd, 1 Out",
      settingKey: "risp",
      priority: 80,
      probability: 0.85,
      description: "🎯 RUNNER ON 3RD, 1 OUT! (55% scoring probability)",
      conditions: (state: MLBGameState) => 
        state.runners.third && !state.runners.first && !state.runners.second && state.outs === 1
    },
    {
      type: "Runners on 2nd & 3rd, 1 Out",
      settingKey: "risp",
      priority: 85,
      probability: 0.90,
      description: "🔥 RUNNERS ON 2ND & 3RD, 1 OUT! Prime scoring opportunity",
      conditions: (state: MLBGameState) => 
        state.runners.second && state.runners.third && !state.runners.first && state.outs === 1
    },
    {
      type: "Runners In Scoring Position",
      settingKey: "risp",
      priority: 70,
      probability: 0.8,
      description: "⚡ PRESSURE COOKER! Runners in scoring position",
      conditions: (state: MLBGameState) => 
        (state.runners.second || state.runners.third) && state.outs < 2
    },
    {
      type: "Close Game", 
      settingKey: "closeGame",
      priority: 80,
      probability: 0.7,
      description: "🔥 NAIL-BITER! One-run game!",
      conditions: (state: MLBGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 1 && state.inning >= 7
    },
    {
      type: "Late Inning Pressure",
      settingKey: "lateInning",
      priority: 65,
      probability: 0.6,
      description: "⏰ CRUNCH TIME! Final innings",
      conditions: (state: MLBGameState) => 
        state.inning >= 8 && Math.abs(state.homeScore - state.awayScore) <= 3
    },
    // AI Prediction-based alerts
    {
      type: "Home Run Situations",
      settingKey: "homeRun",
      priority: 85,
      probability: 1.0,
      description: "🚀 POWER ALERT! High home run potential!",
      isPrediction: true,
      predictionEvents: ["Home Run"],
      minimumPredictionProbability: 75
    },
    {
      type: "RBI Opportunity",
      priority: 75,
      probability: 1.0,
      description: "🎯 RBI OPPORTUNITY - High scoring probability!",
      isPrediction: true,
      predictionEvents: ["RBI Hit", "Scoring Play"],
      minimumPredictionProbability: 70
    },
    {
      type: "Clutch Moment Prediction",
      priority: 90,
      probability: 1.0,
      description: "⚡ CLUTCH MOMENT - AI detects game-changing potential!",
      isPrediction: true,
      predictionEvents: ["Walk-off Hit", "Grand Slam", "Game Winner"],
      minimumPredictionProbability: 65
    }
  ];
  
  extractGameState(liveFeed: any): MLBGameState | null {
    try {
      const linescore = liveFeed.liveData.linescore;
      const gameData = liveFeed.gameData;
      
      const gameState = {
        gameId: `mlb-${gameData.game.pk}`,
        gamePk: gameData.game.pk,
        inning: linescore.currentInning || 1,
        inningState: (linescore.inningState === 'Top' ? 'top' : 'bottom') as 'top' | 'bottom',
        outs: linescore.outs || 0,
        balls: linescore.balls || 0,
        strikes: linescore.strikes || 0,
        runners: {
          first: !!linescore.offense?.first,
          second: !!linescore.offense?.second, 
          third: !!linescore.offense?.third,
        },
        homeScore: linescore.teams.home.runs || 0,
        awayScore: linescore.teams.away.runs || 0,
        homeTeam: gameData.teams.home.name,
        awayTeam: gameData.teams.away.name,
      };

      // Debug logging for live game state
      console.log(`🔍 MLB Game State Debug - ${gameState.awayTeam} @ ${gameState.homeTeam}:`);
      console.log(`   Inning: ${gameState.inning} ${gameState.inningState}`);
      console.log(`   Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}`);
      console.log(`   Runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third}`);
      console.log(`   Outs: ${gameState.outs}, Balls: ${gameState.balls}, Strikes: ${gameState.strikes}`);
      
      
      return gameState;
    } catch (error) {
      console.error('Error extracting MLB game state:', error);
      return null;
    }
  }
  
  protected getGameSpecificInfo(gameState: MLBGameState) {
    return {
      inning: gameState.inning.toString(),
      inningState: gameState.inningState,
      outs: gameState.outs,
      balls: gameState.balls,
      strikes: gameState.strikes,
      runners: gameState.runners,
      priority: 85,
      scoringProbability: this.calculateScoringProbability(gameState)
    };
  }

  protected buildGameContext(gameState: MLBGameState): GameContext {
    const runnersOn: string[] = [];
    if (gameState.runners.first) runnersOn.push("1st");
    if (gameState.runners.second) runnersOn.push("2nd");
    if (gameState.runners.third) runnersOn.push("3rd");

    return {
      sport: this.sport,
      inning: gameState.inning,
      outs: gameState.outs,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      scoreDifference: gameState.homeScore - gameState.awayScore,
      runnersOn,
      currentBatter: gameState.currentBatter,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live'
    };
  }
  
  private calculateScoringProbability(gameState: MLBGameState): number {
    let probability = 30; // Base probability
    
    // Adjust based on runners
    if (gameState.runners.first) probability += 10;
    if (gameState.runners.second) probability += 20;  
    if (gameState.runners.third) probability += 25;
    
    // Adjust based on outs
    if (gameState.outs === 0) probability += 20;
    else if (gameState.outs === 1) probability += 10;
    else probability -= 10;
    
    // Late inning pressure
    if (gameState.inning >= 8) probability += 15;
    
    return Math.min(95, Math.max(5, probability));
  }
  
  async monitor() {
    try {
      const settings = await storage.getSettingsBySport(this.sport);
      console.log(`📊 MLB Settings - AI Enabled: ${settings?.aiEnabled}`);
      if (!settings?.aiEnabled) {
        console.log(`⏸️ MLB monitoring disabled, skipping`);
        return; // Skip if disabled
      }

      const liveGames = await mlbApi.getLiveGames();
      console.log(`🎯 Found ${liveGames.length} live games`);
      if (liveGames.length === 0) return;

      console.log(`🔍 Checking ${liveGames.length} live ${this.sport} games...`);

      for (const game of liveGames) {
        try {
          console.log(`🎮 Processing game: ${game.awayTeam} @ ${game.homeTeam} (State: ${game.gameState}, PK: ${game.gamePk})`);
          
          if (game.gameState !== 'Live') {
            console.log(`⏭️ Skipping non-live game (${game.gameState})`);
            continue;
          }
          
          if (!game.gamePk) {
            console.log(`⏭️ Skipping game with no gamePk`);
            continue;
          }
          
          console.log(`🔍 Fetching live feed for game ${game.gamePk} (${game.awayTeam} @ ${game.homeTeam})`);
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);
          
          // Skip if live feed data isn't available yet (returns null for 404)
          if (!liveFeed) {
            console.log(`⚠️ No live feed data available for game ${game.gamePk} yet`);
            continue;
          }
          
          console.log(`✅ Got live feed data for game ${game.gamePk}, processing...`);
          
          const gameState = this.extractGameState(liveFeed);
          
          if (!gameState) continue;
          
          const triggeredAlerts = await this.checkAlertConditions(gameState);
          
          if (triggeredAlerts.length > 0) {
            console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
            await this.processAlerts(triggeredAlerts, gameState);
          }
          
        } catch (gameError) {
          console.error(`Error processing ${this.sport} game:`, gameError);
        }
      }
      
    } catch (error) {
      console.error(`${this.sport} monitoring error:`, error);
    }
  }
}

export const mlbEngine = new MLBEngine();