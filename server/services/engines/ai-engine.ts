import { BaseSportEngine, AlertConfig } from './base-engine';
import { GameContext, generatePredictions, PREDICTION_EVENTS } from '../ai-predictions';
import { getWeatherData } from '../weather';
import { storage } from '../../storage';

interface AIGameAnalysis {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  gameState: any; // Raw game state from sport engines
  weatherData: any;
  complexityScore: number; // How complex/interesting is this situation
  predictionOpportunities: string[]; // What events could happen
}

export class AIEngine extends BaseSportEngine {
  sport = 'AI_ANALYSIS';
  monitoringInterval = 5000; // 5 seconds - ultra-fast AI scanning
  
  async monitor() {
    try {
      // Check if AI is enabled for any sport
      const mlbSettings = await storage.getSettingsBySport('MLB');
      const nflSettings = await storage.getSettingsBySport('NFL');
      const nbaSettings = await storage.getSettingsBySport('NBA');
      const nhlSettings = await storage.getSettingsBySport('NHL');
      
      const aiEnabled = mlbSettings?.aiEnabled || nflSettings?.aiEnabled || 
                       nbaSettings?.aiEnabled || nhlSettings?.aiEnabled;
      
      if (!aiEnabled) {
        return;
      }
      
      console.log(`🤖 AI scanning all live games across all sports for complex scenarios...`);
      
      await this.scanAllGameData();
      
    } catch (error) {
      console.error(`AI analysis error:`, error);
    }
  }
  
  alertConfigs: AlertConfig[] = [
    {
      type: "High-Probability Scenario",
      priority: 95,
      probability: 1.0,
      description: "🤖 AI DETECTED HIGH-PROBABILITY EVENT - Perfect storm of conditions!",
      isPrediction: true,
      predictionEvents: ['Home Run', 'Touchdown', 'Three Pointer', 'Goal'],
      minimumPredictionProbability: 80
    },
    {
      type: "Multi-Factor Alert",
      priority: 90,
      probability: 1.0,
      description: "⚡ COMPLEX SCENARIO DETECTED - Multiple factors aligned!",
      isPrediction: true,
      predictionEvents: ['RBI Hit', 'Field Goal', 'Buzzer Beater', 'Power Play Goal'],
      minimumPredictionProbability: 75
    },
    {
      type: "Weather-Enhanced Opportunity",
      priority: 85,
      probability: 1.0,
      description: "🌪️ WEATHER ADVANTAGE - Environmental factors favor big play!",
      isPrediction: true,
      predictionEvents: ['Home Run', 'Long Pass', 'Three Pointer'],
      minimumPredictionProbability: 70
    },
    {
      type: "Clutch Moment Analysis",
      priority: 88,
      probability: 1.0,
      description: "🔥 CLUTCH SITUATION - AI detects game-changing potential!",
      isPrediction: true,
      predictionEvents: ['Walk-off Hit', 'Game Winner', 'Buzzer Beater', 'Game Winner'],
      minimumPredictionProbability: 65
    },
    {
      type: "Player-Situation Match",
      priority: 92,
      probability: 1.0,
      description: "🎯 PERFECT PLAYER MATCH - Star player in ideal situation!",
      isPrediction: true,
      predictionEvents: ['Home Run', 'Touchdown', 'Dunk', 'Hat Trick'],
      minimumPredictionProbability: 78
    }
  ];

  extractGameState(analysisData: AIGameAnalysis): AIGameAnalysis {
    return analysisData;
  }

  protected getGameSpecificInfo(gameState: AIGameAnalysis) {
    return {
      sport: gameState.sport,
      complexityScore: gameState.complexityScore,
      predictionOpportunities: gameState.predictionOpportunities,
      gameStateType: 'AI_ANALYSIS'
    };
  }

  protected buildGameContext(gameState: AIGameAnalysis): GameContext {
    const baseContext = gameState.gameState;
    return {
      sport: gameState.sport,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live',
      weather: gameState.weatherData,
      ...baseContext // Merge sport-specific context
    };
  }

  async scanAllGameData(): Promise<void> {
    try {
      console.log('🤖 AI Engine scanning all live game data for complex scenarios...');
      
      const allGameData = await this.collectAllLiveGameData();
      
      for (const gameAnalysis of allGameData) {
        try {
          // Calculate complexity score to determine if AI analysis is worth it
          const complexityScore = this.calculateComplexityScore(gameAnalysis);
          
          if (complexityScore < 60) continue; // Skip simple situations
          
          gameAnalysis.complexityScore = complexityScore;
          
          const triggeredAlerts = await this.checkAlertConditions(gameAnalysis);
          
          if (triggeredAlerts.length > 0) {
            console.log(`🤖 AI found ${triggeredAlerts.length} complex scenarios in ${gameAnalysis.homeTeam} vs ${gameAnalysis.awayTeam}`);
            await this.processAlerts(triggeredAlerts, gameAnalysis);
          }
          
        } catch (gameError) {
          console.error(`Error in AI analysis for game:`, gameError);
        }
      }
      
    } catch (error) {
      console.error('AI Engine scanning error:', error);
    }
  }

