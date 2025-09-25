import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class WindChangeModule extends BaseAlertModule {
  alertType = 'MLB_WIND_CHANGE';
  sport = 'MLB';

  // Track previous wind conditions per game
  private previousWindData: { 
    [gameId: string]: { 
      speed: number; 
      direction: string; 
      lastAlertTime: number;
      lastMeasurement: number;
    } 
  } = {};

  // Minimum changes to trigger alert
  private readonly MIN_SPEED_CHANGE = 5; // mph (research: 5mph adds ~19 feet of carry)
  private readonly ALERT_COOLDOWN = 10 * 60 * 1000; // 10 minutes between wind alerts
  private readonly MEASUREMENT_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;
    if (!gameState.weatherContext) return false;
    
    const gameId = gameState.gameId;
    const currentWind = gameState.weatherContext;
    
    // Need wind data to work with
    if (!currentWind.windSpeed || !currentWind.windDirection) return false;

    const previous = this.previousWindData[gameId];
    const now = Date.now();

    // First measurement for this game
    if (!previous) {
      this.previousWindData[gameId] = {
        speed: currentWind.windSpeed,
        direction: currentWind.windDirection,
        lastAlertTime: 0,
        lastMeasurement: now
      };
      // Don't alert on first measurement
      return false;
    }

    // Check if enough time has passed since last measurement
    if (now - previous.lastMeasurement < this.MEASUREMENT_INTERVAL) {
      return false;
    }

    // Check cooldown
    if (now - previous.lastAlertTime < this.ALERT_COOLDOWN) {
      // Update measurement but don't alert
      this.previousWindData[gameId].speed = currentWind.windSpeed;
      this.previousWindData[gameId].direction = currentWind.windDirection;
      this.previousWindData[gameId].lastMeasurement = now;
      return false;
    }

    // Calculate changes
    const speedChange = Math.abs(currentWind.windSpeed - previous.speed);
    const directionChanged = this.hasSignificantDirectionChange(
      previous.direction,
      currentWind.windDirection
    );

    // Only alert if change exceeds threshold (research-backed)
    if (speedChange >= this.MIN_SPEED_CHANGE || directionChanged) {
      // Update data
      this.previousWindData[gameId] = {
        speed: currentWind.windSpeed,
        direction: currentWind.windDirection,
        lastAlertTime: now,
        lastMeasurement: now
      };
      return true;
    }

    // Update measurement time even if no alert
    this.previousWindData[gameId].lastMeasurement = now;
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const gameId = gameState.gameId;
    const currentWind = gameState.weatherContext!;
    const previous = this.previousWindData[gameId];

    // Calculate impact
    const impact = this.calculateWindImpact(
      previous.speed,
      previous.direction,
      currentWind.windSpeed!,
      currentWind.windDirection!
    );

    // Generate message based on impact
    const message = this.generateWindChangeMessage(
      previous.speed,
      previous.direction,
      currentWind.windSpeed!,
      currentWind.windDirection!,
      impact,
      gameState
    );

    const alertKey = `${gameId}_wind_change_${currentWind.windSpeed}_${currentWind.windDirection}_${Date.now()}`;

    const alertResult = {
      alertKey,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | Wind change`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        previousWindSpeed: previous.speed,
        previousWindDirection: previous.direction,
        currentWindSpeed: currentWind.windSpeed,
        currentWindDirection: currentWind.windDirection,
        windImpact: impact,
        temperature: currentWind.temperature,
        humidity: currentWind.humidity,
        situationType: 'WIND_CHANGE'
      },
      priority: this.calculatePriority(impact)
    };

    return alertResult;
  }

  calculateProbability(): number {
    return 70; // Base probability for wind changes
  }

  private hasSignificantDirectionChange(oldDir: string, newDir: string): boolean {
    const oldImpact = this.getDirectionImpact(oldDir);
    const newImpact = this.getDirectionImpact(newDir);

    // Significant if impact category changes (research: subtle changes matter)
    return Math.abs(oldImpact - newImpact) >= 1;
  }

  private getDirectionImpact(direction: string): number {
    if (!direction || typeof direction !== 'string') return 0;
    const dir = direction.toLowerCase();
    
    // Research: Left field winds most favorable, right field least favorable
    if (dir.includes('left')) return 3;          // most favorable (out to left)
    if (dir.includes('out') || dir.includes('center')) return 2; // moderate
    if (dir.includes('right')) return 1;         // least favorable of "out"
    if (dir.includes('in')) return -2;           // blowing in
    return 0;                                     // cross/unknown
  }

  private calculateWindImpact(
    oldSpeed: number,
    oldDir: string,
    newSpeed: number,
    newDir: string
  ): 'very_favorable' | 'favorable' | 'neutral' | 'unfavorable' {
    const oldImpact = oldSpeed * this.getDirectionImpact(oldDir) / 3;
    const newImpact = newSpeed * this.getDirectionImpact(newDir) / 3;
    const change = newImpact - oldImpact;

    if (change >= 10) return 'very_favorable';
    if (change >= 5) return 'favorable';
    if (change <= -5) return 'unfavorable';
    return 'neutral';
  }

  private calculatePriority(impact: string): number {
    switch (impact) {
      case 'very_favorable': return 85;
      case 'favorable': return 75;
      case 'unfavorable': return 70;
      default: return 65;
    }
  }

  private generateWindChangeMessage(
    oldSpeed: number,
    oldDir: string,
    newSpeed: number,
    newDir: string,
    impact: string,
    gameState: GameState
  ): string {
    const speedChange = newSpeed - oldSpeed;
    const speedChangeText = speedChange > 0 
      ? `+${speedChange}mph` 
      : `${speedChange}mph`;

    // Get current batting context
    const battingTeam = gameState.isTopInning 
      ? gameState.awayTeam 
      : gameState.homeTeam;

    let impactText = '';
    let icon = '🌬️';
    
    switch (impact) {
      case 'very_favorable':
        icon = '🔥';
        impactText = 'MAJOR boost for home runs';
        break;
      case 'favorable':
        icon = '⚡';
        impactText = 'Favors power hitters';
        break;
      case 'unfavorable':
        icon = '⚠️';
        impactText = 'Reduces home run chances';
        break;
      default:
        impactText = 'Neutral impact';
    }

    // Build comprehensive message (team names removed - already in header)
    let message = `${icon} Wind shift ${oldSpeed}mph ${oldDir} → ${newSpeed}mph ${newDir} (${speedChangeText})`;
    message += ` - ${impactText}`;

    // Add batting context if available
    if (gameState.currentBatter) {
      message += ` | ${gameState.currentBatter} at bat`;
    } else if (battingTeam) {
      message += ` | ${battingTeam} batting`;
    }

    // Add on-deck if available
    if (gameState.onDeckBatter) {
      message += ` | ${gameState.onDeckBatter} on deck`;
    }

    return message;
  }
}