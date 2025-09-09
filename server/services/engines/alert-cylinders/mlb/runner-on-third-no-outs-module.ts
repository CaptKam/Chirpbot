import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

// Assuming PlayerContextService is defined elsewhere and imported
// For demonstration purposes, let's assume a basic structure
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