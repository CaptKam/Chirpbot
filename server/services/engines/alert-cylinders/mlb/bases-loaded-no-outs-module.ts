
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';
import { PlayerContextService } from '../../../player-context-service';

export default class BasesLoadedNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_BASES_LOADED_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Bases loaded, 0 outs (~86% scoring probability)
    return hasFirst && hasSecond && hasThird && outs === 0;
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
    const baseMessage = `🔥 HIGH SCORING PROBABILITY: Bases Loaded, 0 outs - 86% chance to score!`;
    const playerContext = PlayerContextService.enhanceAlertWithPlayer(baseMessage, gameState, this.alertType);
    const enhancedMessage = playerContext + weatherContext;

    return {
      alertKey: `${gameState.gameId}_bases_loaded_no_outs`,
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
        hasFirst: gameState.hasFirst || true,
        hasSecond: gameState.hasSecond || true,
        hasThird: gameState.hasThird || true,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
        scenarioName: 'Bases Loaded',
        scoringProbability: 86,
        // Enhanced player data
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        runnerDetails: gameState.runnerDetails,
        playerImpact: this.calculatePlayerImpact(gameState),
        // Weather data
        weatherData: weatherData,
        weatherContext: weatherContext
      },
      priority: 97
    };
  }

  

  private calculatePlayerImpact(gameState: GameState): number {
    const batter = gameState.currentBatter;
    if (!batter) return 0;

    let impact = 0;
    
    // Star player bonus
    if (this.isStarPlayer(batter)) impact += 15;
    
    // Batting average impact
    const battingAvg = batter.seasonStats?.avg || batter.avg;
    if (battingAvg) {
      const avg = parseFloat(battingAvg);
      if (avg > 0.350) impact += 20;
      else if (avg > 0.300) impact += 15;
      else if (avg > 0.280) impact += 10;
    }

    // Home run potential
    const homeRuns = batter.seasonStats?.homeRuns || batter.hr || 0;
    if (homeRuns > 40) impact += 20;
    else if (homeRuns > 25) impact += 15;
    else if (homeRuns > 15) impact += 10;

    // RBI potential in clutch situations
    const rbis = batter.seasonStats?.rbi || batter.rbi || 0;
    if (rbis > 100) impact += 10;
    else if (rbis > 80) impact += 5;

    return Math.min(impact, 50); // Cap at 50% impact
  }

  calculateProbability(): number {
    return 86;
  }
}
