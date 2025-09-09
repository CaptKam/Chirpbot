import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';
import { PlayerContextService } from '../../../player-context-service';

export default class RunnerOnThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Runner on third, 0 outs (~65% scoring probability)
    return !hasFirst && !hasSecond && hasThird && outs === 0;
  }

  async generateAlert(gameState: GameState): Promise<AlertResult | null> {
    if (!this.isTriggered(gameState)) return null;

    // Get weather data for the home team
    const homeTeam = gameState.homeTeam;
    let weatherData = null;
    let weatherContext = '';
    
    try {
      weatherData = await weatherService.getWeatherForTeam(homeTeam);
      if (weatherData && weatherData.stadiumWindContext) {
        const homeRunFactor = weatherService.calculateHomeRunFactor(weatherData);
        
        if (homeRunFactor > 1.1) {
          weatherContext = ` 🌬️ Weather favors home runs: ${weatherData.stadiumWindContext}`;
        } else if (homeRunFactor < 0.9) {
          weatherContext = ` 🌪️ Tough conditions: ${weatherData.stadiumWindContext}`;
        } else if (weatherData.windSpeed >= 10) {
          weatherContext = ` 🌬️ ${weatherData.stadiumWindContext}`;
        }
      }
    } catch (error) {
      console.warn('Weather data unavailable for alert enhancement');
    }

    // Generate enhanced message with player and weather context
    const baseMessage = `🎯 SCORING POSITION: Runner on 3rd, 0 outs - 65% chance to score!`;
    const playerContext = PlayerContextService.enhanceAlertWithPlayer(baseMessage, gameState, this.alertType);
    const enhancedMessage = playerContext + weatherContext;

    return {
      alertKey: `${gameState.gameId}_runner_on_third_no_outs`,
      type: this.alertType,
      message: enhancedMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst || false,
        hasSecond: gameState.hasSecond || false,
        hasThird: gameState.hasThird || true,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
        scenarioName: 'Runner on Third',
        scoringProbability: 65,
        // Enhanced player data
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        runnerDetails: gameState.runnerDetails,
        playerImpact: this.calculatePlayerImpact(gameState),
        // Weather data
        weatherData: weatherData,
        weatherContext: weatherContext
      },
      priority: 85
    };
  }

  private calculatePlayerImpact(gameState: GameState): number {
    const batter = gameState.currentBatter;
    if (!batter) return 0;

    let impact = 0;
    
    // Use PlayerContextService logic for consistency
    const playerContext = PlayerContextService.generatePlayerContext(gameState, this.alertType);
    if (playerContext?.impact === 'HIGH') impact += 20;
    else if (playerContext?.impact === 'MEDIUM') impact += 10;

    return Math.min(impact, 30); // Cap at 30% impact for third base scenarios
  }

  calculateProbability(): number {
    return 65;
  }
}
class PlayerContextService {
  static enhanceAlertWithPlayer(baseMessage: string, gameState: GameState, alertType: string): string {
    // In a real scenario, this would query player data based on gameState
    // For this example, we'll add a placeholder if a specific player is relevant
    if (alertType === 'MLB_RUNNER_ON_THIRD_NO_OUTS' && gameState.batter && gameState.batter.name === 'Ohtani') {
      return `${baseMessage} - Batter: ${gameState.batter.name} is up!`;
    }
    return baseMessage;
  }
}

export default class RunnerOnThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Runner on 3rd, 0 outs (~84% scoring probability)
    return !hasFirst && !hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const baseMessage = `🎯 SCORING OPPORTUNITY: Runner on 3rd, 0 outs - 67% chance to score!`;
    const enhancedMessage = PlayerContextService.enhanceAlertWithPlayer(baseMessage, gameState, this.alertType);

    return {
      alertKey: `${gameState.gameId}_runner_on_third_no_outs`,
      type: this.alertType,
      message: enhancedMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst || false,
        hasSecond: gameState.hasSecond || false,
        hasThird: gameState.hasThird || true,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
        scenarioName: 'Runner on 3rd',
        scoringProbability: 67 // Updated probability as per example
      },
      priority: 95
    };
  }

  calculateProbability(): number {
    return 67; // Updated probability as per example
  }
}