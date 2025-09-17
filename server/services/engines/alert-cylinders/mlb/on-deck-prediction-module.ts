import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class OnDeckPredictionModule extends BaseAlertModule {
  alertType = 'MLB_ON_DECK_PREDICTION';
  sport = 'MLB';

  // Cache to prevent alert spam
  private lastAlertedBatter: { [gameId: string]: { batter: string; situation: string; timestamp: number } } = {};
  private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes between alerts for same batter

  // Scoring probability matrix for different situations
  private readonly SITUATION_PROBABILITIES = {
    bases_loaded: 90,
    runners_2nd_3rd: 85,
    runner_3rd: 75,
    runners_1st_3rd: 70,
    runner_2nd: 65,
    runners_1st_2nd: 60,
    runner_1st: 45,
    bases_empty: 30
  };

  // Player performance multipliers (simplified for now, could be fetched from real stats)
  private readonly POWER_HITTERS = [
    'Ohtani', 'Judge', 'Acuna', 'Betts', 'Freeman', 'Alvarez', 'Guerrero',
    'Trout', 'Harper', 'Soto', 'Goldschmidt', 'Arenado', 'Machado', 'Devers'
  ];

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;
    if (!gameState.onDeckBatter) return false;
    
    // Only trigger in innings 3+ when games get more strategic
    if (!gameState.inning || gameState.inning < 3) return false;

    // Check if we have a high-value situation developing
    const baseProbability = this.calculateBaseSituationProbability(gameState);
    const playerMultiplier = this.getPlayerMultiplier(gameState.onDeckBatter);
    const windBonus = this.getWindBonus(gameState);
    
    const totalProbability = baseProbability * playerMultiplier + windBonus;

    // Only alert for high-probability situations (>65%)
    return totalProbability >= 65;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const gameId = gameState.gameId;
    const onDeckBatter = gameState.onDeckBatter || 'Unknown';
    const situationKey = this.getSituationKey(gameState);
    
    // Check cooldown to prevent spam
    const lastAlert = this.lastAlertedBatter[gameId];
    if (lastAlert && 
        lastAlert.batter === onDeckBatter && 
        lastAlert.situation === situationKey &&
        Date.now() - lastAlert.timestamp < this.ALERT_COOLDOWN) {
      return null;
    }

    // Calculate detailed probabilities
    const baseProbability = this.calculateBaseSituationProbability(gameState);
    const playerMultiplier = this.getPlayerMultiplier(onDeckBatter);
    const windBonus = this.getWindBonus(gameState);
    const totalProbability = Math.min(95, baseProbability * playerMultiplier + windBonus);

    // Generate predictive message
    const message = this.generatePredictiveMessage(
      onDeckBatter,
      gameState,
      totalProbability
    );

    // Update cache
    this.lastAlertedBatter[gameId] = {
      batter: onDeckBatter,
      situation: situationKey,
      timestamp: Date.now()
    };

    const alertKey = `${gameId}_on_deck_${onDeckBatter.replace(/\s+/g, '_')}_${situationKey}_${gameState.inning}_${gameState.outs}`;

    return {
      alertKey,
      type: this.alertType,
      message,
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
        hasThird: gameState.hasThird || false,
        outs: gameState.outs || 0,
        onDeckBatter: onDeckBatter,
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        windSpeed: gameState.weatherContext?.windSpeed,
        windDirection: gameState.weatherContext?.windDirection,
        scoringProbability: totalProbability,
        situationType: 'ON_DECK_PREDICTION',
        isPowerHitter: this.POWER_HITTERS.some(name => 
          onDeckBatter.toLowerCase().includes(name.toLowerCase())
        )
      },
      priority: Math.min(95, 80 + Math.floor(totalProbability / 5))
    };
  }

  calculateProbability(): number {
    return 75; // Base probability for on-deck situations
  }

  private calculateBaseSituationProbability(gameState: GameState): number {
    const { hasFirst, hasSecond, hasThird, outs } = gameState;
    
    // Determine base situation
    let situation = 'bases_empty';
    if (hasFirst && hasSecond && hasThird) {
      situation = 'bases_loaded';
    } else if (hasSecond && hasThird) {
      situation = 'runners_2nd_3rd';
    } else if (hasThird) {
      situation = 'runner_3rd';
    } else if (hasFirst && hasThird) {
      situation = 'runners_1st_3rd';
    } else if (hasSecond) {
      situation = 'runner_2nd';
    } else if (hasFirst && hasSecond) {
      situation = 'runners_1st_2nd';
    } else if (hasFirst) {
      situation = 'runner_1st';
    }

    let probability = this.SITUATION_PROBABILITIES[situation as keyof typeof this.SITUATION_PROBABILITIES] || 30;

    // Adjust for outs
    if (outs === 0) {
      probability *= 1.2; // 20% bonus for no outs
    } else if (outs === 1) {
      probability *= 1.1; // 10% bonus for one out
    } else {
      probability *= 0.8; // 20% penalty for two outs
    }

    // Adjust for inning
    if (gameState.inning >= 7) {
      probability *= 1.15; // Late inning bonus
    }

    // Close game bonus
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    if (scoreDiff <= 2) {
      probability *= 1.1; // Close game bonus
    }

    return Math.min(95, probability);
  }

  private getPlayerMultiplier(batterName: string): number {
    if (!batterName) return 1.0;

    // Check if power hitter
    const isPowerHitter = this.POWER_HITTERS.some(name => 
      batterName.toLowerCase().includes(name.toLowerCase())
    );

    if (isPowerHitter) {
      return 1.25; // 25% boost for known power hitters
    }

    // Could expand this with actual player stats
    return 1.0;
  }

  private getWindBonus(gameState: GameState): number {
    if (!gameState.weatherContext) return 0;

    const windSpeed = gameState.weatherContext.windSpeed || 0;
    const windDirection = gameState.weatherContext.windDirection || '';

    // Favorable wind conditions
    if (windSpeed >= 10) {
      // Ensure windDirection is a string before calling .includes()
      if (typeof windDirection === 'string') {
        if (windDirection.includes('out') || windDirection.includes('center')) {
          return 10; // 10% bonus for strong favorable wind
        } else if (windDirection.includes('in')) {
          return -5; // 5% penalty for wind blowing in
        }
      }
    }

    return 0;
  }

  private getSituationKey(gameState: GameState): string {
    const { hasFirst, hasSecond, hasThird } = gameState;
    return `${hasFirst ? '1' : '0'}${hasSecond ? '1' : '0'}${hasThird ? '1' : '0'}_${gameState.outs}`;
  }

  private generatePredictiveMessage(
    batter: string,
    gameState: GameState,
    probability: number
  ): string {
    let situationDesc = '';
    const { hasFirst, hasSecond, hasThird } = gameState;
    
    if (hasFirst && hasSecond && hasThird) {
      situationDesc = 'bases loaded';
    } else if (hasSecond && hasThird) {
      situationDesc = 'runners on 2nd and 3rd';
    } else if (hasThird) {
      situationDesc = 'runner on 3rd';
    } else if (hasFirst && hasThird) {
      situationDesc = 'runners on 1st and 3rd';
    } else if (hasSecond) {
      situationDesc = 'runner on 2nd';
    } else if (hasFirst && hasSecond) {
      situationDesc = 'runners on 1st and 2nd';
    } else if (hasFirst) {
      situationDesc = 'runner on 1st';
    } else {
      situationDesc = 'bases empty';
    }

    const outsText = gameState.outs === 1 ? '1 out' : `${gameState.outs} outs`;
    
    // Simple context message without dramatic language
    return `On-deck prediction - ${gameState.awayTeam} @ ${gameState.homeTeam} - ${batter} coming up with ${situationDesc}, ${outsText} - ${Math.round(probability)}% scoring probability`;
  }
}