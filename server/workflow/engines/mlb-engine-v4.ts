import { UnifiedSportEngine } from './unified-sport-engine';
import { GameState } from '../../services/engines/base-engine';
import { MLBApiService } from '../../services/mlb-api';

/**
 * MLB Engine V4 - Rewritten with unified interface
 * Maintains all existing functionality with cleaner architecture
 */
export class MLBEngineV4 extends UnifiedSportEngine {
  private mlbApi: MLBApiService;

  constructor() {
    const mlbApi = new MLBApiService();
    super('MLB', mlbApi);
    this.mlbApi = mlbApi;
  }

  /**
   * Calculate probability for MLB game situations
   */
  async calculateProbability(gameState: GameState): Promise<number> {
    const { inning, outs, homeScore, awayScore } = gameState;
    let probability = 50; // Base probability

    // Inning-specific adjustments
    if (inning >= 9) probability += 25; // Extra innings or 9th
    else if (inning >= 7) probability += 15; // Late innings
    else if (inning >= 4) probability += 8; // Middle innings
    else if (inning <= 2) probability += 10; // Early game excitement

    // Outs situation - more outs = less opportunity
    if (outs === 0) probability += 20; // No outs - maximum opportunity
    else if (outs === 1) probability += 10; // One out - good opportunity
    else if (outs === 2) probability -= 5; // Two outs - pressure situation

    // Score situation
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 1) probability += 25; // Very close game
    else if (scoreDiff <= 3) probability += 15; // Close game
    else if (scoreDiff <= 5) probability += 5; // Moderately close
    else if (scoreDiff >= 10) probability -= 20; // Blowout

    // Base runners (if available in game state)
    let runnerBonus = 0;
    if (gameState.hasFirst) runnerBonus += 5;
    if (gameState.hasSecond) runnerBonus += 10; // Scoring position
    if (gameState.hasThird) runnerBonus += 15; // Prime scoring position
    probability += runnerBonus;

    // Bases loaded situation
    if (gameState.hasFirst && gameState.hasSecond && gameState.hasThird) {
      probability += 20; // Bases loaded bonus
    }

    // Count situation (if available)
    if (gameState.balls >= 3 && gameState.strikes <= 1) {
      probability += 8; // Hitter's count
    } else if (gameState.strikes >= 2 && gameState.balls <= 1) {
      probability -= 5; // Pitcher's count
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  /**
   * MLB-specific alert filtering
   */
  async sportSpecificFiltering(alertType: string, gameState: GameState): Promise<boolean> {
    // Game must be live
    if (!gameState.isLive) {
      return false;
    }

    // Filter based on alert type and game situation
    switch (alertType) {
      case 'MLB_GAME_START':
        // Only trigger at actual game start
        return gameState.inning === 1 && gameState.homeScore === 0 && gameState.awayScore === 0;

      case 'MLB_SEVENTH_INNING_STRETCH':
        // Only trigger in 7th inning
        return gameState.inning === 7;

      case 'MLB_BASES_LOADED_NO_OUTS':
        return gameState.hasFirst && gameState.hasSecond && gameState.hasThird && gameState.outs === 0;

      case 'MLB_BASES_LOADED_ONE_OUT':
        return gameState.hasFirst && gameState.hasSecond && gameState.hasThird && gameState.outs === 1;

      case 'MLB_RUNNER_ON_THIRD_NO_OUTS':
        return gameState.hasThird && gameState.outs === 0;

      case 'MLB_RUNNER_ON_THIRD_ONE_OUT':
        return gameState.hasThird && gameState.outs === 1;

      case 'MLB_FIRST_AND_THIRD_NO_OUTS':
        return gameState.hasFirst && gameState.hasThird && !gameState.hasSecond && gameState.outs === 0;

      case 'MLB_SECOND_AND_THIRD_NO_OUTS':
        return gameState.hasSecond && gameState.hasThird && gameState.outs === 0;

      case 'MLB_SECOND_AND_THIRD_ONE_OUT':
        return gameState.hasSecond && gameState.hasThird && gameState.outs === 1;

      default:
        return true; // Allow other alert types through
    }
  }

  /**
   * Enhanced game state with MLB-specific data
   */
  protected async enhanceGameState(gameState: GameState): Promise<any> {
    const enhanced = await super.enhanceGameState(gameState);

    try {
      // Get live MLB data if game is live
      if (gameState.isLive && gameState.gameId) {
        const liveData = await this.mlbApi.getEnhancedGameData(gameState.gameId);
        
        if (liveData && !liveData.error) {
          // Merge live data
          Object.assign(enhanced, {
            hasFirst: liveData.runners?.first || false,
            hasSecond: liveData.runners?.second || false,
            hasThird: liveData.runners?.third || false,
            balls: liveData.balls || 0,
            strikes: liveData.strikes || 0,
            outs: liveData.outs || enhanced.outs || 0,
            inning: liveData.inning || enhanced.inning || 1,
            isTopInning: liveData.isTopInning,
            homeScore: liveData.homeScore ?? enhanced.homeScore,
            awayScore: liveData.awayScore ?? enhanced.awayScore,
            // Additional MLB context
            batter: liveData.batter,
            pitcher: liveData.pitcher,
            currentPlay: liveData.currentPlay,
            weather: liveData.weather
          });
        }
      }

      // Add MLB-specific context
      enhanced.context = {
        ...enhanced.context,
        basesSituation: this.getBasesSituation(enhanced),
        gamePhase: this.getGamePhase(enhanced),
        scoringSituation: this.getScoringSituation(enhanced)
      };

    } catch (error) {
      console.error('❌ Error enhancing MLB game state:', error);
    }

    return enhanced;
  }

  /**
   * Get bases situation description
   */
  private getBasesSituation(gameState: any): string {
    const runners = [];
    if (gameState.hasFirst) runners.push('1st');
    if (gameState.hasSecond) runners.push('2nd');
    if (gameState.hasThird) runners.push('3rd');

    if (runners.length === 0) return 'Empty';
    if (runners.length === 3) return 'Bases Loaded';
    return runners.join(' & ') + ' base' + (runners.length > 1 ? 's' : '');
  }

  /**
   * Get game phase
   */
  private getGamePhase(gameState: any): string {
    const inning = gameState.inning || 1;
    if (inning <= 3) return 'Early';
    if (inning <= 6) return 'Middle';
    if (inning <= 9) return 'Late';
    return 'Extra';
  }

  /**
   * Get scoring situation
   */
  private getScoringSituation(gameState: any): string {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff === 0) return 'Tied';
    if (scoreDiff <= 2) return 'Close';
    if (scoreDiff <= 5) return 'Moderate';
    return 'Blowout';
  }

  /**
   * Get live games from MLB API
   */
  async getLiveGames(): Promise<Array<{ gameId: string; priority?: number }>> {
    try {
      const games = await this.mlbApi.getLiveGames();
      return games.map((game: any) => ({
        gameId: game.gameId || game.gamePk,
        priority: this.calculateGamePriority(game)
      }));
    } catch (error) {
      console.error('❌ Error getting live MLB games:', error);
      return [];
    }
  }

  /**
   * Calculate game priority for scheduling
   */
  private calculateGamePriority(game: any): number {
    let priority = 50;

    // Late innings get higher priority
    if (game.inning >= 7) priority += 20;
    
    // Close games get higher priority
    const scoreDiff = Math.abs((game.homeScore || 0) - (game.awayScore || 0));
    if (scoreDiff <= 2) priority += 15;

    // Runners on base
    if (game.hasRunners) priority += 10;

    return Math.min(priority, 100);
  }
}