  private calculateComplexityScore(gameAnalysis: AIGameAnalysis): number {
    let score = 0;
    const { gameState, weatherData, sport } = gameAnalysis;
    
    // Base sport complexity
    if (sport === 'MLB') {
      // Runners in scoring position
      if (gameState.runners?.second || gameState.runners?.third) score += 25;
      if (gameState.runners?.first && gameState.runners?.second && gameState.runners?.third) score += 40;
      
      // Late inning pressure
      if (gameState.inning >= 7) score += 20;
      if (gameState.inning >= 9) score += 30;
      
      // Close game
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 2) score += 20;
      
      // Outs situation
      if (gameState.outs <= 1) score += 15;
      
      // Current batter power
      if (gameState.currentBatter?.stats?.hr >= 20) score += 25;
    }
    
    if (sport === 'NFL') {
      // Red zone
      if (gameState.redZone) score += 30;
      
      // Fourth down
      if (gameState.down === 4) score += 35;
      
      // Two minute warning
      if (gameState.twoMinuteWarning) score += 40;
      
      // Close game
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 7) score += 25;
    }
    
    // Weather complexity
    if (weatherData) {
      if (weatherData.windSpeed >= 10) score += 15;
      if (weatherData.windSpeed >= 15) score += 25;
      if (weatherData.condition !== 'Clear') score += 10;
    }
    
    return Math.min(100, score);
  }

  private async collectAllLiveGameData(): Promise<AIGameAnalysis[]> {
    const analyses: AIGameAnalysis[] = [];
    
    try {
      console.log('🤖 Collecting live game data from all sport engines...');
      
      // Get live games from all sports through the sports API
      const { liveSportsService } = await import('../live-sports');
      const { mlbApi } = await import('../mlb-api');
      const { getWeatherData } = await import('../weather');
      
      // Get MLB games from official API
      const mlbGames = await mlbApi.getLiveGames();
      console.log(`🤖 Found ${mlbGames.length} live MLB games`);
      
      for (const game of mlbGames) {
        try {
          if (game.gameState !== 'Live') continue;
          
          const weatherData = await getWeatherData(game.homeTeam);
          
          // Get detailed game state for complexity analysis
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);
          if (!liveFeed) continue;
          
          const gameState = this.extractMLBGameState(liveFeed);
          if (!gameState) continue;
          
          analyses.push({
            gameId: `mlb-${game.gamePk}`,
            sport: 'MLB',
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            gameState,
            weatherData: weatherData || {
              windSpeed: 5,
              windDirection: 'Variable',
              temperature: 70,
              condition: 'Clear'
            },
            complexityScore: 0,
            predictionOpportunities: [...PREDICTION_EVENTS.MLB]
          });
        } catch (gameError) {
          console.error(`Error processing MLB game ${game.gamePk}:`, gameError);
        }
      }
      
      // Get other sports from ESPN
      try {
        const todayGames = await liveSportsService.getTodaysGames();
        const otherSportsGames = todayGames.games.filter(game => 
          game.sport !== 'MLB' && game.status === 'live'
        );
        
        console.log(`🤖 Found ${otherSportsGames.length} live games from other sports`);
        
        for (const game of otherSportsGames) {
          try {
            const weatherData = await getWeatherData(game.homeTeam.name);
            
            analyses.push({
              gameId: game.id,
              sport: game.sport,
              homeTeam: game.homeTeam.name,
              awayTeam: game.awayTeam.name,
              gameState: {
                homeScore: game.homeTeam.score || 0,
                awayScore: game.awayTeam.score || 0,
                status: game.status,
                venue: game.venue
              },
              weatherData: weatherData || {
                windSpeed: 5,
                windDirection: 'Variable', 
                temperature: 70,
                condition: 'Clear'
              },
              complexityScore: 0,
              predictionOpportunities: this.getPredictionEventsForSport(game.sport)
            });
          } catch (gameError) {
            console.error(`Error processing ${game.sport} game ${game.id}:`, gameError);
          }
        }
      } catch (sportsError) {
        console.error('Error fetching other sports data:', sportsError);
      }
      
      console.log(`🤖 Collected ${analyses.length} total live games for AI analysis`);
      
    } catch (error) {
      console.error('Error collecting game data for AI analysis:', error);
    }
    
    return analyses;
  }
  
  private extractMLBGameState(liveFeed: any): any {
    try {
      const linescore = liveFeed.liveData?.linescore;
      if (!linescore) return null;
      
      return {
        inning: linescore.currentInning || 1,
        inningState: linescore.inningState || 'top',
        outs: linescore.outs || 0,
        balls: linescore.balls || 0,
        strikes: linescore.strikes || 0,
        homeScore: linescore.teams?.home?.runs || 0,
        awayScore: linescore.teams?.away?.runs || 0,
        runners: {
          first: linescore.offense?.first || false,
          second: linescore.offense?.second || false,
          third: linescore.offense?.third || false
        },
        currentBatter: liveFeed.liveData?.plays?.currentPlay?.matchup?.batter || null
      };
    } catch (error) {
      console.error('Error extracting MLB game state:', error);
      return null;
    }
  }
  
  private getPredictionEventsForSport(sport: string): string[] {
    switch (sport) {
      case 'MLB':
        return [...PREDICTION_EVENTS.MLB];
      case 'NFL':
        return [...PREDICTION_EVENTS.NFL];
      case 'NBA':
        return [...PREDICTION_EVENTS.NBA];
      case 'NHL':
        return [...PREDICTION_EVENTS.NHL];
      default:
        return ['Score', 'Win'];
    }
  }

  async startMonitoring(): Promise<void> {
    console.log(`🤖 AI Engine STARTED - ${this.monitoringInterval/1000}s intelligent scanning`);
    
    setInterval(async () => {
      await this.scanAllGameData();
    }, this.monitoringInterval);
  }
}

export const aiEngine = new AIEngine();